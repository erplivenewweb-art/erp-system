"use client";

import { useCallback, useEffect, useState } from "react";
import type { RuntimeStatusResponse } from "./contracts";
import styles from "./RuntimeStatusBanner.module.css";

const endpoint = "/api/development/runtime-status";
const pollingIntervalMs = 15_000;

function validResponse(value: unknown): value is RuntimeStatusResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.ok === true
    ? Boolean(candidate.data && typeof candidate.data === "object")
    : candidate.ok === false &&
        Boolean(candidate.error && typeof candidate.error === "object");
}

export function RuntimeStatusBanner() {
  const [response, setResponse] = useState<RuntimeStatusResponse>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await fetch(endpoint, {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
      });
      const payload: unknown = await result.json();
      if (!validResponse(payload)) throw new Error("Invalid status response");
      setResponse(payload);
    } catch (error) {
      if (signal?.aborted) return;
      setResponse({
        ok: false,
        error: {
          kind: "UNAVAILABLE",
          code: "STOREFRONT_RUNTIME_CONNECTOR_UNAVAILABLE",
          userMessage: "The development runtime status is unavailable.",
          developerDiagnostic:
            error instanceof Error ? error.message : "Unknown connector error",
          correlationId: "correlation-unavailable",
          retryable: true,
        },
      });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void refresh(controller.signal), 0);
    const interval = window.setInterval(
      () => void refresh(controller.signal),
      pollingIntervalMs,
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      controller.abort();
    };
  }, [refresh]);

  const healthy = response?.ok === true && response.data.status === "HEALTHY";
  const state =
    loading && !response ? "loading" : healthy ? "healthy" : "error";
  const summary =
    loading && !response
      ? "Checking controlled runtime…"
      : response?.ok
        ? `${response.data.status.replaceAll("_", " ")} · Simulation mode · Execution disabled`
        : (response?.error.userMessage ?? "Runtime status unavailable");

  return (
    <aside
      aria-label="Development integration runtime status"
      className={styles.banner}
      data-testid="runtime-status-banner"
    >
      <span aria-hidden="true" className={styles.marker} data-state={state} />
      <div aria-live="polite" className={styles.summary} role="status">
        <strong>Development only</strong>
        <span>{summary}</span>
      </div>
      <button
        aria-label="Refresh development runtime status"
        className={styles.refresh}
        disabled={loading}
        onClick={() => void refresh()}
        type="button"
      >
        ↻
      </button>
      {response ? (
        <details className={styles.details}>
          <summary>Runtime details</summary>
          {response.ok ? (
            <dl>
              <div>
                <dt>Runtime</dt>
                <dd>{response.data.runtimeState}</dd>
              </div>
              <div>
                <dt>Workers</dt>
                <dd>DISABLED</dd>
              </div>
              <div>
                <dt>ERP connection</dt>
                <dd>DISABLED</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{response.data.version}</dd>
              </div>
              <div>
                <dt>Build</dt>
                <dd>{response.data.build}</dd>
              </div>
              <div>
                <dt>Persistence</dt>
                <dd>{response.data.persistence.status}</dd>
              </div>
              <div>
                <dt>Migrations</dt>
                <dd>{response.data.migrations.status}</dd>
              </div>
              <div>
                <dt>Correlation ID</dt>
                <dd>{response.data.correlationId}</dd>
              </div>
            </dl>
          ) : (
            <dl>
              <div>
                <dt>Error</dt>
                <dd>{response.error.code}</dd>
              </div>
              <div>
                <dt>Diagnostic</dt>
                <dd>{response.error.developerDiagnostic}</dd>
              </div>
              <div>
                <dt>Correlation ID</dt>
                <dd>{response.error.correlationId}</dd>
              </div>
            </dl>
          )}
        </details>
      ) : null}
    </aside>
  );
}
