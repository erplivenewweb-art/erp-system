"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  calculateReturnRefundAllocation,
  getInitialRefundPayableStatus
} = require("../js/backend/returnPolicy");

const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
const returnSource = fs.readFileSync(path.join(__dirname, "../return.html"), "utf8");

function sourceSection(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startText}`);
  return source.slice(start, end);
}

test("legacy SOLD row with IN_STOCK stock_state is eligible for verified return flow", () => {
  const preview = sourceSection(serverSource, "async function buildReturnPreview", "async function previewSalesBranchBackfill");
  assert.match(preview, /isLegacySoldStockState\s*=\s*currentStatus\s*===\s*"SOLD"\s*&&\s*rawStockState\s*===\s*"IN_STOCK"/);
  assert.match(preview, /!isLegacySoldStockState[\s\S]*Stock state is not a valid sold state/);
  assert.match(preview, /!isLegacySoldStockState[\s\S]*Stock state is deleted, damaged, already returned, or available/);
  assert.match(preview, /Legacy sold stock state detected/);
});

test("Return Preview link hydrates and fetches its barcode", () => {
  assert.match(returnSource, /new URLSearchParams\(window\.location\.search\)\.get\("barcode"\)/);
  assert.match(returnSource, /returnBarcode"\)\.value\s*=\s*barcodeFromLink/);
  assert.match(returnSource, /await fetchBarcodeDetails\(\)/);
});

test("return-to-stock updates the existing stock row instead of inserting a duplicate", () => {
  const route = sourceSection(serverSource, 'app.post("/saveReturn"', 'app.get("/getReturns"');
  assert.match(route, /UPDATE stock[\s\S]*SET status = 'IN_STOCK'/);
  assert.match(route, /WHERE id = \? AND company_id = \?/);
  assert.doesNotMatch(route, /INSERT INTO stock/i);
  assert.match(route, /beginTransaction\(\)/);
  assert.match(route, /await connection\.commit\(\)/);
  assert.match(route, /await connection\.rollback\(\)/);
});

test("unpaid sale remains on the simple atomic return path", () => {
  const preview = sourceSection(serverSource, "async function buildReturnPreview", "async function previewSalesBranchBackfill");
  const route = sourceSection(serverSource, 'app.post("/saveReturn"', 'app.get("/getReturns"');
  assert.match(preview, /canReturn:\s*uniqueBlockingReasons\.length === 0/);
  assert.match(route, /buildReturnPreview[\s\S]*forUpdate:\s*true/);
  assert.match(route, /postReturnToTransactionFoundation/);
  assert.match(route, /UPDATE stock[\s\S]*UPDATE sales_items[\s\S]*connection\.commit/);
});

test("partial payment return consumes remaining due before creating a cash refund", () => {
  const result = calculateReturnRefundAllocation({
    returnAmount: 2000,
    invoiceTotal: 10000,
    dueAmount: 5000,
    cashSettledAmount: 5000,
    hasCashSettlement: true
  });
  assert.equal(result.refundModeHint, "CASH");
  assert.equal(result.estimatedRefundCashAmount, 0);
  assert.equal(getInitialRefundPayableStatus(result.estimatedRefundCashAmount, 0), "SETTLED");
});

test("fully paid return creates only the return value as refund payable", () => {
  const result = calculateReturnRefundAllocation({
    returnAmount: 2000,
    invoiceTotal: 10000,
    dueAmount: 0,
    cashSettledAmount: 10000,
    hasCashSettlement: true
  });
  assert.equal(result.estimatedRefundCashAmount, 2000);
  assert.equal(getInitialRefundPayableStatus(result.estimatedRefundCashAmount, 0), "OPEN");
});

test("Add Payment paid sale is routed by the primary Return action to the refund workflow", () => {
  const settlement = sourceSection(serverSource, "async function buildReturnSettlementSummary", "function buildReturnRefundEstimate");
  const saveAction = sourceSection(returnSource, "async function saveReturnEntry", "async function createRefundPayableEntry");
  assert.match(settlement, /paidAmount > 0/);
  assert.match(settlement, /linkedPaymentReceived\.length > 0/);
  assert.match(settlement, /isSettlementBlocked:\s*detailedBlockingReasons\.length > 0/);
  assert.match(saveAction, /canCreateRefundPayable[\s\S]*return createRefundPayableEntry\(\)/);
});

test("paid return posts an auditable return credit and later refund uses a debit", () => {
  const payablePosting = sourceSection(serverSource, "async function postReturnRefundPayableToTransactionFoundation", "async function getReturnSummaryRows");
  const cashRefundRoute = sourceSection(serverSource, 'app.post("/returns/refund-payables/:id/cash-refund"', 'app.post("/returns/refund-payables/:id/metal-refund"');
  assert.match(payablePosting, /transaction_type[\s\S]*RETURN_REFUND_PAYABLE/);
  assert.match(payablePosting, /entryType:\s*"CREDIT"[\s\S]*creditAmount:\s*returnValue/);
  assert.match(payablePosting, /recalcPartyBalanceSummary/);
  assert.match(cashRefundRoute, /transaction_type[\s\S]*CASH_REFUND_PAID/);
  assert.match(cashRefundRoute, /entryType:\s*"DEBIT"[\s\S]*debitAmount:\s*amount/);
});

test("paid return is atomic and protects company, branch, invalid stock, and duplicate return", () => {
  const preview = sourceSection(serverSource, "async function buildReturnPreview", "async function previewSalesBranchBackfill");
  const route = sourceSection(serverSource, 'app.post("/returns/create-refund-payable"', 'app.post("/returns/refund-payables/:id/cash-refund"');
  assert.match(preview, /Stock belongs to another company/);
  assert.match(preview, /Stock belongs to another branch/);
  assert.match(preview, /Stock must be SOLD before return/);
  assert.match(preview, /return_history[\s\S]*Return already exists for this barcode or invoice/);
  assert.match(route, /beginTransaction\(\)/);
  assert.match(route, /forUpdate:\s*true/);
  assert.match(route, /UPDATE stock[\s\S]*INSERT INTO return_refund_payables[\s\S]*UPDATE sales_items/);
  assert.match(route, /await connection\.commit\(\)/);
  assert.match(route, /await connection\.rollback\(\)/);
});

test("return UI blocks double-click while the request is in flight", () => {
  assert.match(returnSource, /let returnSubmissionPending = false/);
  assert.match(returnSource, /if \(returnSubmissionPending\) return/);
  assert.match(returnSource, /setReturnSubmissionPending\(true\)/);
});
