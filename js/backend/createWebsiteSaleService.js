const { canonicalizeCreateWebsiteSale } = require("./createWebsiteSale");

const PAYMENT_FIELDS = new Set([
  "paymentAllocation",
  "paymentReceipt",
  "paymentAccountId",
  "cashSettlement",
  "bankSettlement",
  "upiSettlement",
  "metalSettlement",
  "draftId",
  "invoiceDraftId",
  "invoiceNumber",
]);

function createWebsiteSaleService() {
  return Object.freeze({
    plan(input) {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("Website sale service input is invalid");
      for (const key of Object.keys(input))
        if (PAYMENT_FIELDS.has(key))
          throw new Error(`Website sale service field is prohibited: ${key}`);
      const command = canonicalizeCreateWebsiteSale(input.command);
      if (
        !input.partyMapping ||
        typeof input.partyMapping.erpPartyReference !== "string" ||
        !input.partyMapping.erpPartyReference.trim()
      ) {
        throw new Error("Existing ERP party mapping is required");
      }
      return Object.freeze({
        command,
        partyMapping: Object.freeze({
          erpPartyReference: input.partyMapping.erpPartyReference.trim(),
        }),
        futureEffects: Object.freeze([
          "INVOICE_SEQUENCE",
          "SALE_HEADER",
          "SALE_ITEMS",
          "GST_TAX",
          "SALE_TRANSACTION_MASTER_LINES",
          "RECEIVABLE_DEBIT",
          "STOCK_AND_BARCODE",
          "EXECUTION_RESULT_LINKAGE",
        ]),
        executionEnabled: false,
      });
    },
    execute() {
      throw new Error("CREATE_WEBSITE_SALE_EXECUTION_DISABLED");
    },
  });
}

module.exports = { createWebsiteSaleService };
