import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import ShopPage from "@/app/shop/page";
import { ProductDetail } from "@/features/product";
import { products } from "@/features/catalog";
import { CartPage } from "@/features/cart";
import { CheckoutPage } from "@/features/checkout";
import { Dashboard } from "@/features/account";
import { ProfilePage } from "@/features/profile";
import { DealerDashboard, DealerLanding } from "@/features/dealer";
import { CMSDashboard, HomepageManager } from "@/features/cms";

describe("accessibility foundation", () => {
  it("has no automatic axe violations in the homepage content", async () => {
    const markup = renderToStaticMarkup(
      <main id="main-content"><HomePage /></main>,
    );
    const dom = new JSDOM(
      `<!doctype html><html lang="en"><head><title>Silver Sankha</title></head><body>${markup}</body></html>`,
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
    const markup = renderToStaticMarkup(<><PublicHeader /><main id="main-content"><HomePage /></main><PublicFooter /></>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Silver Sankha</title></head><body><a href="#main-content">Skip to main content</a>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Phase 3E catalogue accessibility", () => {
  it.each([
    ["shop", <ShopPage key="shop" />],
    ["product", <ProductDetail key="product" product={products[0]} />],
  ])("has no automatic axe violations in the %s screen", async (_name, content) => {
    const markup = renderToStaticMarkup(<main id="main-content">{content}</main>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Silver Sankha catalogue</title></head><body>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Phase 3F commerce accessibility", () => {
  it.each([
    ["cart", <CartPage key="cart" />],
    ["checkout", <CheckoutPage key="checkout" />],
  ])("has no automatic axe violations in the %s screen", async (_name, content) => {
    const markup = renderToStaticMarkup(<main id="main-content">{content}</main>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Static commerce preview</title></head><body>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Phase 3G account accessibility", () => {
  it.each([["dashboard", <Dashboard key="dashboard" />], ["profile", <ProfilePage key="profile" />]])("has no automatic axe violations in the %s screen", async (_name, content) => {
    const markup = renderToStaticMarkup(<main id="main-content">{content}</main>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Account preview</title></head><body>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Phase 3H dealer accessibility", () => {
  it.each([["landing", <DealerLanding key="dealer-landing" />], ["dashboard", <DealerDashboard key="dealer-dashboard" />]])("has no automatic axe violations in the %s screen", async (_name, content) => {
    const markup = renderToStaticMarkup(<main id="main-content">{content}</main>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Dealer preview</title></head><body>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Phase 3I CMS accessibility", () => {
  it.each([["dashboard", <CMSDashboard key="cms-dashboard" />], ["homepage", <HomepageManager key="cms-homepage" />]])("has no automatic axe violations in the %s screen", async (_name, content) => {
    const markup = renderToStaticMarkup(<main id="main-content">{content}</main>);
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>CMS preview</title></head><body>${markup}</body></html>`, { runScripts: "outside-only" });
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
