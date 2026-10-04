"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  REQUIRED_SCHEMA_COLUMNS,
  REQUIRED_SCHEMA_INDEXES,
  REQUIRED_SCHEMA_TABLES,
  SchemaCompatibilityError,
  StartupConfigurationError,
  assertDisposableDatabaseTarget,
  createGracefulShutdownController,
  createStartupStatus,
  getReadinessSnapshot,
  validateRuntimeConfiguration,
  verifySchemaCompatibility
} = require("../js/backend/startupSafety");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function validProductionEnvironment() {
  return {
    NODE_ENV: "production",
    PORT: "8080",
    APP_ORIGIN: "https://erp.example.com",
    JWT_SECRET: "a-production-jwt-secret-with-32-characters",
    MYSQLHOST: "mysql.internal",
    MYSQLPORT: "3306",
    MYSQLUSER: "erp",
    MYSQLPASSWORD: "do-not-log-this-password",
    MYSQLDATABASE: "erp",
    SMTP_ENABLED: "false"
  };
}

test("production configuration validates required non-secret settings", () => {
  const result = validateRuntimeConfiguration(validProductionEnvironment());
  assert.equal(result.production, true);
  assert.equal(result.autoBackupEnabled, false);
});

test("configuration failures identify variable names without exposing secret contents", () => {
  const env = validProductionEnvironment();
  env.APP_ORIGIN = "http://localhost:8080";
  env.JWT_SECRET = "sensitive-value";

  assert.throws(
    () => validateRuntimeConfiguration(env),
    (error) => {
      assert.ok(error instanceof StartupConfigurationError);
      assert.match(error.message, /JWT_SECRET|APP_ORIGIN/);
      assert.doesNotMatch(error.message, /sensitive-value|do-not-log-this-password/);
      return true;
    }
  );
});

test("maintenance guard allows only explicitly approved disposable database targets", () => {
  const env = {
    MYSQLDATABASE: "test_erp_phase2_disposable",
    PROTECTED_BUSINESS_DATABASE: "jewellery_erp",
    ALLOW_DISPOSABLE_DB_MUTATION: "YES"
  };
  assert.equal(assertDisposableDatabaseTarget(env).targetDatabase, "test_erp_phase2_disposable");

  assert.throws(
    () => assertDisposableDatabaseTarget({ ...env, MYSQLDATABASE: "jewellery_erp" }),
    /matches the protected business database/
  );
  assert.throws(
    () => assertDisposableDatabaseTarget({ ...env, ALLOW_DISPOSABLE_DB_MUTATION: "NO" }),
    /ALLOW_DISPOSABLE_DB_MUTATION=YES/
  );
  assert.throws(
    () => assertDisposableDatabaseTarget({ ...env, MYSQLDATABASE: "production_copy" }),
    /not clearly marked as disposable/
  );
});

test("readiness stays closed until every required startup gate passes", () => {
  const status = createStartupStatus(8080);
  assert.equal(getReadinessSnapshot(status).httpStatus, 503);

  status.config = "valid";
  status.db = "connected";
  status.schema = "compatible";
  status.ready = true;
  assert.equal(getReadinessSnapshot(status).httpStatus, 200);

  status.shuttingDown = true;
  assert.equal(getReadinessSnapshot(status).httpStatus, 503);
});

function compatibleSchemaPool({ omitTable = "" } = {}) {
  const tables = REQUIRED_SCHEMA_TABLES
    .filter((table) => table !== omitTable)
    .map((TABLE_NAME) => ({ TABLE_NAME }));
  const columns = Object.entries(REQUIRED_SCHEMA_COLUMNS).flatMap(([TABLE_NAME, names]) =>
    names.map((COLUMN_NAME) => ({ TABLE_NAME, COLUMN_NAME }))
  );
  const indexes = Object.entries(REQUIRED_SCHEMA_INDEXES).flatMap(([TABLE_NAME, names]) =>
    names.map((INDEX_NAME) => ({ TABLE_NAME, INDEX_NAME }))
  );

  return {
    async query(sql) {
      if (sql.includes("information_schema.TABLES")) return [tables];
      if (sql.includes("information_schema.COLUMNS")) return [columns];
      if (sql.includes("information_schema.STATISTICS")) return [indexes];
      throw new Error("Unexpected compatibility query");
    }
  };
}

test("schema compatibility check is read-only and accepts the declared contract", async () => {
  assert.deepEqual(REQUIRED_SCHEMA_INDEXES.branches, ["uq_branches_company_normalized_code"]);
  const result = await verifySchemaCompatibility(compatibleSchemaPool());
  assert.equal(result.tableCount, REQUIRED_SCHEMA_TABLES.length);
});

test("schema compatibility check fails closed when a required table is missing", async () => {
  await assert.rejects(
    verifySchemaCompatibility(compatibleSchemaPool({ omitTable: "users" })),
    (error) => error instanceof SchemaCompatibilityError && error.missing.tables.includes("users")
  );
});

test("graceful shutdown closes HTTP and MySQL exactly once", async () => {
  const calls = { close: 0, closeIdle: 0, end: 0, exit: [] };
  const status = createStartupStatus(8080);
  status.ready = true;
  const server = {
    closeIdleConnections() { calls.closeIdle += 1; },
    close(callback) { calls.close += 1; callback(); }
  };
  const pool = { async end() { calls.end += 1; } };
  const controller = createGracefulShutdownController({
    getServer: () => server,
    pool,
    startupStatus: status,
    exit: (code) => calls.exit.push(code),
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
    logger: { log() {}, error() {} }
  });

  await Promise.all([controller.shutdown("SIGTERM"), controller.shutdown("SIGINT")]);
  assert.deepEqual(calls, { close: 1, closeIdle: 1, end: 1, exit: [0] });
  assert.equal(status.ready, false);
  assert.equal(status.shuttingDown, true);
});

test("fatal shutdown preserves a non-zero exit code", async () => {
  const exits = [];
  const controller = createGracefulShutdownController({
    getServer: () => null,
    pool: { async end() {} },
    startupStatus: createStartupStatus(8080),
    exit: (code) => exits.push(code),
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
    logger: { log() {}, error() {} }
  });

  await controller.shutdown("startup failure", 1);
  assert.deepEqual(exits, [1]);
});

test("normal server startup is separated from migrations and SuperAdmin bootstrap", () => {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "js", "backend", "server.js"), "utf8");
  const normalStartup = source.slice(source.indexOf("async function bootstrapServer()"), source.indexOf("async function main()"));
  const migration = source.slice(source.indexOf("async function runMigrationCommand()"), source.indexOf("async function runSuperAdminBootstrapCommand()"));
  const admin = source.slice(source.indexOf("async function runSuperAdminBootstrapCommand()"), source.indexOf("async function runMaintenanceCommand()"));

  assert.doesNotMatch(normalStartup, /ensureSchema\s*\(/);
  assert.doesNotMatch(normalStartup, /ensureSuperAdminExists\s*\(/);
  assert.match(migration, /ensureSchema\s*\(/);
  assert.match(admin, /ensureSuperAdminExists\s*\(/);
  assert.match(source, /req\.path === "\/health" \|\| req\.path === "\/ready"/);
  assert.match(source, /return res\.status\(503\)\.json\(readiness\.body\)/);
  assert.match(source, /function isAutoBackupEnabled\(\)\s*{\s*if \(isProductionRuntime\(\)\) return false;/);
  assert.match(source, /app\.post\("\/backup\/restore"[\s\S]*?if \(isProductionRuntime\(\)\)/);
});

test("optional SMTP verification has an application-level startup deadline", () => {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "js", "backend", "server.js"), "utf8");

  assert.match(source, /const SMTP_VERIFY_DEADLINE_MS = 15000;/);
  assert.match(source, /async function verifySmtpWithDeadline\(transporter\)/);
  assert.match(source, /Promise\.race\(\[transporter\.verify\(\), deadline\]\)/);
  assert.match(source, /await verifySmtpWithDeadline\(transporter\)/);
});

test("Railway uses npm start and the real readiness endpoint", () => {
  const railway = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "railway.json"), "utf8"));
  assert.equal(railway.build.builder, "RAILPACK");
  assert.equal(railway.deploy.startCommand, "npm start");
  assert.equal(railway.deploy.healthcheckPath, "/ready");
});
