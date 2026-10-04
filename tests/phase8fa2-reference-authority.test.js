const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  FUTURE_EXECUTE_OPERATION,
  ReferenceAuthorityError,
  buildQuantityOneExecutionPayload,
  loadV1DurableSnapshot,
  createV1EvidenceBridge,
  calculateGstAllocation,
  executionPayloadDigest,
  createWebsiteSaleReferenceAuthority,
} = require("../js/backend/createWebsiteSaleReferenceAuthority");

const source = (changes = {}) => ({
  party: async () => ({
    partyId: 11,
    companyId: 1,
    partyType: "CUSTOMER",
    supplyState: "Odisha",
  }),
  product: async () => ({
    integrationProductId: 21,
    companyId: 1,
    active: true,
  }),
  stock: async () => ({
    stockId: 31,
    barcode: "BC-31",
    integrationProductId: 21,
    companyId: 1,
    branchId: 2,
    sellable: true,
  }),
  tax: async () => ({ gstRatePercent: 18, active: true }),
  sellerState: async () => "Odisha",
  ...changes,
});

const request = {
  companyId: 1,
  branchId: 2,
  externalPartyRef: "party_public_1",
  externalProductRef: "prd_1",
  externalVariantRef: "var_1",
  externalLineRef: "line_1",
  quantity: 1,
};

test("Phase 8F-A2 resolves only private exact quantity=1 authority and blocks invalid mappings", async () => {
  const authority = createWebsiteSaleReferenceAuthority(source());
  const resolved = await authority.resolveQuantityOne(request);
  assert.equal(resolved.party.partyId, 11);
  assert.equal(resolved.stock.stockId, 31);
  assert.equal(resolved.tax.gstRatePercent, 18);
  await assert.rejects(
    () =>
      createWebsiteSaleReferenceAuthority(
        source({ party: async () => null }),
      ).resolveQuantityOne(request),
    { code: "PARTY_MAPPING_BLOCKED" },
  );
  await assert.rejects(
    () => authority.resolveQuantityOne({ ...request, quantity: 2 }),
    { code: "MULTI_UNIT_ALLOCATION_POLICY_REQUIRED" },
  );
  await assert.rejects(
    () =>
      createWebsiteSaleReferenceAuthority(
        source({
          stock: async () => ({
            companyId: 1,
            branchId: 2,
            integrationProductId: 21,
            sellable: false,
          }),
        }),
      ).resolveQuantityOne(request),
    { code: "STOCK_BINDING_BLOCKED" },
  );
  await assert.rejects(
    () =>
      createWebsiteSaleReferenceAuthority(
        source({ tax: async () => null }),
      ).resolveQuantityOne(request),
    { code: "GST_RATE_SOURCE_MISSING" },
  );
});

test("Phase 8F-A2 tax allocation and digest are deterministic and payment-free", () => {
  assert.equal(FUTURE_EXECUTE_OPERATION, "CREATE_WEBSITE_SALE_EXECUTE");
  assert.deepEqual(
    calculateGstAllocation({
      taxableValue: 100,
      gstRatePercent: 18,
      sellerState: "Odisha",
      customerState: "Odisha",
    }),
    {
      taxableValue: 100,
      gstRatePercent: 18,
      cgst: 9,
      sgst: 9,
      igst: 0,
      tax: 18,
      lineTotal: 118,
      taxType: "CGST_SGST",
    },
  );
  assert.deepEqual(
    calculateGstAllocation({
      taxableValue: 100,
      gstRatePercent: 18,
      sellerState: "Odisha",
      customerState: "West Bengal",
    }),
    {
      taxableValue: 100,
      gstRatePercent: 18,
      cgst: 0,
      sgst: 0,
      igst: 18,
      tax: 18,
      lineTotal: 118,
      taxType: "IGST",
    },
  );
  const one = executionPayloadDigest({
    company: 1,
    stock: 31,
    price: 100,
    tax: 18,
  });
  assert.equal(
    one,
    executionPayloadDigest({ tax: 18, price: 100, stock: 31, company: 1 }),
  );
  assert.notEqual(
    one,
    executionPayloadDigest({ company: 1, stock: 31, price: 101, tax: 18 }),
  );
  assert.ok(ReferenceAuthorityError);
});

test("Phase 8F-A2 builds a complete immutable quantity=1 payload without write authority", async () => {
  const resolution =
    await createWebsiteSaleReferenceAuthority(source()).resolveQuantityOne(
      request,
    );
  const input = {
    evidence: {
      companyId: 1,
      branchId: 2,
      executionId: "exec_1",
      websiteOrderId: "order_1",
      billingCommandId: "command_1",
      preparationId: "prep_1",
      authorizationId: "auth_1",
      readinessId: "ready_1",
      preflightId: "preflight_1",
      stagingGateId: "gate_1",
    },
    resolution,
    line: { quantity: 1, unitRate: 100, taxableValue: 100 },
    totals: {
      subtotal: 100,
      tax: 18,
      shipping: 0,
      total: 118,
      currency: "INR",
    },
  };
  const payload = buildQuantityOneExecutionPayload(input);
  assert.equal(payload.executionEnabled, false);
  assert.equal(payload.party.partyId, 11);
  assert.equal(payload.saleItems[0].stockId, 31);
  assert.equal(payload.receivable.amount, 118);
  assert.equal(
    payload.canonicalPayloadDigest,
    buildQuantityOneExecutionPayload(input).canonicalPayloadDigest,
  );
  assert.throws(
    () =>
      buildQuantityOneExecutionPayload({
        ...input,
        line: { ...input.line, invoiceNumber: "caller-controlled" },
      }),
    { code: "PROHIBITED_EXECUTION_INPUT" },
  );
  assert.throws(
    () =>
      buildQuantityOneExecutionPayload({
        ...input,
        totals: { ...input.totals, total: 119 },
      }),
    { code: "AUTHORITATIVE_TOTALS_MISMATCH" },
  );
});

test("Phase 8F-A2 protected schema defines only private reference and tax masters", () => {
  const server = fs.readFileSync("js/backend/server.js", "utf8");
  for (const table of [
    "erp_integration_party_mappings",
    "erp_integration_products",
    "erp_integration_product_mappings",
    "erp_integration_stock_bindings",
    "erp_party_tax_profiles",
    "erp_gst_tax_profiles",
  ])
    assert.match(server, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.doesNotMatch(
    server.slice(
      server.indexOf("erp_integration_party_mappings"),
      server.indexOf("erp_integration_party_mappings") + 6000,
    ),
    /INSERT INTO sales_history|INSERT INTO sales_items|UPDATE stock\s+SET|INSERT INTO transaction_master/i,
  );
});

test("Phase 8F-A4 loads only a bound immutable zero-discount zero-shipping V1 snapshot", () => {
  const binding = { websiteOrderId: "order_1", billingCommandId: "command_1" };
  const durable = {
    billingCommand: { publicId: "command_1" },
    conversion: { commandId: "command_1", state: "DRY_RUN" },
    reservation: { request: { websiteOrderId: "order_1" } },
    fulfilment: {
      request: { websiteOrderId: "order_1" },
      state: "READY_FOR_BILLING",
    },
    websiteOrder: {
      websiteOrderId: "order_1",
      state: "APPROVED",
      snapshot: {
        customer: { publicRef: "party_1" },
        items: [
          {
            productRef: "product_1",
            variantRef: "variant_1",
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
          },
        ],
        priceSnapshot: {
          currency: "INR",
          subtotal: 100,
          discount: 0,
          tax: 18,
          shipping: 0,
          total: 118,
        },
      },
    },
  };
  const loaded = loadV1DurableSnapshot(
    { load: () => structuredClone(durable) },
    binding,
  );
  assert.equal(loaded.item.unitPrice, 100);
  assert.equal(loaded.totals.total, 118);
  assert.throws(
    () =>
      loadV1DurableSnapshot(
        {
          load: () => ({
            ...durable,
            websiteOrder: {
              ...durable.websiteOrder,
              snapshot: {
                ...durable.websiteOrder.snapshot,
                priceSnapshot: {
                  ...durable.websiteOrder.snapshot.priceSnapshot,
                  discount: 1,
                },
              },
            },
          }),
        },
        binding,
      ),
    { code: "DISCOUNT_ALLOCATION_POLICY_REQUIRED" },
  );
});

test("Phase 8F-A5 privately bridges durable V1 evidence to the final non-executable payload", async () => {
  const durable = {
    billingCommand: { publicId: "command_1" },
    conversion: { commandId: "command_1", state: "DRY_RUN" },
    reservation: { request: { websiteOrderId: "order_1" } },
    fulfilment: {
      request: { websiteOrderId: "order_1" },
      state: "READY_FOR_BILLING",
    },
    websiteOrder: {
      websiteOrderId: "order_1",
      state: "APPROVED",
      snapshot: {
        customer: { publicRef: "party_public_1" },
        items: [
          {
            productRef: "prd_1",
            variantRef: "var_1",
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
          },
        ],
        priceSnapshot: {
          currency: "INR",
          subtotal: 100,
          discount: 0,
          tax: 18,
          shipping: 0,
          total: 118,
        },
      },
    },
  };
  const bridge = createV1EvidenceBridge({
    snapshotSource: { load: () => structuredClone(durable) },
    referenceAuthority: createWebsiteSaleReferenceAuthority(source()),
  });
  const evidence = {
    companyId: 1,
    branchId: 2,
    executionId: "exec_1",
    preparationId: "prep_1",
    authorizationId: "auth_1",
    readinessId: "ready_1",
    preflightId: "pre_1",
    stagingGateId: "gate_1",
  };
  const payload = await bridge.assemble({
    binding: { websiteOrderId: "order_1", billingCommandId: "command_1" },
    evidence,
    externalLineRef: "line_1",
  });
  assert.equal(payload.executionEnabled, false);
  assert.equal(payload.receivable.amount, 118);
  assert.equal(payload.saleItems[0].stockId, 31);
  assert.ok(payload.immutableSourceSnapshotDigest);
});
