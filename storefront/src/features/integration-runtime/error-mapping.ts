import type { RuntimeErrorKind, RuntimeStatusError } from "./contracts";

const userMessages: Record<RuntimeErrorKind, string> = {
  UNAVAILABLE: "The development runtime is unavailable.",
  TIMEOUT: "The development runtime did not respond in time.",
  INVALID_RESPONSE:
    "The development runtime returned an invalid status response.",
  FEATURE_DISABLED: "The requested development runtime feature is disabled.",
  EXECUTION_DISABLED: "Runtime execution is intentionally disabled.",
  DEPENDENCY_FAILURE: "A development runtime dependency is not ready.",
  CONFIGURATION_FAILURE: "The development runtime configuration is invalid.",
  CANCELLED: "The runtime status request was cancelled.",
  UNKNOWN: "The development runtime status could not be loaded.",
};

const codeKinds: Record<string, RuntimeErrorKind> = {
  RUNTIME_EXECUTION_CONFIGURATION_UNSAFE: "CONFIGURATION_FAILURE",
  RUNTIME_PRODUCTION_BLOCKED: "CONFIGURATION_FAILURE",
  RUNTIME_DEPENDENCY_MISSING: "DEPENDENCY_FAILURE",
  RUNTIME_DEPENDENCY_NOT_READY: "DEPENDENCY_FAILURE",
  RUNTIME_WORKER_POSTURE_UNSAFE: "DEPENDENCY_FAILURE",
  EXECUTION_DISABLED: "EXECUTION_DISABLED",
  FEATURE_DISABLED: "FEATURE_DISABLED",
};

export function runtimeStatusError(input: {
  kind?: RuntimeErrorKind;
  code: string;
  diagnostic: string;
  correlationId: string;
}): RuntimeStatusError {
  const kind = input.kind ?? codeKinds[input.code] ?? "UNKNOWN";
  return {
    kind,
    code: input.code,
    userMessage: userMessages[kind],
    developerDiagnostic: input.diagnostic.slice(0, 240),
    correlationId: input.correlationId,
    retryable: kind === "UNAVAILABLE" || kind === "TIMEOUT",
  };
}

export class RuntimeClientError extends Error {
  readonly detail: RuntimeStatusError;

  constructor(detail: RuntimeStatusError) {
    super(detail.userMessage);
    this.name = "RuntimeClientError";
    this.detail = detail;
  }
}
