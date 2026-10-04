"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const baseUrl = String(process.env.COLOUR_PLANT_TEST_BASE_URL || "http://localhost:8081").replace(/\/+$/, "");

function tokenFor(user) {
  return jwt.sign({ userId: Number(user.id), role: user.role, companyId: Number(user.company_id) }, process.env.JWT_SECRET, { expiresIn: "10m" });
}

async function request(pathname, token, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT || 3306),
    connectionLimit: 2
  });
  let companyId = null;
  let jobId = null;
  const results = [];
  try {
    const [owners] = await pool.query(`SELECT id, role, company_id FROM users WHERE company_id IS NOT NULL AND LOWER(status)='approved' AND UPPER(role) IN ('OWNER','ADMIN') ORDER BY id LIMIT 1`);
    assert.ok(owners.length, "An approved owner is required for integration verification");
    const owner = owners[0];
    companyId = Number(owner.company_id);
    const token = tokenFor(owner);
    const [branches] = await pool.query("SELECT id FROM branches WHERE company_id=? AND status='ACTIVE' ORDER BY id LIMIT 1", [companyId]);
    const branchId = branches[0]?.id || null;
    const [[beforeStock]] = await pool.query("SELECT COUNT(*) count FROM stock WHERE company_id=?", [companyId]);
    const idempotencyKey = `cp-verify-${Date.now()}`;
    const createPayload = {
      idempotencyKey,
      branchId,
      customerName: "Sivam",
      mobile: "9000000000",
      workType: "Gold Colour",
      itemDescription: "Verification jewellery packet",
      qty: 1,
      receivedWeight: "100.000",
      rateType: "FLAT",
      rate: "2000.00",
      estimatedAmount: "2000.00",
      advancePayment: "500.00",
      paymentMode: "CASH",
      notes: "Automated Colour Plant verification; customer-owned material"
    };
    const created = await request("/colour-jobs", token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(createPayload) });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    jobId = Number(created.data.id);
    assert.match(created.data.jobNo, /^CLR-\d{6}-\d{3,}$/);
    results.push("create");

    const duplicateCreate = await request("/colour-jobs", token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(createPayload) });
    assert.equal(duplicateCreate.response.status, 200);
    assert.equal(Number(duplicateCreate.data.id), jobId);
    assert.equal(duplicateCreate.data.duplicate, true);
    results.push("create-idempotency");

    const invalidReady = await request(`/colour-jobs/${jobId}/status`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, status: "READY" }) });
    assert.equal(invalidReady.response.status, 409);
    results.push("invalid-transition-rejected");

    const ready = await request(`/colour-jobs/${jobId}/status`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, status: "READY", finalWeight: "99.850", finalAmount: "2000.00", weightWarningAcknowledged: true, remarks: "Verified -0.150 g difference" }) });
    assert.equal(ready.response.status, 200, JSON.stringify(ready.data));
    results.push("simplified-received-to-ready");

    const informed = await request(`/colour-jobs/${jobId}/customer-informed`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, remark: "Called customer — material ready" }) });
    assert.equal(informed.response.status, 200, JSON.stringify(informed.data));
    const duplicateInformed = await request(`/colour-jobs/${jobId}/customer-informed`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, remark: "Repeated click" }) });
    assert.equal(duplicateInformed.response.status, 200);
    assert.equal(duplicateInformed.data.duplicate, true);
    results.push("customer-informed-audit-and-duplicate-guard");

    const paymentKey = `${idempotencyKey}-final`;
    const paid = await request(`/colour-jobs/${jobId}/payments`, token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": paymentKey }, body: JSON.stringify({ branchId, amount: "1500.00", paymentMode: "UPI", paymentReference: "CP-VERIFY", idempotencyKey: paymentKey }) });
    assert.equal(paid.response.status, 201, JSON.stringify(paid.data));
    assert.equal(paid.data.balance, "0.00");
    const duplicatePayment = await request(`/colour-jobs/${jobId}/payments`, token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": paymentKey }, body: JSON.stringify({ branchId, amount: "1500.00", paymentMode: "UPI", idempotencyKey: paymentKey }) });
    assert.equal(duplicatePayment.response.status, 200);
    assert.equal(duplicatePayment.data.duplicate, true);
    results.push("payment-idempotency");

    const deliveryKey = `${idempotencyKey}-delivery`;
    const delivered = await request(`/colour-jobs/${jobId}/deliver`, token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": deliveryKey }, body: JSON.stringify({ branchId, idempotencyKey: deliveryKey, paymentAmount: "0.00", receivedBy: "Sivam", mobileConfirmation: "9000000000", remarks: "Verification delivery" }) });
    assert.equal(delivered.response.status, 200, JSON.stringify(delivered.data));
    const secondDelivery = await request(`/colour-jobs/${jobId}/deliver`, token, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": deliveryKey }, body: JSON.stringify({ branchId, idempotencyKey: deliveryKey, paymentAmount: "0.00" }) });
    assert.equal(secondDelivery.response.status, 409);
    assert.equal(secondDelivery.data.code, "ALREADY_DELIVERED");
    results.push("delivery-duplicate-guard");

    const detail = await request(`/colour-jobs/${jobId}${branchId ? `?branchId=${branchId}` : ""}`, token);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.job.received_weight, "100.000");
    assert.equal(detail.data.job.final_weight, "99.850");
    assert.equal(detail.data.job.weight_difference, "-0.150");
    assert.ok(detail.data.job.customer_informed_at);
    assert.equal(detail.data.job.total_paid, "2000.00");
    assert.equal(detail.data.job.status, "DELIVERED");
    const createdAudit = detail.data.auditEvents.find((event) => event.event_type === "JOB_CREATED");
    assert.ok(createdAudit, "Job creation audit must exist");
    const createdAuditData = typeof createdAudit.new_data === "string" ? JSON.parse(createdAudit.new_data) : createdAudit.new_data;
    assert.equal(createdAuditData.receivedWeight, "100.000");
    assert.ok(detail.data.auditEvents.some((event) => event.event_type === "CUSTOMER_INFORMED"));
    results.push("detail-ledger-totals");

    const receiptAudit = await request(`/colour-jobs/${jobId}/reprint`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, printType: "RECEIPT", reason: "Automated receipt verification" }) });
    assert.equal(receiptAudit.response.status, 200);
    const labelAudit = await request(`/colour-jobs/${jobId}/reprint`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, printType: "PACKET_LABEL", reason: "Automated label verification" }) });
    assert.equal(labelAudit.response.status, 200);
    results.push("receipt-and-label-audit");

    const jobRegister = await request(`/colour-jobs?search=${encodeURIComponent(created.data.jobNo)}${branchId ? `&branchId=${branchId}` : ""}`, token);
    assert.equal(jobRegister.response.status, 200);
    assert.equal(jobRegister.data.rows.length, 1);
    assert.equal(jobRegister.data.rows[0].balance, "0.00");
    const dashboard = await request(`/colour-jobs/dashboard${branchId ? `?branchId=${branchId}` : ""}`, token);
    assert.equal(dashboard.response.status, 200);
    assert.ok(Number(dashboard.data.summary.delivered_today) >= 1);
    const daily = await request(`/colour-jobs/reports/daily${branchId ? `?branchId=${branchId}` : ""}`, token);
    assert.equal(daily.response.status, 200, JSON.stringify(daily.data));
    assert.ok(daily.data.rows.some((row) => Number(row.jobs_received) >= 1 && Number(row.amount_collected) >= 2000));
    results.push("dashboard-and-report-totals");

    const [[afterStock]] = await pool.query("SELECT COUNT(*) count FROM stock WHERE company_id=?", [companyId]);
    assert.equal(Number(afterStock.count), Number(beforeStock.count));
    results.push("stock-isolation");

    const [otherUsers] = await pool.query(`SELECT id, role, company_id FROM users WHERE company_id IS NOT NULL AND company_id<>? AND LOWER(status)='approved' ORDER BY id LIMIT 1`, [companyId]);
    if (otherUsers.length) {
      const crossCompany = await request(`/colour-jobs/${jobId}`, tokenFor(otherUsers[0]));
      assert.equal(crossCompany.response.status, 404);
      results.push("cross-company-isolation");
    } else {
      results.push("cross-company-isolation:SKIPPED_NO_SECOND_COMPANY");
    }

    const [otherBranchUsers] = branchId ? await pool.query(`SELECT id, role, company_id FROM users WHERE company_id=? AND branch_id IS NOT NULL AND branch_id<>? AND LOWER(status)='approved' ORDER BY id LIMIT 1`, [companyId, branchId]) : [[]];
    if (otherBranchUsers.length) {
      const crossBranch = await request(`/colour-jobs/${jobId}`, tokenFor(otherBranchUsers[0]));
      assert.equal(crossBranch.response.status, 404);
      results.push("cross-branch-isolation");
    } else {
      results.push("cross-branch-isolation:SKIPPED_NO_OTHER_BRANCH_USER");
    }

    console.log(JSON.stringify({ success: true, jobNo: created.data.jobNo, results }, null, 2));
  } finally {
    if (jobId && companyId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM colour_job_audit_events WHERE company_id=? AND colour_job_id=?", [companyId, jobId]);
        await connection.query("DELETE FROM colour_job_payments WHERE company_id=? AND colour_job_id=?", [companyId, jobId]);
        await connection.query("DELETE FROM colour_job_status_history WHERE company_id=? AND colour_job_id=?", [companyId, jobId]);
        await connection.query("DELETE FROM audit_log WHERE company_id=? AND entity_type='COLOUR_JOB' AND entity_id=? AND module_name='colour_plant'", [companyId, String(jobId)]);
        await connection.query("DELETE FROM colour_jobs WHERE company_id=? AND id=?", [companyId, jobId]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
