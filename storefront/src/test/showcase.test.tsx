// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import DesignSystemPage, { metadata } from "@/app/design-system/page";

describe("design-system showcase", () => {
  it("is noindex and renders synthetic component groups", () => {
    render(<DesignSystemPage />);
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(screen.getByRole("heading", { name: "Quiet craft. Clear interaction." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Commerce shells" })).toBeVisible();
    expect(screen.getByText("Synthetic Silver Form")).toBeVisible();
  });

  it("previews dark token readiness locally", async () => {
    const user = userEvent.setup();
    const { container } = render(<DesignSystemPage />);
    await user.click(screen.getByRole("switch", { name: "Dark readiness preview" }));
    expect(container.querySelector('[data-theme="dark"]')).toBeInTheDocument();
  });

  it("has no automatic axe violations in component foundations", async () => {
    document.documentElement.lang = "en";
    document.title = "Design System";
    render(<main><DesignSystemPage /></main>);
    const results = await axe.run(document, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
