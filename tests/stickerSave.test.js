"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
const stickerSource = fs.readFileSync(path.join(__dirname, "../sticker.html"), "utf8");
const processSource = fs.readFileSync(path.join(__dirname, "../process.html"), "utf8");

function sourceSection(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startText}`);
  return source.slice(start, end);
}

test("bulk Sticker Save uses one database transaction for stock and barcode history", () => {
  const route = sourceSection(serverSource, 'app.post("/addStickersBulk"', 'app.post("/addSticker"');
  assert.match(route, /beginTransaction\(\)/);
  assert.match(route, /insertStickerStockRow\(connection/);
  assert.match(route, /await connection\.commit\(\)/);
  assert.match(route, /await connection\.rollback\(\)/);
});

test("barcode lifecycle creation is strict inside Sticker Save", () => {
  const helper = sourceSection(serverSource, "async function insertStickerStockRow", "app.get(\"/stickers/check-serial\"");
  assert.match(helper, /appendBarcodeLifecycleEvent\(connection/);
  assert.match(helper, /strict:\s*true/);
});

test("Sticker weight allowance compares exact thousandths", () => {
  const helper = sourceSection(serverSource, "async function validateStickerAgainstProcessOutput", "async function getStickerBillableAllowance");
  assert.match(helper, /decimalToThousandths/);
  assert.match(helper, /totalWeightMillis > allowedWeightMillis/);
  assert.doesNotMatch(helper, /\+\s*0\.0005/);
});

test("approved lamination is the only post-process weight included in Sticker allowance", () => {
  const allowance = sourceSection(serverSource, "async function getStickerBillableAllowance", "function getStickerCommercialWeights");
  assert.match(allowance, /const isApprovedLamination = laminationRecord\?\.status === "APPROVED"/);
  assert.match(allowance, /isApprovedLamination \? toNumber\(laminationRecord\.laminationGainWeight\) : 0/);
  assert.match(allowance, /actualProcessWeight \+ laminationGainWeight/);
});

test("lamination input is blank-safe, non-negative, and exact to thousandths", () => {
  const parser = sourceSection(serverSource, "function parseOptionalWeightThousandths", "function normalizeReturnType");
  assert.match(parser, /!hasProvidedValue\(value\)/);
  assert.match(parser, /decimalToThousandths\(value\)/);
  assert.match(parser, /at most 3 decimal places/);

  const route = sourceSection(serverSource, 'app.post("/process/lots/:lotNo/lamination"', 'app.post("/process/lots/:lotNo/lamination/approve"');
  assert.match(route, /parsedGain\.value < 0/);
  assert.match(route, /actualProcessWeightMillis \+ parsedGain\.millis/);
});

test("Sticker over-limit response includes the complete auditable weight breakdown", () => {
  const helper = sourceSection(serverSource, "async function validateStickerAgainstProcessOutput", "async function getStickerBillableAllowance");
  assert.match(helper, /Process output:/);
  assert.match(helper, /Declared lamination\/addition:/);
  assert.match(helper, /Allowed total:/);
  assert.match(helper, /Entered sticker total:/);
  assert.match(helper, /Difference:/);
});

test("Process page records a lamination draft but defers final approval to typed Sticker Save", () => {
  assert.match(processSource, /id="processLaminationGainWeight"/);
  assert.match(processSource, /saveProcessLaminationDraft\(\)/);
  assert.doesNotMatch(processSource, /approveProcessLamination\(\)/);
  assert.match(processSource, /Final approval requires typing APPROVE in the Sticker Save confirmation/);
  assert.match(processSource, /It does not change the completed process output/);
});

test("typed additional-weight approval is exact, separately authorized, and durable", () => {
  const approval = sourceSection(serverSource, 'app.post("/stickers/approve-additional-weight"', 'app.post("/addStickersBulk"');
  assert.match(approval, /authMiddleware/);
  assert.match(approval, /checkRole\(\["SUPERADMIN", "OWNER", "STAFF"\]\)/);
  assert.match(approval, /requireBranchOperationalPermission/);
  assert.match(approval, /allowApprovalMutation:\s*true/);

  const helper = sourceSection(serverSource, "const STICKER_ADDITIONAL_WEIGHT_CONFIRMATION", "async function countRowsForTestLotDelete");
  assert.match(helper, /String\(approval\.confirmation \?\? ""\) !== STICKER_ADDITIONAL_WEIGHT_CONFIRMATION/);
  assert.match(helper, /hasDurableStickerAdditionalWeightApproval/);
  assert.match(helper, /decimalToThousandths/);
  assert.match(helper, /STICKER_ADDITIONAL_WEIGHT_CONFIRMED/);
});

test("approval modal resumes one explicit SAVE or PRINT continuation without flag-only reopen", () => {
  const approvalUi = sourceSection(stickerSource, "function getUnsavedStickerSaveItems", "function startInlineEdit");
  assert.match(approvalUi, /pendingAction === "PRINT" \? "PRINT" : "SAVE"/);
  assert.match(approvalUi, /\/stickers\/approve-additional-weight/);
  assert.match(approvalUi, /approvalRecognized !== true/);
  assert.match(approvalUi, /approvalDetails\?\.approvalCode === "STICKER_ADDITIONAL_WEIGHT_APPROVAL_REQUIRED"/);
  assert.doesNotMatch(approvalUi, /if \(approvalDetails\?\.requiresAdditionalWeightApproval\)/);
  assert.match(approvalUi, /continueStickerPrintOnce\(\)/);
  assert.doesNotMatch(approvalUi, /\.click\(\)/);
});

test("Sticker rows preserve explicit pair quantity through approval continuation", () => {
  const flow = sourceSection(stickerSource, "function getStickerFormData", "function startInlineEdit");
  assert.match(stickerSource, /id="stickerQty"[^>]+value="1"/);
  assert.match(flow, /qty:\s*document\.getElementById\("stickerQty"\)/);
  assert.match(flow, /qty:\s*stickerQtyValue/);
  assert.match(flow, /Object\.prototype\.hasOwnProperty\.call\(item, "qty"\) \? item\.qty : 1/);
  assert.match(flow, /qty:\s*String\(item\.qty \?\? ""\)/);
  assert.match(flow, /validateStickerSaveItemsClient\(items\)/);
});

test("quantity is based on rows, never on a serial-number range", () => {
  const flow = sourceSection(stickerSource, "function getUnsavedStickerSaveItems", "function startInlineEdit");
  assert.match(flow, /items\.reduce\(\(total, item\) => total \+ Number\(item\.qty \|\| 0\), 0\)/);
  assert.doesNotMatch(flow, /lastSerial\s*-\s*firstSerial/);
  assert.doesNotMatch(flow, /Math\.max\([^)]*serial[^)]*\)\s*-\s*Math\.min/i);
});

test("ordinary row validation completes before approval mutation", () => {
  const approval = sourceSection(serverSource, 'app.post("/stickers/approve-additional-weight"', 'app.post("/addStickersBulk"');
  assert.ok(approval.indexOf("normalizeStickerSaveItem") < approval.indexOf("authorizeStickerAdditionalWeightForSave"));
  assert.ok(approval.indexOf("validateStickerSaveItemAgainstStock") < approval.indexOf("authorizeStickerAdditionalWeightForSave"));
  assert.match(approval, /validationCode !== "STICKER_WEIGHT_EXCEEDS_ALLOWANCE"/);
  assert.match(approval, /errorScope:\s*error\?\.stickerErrorScope \|\| "APPROVAL"/);
});

test("Sticker Save errors leave the approval modal and highlight the invalid row", () => {
  const approvalUi = sourceSection(stickerSource, "function showStickerSaveValidationError", "function startInlineEdit");
  assert.match(approvalUi, /result\?\.errorScope === "STICKER_SAVE"/);
  assert.match(approvalUi, /hideStickerAdditionalWeightApprovalModal\(\)/);
  assert.match(approvalUi, /scrollIntoView/);
  assert.match(approvalUi, /dataset\.invalidField = "true"/);
});

test("approval modal keeps exact typed confirmation and blocks Enter/paste bypass", () => {
  assert.match(stickerSource, /Approve Additional Weight &amp; Continue/);
  assert.match(stickerSource, /String\(input\?\.value \?\? ""\) !== "APPROVE"/);
  assert.match(stickerSource, /addEventListener\("paste"/);
  assert.match(stickerSource, /event\.key !== "Enter"/);
  assert.match(stickerSource, /Approval not confirmed\. Type APPROVE exactly to continue\./);
});

test("Sticker Save rejects zero weight and non-whole quantity on the server", () => {
  const helper = sourceSection(serverSource, "function normalizeStickerSaveItem", "async function validateStickerSaveItemAgainstStock");
  assert.match(helper, /weightMillis <= 0/);
  assert.match(helper, /Number\.isInteger\(parsedQty\.value\)/);
});

test("process-lot lock is acquired before duplicate stock validation", () => {
  const route = sourceSection(serverSource, 'app.post("/addStickersBulk"', 'app.post("/addSticker"');
  assert.ok(route.indexOf("validateStickerAgainstProcessOutput") < route.indexOf("validateStickerSaveItemAgainstStock"));
  const allowance = sourceSection(serverSource, "async function getStickerBillableAllowance", "function getStickerCommercialWeights");
  assert.match(allowance, /FOR UPDATE/);
});

test("saved lot serials remain reserved after sale and client verification fails closed", () => {
  const validator = sourceSection(serverSource, "async function validateStickerSaveItemAgainstStock", "async function insertStickerStockRow");
  const serialQuery = sourceSection(validator, "const [dupLotSerial]", "if (dupLotSerial.length");
  assert.doesNotMatch(serialQuery, /status[^\n]+IN_STOCK/);
  assert.doesNotMatch(serialQuery, /deleted_at\s+IS\s+NULL/i);

  const addItem = sourceSection(stickerSource, "async function addStickerItem", "async function savePendingToServer");
  assert.match(addItem, /SERIAL_CHECK_API_FAILED[\s\S]*Serial verification failed[\s\S]*return;/);
});

test("Sticker printing supports pending rows without changing save state", () => {
  const print = sourceSection(stickerSource, "function printStickerSheet", "</script>");
  assert.match(print, /const visibleItems = \[\.\.\.pendingStickerItems\]/);
  assert.match(print, /There are no sticker items available for printing/);
  assert.doesNotMatch(print, /fetch\([^)]*,\s*\{[\s\S]*method:\s*["']POST["']/);
});
