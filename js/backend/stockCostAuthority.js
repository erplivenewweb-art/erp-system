"use strict";

// Phase 8F-A10A configuration/accounting authority only.  This module has no
// dependency on sale, invoice, payment, or stock lifecycle mutation code.
const crypto = require("crypto");
const COMPONENT_FIELDS = [
  "materialCost",
  "makingCost",
  "processingCost",
  "hallmarkCost",
  "otherDirectCost",
];
const ALLOWED_AUTHORITY_TYPES = new Set([
  "OWNER_PROVISIONED_LEGACY_COST",
  "COMPONENT_BACKED_DIRECT_COST",
]);

class StockCostError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function digest(value) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}
function moneyToMinor(value, field) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new StockCostError(
      "COST_AMOUNT_INVALID",
      `${field} must be a non-negative two-decimal amount`,
    );
  const [whole, fraction = ""] = text.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new StockCostError(
      "COST_AMOUNT_INVALID",
      `${field} is outside the supported range`,
    );
  return Number(minor);
}
function minorToMoney(minor) {
  return (Number(minor) / 100).toFixed(2);
}
function normalizeCurrency(value) {
  const currency = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    throw new StockCostError(
      "COST_CURRENCY_INVALID",
      "Currency must be an ISO-style three-letter code",
    );
  return currency;
}
function normalizeRole(actor) {
  const role = String(actor?.role || "")
    .trim()
    .toUpperCase();
  if (role === "SUPERADMIN")
    throw new StockCostError(
      "COST_SUPERADMIN_MUTATION_DENIED",
      "SUPERADMIN is read-only for stock-cost authority",
    );
  if (role !== "OWNER" && role !== "ADMIN")
    throw new StockCostError(
      "COST_AUTHORIZATION_DENIED",
      "Only OWNER or Admin may provision stock cost",
    );
  if (
    !Number.isInteger(Number(actor?.id)) ||
    !Number.isInteger(Number(actor?.companyId))
  )
    throw new StockCostError(
      "COST_AUTHORIZATION_DENIED",
      "Provisioning actor is not company-scoped",
    );
  return { id: Number(actor.id), companyId: Number(actor.companyId), role };
}

function canonicalAuthorityInput(
  input,
  { companyId, barcode, version, supersedesId = null },
) {
  const totalMinor = moneyToMinor(input.totalCompanyCost, "totalCompanyCost");
  const components = Object.fromEntries(
    COMPONENT_FIELDS.map((field) => [
      field,
      moneyToMinor(input[field] ?? "0", field),
    ]),
  );
  const componentMinor = Object.values(components).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const hasComponents = componentMinor > 0;
  if (hasComponents && componentMinor !== totalMinor)
    throw new StockCostError(
      "COST_COMPONENT_TOTAL_MISMATCH",
      "Component costs must equal total company cost exactly",
    );
  const reason = String(input.reason || "").trim();
  if (!reason)
    throw new StockCostError(
      "COST_REASON_REQUIRED",
      "Provisioning reason is required",
    );
  const authorityType = String(
    input.authorityType ||
      (hasComponents
        ? "COMPONENT_BACKED_DIRECT_COST"
        : "OWNER_PROVISIONED_LEGACY_COST"),
  )
    .trim()
    .toUpperCase();
  if (!ALLOWED_AUTHORITY_TYPES.has(authorityType))
    throw new StockCostError(
      "COST_AUTHORITY_TYPE_INVALID",
      "Cost authority type is not supported",
    );
  if (authorityType === "COMPONENT_BACKED_DIRECT_COST" && !hasComponents)
    throw new StockCostError(
      "COST_COMPONENTS_REQUIRED",
      "Component-backed cost requires authoritative components",
    );
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey || idempotencyKey.length > 128)
    throw new StockCostError(
      "COST_IDEMPOTENCY_KEY_INVALID",
      "A bounded idempotency key is required",
    );
  const authority = {
    companyId: Number(companyId),
    stockId: Number(input.stockId),
    barcode: String(barcode || ""),
    currency: normalizeCurrency(input.currency),
    totalCompanyCost: minorToMoney(totalMinor),
    components: Object.fromEntries(
      Object.entries(components).map(([key, amount]) => [
        key,
        minorToMoney(amount),
      ]),
    ),
    authorityType,
    sourceReference: String(input.sourceReference || "").trim() || null,
    reason,
    version: Number(version),
    supersedesId: supersedesId === null ? null : Number(supersedesId),
  };
  return {
    ...authority,
    idempotencyKey,
    requestDigest: digest({ ...authority, idempotencyKey }),
    evidenceDigest: digest(authority),
  };
}

async function ensureStockCostBasisSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS stock_cost_bases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, stock_id INT NOT NULL, barcode VARCHAR(255) NOT NULL DEFAULT '', currency CHAR(3) NOT NULL,
    total_company_cost DECIMAL(14,2) NOT NULL, material_cost DECIMAL(14,2) DEFAULT NULL, making_cost DECIMAL(14,2) DEFAULT NULL, processing_cost DECIMAL(14,2) DEFAULT NULL, hallmark_cost DECIMAL(14,2) DEFAULT NULL, other_direct_cost DECIMAL(14,2) DEFAULT NULL,
    authority_type VARCHAR(64) NOT NULL, source_reference VARCHAR(255) DEFAULT NULL, provisioning_reason TEXT NOT NULL, idempotency_key VARCHAR(128) NOT NULL, request_digest CHAR(64) NOT NULL, evidence_digest CHAR(64) NOT NULL,
    version INT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', active_stock_key INT DEFAULT NULL, supersedes_id BIGINT DEFAULT NULL, created_by INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, superseded_by INT DEFAULT NULL, superseded_at DATETIME DEFAULT NULL,
    UNIQUE KEY uq_stock_cost_basis_request (company_id, stock_id, idempotency_key), UNIQUE KEY uq_stock_cost_basis_active (company_id, active_stock_key), UNIQUE KEY uq_stock_cost_basis_version (company_id, stock_id, version), INDEX idx_stock_cost_basis_resolve (company_id, stock_id, status)
  )`);
}

function mapRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    stockId: Number(row.stock_id),
    barcode: row.barcode,
    currency: row.currency,
    totalCompanyCost: String(row.total_company_cost),
    materialCost: row.material_cost === null ? null : String(row.material_cost),
    makingCost: row.making_cost === null ? null : String(row.making_cost),
    processingCost:
      row.processing_cost === null ? null : String(row.processing_cost),
    hallmarkCost: row.hallmark_cost === null ? null : String(row.hallmark_cost),
    otherDirectCost:
      row.other_direct_cost === null ? null : String(row.other_direct_cost),
    authorityType: row.authority_type,
    sourceReference: row.source_reference,
    reason: row.provisioning_reason,
    idempotencyKey: row.idempotency_key,
    requestDigest: row.request_digest,
    evidenceDigest: row.evidence_digest,
    version: Number(row.version),
    status: row.status,
    supersedesId: row.supersedes_id === null ? null : Number(row.supersedes_id),
    createdBy: Number(row.created_by),
    createdAt: row.created_at,
  };
}

function createMysqlStockCostAuthority(pool) {
  async function withTransaction(work) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (_) {}
      throw error;
    } finally {
      connection.release();
    }
  }
  async function loadStock(connection, companyId, stockId) {
    const [rows] = await connection.query(
      "SELECT id, company_id, barcode FROM stock WHERE id = ? FOR UPDATE",
      [stockId],
    );
    const stock = rows[0];
    if (!stock || Number(stock.company_id) !== Number(companyId))
      throw new StockCostError(
        "COST_STOCK_COMPANY_MISMATCH",
        "Stock does not belong to the requested company",
      );
    return stock;
  }
  async function write(input, actor, supersede) {
    const normalizedActor = normalizeRole(actor);
    return withTransaction(async (connection) => {
      const stock = await loadStock(
        connection,
        normalizedActor.companyId,
        Number(input.stockId),
      );
      const [activeRows] = await connection.query(
        "SELECT * FROM stock_cost_bases WHERE company_id=? AND stock_id=? AND status='ACTIVE' FOR UPDATE",
        [normalizedActor.companyId, Number(input.stockId)],
      );
      if (activeRows.length > 1)
        throw new StockCostError(
          "COST_BASIS_AMBIGUOUS",
          "Multiple active exact-stock cost bases are unsafe",
        );
      if (supersede && !activeRows.length)
        throw new StockCostError(
          "COST_BASIS_REQUIRED",
          "An active exact-stock cost basis is required for supersession",
        );
      const old = activeRows.length ? mapRecord(activeRows[0]) : null;
      const base = canonicalAuthorityInput(input, {
        companyId: normalizedActor.companyId,
        barcode: stock.barcode,
        version: supersede && old ? old.version + 1 : 1,
        supersedesId: supersede && old ? old.id : null,
      });
      const [sameRequestRows] = await connection.query(
        "SELECT * FROM stock_cost_bases WHERE company_id=? AND stock_id=? AND idempotency_key=? FOR UPDATE",
        [base.companyId, base.stockId, base.idempotencyKey],
      );
      if (sameRequestRows.length) {
        const prior = mapRecord(sameRequestRows[0]);
        if (prior.requestDigest !== base.requestDigest)
          throw new StockCostError(
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key was reused with changed authority facts",
          );
        return prior;
      }
      if (!supersede && old)
        throw new StockCostError(
          "ACTIVE_COST_ALREADY_EXISTS",
          "An active exact-stock cost basis already exists",
        );
      if (old)
        await connection.query(
          "UPDATE stock_cost_bases SET status='SUPERSEDED', active_stock_key=NULL, superseded_at=NOW() WHERE id=?",
          [old.id],
        );
      const [result] = await connection.query(
        `INSERT INTO stock_cost_bases (company_id,stock_id,barcode,currency,total_company_cost,material_cost,making_cost,processing_cost,hallmark_cost,other_direct_cost,authority_type,source_reference,provisioning_reason,idempotency_key,request_digest,evidence_digest,version,status,active_stock_key,supersedes_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?)`,
        [
          base.companyId,
          base.stockId,
          base.barcode,
          base.currency,
          base.totalCompanyCost,
          ...COMPONENT_FIELDS.map((field) =>
            base.components[field] === "0.00" ? null : base.components[field],
          ),
          base.authorityType,
          base.sourceReference,
          base.reason,
          base.idempotencyKey,
          base.requestDigest,
          base.evidenceDigest,
          base.version,
          base.stockId,
          old?.id ?? null,
          normalizedActor.id,
        ],
      );
      if (old)
        await connection.query(
          "UPDATE stock_cost_bases SET superseded_by=? WHERE id=?",
          [result.insertId, old.id],
        );
      const [rows] = await connection.query(
        "SELECT * FROM stock_cost_bases WHERE id=?",
        [result.insertId],
      );
      return mapRecord(rows[0]);
    });
  }
  async function resolveAuthoritativeStockCost(companyId, stockId) {
    const connection = await pool.getConnection();
    try {
      const stock = await loadStock(
        connection,
        Number(companyId),
        Number(stockId),
      );
      const [rows] = await connection.query(
        "SELECT * FROM stock_cost_bases WHERE company_id=? AND stock_id=? AND status='ACTIVE'",
        [companyId, stockId],
      );
      if (!rows.length)
        throw new StockCostError(
          "COST_BASIS_REQUIRED",
          "An active exact-stock cost basis is required",
        );
      if (rows.length !== 1)
        throw new StockCostError(
          "COST_BASIS_AMBIGUOUS",
          "Multiple active exact-stock cost bases are unsafe",
        );
      const record = mapRecord(rows[0]);
      if (String(record.barcode || "") !== String(stock.barcode || ""))
        throw new StockCostError(
          "COST_STOCK_COMPANY_MISMATCH",
          "Cost-basis barcode does not match exact stock",
        );
      return record;
    } finally {
      connection.release();
    }
  }
  return {
    provision: (input, actor) => write(input, actor, false),
    supersede: (input, actor) => write(input, actor, true),
    resolveAuthoritativeStockCost,
  };
}

function projectFutureWebsiteSaleCost(costBasis) {
  if (!costBasis || costBasis.status !== "ACTIVE")
    throw new StockCostError(
      "COST_BASIS_REQUIRED",
      "Active cost basis is required",
    );
  return Object.freeze({
    companyLineAmount: String(costBasis.totalCompanyCost),
    companyTotalAmount: String(costBasis.totalCompanyCost),
    costEvidenceDigest: costBasis.evidenceDigest,
    costBasisId: Number(costBasis.id),
  });
}

module.exports = {
  StockCostError,
  digest,
  normalizeRole,
  canonicalAuthorityInput,
  ensureStockCostBasisSchema,
  createMysqlStockCostAuthority,
  projectFutureWebsiteSaleCost,
};
