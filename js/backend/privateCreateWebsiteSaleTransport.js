const crypto = require("crypto");
const {
  canonicalizeCreateWebsiteSale,
  createWebsiteSaleDigest,
} = require("./createWebsiteSale");

const VALIDATE_OPERATION = "CREATE_WEBSITE_SALE_VALIDATE";
const RECONCILE_OPERATION = "CREATE_WEBSITE_SALE_RECONCILE";
const PRIVATE_OPERATIONS = new Set([VALIDATE_OPERATION, RECONCILE_OPERATION]);
const REQUIRED_EVIDENCE = [
  "billingCommandId",
  "preparationId",
  "authorizationId",
  "readinessId",
  "preflightId",
  "stagingGateId",
  "fulfilmentId",
  "orderId",
  "reservationId",
];

class PrivateCreateWebsiteSaleError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function sign(secret, encoded) {
  return crypto.createHmac("sha256", secret).update(encoded).digest("hex");
}

function sameSignature(expected, supplied) {
  if (!/^[a-f0-9]{64}$/i.test(String(supplied || ""))) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(supplied, "hex"),
  );
}

function assertNonProduction(config) {
  if (
    String(config.environment || "").toLowerCase() === "production" ||
    config.enabled !== true
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_TRANSPORT_DISABLED",
      "CreateWebsiteSale private validation is unavailable",
      503,
    );
  }
  if (typeof config.secret !== "string" || config.secret.length < 32) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_TRANSPORT_UNCONFIGURED",
      "CreateWebsiteSale private validation is unavailable",
      503,
    );
  }
}

function canonicalizeEvidence(evidence, command, commandDigest) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_EVIDENCE_INVALID",
      "Evidence is invalid",
      422,
    );
  }
  for (const key of REQUIRED_EVIDENCE) {
    if (typeof evidence[key] !== "string" || !evidence[key].trim()) {
      throw new PrivateCreateWebsiteSaleError(
        "CREATE_WEBSITE_SALE_EVIDENCE_INVALID",
        "Evidence is incomplete",
        422,
      );
    }
  }
  if (
    evidence.orderId !== command.websiteOrderId ||
    evidence.externalExecutionId !== command.externalExecutionId ||
    evidence.companyId !== command.companyId ||
    evidence.branchId !== command.branchId ||
    evidence.commandDigest !== commandDigest
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_EVIDENCE_MISMATCH",
      "Evidence binding mismatch",
      409,
    );
  }
  return Object.freeze({
    ...Object.fromEntries(
      REQUIRED_EVIDENCE.map((key) => [key, evidence[key].trim()]),
    ),
    externalExecutionId: command.externalExecutionId,
    companyId: command.companyId,
    branchId: command.branchId,
    commandDigest,
  });
}

function parseValidationRequest(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !payload.command
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_REQUEST_INVALID",
      "Validation request is invalid",
      422,
    );
  }
  const command = canonicalizeCreateWebsiteSale(payload.command);
  const commandDigest = createWebsiteSaleDigest(command);
  const evidence = canonicalizeEvidence(
    payload.evidence,
    command,
    commandDigest,
  );
  return Object.freeze({ command, commandDigest, evidence });
}

function parseReconciliationRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_RECONCILIATION_INVALID",
      "Reconciliation request is invalid",
      422,
    );
  }
  const companyId = Number(payload.companyId);
  const branchId = Number(payload.branchId);
  const externalExecutionId =
    typeof payload.externalExecutionId === "string"
      ? payload.externalExecutionId.trim()
      : "";
  const websiteOrderId =
    typeof payload.websiteOrderId === "string"
      ? payload.websiteOrderId.trim()
      : "";
  if (
    !Number.isInteger(companyId) ||
    companyId < 1 ||
    !Number.isInteger(branchId) ||
    branchId < 1
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_RECONCILIATION_INVALID",
      "Reconciliation scope is invalid",
      422,
    );
  }
  if (
    (externalExecutionId && websiteOrderId) ||
    (!externalExecutionId && !websiteOrderId)
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_RECONCILIATION_INVALID",
      "Exactly one reconciliation reference is required",
      422,
    );
  }
  return Object.freeze({
    companyId,
    branchId,
    ...(externalExecutionId ? { externalExecutionId } : { websiteOrderId }),
  });
}

function issuePrivateCreateWebsiteSaleAssertion(payload, secret) {
  if (!payload || !PRIVATE_OPERATIONS.has(payload.operation))
    throw new Error("Private operation is invalid");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(secret, encoded)}`;
}

function authenticatePrivateCreateWebsiteSaleAssertion(
  assertion,
  expected,
  config,
  seenNonces,
  now = Date.now(),
) {
  assertNonProduction(config);
  if (!assertion)
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_AUTH_REQUIRED",
      "Private authentication required",
      401,
    );
  const [encoded, supplied, extra] = String(assertion).split(".");
  if (
    !encoded ||
    !supplied ||
    extra ||
    !sameSignature(sign(config.secret, encoded), supplied)
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_AUTH_INVALID",
      "Private authentication invalid",
      401,
    );
  }
  let claim;
  try {
    claim = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_AUTH_INVALID",
      "Private authentication invalid",
      401,
    );
  }
  const keys = [
    "issuer",
    "audience",
    "keyId",
    "operation",
    "requestId",
    "companyId",
    "branchId",
    "bindingDigest",
    "issuedAt",
    "expiresAt",
    "nonce",
  ];
  if (
    !claim ||
    typeof claim !== "object" ||
    Object.keys(claim).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in claim)) ||
    !PRIVATE_OPERATIONS.has(claim.operation) ||
    claim.operation !== expected.operation ||
    claim.requestId !== expected.requestId ||
    claim.companyId !== expected.companyId ||
    claim.branchId !== expected.branchId ||
    claim.bindingDigest !== expected.bindingDigest ||
    claim.issuer !== config.issuer ||
    claim.audience !== config.audience ||
    claim.keyId !== config.keyId ||
    !/^[A-Za-z0-9_-]{16,64}$/.test(String(claim.nonce || "")) ||
    !Number.isSafeInteger(claim.issuedAt) ||
    !Number.isSafeInteger(claim.expiresAt) ||
    claim.issuedAt > now + config.clockSkewMs ||
    claim.expiresAt <= now ||
    claim.expiresAt - claim.issuedAt > config.ttlMs
  ) {
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_AUTH_INVALID",
      "Private authentication invalid",
      401,
    );
  }
  for (const [nonce, expiresAt] of seenNonces)
    if (expiresAt <= now) seenNonces.delete(nonce);
  if (seenNonces.has(claim.nonce))
    throw new PrivateCreateWebsiteSaleError(
      "CREATE_WEBSITE_SALE_AUTH_REPLAY",
      "Private authentication replay rejected",
      409,
    );
  seenNonces.set(claim.nonce, claim.expiresAt);
  return Object.freeze({
    operation: claim.operation,
    companyId: claim.companyId,
    branchId: claim.branchId,
    credentialKeyId: claim.keyId,
  });
}

function publicIdentity(record) {
  if (!record) return null;
  return Object.freeze({
    companyId: Number(record.company_id),
    branchId: record.branch_id == null ? null : Number(record.branch_id),
    source: record.source,
    externalExecutionId: record.external_execution_id,
    websiteOrderId: record.external_website_order_id,
    canonicalDigest: record.canonical_digest,
    state: record.execution_state,
    attemptId: record.execution_attempt_id ?? null,
    leaseExpiresAt: record.execution_lease_expires_at ?? null,
    startedAt: record.execution_started_at ?? null,
    completedAt: record.execution_completed_at ?? null,
    saleId: record.sale_id ?? null,
    invoiceNumber: record.invoice_number ?? null,
    resultDigest: record.result_digest ?? null,
    failureCode: record.failure_code ?? null,
    lastReconciledAt: record.last_reconciled_at ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  });
}

function createPrivateCreateWebsiteSaleTransport({
  config,
  identities,
  now = Date.now,
}) {
  const seenNonces = new Map();
  const authenticate = (assertion, expected) =>
    authenticatePrivateCreateWebsiteSaleAssertion(
      assertion,
      expected,
      config,
      seenNonces,
      now(),
    );
  return {
    async validate({ assertion, requestId, origin, payload }) {
      if (origin)
        throw new PrivateCreateWebsiteSaleError(
          "BROWSER_ACCESS_DENIED",
          "Browser access is not permitted",
          403,
        );
      const request = parseValidationRequest(payload);
      authenticate(assertion, {
        operation: VALIDATE_OPERATION,
        requestId,
        companyId: request.command.companyId,
        branchId: request.command.branchId,
        bindingDigest: request.commandDigest,
      });
      const existing = await identities.findByExecution(
        request.command.companyId,
        request.command.externalExecutionId,
      );
      if (!existing) {
        const byOrder = await identities.findByWebsiteOrder(
          request.command.companyId,
          request.command.websiteOrderId,
        );
        if (byOrder)
          throw new PrivateCreateWebsiteSaleError(
            "CREATE_WEBSITE_SALE_ORDER_CONFLICT",
            "Website order identity conflict",
            409,
          );
        return Object.freeze({
          outcome: "PRECONDITION_REQUIRED",
          state: "NOT_EXECUTED",
          identity: null,
          evidence: request.evidence,
        });
      }
      if (
        existing.external_website_order_id !== request.command.websiteOrderId ||
        existing.canonical_digest !== request.commandDigest
      ) {
        throw new PrivateCreateWebsiteSaleError(
          "CREATE_WEBSITE_SALE_IDENTITY_CONFLICT",
          "Execution identity conflict",
          409,
        );
      }
      return Object.freeze({
        outcome: "REPLAY",
        state: "NOT_EXECUTED",
        identity: publicIdentity(existing),
        evidence: request.evidence,
      });
    },
    async reconcile({ assertion, requestId, origin, payload }) {
      if (origin)
        throw new PrivateCreateWebsiteSaleError(
          "BROWSER_ACCESS_DENIED",
          "Browser access is not permitted",
          403,
        );
      const query = parseReconciliationRequest(payload);
      const bindingDigest = digest(query);
      authenticate(assertion, {
        operation: RECONCILE_OPERATION,
        requestId,
        companyId: query.companyId,
        branchId: query.branchId,
        bindingDigest,
      });
      const record = query.externalExecutionId
        ? await identities.findByExecution(
            query.companyId,
            query.externalExecutionId,
          )
        : await identities.findByWebsiteOrder(
            query.companyId,
            query.websiteOrderId,
          );
      return Object.freeze({
        outcome: record ? "FOUND" : "NOT_FOUND",
        state: record ? "NOT_EXECUTED" : "NOT_EXECUTED",
        identity: publicIdentity(record),
      });
    },
  };
}

module.exports = {
  VALIDATE_OPERATION,
  RECONCILE_OPERATION,
  PrivateCreateWebsiteSaleError,
  createPrivateCreateWebsiteSaleTransport,
  createWebsiteSaleTransportBindingDigest: digest,
  issuePrivateCreateWebsiteSaleAssertion,
  parseValidationRequest,
  parseReconciliationRequest,
};
