const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createWebsiteSaleService,
} = require("../js/backend/createWebsiteSaleService");

const command = {
  externalExecutionId: "phase8e-execution-0001",
  websiteOrderId: "phase8e-order-0001",
  companyId: 1,
  branchId: 2,
  partyReference: "mapped-party-1",
  currency: "INR",
  authoritativeDigest: "a".repeat(64),
  items: [
    {
      mappingReference: "mapped-item-1",
      quantity: 1,
      snapshotDigest: "b".repeat(64),
    },
  ],
};

test("payment-free CreateWebsiteSale service plans only the approved future effects and cannot execute", () => {
  const service = createWebsiteSaleService();
  const plan = service.plan({
    command,
    partyMapping: { erpPartyReference: "party-1" },
  });
  assert.equal(plan.executionEnabled, false);
  assert.deepEqual(plan.futureEffects, [
    "INVOICE_SEQUENCE",
    "SALE_HEADER",
    "SALE_ITEMS",
    "GST_TAX",
    "SALE_TRANSACTION_MASTER_LINES",
    "RECEIVABLE_DEBIT",
    "STOCK_AND_BARCODE",
    "EXECUTION_RESULT_LINKAGE",
  ]);
  assert.throws(() => service.execute(), /EXECUTION_DISABLED/);
  assert.throws(
    () =>
      service.plan({
        command,
        partyMapping: { erpPartyReference: "party-1" },
        paymentAllocation: "forbidden",
      }),
    /prohibited/,
  );
  assert.throws(
    () =>
      service.plan({
        command,
        partyMapping: { erpPartyReference: "party-1" },
        metalSettlement: "forbidden",
      }),
    /prohibited/,
  );
  assert.throws(
    () => service.plan({ command, partyMapping: {} }),
    /Existing ERP party mapping is required/,
  );
});
