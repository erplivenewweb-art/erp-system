export type RuntimeState =
  | "NOT_READY"
  | "STARTING"
  | "READY_FOR_SIMULATION"
  | "EXECUTION_DISABLED"
  | "SHUTTING_DOWN"
  | "STOPPED"
  | "FAILED";

export interface RuntimeExecutionFlags {
  productionPersistence: boolean;
  liveErpRead: boolean;
  erpWriteExecutor: boolean;
  billingExecutor: boolean;
  outboxWorker: boolean;
  reconciliationWorker: boolean;
  leaseRecoveryWorker: boolean;
  retryWorker: boolean;
  deadLetterWorker: boolean;
}

export interface RuntimeDependencyStatus {
  component: "PERSISTENCE" | "MIGRATIONS";
  status: "READY" | "NOT_READY" | "DISABLED";
  detail: string;
}

export interface RuntimeWorkerStatus {
  workerId: string;
  state: "DISABLED" | "STOPPED";
  businessHandlerExecutions: number;
}

export interface RuntimeHealth {
  runtimeState: RuntimeState;
  simulationReady: boolean;
  executionReady: false;
  executionState: "EXECUTION_DISABLED";
  featureFlags: RuntimeExecutionFlags;
  persistence: RuntimeDependencyStatus;
  migrations: RuntimeDependencyStatus;
  workers: RuntimeWorkerStatus[];
}

export interface RuntimeDiagnostics {
  runtimeState: RuntimeState;
  mode: "DEVELOPMENT_REFUSAL_RUNTIME";
  executionReady: false;
  executionPolicy: "DENY_ALL";
  flags: RuntimeExecutionFlags;
  dependencies: RuntimeDependencyStatus[];
  workers: RuntimeWorkerStatus[];
}

export type RuntimeStatus =
  | "HEALTHY"
  | "RUNTIME_DISABLED"
  | "EXECUTION_DISABLED"
  | "FEATURE_DISABLED"
  | "DEPENDENCY_MISSING"
  | "CONFIGURATION_INVALID"
  | "MAINTENANCE";

export interface RuntimeSimulationStatus {
  status: RuntimeStatus;
  mode: "SIMULATION";
  runtimeState: RuntimeState;
  executionReady: false;
  executionState: "EXECUTION_DISABLED";
  workersEnabled: false;
  erpConnectionEnabled: false;
  featureFlags: RuntimeExecutionFlags;
  persistence: RuntimeDependencyStatus;
  migrations: RuntimeDependencyStatus;
  version: string;
  build: string;
  correlationId: string;
  checkedAt: string;
}

export type RuntimeErrorKind =
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "FEATURE_DISABLED"
  | "EXECUTION_DISABLED"
  | "DEPENDENCY_FAILURE"
  | "CONFIGURATION_FAILURE"
  | "CANCELLED"
  | "UNKNOWN";

export interface RuntimeStatusError {
  kind: RuntimeErrorKind;
  code: string;
  userMessage: string;
  developerDiagnostic: string;
  correlationId: string;
  retryable: boolean;
}

export type RuntimeStatusResponse =
  | { ok: true; data: RuntimeSimulationStatus }
  | { ok: false; error: RuntimeStatusError };
