import { parseCommandTokens } from "./args.js";

const MAX_WORKFLOW_CONTENT_LENGTH = 32_768;

export function parseWorkflowRunArguments(normalizedText) {
  const parsed = parseCommandTokens(normalizedText);
  if (parsed.error) {
    return parsed;
  }

  const [, subcommand = "", reference = "", ...inputTokens] = parsed.tokens;
  if (subcommand !== "run" || !reference) {
    return {
      error: "`!workflow` requires `run <number|id> [key=value...]`."
    };
  }

  const inputs = {};
  for (const token of inputTokens) {
    const separator = token.indexOf("=");
    if (separator <= 0) {
      return {
        error: `Workflow input \`${token}\` must use \`key=value\` syntax.`
      };
    }
    const key = token.slice(0, separator).trim();
    const value = token.slice(separator + 1);
    if (!key) {
      return { error: "Workflow input names cannot be empty." };
    }
    if (Object.hasOwn(inputs, key)) {
      return { error: `Workflow input \`${key}\` was provided more than once.` };
    }
    inputs[key] = value;
  }

  return { reference, inputs };
}

export function prepareWorkflowLaunch({ workflow, providedInputs, currentTarget }) {
  const safetyError = workflowSafetyError(workflow);
  if (safetyError) {
    return { error: safetyError };
  }

  const definitions = Array.isArray(workflow.inputs) ? workflow.inputs : [];
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  const legacyBindings = steps
    .map((step) => step?.targetBinding)
    .filter((binding) => binding && binding.type && binding.type !== "none");
  const requirements = Array.isArray(workflow.resourceRequirements)
    ? workflow.resourceRequirements
    : [];
  const targetRequirement = requirements.find((requirement) => requirement?.type === "target");
  const allowedNames = new Set(
    definitions.map((input) => input?.name).filter(Boolean)
  );
  const requiredNames = new Set(
    definitions.filter((input) => input?.required).map((input) => input.name)
  );

  for (const step of steps) {
    for (const name of Array.isArray(step?.requiredInputs) ? step.requiredInputs : []) {
      if (name) {
        allowedNames.add(name);
        requiredNames.add(name);
      }
    }
  }
  for (const binding of legacyBindings) {
    if (!binding.inputName) {
      return { error: `Workflow \`${workflow.name ?? workflow.id}\` has an unsupported target binding without an input name.` };
    }
    allowedNames.add(binding.inputName);
  }

  for (const key of Object.keys(providedInputs)) {
    if (!allowedNames.has(key)) {
      return { error: `Workflow input \`${key}\` is not declared by this workflow.` };
    }
    if (legacyBindings.some((binding) => binding.inputName === key)) {
      return { error: `Workflow input \`${key}\` is supplied by the currently selected target and cannot be overridden.` };
    }
  }

  const inputs = { ...providedInputs };
  for (const binding of legacyBindings) {
    const bindingError = validateTargetBinding(binding, currentTarget);
    if (bindingError) {
      return { error: bindingError };
    }
    inputs[binding.inputName] = currentTarget.id;
  }

  const missing = [...requiredNames].filter((name) => !Object.hasOwn(inputs, name) || inputs[name] === "");
  if (missing.length > 0) {
    return {
      error: `Missing required workflow input${missing.length === 1 ? "" : "s"}: ${missing.map((name) => `\`${name}\``).join(", ")}.`
    };
  }

  const approvedContextGrants = [...new Set(
    (Array.isArray(workflow.capabilityPolicy?.contextGrants)
      ? workflow.capabilityPolicy.contextGrants
      : steps.flatMap((step) => Array.isArray(step?.contextGrants) ? step.contextGrants : []))
      .filter(Boolean)
  )];
  const name = workflow.name ?? workflow.id ?? "workflow";
  const starterContent = String(workflow.prompt ?? workflow.starterPrompt ?? "").trim()
    || `Run the ${name} workflow.`;
  const targetTokens = promptReferences(starterContent).filter((token) => token.type === "target" || token.type === "cluster");
  const needsSelectedTarget = legacyBindings.length > 0
    || targetTokens.some((token) => !token.label)
    || (Number(targetRequirement?.minimum ?? 0) > 0 && targetTokens.length === 0);
  if (needsSelectedTarget) {
    const targetError = validateTargetRequirement(targetRequirement, currentTarget);
    if (targetError) {
      return { error: targetError };
    }
  }

  let content = needsSelectedTarget
    ? bindWorkflowTargetReference(starterContent, currentTarget)
    : starterContent;
  const resourceError = validateResourceRequirements(content, requirements);
  if (resourceError) {
    return { error: resourceError };
  }
  content = appendWorkflowInputs(content, definitions, providedInputs);
  if (content.length > MAX_WORKFLOW_CONTENT_LENGTH) {
    return { error: `Workflow launch content exceeds the ${MAX_WORKFLOW_CONTENT_LENGTH} character limit.` };
  }

  if (needsSelectedTarget) {
    inputs.__acornopsTarget = {
      id: currentTarget.id,
      name: currentTarget.name,
      type: normalizeTargetType(currentTarget.type)
    };
  }

  return {
    inputs,
    approvedContextGrants,
    content
  };
}

export function bindWorkflowTargetReference(content, target) {
  if (!target?.name) {
    return content;
  }

  const reference = `@target[${escapePromptReferenceLabel(target.name)}]`;
  const existingReference = /@(target|cluster)\[(?:\\.|[^\]])*\]/i;
  if (existingReference.test(content)) {
    return content.replace(existingReference, reference);
  }
  return `${content.trim()} ${reference}`.trim();
}

function workflowSafetyError(workflow) {
  if (workflow.status && workflow.status !== "active") {
    return "Only active workflows can be launched from Mattermost.";
  }
  return "";
}

function validateTargetBinding(binding, currentTarget) {
  if (!currentTarget?.id) {
    return "Choose a compatible target first: send `!targets`, then `!target 1`.";
  }

  const targetType = normalizeTargetType(currentTarget.type);
  if (binding.type === "selected_cluster" && targetType !== "kubernetes") {
    return "This workflow requires a selected Kubernetes cluster.";
  }
  const requiredType = normalizeTargetType(binding.targetType);
  if (requiredType && targetType !== requiredType) {
    return `This workflow requires a selected ${requiredType === "virtual_machine" ? "VM" : "Kubernetes cluster"}.`;
  }
  return "";
}

function validateTargetRequirement(requirement, currentTarget) {
  if (!currentTarget?.id || !currentTarget?.name) {
    return "Choose a compatible target first: send `!targets`, then `!target 1`.";
  }
  const constraints = requirement?.constraints && typeof requirement.constraints === "object"
    ? requirement.constraints
    : {};
  const targetType = normalizeTargetType(currentTarget.type);
  const targetTypes = Array.isArray(constraints.targetTypes)
    ? constraints.targetTypes.map(normalizeTargetType).filter(Boolean)
    : [];
  if (targetTypes.length > 0 && !targetTypes.includes(targetType)) {
    return targetTypes.length === 1 && targetTypes[0] === "kubernetes"
      ? "This workflow requires a selected Kubernetes cluster."
      : targetTypes.length === 1 && targetTypes[0] === "virtual_machine"
        ? "This workflow requires a selected VM."
        : "The selected target type is not allowed by this workflow.";
  }
  const targetIds = Array.isArray(constraints.targetIds)
    ? constraints.targetIds.filter((value) => typeof value === "string" && value)
    : [];
  if (targetIds.length > 0 && !targetIds.includes(currentTarget.id)) {
    return "The selected target is not allowed by this workflow.";
  }
  return "";
}

function validateResourceRequirements(content, requirements) {
  const references = promptReferences(content);
  const placeholder = references.find((reference) => !reference.label);
  if (placeholder) {
    return `Complete the \`@${placeholder.type}[]\` workflow resource before launching. This resource cannot currently be selected from Mattermost.`;
  }
  for (const requirement of requirements) {
    const count = references.filter((reference) => reference.type === requirement?.type).length;
    const minimum = Number(requirement?.minimum ?? 0);
    const maximum = Number(requirement?.maximum ?? Number.MAX_SAFE_INTEGER);
    if (count < minimum || count > maximum) {
      return requirement?.type === "target" && count < minimum
        ? "Choose a compatible target first: send `!targets`, then `!target 1`."
        : `This workflow requires between ${minimum} and ${maximum} \`@${requirement?.type ?? "resource"}[]\` references. Add the required resources in the AcornOps console before launching from Mattermost.`;
    }
  }
  return "";
}

function appendWorkflowInputs(content, definitions, providedInputs) {
  const entries = Object.entries(providedInputs);
  if (entries.length === 0) {
    return content;
  }
  const labels = new Map(definitions.map((definition) => [definition?.name, definition?.label || definition?.name]));
  const lines = entries.map(([key, value]) => {
    const label = sanitizePromptText(labels.get(key) || key);
    return `- ${label}: ${sanitizePromptText(value)}`;
  });
  return `${content.trim()}\n\nWorkflow parameters:\n${lines.join("\n")}`;
}

function sanitizePromptText(value) {
  return String(value)
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replaceAll("@", "＠")
    .trim();
}

function promptReferences(content) {
  const references = [];
  const pattern = /@([a-z][a-z0-9_-]*)\[((?:\\\\|\\\]|[^\]])*)\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    references.push({
      type: match[1],
      label: match[2].replaceAll("\\]", "]").replaceAll("\\\\", "\\").trim()
    });
  }
  return references;
}

export function workflowTargetFromInputs(inputs) {
  const target = inputs?.__acornopsTarget;
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return null;
  }
  const id = String(target.id ?? "");
  const name = String(target.name ?? "");
  const type = normalizeTargetType(target.type);
  return id && name ? { id, name, type } : null;
}

function normalizeTargetType(value) {
  if (value === "vm" || value === "virtual_machine") {
    return "virtual_machine";
  }
  if (value === "cluster" || value === "kubernetes") {
    return "kubernetes";
  }
  return value ?? "";
}

function escapePromptReferenceLabel(value) {
  return String(value).normalize("NFC").replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}
