import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkflowRunArguments,
  prepareWorkflowLaunch
} from "../src/bot/commands/workflows.js";

test("workflow arguments accept quoted string inputs", () => {
  assert.deepEqual(
    parseWorkflowRunArguments('!workflow run 1 reason="check production pods" severity=high'),
    {
      reference: "1",
      inputs: {
        reason: "check production pods",
        severity: "high"
      }
    }
  );
});

test("workflow launch derives current grants, renders inputs, and binds the selected target", () => {
  const launch = prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check pods" },
    currentTarget: {
      id: "cluster-1",
      name: "Prod",
      type: "kubernetes"
    }
  });

  assert.deepEqual(launch, {
    inputs: {
      reason: "check pods",
      __acornopsTarget: {
        id: "cluster-1",
        name: "Prod",
        type: "kubernetes"
      }
    },
    approvedContextGrants: ["workspace_metadata", "target_inventory"],
    content: "Triage @target[Prod] using live evidence.\n\nWorkflow parameters:\n- Reason: check pods"
  });
});

test("workflow launch replaces a prompt placeholder with the exact selected target", () => {
  const launch = prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      prompt: "Triage @target[] using live evidence."
    },
    providedInputs: { reason: "check pods" },
    currentTarget: {
      id: "cluster-1",
      name: "Development Cluster",
      type: "kubernetes"
    }
  });

  assert.equal(
    launch.content,
    "Triage @target[Development Cluster] using live evidence.\n\nWorkflow parameters:\n- Reason: check pods"
  );
});

test("workflow launch rejects missing and unknown inputs", () => {
  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: {},
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /Missing required workflow input.*reason/);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check", extra: "no" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /extra.*not declared/);

});

test("workflow launch accepts eligible read-write workflows and enforces active compatible targets", () => {
  const elevated = prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      capabilityPolicy: {
        ...workflowDefinition().capabilityPolicy,
        mode: "read_write"
      }
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  });
  assert.equal(elevated.error, undefined);
  assert.equal(elevated.inputs.__acornopsTarget.id, "cluster-1");

  assert.match(prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      status: "draft"
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /active/);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check" },
    currentTarget: { id: "vm-1", name: "App VM", type: "virtual_machine" }
  }).error, /Kubernetes cluster/);
});

test("workflow launch enforces target allowlists and rejects unfilled non-target resources", () => {
  assert.match(prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      resourceRequirements: [{
        ...workflowDefinition().resourceRequirements[0],
        constraints: { targetTypes: ["kubernetes"], targetIds: ["cluster-2"] }
      }]
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /not allowed/);

  assert.match(prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      prompt: "Investigate @target[] using @chat[].",
      resourceRequirements: [
        ...workflowDefinition().resourceRequirements,
        { type: "chat", minimum: 1, maximum: 1, requiredOperations: ["read"] }
      ]
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /@chat\[\].*cannot currently be selected/);
});

test("workflow launch keeps input text from injecting resource references and enforces prompt limits", () => {
  const launch = prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "compare @target[Staging]" },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  });
  assert.match(launch.content, /compare ＠target\[Staging\]/);
  assert.equal((launch.content.match(/@target\[/g) ?? []).length, 1);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "x".repeat(32_768) },
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  }).error, /32768 character limit/);
});

test("workflow launch keeps legacy workflow definitions compatible while emitting current target references", () => {
  const launch = prepareWorkflowLaunch({
    workflow: {
      id: "legacy-triage",
      name: "Legacy triage",
      status: "active",
      starterPrompt: "Triage @cluster[Cluster name].",
      inputs: [],
      steps: [{
        contextGrants: ["workspace_metadata"],
        targetBinding: {
          type: "selected_cluster",
          targetType: "kubernetes",
          inputName: "clusterId"
        }
      }]
    },
    providedInputs: {},
    currentTarget: { id: "cluster-1", name: "Prod", type: "kubernetes" }
  });
  assert.equal(launch.content, "Triage @target[Prod].");
  assert.equal(launch.inputs.clusterId, "cluster-1");
  assert.equal(launch.inputs.__acornopsTarget.id, "cluster-1");
  assert.deepEqual(launch.approvedContextGrants, ["workspace_metadata"]);
});

function workflowDefinition() {
  return {
    id: "cluster-triage",
    name: "Cluster triage",
    status: "active",
    prompt: "Triage @target[] using live evidence.",
    inputs: [{ name: "reason", label: "Reason", type: "text", required: true }],
    resourceRequirements: [{
      type: "target",
      minimum: 1,
      maximum: 1,
      requiredOperations: ["read"],
      constraints: {
        targetTypes: ["kubernetes"],
        targetIds: []
      }
    }],
    capabilityPolicy: {
      mode: "read_only",
      contextGrants: ["workspace_metadata", "target_inventory", "workspace_metadata"],
      approvalRequirements: []
    }
  };
}
