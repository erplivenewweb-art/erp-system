"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
const stickerSource = fs.readFileSync(path.join(__dirname, "../sticker.html"), "utf8");

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
