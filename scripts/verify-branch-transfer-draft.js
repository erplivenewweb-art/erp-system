"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const mysql = require("mysql2/promise");
const { signAuthToken } = require("../js/backend/authMiddleware");

const API_BASE = process.env.BRANCH_TRANSFER_TEST_API_BASE || "http://localhost:8080";
const runId = `BRDRAFT${Date.now()}`;

function dbConfig() {
  return {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT || 3306)
  };
}

async function api(token, route, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${route}`, {
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

async function main() {
  const db = await mysql.createConnection(dbConfig());
  const results = [];
  let companyId = 0;
  let otherCompanyId = 0;

  const record = (name, passed, detail = "") => {
    results.push({ name, passed: Boolean(passed), detail });
    assert.equal(Boolean(passed), true, `${name}${detail ? `: ${detail}` : ""}`);
  };

  try {
    const [companyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES (?, 'Branch Draft Audit', ?, 'active', 'ACTIVE', 'ENABLED')`,
      [`Branch Draft Audit ${runId}`, `${runId.toLowerCase()}@audit.invalid`]
    );
    companyId = Number(companyResult.insertId);

    const [otherCompanyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES (?, 'Other Branch Audit', ?, 'active', 'ACTIVE', 'ENABLED')`,
      [`Other Branch Audit ${runId}`, `other-${runId.toLowerCase()}@audit.invalid`]
    );
    otherCompanyId = Number(otherCompanyResult.insertId);

    for (const targetCompanyId of [companyId, otherCompanyId]) {
      for (const moduleKey of ["BRANCH", "BRANCH_TRANSFER", "STOCK", "STORE_SYSTEM"]) {
        await db.query(
          `INSERT INTO company_module_access (company_id, module_key, enabled, source, reason)
           VALUES (?, ?, 1, 'OVERRIDE', 'Isolated Branch Transfer draft verification')`,
          [targetCompanyId, moduleKey]
        );
      }
    }

    const [mainResult] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, 'TEST_MAIN', 'TEST_MAIN', 'MAIN', 'ACTIVE')`,
      [companyId]
    );
    const mainBranchId = Number(mainResult.insertId);
    const [destinationResult] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, 'TEST_CUTTACK', 'TEST_CUTTACK', 'STORE', 'ACTIVE')`,
      [companyId]
    );
    const destinationBranchId = Number(destinationResult.insertId);
    const [otherBranchResult] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, 'OTHER_BRANCH', 'OTHER_BRANCH', 'STORE', 'ACTIVE')`,
      [otherCompanyId]
    );
    const otherBranchId = Number(otherBranchResult.insertId);

    const [userResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, branch_id, status, login_status)
       VALUES (?, ?, '!', 'STAFF', ?, ?, 'approved', 'ENABLED')`,
      [`Branch Draft Staff ${runId}`, `${runId.toLowerCase()}-staff@audit.invalid`, companyId, mainBranchId]
    );
    const userId = Number(userResult.insertId);
    const token = signAuthToken({ id: userId, role: "STAFF", company_id: companyId, branch_id: mainBranchId });

    const addStock = async (branchId, suffix) => {
      const barcode = `${runId}-${suffix}`;
      const [result] = await db.query(
        `INSERT INTO stock
          (serial, product_name, purity, sku, weight, actual_weight, billable_weight, qty, category,
           lot_number, barcode, metal_type, process_type, source, status, company_id, created_by,
           current_branch_id, stock_state)
         VALUES (?, 'Branch Draft Test Item', '92.5', ?, 1.250, 1.250, 1.250, 1, 'Sankha', ?, ?,
                 'Silver', 'Sankha', 'STICKER', 'IN_STOCK', ?, ?, ?, 'IN_STOCK')`,
        [suffix, `${runId}-${suffix}-SKU`, `${runId}-${suffix}-LOT`, barcode, companyId, userId, branchId]
      );
      return { id: Number(result.insertId), barcode };
    };

    const sourceStock = await addStock(mainBranchId, "SOURCE");
    const wrongBranchStock = await addStock(destinationBranchId, "WRONG-BRANCH");

    const options = await api(token, "/branches/transfer-options");
    record(
      "branch-locked staff receives valid transfer destinations",
      options.status === 200 && options.body.success && options.body.branch_locked === true &&
        Number(options.body.source_branch_id) === mainBranchId &&
        options.body.branches.some((branch) => Number(branch.id) === destinationBranchId),
      JSON.stringify(options.body)
    );

    const sameBranch = await api(token, "/branch-transfers", {
      method: "POST",
      body: { from_branch_id: mainBranchId, to_branch_id: mainBranchId, idempotency_key: `${runId}-SAME` }
    });
    record("same source/destination rejected", sameBranch.status === 400 && !sameBranch.body.success);

    const wrongSource = await api(token, "/branch-transfers", {
      method: "POST",
      body: { from_branch_id: destinationBranchId, to_branch_id: mainBranchId, idempotency_key: `${runId}-WRONG-SOURCE` }
    });
    record("branch-locked source override rejected", wrongSource.status === 403 && !wrongSource.body.success);

    const foreignBranch = await api(token, "/branch-transfers", {
      method: "POST",
      body: { from_branch_id: mainBranchId, to_branch_id: otherBranchId, idempotency_key: `${runId}-FOREIGN` }
    });
    record("another company branch rejected", foreignBranch.status === 404 && !foreignBranch.body.success);

    const idempotencyKey = `${runId}-VALID`;
    const created = await api(token, "/branch-transfers", {
      method: "POST",
      body: { from_branch_id: mainBranchId, to_branch_id: destinationBranchId, idempotency_key: idempotencyKey }
    });
    record("valid Create Draft", created.status === 201 && created.body.success && created.body.transfer?.status === "CREATED", JSON.stringify(created.body));
    const transferId = Number(created.body.transfer.id);
    record("transfer number format", /^TRF-\d{8}-\d{4}$/.test(String(created.body.transfer.transfer_no || "")));

    const repeated = await api(token, "/branch-transfers", {
      method: "POST",
      body: { from_branch_id: mainBranchId, to_branch_id: destinationBranchId, idempotency_key: idempotencyKey }
    });
    const [idempotentRows] = await db.query(
      "SELECT id FROM branch_transfers WHERE company_id = ? AND idempotency_key = ?",
      [companyId, idempotencyKey]
    );
    record(
      "duplicate request reuses one draft",
      repeated.status === 200 && repeated.body.reused === true && Number(repeated.body.transfer?.id) === transferId && idempotentRows.length === 1
    );

    const [beforeScanStock] = await db.query("SELECT stock_state, current_branch_id FROM stock WHERE id = ?", [sourceStock.id]);
    record("empty draft does not move stock", beforeScanStock[0].stock_state === "IN_STOCK" && Number(beforeScanStock[0].current_branch_id) === mainBranchId);

    const emptyDispatch = await api(token, `/branch-transfers/${transferId}/dispatch`, { method: "POST", body: {} });
    record("empty draft dispatch rejected", emptyDispatch.status === 400 && !emptyDispatch.body.success);

    const wrongBranchItem = await api(token, `/branch-transfers/${transferId}/items/scan`, {
      method: "POST",
      body: { barcode: wrongBranchStock.barcode }
    });
    record("wrong-branch stock rejected", wrongBranchItem.status === 400 && !wrongBranchItem.body.success);

    const addItem = await api(token, `/branch-transfers/${transferId}/items/scan`, {
      method: "POST",
      body: { barcode: sourceStock.barcode }
    });
    record("selected item linked to draft", addItem.status === 201 && addItem.body.success && Number(addItem.body.item?.stock_id) === sourceStock.id);

    const [draftStock] = await db.query("SELECT stock_state, current_branch_id FROM stock WHERE id = ?", [sourceStock.id]);
    record("no premature stock movement", draftStock[0].stock_state === "IN_STOCK" && Number(draftStock[0].current_branch_id) === mainBranchId);

    const list = await api(token, "/branch-transfers?status=CREATED&limit=100");
    record("draft appears in transfer list/history source", list.status === 200 && list.body.transfers.some((row) => Number(row.id) === transferId));

    const duplicateItem = await api(token, `/branch-transfers/${transferId}/items/scan`, {
      method: "POST",
      body: { barcode: sourceStock.barcode }
    });
    record("duplicate item rejected", duplicateItem.status === 409 && !duplicateItem.body.success);

    const dispatch = await api(token, `/branch-transfers/${transferId}/dispatch`, { method: "POST", body: {} });
    const [dispatchedStock] = await db.query("SELECT stock_state, current_branch_id FROM stock WHERE id = ?", [sourceStock.id]);
    record(
      "dispatch regression",
      dispatch.status === 200 && dispatch.body.success && dispatchedStock[0].stock_state === "IN_TRANSIT" && Number(dispatchedStock[0].current_branch_id) === mainBranchId
    );

    const duplicateDispatch = await api(token, `/branch-transfers/${transferId}/dispatch`, { method: "POST", body: {} });
    record("duplicate dispatch rejected", duplicateDispatch.status === 400 && !duplicateDispatch.body.success);

    console.log(`\nBranch Transfer Create Draft verification: ${results.length}/${results.length} PASS`);
    for (const result of results) console.log(`PASS - ${result.name}`);
  } finally {
    if (companyId || otherCompanyId) {
      const companyIds = [companyId, otherCompanyId].filter(Boolean);
      const placeholders = companyIds.map(() => "?").join(",");
      for (const table of [
        "barcode_lifecycle_events",
        "branch_receive_logs",
        "branch_transfer_audit_logs",
        "branch_transfer_items",
        "branch_transfers",
        "stock",
        "users",
        "company_module_access",
        "company_plan_assignments",
        "branches"
      ]) {
        try {
          await db.query(`DELETE FROM ${table} WHERE company_id IN (${placeholders})`, companyIds);
        } catch (error) {
          if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
        }
      }
      await db.query(`DELETE FROM companies WHERE id IN (${placeholders})`, companyIds);
    }
    await db.end();
  }
}

main().catch((error) => {
  console.error("Branch Transfer Create Draft verification failed:", error);
  process.exitCode = 1;
});
