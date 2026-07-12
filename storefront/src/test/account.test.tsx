// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AccountPage, { metadata as accountMetadata } from "@/app/account/page";
import OrdersRoute from "@/app/account/orders/page";
import OrderDetailRoute from "@/app/account/orders/[slug]/page";
import AddressesRoute from "@/app/account/addresses/page";
import ProfileRoute from "@/app/account/profile/page";
import SecurityRoute from "@/app/account/security/page";
import NotificationsRoute from "@/app/account/notifications/page";
import { accountNavigation } from "@/features/account";

describe("Phase 3G static customer account", () => {
  it("renders a one-H1 dashboard with all required shortcuts", () => { const { container } = render(<AccountPage />); expect(container.querySelectorAll("h1")).toHaveLength(1); expect(screen.getByRole("heading", { name: "Profile summary" })).toBeVisible(); expect(screen.getByRole("heading", { name: "Recent order preview" })).toBeVisible(); expect(screen.getByRole("link", { name: "Open wishlist" })).toHaveAttribute("href", "/wishlist"); });
  it("provides complete semantic account navigation", () => { render(<AccountPage />); const nav = screen.getByRole("navigation", { name: "Account" }); for (const item of accountNavigation) expect(nav).toHaveTextContent(item.label); expect(screen.getByRole("button", { name: "Logout placeholder" })).toBeVisible(); });
  it("renders synthetic orders, status, tracking and invoice placeholders", () => { render(<OrdersRoute />); expect(screen.getByText("Preview status — not a live order")).toBeVisible(); expect(screen.getByRole("button", { name: "Track order placeholder" })).toBeVisible(); expect(screen.getByRole("button", { name: "Invoice unavailable" })).toBeVisible(); expect(screen.getByRole("status")).toHaveTextContent("No live orders"); });
  it("renders accessible order detail timeline without fabricated identifiers", async () => { const view = await OrderDetailRoute({ params: Promise.resolve({ slug: "sample-order" }) }); render(view); expect(screen.getByRole("list", { name: "Order timeline preview" })).toBeVisible(); expect(screen.getByText("Not generated")).toBeVisible(); expect(screen.getByText("No shipment or tracking exists")).toBeVisible(); });
  it("renders address card, add/edit/delete UI and empty state", () => { render(<AddressesRoute />); expect(screen.getByText("Default preview")).toBeVisible(); expect(screen.getByRole("button", { name: "Edit address UI" })).toBeVisible(); expect(screen.getByLabelText("Full name")).toBeVisible(); expect(screen.getByRole("status")).toHaveTextContent("No saved addresses"); });
  it("renders labelled profile fields and communication preferences", () => { render(<ProfileRoute />); expect(screen.getByLabelText("Display name")).toBeVisible(); expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email"); expect(screen.getByRole("button", { name: "Save profile preview" })).toHaveAttribute("type", "button"); });
  it("renders security placeholders without authentication behavior", () => { render(<SecurityRoute />); expect(screen.getByLabelText("Current password placeholder")).toHaveAttribute("type", "password"); expect(screen.getByText("No secret, QR code, OTP or recovery code is generated.")).toBeVisible(); expect(screen.getByText("No live devices or sessions exist.")).toBeVisible(); });
  it("renders notification list, unread badge, settings and empty state", () => { render(<NotificationsRoute />); expect(screen.getByText("Unread preview")).toBeVisible(); expect(screen.getByRole("button", { name: "Save preferences preview" })).toBeVisible(); expect(screen.getByRole("status")).toHaveTextContent("No notifications"); });
  it("keeps account metadata private and canonical relative", () => { expect(accountMetadata.robots).toEqual({ index: false, follow: false }); expect(accountMetadata.alternates).toEqual({ canonical: "/account" }); expect(JSON.stringify(accountMetadata)).not.toContain("https://"); });
});
