const LIFECYCLE_STATES = Object.freeze({
  CLAIMABLE: "INERT",
  IN_PROGRESS: "IN_PROGRESS",
  COMMITTED: "COMMITTED",
  ROLLED_BACK: "ROLLED_BACK",
  UNKNOWN_OUTCOME: "UNKNOWN_OUTCOME",
});

class WebsiteSaleExecutionLifecycleError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function assertClaimInput(input) {
  if (
    !input ||
    !Number.isInteger(Number(input.companyId)) ||
    Number(input.companyId) < 1 ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(String(input.externalExecutionId || "")) ||
    !/^[a-f0-9]{64}$/i.test(String(input.canonicalDigest || "")) ||
    !/^[A-Za-z0-9._:-]{16,128}$/.test(String(input.attemptId || "")) ||
    !Number.isInteger(input.leaseMs) ||
    input.leaseMs < 1_000 ||
    input.leaseMs > 15 * 60 * 1_000
  ) {
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_CLAIM_INVALID",
      "Execution claim is invalid",
      422,
    );
  }
}

function normalize(row) {
  if (!row) return null;
  return Object.freeze({
    identityId: Number(row.id),
    companyId: Number(row.company_id),
    branchId: row.branch_id == null ? null : Number(row.branch_id),
    externalExecutionId: row.external_execution_id,
    websiteOrderId: row.external_website_order_id,
    canonicalDigest: row.canonical_digest,
    state: row.execution_state,
    attemptId: row.execution_attempt_id ?? null,
    leaseExpiresAt: row.execution_lease_expires_at ?? null,
    startedAt: row.execution_started_at ?? null,
    completedAt: row.execution_completed_at ?? null,
    saleId: row.sale_id ?? null,
    invoiceNumber: row.invoice_number ?? null,
    resultDigest: row.result_digest ?? null,
    failureCode: row.failure_code ?? null,
    reconciledAt: row.last_reconciled_at ?? null,
  });
}

async function claimWebsiteSaleExecution(connection, input, now = new Date()) {
  assertClaimInput(input);
  const [rows] = await connection.query(
    `SELECT id, company_id, branch_id, external_execution_id, external_website_order_id, canonical_digest,
            execution_state, execution_attempt_id, execution_lease_expires_at, execution_started_at,
            execution_completed_at, sale_id, invoice_number, result_digest, failure_code, last_reconciled_at
     FROM website_sale_execution_identities
     WHERE company_id = ? AND source = 'WEBSITE' AND external_execution_id = ?
     FOR UPDATE`,
    [Number(input.companyId), String(input.externalExecutionId)],
  );
  const current = rows[0];
  if (!current)
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_IDENTITY_NOT_FOUND",
      "Execution identity not found",
      404,
    );
  if (current.canonical_digest !== input.canonicalDigest) {
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_IDENTITY_CONFLICT",
      "Execution digest conflict",
    );
  }
  if (current.execution_state === LIFECYCLE_STATES.COMMITTED) {
    return Object.freeze({
      action: "RECONCILE_COMMITTED",
      record: normalize(current),
    });
  }
  if (current.execution_state === LIFECYCLE_STATES.UNKNOWN_OUTCOME) {
    return Object.freeze({
      action: "RECONCILIATION_REQUIRED",
      record: normalize(current),
    });
  }
  if (current.execution_state === LIFECYCLE_STATES.IN_PROGRESS) {
    const expiresAt = current.execution_lease_expires_at
      ? new Date(current.execution_lease_expires_at).getTime()
      : 0;
    return Object.freeze({
      action:
        expiresAt > now.getTime() ? "IN_PROGRESS" : "RECONCILIATION_REQUIRED",
      record: normalize(current),
    });
  }
  if (
    ![LIFECYCLE_STATES.CLAIMABLE, LIFECYCLE_STATES.ROLLED_BACK].includes(
      current.execution_state,
    )
  ) {
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_LIFECYCLE_INVALID",
      "Execution lifecycle state is invalid",
    );
  }
  const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
  await connection.query(
    `UPDATE website_sale_execution_identities
     SET execution_state = 'IN_PROGRESS', execution_attempt_id = ?, execution_lease_expires_at = ?,
         execution_started_at = ?, execution_completed_at = NULL, failure_code = NULL
     WHERE id = ?`,
    [input.attemptId, leaseExpiresAt, now, current.id],
  );
  return Object.freeze({
    action: "CLAIMED",
    record: normalize({
      ...current,
      execution_state: "IN_PROGRESS",
      execution_attempt_id: input.attemptId,
      execution_lease_expires_at: leaseExpiresAt,
      execution_started_at: now,
      execution_completed_at: null,
      failure_code: null,
    }),
  });
}

async function markWebsiteSaleExecutionCommitted(
  connection,
  input,
  now = new Date(),
) {
  if (
    !input ||
    !Number.isInteger(Number(input.identityId)) ||
    Number(input.identityId) < 1 ||
    !/^[A-Za-z0-9._:-]{16,128}$/.test(String(input.attemptId || "")) ||
    !/^[a-f0-9]{64}$/i.test(String(input.resultDigest || ""))
  ) {
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_RESULT_INVALID",
      "Execution result is invalid",
      422,
    );
  }
  const [result] = await connection.query(
    `UPDATE website_sale_execution_identities
     SET execution_state = 'COMMITTED', sale_id = ?, invoice_number = ?, result_digest = ?,
         execution_completed_at = ?, execution_lease_expires_at = NULL, failure_code = NULL
     WHERE id = ? AND execution_state = 'IN_PROGRESS' AND execution_attempt_id = ?`,
    [
      input.saleId ?? null,
      input.invoiceNumber ?? null,
      input.resultDigest,
      now,
      Number(input.identityId),
      input.attemptId,
    ],
  );
  if (Number(result.affectedRows) !== 1)
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_RESULT_CONFLICT",
      "Execution result cannot be committed",
    );
}

async function markWebsiteSaleExecutionRolledBack(
  connection,
  input,
  now = new Date(),
) {
  const [result] = await connection.query(
    `UPDATE website_sale_execution_identities
     SET execution_state = 'ROLLED_BACK', execution_completed_at = ?, execution_lease_expires_at = NULL,
         failure_code = ?, sale_id = NULL, invoice_number = NULL, result_digest = NULL
     WHERE id = ? AND execution_state = 'IN_PROGRESS' AND execution_attempt_id = ?`,
    [
      now,
      String(input.failureCode || "ROLLED_BACK").slice(0, 96),
      Number(input.identityId),
      input.attemptId,
    ],
  );
  if (Number(result.affectedRows) !== 1)
    throw new WebsiteSaleExecutionLifecycleError(
      "WEBSITE_SALE_RESULT_CONFLICT",
      "Execution rollback cannot be recorded",
    );
}

async function reconcileWebsiteSaleExecution(
  connection,
  companyId,
  externalExecutionId,
  now = new Date(),
) {
  const [rows] = await connection.query(
    `SELECT id, company_id, branch_id, external_execution_id, external_website_order_id, canonical_digest,
            execution_state, execution_attempt_id, execution_lease_expires_at, execution_started_at,
            execution_completed_at, sale_id, invoice_number, result_digest, failure_code, last_reconciled_at
     FROM website_sale_execution_identities
     WHERE company_id = ? AND source = 'WEBSITE' AND external_execution_id = ?`,
    [Number(companyId), String(externalExecutionId)],
  );
  if (!rows[0]) return null;
  await connection.query(
    "UPDATE website_sale_execution_identities SET last_reconciled_at = ? WHERE id = ?",
    [now, rows[0].id],
  );
  return normalize({ ...rows[0], last_reconciled_at: now });
}

module.exports = {
  LIFECYCLE_STATES,
  WebsiteSaleExecutionLifecycleError,
  claimWebsiteSaleExecution,
  markWebsiteSaleExecutionCommitted,
  markWebsiteSaleExecutionRolledBack,
  reconcileWebsiteSaleExecution,
};
