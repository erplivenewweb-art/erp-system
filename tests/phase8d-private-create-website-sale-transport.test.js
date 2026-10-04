const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createWebsiteSaleDigest } = require("../js/backend/createWebsiteSale");
const {
  VALIDATE_OPERATION,
  RECONCILE_OPERATION,
  PrivateCreateWebsiteSaleError,
  createPrivateCreateWebsiteSaleTransport,
  createWebsiteSaleTransportBindingDigest,
  issuePrivateCreateWebsiteSaleAssertion,
  parseValidationRequest,
} = require("../js/backend/privateCreateWebsiteSaleTransport");

const secret = "v".repeat(32);
const now = 1_000_000;
const command = {
  externalExecutionId: "phase8d-execution-0001",
  websiteOrderId: "phase8d-order-0001",
  companyId: 7,
  branchId: 11,
  partyReference: "party-phase8d",
  currency: "INR",
  authoritativeDigest: "a".repeat(64),
  items: [
    {
      mappingReference: "item-phase8d",
      quantity: 1,
      snapshotDigest: "b".repeat(64),
    },
  ],
};
const commandDigest = createWebsiteSaleDigest(command);
const payload = {
  command,
  evidence: {
    billingCommandId: "billing-command-1",
    preparationId: "preparation-1",
    authorizationId: "authorization-1",
    readinessId: "readiness-1",
    preflightId: "preflight-1",
    stagingGateId: "staging-gate-1",
    fulfilmentId: "fulfilment-1",
    orderId: command.websiteOrderId,
    reservationId: "reservation-1",
    externalExecutionId: command.externalExecutionId,
    companyId: command.companyId,
    branchId: command.branchId,
    commandDigest,
  },
};
const parsed = parseValidationRequest(payload);

function config(overrides = {}) {
  return {
    environment: "development",
    enabled: true,
    secret,
    issuer: "commerce-adapter",
    audience: "erp-create-website-sale",
    keyId: "create-website-sale-validate-v1",
    ttlMs: 60_000,
    clockSkewMs: 30_000,
    ...overrides,
  };
}

function assertion(
  operation,
  requestId,
  companyId,
  branchId,
  bindingDigest,
  nonce = "n".repeat(16),
) {
  return issuePrivateCreateWebsiteSaleAssertion(
    {
      issuer: "commerce-adapter",
      audience: "erp-create-website-sale",
      keyId: "create-website-sale-validate-v1",
      operation,
      requestId,
      companyId,
      branchId,
      bindingDigest,
      issuedAt: now - 1_000,
      expiresAt: now + 30_000,
      nonce,
    },
    secret,
  );
}

function identity(overrides = {}) {
  return {
    company_id: 7,
    source: "WEBSITE",
    external_execution_id: command.externalExecutionId,
    external_website_order_id: command.websiteOrderId,
    canonical_digest: parsed.commandDigest,
    execution_state: "INERT",
    sale_id: null,
    invoice_number: null,
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

function repository(existing = identity()) {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    async findByExecution(companyId, executionId) {
      reads += 1;
      return companyId === 7 && executionId === command.externalExecutionId
        ? existing
        : null;
    },
    async findByWebsiteOrder(companyId, orderId) {
      reads += 1;
      return companyId === 7 && orderId === command.websiteOrderId
        ? existing
        : null;
    },
  };
}

test("private CreateWebsiteSale validation is authenticated, evidence-bound, replay-safe, and non-executing", async () => {
  const identities = repository();
  const transport = createPrivateCreateWebsiteSaleTransport({
    config: config(),
    identities,
    now: () => now,
  });
  const requestId = "phase8d-request-0001";
  const result = await transport.validate({
    assertion: assertion(
      VALIDATE_OPERATION,
      requestId,
      7,
      11,
      parsed.commandDigest,
    ),
    requestId,
    origin: "",
    payload,
  });
  assert.equal(result.outcome, "REPLAY");
  assert.equal(result.state, "NOT_EXECUTED");
  assert.equal(result.identity.saleId, null);
  assert.equal(result.identity.invoiceNumber, null);
  assert.equal(identities.reads, 1);

  const replayRequestId = "phase8d-request-0002";
  const replay = await transport.validate({
    assertion: assertion(
      VALIDATE_OPERATION,
      replayRequestId,
      7,
      11,
      parsed.commandDigest,
      "o".repeat(16),
    ),
    requestId: replayRequestId,
    origin: "",
    payload,
  });
  assert.deepEqual(replay.identity, result.identity);
  assert.equal(identities.reads, 2);
});

test("private CreateWebsiteSale transport rejects browser, authentication, scope, identity and prohibited-field attacks", async () => {
  const transport = createPrivateCreateWebsiteSaleTransport({
    config: config(),
    identities: repository(),
    now: () => now,
  });
  const requestId = "phase8d-request-0003";
  await assert.rejects(
    transport.validate({
      assertion: undefined,
      requestId,
      origin: "",
      payload,
    }),
    (error) =>
      error instanceof PrivateCreateWebsiteSaleError &&
      error.code === "CREATE_WEBSITE_SALE_AUTH_REQUIRED",
  );
  await assert.rejects(
    transport.validate({
      assertion: assertion(
        RECONCILE_OPERATION,
        requestId,
        7,
        11,
        parsed.commandDigest,
      ),
      requestId,
      origin: "",
      payload,
    }),
    /Private authentication invalid/,
  );
  await assert.rejects(
    transport.validate({
      assertion: assertion(
        VALIDATE_OPERATION,
        requestId,
        7,
        12,
        parsed.commandDigest,
      ),
      requestId,
      origin: "",
      payload,
    }),
    /Private authentication invalid/,
  );
  await assert.rejects(
    transport.validate({
      assertion: assertion(
        VALIDATE_OPERATION,
        requestId,
        7,
        11,
        parsed.commandDigest,
      ),
      requestId,
      origin: "https://storefront.invalid",
      payload,
    }),
    /Browser access is not permitted/,
  );
  await assert.rejects(
    transport.validate({
      assertion: assertion(
        VALIDATE_OPERATION,
        requestId,
        7,
        11,
        parsed.commandDigest,
      ),
      requestId,
      origin: "",
      payload: {
        ...payload,
        command: { ...command, invoiceNumber: "forbidden" },
      },
    }),
    /prohibited/,
  );
  await assert.rejects(
    transport.validate({
      assertion: assertion(
        VALIDATE_OPERATION,
        requestId,
        7,
        11,
        parsed.commandDigest,
      ),
      requestId,
      origin: "",
      payload: {
        ...payload,
        command: { ...command, paymentAllocation: "forbidden" },
      },
    }),
    /prohibited/,
  );
});

test("identity preconditions, conflicts and read-back preserve the Phase 8C uniqueness contract", async () => {
  const missing = createPrivateCreateWebsiteSaleTransport({
    config: config(),
    identities: repository(null),
    now: () => now,
  });
  const missingId = "phase8d-request-0004";
  const precondition = await missing.validate({
    assertion: assertion(
      VALIDATE_OPERATION,
      missingId,
      7,
      11,
      parsed.commandDigest,
    ),
    requestId: missingId,
    origin: "",
    payload,
  });
  assert.deepEqual(precondition, {
    outcome: "PRECONDITION_REQUIRED",
    state: "NOT_EXECUTED",
    identity: null,
    evidence: parsed.evidence,
  });

  const conflict = createPrivateCreateWebsiteSaleTransport({
    config: config(),
    identities: repository(identity({ canonical_digest: "c".repeat(64) })),
    now: () => now,
  });
  const conflictId = "phase8d-request-0005";
  await assert.rejects(
    conflict.validate({
      assertion: assertion(
        VALIDATE_OPERATION,
        conflictId,
        7,
        11,
        parsed.commandDigest,
      ),
      requestId: conflictId,
      origin: "",
      payload,
    }),
    /Execution identity conflict/,
  );

  const identities = repository();
  const readBack = createPrivateCreateWebsiteSaleTransport({
    config: config(),
    identities,
    now: () => now,
  });
  const query = {
    companyId: 7,
    branchId: 11,
    externalExecutionId: command.externalExecutionId,
  };
  const reconciliationId = "phase8d-request-0006";
  const reconciliation = await readBack.reconcile({
    assertion: assertion(
      RECONCILE_OPERATION,
      reconciliationId,
      7,
      11,
      createWebsiteSaleTransportBindingDigest(query),
    ),
    requestId: reconciliationId,
    origin: "",
    payload: query,
  });
  assert.equal(reconciliation.outcome, "FOUND");
  assert.equal(reconciliation.identity.saleId, null);
  assert.equal(reconciliation.identity.invoiceNumber, null);
});

test("production is denied and the registered ERP boundary is read-only validation/reconciliation", async () => {
  const denied = createPrivateCreateWebsiteSaleTransport({
    config: config({ environment: "production" }),
    identities: repository(),
    now: () => now,
  });
  await assert.rejects(
    denied.validate({
      assertion: "irrelevant",
      requestId: "phase8d-request-0007",
      origin: "",
      payload,
    }),
    /unavailable/,
  );
  const server = fs.readFileSync(
    path.join(__dirname, "..", "js", "backend", "server.js"),
    "utf8",
  );
  assert.match(
    server,
    /\/internal\/integration\/create-website-sale\/validate/,
  );
  assert.match(
    server,
    /\/internal\/integration\/create-website-sale\/reconciliation/,
  );
  const transport = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "js",
      "backend",
      "privateCreateWebsiteSaleTransport.js",
    ),
    "utf8",
  );
  assert.doesNotMatch(
    transport,
    /INSERT\s+INTO|UPDATE\s+sales_history|saveBilling|generateInvoiceNumberForCompany|postBillingToTransactionFoundation/,
  );
});
