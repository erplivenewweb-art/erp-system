const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const mysql = require("mysql2/promise");
const lifecycle = require("../js/backend/websiteSaleExecutionLifecycle");

const env = { ...process.env };
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && env[match[1]] === undefined) env[match[1]] = match[2];
  }
}

const localHost = String(env.MYSQLHOST || "").toLowerCase();
const localOnly = ["localhost", "127.0.0.1", "::1"].includes(localHost);

function disposableEnvironment(database, user, password, port = "8080") {
  return {
    ...process.env,
    ...env,
    NODE_ENV: "development",
    PORT: String(port),
    APP_ORIGIN: "https://phase8e.test",
    SMTP_ENABLED: "false",
    MYSQLHOST: "localhost",
    MYSQLPORT: "3306",
    MYSQLDATABASE: database,
    MYSQLUSER: user,
    MYSQLPASSWORD: password,
    JWT_SECRET: crypto.randomBytes(48).toString("base64url"),
    PROTECTED_BUSINESS_DATABASE: env.MYSQLDATABASE || "jewellery_erp",
    ALLOW_DISPOSABLE_DB_MUTATION: "YES",
  };
}

function runDisposableMigration(database, user, password) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["js/backend/server.js", "migrate", "--confirm"],
      {
        cwd: process.cwd(),
        env: disposableEnvironment(database, user, password),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(`disposable migration timed out\n${output.slice(-2000)}`),
      );
    }, 45_000);
    const receive = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (
        code === 0 &&
        output.includes("[MIGRATION] Schema compatibility verification passed.")
      ) {
        resolve();
        return;
      }
      reject(
        new Error(
          `disposable migration failed (${code})\n${output.slice(-2000)}`,
        ),
      );
    });
  });
}

function startDisposableErp(database, user, password) {
  return new Promise((resolve, reject) => {
    const port = 20000 + (process.pid % 20000);
    const child = spawn(process.execPath, ["js/backend/server.js"], {
      cwd: process.cwd(),
      env: disposableEnvironment(database, user, password, port),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      settle(new Error("disposable ERP startup timed out"));
    }, 45_000);
    function settle(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const finish = () =>
        error
          ? reject(new Error(`${error.message}\n${output.slice(-2000)}`))
          : resolve();
      if (child.exitCode !== null) return finish();
      child.once("exit", finish);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 5_000).unref();
    }
    const receive = (chunk) => {
      output += chunk.toString();
      if (output.includes(`[STARTUP] Server ready on port ${port}`)) settle();
      if (output.includes("[STARTUP] Startup blocked:"))
        settle(new Error("disposable ERP schema startup failed"));
    };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.on("error", settle);
    child.on("exit", (code) => {
      if (!settled) settle(new Error(`disposable ERP exited early (${code})`));
    });
  });
}

test(
  "Phase 8E durable lifecycle claims, rolls back, reconciles and survives restart without business writes",
  { skip: !localOnly && "requires a local disposable MySQL host" },
  async () => {
    const database = `test_erp_phase8e_lifecycle_${process.pid}`;
    const user = `phase8e_${process.pid}`;
    const password = crypto.randomBytes(32).toString("base64url");
    const digest = "d".repeat(64);
    const admin = () =>
      mysql.createConnection({
        host: env.MYSQLHOST,
        port: Number(env.MYSQLPORT || 3306),
        user: env.MYSQLUSER,
        password: env.MYSQLPASSWORD,
      });
    const target = () =>
      mysql.createConnection({
        host: "localhost",
        port: 3306,
        user,
        password,
        database,
      });
    let connection;
    try {
      connection = await admin();
      await connection.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`,
      );
      await connection.query(
        `CREATE USER '${user}'@'localhost' IDENTIFIED BY ?`,
        [password],
      );
      await connection.query(
        `GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'localhost'`,
      );
      await connection.query("FLUSH PRIVILEGES");
      await connection.end();

      await runDisposableMigration(database, user, password);
      await startDisposableErp(database, user, password);
      connection = await target();
      const [columns] = await connection.query(
        "SHOW COLUMNS FROM website_sale_execution_identities",
      );
      for (const field of [
        "branch_id",
        "execution_attempt_id",
        "execution_lease_expires_at",
        "execution_started_at",
        "execution_completed_at",
        "result_digest",
        "failure_code",
        "last_reconciled_at",
      ])
        assert.ok(columns.some((column) => column.Field === field));
      await connection.query(
        "INSERT INTO website_sale_execution_identities (company_id, source, external_execution_id, external_website_order_id, canonical_digest, branch_id) VALUES (1, 'WEBSITE', 'phase8e-execution-0001', 'phase8e-order-0001', ?, 2)",
        [digest],
      );

      await connection.beginTransaction();
      const first = await lifecycle.claimWebsiteSaleExecution(
        connection,
        {
          companyId: 1,
          externalExecutionId: "phase8e-execution-0001",
          canonicalDigest: digest,
          attemptId: "phase8e-attempt-0001",
          leaseMs: 60_000,
        },
        new Date("2026-08-25T00:00:00Z"),
      );
      await connection.commit();
      assert.equal(first.action, "CLAIMED");

      await connection.beginTransaction();
      const second = await lifecycle.claimWebsiteSaleExecution(
        connection,
        {
          companyId: 1,
          externalExecutionId: "phase8e-execution-0001",
          canonicalDigest: digest,
          attemptId: "phase8e-attempt-0002",
          leaseMs: 60_000,
        },
        new Date("2026-08-25T00:00:01Z"),
      );
      await connection.commit();
      assert.equal(second.action, "IN_PROGRESS");

      await connection.beginTransaction();
      await assert.rejects(
        lifecycle.claimWebsiteSaleExecution(
          connection,
          {
            companyId: 1,
            externalExecutionId: "phase8e-execution-0001",
            canonicalDigest: "f".repeat(64),
            attemptId: "phase8e-attempt-conflict",
            leaseMs: 60_000,
          },
          new Date("2026-08-25T00:00:01Z"),
        ),
        { code: "WEBSITE_SALE_IDENTITY_CONFLICT" },
      );
      await connection.rollback();

      await connection.beginTransaction();
      await lifecycle.markWebsiteSaleExecutionRolledBack(
        connection,
        {
          identityId: first.record.identityId,
          attemptId: "phase8e-attempt-0001",
          failureCode: "CONTROL_PLANE_TEST",
        },
        new Date("2026-08-25T00:00:02Z"),
      );
      await connection.commit();

      await connection.beginTransaction();
      const reclaimed = await lifecycle.claimWebsiteSaleExecution(
        connection,
        {
          companyId: 1,
          externalExecutionId: "phase8e-execution-0001",
          canonicalDigest: digest,
          attemptId: "phase8e-attempt-0003",
          leaseMs: 60_000,
        },
        new Date("2026-08-25T00:00:03Z"),
      );
      await lifecycle.markWebsiteSaleExecutionCommitted(
        connection,
        {
          identityId: first.record.identityId,
          attemptId: "phase8e-attempt-0003",
          resultDigest: "e".repeat(64),
          saleId: null,
          invoiceNumber: null,
        },
        new Date("2026-08-25T00:00:04Z"),
      );
      await connection.commit();
      assert.equal(reclaimed.action, "CLAIMED");
      await connection.end();
      connection = null;

      await startDisposableErp(database, user, password);
      connection = await target();
      const reconciled = await lifecycle.reconcileWebsiteSaleExecution(
        connection,
        1,
        "phase8e-execution-0001",
        new Date("2026-08-25T00:00:05Z"),
      );
      assert.equal(reconciled.state, "COMMITTED");
      assert.equal(reconciled.resultDigest, "e".repeat(64));

      await connection.beginTransaction();
      const committedReplay = await lifecycle.claimWebsiteSaleExecution(
        connection,
        {
          companyId: 1,
          externalExecutionId: "phase8e-execution-0001",
          canonicalDigest: digest,
          attemptId: "phase8e-attempt-after-commit",
          leaseMs: 60_000,
        },
        new Date("2026-08-25T00:00:06Z"),
      );
      await connection.commit();
      assert.equal(committedReplay.action, "RECONCILE_COMMITTED");

      await connection.query(
        "INSERT INTO website_sale_execution_identities (company_id, source, external_execution_id, external_website_order_id, canonical_digest, execution_state) VALUES (1, 'WEBSITE', 'phase8e-unknown-0001', 'phase8e-unknown-order-0001', ?, 'UNKNOWN_OUTCOME')",
        [digest],
      );
      await connection.beginTransaction();
      const unknown = await lifecycle.claimWebsiteSaleExecution(
        connection,
        {
          companyId: 1,
          externalExecutionId: "phase8e-unknown-0001",
          canonicalDigest: digest,
          attemptId: "phase8e-attempt-unknown",
          leaseMs: 60_000,
        },
        new Date("2026-08-25T00:00:07Z"),
      );
      await connection.commit();
      assert.equal(unknown.action, "RECONCILIATION_REQUIRED");
      for (const table of [
        "sales_history",
        "sales_items",
        "stock",
        "transaction_master",
        "payments",
      ]) {
        const [present] = await connection.query("SHOW TABLES LIKE ?", [table]);
        if (present.length) {
          const [count] = await connection.query(
            `SELECT COUNT(*) AS count FROM \`${table}\``,
          );
          assert.equal(
            Number(count[0].count),
            0,
            `${table} must remain free of business writes`,
          );
        }
      }
      await connection.end();
      connection = null;
    } finally {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
        await connection.end();
      }
      const cleanupConnection = await admin();
      await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await cleanupConnection.query(
        `DROP USER IF EXISTS '${user}'@'localhost'`,
      );
      await cleanupConnection.query("FLUSH PRIVILEGES");
      await cleanupConnection.end();
    }
  },
);
