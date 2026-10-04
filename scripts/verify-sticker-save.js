"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const mysql = require("mysql2/promise");
const { signAuthToken } = require("../js/backend/authMiddleware");

const API_BASE = process.env.STICKER_TEST_API_BASE || "http://localhost:8080";
const runId = `STKAUD${Date.now()}`;
const created = {
  companyIds: [],
  userIds: [],
  branchIds: [],
  processLotIds: [],
  lotNos: [],
  stockIds: []
};

function dbConfig() {
  return {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: Number(process.env.MYSQLPORT || 3306)
  };
}

function stickerItem(overrides = {}) {
  return {
    serial: "1",
    productName: "Audit Product",
    purity: "92.5",
    sku: `${runId}-SKU`,
    mm: "5",
    size: "M",
    weight: "1.000",
    qty: 1,
    lot: "",
    metalType: "Silver",
    processType: "Sankha",
    barcode: `${runId}-BC-${Math.random().toString(36).slice(2, 10)}`.toUpperCase(),
    ...overrides
  };
}

async function api(token, route, body) {
  const response = await fetch(`${API_BASE}${route}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { status: response.status, body: json };
}

async function addProcessLot(db, { companyId, userId, lotNo, weight, qty, manual = false, status = "COMPLETED", withStep = true }) {
  const [result] = await db.query(
    `INSERT INTO process_lots
      (company_id, lot_no, raw_weight, final_weight, expected_total_qty, work_category, status,
       is_manual_lot, manual_reason, manual_created_by, manual_created_at, completed_at, completed_by, created_by)
     VALUES (?, ?, ?, ?, ?, 'REGULAR_SANKHA', ?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [
      companyId,
      lotNo,
      weight,
      weight,
      qty,
      status,
      manual ? 1 : 0,
      manual ? "Sticker audit fixture" : null,
      manual ? userId : null,
      status === "COMPLETED" ? new Date() : null,
      status === "COMPLETED" ? userId : null,
      userId
    ]
  );
  const processLotId = Number(result.insertId);
  created.processLotIds.push(processLotId);
  created.lotNos.push(lotNo);

  if (withStep && !manual) {
    await db.query(
      `INSERT INTO process_steps
        (company_id, process_lot_id, lot_no, step_no, process_name, input_weight, output_weight,
         input_qty, output_qty, status, completed_at, created_by)
       VALUES (?, ?, ?, 1, 'Audit Complete', ?, ?, ?, ?, 'COMPLETED', NOW(), ?)`,
      [companyId, processLotId, lotNo, weight, weight, qty, qty, userId]
    );
  }
  return processLotId;
}

async function main() {
  const db = await mysql.createConnection(dbConfig());
  const results = [];
  const record = (name, passed, detail = "") => {
    results.push({ name, passed: Boolean(passed), detail });
    assert.equal(Boolean(passed), true, `${name}${detail ? `: ${detail}` : ""}`);
  };

  try {
    const [companyRows] = await db.query(
      `SELECT c.id
       FROM companies c
       JOIN company_module_access cma ON cma.company_id = c.id AND cma.module_key = 'STICKER' AND cma.enabled = 1
       WHERE c.deleted_at IS NULL AND UPPER(COALESCE(c.status, 'ACTIVE')) IN ('ACTIVE', 'APPROVED')
       ORDER BY c.id ASC LIMIT 1`
    );
    assert.ok(companyRows.length, "An approved Sticker-enabled company is required");
    const companyId = Number(companyRows[0].id);

    const [branchRows] = await db.query(
      "SELECT id FROM branches WHERE company_id = ? AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE' ORDER BY id ASC LIMIT 1",
      [companyId]
    );
    assert.ok(branchRows.length, "An active branch is required");
    const branchId = Number(branchRows[0].id);

    const [ownerResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, status, login_status)
       VALUES (?, ?, '!', 'OWNER', ?, 'approved', 'ENABLED')`,
      [`Sticker Audit Owner ${runId}`, `${runId.toLowerCase()}@audit.invalid`, companyId]
    );
    const ownerId = Number(ownerResult.insertId);
    created.userIds.push(ownerId);
    const ownerToken = signAuthToken({ id: ownerId, role: "OWNER", company_id: companyId });

    const lotNormal = `${runId}-NORMAL`;
    const lotMilli = `${runId}-MILLI`;
    const lotLimits = `${runId}-LIMITS`;
    const lotRaceWeight = `${runId}-RACEW`;
    const lotRaceSerial = `${runId}-RACES`;
    const lotNoOutput = `${runId}-NOOUTPUT`;
    const lotOpen = `${runId}-OPEN`;
    const lotManual = `${runId}-MANUAL`;
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotNormal, weight: "100.000", qty: 10 });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotMilli, weight: "0.003", qty: 3 });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotLimits, weight: "10.000", qty: 2 });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotRaceWeight, weight: "1.000", qty: 2 });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotRaceSerial, weight: "2.000", qty: 2 });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotNoOutput, weight: "5.000", qty: 1, withStep: false });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotOpen, weight: "5.000", qty: 1, status: "OPEN" });
    await addProcessLot(db, { companyId, userId: ownerId, lotNo: lotManual, weight: "0.000", qty: 0, manual: true, withStep: false });

    const normalItem = stickerItem({ lot: lotNormal, weight: "99.850", qty: 9, serial: "1", barcode: `${runId}-NORMAL-1` });
    const tamperedCompany = await api(ownerToken, "/addStickersBulk", { companyId: 999999, branchId, userId: 999999, items: [normalItem] });
    record("client company scope cannot be overridden", tamperedCompany.status === 403 && !tamperedCompany.body.success, JSON.stringify(tamperedCompany.body));
    const normal = await api(ownerToken, "/addStickersBulk", { companyId, branchId, userId: 999999, items: [normalItem] });
    record("normal save", normal.status === 200 && normal.body.success, JSON.stringify(normal.body));

    const [normalRows] = await db.query("SELECT * FROM stock WHERE company_id = ? AND barcode = ?", [companyId, normalItem.barcode]);
    assert.equal(normalRows.length, 1);
    created.stockIds.push(Number(normalRows[0].id));
    record("authenticated company/user/branch and stock fields", Number(normalRows[0].company_id) === companyId && Number(normalRows[0].created_by) === ownerId && Number(normalRows[0].current_branch_id) === branchId && Number(normalRows[0].qty) === 9 && String(normalRows[0].weight) === "99.850" && normalRows[0].product_name === normalItem.productName && normalRows[0].status === "IN_STOCK" && normalRows[0].stock_state === "IN_STOCK" && normalRows[0].active_barcode_key === normalItem.barcode);
    const [normalEvents] = await db.query("SELECT * FROM barcode_lifecycle_events WHERE company_id = ? AND stock_id = ? AND event_type = 'STICKER_CREATED'", [companyId, normalRows[0].id]);
    record("exactly one barcode lifecycle event", normalEvents.length === 1 && normalEvents[0].barcode === normalItem.barcode);

    const exactItem = stickerItem({ lot: lotNormal, weight: "0.150", qty: 1, serial: "2", barcode: `${runId}-NORMAL-2` });
    const exact = await api(ownerToken, "/addStickersBulk", { branchId, items: [exactItem] });
    record("exact remaining weight and qty", exact.status === 200 && exact.body.success, JSON.stringify(exact.body));

    const [partialUsageRows] = await db.query(
      "SELECT COUNT(*) c, COALESCE(SUM(COALESCE(NULLIF(billable_weight, 0), weight)), 0) weight, COALESCE(SUM(qty), 0) qty FROM stock WHERE company_id = ? AND lot_number = ? AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'",
      [companyId, lotNormal]
    );
    record("partial usage persisted exactly", Number(partialUsageRows[0].c) === 2 && String(partialUsageRows[0].weight) === "100.000" && Number(partialUsageRows[0].qty) === 10, JSON.stringify(partialUsageRows[0]));

    const overAfterPartial = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotNormal, weight: "0.001", qty: 1, serial: "3" })] });
    record("partial prior stickers block over-save", overAfterPartial.status === 400 && !overAfterPartial.body.success, JSON.stringify(overAfterPartial.body));

    const milliItems = [1, 2, 3].map((serial) => stickerItem({ lot: lotMilli, weight: "0.001", qty: 1, serial: String(serial), barcode: `${runId}-MILLI-${serial}` }));
    const milli = await api(ownerToken, "/addStickersBulk", { branchId, items: milliItems });
    record("0.001 decimal partials", milli.status === 200 && milli.body.success && milli.body.savedCount === 3, JSON.stringify(milli.body));

    const weightOver = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotLimits, weight: "10.001", qty: 1, serial: "1" })] });
    record("weight over limit", weightOver.status === 400 && !weightOver.body.success);
    const qtyOver = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotLimits, weight: "1.000", qty: 3, serial: "1" })] });
    record("qty over limit", qtyOver.status === 400 && !qtyOver.body.success);
    const bothOver = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotLimits, weight: "10.001", qty: 3, serial: "1" })] });
    record("weight and qty over limit", bothOver.status === 400 && !bothOver.body.success);

    const noOutput = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotNoOutput, serial: "1" })] });
    record("no completed process output", noOutput.status === 400 && !noOutput.body.success);
    const stale = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotOpen, serial: "1" })] });
    record("stale/open process state", stale.status === 400 && !stale.body.success);

    for (const [label, overrides] of [
      ["missing product", { productName: "" }],
      ["missing lot", { lot: "" }],
      ["missing barcode", { barcode: "" }],
      ["zero weight", { weight: "0.000" }],
      ["negative weight", { weight: "-0.001" }],
      ["malformed weight", { weight: "abc" }],
      ["over-precision weight", { weight: "0.0009" }],
      ["zero qty", { qty: 0 }],
      ["negative qty", { qty: -1 }],
      ["fractional qty", { qty: 1.5 }]
    ]) {
      const invalid = await api(ownerToken, "/addStickersBulk", { branchId, items: [stickerItem({ lot: lotManual, ...overrides })] });
      record(`invalid payload: ${label}`, invalid.status === 400 && !invalid.body.success, JSON.stringify(invalid.body));
    }

    const retryItem = stickerItem({ lot: lotManual, serial: "50", barcode: `${runId}-RETRY` });
    const retryOne = await api(ownerToken, "/addStickersBulk", { branchId, items: [retryItem] });
    const retryTwo = await api(ownerToken, "/addStickersBulk", { branchId, items: [retryItem] });
    const [retryRows] = await db.query("SELECT id FROM stock WHERE company_id = ? AND barcode = ?", [companyId, retryItem.barcode]);
    record("repeated request/duplicate barcode", retryOne.status === 200 && retryTwo.status === 409 && retryRows.length === 1, `${retryOne.status}/${retryTwo.status}`);

    await db.query("UPDATE stock SET status = 'SOLD', stock_state = 'SOLD', sold_at = NOW(), invoice_number = ? WHERE company_id = ? AND barcode = ?", [`${runId}-INV`, companyId, retryItem.barcode]);
    const soldSerialReuse = await api(ownerToken, "/addStickersBulk", {
      branchId,
      items: [stickerItem({ lot: lotManual, serial: "50", barcode: `${runId}-SOLD-SERIAL-REUSE` })]
    });
    const [soldSerialReuseRows] = await db.query("SELECT COUNT(*) c FROM stock WHERE company_id = ? AND lot_number = ? AND serial = '50'", [companyId, lotManual]);
    record("sold serial remains permanently reserved", soldSerialReuse.status === 400 && Number(soldSerialReuseRows[0].c) === 1, JSON.stringify(soldSerialReuse.body));

    const raceWeightItems = ["A", "B"].map((suffix) => stickerItem({ lot: lotRaceWeight, weight: "0.600", qty: 1, serial: suffix, barcode: `${runId}-RACEW-${suffix}` }));
    const raceWeightResults = await Promise.all(raceWeightItems.map((item) => api(ownerToken, "/addStickersBulk", { branchId, items: [item] })));
    const [raceWeightRows] = await db.query("SELECT COUNT(*) c, COALESCE(SUM(weight), 0) weight FROM stock WHERE company_id = ? AND lot_number = ?", [companyId, lotRaceWeight]);
    record("concurrent allowance locking", raceWeightResults.filter((x) => x.status === 200).length === 1 && Number(raceWeightRows[0].c) === 1 && String(raceWeightRows[0].weight) === "0.600", JSON.stringify(raceWeightResults.map((x) => x.status)));

    const raceSerialItems = ["A", "B"].map((suffix) => stickerItem({ lot: lotRaceSerial, weight: "0.500", qty: 1, serial: "1", barcode: `${runId}-RACES-${suffix}` }));
    const raceSerialResults = await Promise.all(raceSerialItems.map((item) => api(ownerToken, "/addStickersBulk", { branchId, items: [item] })));
    const [raceSerialRows] = await db.query("SELECT COUNT(*) c FROM stock WHERE company_id = ? AND lot_number = ? AND serial = '1'", [companyId, lotRaceSerial]);
    record("concurrent lot serial duplicate prevention", raceSerialResults.filter((x) => x.status === 200).length === 1 && Number(raceSerialRows[0].c) === 1, JSON.stringify(raceSerialResults.map((x) => x.status)));

    const rollbackFirst = stickerItem({ lot: lotManual, weight: "1.000", qty: 1, serial: "70", barcode: `${runId}-ROLLBACK-1` });
    const rollbackSecond = stickerItem({ lot: lotManual, weight: "99999999.999", qty: 1, serial: "71", barcode: `${runId}-ROLLBACK-2` });
    const rollback = await api(ownerToken, "/addStickersBulk", { branchId, items: [rollbackFirst, rollbackSecond] });
    const [rollbackRows] = await db.query("SELECT COUNT(*) c FROM stock WHERE company_id = ? AND barcode IN (?, ?)", [companyId, rollbackFirst.barcode, rollbackSecond.barcode]);
    const [rollbackEvents] = await db.query("SELECT COUNT(*) c FROM barcode_lifecycle_events WHERE company_id = ? AND barcode IN (?, ?)", [companyId, rollbackFirst.barcode, rollbackSecond.barcode]);
    record("transaction rollback", rollback.status >= 400 && Number(rollbackRows[0].c) === 0 && Number(rollbackEvents[0].c) === 0, JSON.stringify(rollback.body));

    const [secondCompanyResult] = await db.query(
      `INSERT INTO companies (company_name, owner_name, owner_email, status, access_status, login_status)
       VALUES (?, 'Audit', ?, 'approved', 'ACTIVE', 'ENABLED')`,
      [`Sticker Audit Company ${runId}`, `${runId.toLowerCase()}-company@audit.invalid`]
    );
    const company2 = Number(secondCompanyResult.insertId);
    created.companyIds.push(company2);
    await db.query("INSERT INTO company_module_access (company_id, module_key, enabled, source, reason) VALUES (?, 'STICKER', 1, 'OVERRIDE', 'Sticker audit')", [company2]);
    const [branch2Result] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, ?, 'Audit Main', 'MAIN', 'ACTIVE')`,
      [company2, `${runId.slice(-12)}B2`]
    );
    const branch2 = Number(branch2Result.insertId);
    created.branchIds.push(branch2);
    const [user2Result] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, status, login_status)
       VALUES (?, ?, '!', 'OWNER', ?, 'approved', 'ENABLED')`,
      [`Sticker Audit Other ${runId}`, `${runId.toLowerCase()}-other@audit.invalid`, company2]
    );
    const user2 = Number(user2Result.insertId);
    created.userIds.push(user2);
    const token2 = signAuthToken({ id: user2, role: "OWNER", company_id: company2 });
    const crossCompany = await api(token2, "/addStickersBulk", { companyId, branchId, items: [stickerItem({ lot: lotManual, serial: "80", barcode: `${runId}-CROSS-COMPANY` })] });
    const [crossCompanyRows] = await db.query("SELECT COUNT(*) c FROM stock WHERE barcode = ?", [`${runId}-CROSS-COMPANY`]);
    record("company isolation", crossCompany.status === 403 && Number(crossCompanyRows[0].c) === 0, JSON.stringify(crossCompany.body));

    const [otherBranchResult] = await db.query(
      `INSERT INTO branches (company_id, branch_code, branch_name, branch_type, status)
       VALUES (?, ?, 'Audit Other Branch', 'STORE', 'ACTIVE')`,
      [companyId, `${runId.slice(-12)}B3`]
    );
    const otherBranchId = Number(otherBranchResult.insertId);
    created.branchIds.push(otherBranchId);
    const [staffResult] = await db.query(
      `INSERT INTO users (name, email, password, role, company_id, status, branch_id, login_status)
       VALUES (?, ?, '!', 'STAFF', ?, 'approved', ?, 'ENABLED')`,
      [`Sticker Audit Staff ${runId}`, `${runId.toLowerCase()}-staff@audit.invalid`, companyId, branchId]
    );
    const staffId = Number(staffResult.insertId);
    created.userIds.push(staffId);
    const staffToken = signAuthToken({ id: staffId, role: "STAFF", company_id: companyId });
    const branchItem = stickerItem({ lot: lotManual, serial: "90", barcode: `${runId}-BRANCH` });
    const branchSave = await api(staffToken, "/addStickersBulk", { branchId: otherBranchId, branch_id: otherBranchId, items: [branchItem] });
    const [branchStockRows] = await db.query("SELECT current_branch_id FROM stock WHERE company_id = ? AND barcode = ?", [companyId, branchItem.barcode]);
    record("branch lock cannot be bypassed", branchSave.status === 200 && branchStockRows.length === 1 && Number(branchStockRows[0].current_branch_id) === branchId, JSON.stringify(branchSave.body));

    const legacyItem = stickerItem({ lot: lotManual, serial: "100", barcode: `${runId}-LEGACY` });
    const legacy = await api(ownerToken, "/addSticker", { branchId, ...legacyItem });
    const [legacyRows] = await db.query("SELECT id FROM stock WHERE company_id = ? AND barcode = ?", [companyId, legacyItem.barcode]);
    const [legacyEvents] = legacyRows.length ? await db.query("SELECT id FROM barcode_lifecycle_events WHERE company_id = ? AND stock_id = ? AND event_type = 'STICKER_CREATED'", [companyId, legacyRows[0].id]) : [[]];
    record("legacy single-save transaction", legacy.status === 200 && legacy.body.success && legacyRows.length === 1 && legacyEvents.length === 1, JSON.stringify(legacy.body));

    const [allTestStock] = await db.query("SELECT id FROM stock WHERE barcode LIKE ?", [`${runId}%`]);
    created.stockIds.push(...allTestStock.map((row) => Number(row.id)));

    console.log(JSON.stringify({ success: true, runId, passed: results.length, failed: 0, results }, null, 2));
  } finally {
    try {
      await db.query("DELETE FROM barcode_lifecycle_events WHERE barcode LIKE ?", [`${runId}%`]);
      await db.query("DELETE FROM stock WHERE barcode LIKE ?", [`${runId}%`]);
      if (created.stockIds.length) {
        const ids = [...new Set(created.stockIds)].filter(Boolean);
        if (ids.length) {
          await db.query(`DELETE FROM barcode_lifecycle_events WHERE stock_id IN (${ids.map(() => "?").join(",")})`, ids);
          await db.query(`DELETE FROM stock WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
        }
      }
      if (created.processLotIds.length) {
        await db.query(`DELETE FROM process_steps WHERE process_lot_id IN (${created.processLotIds.map(() => "?").join(",")})`, created.processLotIds);
        await db.query(`DELETE FROM process_lots WHERE id IN (${created.processLotIds.map(() => "?").join(",")})`, created.processLotIds);
      }
      await db.query("DELETE ps FROM process_steps ps JOIN process_lots pl ON pl.id = ps.process_lot_id WHERE pl.lot_no LIKE ?", [`${runId}%`]);
      await db.query("DELETE FROM process_lots WHERE lot_no LIKE ?", [`${runId}%`]);
      if (created.userIds.length) {
        await db.query(`DELETE FROM users WHERE id IN (${created.userIds.map(() => "?").join(",")})`, created.userIds);
      }
      for (const companyId of created.companyIds) {
        await db.query("DELETE FROM company_module_access WHERE company_id = ?", [companyId]);
        await db.query("DELETE FROM branches WHERE company_id = ?", [companyId]);
        await db.query("DELETE FROM companies WHERE id = ?", [companyId]);
      }
      for (const branchId of created.branchIds) {
        await db.query("DELETE FROM branches WHERE id = ?", [branchId]);
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
