"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  STATUS_TRANSITIONS,
  buildScope,
  calculateEstimatedAmount,
  formatScaledDecimal,
  makeJobNumber,
  parseScaledDecimal
} = require("../js/backend/colourPlant");

test("business example preserves exact three-decimal weight difference", () => {
  const received = parseScaledDecimal("100.000", 3, { min: 1n });
  const finalWeight = parseScaledDecimal("99.850", 3, { min: 1n });
  assert.equal(formatScaledDecimal(finalWeight - received, 3), "-0.150");
});

test("date sequence produces the required human-readable Job Number", () => {
  assert.equal(makeJobNumber("260818", 1), "CLR-260818-001");
  assert.equal(makeJobNumber("260818", 1002), "CLR-260818-1002");
});

test("critical decimals reject floating precision and malformed values", () => {
  assert.equal(formatScaledDecimal(parseScaledDecimal("2000.00", 2), 2), "2000.00");
  assert.throws(() => parseScaledDecimal("99.8501", 3), /Maximum 3 decimal places/);
  assert.throws(() => parseScaledDecimal("NaN", 2), /Invalid numeric value/);
});

test("rate type calculates the estimated charge authoritatively", () => {
  const rate = parseScaledDecimal("25.00", 2, { min: 0n });
  const receivedWeight = parseScaledDecimal("50.980", 3, { min: 1n });

  assert.equal(formatScaledDecimal(calculateEstimatedAmount({ rateType: "PER_GRAM", rate, receivedWeight, qty: 20 }), 2), "1274.50");
  assert.equal(formatScaledDecimal(calculateEstimatedAmount({ rateType: "PER_PIECE", rate, receivedWeight, qty: 20 }), 2), "500.00");
  assert.equal(formatScaledDecimal(calculateEstimatedAmount({ rateType: "FLAT", rate, receivedWeight, qty: 20 }), 2), "25.00");
  assert.equal(formatScaledDecimal(calculateEstimatedAmount({ rateType: "OTHER", rate, receivedWeight, qty: 20, providedAmount: 12345n }), 2), "123.45");
});

test("simplified workflow is valid while historical stage transitions remain compatible", () => {
  const flow = ["RECEIVED", "IN_PROCESS", "COLOURING", "QC", "READY"];
  for (let index = 0; index < flow.length - 1; index += 1) {
    assert.equal(STATUS_TRANSITIONS[flow[index]].has(flow[index + 1]), true);
  }
  assert.equal(STATUS_TRANSITIONS.RECEIVED.has("READY"), true);
  assert.equal(STATUS_TRANSITIONS.DELIVERED.size, 0);
});

test("Colour Plant backend has no writes into company stock or billing tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/backend/colourPlant.js"), "utf8");
  const forbiddenWrites = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:stock|sales_history|sales_items|invoice_drafts|branch_transfers)\b/gi;
  assert.deepEqual(source.match(forbiddenWrites), null);
});

test("high-risk actions are protected by transactions and idempotency keys", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/backend/colourPlant.js"), "utf8");
  assert.match(source, /create_idempotency_key/);
  assert.match(source, /uq_colour_payment_company_idempotency/);
  assert.match(source, /beginTransaction\(\)/);
  assert.match(source, /ALREADY_DELIVERED/);
});

test("tenant and branch scope cannot be omitted from job queries", () => {
  assert.deepEqual(buildScope({ companyScope: 7 }, { isBranchFiltered: false }, "cj"), {
    clauses: ["cj.company_id = ?"],
    params: [7]
  });
  assert.deepEqual(buildScope({ companyScope: 7 }, { isBranchFiltered: true, branchId: 12 }, "cj"), {
    clauses: ["cj.company_id = ?", "cj.branch_id = ?"],
    params: [7, 12]
  });
});

test("Colour Plant is a third top-level navigation system", () => {
  const authSource = fs.readFileSync(path.join(__dirname, "../js/auth.js"), "utf8");
  assert.match(authSource, /colour:\s*\{\s*label:\s*"Colour Plant"/);
  assert.match(authSource, /mode:\s*"colour"[^\n]+section:\s*"work-status"[^\n]+label:\s*"Work Status \/ Ready Jobs"/);
  assert.doesNotMatch(authSource, /mode:\s*"colour"[^\n]+label:\s*"Sankha Processing"/);
  assert.doesNotMatch(authSource, /mode:\s*"production"[^\n]+pageKey:\s*"colour-plant"/);
  assert.doesNotMatch(authSource, /mode:\s*"sales"[^\n]+pageKey:\s*"colour-plant"/);
});

test("Production and Store plans do not grant Colour Plant", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
  const productionPlan = serverSource.match(/PRODUCTION_SYSTEM:\s*\[([^\]]+)\]/)?.[1] || "";
  const storePlan = serverSource.match(/STORE_SYSTEM:\s*\[([^\]]+)\]/)?.[1] || "";
  const colourPlan = serverSource.match(/COLOUR_PLANT_SYSTEM:\s*\[([^\]]+)\]/)?.[1] || "";
  assert.doesNotMatch(productionPlan, /COLOUR_PLANT/);
  assert.doesNotMatch(storePlan, /COLOUR_PLANT/);
  assert.match(colourPlan, /COLOUR_PLANT/);
});

test("FULL_ERP reconciliation inserts missing Colour Plant access without overwriting overrides", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
  const start = serverSource.indexOf("async function reconcileColourPlantSystemEntitlements()");
  const end = serverSource.indexOf("async function backfillCompanySaasAccess", start);
  const reconciliation = start >= 0 && end > start ? serverSource.slice(start, end) : "";
  assert.match(reconciliation, /INSERT IGNORE INTO company_module_access/);
  assert.match(reconciliation, /IN \('FULL_ERP', 'COLOUR_PLANT_SYSTEM'\)/);
  assert.match(reconciliation, /WHERE cma\.module_key = 'COLOUR_PLANT'[\s\S]*UPPER\(COALESCE\(cma\.source, 'PLAN'\)\) = 'PLAN'/);
  assert.doesNotMatch(reconciliation, /source\s*=\s*'OVERRIDE'/);
});

test("Work Status replaces only the Colour Plant placeholder", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  const authSource = fs.readFileSync(path.join(__dirname, "../js/auth.js"), "utf8");
  assert.match(pageSource, /id="view-work-status"/);
  assert.match(pageSource, /Customer Informed/);
  assert.doesNotMatch(pageSource, /id="view-processing"/);
  assert.match(authSource, /mode:\s*"production"[^\n]+href:\s*"process\.html"[^\n]+label:\s*"Process"/);
  assert.doesNotMatch(pageSource, /fetch\([^\n]+\/process\//i);
});

test("customer-informed marker is additive, scoped, and audited", () => {
  const backendSource = fs.readFileSync(path.join(__dirname, "../js/backend/colourPlant.js"), "utf8");
  assert.match(backendSource, /customer_informed_at/);
  assert.match(backendSource, /\/colour-jobs\/:identifier\/customer-informed/);
  assert.match(backendSource, /job\.status!=="READY"/);
  assert.match(backendSource, /"CUSTOMER_INFORMED"/);
  assert.match(backendSource, /WHERE id=\? AND company_id=\?/);
});

test("existing Colour Plant data and shared offline receipt/packet Job Number barcode are preserved", () => {
  const backendSource = fs.readFileSync(path.join(__dirname, "../js/backend/colourPlant.js"), "utf8");
  const migrationSource = fs.readFileSync(path.join(__dirname, "../migrations/20260818_colour_plant.up.sql"), "utf8");
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  assert.doesNotMatch(`${backendSource}\n${migrationSource}`, /\b(?:DROP|TRUNCATE)\s+(?:TABLE\s+)?colour_/i);
  assert.match(pageSource, /const code39=/);
  assert.match(pageSource, /renderBarcode\(\$\{JSON\.stringify\(j\.job_no\)\}\)/);
  assert.doesNotMatch(pageSource, /cdn\.jsdelivr\.net\/npm\/jsbarcode/);
  assert.match(pageSource, /type==='RECEIPT'/);
  assert.match(pageSource, /printJob\(latestCreatedJob\.job,'PACKET_LABEL'\)/);
});

test("Colour Plant print opens before audit logging so browser pop-up protection cannot block it", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  const printStart = pageSource.indexOf("async function printJob(j,type)");
  const printEnd = pageSource.indexOf("async function runReport", printStart);
  const printFunction = pageSource.slice(printStart, printEnd);
  assert.match(printFunction, /const printWindow=window\.open/);
  assert.match(printFunction, /await api\(`\/colour-jobs\/\$\{j\.id\}\/reprint/);
  assert.ok(printFunction.indexOf("window.open") < printFunction.indexOf("await api"));
});

test("customer material receipt uses compact A4 slot printing while packet label remains unchanged", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");

  assert.match(pageSource, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(pageSource, /html,body\{width:210mm;height:297mm/);
  assert.match(pageSource, /\.print-card\{position:absolute;box-sizing:border-box;left:4mm;top:3mm;width:88mm;max-height:86mm/);
  assert.match(pageSource, /class="receipt-slot slot-\$\{receiptSlot\}"/);
  assert.match(pageSource, /@page\{size:50mm 30mm;margin:0\}/);
});

test("Receive form enables receipt and barcode-label print immediately after job creation", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  assert.doesNotMatch(pageSource, /id="quickPrintPanel"/);
  assert.match(pageSource, /id="receiveForm"[\s\S]*id="printLatestReceipt"/);
  assert.match(pageSource, /id="printLatestLabel"/);
  assert.match(pageSource, /Print Barcode Label/);
  assert.match(pageSource, /printLatestReceipt'\)\.disabled=false/);
  assert.match(pageSource, /printLatestLabel'\)\.disabled=false/);
  assert.match(pageSource, /printLatestReceipt'\)\.onclick=.*printJob\(latestCreatedJob\.job,'RECEIPT',\{receiptSlot:getSelectedReceiptSlot\(\)\}\)/);
  assert.match(pageSource, /printLatestLabel'\)\.onclick=.*printJob\(latestCreatedJob\.job,'PACKET_LABEL'\)/);
});

test("Receive form recalculates estimated charge from rate inputs before submit", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");

  assert.match(pageSource, /function calculateEstimatedCharge\(\)/);
  assert.match(pageSource, /type==='PER_GRAM'\?weight\*rate:type==='PER_PIECE'\?qty\*rate:rate/);
  assert.match(pageSource, /addEventListener\('submit',async e=>\{e\.preventDefault\(\);calculateEstimatedCharge\(\)/);
});

function renderDeliveryForStatus(status) {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  const start = pageSource.indexOf("function renderDelivery(d)");
  const end = pageSource.indexOf("async function deliverJob()", start);
  assert.ok(start >= 0 && end > start, "delivery renderer must exist");
  const result = { innerHTML: "" };
  const document = { getElementById(id) { assert.equal(id, "deliveryResult"); return result; } };
  const esc = (value) => String(value ?? "");
  const fmtWeight = (value) => `${Number(value || 0).toFixed(3)} g`;
  const fmtMoney = (value) => `INR ${Number(value || 0).toFixed(2)}`;
  const renderer = new Function("document", "esc", "fmtWeight", "fmtMoney", `${pageSource.slice(start, end)}; return renderDelivery;`)(document, esc, fmtWeight, fmtMoney);
  renderer({ job: {
    job_no: "CLR-TEST-001", status, customer_name_snapshot: "Test Customer",
    received_weight: "10.000", final_weight: status === "RECEIVED" ? null : "10.000",
    weight_difference: "0.000", work_type: "Gold Colour", item_description: "Ring", qty: 1,
    estimated_amount: "100.00", final_amount: status === "RECEIVED" ? null : "100.00",
    total_paid: "100.00", balance: "0.00", customer_informed_at: status === "READY" ? "2026-10-02" : null
  } });
  return result.innerHTML;
}

test("Ready for Delivery renders confirmation controls only for an exact READY status", () => {
  const readyHtml = renderDeliveryForStatus("READY");
  assert.match(readyHtml, /id="deliveryPayment"/);
  assert.match(readyHtml, /id="deliveryReceivedBy"/);
  assert.match(readyHtml, /id="deliveryMobile"/);
  assert.match(readyHtml, /id="deliveryRemarks"/);
  assert.match(readyHtml, /onclick="deliverJob\(\)"[^>]*>Confirm Delivery/);

  for (const status of ["RECEIVED", "DELIVERED"]) {
    const html = renderDeliveryForStatus(status);
    assert.doesNotMatch(html, /onclick="deliverJob\(\)"/);
    assert.match(html, new RegExp(`cannot be delivered because its status is ${status}`));
  }
});

test("READY queue and detail drawer route explicitly into the delivery renderer", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  assert.match(pageSource, /loadReadyDeliveryQueue\(\)[\s\S]*renderReadyDeliveryQueue\(data\.rows\)/);
  assert.match(pageSource, /Open Delivery/);
  assert.match(pageSource, /async function openDeliveryFromQueue\(jobNo\)[\s\S]*showView\('delivery'\)[\s\S]*await findDeliveryJob\(\)/);
});

test("delivery backend retains READY, scope, balance, and duplicate-delivery guards", () => {
  const backendSource = fs.readFileSync(path.join(__dirname, "../js/backend/colourPlant.js"), "utf8");
  const start = backendSource.indexOf('app.post("/colour-jobs/:identifier/deliver"');
  const end = backendSource.indexOf("\n  });", start);
  const deliveryRoute = backendSource.slice(start, end);
  assert.match(deliveryRoute, /getJobForUpdate\([^;]+true\)/);
  assert.match(deliveryRoute, /job\.status==="DELIVERED"/);
  assert.match(deliveryRoute, /job\.status!=="READY"/);
  assert.match(deliveryRoute, /Full payment is required before delivery/);
  assert.match(deliveryRoute, /Only Owner or Accounts can authorize due delivery/);
  assert.match(deliveryRoute, /idempotency_key=\?/);
  assert.match(deliveryRoute, /company_id=\? AND status='READY'/);
});
