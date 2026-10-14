"use strict";

// Runs the Process -> lamination -> Sticker Save matrix in an isolated local
// MySQL database. It never connects the test server to the configured ERP DB.
require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawn } = require("node:child_process");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const projectRoot = path.resolve(__dirname, "..");
const host = String(process.env.MYSQLHOST || "").trim();
if (!/^(localhost|127\.0\.0\.1|::1)$/i.test(host)) {
  throw new Error("DISPOSABLE_MYSQL_REQUIRED: only a local MySQL host may run this verifier");
}

const suffix = crypto.randomBytes(8).toString("hex");
const database = `sticker_lamination_disposable_${suffix}`;
const port = 18080 + crypto.randomInt(1000);
const jwtSecret = crypto.randomBytes(32).toString("hex");
const apiBase = `http://127.0.0.1:${port}`;
const adminConfig = {
  host,
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD
};

let admin;
let db;
let server;
let serverOutput = "";

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error("Unsafe generated database name");
  return `\`${value}\``;
}

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { output += String(chunk || ""); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Child command failed (${code})\n${output.slice(-6000)}`));
    });
  });
}

async function waitForReady() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Disposable server exited early (${server.exitCode})\n${serverOutput.slice(-4000)}`);
    }
    try {
      const response = await fetch(`${apiBase}/ready`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Disposable server did not become ready\n${serverOutput.slice(-4000)}`);
}

async function api(token, method, route, body) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function createCompletedLot(companyId, userId, lotNo, outputWeight = "98.000", outputQty = 1) {
  const [lotResult] = await db.query(
    `INSERT INTO process_lots
      (company_id, lot_no, raw_weight, final_weight, expected_total_qty, work_category,
       status, completed_at, completed_by, created_by)
     VALUES (?, ?, '100.000', ?, ?, 'REGULAR_SANKHA', 'COMPLETED', NOW(), ?, ?)`,
    [companyId, lotNo, outputWeight, outputQty, userId, userId]
  );
  const processLotId = Number(lotResult.insertId);
  await db.query(
    `INSERT INTO process_steps
      (company_id, process_lot_id, lot_no, step_no, process_name, input_weight,
       output_weight, input_qty, output_qty, status, completed_at, created_by)
     VALUES (?, ?, ?, 1, 'Final Complete', '100.000', ?, ?, ?, 'COMPLETED', NOW(), ?)`,
    [companyId, processLotId, lotNo, outputWeight, outputQty, outputQty, userId]
  );
  return processLotId;
}

function sticker(lot, barcode, weight, serial = "1", qty = 1) {
  return {
    serial: String(serial),
    productName: "Disposable Lamination Test",
    purity: "92.5",
    sku: `${barcode}-SKU`,
    mm: "5",
    size: "M",
    weight,
    qty,
    lot,
    metalType: "Silver",
    processType: "Sankha",
    barcode
  };
}

function approval(lotNo, processOutputWeight, stickerTotalWeight, confirmation = "APPROVE") {
  const processMillis = Math.round(Number(processOutputWeight) * 1000);
  const totalMillis = Math.round(Number(stickerTotalWeight) * 1000);
  return {
    lotNo,
    processOutputWeight: (processMillis / 1000).toFixed(3),
    stickerTotalWeight: (totalMillis / 1000).toFixed(3),
    calculatedAdditionalWeight: ((totalMillis - processMillis) / 1000).toFixed(3),
    confirmation
  };
}

async function stockCount(companyId, lotNo) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM stock WHERE company_id = ? AND lot_number = ?",
    [companyId, lotNo]
  );
  return Number(row.total || 0);
}

async function eventCount(companyId, lotNo) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) AS total FROM barcode_lifecycle_events WHERE company_id = ? AND lot_no = ?",
    [companyId, lotNo]
  );
  return Number(row.total || 0);
}

(async () => {
  const results = [];
  const pass = (name, detail = "") => results.push({ name, passed: true, detail });
  try {
    admin = await mysql.createConnection(adminConfig);
    await admin.query(`CREATE DATABASE ${quoteIdentifier(database)}`);

    const disposableEnv = {
      ...process.env,
      NODE_ENV: "test",
      RAILWAY_ENVIRONMENT: "",
      MYSQLDATABASE: database,
      JWT_SECRET: jwtSecret,
      BACKUP_AUTO_ENABLED: "false",
      ALLOW_TEST_LOT_DELETE: "false"
    };
    await runNode(
      [path.join(projectRoot, "js/backend/server.js"), "migrate", "--confirm"],
      {
        ...disposableEnv,
        PORT: "8080",
        PROTECTED_BUSINESS_DATABASE: process.env.PROTECTED_BUSINESS_DATABASE || process.env.MYSQLDATABASE || "jewellery_erp",
        ALLOW_DISPOSABLE_DB_MUTATION: "YES"
      }
    );

    server = spawn(process.execPath, [path.join(projectRoot, "js/backend/server.js")], {
      cwd: projectRoot,
      env: {
        ...disposableEnv,
        PORT: String(port),
        APP_ORIGIN: "https://disposable.invalid",
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const capture = (chunk) => {
      serverOutput += String(chunk || "");
      if (serverOutput.length > 20000) serverOutput = serverOutput.slice(-20000);
    };
    server.stdout.on("data", capture);
    server.stderr.on("data", capture);
    await waitForReady();

    db = await mysql.createConnection({ ...adminConfig, database });
    const [companyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES ('Disposable Sticker Lamination', 'Test Owner', ?, 'approved', 'ACTIVE', 'ENABLED')`,
      [`sticker-lamination-${suffix}@invalid.local`]
    );
    const companyId = Number(companyResult.insertId);
    for (const moduleKey of ["PROCESS", "STICKER", "STOCK"]) {
      await db.query(
        "INSERT INTO company_module_access (company_id, module_key, enabled, source, reason) VALUES (?, ?, 1, 'OVERRIDE', 'Disposable verifier')",
        [companyId, moduleKey]
      );
    }
    const [branchResult] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, 'MAIN', 'Main Branch', 'MAIN', 'ACTIVE')`,
      [companyId]
    );
    const branchId = Number(branchResult.insertId);
    const [userResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, branch_id, status, login_status)
       VALUES ('Disposable Owner', ?, '!', 'OWNER', ?, ?, 'approved', 'ENABLED')`,
      [`disposable-owner-${suffix}@invalid.local`, companyId, branchId]
    );
    const userId = Number(userResult.insertId);
    const token = jwt.sign(
      { userId, role: "OWNER", companyId },
      jwtSecret,
      { expiresIn: "1h" }
    );
    const authBody = { companyId, branchId, actingUserId: userId, userId };

    const lotExact = `LAM-${suffix}-EXACT`;
    await createCompletedLot(companyId, userId, lotExact);
    const exact = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [sticker(lotExact, `${suffix}-EXACT`, "98.000")]
    });
    assert.equal(exact.status, 200, JSON.stringify(exact.body));
    pass("98 + 0 accepts 98");

    const lotNoAddition = `LAM-${suffix}-NOADD`;
    await createCompletedLot(companyId, userId, lotNoAddition);
    const noAddition = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [sticker(lotNoAddition, `${suffix}-NOADD`, "103.000")]
    });
    assert.equal(noAddition.status, 400, JSON.stringify(noAddition.body));
    assert.equal(noAddition.body.message, "Approval not confirmed. Type APPROVE exactly to continue.");
    assert.equal(noAddition.body.stickerAllowance.approvalCode, "STICKER_ADDITIONAL_WEIGHT_APPROVAL_REQUIRED");
    assert.equal(Number(noAddition.body.stickerAllowance.processOutputWeight), 98);
    assert.equal(Number(noAddition.body.stickerAllowance.calculatedAdditionalWeight), 5);
    assert.equal(await stockCount(companyId, lotNoAddition), 0);
    assert.equal(await eventCount(companyId, lotNoAddition), 0);
    pass("98 + 0 blocks 103 with no partial mutation");

    const lotGapped = `LAM-${suffix}-GAPPED18`;
    const gappedLotId = await createCompletedLot(companyId, userId, lotGapped, "90.300", 18);
    const gappedSerials = [103, 104, 106, 108, 111, 113, 117, 119, 121, 125, 128, 130, 133, 136, 138, 140, 142, 143];
    const gappedItems = gappedSerials.map((serial, index) => sticker(
      lotGapped,
      `${suffix}-GAP-${serial}`,
      index === gappedSerials.length - 1 ? "7.580" : "7.500",
      serial,
      1
    ));
    const missingQtyItems = gappedItems.map((item) => ({ ...item }));
    delete missingQtyItems[0].qty;
    const missingQty = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: missingQtyItems,
      additionalWeightApproval: approval(lotGapped, "90.300", "135.080")
    });
    assert.equal(missingQty.status, 400, JSON.stringify(missingQty.body));
    assert.equal(missingQty.body.errorScope, "STICKER_SAVE");
    assert.match(missingQty.body.message, /quantity is required/i);
    assert.equal((await db.query("SELECT COUNT(*) total FROM process_lamination_weights WHERE process_lot_id = ?", [gappedLotId]))[0][0].total, 0);
    assert.equal(await stockCount(companyId, lotGapped), 0);
    pass("missing quantity is rejected before approval mutation");

    const gappedApproval = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: gappedItems,
      additionalWeightApproval: approval(lotGapped, "90.300", "135.080")
    });
    assert.equal(gappedApproval.status, 200, JSON.stringify(gappedApproval.body));
    const gappedSave = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: gappedItems
    });
    assert.equal(gappedSave.status, 200, JSON.stringify(gappedSave.body));
    assert.equal(Number(gappedSave.body.savedCount), 18);
    const [gappedStock] = await db.query(
      "SELECT serial, qty, weight FROM stock WHERE company_id = ? AND lot_number = ? ORDER BY id ASC",
      [companyId, lotGapped]
    );
    assert.equal(gappedStock.length, 18);
    assert.deepEqual(gappedStock.map((row) => Number(row.serial)), gappedSerials);
    assert.equal(gappedStock.reduce((total, row) => total + Number(row.qty), 0), 18);
    assert.equal(gappedStock.reduce((total, row) => total + Math.round(Number(row.weight) * 1000), 0), 135080);
    assert.equal(await eventCount(companyId, lotGapped), 18);
    const [[gappedApprovalCount]] = await db.query(
      "SELECT COUNT(*) AS total FROM process_lamination_weights WHERE process_lot_id = ? AND status = 'APPROVED'",
      [gappedLotId]
    );
    assert.equal(Number(gappedApprovalCount.total), 1);
    pass("18 non-contiguous serials save as exactly 18 pairs with one exact approval and 18 barcode events");

    const lotApproved = `LAM-${suffix}-APPROVED`;
    const approvedLotId = await createCompletedLot(companyId, userId, lotApproved, "90.300");
    const approvedItem = sticker(lotApproved, `${suffix}-APPROVED`, "135.080");
    const preflight = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [approvedItem],
      approved: true
    });
    assert.equal(preflight.status, 400, JSON.stringify(preflight.body));
    assert.equal(preflight.body.stickerAllowance.approvalCode, "STICKER_ADDITIONAL_WEIGHT_APPROVAL_REQUIRED");
    assert.equal(String(preflight.body.stickerAllowance.processOutputWeight), "90.3");
    assert.equal(String(preflight.body.stickerAllowance.stickerTotalWeight), "135.08");
    assert.equal(String(preflight.body.stickerAllowance.calculatedAdditionalWeight), "44.78");
    pass("preflight opens one explicit approval context and approved=true cannot bypass it");

    for (const invalidConfirmation of ["approve", "Approve", "APPROVED", " APPROVE", "APPROVE ", ""]) {
      const invalid = await api(token, "POST", "/stickers/approve-additional-weight", {
        ...authBody,
        items: [approvedItem],
        additionalWeightApproval: approval(lotApproved, "90.300", "135.080", invalidConfirmation)
      });
      assert.equal(invalid.status, 400, `${invalidConfirmation}: ${JSON.stringify(invalid.body)}`);
      assert.equal(invalid.body.message, "Approval not confirmed. Type APPROVE exactly to continue.");
    }
    assert.equal((await db.query("SELECT COUNT(*) total FROM process_lamination_weights WHERE process_lot_id = ?", [approvedLotId]))[0][0].total, 0);
    pass("all non-exact confirmation values are blocked without mutation");

    const exactApproval = approval(lotApproved, "90.300", "135.080");
    const approved = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: [approvedItem],
      additionalWeightApproval: exactApproval
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.approvalRecognized, true);
    const approvedReplay = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: [approvedItem],
      additionalWeightApproval: exactApproval
    });
    assert.equal(approvedReplay.status, 200, JSON.stringify(approvedReplay.body));
    const [[approvalCounts]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM process_lamination_weights WHERE process_lot_id = ? AND status = 'APPROVED') AS approvedCount,
         (SELECT COUNT(*)
          FROM audit_log
          WHERE company_id = ?
            AND action_type = 'STICKER_ADDITIONAL_WEIGHT_CONFIRMED'
            AND CAST(entity_id AS UNSIGNED) = (SELECT id FROM process_lamination_weights WHERE process_lot_id = ? AND status = 'APPROVED' LIMIT 1)) AS auditCount`,
      [approvedLotId, companyId, approvedLotId]
    );
    assert.equal(Number(approvalCounts.approvedCount), 1);
    assert.equal(Number(approvalCounts.auditCount), 1);
    pass("exact APPROVE is durable and idempotent with one approval/audit record");

    const approvedSave = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [approvedItem]
    });
    assert.equal(approvedSave.status, 200, JSON.stringify(approvedSave.body));
    const [approvedStock] = await db.query(
      "SELECT id, weight, actual_weight, billable_weight, lamination_gain_weight, barcode FROM stock WHERE company_id = ? AND lot_number = ?",
      [companyId, lotApproved]
    );
    assert.equal(approvedStock.length, 1);
    assert.equal(String(approvedStock[0].weight), "135.080");
    assert.equal(String(approvedStock[0].actual_weight), "90.300");
    assert.equal(String(approvedStock[0].billable_weight), "135.080");
    assert.equal(String(approvedStock[0].lamination_gain_weight), "44.780");
    const [[processOutput]] = await db.query(
      "SELECT output_weight FROM process_steps WHERE company_id = ? AND process_lot_id = ? ORDER BY id DESC LIMIT 1",
      [companyId, approvedLotId]
    );
    assert.equal(String(processOutput.output_weight), "90.300");
    assert.equal(await eventCount(companyId, lotApproved), 1);
    pass("approved unchanged 90.300 + 44.780 saves 135.080 once without reopening approval");

    const lotDouble = `LAM-${suffix}-DOUBLE`;
    const doubleLotId = await createCompletedLot(companyId, userId, lotDouble);
    const doubleItem = sticker(lotDouble, `${suffix}-DOUBLE`, "103.000");
    const doubleBody = {
      ...authBody,
      items: [doubleItem],
      additionalWeightApproval: approval(lotDouble, "98.000", "103.000")
    };
    const doubleResults = await Promise.all([
      api(token, "POST", "/stickers/approve-additional-weight", doubleBody),
      api(token, "POST", "/stickers/approve-additional-weight", doubleBody)
    ]);
    assert.equal(doubleResults.filter((result) => result.status === 200).length, 2, JSON.stringify(doubleResults));
    const [[doubleCount]] = await db.query(
      "SELECT COUNT(*) AS total FROM process_lamination_weights WHERE process_lot_id = ? AND status = 'APPROVED'",
      [doubleLotId]
    );
    assert.equal(Number(doubleCount.total), 1);
    pass("rapid duplicate approval is idempotent");

    const stale = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: [sticker(lotDouble, `${suffix}-DOUBLE-CHANGED`, "103.001")],
      additionalWeightApproval: approval(lotDouble, "98.000", "103.000")
    });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    pass("changed Sticker total invalidates the old exact approval context");

    const lotUnrelated = `LAM-${suffix}-UNRELATED`;
    const unrelatedLotId = await createCompletedLot(companyId, userId, lotUnrelated);
    const duplicateBarcode = `${suffix}-UNRELATED-DUP`;
    const unrelatedItem = sticker(lotUnrelated, duplicateBarcode, "103.000");
    const unrelatedApproval = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: [unrelatedItem],
      additionalWeightApproval: approval(lotUnrelated, "98.000", "103.000")
    });
    assert.equal(unrelatedApproval.status, 200, JSON.stringify(unrelatedApproval.body));
    // Simulate an unrelated race after approval but before the resumed Save.
    await db.query(
      `INSERT INTO stock
       (serial, product_name, purity, sku, size, weight, actual_weight, billable_weight, qty,
        lot_number, barcode, metal_type, process_type, status, stock_state, current_branch_id, company_id, created_by)
       VALUES ('99', 'Existing', '92.5', 'EXISTING', 'M', 1, 1, 1, 1,
        'OTHER-LOT', ?, 'Silver', 'Sankha', 'IN_STOCK', 'IN_STOCK', ?, ?, ?)`,
      [duplicateBarcode, branchId, companyId, userId]
    );
    const unrelatedSave = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [unrelatedItem]
    });
    assert.equal(unrelatedSave.status, 409, JSON.stringify(unrelatedSave.body));
    assert.equal(unrelatedSave.body.stickerAllowance, null);
    const [[unrelatedApprovalCount]] = await db.query(
      "SELECT COUNT(*) AS total FROM process_lamination_weights WHERE process_lot_id = ? AND status = 'APPROVED'",
      [unrelatedLotId]
    );
    assert.equal(Number(unrelatedApprovalCount.total), 1);
    assert.equal(await stockCount(companyId, lotUnrelated), 0);
    pass("unrelated Save failure stays a real error and preserves the valid approval without modal data");

    const [accountsResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, branch_id, status, login_status)
       VALUES ('Disposable Accounts', ?, '!', 'ACCOUNTS', ?, ?, 'approved', 'ENABLED')`,
      [`disposable-accounts-${suffix}@invalid.local`, companyId, branchId]
    );
    const accountsToken = jwt.sign({ userId: Number(accountsResult.insertId), role: "ACCOUNTS", companyId }, jwtSecret, { expiresIn: "1h" });
    const lotUnauthorized = `LAM-${suffix}-UNAUTHORIZED`;
    await createCompletedLot(companyId, userId, lotUnauthorized);
    const unauthorizedItem = sticker(lotUnauthorized, `${suffix}-UNAUTHORIZED`, "103.000");
    const unauthorized = await api(accountsToken, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      items: [unauthorizedItem],
      additionalWeightApproval: approval(lotUnauthorized, "98.000", "103.000")
    });
    assert.equal(unauthorized.status, 403, JSON.stringify(unauthorized.body));
    pass("unauthorized role cannot approve even with exact APPROVE");

    const companyBypass = await api(token, "POST", "/stickers/approve-additional-weight", {
      ...authBody,
      companyId: companyId + 99999,
      items: [unauthorizedItem],
      additionalWeightApproval: approval(lotUnauthorized, "98.000", "103.000")
    });
    assert.equal(companyBypass.status, 403, JSON.stringify(companyBypass.body));
    pass("client-supplied company cannot bypass authenticated company scope");

    const [branch2Result] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, 'B2', 'Other Branch', 'STORE', 'ACTIVE')`,
      [companyId]
    );
    const branch2 = Number(branch2Result.insertId);
    const [staffResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, branch_id, status, login_status)
       VALUES ('Disposable Staff', ?, '!', 'STAFF', ?, ?, 'approved', 'ENABLED')`,
      [`disposable-staff-${suffix}@invalid.local`, companyId, branch2]
    );
    const staffToken = jwt.sign({ userId: Number(staffResult.insertId), role: "STAFF", companyId }, jwtSecret, { expiresIn: "1h" });
    const branchRetry = await api(staffToken, "POST", "/addStickersBulk", {
      companyId,
      branchId,
      items: [doubleItem]
    });
    assert.equal(branchRetry.status, 400, JSON.stringify(branchRetry.body));
    assert.equal(branchRetry.body.stickerAllowance.approvalCode, "STICKER_ADDITIONAL_WEIGHT_APPROVAL_REQUIRED");
    pass("approval from one branch is not reused by another branch");

    const lotCancelled = `LAM-${suffix}-CANCELLED`;
    const cancelledLotId = await createCompletedLot(companyId, userId, lotCancelled);
    const cancelledPreflight = await api(token, "POST", "/addStickersBulk", {
      ...authBody,
      items: [sticker(lotCancelled, `${suffix}-CANCELLED`, "103.000")]
    });
    assert.equal(cancelledPreflight.status, 400);
    const [[cancelledCount]] = await db.query(
      "SELECT COUNT(*) AS total FROM process_lamination_weights WHERE process_lot_id = ?",
      [cancelledLotId]
    );
    assert.equal(Number(cancelledCount.total), 0);
    assert.equal(await stockCount(companyId, lotCancelled), 0);
    pass("preflight followed by modal cancellation/no approval request has no mutation");

    console.log(JSON.stringify({ success: true, database, passed: results.length, results }, null, 2));
  } finally {
    if (db) await db.end().catch(() => {});
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        server.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`).catch(() => {});
      await admin.end().catch(() => {});
    }
  }
})().catch((error) => {
  console.error(JSON.stringify({ success: false, database, error: error.stack || error.message, serverOutput: serverOutput.slice(-4000) }, null, 2));
  process.exitCode = 1;
});
