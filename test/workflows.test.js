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

test("workflow launch derives grants, prompt, and selected cluster binding", () => {
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
      clusterId: "cluster-1"
    },
    approvedContextGrants: ["workspace_metadata", "target_inventory"],
    content: "Triage the selected cluster. @cluster[Prod]"
  });
});

test("workflow launch replaces a starter prompt placeholder with the exact selected cluster", () => {
  const launch = prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      starterPrompt: "Triage @cluster[Cluster name] using live evidence."
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
    "Triage @cluster[Development Cluster] using live evidence."
  );
});

test("workflow launch rejects missing, unknown, and overridden binding inputs", () => {
  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: {},
    currentTarget: { id: "cluster-1", type: "kubernetes" }
  }).error, /Missing required workflow input.*reason/);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check", extra: "no" },
    currentTarget: { id: "cluster-1", type: "kubernetes" }
  }).error, /extra.*not declared/);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check", clusterId: "other" },
    currentTarget: { id: "cluster-1", type: "kubernetes" }
  }).error, /cannot be overridden/);
});

test("workflow launch accepts eligible read-write workflows and enforces active compatible targets", () => {
  const elevated = prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      policy: { mode: "read_write", approvalRequirements: [] }
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", type: "kubernetes" }
  });
  assert.equal(elevated.error, undefined);
  assert.equal(elevated.inputs.clusterId, "cluster-1");

  assert.match(prepareWorkflowLaunch({
    workflow: {
      ...workflowDefinition(),
      status: "draft"
    },
    providedInputs: { reason: "check" },
    currentTarget: { id: "cluster-1", type: "kubernetes" }
  }).error, /active/);

  assert.match(prepareWorkflowLaunch({
    workflow: workflowDefinition(),
    providedInputs: { reason: "check" },
    currentTarget: { id: "vm-1", type: "virtual_machine" }
  }).error, /Kubernetes cluster/);
});

function workflowDefinition() {
  return {
    id: "cluster-triage",
    name: "Cluster triage",
    status: "active",
    starterPrompt: "Triage the selected cluster.",
    inputs: [{ name: "reason", type: "text", required: true }],
    policy: {
      mode: "read_only",
      approvalRequirements: []
    },
    steps: [{
      requiredInputs: ["reason"],
      contextGrants: ["workspace_metadata", "target_inventory", "workspace_metadata"],
      approvalRequired: false,
      targetBinding: {
        type: "selected_cluster",
        targetType: "kubernetes",
        inputName: "clusterId"
      }
    }]
  };
}
