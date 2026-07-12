// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { metadata } from "@/app/layout";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";
import RouteError from "@/app/error";

describe("Phase 3J production-readiness polish", () => {
  it("publishes global OpenGraph and Twitter-ready metadata without a production domain", () => {
    expect(metadata.openGraph).toMatchObject({ type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(JSON.stringify(metadata)).not.toMatch(/example\.com|https?:\/\//);
  });
  it("uses production-ready loading copy", () => {
    render(<Loading />);
    expect(screen.getByRole("heading", { name: "Preparing your Silver Sankha experience" })).toBeVisible();
    expect(screen.getByText("Please wait while this page is prepared.")).toBeVisible();
  });
  it("offers a clear 404 recovery link", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Return to homepage" })).toHaveAttribute("href", "/");
  });
  it("keeps the error recovery action keyboard-operable", () => {
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<RouteError error={new Error("Synthetic test error")} reset={reset} />);
    screen.getByRole("button", { name: "Try again" }).click();
    expect(reset).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
