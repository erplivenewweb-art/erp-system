import { createHash, createHmac, randomBytes } from "node:crypto";
import type {
  RuntimeDiagnostics,
  RuntimeExecutionFlags,
  RuntimeHealth,
  RuntimeState,
} from "@/features/integration-runtime/contracts";
import {
  RuntimeClientError,
  runtimeStatusError,
} from "@/features/integration-runtime/error-mapping";

const privatePaths = {
  health: "/internal/v1/runtime/health",
  diagnostics: "/internal/v1/runtime/diagnostics",
} as const;

export interface RuntimeClientConfig {
  baseUrl: string;
  serviceKeyId: string;
  serviceSecret: string;
  timeoutMs: number;
  version: string;
  build: string;
}

export interface RuntimeRequestOptions {
  correlationId: string;
  signal?: AbortSignal;
  retries?: 0 | 1;
}

type FetchImplementation = typeof fetch;

const runtimeStates = new Set<RuntimeState>([
  "NOT_READY",
  "STARTING",
  "READY_FOR_SIMULATION",
  "EXECUTION_DISABLED",
  "SHUTTING_DOWN",
  "STOPPED",
  "FAILED",
]);

const flagNames: (keyof RuntimeExecutionFlags)[] = [
  "productionPersistence",
  "liveErpRead",
  "erpWriteExecutor",
  "billingExecutor",
  "outboxWorker",
  "reconciliationWorker",
  "leaseRecoveryWorker",
  "retryWorker",
  "deadLetterWorker",
];

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

function flags(value: unknown): RuntimeExecutionFlags | undefined {
  const candidate = record(value);
  if (
    !candidate ||
    flagNames.some((name) => typeof candidate[name] !== "boolean")
  )
    return undefined;
  return Object.fromEntries(
    flagNames.map((name) => [name, candidate[name]]),
  ) as unknown as RuntimeExecutionFlags;
}

function dependency(value: unknown) {
  const candidate = record(value);
  if (
    !candidate ||
    !["PERSISTENCE", "MIGRATIONS"].includes(String(candidate.component)) ||
    !["READY", "NOT_READY", "DISABLED"].includes(String(candidate.status)) ||
    typeof candidate.detail !== "string"
  ) {
    return undefined;
  }
  return candidate as unknown as RuntimeHealth["persistence"];
}

function workers(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some((item) => {
      const candidate = record(item);
      return (
        !candidate ||
        typeof candidate.workerId !== "string" ||
        !["DISABLED", "STOPPED"].includes(String(candidate.state)) ||
        typeof candidate.businessHandlerExecutions !== "number"
      );
    })
  ) {
    return undefined;
  }
  return value as RuntimeHealth["workers"];
}

function parseHealth(value: unknown): RuntimeHealth | undefined {
  const candidate = record(value);
  const parsedFlags = flags(candidate?.featureFlags);
  const persistence = dependency(candidate?.persistence);
  const migrations = dependency(candidate?.migrations);
  const parsedWorkers = workers(candidate?.workers);
  if (
    !candidate ||
    !runtimeStates.has(candidate.runtimeState as RuntimeState) ||
    typeof candidate.simulationReady !== "boolean" ||
    candidate.executionReady !== false ||
    candidate.executionState !== "EXECUTION_DISABLED" ||
    !parsedFlags ||
    !persistence ||
    !migrations ||
    !parsedWorkers
  ) {
    return undefined;
  }
  return {
    runtimeState: candidate.runtimeState as RuntimeState,
    simulationReady: candidate.simulationReady,
    executionReady: false,
    executionState: "EXECUTION_DISABLED",
    featureFlags: parsedFlags,
    persistence,
    migrations,
    workers: parsedWorkers,
  };
}

function parseDiagnostics(value: unknown): RuntimeDiagnostics | undefined {
  const candidate = record(value);
  const parsedFlags = flags(candidate?.flags);
  const parsedWorkers = workers(candidate?.workers);
  if (
    !candidate ||
    !runtimeStates.has(candidate.runtimeState as RuntimeState) ||
    candidate.mode !== "DEVELOPMENT_REFUSAL_RUNTIME" ||
    candidate.executionReady !== false ||
    candidate.executionPolicy !== "DENY_ALL" ||
    !parsedFlags ||
    !Array.isArray(candidate.dependencies) ||
    !parsedWorkers
  ) {
    return undefined;
  }
  const dependencies = candidate.dependencies.map(dependency);
  if (dependencies.some((item) => !item)) return undefined;
  return {
    runtimeState: candidate.runtimeState as RuntimeState,
    mode: "DEVELOPMENT_REFUSAL_RUNTIME",
    executionReady: false,
    executionPolicy: "DENY_ALL",
    flags: parsedFlags,
    dependencies: dependencies as RuntimeDiagnostics["dependencies"],
    workers: parsedWorkers,
  };
}

function canonical(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
): string {
  const emptyBodyHash = createHash("sha256").update("").digest("hex");
  return [method, path, timestamp, nonce, emptyBodyHash].join("\n");
}

function validCorrelation(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

export function loadRuntimeClientConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeClientConfig {
  if (environment.NODE_ENV === "production") {
    throw new Error("Development runtime client is disabled in production");
  }
  const baseUrl =
    environment.INTEGRATION_RUNTIME_BASE_URL ?? "http://127.0.0.1:4200";
  const parsed = new URL(baseUrl);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/"
  ) {
    throw new Error("Integration runtime URL must be a loopback HTTP origin");
  }
  const serviceKeyId =
    environment.INTEGRATION_RUNTIME_SERVICE_KEY_ID ?? "commerce-api-v1";
  const serviceSecret = environment.INTEGRATION_RUNTIME_SERVICE_SECRET ?? "";
  const timeoutMs = Number(
    environment.INTEGRATION_RUNTIME_TIMEOUT_MS ?? "2500",
  );
  if (
    !/^[A-Za-z0-9._:-]{3,128}$/.test(serviceKeyId) ||
    serviceSecret.length < 32
  ) {
    throw new Error("Integration runtime service credential is invalid");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new Error("Integration runtime timeout is invalid");
  }
  return {
    baseUrl: parsed.origin,
    serviceKeyId,
    serviceSecret,
    timeoutMs,
    version: environment.INTEGRATION_RUNTIME_VERSION ?? "0.1.0",
    build: environment.INTEGRATION_RUNTIME_BUILD ?? "development",
  };
}

export function createRuntimeApiClient(
  config: RuntimeClientConfig,
  fetchImplementation: FetchImplementation = fetch,
) {
  async function request<T>(
    path: (typeof privatePaths)[keyof typeof privatePaths],
    parser: (value: unknown) => T | undefined,
    options: RuntimeRequestOptions,
  ): Promise<T> {
    if (!validCorrelation(options.correlationId)) {
      throw new RuntimeClientError(
        runtimeStatusError({
          kind: "CONFIGURATION_FAILURE",
          code: "CORRELATION_ID_INVALID",
          diagnostic: "Correlation ID failed validation",
          correlationId: "correlation-unavailable",
        }),
      );
    }
    const attempts = (options.retries ?? 0) + 1;
    let lastError: RuntimeClientError | undefined;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const onAbort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) controller.abort(options.signal.reason);
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, config.timeoutMs);
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = randomBytes(18).toString("base64url");
        const signature = createHmac("sha256", config.serviceSecret)
          .update(canonical("GET", path, timestamp, nonce))
          .digest("hex");
        const response = await fetchImplementation(`${config.baseUrl}${path}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "x-request-id": options.correlationId,
            "x-service-key-id": config.serviceKeyId,
            "x-service-timestamp": timestamp,
            "x-service-nonce": nonce,
            "x-service-signature": signature,
          },
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new RuntimeClientError(
            runtimeStatusError({
              kind: "INVALID_RESPONSE",
              code: "RUNTIME_RESPONSE_INVALID",
              diagnostic: "Runtime response was not valid JSON",
              correlationId: options.correlationId,
            }),
          );
        }
        const envelope = record(payload);
        const responseCorrelation =
          typeof envelope?.requestId === "string" &&
          validCorrelation(envelope.requestId)
            ? envelope.requestId
            : options.correlationId;
        if (!response.ok) {
          const error = record(envelope?.error);
          throw new RuntimeClientError(
            runtimeStatusError({
              code:
                typeof error?.code === "string"
                  ? error.code
                  : "RUNTIME_HTTP_ERROR",
              diagnostic:
                typeof error?.message === "string"
                  ? `Runtime returned ${response.status}: ${error.message}`
                  : `Runtime returned HTTP ${response.status}`,
              correlationId: responseCorrelation,
            }),
          );
        }
        const parsed = parser(envelope?.data);
        if (!parsed) {
          throw new RuntimeClientError(
            runtimeStatusError({
              kind: "INVALID_RESPONSE",
              code: "RUNTIME_RESPONSE_INVALID",
              diagnostic: "Runtime response failed contract validation",
              correlationId: responseCorrelation,
            }),
          );
        }
        return parsed;
      } catch (error) {
        lastError =
          error instanceof RuntimeClientError
            ? error
            : new RuntimeClientError(
                runtimeStatusError({
                  kind: timedOut
                    ? "TIMEOUT"
                    : options.signal?.aborted
                      ? "CANCELLED"
                      : "UNAVAILABLE",
                  code: timedOut
                    ? "RUNTIME_TIMEOUT"
                    : options.signal?.aborted
                      ? "RUNTIME_REQUEST_CANCELLED"
                      : "RUNTIME_UNAVAILABLE",
                  diagnostic:
                    error instanceof Error
                      ? error.message
                      : "Runtime network request failed",
                  correlationId: options.correlationId,
                }),
              );
        if (!lastError.detail.retryable || attempt + 1 >= attempts)
          throw lastError;
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError;
  }

  return {
    config: { version: config.version, build: config.build },
    health: (options: RuntimeRequestOptions) =>
      request(privatePaths.health, parseHealth, options),
    diagnostics: (options: RuntimeRequestOptions) =>
      request(privatePaths.diagnostics, parseDiagnostics, options),
  };
}

export type RuntimeApiClient = ReturnType<typeof createRuntimeApiClient>;
