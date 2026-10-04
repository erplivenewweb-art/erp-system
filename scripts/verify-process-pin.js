"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const mysql = require("mysql2/promise");
const { signAuthToken } = require("../js/backend/authMiddleware");

const API_BASE = process.env.PROCESS_PIN_TEST_API_BASE || "http://localhost:8080";
const runId = `PINAUD${Date.now()}`;
const created = { companyId: null, userIds: [], branchIds: [], lotIds: [], stepIds: [], stockIds: [] };

function dbConfig() {
  return {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT || 3306)
  };
}

async function api(token, method, route, body) {
  const response = await fetch(`${API_BASE}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function templateSnapshot() {
  return JSON.stringify({
    templateId: 999999,
    templateName: "PIN continuity audit",
    workCategory: "REGULAR_SANKHA",
    steps: ["Step 1", "Step 2", "Step 3", "Step 4", "PIN"].map((stepName, index) => ({
      stepName,
      stepOrder: index + 1,
      isRequired: true,
      allowRepeat: false,
      usesAdditiveMaterial: stepName === "PIN",
      additiveMaterialLabel: stepName === "PIN" ? "PIN" : "",
      additiveAffectsOutputWeight: true
    }))
  });
}

async function addLot(db, companyId, userId, lotNo, finalPriorOutput = "95.000") {
  const [lotResult] = await db.query(
    `INSERT INTO process_lots
      (company_id, lot_no, raw_weight, expected_total_qty, work_category, status,
       template_id, template_snapshot_json, template_version_label, created_by)
     VALUES (?, ?, 100.000, 10.000, 'REGULAR_SANKHA', 'OPEN', 999999, ?, 'PIN-AUDIT', ?)`,
    [companyId, lotNo, templateSnapshot(), userId]
  );
  const lotId = Number(lotResult.insertId);
  created.lotIds.push(lotId);

  const outputs = ["98.000", "96.500", "95.500", finalPriorOutput];
  let input = "100.000";
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    const loss = (Number(input) - Number(output)).toFixed(3);
    const [stepResult] = await db.query(
      `INSERT INTO process_steps
        (company_id, process_lot_id, lot_no, step_no, process_name, input_weight, output_weight,
         loss_weight, input_qty, output_qty, status, started_at, completed_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 10.000, 10.000, 'COMPLETED', NOW(), NOW(), ?)`,
      [companyId, lotId, lotNo, index + 1, `Step ${index + 1}`, input, output, loss, userId]
    );
    created.stepIds.push(Number(stepResult.insertId));
    input = output;
  }
  return lotId;
}

async function addEmptyLot(db, companyId, userId, lotNo) {
  const [lotResult] = await db.query(
    `INSERT INTO process_lots
      (company_id, lot_no, raw_weight, expected_total_qty, work_category, status,
       template_id, template_snapshot_json, template_version_label, created_by)
     VALUES (?, ?, 100.000, 10.000, 'REGULAR_SANKHA', 'OPEN', 999999, ?, 'PIN-AUDIT', ?)`,
    [companyId, lotNo, templateSnapshot(), userId]
  );
  const lotId = Number(lotResult.insertId);
  created.lotIds.push(lotId);
  return lotId;
}

async function main() {
  const db = await mysql.createConnection(dbConfig());
  const results = [];
  const record = (name, passed, detail = "") => {
    results.push({ name, passed: Boolean(passed), detail });
    assert.equal(Boolean(passed), true, `${name}${detail ? `: ${detail}` : ""}`);
  };

  try {
    const [companyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES (?, 'PIN Audit', ?, 'approved', 'ACTIVE', 'ENABLED')`,
      [`PIN Audit ${runId}`, `${runId.toLowerCase()}@audit.invalid`]
    );
    const companyId = Number(companyResult.insertId);
    created.companyId = companyId;
    await db.query(
      "INSERT INTO company_module_access (company_id, module_key, enabled, source, reason) VALUES (?, 'PROCESS', 1, 'OVERRIDE', 'PIN integration audit')",
      [companyId]
    );

    for (const [code, name, type] of [[`${runId.slice(-10)}A`, "Main", "MAIN"], [`${runId.slice(-10)}B`, "Other", "STORE"]]) {
      const [branchResult] = await db.query(
        "INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
        [companyId, code, name, type]
      );
      created.branchIds.push(Number(branchResult.insertId));
    }
    const [ownerResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, status, login_status)
       VALUES (?, ?, '!', 'OWNER', ?, 'approved', 'ENABLED')`,
      [`PIN Audit Owner ${runId}`, `${runId.toLowerCase()}-owner@audit.invalid`, companyId]
    );
    const ownerId = Number(ownerResult.insertId);
    created.userIds.push(ownerId);
    const ownerToken = signAuthToken({ id: ownerId, role: "OWNER", company_id: companyId });

    const [staffResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, branch_id, status, login_status)
       VALUES (?, ?, '!', 'STAFF', ?, ?, 'approved', 'ENABLED')`,
      [`PIN Audit Staff ${runId}`, `${runId.toLowerCase()}-staff@audit.invalid`, companyId, created.branchIds[1]]
    );
    const staffId = Number(staffResult.insertId);
    created.userIds.push(staffId);
    const staffToken = signAuthToken({ id: staffId, role: "STAFF", company_id: companyId });

    const [stockResult] = await db.query(
      `INSERT INTO stock
        (product_name, category, source, process_type, barcode, weight, actual_weight, billable_weight, qty,
         status, stock_state, company_id, current_branch_id, created_by)
       VALUES ('PIN', 'PIN', 'PROCESS_PIN', 'PIN', ?, 30.000, 30.000, 30.000, 1,
               'IN_STOCK', 'IN_STOCK', ?, ?, ?)`,
      [`PROCESS_PIN-${runId}`, companyId, created.branchIds[0], ownerId]
    );
    const pinStockId = Number(stockResult.insertId);
    created.stockIds.push(pinStockId);

    const lotNo = `${runId}-CHAIN`;
    await addLot(db, companyId, ownerId, lotNo);

    const next = await api(ownerToken, "GET", `/process/next-input?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA`);
    record("Step 4 output becomes PIN input", next.status === 200 && next.body.success && Number(next.body.inputWeight) === 95, JSON.stringify(next.body));

    const openPin = await api(ownerToken, "POST", "/process/steps", {
      lotNo,
      workCategory: "REGULAR_SANKHA",
      processName: "PIN",
      status: "OPEN"
    });
    record("PIN opens with non-zero authoritative input", openPin.status === 200 && Number(openPin.body.step?.input_weight ?? openPin.body.step?.inputWeight) === 95, JSON.stringify(openPin.body));
    const pinStepId = Number(openPin.body.step?.id || 0);
    assert.ok(pinStepId);
    created.stepIds.push(pinStepId);

    const availablePin = await api(ownerToken, "GET", `/process/additive-issues?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA&materialType=PIN&stepName=PIN`);
    record("barcoded 30g PIN component stock is detected", availablePin.status === 200 && Number(availablePin.body.availableAdditiveStock) === 30, JSON.stringify(availablePin.body));

    const unavailableOtherBranch = await api(staffToken, "GET", `/process/additive-issues?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA&materialType=PIN&stepName=PIN`);
    record("wrong-branch PIN is unavailable", unavailableOtherBranch.status === 200 && Number(unavailableOtherBranch.body.availableAdditiveStock) === 0, JSON.stringify(unavailableOtherBranch.body));

    const blockedOtherBranch = await api(staffToken, "POST", `/process/steps/${pinStepId}/additive-issue`, {
      lotNo,
      workCategory: "REGULAR_SANKHA",
      materialLabel: "PIN",
      givenWeight: "5.000",
      notes: "Branch isolation audit"
    });
    const [stockAfterBlocked] = await db.query("SELECT weight FROM stock WHERE id = ?", [pinStockId]);
    record("branch-locked user cannot consume PIN from another branch", blockedOtherBranch.status === 400 && String(stockAfterBlocked[0].weight) === "30.000", JSON.stringify(blockedOtherBranch.body));

    const overAvailable = await api(ownerToken, "POST", `/process/steps/${pinStepId}/additive-issue`, {
      lotNo,
      workCategory: "REGULAR_SANKHA",
      materialLabel: "PIN",
      givenWeight: "31.000"
    });
    record("PIN issue greater than available stock is rejected", overAvailable.status === 400 && /shortage/i.test(overAvailable.body.message || ""), JSON.stringify(overAvailable.body));

    for (const invalidWeight of ["0.000", "-1.000"]) {
      const invalidIssue = await api(ownerToken, "POST", `/process/steps/${pinStepId}/additive-issue`, {
        lotNo,
        workCategory: "REGULAR_SANKHA",
        materialLabel: "PIN",
        givenWeight: invalidWeight
      });
      record(`PIN issue ${invalidWeight} is rejected`, invalidIssue.status === 400, JSON.stringify(invalidIssue.body));
    }

    const issueRequestKey = `${runId}-PIN-ISSUE-1`;
    const issue = await api(ownerToken, "POST", `/process/steps/${pinStepId}/additive-issue`, {
      lotNo,
      workCategory: "REGULAR_SANKHA",
      materialLabel: "PIN",
      givenWeight: "5.000",
      idempotencyKey: issueRequestKey,
      karigar: "PIN Audit Karigar",
      notes: "PIN component usage audit"
    });
    record("existing PIN component inventory issue succeeds", issue.status === 200 && issue.body.success, JSON.stringify(issue.body));
    const [stockAfterIssue] = await db.query("SELECT weight, company_id, current_branch_id FROM stock WHERE id = ?", [pinStockId]);
    record("PIN inventory mutates once in correct company/branch", String(stockAfterIssue[0].weight) === "25.000" && Number(stockAfterIssue[0].company_id) === companyId && Number(stockAfterIssue[0].current_branch_id) === created.branchIds[0], JSON.stringify(stockAfterIssue[0]));

    const duplicateIssue = await api(ownerToken, "POST", `/process/steps/${pinStepId}/additive-issue`, {
      lotNo,
      workCategory: "REGULAR_SANKHA",
      materialLabel: "PIN",
      givenWeight: "5.000",
      idempotencyKey: issueRequestKey,
      karigar: "PIN Audit Karigar"
    });
    const [issueStateAfterRetry] = await db.query(
      "SELECT COUNT(*) issue_count, COALESCE(SUM(given_weight), 0) total_given FROM process_step_additive_issues WHERE company_id = ? AND process_step_id = ?",
      [companyId, pinStepId]
    );
    const [stockAfterIssueRetry] = await db.query("SELECT weight FROM stock WHERE id = ?", [pinStockId]);
    record("duplicate PIN issue request is idempotent", duplicateIssue.status === 200 && duplicateIssue.body.reused === true && Number(issueStateAfterRetry[0].issue_count) === 1 && String(issueStateAfterRetry[0].total_given) === "5.000" && String(stockAfterIssueRetry[0].weight) === "25.000", JSON.stringify(duplicateIssue.body));

    const issueId = Number(issue.body.issue?.id || 0);
    const returnPin = await api(ownerToken, "PUT", `/process/additive-issues/${issueId}/return`, { returnedWeight: "1.000" });
    const [stockAfterReturn] = await db.query("SELECT weight FROM stock WHERE id = ?", [pinStockId]);
    record("PIN return restores component stock", returnPin.status === 200 && Number(returnPin.body.issue?.returnedWeight) === 1 && Number(returnPin.body.issue?.usedWeight) === 4 && String(stockAfterReturn[0].weight) === "26.000", JSON.stringify(returnPin.body));

    const duplicateReturn = await api(ownerToken, "PUT", `/process/additive-issues/${issueId}/return`, { returnedWeight: "1.000" });
    const [returnMovementRows] = await db.query("SELECT COUNT(*) c FROM process_additive_stock_movements WHERE company_id = ? AND additive_issue_id = ? AND movement_type = 'RETURN'", [companyId, issueId]);
    const [stockAfterReturnRetry] = await db.query("SELECT weight FROM stock WHERE id = ?", [pinStockId]);
    record("duplicate PIN return does not double-credit stock", duplicateReturn.status === 200 && Number(returnMovementRows[0].c) === 1 && String(stockAfterReturnRetry[0].weight) === "26.000", JSON.stringify(duplicateReturn.body));

    const refreshedPin = await api(ownerToken, "GET", `/process/additive-issues?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA&materialType=PIN&stepName=PIN`);
    record("PIN issue and return values persist after refresh", refreshedPin.status === 200 && Number(refreshedPin.body.totalGiven) === 5 && Number(refreshedPin.body.totalReturned) === 1 && Number(refreshedPin.body.usedAdditiveWeight) === 4 && Number(refreshedPin.body.availableAdditiveStock) === 26, JSON.stringify(refreshedPin.body));

    const [kdmStockResult] = await db.query(
      `INSERT INTO stock
        (product_name, category, source, process_type, weight, actual_weight, billable_weight, qty,
         status, stock_state, company_id, current_branch_id, created_by)
       VALUES ('KDM', 'KDM', 'PROCESS_KDM', 'KDM', 12.345, 12.345, 12.345, 1,
               'IN_STOCK', 'IN_STOCK', ?, ?, ?)`,
      [companyId, created.branchIds[0], ownerId]
    );
    created.stockIds.push(Number(kdmStockResult.insertId));
    const kdmAvailability = await api(ownerToken, "GET", `/process/additive-issues?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA&materialType=KDM&stepName=KDM`);
    record("existing unbarcoded KDM stock lookup is unchanged", kdmAvailability.status === 200 && Number(kdmAvailability.body.availableAdditiveStock) === 12.345, JSON.stringify(kdmAvailability.body));

    const completePin = await api(ownerToken, "PUT", `/process/steps/${pinStepId}/complete`, {
      outputWeight: "95.100",
      outputQty: "10.000",
      lossReason: "PIN final-step audit"
    });
    record("PIN completion succeeds", completePin.status === 200 && completePin.body.success, JSON.stringify(completePin.body));
    const [pinRows] = await db.query("SELECT input_weight, output_weight, loss_weight, status FROM process_steps WHERE id = ?", [pinStepId]);
    record("PIN weights and additive-adjusted loss persist", String(pinRows[0].input_weight) === "95.000" && String(pinRows[0].output_weight) === "95.100" && String(pinRows[0].loss_weight) === "3.900" && pinRows[0].status === "COMPLETED", JSON.stringify(pinRows[0]));

    const retryCompletion = await api(ownerToken, "PUT", `/process/steps/${pinStepId}/complete`, { outputWeight: "95.100", outputQty: "10.000" });
    const retryCreation = await api(ownerToken, "POST", "/process/steps", { lotNo, workCategory: "REGULAR_SANKHA", processName: "PIN", status: "COMPLETED", outputWeight: "95.000", outputQty: "10.000" });
    const [pinCountRows] = await db.query("SELECT COUNT(*) c FROM process_steps WHERE company_id = ? AND process_lot_id = ? AND UPPER(process_name) = 'PIN'", [companyId, created.lotIds[0]]);
    const [movementRows] = await db.query("SELECT COUNT(*) c FROM process_additive_stock_movements WHERE company_id = ? AND process_step_id = ? AND movement_type = 'ISSUE'", [companyId, pinStepId]);
    record("duplicate PIN completion and creation are rejected", retryCompletion.status === 400 && retryCreation.status === 409 && Number(pinCountRows[0].c) === 1 && Number(movementRows[0].c) === 1, `${retryCompletion.status}/${retryCreation.status}`);

    const [stockBeforeLotComplete] = await db.query("SELECT COUNT(*) c FROM stock WHERE company_id = ?", [companyId]);
    const completeLot = await api(ownerToken, "PUT", `/process/lots/${encodeURIComponent(lotNo)}/complete`, { workCategory: "REGULAR_SANKHA", branchId: created.branchIds[0] });
    const [stockAfterLotComplete] = await db.query("SELECT COUNT(*) c FROM stock WHERE company_id = ?", [companyId]);
    const [lotRows] = await db.query("SELECT status, final_weight FROM process_lots WHERE company_id = ? AND lot_no = ?", [companyId, lotNo]);
    record("regular Sankha process reaches normal completed state", completeLot.status === 200 && completeLot.body.success && lotRows[0].status === "COMPLETED", JSON.stringify(completeLot.body));
    record("PIN completion creates no finished stock, sticker, or barcode", Number(stockBeforeLotComplete[0].c) === Number(stockAfterLotComplete[0].c), `${stockBeforeLotComplete[0].c}/${stockAfterLotComplete[0].c}`);

    const invalidLotNo = `${runId}-INVALID`;
    await addLot(db, companyId, ownerId, invalidLotNo, "0.000");
    const invalidNext = await api(ownerToken, "GET", `/process/next-input?lotNo=${encodeURIComponent(invalidLotNo)}&workCategory=REGULAR_SANKHA`);
    record("invalid previous step is rejected instead of using zero", invalidNext.status === 400 && !invalidNext.body.success && /greater than zero/i.test(invalidNext.body.message), JSON.stringify(invalidNext.body));

    const regressionLotNo = `${runId}-EARLY-STEPS`;
    await addEmptyLot(db, companyId, ownerId, regressionLotNo);
    const regressionOutputs = ["98.000", "96.500", "95.500", "95.000"];
    const regressionResponses = [];
    for (let index = 0; index < regressionOutputs.length; index += 1) {
      regressionResponses.push(await api(ownerToken, "POST", "/process/steps", {
        lotNo: regressionLotNo,
        workCategory: "REGULAR_SANKHA",
        processName: `Step ${index + 1}`,
        status: "COMPLETED",
        inputQty: index === 0 ? "10.000" : undefined,
        outputWeight: regressionOutputs[index],
        outputQty: "10.000"
      }));
    }
    const [regressionRows] = await db.query(
      "SELECT step_no, input_weight, output_weight FROM process_steps WHERE company_id = ? AND process_lot_id = ? ORDER BY step_no",
      [companyId, created.lotIds[created.lotIds.length - 1]]
    );
    record(
      "non-PIN Step 1 through Step 4 regression",
      regressionResponses.every((response) => response.status === 200 && response.body.success) &&
        regressionRows.length === 4 &&
        String(regressionRows[0].input_weight) === "100.000" &&
        String(regressionRows[3].input_weight) === "95.500" &&
        String(regressionRows[3].output_weight) === "95.000",
      JSON.stringify(regressionResponses.map((response) => response.status))
    );

    const [otherCompanyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES (?, 'Other', ?, 'approved', 'ACTIVE', 'ENABLED')`,
      [`PIN Other ${runId}`, `${runId.toLowerCase()}-other-company@audit.invalid`]
    );
    const otherCompanyId = Number(otherCompanyResult.insertId);
    const [otherUserResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, status, login_status)
       VALUES (?, ?, '!', 'OWNER', ?, 'approved', 'ENABLED')`,
      [`PIN Other ${runId}`, `${runId.toLowerCase()}-other@audit.invalid`, otherCompanyId]
    );
    const otherUserId = Number(otherUserResult.insertId);
    const otherToken = signAuthToken({ id: otherUserId, role: "OWNER", company_id: otherCompanyId });
    const crossCompany = await api(otherToken, "GET", `/process/next-input?lotNo=${encodeURIComponent(lotNo)}&workCategory=REGULAR_SANKHA`);
    record("company isolation", crossCompany.status === 400 && !crossCompany.body.success, JSON.stringify(crossCompany.body));
    const crossCompanyPin = await api(otherToken, "GET", "/process/additive-issues?materialType=PIN&stepName=PIN");
    record("another company cannot see PIN component stock", crossCompanyPin.status === 200 && Number(crossCompanyPin.body.availableAdditiveStock) === 0, JSON.stringify(crossCompanyPin.body));
    await db.query("DELETE FROM users WHERE id = ?", [otherUserId]);
    await db.query("DELETE FROM companies WHERE id = ?", [otherCompanyId]);

    console.log(JSON.stringify({ success: true, runId, passed: results.length, failed: 0, results }, null, 2));
  } finally {
    try {
      if (created.companyId) {
        await db.query("DELETE FROM process_additive_stock_movements WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM process_step_additive_issues WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM process_step_recovery_inputs WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM stock WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM process_steps WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM process_lots WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM company_module_access WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM users WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM branches WHERE company_id = ?", [created.companyId]);
        await db.query("DELETE FROM companies WHERE id = ?", [created.companyId]);
      }
    } finally {
      await db.end();
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, runId, error: error.stack || error.message }, null, 2));
  process.exitCode = 1;
});
