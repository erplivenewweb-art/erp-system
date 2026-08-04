// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import {
  primaryNavigation,
  secondaryNavigation,
} from "@/config/public-navigation";
import { defaultCMSContent } from "@/features/cms";

describe("Phase 3C public shell", () => {
  it("renders CMS-ready desktop navigation and storefront actions", () => {
    render(<PublicHeader />);
    expect(
      screen.getByRole("link", { name: "Silver Sankha home" }),
    ).toHaveAttribute("href", "/");
    const primary = screen.getByRole("navigation", { name: "Primary" });
    for (const item of primaryNavigation)
      expect(primary).toHaveTextContent(item.label);
    expect(within(primary).getByText("Explore Collections")).toHaveAttribute(
      "href",
      "/collections",
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/products#catalogue-search",
    );
    expect(
      screen.getByRole("button", {
        name: "Open simulated cart, 0 items",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Wishlist, 0 saved" }),
    ).toHaveAttribute("href", "/wishlist");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("opens the mobile drawer, traps focus, closes on cancel, and restores focus", async () => {
    const user = userEvent.setup();
    render(<PublicHeader />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    const drawer = screen.getByRole("dialog", {
      name: "Explore Silver Sankha",
    });
    expect(drawer).toHaveAttribute("open");
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(within(drawer).getByRole("link", { name: /Cart/ })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(close).toHaveFocus();
    fireEvent(drawer, new Event("cancel", { cancelable: true }));
    expect(drawer).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("provides every secondary destination in mobile navigation", async () => {
    const user = userEvent.setup();
    render(<PublicHeader />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    for (const item of secondaryNavigation)
      expect(mobile).toHaveTextContent(item.label);
  });

  it("renders footer ownership, newsletter, care, wholesale, policies and social links", () => {
    render(<PublicFooter />);
    expect(
      screen.getByRole("heading", { name: "Craft notes and collection news" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByRole("button", { name: "Subscribe" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(
      screen.getByRole("navigation", { name: "Customer care" }),
    ).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Wholesale" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Policies" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Instagram" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Contact Silver Sankha on WhatsApp" }),
    ).toBeVisible();
    expect(
      screen.getByText(defaultCMSContent.marketing.footer.developmentNotice),
    ).toBeVisible();
  });
});
