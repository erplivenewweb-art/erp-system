// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeStatusBanner } from "@/features/integration-runtime";

afterEach(() => vi.restoreAllMocks());

describe("development runtime status banner", () => {
  it("renders accessible simulation status and details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "HEALTHY",
            mode: "SIMULATION",
            runtimeState: "EXECUTION_DISABLED",
            executionReady: false,
            executionState: "EXECUTION_DISABLED",
            workersEnabled: false,
            erpConnectionEnabled: false,
            featureFlags: {},
            persistence: {
              component: "PERSISTENCE",
              status: "READY",
              detail: "Stateless",
            },
            migrations: {
              component: "MIGRATIONS",
              status: "READY",
              detail: "Not required",
            },
            version: "0.1.0",
            build: "development",
            correlationId: "runtime-ui-correlation",
            checkedAt: "2026-07-26T00:00:00.000Z",
          },
        }),
      ),
    );

    render(<RuntimeStatusBanner />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "HEALTHY · Simulation mode · Execution disabled",
      ),
    );
    expect(
      screen.getByRole("complementary", {
        name: "Development integration runtime status",
      }),
    ).toBeVisible();
    await userEvent.click(screen.getByText("Runtime details"));
    expect(screen.getByText("runtime-ui-correlation")).toBeVisible();
    expect(screen.getAllByText("DISABLED").length).toBeGreaterThanOrEqual(2);
  });

  it("maps connector failure and supports explicit refresh", async () => {
    const runtimeFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            kind: "UNAVAILABLE",
            code: "RUNTIME_UNAVAILABLE",
            userMessage: "The development runtime is unavailable.",
            developerDiagnostic: "Connection refused",
            correlationId: "runtime-error-correlation",
            retryable: true,
          },
        }),
        { status: 503 },
      ),
    );
    render(<RuntimeStatusBanner />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "The development runtime is unavailable.",
      ),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Refresh development runtime status",
      }),
    );
    await waitFor(() => expect(runtimeFetch).toHaveBeenCalledTimes(2));
  });
});
