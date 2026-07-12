import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import ScaffoldPage from "@/app/page";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

describe("accessibility foundation", () => {
  it("has no automatic axe violations in the scaffold content", async () => {
    const markup = renderToStaticMarkup(
      <main id="main-content"><ScaffoldPage /></main>,
    );
    const dom = new JSDOM(
      `<!doctype html><html lang="en"><head><title>Storefront Scaffold</title></head><body>${markup}</body></html>`,
      { runScripts: "outside-only" },
    );
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

describe("public shell accessibility", () => {
  it("has no automatic axe violations in shell landmarks", async () => {
    const markup = renderToStaticMarkup(<><PublicHeader /><main id="main-content"><ScaffoldPage /></main><PublicFooter /></>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Silver Sankha</title></head><body><a href="#main-content">Skip to main content</a>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
