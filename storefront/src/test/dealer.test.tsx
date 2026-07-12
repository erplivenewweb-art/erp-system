// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WholesalePage, { metadata as wholesaleMetadata } from "@/app/wholesale/page";
import RegistrationPage from "@/app/dealer/register/page";
import LoginPage from "@/app/dealer/login/page";
import DashboardPage, { metadata as dashboardMetadata } from "@/app/dealer/page";
import QuotationsPage from "@/app/dealer/quotations/page";
import BulkPage from "@/app/dealer/bulk-order/page";
import CataloguePage from "@/app/dealer/catalogue/page";
import KycPage from "@/app/dealer/kyc/page";
import SupportPage from "@/app/dealer/support/page";
import { dealerNavigation, wholesaleFaq, wholesaleProducts } from "@/features/b2b";

describe("Phase 3H static dealer portal",()=>{
  it("renders public dealer landing benefits, process, CTAs and FAQ",()=>{const{container}=render(<WholesalePage/>);expect(container.querySelectorAll("h1")).toHaveLength(1);expect(screen.getByRole("link",{name:"Become a dealer"})).toHaveAttribute("href","/dealer/register");expect(screen.getByRole("button",{name:"Download catalogue placeholder"})).toBeVisible();for(const[item]of wholesaleFaq)expect(screen.getByText(item)).toBeVisible();});
  it("renders labelled registration fields without submission",()=>{render(<RegistrationPage/>);for(const label of["Company name","Contact person","Phone","Email","City","GST placeholder","Business type","Business category","State","Country"])expect(screen.getByLabelText(label)).toBeVisible();expect(screen.getByRole("button",{name:"Submit application preview"})).toHaveAttribute("type","button");});
  it("renders login shell without authentication",()=>{render(<LoginPage/>);expect(screen.getByLabelText("Email")).toHaveAttribute("type","email");expect(screen.getByLabelText("Password")).toHaveAttribute("type","password");expect(screen.getByRole("button",{name:"Login preview"})).toHaveAttribute("type","button");});
  it("renders complete dealer navigation and dashboard placeholders",()=>{render(<DashboardPage/>);const nav=screen.getByRole("navigation",{name:"Dealer portal"});for(const[,label]of dealerNavigation)expect(nav).toHaveTextContent(label);expect(screen.getByText("Verification not connected")).toBeVisible();expect(screen.getByText("No live quotations")).toBeVisible();});
  it("renders quotation list, empty state and request form",()=>{render(<QuotationsPage/>);expect(screen.getByText("Draft placeholder")).toBeVisible();expect(screen.getByRole("status")).toHaveTextContent("No live quotations");expect(screen.getByLabelText("Bulk enquiry")).toBeVisible();});
  it("renders accessible bulk-order table with quantity controls",()=>{render(<BulkPage/>);expect(screen.getByRole("region",{name:"Bulk order table"})).toBeVisible();expect(screen.getByRole("table",{name:"Static bulk-order quantity preview"})).toBeVisible();expect(screen.getAllByRole("textbox")).toHaveLength(wholesaleProducts.length);});
  it("exposes no numeric wholesale price or discount",()=>{const html=renderToStaticMarkup(<CataloguePage/>);expect(html).not.toMatch(/(?:₹|INR)\s*\d|\d+%\s*(?:off|discount)/i);expect(html).toContain("Wholesale price available only through an approved future quotation.");});
  it("renders disabled KYC upload placeholders",()=>{render(<KycPage/>);expect(screen.getAllByRole("button",{name:"Upload unavailable"})).toHaveLength(4);expect(screen.getByLabelText("GST document placeholder")).toBeDisabled();});
  it("renders dealer support FAQ and placeholder channels",()=>{render(<SupportPage/>);expect(screen.getByRole("heading",{name:"Wholesale support"})).toBeVisible();expect(screen.getByText("What is the MOQ?")).toBeVisible();expect(screen.getByText("Not assigned")).toBeVisible();});
  it("indexes only the public landing strategy",()=>{expect(wholesaleMetadata.robots).toEqual({index:true,follow:true});expect(wholesaleMetadata.alternates).toEqual({canonical:"/wholesale"});expect(dashboardMetadata.robots).toEqual({index:false,follow:false});expect(JSON.stringify([wholesaleMetadata,dashboardMetadata])).not.toContain("example.com");});
});
