import type {
  RuntimeSimulationStatus,
  RuntimeStatus,
} from "@/features/integration-runtime/contracts";
import type { RuntimeApiClient } from "./runtime-client";

function status(
  runtimeState: RuntimeSimulationStatus["runtimeState"],
  simulationReady: boolean,
  dependenciesReady: boolean,
): RuntimeStatus {
  if (runtimeState === "FAILED") return "CONFIGURATION_INVALID";
  if (runtimeState === "SHUTTING_DOWN" || runtimeState === "STOPPED")
    return "MAINTENANCE";
  if (!dependenciesReady) return "DEPENDENCY_MISSING";
  if (!simulationReady) return "RUNTIME_DISABLED";
  return "HEALTHY";
}

export async function readRuntimeSimulationStatus(
  client: RuntimeApiClient,
  input: { correlationId: string; signal?: AbortSignal },
): Promise<RuntimeSimulationStatus> {
  const request = {
    correlationId: input.correlationId,
    ...(input.signal ? { signal: input.signal } : {}),
    retries: 0 as const,
  };
  const [health, diagnostics] = await Promise.all([
    client.health(request),
    client.diagnostics(request),
  ]);
  const dependenciesReady =
    health.persistence.status === "READY" &&
    health.migrations.status === "READY";
  const workersEnabled = health.workers.some(
    (worker) =>
      worker.state !== "DISABLED" || worker.businessHandlerExecutions !== 0,
  );
  if (
    health.runtimeState !== diagnostics.runtimeState ||
    diagnostics.executionPolicy !== "DENY_ALL" ||
    workersEnabled ||
    Object.values(health.featureFlags).some(Boolean)
  ) {
    throw new Error(
      "Runtime safety diagnostics do not match the development posture",
    );
  }
  return {
    status: status(
      health.runtimeState,
      health.simulationReady,
      dependenciesReady,
    ),
    mode: "SIMULATION",
    runtimeState: health.runtimeState,
    executionReady: false,
    executionState: "EXECUTION_DISABLED",
    workersEnabled: false,
    erpConnectionEnabled: false,
    featureFlags: health.featureFlags,
    persistence: health.persistence,
    migrations: health.migrations,
    version: client.config.version,
    build: client.config.build,
    correlationId: input.correlationId,
    checkedAt: new Date().toISOString(),
  };
}
