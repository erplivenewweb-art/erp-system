"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const receiptPrint = require("../js/colour-plant-receipt-print");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    snapshot() { return Object.fromEntries(values); }
  };
}

test("six unique A4 receipt positions exist in the required order", () => {
  assert.equal(receiptPrint.SLOTS.length, 6);
  assert.deepEqual(
    receiptPrint.SLOTS.map(({ number, label, leftMm, topMm }) => ({ number, label, leftMm, topMm })),
    [
      { number: 1, label: "Slot 1 — Top Left", leftMm: 7, topMm: 7.5 },
      { number: 2, label: "Slot 2 — Top Right", leftMm: 107, topMm: 7.5 },
      { number: 3, label: "Slot 3 — Middle Left", leftMm: 7, topMm: 102.5 },
      { number: 4, label: "Slot 4 — Middle Right", leftMm: 107, topMm: 102.5 },
      { number: 5, label: "Slot 5 — Bottom Left", leftMm: 7, topMm: 197.5 },
      { number: 6, label: "Slot 6 — Bottom Right", leftMm: 107, topMm: 197.5 }
    ]
  );
  assert.equal(new Set(receiptPrint.SLOTS.map((slot) => `${slot.leftMm},${slot.topMm}`)).size, 6);
  assert.equal(receiptPrint.SLOT_WIDTH_MM, 96);
  assert.equal(receiptPrint.SLOT_HEIGHT_MM, 92);
});

test("slot 6 marks the sheet full and never silently wraps to slot 1", () => {
  const storage = memoryStorage();
  for (let slot = 1; slot <= 6; slot += 1) {
    const result = receiptPrint.advanceAfterPrint(storage, slot);
    assert.equal(result.nextSlot, slot === 6 ? receiptPrint.SHEET_FULL_VALUE : slot + 1);
  }
  assert.equal(receiptPrint.readNextSlot(storage), receiptPrint.SHEET_FULL_VALUE);
  assert.equal(storage.snapshot()[receiptPrint.STORAGE_KEY], "7");
});

test("reset to slot 1 requires the explicit reset action", () => {
  const storage = memoryStorage({ [receiptPrint.STORAGE_KEY]: "7" });
  assert.equal(receiptPrint.readNextSlot(storage), receiptPrint.SHEET_FULL_VALUE);
  receiptPrint.resetSheet(storage);
  assert.equal(receiptPrint.readNextSlot(storage), 1);
});

test("manual selection corrects the next position using localStorage only", () => {
  const storage = memoryStorage({ unrelated: "preserved" });
  receiptPrint.selectSlot(storage, 4);
  assert.deepEqual(storage.snapshot(), {
    unrelated: "preserved",
    [receiptPrint.STORAGE_KEY]: "4"
  });
  assert.equal(receiptPrint.readNextSlot(storage), 4);
});

test("receipt page uses one selected A4 slot and preserves the packet-label format", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  const printStart = pageSource.indexOf("async function printJob(j,type)");
  const printEnd = pageSource.indexOf("async function runReport", printStart);
  const printFunction = pageSource.slice(printStart, printEnd);

  assert.match(printFunction, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(printFunction, /width:210mm;height:297mm/);
  assert.match(printFunction, /class="receipt-slot slot-\$\{receiptSlot\}"/);
  assert.equal((printFunction.match(/class="receipt-slot/g) || []).length, 1);
  assert.match(printFunction, /@page\{size:50mm 30mm;margin:0\}/);
  assert.match(printFunction, /html,body\{width:50mm;height:30mm/);
});

test("slot state stays browser-local and receipt printing does not alter job business data", () => {
  const stateSource = fs.readFileSync(path.join(__dirname, "../js/colour-plant-receipt-print.js"), "utf8");
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  const printStart = pageSource.indexOf("async function printJob(j,type)");
  const printEnd = pageSource.indexOf("async function runReport", printStart);
  const printFunction = pageSource.slice(printStart, printEnd);

  assert.match(stateSource, /colourPlantA4ReceiptNextSlot/);
  assert.doesNotMatch(stateSource, /fetch\(|XMLHttpRequest|\/colour-jobs|mysql|database/i);
  assert.doesNotMatch(printFunction, /method:'PATCH'|method:'PUT'|method:'DELETE'/);
  assert.match(printFunction, /\/reprint/);
  assert.doesNotMatch(printFunction, /receiptSlot[^\n]+body:JSON\.stringify/);
});

test("required operator warning and browser print instructions are visible", () => {
  const pageSource = fs.readFileSync(path.join(__dirname, "../colour-plant.html"), "utf8");
  assert.match(pageSource, /Reusing a partially cut A4 sheet may cause printer jams or alignment problems/);
  assert.match(pageSource, /Paper: A4 · Orientation: Portrait · Scale: 100% · Margins: None · Headers and footers: Off/);
  assert.match(pageSource, /New A4 Sheet \/ Reset to Slot 1/);
  assert.match(pageSource, /A4 sheet is now full/);
});
