"use strict";

const SCHEMA_COMPATIBILITY_ID = "erp-schema-compatibility-2026-09-26";

const REQUIRED_SCHEMA_TABLES = Object.freeze([
  "audit_log",
  "barcode_lifecycle_events",
  "branch_audit_alerts",
  "branch_receive_logs",
  "branch_reconciliation_exceptions",
  "branch_reconciliation_runs",
  "branch_stock_snapshot_items",
  "branch_stock_snapshots",
  "branch_transfer_audit_logs",
  "branch_transfer_items",
  "branch_transfers",
  "branches",
  "cash_ledger",
  "companies",
  "company_module_access",
  "company_module_access_audit",
  "company_plan_assignments",
  "company_settings",
  "company_signup_requests",
  "daily_cash_closing",
  "daily_cash_closing_audit",
  "erp_gst_tax_profiles",
  "erp_integration_party_mappings",
  "erp_integration_product_mappings",
  "erp_integration_products",
  "erp_integration_stock_bindings",
  "erp_modules",
  "erp_party_tax_profiles",
  "erp_plan_modules",
  "erp_plans",
  "expenses",
  "invoice_draft_items",
  "invoice_drafts",
  "invoice_sequences",
  "invoice_transaction_link",
  "karigar_transaction_link",
  "karigar_work",
  "lot_transaction_link",
  "material_stock_items",
  "material_stock_movements",
  "metal_ledger",
  "metal_master",
  "module_access_enforcement_events",
  "module_access_violation_logs",
  "module_enforcement_settings",
  "otp_verifications",
  "outside_karigar_ledger",
  "party_balance_summary",
  "party_master",
  "party_opening_balance",
  "payment_accounts",
  "process_additive_stock_movements",
  "process_job_slips",
  "process_lamination_weights",
  "process_lots",
  "process_material_issues",
  "process_step_additive_issues",
  "process_step_correction_batches",
  "process_step_recovery_inputs",
  "process_step_reversal_entries",
  "process_steps",
  "process_template_steps",
  "process_templates",
  "purchase_transaction_link",
  "return_history",
  "return_refund_payables",
  "sales_cancellations",
  "sales_history",
  "sales_items",
  "stock",
  "transaction_lines",
  "transaction_master",
  "transaction_settlements",
  "transaction_types",
  "users",
  "website_sale_execution_identities"
]);

const REQUIRED_SCHEMA_COLUMNS = Object.freeze({
  users: ["id", "email", "password", "role", "status", "company_id"],
  stock: ["id", "company_id", "barcode", "active_barcode_key", "current_branch_id", "stock_state", "status"],
  sales_history: ["id", "company_id", "invoice_number", "branch_id", "status"],
  sales_items: ["id", "company_id", "sale_id", "barcode", "branch_id"],
  invoice_sequences: ["company_id", "prefix", "sequence_year", "last_number"],
  branches: ["id", "company_id", "branch_code", "status"],
  branch_transfers: ["id", "company_id", "transfer_no", "idempotency_unique_key", "status"],
  branch_transfer_items: ["id", "company_id", "transfer_id", "barcode", "active_transfer_barcode_key"],
  process_lots: ["id", "company_id", "lot_no", "work_category", "template_id"],
  process_steps: ["id", "company_id", "process_lot_id", "step_no", "status"],
  transaction_master: ["id", "company_id", "voucher_no", "idempotency_unique_key", "transaction_type"],
  expenses: ["id", "company_id", "idempotency_unique_key"],
  company_module_access: ["company_id", "module_key", "enabled"]
});

const REQUIRED_SCHEMA_INDEXES = Object.freeze({
  stock: ["uq_stock_company_active_barcode_key"],
  invoice_sequences: ["uq_invoice_sequence_company_year_prefix"],
  branches: ["uq_branches_company_normalized_code"],
  branch_transfers: ["uq_branch_transfers_company_transfer_no", "uq_branch_transfers_company_idempotency"],
  branch_transfer_items: ["uq_branch_transfer_items_open_barcode"],
  process_job_slips: ["uq_process_job_slips_company_slip_no"],
  process_lots: ["uq_process_lots_company_category_lot"],
  process_steps: ["uq_process_steps_company_process_lot_step"],
  transaction_master: ["uq_transaction_master_company_voucher", "uq_transaction_master_company_idempotency"],
  expenses: ["uq_expenses_company_idempotency"]
});

class StartupConfigurationError extends Error {
  constructor(messages) {
    super(`Invalid runtime configuration: ${messages.join("; ")}`);
    this.name = "StartupConfigurationError";
    this.issues = [...messages];
  }
}

class SchemaCompatibilityError extends Error {
  constructor(missing) {
    const details = [
      missing.tables.length ? `tables: ${missing.tables.join(", ")}` : "",
      missing.columns.length ? `columns: ${missing.columns.join(", ")}` : "",
      missing.indexes.length ? `indexes: ${missing.indexes.join(", ")}` : ""
    ].filter(Boolean);
    super(`Database schema is not compatible with ${SCHEMA_COMPATIBILITY_ID}${details.length ? `. Missing ${details.join("; ")}` : ""}`);
    this.name = "SchemaCompatibilityError";
    this.compatibilityId = SCHEMA_COMPATIBILITY_ID;
    this.missing = missing;
  }
}

class DisposableDatabaseSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "DisposableDatabaseSafetyError";
  }
}

function assertDisposableDatabaseTarget(env = process.env) {
  const targetDatabase = String(env.MYSQLDATABASE || "").trim();
  const protectedDatabase = String(env.PROTECTED_BUSINESS_DATABASE || "").trim();
  const mutationApproval = String(env.ALLOW_DISPOSABLE_DB_MUTATION || "").trim().toUpperCase();

  if (!protectedDatabase) {
    throw new DisposableDatabaseSafetyError("PROTECTED_BUSINESS_DATABASE is required for maintenance commands");
  }
  if (!targetDatabase) {
    throw new DisposableDatabaseSafetyError("MYSQLDATABASE is required for maintenance commands");
  }
  if (targetDatabase.toLowerCase() === protectedDatabase.toLowerCase()) {
    throw new DisposableDatabaseSafetyError("Maintenance command refused: target database matches the protected business database");
  }
  if (!/(?:test|disposable|sandbox|scratch)/i.test(targetDatabase)) {
    throw new DisposableDatabaseSafetyError("Maintenance command refused: target database is not clearly marked as disposable");
  }
  if (mutationApproval !== "YES") {
    throw new DisposableDatabaseSafetyError("ALLOW_DISPOSABLE_DB_MUTATION=YES is required for maintenance commands");
  }

  return Object.freeze({ targetDatabase, protectedDatabase });
}

function parseBoolean(value, fallback = false) {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!clean) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(clean)) return true;
  if (["0", "false", "no", "n", "off"].includes(clean)) return false;
  return fallback;
}

function isProductionEnvironment(env = process.env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production" || Boolean(String(env.RAILWAY_ENVIRONMENT || "").trim());
}

function validateRuntimeConfiguration(env = process.env, { production = isProductionEnvironment(env) } = {}) {
  const issues = [];
  const required = ["MYSQLHOST", "MYSQLUSER", "MYSQLDATABASE", "MYSQLPORT", "JWT_SECRET"];
  if (production) required.push("MYSQLPASSWORD", "APP_ORIGIN");

  for (const key of required) {
    if (!String(env[key] || "").trim()) issues.push(`${key} is required`);
  }

  const port = Number(String(env.PORT || "8080").trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push("PORT must be an integer between 1 and 65535");

  const mysqlPort = Number(String(env.MYSQLPORT || "").trim());
  if (!Number.isInteger(mysqlPort) || mysqlPort < 1 || mysqlPort > 65535) issues.push("MYSQLPORT must be an integer between 1 and 65535");

  const jwtSecret = String(env.JWT_SECRET || "").trim();
  if (production && jwtSecret && jwtSecret.length < 32) issues.push("JWT_SECRET must contain at least 32 characters in production");

  if (production && env.APP_ORIGIN) {
    const origins = String(env.APP_ORIGIN).split(",").map((value) => value.trim()).filter(Boolean);
    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (url.protocol !== "https:") issues.push("APP_ORIGIN entries must use HTTPS in production");
        if (["localhost", "127.0.0.1"].includes(url.hostname.toLowerCase())) issues.push("APP_ORIGIN cannot use localhost in production");
        if (url.pathname !== "/" || url.search || url.hash) issues.push("APP_ORIGIN entries must be origins without a path, query, or fragment");
      } catch (_) {
        issues.push("APP_ORIGIN contains an invalid URL");
      }
    }
  }

  const smtpEnabled = parseBoolean(env.SMTP_ENABLED, false);
  if (smtpEnabled) {
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) {
      if (!String(env[key] || "").trim()) issues.push(`${key} is required when SMTP_ENABLED=true`);
    }
    const smtpPort = Number(String(env.SMTP_PORT || "").trim());
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) issues.push("SMTP_PORT must be an integer between 1 and 65535");
  }

  if (issues.length) throw new StartupConfigurationError([...new Set(issues)]);

  return Object.freeze({
    production,
    port,
    smtpEnabled,
    autoBackupEnabled: parseBoolean(env.BACKUP_AUTO_ENABLED, false)
  });
}

function createStartupStatus(port) {
  return {
    port,
    config: "pending",
    db: "pending",
    schema: "pending",
    smtp: "pending",
    ready: false,
    shuttingDown: false,
    compatibilityId: SCHEMA_COMPATIBILITY_ID
  };
}

function getReadinessSnapshot(status) {
  const ready = Boolean(
    status &&
    status.ready === true &&
    status.config === "valid" &&
    status.db === "connected" &&
    status.schema === "compatible" &&
    status.shuttingDown !== true
  );
  return {
    ready,
    httpStatus: ready ? 200 : 503,
    body: {
      success: ready,
      app: ready ? "ready" : "not_ready",
      status: ready ? "ready" : "not_ready",
      config: status?.config || "pending",
      db: status?.db || "pending",
      schema: status?.schema || "pending",
      compatibilityId: status?.compatibilityId || SCHEMA_COMPATIBILITY_ID
    }
  };
}

async function verifySchemaCompatibility(pool) {
  const [tableRows] = await pool.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
  );
  const tableSet = new Set(tableRows.map((row) => String(row.TABLE_NAME || row.table_name || "").toLowerCase()));
  const missingTables = REQUIRED_SCHEMA_TABLES.filter((table) => !tableSet.has(table));

  const [columnRows] = await pool.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
  );
  const columnSet = new Set(columnRows.map((row) => `${String(row.TABLE_NAME || row.table_name || "").toLowerCase()}.${String(row.COLUMN_NAME || row.column_name || "").toLowerCase()}`));
  const missingColumns = Object.entries(REQUIRED_SCHEMA_COLUMNS).flatMap(([table, columns]) =>
    columns.filter((column) => !columnSet.has(`${table}.${column}`)).map((column) => `${table}.${column}`)
  );

  const [indexRows] = await pool.query(
    "SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()"
  );
  const indexSet = new Set(indexRows.map((row) => `${String(row.TABLE_NAME || row.table_name || "").toLowerCase()}.${String(row.INDEX_NAME || row.index_name || "").toLowerCase()}`));
  const missingIndexes = Object.entries(REQUIRED_SCHEMA_INDEXES).flatMap(([table, indexes]) =>
    indexes.filter((index) => !indexSet.has(`${table}.${index.toLowerCase()}`)).map((index) => `${table}.${index}`)
  );

  const missing = { tables: missingTables, columns: missingColumns, indexes: missingIndexes };
  if (missingTables.length || missingColumns.length || missingIndexes.length) {
    throw new SchemaCompatibilityError(missing);
  }

  return Object.freeze({
    compatibilityId: SCHEMA_COMPATIBILITY_ID,
    tableCount: tableSet.size
  });
}

function createGracefulShutdownController({
  getServer,
  pool,
  startupStatus,
  timeoutMs = 15000,
  exit = (code) => process.exit(code),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console
}) {
  let shutdownPromise = null;

  async function shutdown(signal = "shutdown", requestedExitCode = 0) {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      startupStatus.ready = false;
      startupStatus.shuttingDown = true;
      logger.log(`[SHUTDOWN] ${signal} received; stopping new HTTP connections.`);

      const forceTimer = setTimer(() => {
        logger.error("[SHUTDOWN] Grace period expired; forcing exit.");
        exit(1);
      }, timeoutMs);
      if (typeof forceTimer?.unref === "function") forceTimer.unref();

      let exitCode = requestedExitCode;
      try {
        const server = getServer();
        if (server) {
          if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
          await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
        await pool.end();
        logger.log("[SHUTDOWN] HTTP server and MySQL pool closed cleanly.");
      } catch (error) {
        exitCode = 1;
        logger.error("[SHUTDOWN] Graceful shutdown failed:", error?.message || error);
      } finally {
        clearTimer(forceTimer);
      }

      exit(exitCode);
    })();

    return shutdownPromise;
  }

  return { shutdown, isShuttingDown: () => Boolean(shutdownPromise) };
}

module.exports = {
  REQUIRED_SCHEMA_COLUMNS,
  REQUIRED_SCHEMA_INDEXES,
  REQUIRED_SCHEMA_TABLES,
  SCHEMA_COMPATIBILITY_ID,
  DisposableDatabaseSafetyError,
  SchemaCompatibilityError,
  StartupConfigurationError,
  assertDisposableDatabaseTarget,
  createGracefulShutdownController,
  createStartupStatus,
  getReadinessSnapshot,
  isProductionEnvironment,
  parseBoolean,
  validateRuntimeConfiguration,
  verifySchemaCompatibility
};
