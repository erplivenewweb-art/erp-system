"use strict";

const crypto = require("crypto");

const ACTIVE_STATUSES = ["RECEIVED", "IN_PROCESS", "COLOURING", "QC", "READY", "ON_HOLD"];
const TERMINAL_STATUSES = new Set(["DELIVERED", "CANCELLED"]);
const WORK_TYPES = ["Gold Colour", "Rose Gold Colour", "Silver Colour", "Polish", "Plating", "Rhodium", "Repair + Colour", "Other"];
const PAYMENT_MODES = new Set(["CASH", "UPI", "BANK", "CARD", "OTHER"]);
const RATE_TYPES = new Set(["FLAT", "PER_GRAM", "PER_PIECE", "OTHER"]);
const STATUS_TRANSITIONS = Object.freeze({
  RECEIVED: new Set(["READY", "IN_PROCESS", "ON_HOLD", "CANCELLED"]),
  IN_PROCESS: new Set(["READY", "COLOURING", "QC", "ON_HOLD", "CANCELLED"]),
  COLOURING: new Set(["READY", "QC", "ON_HOLD", "CANCELLED"]),
  QC: new Set(["READY", "IN_PROCESS", "COLOURING", "ON_HOLD", "CANCELLED"]),
  READY: new Set(["QC", "ON_HOLD", "CANCELLED"]),
  ON_HOLD: new Set(["RECEIVED", "IN_PROCESS", "COLOURING", "QC", "READY", "CANCELLED"]),
  DELIVERED: new Set(),
  CANCELLED: new Set()
});

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePaymentMode(value) {
  const clean = String(value || "").trim().toUpperCase();
  return PAYMENT_MODES.has(clean) ? clean : "";
}

function normalizeRateType(value) {
  const clean = String(value || "FLAT").trim().toUpperCase();
  return RATE_TYPES.has(clean) ? clean : "";
}

function parseScaledDecimal(value, scale, { min = null, allowNull = false } = {}) {
  if ((value === null || value === undefined || String(value).trim() === "") && allowNull) return null;
  const clean = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(clean)) throw new Error("Invalid numeric value");
  const negative = clean.startsWith("-");
  const unsigned = negative ? clean.slice(1) : clean;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > scale) throw new Error(`Maximum ${scale} decimal places allowed`);
  const factor = 10n ** BigInt(scale);
  const scaled = BigInt(whole || "0") * factor + BigInt((fraction + "0".repeat(scale)).slice(0, scale) || "0");
  const signed = negative ? -scaled : scaled;
  if (min !== null && signed < BigInt(min)) throw new Error("Numeric value is below the allowed minimum");
  return signed;
}

function formatScaledDecimal(value, scale) {
  const scaled = typeof value === "bigint" ? value : BigInt(value || 0);
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const factor = 10n ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = String(absolute % factor).padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function makeJobNumber(dateKey, sequenceNumber) {
  const cleanDateKey = String(dateKey || "").trim();
  const cleanSequence = Number(sequenceNumber || 0);
  if (!/^\d{6}$/.test(cleanDateKey) || !Number.isInteger(cleanSequence) || cleanSequence <= 0) {
    throw new Error("Invalid Job Number sequence input");
  }
  return `CLR-${cleanDateKey}-${String(cleanSequence).padStart(3, "0")}`;
}

function money(value, options = {}) {
  return parseScaledDecimal(value, 2, options);
}

function weight(value, options = {}) {
  return parseScaledDecimal(value, 3, options);
}

function calculateEstimatedAmount({ rateType, rate, receivedWeight, qty, providedAmount = 0n }) {
  if (rateType === "OTHER") return providedAmount;
  if (rateType === "FLAT") return rate;
  if (rateType === "PER_PIECE") return rate * BigInt(qty);
  if (rateType === "PER_GRAM") {
    return (rate * receivedWeight + 500n) / 1000n;
  }
  throw new Error("Invalid rate type");
}

function cleanText(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function cleanIdempotencyKey(req, fallbackPrefix = "cp") {
  const key = cleanText(req.headers["idempotency-key"] || req.body?.idempotencyKey || req.body?.idempotency_key, 100);
  return key || `${fallbackPrefix}-${crypto.randomUUID()}`;
}

function httpError(status, message, code = "") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function isDuplicateKey(error) {
  return error?.code === "ER_DUP_ENTRY" || Number(error?.errno || 0) === 1062;
}

function roleCanOverrideDue(access, normalizeRoleValue) {
  const role = normalizeRoleValue(access?.role || access?.actingUser?.role || "");
  return role === "OWNER" || role === "ACCOUNTS";
}

function roleCanCorrectReceivedWeight(access, normalizeRoleValue) {
  const role = normalizeRoleValue(access?.role || access?.actingUser?.role || "");
  return role === "OWNER" || role === "ACCOUNTS";
}

async function ensureColourPlantSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_job_sequences (
      company_id INT NOT NULL,
      sequence_date DATE NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, sequence_date)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_job_settings (
      company_id INT PRIMARY KEY,
      weight_warning_threshold DECIMAL(14,3) NOT NULL DEFAULT 0.100,
      due_delivery_policy VARCHAR(40) NOT NULL DEFAULT 'OWNER_ACCOUNTS_OVERRIDE',
      updated_by INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_jobs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      job_no VARCHAR(40) NOT NULL,
      customer_id INT DEFAULT NULL,
      customer_name_snapshot VARCHAR(255) NOT NULL,
      mobile VARCHAR(25) NOT NULL DEFAULT '',
      receive_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      work_type VARCHAR(120) NOT NULL,
      item_description VARCHAR(500) NOT NULL,
      qty INT NOT NULL DEFAULT 1,
      received_weight DECIMAL(14,3) NOT NULL,
      final_weight DECIMAL(14,3) DEFAULT NULL,
      weight_difference DECIMAL(14,3) DEFAULT NULL,
      weight_warning_threshold DECIMAL(14,3) NOT NULL DEFAULT 0.100,
      weight_warning_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
      weight_warning_acknowledged_by INT DEFAULT NULL,
      weight_warning_acknowledged_at DATETIME DEFAULT NULL,
      rate_type VARCHAR(30) NOT NULL DEFAULT 'FLAT',
      estimated_rate DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      estimated_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      final_rate DECIMAL(14,2) DEFAULT NULL,
      labour_charge DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      other_charge DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      discount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      final_amount DECIMAL(14,2) DEFAULT NULL,
      expected_delivery_date DATE DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      ready_at DATETIME DEFAULT NULL,
      customer_informed_at DATETIME DEFAULT NULL,
      customer_informed_by INT DEFAULT NULL,
      customer_informed_remark VARCHAR(500) NOT NULL DEFAULT '',
      delivered_at DATETIME DEFAULT NULL,
      delivered_by INT DEFAULT NULL,
      received_by_name VARCHAR(255) NOT NULL DEFAULT '',
      delivery_mobile_confirmation VARCHAR(30) NOT NULL DEFAULT '',
      delivery_remarks TEXT DEFAULT NULL,
      due_delivery_authorized TINYINT(1) NOT NULL DEFAULT 0,
      due_delivery_authorized_by INT DEFAULT NULL,
      due_delivery_reason VARCHAR(500) NOT NULL DEFAULT '',
      actual_work_performed TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      qc_notes TEXT DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
      create_idempotency_key VARCHAR(100) NOT NULL,
      created_by INT NOT NULL,
      updated_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_colour_jobs_company_job_no (company_id, job_no),
      UNIQUE KEY uq_colour_jobs_company_idempotency (company_id, create_idempotency_key),
      INDEX idx_colour_jobs_company_branch (company_id, branch_id),
      INDEX idx_colour_jobs_company_status (company_id, status),
      INDEX idx_colour_jobs_company_mobile (company_id, mobile),
      INDEX idx_colour_jobs_company_received (company_id, receive_datetime),
      INDEX idx_colour_jobs_company_expected (company_id, expected_delivery_date),
      INDEX idx_colour_jobs_customer (company_id, customer_id)
    ) ENGINE=InnoDB
  `);

  const [informedColumns] = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'colour_jobs'
       AND column_name IN ('customer_informed_at','customer_informed_by','customer_informed_remark')`
  );
  const existingInformedColumns = new Set(informedColumns.map((row) => String(row.column_name || row.COLUMN_NAME || "").toLowerCase()));
  if (!existingInformedColumns.has("customer_informed_at")) {
    await pool.query("ALTER TABLE colour_jobs ADD COLUMN customer_informed_at DATETIME DEFAULT NULL AFTER ready_at");
  }
  if (!existingInformedColumns.has("customer_informed_by")) {
    await pool.query("ALTER TABLE colour_jobs ADD COLUMN customer_informed_by INT DEFAULT NULL AFTER customer_informed_at");
  }
  if (!existingInformedColumns.has("customer_informed_remark")) {
    await pool.query("ALTER TABLE colour_jobs ADD COLUMN customer_informed_remark VARCHAR(500) NOT NULL DEFAULT '' AFTER customer_informed_by");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_job_status_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      colour_job_id BIGINT NOT NULL,
      old_status VARCHAR(30) DEFAULT NULL,
      new_status VARCHAR(30) NOT NULL,
      remarks VARCHAR(500) NOT NULL DEFAULT '',
      changed_by INT NOT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_colour_status_job (company_id, colour_job_id, changed_at),
      INDEX idx_colour_status_scope (company_id, branch_id, new_status)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_job_payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      colour_job_id BIGINT NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      payment_mode VARCHAR(30) NOT NULL,
      payment_reference VARCHAR(255) NOT NULL DEFAULT '',
      payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      payment_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',
      status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
      idempotency_key VARCHAR(100) NOT NULL,
      remarks VARCHAR(500) NOT NULL DEFAULT '',
      collected_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_colour_payment_company_idempotency (company_id, idempotency_key),
      INDEX idx_colour_payment_job (company_id, colour_job_id, status),
      INDEX idx_colour_payment_scope_date (company_id, branch_id, payment_date)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colour_job_audit_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      colour_job_id BIGINT NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      old_data JSON DEFAULT NULL,
      new_data JSON DEFAULT NULL,
      reason VARCHAR(500) NOT NULL DEFAULT '',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_colour_audit_job (company_id, colour_job_id, created_at),
      INDEX idx_colour_audit_scope (company_id, branch_id, event_type)
    ) ENGINE=InnoDB
  `);
}

async function nextJobNumber(connection, companyId) {
  const [dateRows] = await connection.query("SELECT CURRENT_DATE() AS sequence_date, DATE_FORMAT(CURRENT_DATE(), '%y%m%d') AS date_key");
  const sequenceDate = dateRows[0].sequence_date;
  const dateKey = dateRows[0].date_key;
  await connection.query(
    `INSERT INTO colour_job_sequences (company_id, sequence_date, last_number)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
    [companyId, sequenceDate]
  );
  const [rows] = await connection.query(
    "SELECT last_number FROM colour_job_sequences WHERE company_id = ? AND sequence_date = ? FOR UPDATE",
    [companyId, sequenceDate]
  );
  return makeJobNumber(dateKey, rows[0].last_number);
}

function buildScope(access, branchScope, alias = "cj") {
  const clauses = [`${alias}.company_id = ?`];
  const params = [access.companyScope];
  if (branchScope?.isBranchFiltered) {
    clauses.push(`${alias}.branch_id = ?`);
    params.push(branchScope.branchId);
  }
  return { clauses, params };
}

async function getJobForUpdate(connection, access, branchScope, identifier, forUpdate = false) {
  const scope = buildScope(access, branchScope, "cj");
  const isNumeric = /^\d+$/.test(String(identifier || ""));
  scope.clauses.push(isNumeric ? "cj.id = ?" : "cj.job_no = ?");
  scope.params.push(isNumeric ? Number(identifier) : cleanText(identifier, 40));
  const [rows] = await connection.query(
    `SELECT cj.*,
       COALESCE((SELECT SUM(CASE WHEN p.status = 'POSTED' THEN p.amount ELSE 0 END) FROM colour_job_payments p WHERE p.company_id = cj.company_id AND p.colour_job_id = cj.id), 0.00) AS total_paid
     FROM colour_jobs cj WHERE ${scope.clauses.join(" AND ")} LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    scope.params
  );
  if (!rows.length) throw httpError(404, "Colour Plant job not found");
  return rows[0];
}

async function recordEvent(connection, access, job, eventType, oldData, newData, reason = "") {
  await connection.query(
    `INSERT INTO colour_job_audit_events
     (company_id, branch_id, colour_job_id, event_type, old_data, new_data, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [job.company_id, job.branch_id ?? null, job.id, eventType, JSON.stringify(oldData ?? null), JSON.stringify(newData ?? null), cleanText(reason, 500), access.actingUserId]
  );
}

async function recordStatus(connection, access, job, oldStatus, newStatus, remarks = "") {
  await connection.query(
    `INSERT INTO colour_job_status_history
     (company_id, branch_id, colour_job_id, old_status, new_status, remarks, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [job.company_id, job.branch_id ?? null, job.id, oldStatus || null, newStatus, cleanText(remarks, 500), access.actingUserId]
  );
  await recordEvent(connection, access, job, "STATUS_CHANGED", { status: oldStatus || null }, { status: newStatus }, remarks);
}

async function resolveColourAccess(req, dependencies, { mutation = false } = {}) {
  const access = await dependencies.resolveBranchAccessContext(req, { requireCompanyScope: true });
  if (!access.ok) return access;
  if (mutation && access.isSuperAdmin) return { ok: false, status: 403, message: "SuperAdmin support mode is read-only for ERP operational data." };
  const requestedBranchId = dependencies.getRequestedBranchScopeValue(req);
  const branchScope = await dependencies.resolveOperationalBranchScope(dependencies.pool, access, requestedBranchId);
  if (!branchScope.ok) return branchScope;
  return { ok: true, access, branchScope };
}

function sendRouteError(res, error, fallback) {
  const status = Number(error?.status || (isDuplicateKey(error) ? 409 : 500));
  return res.status(status).json({ success: false, message: error?.message || fallback, code: error?.code || undefined });
}

function registerColourPlantRoutes(dependencies) {
  const { app, pool, authMiddleware, checkRole, logActivitySafe, normalizeRoleValue } = dependencies;
  const allowedRoles = checkRole(["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"]);

  app.get("/colour-jobs/work-types", authMiddleware, allowedRoles, (_req, res) => {
    return res.json({ success: true, workTypes: WORK_TYPES, paymentModes: [...PAYMENT_MODES], rateTypes: [...RATE_TYPES] });
  });

  app.get("/colour-jobs/options", authMiddleware, allowedRoles, async (req, res) => {
    try {
      const context = await resolveColourAccess(req, dependencies);
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const branchParams = [context.access.companyScope];
      const branchWhere = ["company_id = ?", "status = 'ACTIVE'"];
      if (context.branchScope.isBranchFiltered) {
        branchWhere.push("id = ?");
        branchParams.push(context.branchScope.branchId);
      }
      const [branches, customers] = await Promise.all([
        pool.query(`SELECT id, branch_code, branch_name FROM branches WHERE ${branchWhere.join(" AND ")} ORDER BY branch_name`, branchParams),
        pool.query(`SELECT id, party_code, party_name, display_name, mobile FROM party_master WHERE company_id = ? AND UPPER(COALESCE(status,'ACTIVE')) = 'ACTIVE' AND UPPER(COALESCE(party_type,'CUSTOMER')) = 'CUSTOMER' ORDER BY party_name LIMIT 1000`, [context.access.companyScope])
      ]);
      return res.json({
        success: true,
        workTypes: WORK_TYPES,
        paymentModes: [...PAYMENT_MODES],
        rateTypes: [...RATE_TYPES],
        branches: branches[0],
        customers: customers[0],
        branchContext: {
          branchId: context.branchScope.isBranchFiltered ? context.branchScope.branchId : null,
          isBranchLocked: Boolean(context.access.isBranchLocked)
        }
      });
    } catch (error) { return sendRouteError(res, error, "Colour Plant options failed"); }
  });

  app.get("/colour-jobs/dashboard", authMiddleware, allowedRoles, async (req, res) => {
    try {
      const context = await resolveColourAccess(req, dependencies);
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const scope = buildScope(context.access, context.branchScope, "cj");
      const where = scope.clauses.join(" AND ");
      const [summaryRows] = await pool.query(
        `SELECT
           SUM(DATE(cj.receive_datetime) = CURRENT_DATE()) AS jobs_received_today,
           COALESCE(SUM(CASE WHEN DATE(cj.receive_datetime) = CURRENT_DATE() THEN cj.received_weight ELSE 0 END), 0) AS received_weight_today,
           SUM(cj.status IN ('IN_PROCESS','COLOURING','QC')) AS in_process_jobs,
           SUM(cj.status = 'READY') AS ready_jobs,
           SUM(cj.status IN ('RECEIVED','IN_PROCESS','COLOURING','QC','READY','ON_HOLD')) AS pending_delivery,
           SUM(cj.status = 'DELIVERED' AND DATE(cj.delivered_at) = CURRENT_DATE()) AS delivered_today,
           COALESCE(SUM(CASE WHEN cj.status <> 'CANCELLED' THEN GREATEST(COALESCE(cj.final_amount, cj.estimated_amount) - COALESCE(pay.total_paid, 0), 0) ELSE 0 END), 0) AS outstanding_amount,
           COALESCE(SUM(CASE WHEN cj.status IN ('RECEIVED','IN_PROCESS','COLOURING','QC','READY','ON_HOLD') THEN cj.received_weight ELSE 0 END), 0) AS pending_weight,
           SUM(YEAR(cj.receive_datetime) = YEAR(CURRENT_DATE()) AND MONTH(cj.receive_datetime) = MONTH(CURRENT_DATE())) AS jobs_this_month,
           COALESCE(SUM(CASE WHEN cj.status = 'DELIVERED' THEN cj.final_weight ELSE 0 END), 0) AS delivered_weight,
           COALESCE(SUM(CASE WHEN cj.status = 'DELIVERED' THEN cj.final_amount ELSE 0 END), 0) AS revenue
         FROM colour_jobs cj
         LEFT JOIN (SELECT company_id, colour_job_id, SUM(CASE WHEN status='POSTED' THEN amount ELSE 0 END) total_paid FROM colour_job_payments GROUP BY company_id, colour_job_id) pay
           ON pay.company_id = cj.company_id AND pay.colour_job_id = cj.id
         WHERE ${where}`,
        scope.params
      );
      const [workTypeRows] = await pool.query(
        `SELECT cj.work_type, COUNT(*) job_count, COALESCE(SUM(cj.received_weight),0) total_weight
         FROM colour_jobs cj WHERE ${where} AND cj.receive_datetime >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
         GROUP BY cj.work_type ORDER BY job_count DESC`, scope.params
      );
      return res.json({ success: true, summary: summaryRows[0] || {}, workTypes: workTypeRows });
    } catch (error) {
      return sendRouteError(res, error, "Colour Plant dashboard failed");
    }
  });

  app.get("/colour-jobs/reports/daily", authMiddleware, allowedRoles, async (req, res) => {
    try {
      const context = await resolveColourAccess(req, dependencies);
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const scope = buildScope(context.access, context.branchScope, "cj");
      const fromDate = cleanText(req.query.fromDate || req.query.from_date, 10);
      const toDate = cleanText(req.query.toDate || req.query.to_date, 10);
      const dateClauses = [];
      const dateParams = [];
      if (fromDate) { dateClauses.push("d.report_date >= ?"); dateParams.push(fromDate); }
      if (toDate) { dateClauses.push("d.report_date <= ?"); dateParams.push(toDate); }
      const [rows] = await pool.query(
        `WITH scoped_jobs AS (
           SELECT cj.*, COALESCE(pay.total_paid,0) total_paid
           FROM colour_jobs cj
           LEFT JOIN (SELECT company_id, colour_job_id, SUM(CASE WHEN status='POSTED' THEN amount ELSE 0 END) total_paid FROM colour_job_payments GROUP BY company_id, colour_job_id) pay
             ON pay.company_id=cj.company_id AND pay.colour_job_id=cj.id
           WHERE ${scope.clauses.join(" AND ")}
         ), dates AS (
           SELECT DATE(receive_datetime) report_date FROM scoped_jobs
           UNION SELECT DATE(ready_at) FROM scoped_jobs WHERE ready_at IS NOT NULL
           UNION SELECT DATE(delivered_at) FROM scoped_jobs WHERE delivered_at IS NOT NULL
           UNION SELECT DATE(p.payment_date) FROM colour_job_payments p JOIN scoped_jobs sj ON sj.company_id=p.company_id AND sj.id=p.colour_job_id WHERE p.status='POSTED'
         ), received AS (
           SELECT DATE(receive_datetime) report_date, COUNT(*) jobs_received, SUM(received_weight) weight_received,
             SUM(GREATEST(COALESCE(final_amount,estimated_amount)-total_paid,0)) outstanding
           FROM scoped_jobs GROUP BY DATE(receive_datetime)
         ), completed AS (
           SELECT DATE(ready_at) report_date, COUNT(*) jobs_completed FROM scoped_jobs WHERE ready_at IS NOT NULL GROUP BY DATE(ready_at)
         ), delivered AS (
           SELECT DATE(delivered_at) report_date, COUNT(*) jobs_delivered FROM scoped_jobs WHERE delivered_at IS NOT NULL GROUP BY DATE(delivered_at)
         ), collected AS (
           SELECT DATE(p.payment_date) report_date, SUM(p.amount) amount_collected
           FROM colour_job_payments p JOIN scoped_jobs sj ON sj.company_id=p.company_id AND sj.id=p.colour_job_id
           WHERE p.status='POSTED' GROUP BY DATE(p.payment_date)
         )
         SELECT d.report_date, COALESCE(r.jobs_received,0) jobs_received, COALESCE(r.weight_received,0) weight_received,
           COALESCE(c.jobs_completed,0) jobs_completed, COALESCE(dl.jobs_delivered,0) jobs_delivered,
           COALESCE(col.amount_collected,0) amount_collected, COALESCE(r.outstanding,0) outstanding
         FROM dates d
         LEFT JOIN received r ON r.report_date=d.report_date
         LEFT JOIN completed c ON c.report_date=d.report_date
         LEFT JOIN delivered dl ON dl.report_date=d.report_date
         LEFT JOIN collected col ON col.report_date=d.report_date
         ${dateClauses.length ? `WHERE ${dateClauses.join(" AND ")}` : ""}
         ORDER BY d.report_date DESC`, [...scope.params, ...dateParams]
      );
      return res.json({ success: true, rows });
    } catch (error) { return sendRouteError(res, error, "Daily Plant report failed"); }
  });

  app.get("/colour-jobs", authMiddleware, allowedRoles, async (req, res) => {
    try {
      const context = await resolveColourAccess(req, dependencies);
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const scope = buildScope(context.access, context.branchScope, "cj");
      const search = cleanText(req.query.search, 255);
      const status = normalizeStatus(req.query.status);
      const workType = cleanText(req.query.workType || req.query.work_type, 120);
      const fromDate = cleanText(req.query.fromDate || req.query.from_date, 10);
      const toDate = cleanText(req.query.toDate || req.query.to_date, 10);
      const outstanding = String(req.query.outstanding || "").toLowerCase() === "true";
      const ready = String(req.query.ready || "").toLowerCase();
      if (search) {
        scope.clauses.push("(cj.job_no = ? OR cj.customer_name_snapshot LIKE ? OR cj.mobile LIKE ? OR cj.item_description LIKE ?)");
        scope.params.push(search.toUpperCase(), `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (status) { scope.clauses.push("cj.status = ?"); scope.params.push(status); }
      if (workType) { scope.clauses.push("cj.work_type = ?"); scope.params.push(workType); }
      if (fromDate) { scope.clauses.push("DATE(cj.receive_datetime) >= ?"); scope.params.push(fromDate); }
      if (toDate) { scope.clauses.push("DATE(cj.receive_datetime) <= ?"); scope.params.push(toDate); }
      if (ready === "true") scope.clauses.push("cj.status = 'READY'");
      if (ready === "false") scope.clauses.push("cj.status NOT IN ('READY','DELIVERED','CANCELLED')");
      if (outstanding) scope.clauses.push("COALESCE(cj.final_amount,cj.estimated_amount) > COALESCE(pay.total_paid,0)");
      const limit = Math.min(Math.max(Number(req.query.limit || 250), 1), 1000);
      const [rows] = await pool.query(
        `SELECT cj.*, b.branch_name, b.branch_code,
           COALESCE(pay.total_paid,0.00) total_paid,
           GREATEST(COALESCE(cj.final_amount,cj.estimated_amount)-COALESCE(pay.total_paid,0),0) balance
         FROM colour_jobs cj
         LEFT JOIN branches b ON b.id=cj.branch_id AND b.company_id=cj.company_id
         LEFT JOIN (SELECT company_id, colour_job_id, SUM(CASE WHEN status='POSTED' THEN amount ELSE 0 END) total_paid FROM colour_job_payments GROUP BY company_id, colour_job_id) pay
           ON pay.company_id=cj.company_id AND pay.colour_job_id=cj.id
         WHERE ${scope.clauses.join(" AND ")} ORDER BY cj.receive_datetime DESC, cj.id DESC LIMIT ?`,
        [...scope.params, limit]
      );
      return res.json({ success: true, rows, activeStatuses: ACTIVE_STATUSES });
    } catch (error) { return sendRouteError(res, error, "Colour Plant jobs fetch failed"); }
  });

  app.post("/colour-jobs", authMiddleware, allowedRoles, async (req, res) => {
    let connection;
    try {
      const context = await resolveColourAccess(req, dependencies, { mutation: true });
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const body = req.body || {};
      const customerName = cleanText(body.customerName || body.customer_name, 255);
      const mobile = cleanText(body.mobile || body.mobileNumber, 25);
      const workType = cleanText(body.workType || body.work_type, 120);
      const itemDescription = cleanText(body.itemDescription || body.item_description, 500);
      const qty = Number(body.qty ?? body.quantity ?? 1);
      if (!customerName || !workType || !itemDescription) throw httpError(400, "Customer, work type and item description are required");
      if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, "Quantity must be a positive whole number");
      const receivedWeight = weight(body.receivedWeight ?? body.received_weight, { min: 1n });
      const rateType = normalizeRateType(body.rateType || body.rate_type);
      if (!rateType) throw httpError(400, "Invalid rate type");
      const estimatedRate = money(body.rate ?? body.estimatedRate ?? 0, { min: 0n });
      const providedEstimatedAmount = money(body.estimatedAmount ?? body.estimated_amount ?? 0, { min: 0n });
      const estimatedAmount = calculateEstimatedAmount({ rateType, rate: estimatedRate, receivedWeight, qty, providedAmount: providedEstimatedAmount });
      const advance = money(body.advancePayment ?? body.advance_amount ?? 0, { min: 0n });
      if (advance > estimatedAmount) throw httpError(400, "Advance cannot exceed the estimated amount");
      const paymentMode = advance > 0n ? normalizePaymentMode(body.paymentMode || body.payment_mode) : "";
      if (advance > 0n && !paymentMode) throw httpError(400, "Valid payment mode is required for advance");
      const idempotencyKey = cleanIdempotencyKey(req, "colour-job");
      const customerId = Number(body.customerId || body.customer_id || 0) || null;
      const branchId = context.branchScope.isBranchFiltered ? context.branchScope.branchId : null;

      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [existing] = await connection.query("SELECT id, job_no FROM colour_jobs WHERE company_id=? AND create_idempotency_key=? LIMIT 1 FOR UPDATE", [context.access.companyScope, idempotencyKey]);
      if (existing.length) {
        await connection.rollback();
        return res.status(200).json({ success: true, duplicate: true, id: existing[0].id, jobNo: existing[0].job_no });
      }
      if (customerId) {
        const [partyRows] = await connection.query("SELECT id FROM party_master WHERE id=? AND company_id=? AND UPPER(COALESCE(status,'ACTIVE'))='ACTIVE' LIMIT 1", [customerId, context.access.companyScope]);
        if (!partyRows.length) throw httpError(400, "Selected customer does not belong to this company");
      }
      const [settingRows] = await connection.query("SELECT weight_warning_threshold FROM colour_job_settings WHERE company_id=? LIMIT 1", [context.access.companyScope]);
      const threshold = settingRows[0]?.weight_warning_threshold || "0.100";
      const jobNo = await nextJobNumber(connection, context.access.companyScope);
      const [result] = await connection.query(
        `INSERT INTO colour_jobs
         (company_id,branch_id,job_no,customer_id,customer_name_snapshot,mobile,receive_datetime,work_type,item_description,qty,received_weight,weight_warning_threshold,rate_type,estimated_rate,estimated_amount,expected_delivery_date,notes,status,create_idempotency_key,created_by,updated_by)
         VALUES (?,?,?,?,?,?,COALESCE(?,NOW()),?,?,?,?,?,?,?,?,?,?,'RECEIVED',?,?,?)`,
        [context.access.companyScope, branchId, jobNo, customerId, customerName, mobile, body.receiveDatetime || body.receive_datetime || null, workType, itemDescription, qty, formatScaledDecimal(receivedWeight,3), threshold, rateType, formatScaledDecimal(estimatedRate,2), formatScaledDecimal(estimatedAmount,2), body.expectedDeliveryDate || body.expected_delivery_date || null, cleanText(body.notes || body.specialInstructions, 4000), idempotencyKey, context.access.actingUserId, context.access.actingUserId]
      );
      const job = { id: result.insertId, company_id: context.access.companyScope, branch_id: branchId, job_no: jobNo };
      await recordStatus(connection, context.access, job, null, "RECEIVED", "Customer material received");
      if (advance > 0n) {
        const paymentKey = `${idempotencyKey}:advance`;
        await connection.query(
          `INSERT INTO colour_job_payments (company_id,branch_id,colour_job_id,amount,payment_mode,payment_reference,payment_type,idempotency_key,remarks,collected_by)
           VALUES (?,?,?,?,?,?,'ADVANCE',?,'Advance at job receipt',?)`,
          [context.access.companyScope, branchId, result.insertId, formatScaledDecimal(advance,2), paymentMode, cleanText(body.paymentReference || body.payment_reference,255), paymentKey, context.access.actingUserId]
        );
        await recordEvent(connection, context.access, job, "PAYMENT_ADDED", null, { amount: formatScaledDecimal(advance,2), paymentMode, paymentType: "ADVANCE" }, "Advance at receipt");
      }
      await recordEvent(connection, context.access, job, "JOB_CREATED", null, { jobNo, customerName, receivedWeight: formatScaledDecimal(receivedWeight,3), stockImpact: "NONE" }, "Customer-owned material; excluded from company stock");
      await logActivitySafe(connection, req, context.access, { companyId: context.access.companyScope, userId: context.access.actingUserId, actionType: "COLOUR_JOB_CREATED", entityType: "COLOUR_JOB", entityId: String(result.insertId), moduleName: "colour_plant", status: "success", afterData: { jobNo, branchId, receivedWeight: formatScaledDecimal(receivedWeight,3) } });
      await connection.commit();
      return res.status(201).json({ success: true, id: result.insertId, jobNo });
    } catch (error) {
      if (connection) await connection.rollback();
      return sendRouteError(res, error, "Colour Plant job creation failed");
    } finally { if (connection) connection.release(); }
  });

  app.get("/colour-jobs/:identifier", authMiddleware, allowedRoles, async (req, res) => {
    try {
      const context = await resolveColourAccess(req, dependencies);
      if (!context.ok) return dependencies.sendAccessError(res, context);
      const job = await getJobForUpdate(pool, context.access, context.branchScope, req.params.identifier, false);
      const [historyRows, paymentRows, auditRows] = await Promise.all([
        pool.query(`SELECT h.*,u.name changed_by_name FROM colour_job_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.company_id=? AND h.colour_job_id=? ORDER BY h.changed_at,h.id`, [context.access.companyScope,job.id]),
        pool.query(`SELECT p.*,u.name collected_by_name FROM colour_job_payments p LEFT JOIN users u ON u.id=p.collected_by WHERE p.company_id=? AND p.colour_job_id=? ORDER BY p.payment_date,p.id`, [context.access.companyScope,job.id]),
        pool.query(`SELECT a.*,u.name created_by_name FROM colour_job_audit_events a LEFT JOIN users u ON u.id=a.created_by WHERE a.company_id=? AND a.colour_job_id=? ORDER BY a.created_at DESC,a.id DESC`, [context.access.companyScope,job.id])
      ]);
      const finalTotal = money(job.final_amount ?? job.estimated_amount ?? 0, { min: 0n });
      const totalPaid = money(job.total_paid ?? 0, { min: 0n });
      return res.json({ success:true, job:{...job,balance:formatScaledDecimal(finalTotal-totalPaid,2)}, statusHistory:historyRows[0], payments:paymentRows[0], auditEvents:auditRows[0], allowedTransitions:[...(STATUS_TRANSITIONS[job.status] || [])] });
    } catch (error) { return sendRouteError(res,error,"Colour Plant job fetch failed"); }
  });

  app.patch("/colour-jobs/:identifier/qc", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try {
      const context=await resolveColourAccess(req,dependencies,{mutation:true});
      if(!context.ok) return dependencies.sendAccessError(res,context);
      connection=await pool.getConnection(); await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      if(TERMINAL_STATUSES.has(job.status)) throw httpError(409,"Delivered or cancelled jobs cannot be edited");
      if(job.status==="READY" && !roleCanOverrideDue(context.access,normalizeRoleValue)) throw httpError(403,"Only Owner or Accounts can edit QC after READY");
      const finalWeight=weight(req.body.finalWeight ?? req.body.final_weight,{min:1n});
      const receivedWeight=weight(job.received_weight,{min:1n});
      const difference=finalWeight-receivedWeight;
      const finalRate=money(req.body.finalRate ?? req.body.final_rate ?? 0,{min:0n});
      const labour=money(req.body.labourCharge ?? req.body.labour_charge ?? 0,{min:0n});
      const other=money(req.body.otherCharge ?? req.body.other_charge ?? 0,{min:0n});
      const discount=money(req.body.discount ?? 0,{min:0n});
      const tax=money(req.body.tax ?? 0,{min:0n});
      const calculated=labour+other-discount+tax;
      if(calculated<0n) throw httpError(400,"Discount cannot make final total negative");
      const suppliedFinal=req.body.finalAmount ?? req.body.final_amount;
      const finalAmount=suppliedFinal===undefined||suppliedFinal===null||String(suppliedFinal).trim()===""?calculated:money(suppliedFinal,{min:0n});
      const alreadyPaid=money(job.total_paid??0,{min:0n});
      if(finalAmount<alreadyPaid)throw httpError(400,"Final amount cannot be less than the amount already paid");
      const before={finalWeight:job.final_weight,weightDifference:job.weight_difference,finalAmount:job.final_amount,qcNotes:job.qc_notes};
      await connection.query(`UPDATE colour_jobs SET final_weight=?,weight_difference=?,final_rate=?,labour_charge=?,other_charge=?,discount=?,tax=?,final_amount=?,actual_work_performed=?,qc_notes=?,updated_by=? WHERE id=? AND company_id=?`,[formatScaledDecimal(finalWeight,3),formatScaledDecimal(difference,3),formatScaledDecimal(finalRate,2),formatScaledDecimal(labour,2),formatScaledDecimal(other,2),formatScaledDecimal(discount,2),formatScaledDecimal(tax,2),formatScaledDecimal(finalAmount,2),cleanText(req.body.actualWorkPerformed||req.body.actual_work_performed,4000),cleanText(req.body.qcNotes||req.body.qc_notes,4000),context.access.actingUserId,job.id,context.access.companyScope]);
      await recordEvent(connection,context.access,job,"QC_UPDATED",before,{finalWeight:formatScaledDecimal(finalWeight,3),weightDifference:formatScaledDecimal(difference,3),finalAmount:formatScaledDecimal(finalAmount,2),qcNotes:cleanText(req.body.qcNotes||req.body.qc_notes,4000)},cleanText(req.body.reason,500));
      await connection.commit(); return res.json({success:true,id:job.id,weightDifference:formatScaledDecimal(difference,3),finalAmount:formatScaledDecimal(finalAmount,2)});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"QC update failed");}finally{if(connection)connection.release();}
  });

  app.patch("/colour-jobs/:identifier/received-weight", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try{
      const context=await resolveColourAccess(req,dependencies,{mutation:true}); if(!context.ok)return dependencies.sendAccessError(res,context);
      if(!roleCanCorrectReceivedWeight(context.access,normalizeRoleValue))throw httpError(403,"Only Owner or Accounts can correct received weight");
      const reason=cleanText(req.body.reason,500); if(!reason)throw httpError(400,"Correction reason is required");
      const corrected=weight(req.body.receivedWeight??req.body.received_weight,{min:1n});
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      if(job.status!=="RECEIVED")throw httpError(409,"Received weight can only be corrected while status is RECEIVED");
      const finalWeight=job.final_weight===null?null:weight(job.final_weight);
      const difference=finalWeight===null?null:finalWeight-corrected;
      await connection.query("UPDATE colour_jobs SET received_weight=?,weight_difference=?,updated_by=? WHERE id=? AND company_id=?",[formatScaledDecimal(corrected,3),difference===null?null:formatScaledDecimal(difference,3),context.access.actingUserId,job.id,context.access.companyScope]);
      await recordEvent(connection,context.access,job,"RECEIVED_WEIGHT_CORRECTED",{receivedWeight:job.received_weight},{receivedWeight:formatScaledDecimal(corrected,3)},reason);
      await connection.commit();return res.json({success:true,id:job.id,receivedWeight:formatScaledDecimal(corrected,3)});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Received weight correction failed");}finally{if(connection)connection.release();}
  });

  app.patch("/colour-jobs/:identifier/status", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try{
      const context=await resolveColourAccess(req,dependencies,{mutation:true});if(!context.ok)return dependencies.sendAccessError(res,context);
      const nextStatus=normalizeStatus(req.body.status||req.body.newStatus);if(nextStatus==="DELIVERED")throw httpError(400,"Use the controlled delivery action");
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      if(job.status===nextStatus){await connection.rollback();return res.json({success:true,duplicate:true,id:job.id,status:job.status});}
      if(!(STATUS_TRANSITIONS[job.status]||new Set()).has(nextStatus))throw httpError(409,`Invalid status transition: ${job.status} to ${nextStatus}`);
      const remarks=cleanText(req.body.remarks,500);
      if(nextStatus==="CANCELLED"&&!remarks)throw httpError(400,"Cancellation reason is required");
      let warning=false;
      if(nextStatus==="READY"){
        const suppliedFinalWeight=req.body.finalWeight??req.body.final_weight;
        const suppliedFinalAmount=req.body.finalAmount??req.body.final_amount;
        const finalWeight=suppliedFinalWeight===undefined||suppliedFinalWeight===null||String(suppliedFinalWeight).trim()===""?(job.final_weight===null?null:weight(job.final_weight)):weight(suppliedFinalWeight,{min:1n});
        const finalAmount=suppliedFinalAmount===undefined||suppliedFinalAmount===null||String(suppliedFinalAmount).trim()===""?(job.final_amount===null?null:money(job.final_amount)):money(suppliedFinalAmount,{min:0n});
        if(finalWeight===null||finalAmount===null)throw httpError(409,"Final weight and final amount are required before READY");
        const diff=finalWeight-weight(job.received_weight);const threshold=weight(job.weight_warning_threshold||"0.100");warning=(diff<0n?-diff:diff)>threshold;
        if(warning&&!req.body.weightWarningAcknowledged)throw httpError(409,"Weight difference exceeds the warning threshold. Acknowledgment is required.","WEIGHT_WARNING_ACK_REQUIRED");
        await connection.query("UPDATE colour_jobs SET final_weight=?,weight_difference=?,final_amount=?,updated_by=? WHERE id=? AND company_id=?",[formatScaledDecimal(finalWeight,3),formatScaledDecimal(diff,3),formatScaledDecimal(finalAmount,2),context.access.actingUserId,job.id,context.access.companyScope]);
        if(suppliedFinalWeight!==undefined||suppliedFinalAmount!==undefined)await recordEvent(connection,context.access,job,"READY_DETAILS_CAPTURED",{finalWeight:job.final_weight,finalAmount:job.final_amount},{finalWeight:formatScaledDecimal(finalWeight,3),weightDifference:formatScaledDecimal(diff,3),finalAmount:formatScaledDecimal(finalAmount,2)},remarks);
        job.weight_difference=formatScaledDecimal(diff,3);
      }
      await connection.query(`UPDATE colour_jobs SET status=?,ready_at=CASE WHEN ?='READY' THEN COALESCE(ready_at,NOW()) ELSE ready_at END,completed_at=CASE WHEN ?='READY' THEN COALESCE(completed_at,NOW()) ELSE completed_at END,weight_warning_acknowledged=CASE WHEN ? THEN 1 ELSE weight_warning_acknowledged END,weight_warning_acknowledged_by=CASE WHEN ? THEN ? ELSE weight_warning_acknowledged_by END,weight_warning_acknowledged_at=CASE WHEN ? THEN NOW() ELSE weight_warning_acknowledged_at END,updated_by=? WHERE id=? AND company_id=?`,[nextStatus,nextStatus,nextStatus,warning,warning,context.access.actingUserId,warning,context.access.actingUserId,job.id,context.access.companyScope]);
      await recordStatus(connection,context.access,job,job.status,nextStatus,remarks);
      if(warning)await recordEvent(connection,context.access,job,"WEIGHT_WARNING_ACKNOWLEDGED",{threshold:job.weight_warning_threshold},{difference:job.weight_difference,acknowledged:true},remarks);
      await connection.commit();return res.json({success:true,id:job.id,status:nextStatus,weightWarning:warning});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Status update failed");}finally{if(connection)connection.release();}
  });

  app.post("/colour-jobs/:identifier/customer-informed", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try{
      const context=await resolveColourAccess(req,dependencies,{mutation:true});if(!context.ok)return dependencies.sendAccessError(res,context);
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      if(job.status!=="READY")throw httpError(409,"Only READY jobs can be marked as customer informed");
      if(job.customer_informed_at){await connection.rollback();return res.json({success:true,duplicate:true,id:job.id,customerInformedAt:job.customer_informed_at,customerInformedBy:job.customer_informed_by});}
      const remark=cleanText(req.body.remark||req.body.remarks||req.body.customer_informed_remark,500);
      await connection.query("UPDATE colour_jobs SET customer_informed_at=NOW(),customer_informed_by=?,customer_informed_remark=?,updated_by=? WHERE id=? AND company_id=? AND customer_informed_at IS NULL",[context.access.actingUserId,remark,context.access.actingUserId,job.id,context.access.companyScope]);
      await recordEvent(connection,context.access,job,"CUSTOMER_INFORMED",null,{informed:true,remark},remark);
      await logActivitySafe(connection,req,context.access,{companyId:context.access.companyScope,userId:context.access.actingUserId,actionType:"COLOUR_JOB_CUSTOMER_INFORMED",entityType:"COLOUR_JOB",entityId:String(job.id),moduleName:"colour_plant",status:"success",afterData:{jobNo:job.job_no,remark}});
      await connection.commit();return res.json({success:true,id:job.id,customerInformed:true});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Customer informed update failed");}finally{if(connection)connection.release();}
  });

  app.post("/colour-jobs/:identifier/payments", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try{
      const context=await resolveColourAccess(req,dependencies,{mutation:true});if(!context.ok)return dependencies.sendAccessError(res,context);
      const amount=money(req.body.amount,{min:1n});const mode=normalizePaymentMode(req.body.paymentMode||req.body.payment_mode);if(!mode)throw httpError(400,"Invalid payment mode");
      const key=cleanIdempotencyKey(req,"colour-payment");
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);if(job.status==="CANCELLED")throw httpError(409,"Cannot pay a cancelled job");
      const [existing]=await connection.query("SELECT id,colour_job_id,amount FROM colour_job_payments WHERE company_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE",[context.access.companyScope,key]);
      if(existing.length){
        if(Number(existing[0].colour_job_id)!==Number(job.id)||money(existing[0].amount)!==amount)throw httpError(409,"Idempotency key was already used for a different payment");
        await connection.rollback();return res.json({success:true,duplicate:true,paymentId:existing[0].id});
      }
      const total=money(job.final_amount??job.estimated_amount??0,{min:0n});const paid=money(job.total_paid??0,{min:0n});if(paid+amount>total)throw httpError(400,"Payment exceeds the job balance");
      const [result]=await connection.query(`INSERT INTO colour_job_payments (company_id,branch_id,colour_job_id,amount,payment_mode,payment_reference,payment_date,payment_type,idempotency_key,remarks,collected_by) VALUES (?,?,?,?,?,?,COALESCE(?,NOW()),'PAYMENT',?,?,?)`,[context.access.companyScope,job.branch_id??null,job.id,formatScaledDecimal(amount,2),mode,cleanText(req.body.paymentReference||req.body.payment_reference,255),req.body.paymentDate||req.body.payment_date||null,key,cleanText(req.body.remarks,500),context.access.actingUserId]);
      await recordEvent(connection,context.access,job,"PAYMENT_ADDED",null,{paymentId:result.insertId,amount:formatScaledDecimal(amount,2),paymentMode:mode},cleanText(req.body.remarks,500));
      await connection.commit();return res.status(201).json({success:true,paymentId:result.insertId,totalPaid:formatScaledDecimal(paid+amount,2),balance:formatScaledDecimal(total-paid-amount,2)});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Payment failed");}finally{if(connection)connection.release();}
  });

  app.post("/colour-jobs/:identifier/reprint", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try {
      const context=await resolveColourAccess(req,dependencies,{mutation:true});if(!context.ok)return dependencies.sendAccessError(res,context);
      const printType=String(req.body.printType||req.body.print_type||"").trim().toUpperCase();
      if(!["RECEIPT","PACKET_LABEL"].includes(printType))throw httpError(400,"Invalid print type");
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      await recordEvent(connection,context.access,job,printType==="RECEIPT"?"RECEIPT_REPRINTED":"PACKET_LABEL_REPRINTED",null,{printType},cleanText(req.body.reason||"Print requested",500));
      await connection.commit();return res.json({success:true,id:job.id,printType});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Print audit failed");}finally{if(connection)connection.release();}
  });

  app.post("/colour-jobs/:identifier/deliver", authMiddleware, allowedRoles, async (req,res) => {
    let connection;
    try{
      const context=await resolveColourAccess(req,dependencies,{mutation:true});if(!context.ok)return dependencies.sendAccessError(res,context);
      const key=cleanIdempotencyKey(req,"colour-delivery");
      connection=await pool.getConnection();await connection.beginTransaction();
      const job=await getJobForUpdate(connection,context.access,context.branchScope,req.params.identifier,true);
      if(job.status==="DELIVERED"){await connection.rollback();return res.status(409).json({success:false,message:"This job has already been delivered",code:"ALREADY_DELIVERED"});}
      if(job.status!=="READY")throw httpError(409,"Only READY jobs can be delivered");
      let paid=money(job.total_paid??0,{min:0n});const total=money(job.final_amount??job.estimated_amount??0,{min:0n});
      const paymentAmount=money(req.body.paymentAmount??req.body.payment_amount??0,{min:0n});
      if(paymentAmount>0n){
        const mode=normalizePaymentMode(req.body.paymentMode||req.body.payment_mode);if(!mode)throw httpError(400,"Valid payment mode is required");
        const paymentKey=`${key}:payment`;const [existingPayment]=await connection.query("SELECT id,amount FROM colour_job_payments WHERE company_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE",[context.access.companyScope,paymentKey]);
        if(!existingPayment.length){if(paid+paymentAmount>total)throw httpError(400,"Payment exceeds the job balance");await connection.query(`INSERT INTO colour_job_payments (company_id,branch_id,colour_job_id,amount,payment_mode,payment_reference,payment_type,idempotency_key,remarks,collected_by) VALUES (?,?,?,?,?,?,'FINAL',?,'Payment at delivery',?)`,[context.access.companyScope,job.branch_id??null,job.id,formatScaledDecimal(paymentAmount,2),mode,cleanText(req.body.paymentReference||req.body.payment_reference,255),paymentKey,context.access.actingUserId]);await recordEvent(connection,context.access,job,"PAYMENT_ADDED",null,{amount:formatScaledDecimal(paymentAmount,2),paymentMode:mode,paymentType:"FINAL"},"Payment at delivery");paid+=paymentAmount;}
      }
      const balance=total-paid;const allowDue=Boolean(req.body.allowDueDelivery||req.body.allow_due_delivery);const dueReason=cleanText(req.body.dueDeliveryReason||req.body.due_delivery_reason,500);
      if(balance>0n){if(!allowDue)throw httpError(409,"Full payment is required before delivery", "BALANCE_DUE");if(!roleCanOverrideDue(context.access,normalizeRoleValue))throw httpError(403,"Only Owner or Accounts can authorize due delivery");if(!dueReason)throw httpError(400,"Due delivery authorization reason is required");}
      await connection.query(`UPDATE colour_jobs SET status='DELIVERED',delivered_at=NOW(),delivered_by=?,received_by_name=?,delivery_mobile_confirmation=?,delivery_remarks=?,due_delivery_authorized=?,due_delivery_authorized_by=?,due_delivery_reason=?,updated_by=? WHERE id=? AND company_id=? AND status='READY'`,[context.access.actingUserId,cleanText(req.body.receivedBy||req.body.received_by,255),cleanText(req.body.mobileConfirmation||req.body.mobile_confirmation,30),cleanText(req.body.remarks,4000),balance>0n?1:0,balance>0n?context.access.actingUserId:null,balance>0n?dueReason:"",context.access.actingUserId,job.id,context.access.companyScope]);
      await recordStatus(connection,context.access,job,"READY","DELIVERED",cleanText(req.body.remarks,500));
      await recordEvent(connection,context.access,job,"JOB_DELIVERED",{status:"READY"},{status:"DELIVERED",balance:formatScaledDecimal(balance,2),dueAuthorized:balance>0n,receivedBy:cleanText(req.body.receivedBy||req.body.received_by,255)},balance>0n?dueReason:cleanText(req.body.remarks,500));
      await logActivitySafe(connection,req,context.access,{companyId:context.access.companyScope,userId:context.access.actingUserId,actionType:"COLOUR_JOB_DELIVERED",entityType:"COLOUR_JOB",entityId:String(job.id),moduleName:"colour_plant",status:"success",afterData:{jobNo:job.job_no,balance:formatScaledDecimal(balance,2),dueAuthorized:balance>0n}});
      await connection.commit();return res.json({success:true,id:job.id,status:"DELIVERED",balance:formatScaledDecimal(balance,2)});
    }catch(error){if(connection)await connection.rollback();return sendRouteError(res,error,"Delivery failed");}finally{if(connection)connection.release();}
  });
}

module.exports = {
  ACTIVE_STATUSES,
  STATUS_TRANSITIONS,
  WORK_TYPES,
  buildScope,
  calculateEstimatedAmount,
  ensureColourPlantSchema,
  formatScaledDecimal,
  makeJobNumber,
  normalizeStatus,
  parseScaledDecimal,
  registerColourPlantRoutes
};
