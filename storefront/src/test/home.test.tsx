// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page, { metadata } from "@/app/page";
import { metadata as designSystemMetadata } from "@/app/design-system/page";
import { homeContent } from "@/features/home";

describe("Phase 3D static homepage", () => {
  it("renders exactly one H1 and every required editorial region", () => {
    const { container } = render(<Page />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: homeContent.hero.title })).toBeVisible();
    for (const heading of [homeContent.collections.title, homeContent.products.title, homeContent.manufacturing.title, homeContent.workshop.title, homeContent.purity.title, homeContent.custom.title, homeContent.wholesale.title, homeContent.packaging.title, homeContent.reviews.title, homeContent.social.title, homeContent.journal.title, homeContent.faq.title]) expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  });

  it("provides accessible retail and wholesale calls to action", () => {
    render(<Page />);
    expect(screen.getByRole("link", { name: homeContent.hero.primary.label })).toHaveAttribute("href", "/collections");
    expect(screen.getByRole("link", { name: homeContent.hero.secondary.label })).toHaveAttribute("href", "/wholesale");
    expect(screen.getByRole("link", { name: homeContent.wholesale.action.label })).toHaveAttribute("href", "/wholesale");
  });

  it("exposes no price amounts or wholesale price values", () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).not.toMatch(/₹\s*\d/);
    expect(html).not.toMatch(/INR\s*\d/);
    expect(html).toContain("No live retail price, wholesale price or stock is shown.");
  });

  it("labels synthetic products and review placeholders honestly", () => {
    render(<Page />);
    expect(screen.getByText("Synthetic homepage product shells. No live retail price, wholesale price or stock is shown.")).toBeVisible();
    expect(screen.getAllByText("Synthetic placeholder — not a verified review")).toHaveLength(homeContent.reviews.items.length);
  });

  it("opens FAQ answers through native keyboard-compatible disclosure semantics", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const question = screen.getByText(homeContent.faq.items[0].question);
    expect(question.closest("summary")).toBeInTheDocument();
    await user.click(question);
    expect(screen.getByText(homeContent.faq.items[0].answer)).toBeVisible();
  });

  it("publishes indexable homepage metadata without inventing a domain", () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({ type: "website" });
    expect(designSystemMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toContain("example.com");
  });
});
