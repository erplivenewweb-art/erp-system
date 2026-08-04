import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RuntimeDiagnostics,
  RuntimeHealth,
} from "@/features/integration-runtime/contracts";
import { RuntimeClientError } from "@/features/integration-runtime/error-mapping";
import { GET } from "@/app/api/development/runtime-status/route";
import { readRuntimeSimulationStatus } from "@/server/integration-runtime/connector";
import {
  createRuntimeApiClient,
  loadRuntimeClientConfig,
  type RuntimeClientConfig,
} from "@/server/integration-runtime/runtime-client";

const disabledFlags = {
  productionPersistence: false,
  liveErpRead: false,
  erpWriteExecutor: false,
  billingExecutor: false,
  outboxWorker: false,
  reconciliationWorker: false,
  leaseRecoveryWorker: false,
  retryWorker: false,
  deadLetterWorker: false,
};

const health: RuntimeHealth = {
  runtimeState: "EXECUTION_DISABLED",
  simulationReady: true,
  executionReady: false,
  executionState: "EXECUTION_DISABLED",
  featureFlags: disabledFlags,
  persistence: {
    component: "PERSISTENCE",
    status: "READY",
    detail: "Stateless simulation",
  },
  migrations: {
    component: "MIGRATIONS",
    status: "READY",
    detail: "Not required",
  },
  workers: [
    { workerId: "outbox", state: "DISABLED", businessHandlerExecutions: 0 },
  ],
};

const diagnostics: RuntimeDiagnostics = {
  runtimeState: "EXECUTION_DISABLED",
  mode: "DEVELOPMENT_REFUSAL_RUNTIME",
  executionReady: false,
  executionPolicy: "DENY_ALL",
  flags: disabledFlags,
  dependencies: [health.persistence, health.migrations],
  workers: health.workers,
};

const config: RuntimeClientConfig = {
  baseUrl: "http://127.0.0.1:4200",
  serviceKeyId: "commerce-api-v1",
  serviceSecret: "runtime-development-secret-value-123",
  timeoutMs: 100,
  version: "0.1.0",
  build: "test-build",
};

const envelope = (data: unknown, requestId = "runtime-correlation-1234") =>
  new Response(JSON.stringify({ data, requestId }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server-only runtime client and connector", () => {
  it("signs typed requests, propagates correlation and maps simulation status", async () => {
    const requestHeaders: Headers[] = [];
    const runtimeFetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        requestHeaders.push(new Headers(init?.headers));
        return String(input).endsWith("/health")
          ? envelope(health)
          : envelope(diagnostics);
      },
    );
    const result = await readRuntimeSimulationStatus(
      createRuntimeApiClient(config, runtimeFetch as typeof fetch),
      { correlationId: "runtime-correlation-1234" },
    );

    expect(result).toMatchObject({
      status: "HEALTHY",
      mode: "SIMULATION",
      executionReady: false,
      workersEnabled: false,
      erpConnectionEnabled: false,
      correlationId: "runtime-correlation-1234",
    });
    expect(requestHeaders).toHaveLength(2);
    for (const headers of requestHeaders) {
      expect(headers.get("x-request-id")).toBe("runtime-correlation-1234");
      expect(headers.get("x-service-key-id")).toBe("commerce-api-v1");
      expect(headers.get("x-service-signature")).toMatch(/^[a-f0-9]{64}$/);
      expect(headers.get("x-service-nonce")).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    }
  });

  it("does not retry by default and maps invalid responses", async () => {
    const runtimeFetch = vi.fn(async () => envelope({ invalid: true }));
    const client = createRuntimeApiClient(config, runtimeFetch as typeof fetch);
    await expect(
      client.health({ correlationId: "runtime-correlation-1234" }),
    ).rejects.toMatchObject({
      detail: {
        kind: "INVALID_RESPONSE",
        correlationId: "runtime-correlation-1234",
      },
    });
    expect(runtimeFetch).toHaveBeenCalledOnce();
  });

  it("supports timeout and cancellation with safe diagnostics", async () => {
    const never = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const client = createRuntimeApiClient(
      { ...config, timeoutMs: 100 },
      never as typeof fetch,
    );
    await expect(
      client.health({ correlationId: "runtime-correlation-1234" }),
    ).rejects.toMatchObject({ detail: { kind: "TIMEOUT", retryable: true } });

    const controller = new AbortController();
    controller.abort();
    await expect(
      client.health({
        correlationId: "runtime-correlation-1234",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ detail: { kind: "CANCELLED" } });
  });

  it("rejects production, remote origins and unsafe configuration", () => {
    expect(() =>
      loadRuntimeClientConfig({
        NODE_ENV: "production",
        INTEGRATION_RUNTIME_SERVICE_SECRET: "x".repeat(32),
      }),
    ).toThrow(/disabled in production/);
    expect(() =>
      loadRuntimeClientConfig({
        NODE_ENV: "development",
        INTEGRATION_RUNTIME_BASE_URL: "https://runtime.example.test",
        INTEGRATION_RUNTIME_SERVICE_SECRET: "x".repeat(32),
      }),
    ).toThrow(/loopback/);
    expect(() =>
      loadRuntimeClientConfig({
        NODE_ENV: "development",
        INTEGRATION_RUNTIME_SERVICE_SECRET: "weak",
      }),
    ).toThrow(/credential/);
  });

  it("maps HTTP errors without leaking service credentials", async () => {
    const runtimeFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "RUNTIME_DEPENDENCY_NOT_READY",
              message: "Dependency not ready",
            },
            requestId: "runtime-correlation-1234",
          }),
          { status: 503 },
        ),
    );
    const client = createRuntimeApiClient(config, runtimeFetch as typeof fetch);
    try {
      await client.health({ correlationId: "runtime-correlation-1234" });
      throw new Error("Expected runtime client failure");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeClientError);
      expect((error as RuntimeClientError).detail).toMatchObject({
        kind: "DEPENDENCY_FAILURE",
        correlationId: "runtime-correlation-1234",
      });
      expect(JSON.stringify(error)).not.toContain(config.serviceSecret);
    }
  });
});

describe("development storefront connector route", () => {
  it("returns a typed same-origin simulation response", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STOREFRONT_RUNTIME_STATUS_ENABLED", "true");
    vi.stubEnv("INTEGRATION_RUNTIME_SERVICE_SECRET", config.serviceSecret);
    vi.stubEnv("INTEGRATION_RUNTIME_BUILD", "route-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith("/health")
          ? envelope(health, "route-correlation-1234")
          : envelope(diagnostics, "route-correlation-1234"),
      ),
    );
    const response = await GET(
      new Request("http://storefront.local/api/development/runtime-status", {
        headers: { "x-correlation-id": "route-correlation-1234" },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        status: "HEALTHY",
        build: "route-test",
        correlationId: "route-correlation-1234",
      },
    });
  });

  it("fails closed when the development feature is disabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STOREFRONT_RUNTIME_STATUS_ENABLED", "true");
    const response = await GET(
      new Request("http://storefront.local/api/development/runtime-status"),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { kind: "FEATURE_DISABLED", code: "RUNTIME_STATUS_DISABLED" },
    });
  });
});
