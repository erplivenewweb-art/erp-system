import { randomUUID } from "node:crypto";
import type { RuntimeStatusResponse } from "@/features/integration-runtime";
import {
  RuntimeClientError,
  runtimeStatusError,
} from "@/features/integration-runtime/error-mapping";
import { readRuntimeSimulationStatus } from "@/server/integration-runtime/connector";
import {
  createRuntimeApiClient,
  loadRuntimeClientConfig,
} from "@/server/integration-runtime/runtime-client";

export const dynamic = "force-dynamic";

const correlation = (request: Request): string => {
  const supplied = request.headers.get("x-correlation-id");
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
};

const json = (
  body: RuntimeStatusResponse,
  status: number,
  correlationId: string,
) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-correlation-id": correlationId,
      "x-content-type-options": "nosniff",
    },
  });

export async function GET(request: Request): Promise<Response> {
  const correlationId = correlation(request);
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.STOREFRONT_RUNTIME_STATUS_ENABLED !== "true"
  ) {
    return json(
      {
        ok: false,
        error: runtimeStatusError({
          kind: "FEATURE_DISABLED",
          code: "RUNTIME_STATUS_DISABLED",
          diagnostic: "Development runtime status connector is disabled",
          correlationId,
        }),
      },
      404,
      correlationId,
    );
  }
  try {
    const client = createRuntimeApiClient(loadRuntimeClientConfig());
    const data = await readRuntimeSimulationStatus(client, {
      correlationId,
      signal: request.signal,
    });
    return json({ ok: true, data }, 200, correlationId);
  } catch (error) {
    const mapped =
      error instanceof RuntimeClientError
        ? error.detail
        : runtimeStatusError({
            kind: "INVALID_RESPONSE",
            code: "RUNTIME_STATUS_VALIDATION_FAILED",
            diagnostic:
              error instanceof Error
                ? error.message
                : "Unknown runtime connector failure",
            correlationId,
          });
    const status = mapped.kind === "TIMEOUT" ? 504 : 503;
    return json({ ok: false, error: mapped }, status, mapped.correlationId);
  }
}
