"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StockCostError,
  normalizeRole,
  canonicalAuthorityInput,
  ensureStockCostBasisSchema,
  projectFutureWebsiteSaleCost,
} = require("../js/backend/stockCostAuthority");

const base = {
  stockId: 20,
  totalCompanyCost: "125.50",
  currency: "inr",
  reason: "Legacy acquisition voucher ACQ-1",
  sourceReference: "ACQ-1",
  idempotencyKey: "cost-provision-20-1",
};

test("A10A canonical authority is deterministic, exact-money, and never uses website selling price", () => {
  const a = canonicalAuthorityInput(base, {
    companyId: 7,
    barcode: "BC-20",
    version: 1,
  });
  const b = canonicalAuthorityInput(base, {
    companyId: 7,
    barcode: "BC-20",
    version: 1,
  });
  assert.equal(a.currency, "INR");
  assert.equal(a.totalCompanyCost, "125.50");
  assert.equal(a.evidenceDigest, b.evidenceDigest);
  assert.throws(
    () =>
      canonicalAuthorityInput(
        { ...base, totalCompanyCost: "10", materialCost: "6", makingCost: "3" },
        { companyId: 7, barcode: "BC-20", version: 1 },
      ),
    { code: "COST_COMPONENT_TOTAL_MISMATCH" },
  );
  assert.throws(
    () =>
      canonicalAuthorityInput(
        { ...base, currency: "rupees" },
        { companyId: 7, barcode: "BC-20", version: 1 },
      ),
    { code: "COST_CURRENCY_INVALID" },
  );
  assert.equal("websiteSellingPrice" in a, false);
});

test("A10A component and legacy authority rules fail closed", () => {
  const component = canonicalAuthorityInput(
    {
      ...base,
      totalCompanyCost: "13.00",
      materialCost: "10",
      makingCost: "3",
      authorityType: "COMPONENT_BACKED_DIRECT_COST",
    },
    { companyId: 7, barcode: "BC-20", version: 2, supersedesId: 1 },
  );
  assert.equal(component.components.materialCost, "10.00");
  assert.equal(component.supersedesId, 1);
  assert.throws(
    () =>
      canonicalAuthorityInput(
        { ...base, totalCompanyCost: null },
        { companyId: 7, barcode: "BC-20", version: 1 },
      ),
    { code: "COST_AMOUNT_INVALID" },
  );
  assert.throws(
    () =>
      canonicalAuthorityInput(
        {
          ...base,
          totalCompanyCost: "10",
          authorityType: "COMPONENT_BACKED_DIRECT_COST",
        },
        { companyId: 7, barcode: "BC-20", version: 1 },
      ),
    { code: "COST_COMPONENTS_REQUIRED" },
  );
});

test("A10A role policy permits only private company-scoped OWNER/Admin authority", () => {
  assert.deepEqual(normalizeRole({ id: 9, companyId: 7, role: "owner" }), {
    id: 9,
    companyId: 7,
    role: "OWNER",
  });
  assert.equal(
    normalizeRole({ id: 10, companyId: 7, role: "ADMIN" }).role,
    "ADMIN",
  );
  assert.throws(() => normalizeRole({ id: 1, companyId: 7, role: "STAFF" }), {
    code: "COST_AUTHORIZATION_DENIED",
  });
  assert.throws(
    () => normalizeRole({ id: 1, companyId: 7, role: "SUPERADMIN" }),
    { code: "COST_SUPERADMIN_MUTATION_DENIED" },
  );
});

test("A10A future sale snapshot is pure and freezes resolved cost facts", () => {
  const first = projectFutureWebsiteSaleCost({
    id: 1,
    status: "ACTIVE",
    totalCompanyCost: "125.50",
    evidenceDigest: "a".repeat(64),
  });
  const later = projectFutureWebsiteSaleCost({
    id: 2,
    status: "ACTIVE",
    totalCompanyCost: "130.00",
    evidenceDigest: "b".repeat(64),
  });
  assert.deepEqual(first, {
    companyLineAmount: "125.50",
    companyTotalAmount: "125.50",
    costEvidenceDigest: "a".repeat(64),
    costBasisId: 1,
  });
  assert.equal(later.companyLineAmount, "130.00");
  assert.equal(first.companyLineAmount, "125.50");
  assert.throws(() => projectFutureWebsiteSaleCost({ status: "SUPERSEDED" }), {
    code: "COST_BASIS_REQUIRED",
  });
});

test("A10A schema has durable audit, idempotency, and one-active-cost invariants", async () => {
  const sql = [];
  await ensureStockCostBasisSchema({
    query: async (statement) => {
      sql.push(statement);
    },
  });
  const ddl = sql.join("\n");
  for (const column of [
    "company_id",
    "stock_id",
    "barcode",
    "total_company_cost",
    "idempotency_key",
    "evidence_digest",
    "status",
    "supersedes_id",
    "created_by",
  ])
    assert.match(ddl, new RegExp(column));
  assert.match(ddl, /uq_stock_cost_basis_active/);
  assert.match(ddl, /uq_stock_cost_basis_request/);
  assert.match(ddl, /uq_stock_cost_basis_version/);
  assert.match(ddl, /active_stock_key/);
});

test("A10A runtime module contains no sale, invoice, payment, or stock-sold mutation capability", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/backend/stockCostAuthority.js"),
    "utf8",
  );
  for (const prohibited of [
    "sales_history",
    "sales_items",
    "transaction_master",
    "cash_ledger",
    "generateInvoice",
    "payment allocation",
    "SOLD",
  ])
    assert.equal(source.includes(prohibited), false, prohibited);
  assert.equal(source.includes("INSERT INTO stock_cost_bases"), true);
  assert.equal(
    source.includes("UPDATE stock_cost_bases SET status='SUPERSEDED'"),
    true,
  );
  assert.equal(
    source.includes("SELECT id, company_id, barcode FROM stock"),
    true,
  );
});

test("A10A errors expose required private authorization and missing-cost outcomes", () => {
  const error = new StockCostError("COST_BASIS_REQUIRED", "required");
  assert.equal(error.code, "COST_BASIS_REQUIRED");
});
