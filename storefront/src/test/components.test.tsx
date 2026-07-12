// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProductCardShell, QuantitySelector, WishlistButton } from "@/components/commerce";
import { PriceBlock, StatusChip } from "@/components/display";
import { Alert, EmptyState } from "@/components/feedback";
import { Field, HelpText, Input, Label, ValidationMessage } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Accordion, Tabs } from "@/components/navigation";
import { Modal, Toast } from "@/components/overlays";
import { Button, IconButton, LinkButton } from "@/components/ui";

describe("shared UI foundations", () => {
  it("renders action states and safe external links", () => {
    render(<><Button loading>Save</Button><Button disabled>Disabled</Button><LinkButton external href="https://example.invalid">External</LinkButton><IconButton label="Favorite"><Icon name="heart" /></IconButton></>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Favorite" })).toBeVisible();
  });

  it("associates form labels, help and errors", () => {
    render(<Field><Label htmlFor="email">Email</Label><Input aria-describedby="email-help email-error" id="email" invalid /><HelpText id="email-help">Use a synthetic address.</HelpText><ValidationMessage id="email-error">Email is required.</ValidationMessage></Field>);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use a synthetic address. Email is required.");
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");
  });

  it("supports tabs with arrow-key focus and selection", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Samples" items={[{ id: "one", label: "One", panel: "Panel one" }, { id: "two", label: "Two", panel: "Panel two" }]} />);
    const first = screen.getByRole("tab", { name: "One" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");
  });

  it("uses native accessible accordion semantics", () => {
    render(<Accordion items={[{ id: "one", title: "Details", content: "Synthetic details" }]} />);
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText("Synthetic details")).toBeVisible();
  });

  it("increments and constrains quantity", async () => {
    const user = userEvent.setup();
    render(<QuantitySelector initial={1} max={2} />);
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("toggles wishlist selected state without persistence", async () => {
    const user = userEvent.setup();
    render(<WishlistButton />);
    const button = screen.getByRole("button", { name: "Save item" });
    await user.click(button);
    expect(screen.getByRole("button", { name: "Remove saved item" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens modal, focuses close, and restores trigger focus", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><Button onClick={() => setOpen(true)}>Open details</Button><Modal onClose={() => setOpen(false)} open={open} title="Details">Synthetic content</Modal></>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open details" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Close Details" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close Details" }));
    expect(trigger).toHaveFocus();
  });

  it("renders display, feedback, and commerce shells", () => {
    render(<><StatusChip status="success">Ready</StatusChip><PriceBlock amount="0.00" /><Alert title="Notice">Synthetic message</Alert><EmptyState actionHref="/" actionLabel="Return" description="No items." title="Empty" /><ProductCardShell name="Synthetic product" /><Toast>Saved</Toast></>);
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.getByText("Synthetic product")).toBeVisible();
    expect(screen.getByText("Saved").closest('[role="status"]')).toBeInTheDocument();
  });

  it("keeps error retry explicit", async () => {
    const retry = vi.fn();
    render(<Button onClick={retry}>Try again</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
