(function initColourPlantReceiptPrint(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ColourPlantReceiptPrint = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createColourPlantReceiptPrint() {
  "use strict";

  const STORAGE_KEY = "colourPlantA4ReceiptNextSlot";
  const SHEET_FULL_VALUE = 7;
  const SLOT_WIDTH_MM = 96;
  const SLOT_HEIGHT_MM = 92;
  const RECEIPT_WIDTH_MM = 88;
  const RECEIPT_MAX_HEIGHT_MM = 86;

  const SLOTS = Object.freeze([
    Object.freeze({ number: 1, label: "Slot 1 — Top Left", leftMm: 7, topMm: 7.5 }),
    Object.freeze({ number: 2, label: "Slot 2 — Top Right", leftMm: 107, topMm: 7.5 }),
    Object.freeze({ number: 3, label: "Slot 3 — Middle Left", leftMm: 7, topMm: 102.5 }),
    Object.freeze({ number: 4, label: "Slot 4 — Middle Right", leftMm: 107, topMm: 102.5 }),
    Object.freeze({ number: 5, label: "Slot 5 — Bottom Left", leftMm: 7, topMm: 197.5 }),
    Object.freeze({ number: 6, label: "Slot 6 — Bottom Right", leftMm: 107, topMm: 197.5 })
  ]);

  function normalizeSlot(value, fallback = 1) {
    const slot = Number(value);
    return Number.isInteger(slot) && slot >= 1 && slot <= 6 ? slot : fallback;
  }

  function readNextSlot(storage) {
    const value = Number(storage?.getItem?.(STORAGE_KEY));
    if (value === SHEET_FULL_VALUE) return SHEET_FULL_VALUE;
    return normalizeSlot(value, 1);
  }

  function selectSlot(storage, slot) {
    const normalized = normalizeSlot(slot);
    storage?.setItem?.(STORAGE_KEY, String(normalized));
    return normalized;
  }

  function advanceAfterPrint(storage, printedSlot) {
    const normalized = normalizeSlot(printedSlot);
    const nextSlot = normalized === 6 ? SHEET_FULL_VALUE : normalized + 1;
    storage?.setItem?.(STORAGE_KEY, String(nextSlot));
    return Object.freeze({ printedSlot: normalized, nextSlot, sheetFull: nextSlot === SHEET_FULL_VALUE });
  }

  function resetSheet(storage) {
    storage?.setItem?.(STORAGE_KEY, "1");
    return 1;
  }

  function getSlot(slot) {
    return SLOTS[normalizeSlot(slot) - 1];
  }

  function getSlotPositionStyle(slot) {
    const position = getSlot(slot);
    return `left:${position.leftMm}mm;top:${position.topMm}mm;width:${SLOT_WIDTH_MM}mm;height:${SLOT_HEIGHT_MM}mm`;
  }

  return Object.freeze({
    RECEIPT_MAX_HEIGHT_MM,
    RECEIPT_WIDTH_MM,
    SHEET_FULL_VALUE,
    SLOT_HEIGHT_MM,
    SLOT_WIDTH_MM,
    SLOTS,
    STORAGE_KEY,
    advanceAfterPrint,
    getSlot,
    getSlotPositionStyle,
    normalizeSlot,
    readNextSlot,
    resetSheet,
    selectSlot
  });
});
