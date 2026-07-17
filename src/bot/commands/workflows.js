import { parseCommandTokens } from "./args.js";

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
  const bindings = steps
    .map((step) => step?.targetBinding)
    .filter((binding) => binding && binding.type && binding.type !== "none");
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
  for (const binding of bindings) {
    if (!binding.inputName) {
      return { error: `Workflow \`${workflow.name ?? workflow.id}\` has an unsupported target binding without an input name.` };
    }
    allowedNames.add(binding.inputName);
  }

  for (const key of Object.keys(providedInputs)) {
    if (!allowedNames.has(key)) {
      return { error: `Workflow input \`${key}\` is not declared by this workflow.` };
    }
    if (bindings.some((binding) => binding.inputName === key)) {
      return { error: `Workflow input \`${key}\` is supplied by the currently selected target and cannot be overridden.` };
    }
  }

  const inputs = { ...providedInputs };
  for (const binding of bindings) {
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
    steps.flatMap((step) => Array.isArray(step?.contextGrants) ? step.contextGrants : [])
      .filter(Boolean)
  )];
  const name = workflow.name ?? workflow.id ?? "workflow";
  const starterContent = String(workflow.starterPrompt ?? "").trim()
    || `Run the ${name} workflow.`;

  return {
    inputs,
    approvedContextGrants,
    content: bindings.length > 0
      ? bindWorkflowTargetReference(starterContent, currentTarget)
      : starterContent
  };
}

export function bindWorkflowTargetReference(content, target) {
  if (!target?.name) {
    return content;
  }

  const reference = `@cluster[${escapePromptReferenceLabel(target.name)}]`;
  const existingReference = /@cluster\[(?:\\.|[^\]])*\]/i;
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
  return String(value).replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}
