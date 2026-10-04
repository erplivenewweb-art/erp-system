"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const { assertDisposableDatabaseTarget } = require("../js/backend/startupSafety");

const IMPORTANT_TABLES = [
  "companies",
  "branches",
  "stock",
  "sales_history",
  "sales_items",
  "invoice_sequences",
  "return_history",
  "branch_transfers",
  "branch_transfer_items",
  "branch_receive_logs",
  "process_lots",
  "process_steps",
  "karigar_work",
  "outside_karigar_ledger",
  "party_balance_summary",
  "metal_ledger",
  "expenses",
  "cash_ledger",
  "colour_jobs",
  "colour_job_payments",
  "company_module_access",
  "users"
];

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(3).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function getConnectionConfig(database) {
  return {
    host: String(process.env.MYSQLHOST || "").trim(),
    port: Number(process.env.MYSQLPORT || 3306),
    user: String(process.env.MYSQLUSER || "").trim(),
    password: process.env.MYSQLPASSWORD || "",
    ...(database ? { database } : {}),
    connectTimeout: 10000,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
  };
}

function getProtectedAndTarget() {
  const sourceDatabase = String(process.env.PROTECTED_BUSINESS_DATABASE || "").trim();
  const targetDatabase = String(getArg("target", process.env.MYSQLDATABASE || "")).trim();
  assertDisposableDatabaseTarget({
    ...process.env,
    MYSQLDATABASE: targetDatabase,
    PROTECTED_BUSINESS_DATABASE: sourceDatabase
  });
  return { sourceDatabase, targetDatabase };
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return { bufferSha256: crypto.createHash("sha256").update(value).digest("hex"), length: value.length };
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) normalized[key] = normalizeValue(value[key]);
    return normalized;
  }
  return value;
}

function hashRows(rows) {
  const canonicalRows = rows.map((row) => JSON.stringify(normalizeValue(row))).sort();
  const hash = crypto.createHash("sha256");
  for (const row of canonicalRows) hash.update(row).update("\n");
  return hash.digest("hex");
}

function hashObject(value) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizeValue(value))).digest("hex");
}

async function getServerIdentity(connection) {
  const [[row]] = await connection.query(
    "SELECT @@hostname AS serverHostname, @@port AS serverPort, @@version AS serverVersion"
  );
  return row;
}

async function databaseExists(connection, database) {
  const [rows] = await connection.execute(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
    [database]
  );
  return rows.length === 1;
}

async function cloneDatabase() {
  const { sourceDatabase, targetDatabase } = getProtectedAndTarget();
  const admin = await mysql.createConnection(getConnectionConfig());
  let target = null;
  try {
    const identity = await getServerIdentity(admin);
    if (!(await databaseExists(admin, sourceDatabase))) throw new Error("Protected source database does not exist");
    if (await databaseExists(admin, targetDatabase)) throw new Error("Disposable target already exists; refusing to overwrite it");

    const [[schema]] = await admin.execute(
      "SELECT DEFAULT_CHARACTER_SET_NAME AS charsetName, DEFAULT_COLLATION_NAME AS collationName FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [sourceDatabase]
    );
    console.log(JSON.stringify({
      safetyGate: "passed",
      sourceDatabase,
      targetDatabase,
      databasesAreDifferent: sourceDatabase.toLowerCase() !== targetDatabase.toLowerCase(),
      serverHostname: identity.serverHostname,
      serverPort: identity.serverPort
    }, null, 2));

    await admin.query(
      `CREATE DATABASE ${quoteIdentifier(targetDatabase)} CHARACTER SET ${quoteIdentifier(schema.charsetName)} COLLATE ${quoteIdentifier(schema.collationName)}`
    );
    target = await mysql.createConnection(getConnectionConfig(targetDatabase));
    await target.query("SET FOREIGN_KEY_CHECKS = 0");

    const [tables] = await admin.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      [sourceDatabase]
    );

    for (const { TABLE_NAME: table } of tables) {
      const [createRows] = await admin.query(
        `SHOW CREATE TABLE ${quoteIdentifier(sourceDatabase)}.${quoteIdentifier(table)}`
      );
      const createSql = createRows[0]["Create Table"].replace(
        /^CREATE TABLE `[^`]+`/,
        `CREATE TABLE ${quoteIdentifier(targetDatabase)}.${quoteIdentifier(table)}`
      );
      await target.query(createSql);
    }

    await target.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await target.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    try {
      for (const { TABLE_NAME: table } of tables) {
        const [columns] = await admin.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA NOT LIKE '%GENERATED%' ORDER BY ORDINAL_POSITION",
          [sourceDatabase, table]
        );
        if (!columns.length) continue;
        const columnList = columns.map(({ COLUMN_NAME }) => quoteIdentifier(COLUMN_NAME)).join(", ");
        await target.query(
          `INSERT INTO ${quoteIdentifier(targetDatabase)}.${quoteIdentifier(table)} (${columnList}) SELECT ${columnList} FROM ${quoteIdentifier(sourceDatabase)}.${quoteIdentifier(table)}`
        );
      }
      await target.commit();
    } catch (error) {
      await target.rollback();
      throw error;
    } finally {
      await target.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    const countMismatches = [];
    let totalRows = 0;
    for (const { TABLE_NAME: table } of tables) {
      const [[sourceCount]] = await admin.query(
        `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(sourceDatabase)}.${quoteIdentifier(table)}`
      );
      const [[targetCount]] = await target.query(`SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(table)}`);
      totalRows += Number(targetCount.rowCount);
      if (Number(sourceCount.rowCount) !== Number(targetCount.rowCount)) {
        countMismatches.push({ table, source: Number(sourceCount.rowCount), target: Number(targetCount.rowCount) });
      }
    }
    if (countMismatches.length) throw new Error(`Clone row-count verification failed for ${countMismatches.length} tables`);

    console.log(JSON.stringify({ clone: "complete", tableCount: tables.length, totalRows, rowCountMismatches: 0 }, null, 2));
  } finally {
    if (target) await target.end();
    await admin.end();
  }
}

async function countQuery(connection, sql) {
  const [[row]] = await connection.query(sql);
  return Number(row.issueCount || 0);
}

async function captureSnapshot() {
  const { sourceDatabase, targetDatabase } = getProtectedAndTarget();
  const output = path.resolve(getArg("output"));
  if (!getArg("output")) throw new Error("--output is required for snapshot");
  const connection = await mysql.createConnection(getConnectionConfig(targetDatabase));
  try {
    const identity = await getServerIdentity(connection);
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    const [columns] = await connection.execute(
      "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION"
    );
    const [indexes] = await connection.execute(
      "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX"
    );

    const tableFingerprints = {};
    for (const { TABLE_NAME: table } of tables) {
      const [rows] = await connection.query(`SELECT * FROM ${quoteIdentifier(table)}`);
      tableFingerprints[table] = { rowCount: rows.length, sha256: hashRows(rows) };
    }

    const importantCounts = {};
    for (const table of IMPORTANT_TABLES) {
      importantCounts[table] = tableFingerprints[table]?.rowCount ?? null;
    }

    const [[invoiceMetric]] = await connection.query(
      "SELECT COUNT(*) AS sequenceCount, COALESCE(MAX(last_number), 0) AS highestLastNumber, COALESCE(SUM(last_number), 0) AS sumLastNumber FROM invoice_sequences"
    );
    const [stockStates] = await connection.query(
      "SELECT UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, '(EMPTY)')) AS state, COUNT(*) AS rowCount FROM stock GROUP BY state ORDER BY state"
    );
    const [transferStates] = await connection.query(
      "SELECT UPPER(COALESCE(NULLIF(TRIM(status), ''), '(EMPTY)')) AS state, COUNT(*) AS rowCount FROM branch_transfers GROUP BY state ORDER BY state"
    );
    const [colourStates] = await connection.query(
      "SELECT UPPER(COALESCE(NULLIF(TRIM(status), ''), '(EMPTY)')) AS state, COUNT(*) AS rowCount FROM colour_jobs GROUP BY state ORDER BY state"
    );

    const invariants = {
      orphanBranches: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM branches b LEFT JOIN companies c ON c.id=b.company_id WHERE b.company_id IS NULL OR c.id IS NULL"),
      orphanStockCompanies: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM stock s LEFT JOIN companies c ON c.id=s.company_id WHERE s.company_id IS NULL OR c.id IS NULL"),
      stockBranchCompanyMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM stock s LEFT JOIN branches b ON b.id=s.current_branch_id WHERE s.current_branch_id IS NOT NULL AND (b.id IS NULL OR b.company_id<>s.company_id)"),
      duplicateActiveBarcodes: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM (SELECT company_id, active_barcode_key FROM stock WHERE active_barcode_key IS NOT NULL GROUP BY company_id, active_barcode_key HAVING COUNT(*)>1) d"),
      orphanOrCrossCompanySalesItems: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM sales_items si LEFT JOIN sales_history sh ON sh.id=si.sale_id WHERE sh.id IS NULL OR sh.company_id<>si.company_id"),
      returnScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM return_history r LEFT JOIN companies c ON c.id=r.company_id LEFT JOIN branches b ON b.id=r.branch_id WHERE c.id IS NULL OR (r.branch_id IS NOT NULL AND (b.id IS NULL OR b.company_id<>r.company_id))"),
      transferScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM branch_transfers t LEFT JOIN branches f ON f.id=t.from_branch_id LEFT JOIN branches d ON d.id=t.to_branch_id WHERE f.id IS NULL OR d.id IS NULL OR f.company_id<>t.company_id OR d.company_id<>t.company_id"),
      transferItemScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM branch_transfer_items i LEFT JOIN branch_transfers t ON t.id=i.transfer_id WHERE t.id IS NULL OR t.company_id<>i.company_id"),
      receiveLogScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM branch_receive_logs r LEFT JOIN branch_transfers t ON t.id=r.transfer_id WHERE t.id IS NULL OR t.company_id<>r.company_id"),
      processStepScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM process_steps s LEFT JOIN process_lots l ON l.id=s.process_lot_id WHERE l.id IS NULL OR l.company_id<>s.company_id"),
      karigarScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM outside_karigar_ledger k LEFT JOIN process_lots l ON l.id=k.process_lot_id WHERE k.process_lot_id IS NOT NULL AND (l.id IS NULL OR l.company_id<>k.company_id)"),
      partyBalanceScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM party_balance_summary s LEFT JOIN party_master p ON p.id=s.party_id WHERE p.id IS NULL OR p.company_id<>s.company_id"),
      metalLedgerScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM metal_ledger m LEFT JOIN party_master p ON p.id=m.party_id WHERE m.party_id IS NOT NULL AND (p.id IS NULL OR p.company_id<>m.company_id)"),
      expenseBranchScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM expenses e LEFT JOIN branches b ON b.id=e.branch_id WHERE e.branch_id IS NOT NULL AND (b.id IS NULL OR b.company_id<>e.company_id)"),
      cashLedgerBranchScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM cash_ledger l LEFT JOIN branches b ON b.id=l.branch_id WHERE l.branch_id IS NOT NULL AND (b.id IS NULL OR b.company_id<>l.company_id)"),
      colourJobScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM colour_jobs j LEFT JOIN branches b ON b.id=j.branch_id WHERE b.id IS NULL OR b.company_id<>j.company_id"),
      colourPaymentScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM colour_job_payments p LEFT JOIN colour_jobs j ON j.id=p.colour_job_id WHERE j.id IS NULL OR j.company_id<>p.company_id OR j.branch_id<>p.branch_id"),
      moduleAccessScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM company_module_access a LEFT JOIN companies c ON c.id=a.company_id WHERE c.id IS NULL"),
      invoiceSequenceScopeMismatch: await countQuery(connection, "SELECT COUNT(*) AS issueCount FROM invoice_sequences s LEFT JOIN companies c ON c.id=s.company_id WHERE c.id IS NULL")
    };

    const snapshot = {
      format: "phase2-disposable-snapshot-v1",
      capturedAt: new Date().toISOString(),
      sourceDatabase,
      targetDatabase,
      databasesAreDifferent: sourceDatabase.toLowerCase() !== targetDatabase.toLowerCase(),
      serverIdentity: identity,
      tableCount: tables.length,
      schema: {
        columnCount: columns.length,
        indexEntryCount: indexes.length,
        columnsSha256: hashObject(columns),
        indexesSha256: hashObject(indexes)
      },
      importantCounts,
      invoiceSequence: normalizeValue(invoiceMetric),
      stockStates: normalizeValue(stockStates),
      transferStates: normalizeValue(transferStates),
      colourJobStates: normalizeValue(colourStates),
      invariants,
      tableFingerprints
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({
      snapshot: path.basename(output),
      targetDatabase,
      tableCount: snapshot.tableCount,
      importantCounts,
      invoiceSequence: snapshot.invoiceSequence,
      stockStates: snapshot.stockStates,
      transferStates: snapshot.transferStates,
      colourJobStates: snapshot.colourJobStates,
      invariants
    }, null, 2));
  } finally {
    await connection.end();
  }
}

function compareSnapshots() {
  const beforePath = path.resolve(getArg("before"));
  const afterPath = path.resolve(getArg("after"));
  if (!getArg("before") || !getArg("after")) throw new Error("--before and --after are required for compare");
  const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
  const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
  if (before.targetDatabase !== after.targetDatabase) throw new Error("Snapshot targets do not match");

  const dataChanges = [];
  const allTables = [...new Set([...Object.keys(before.tableFingerprints), ...Object.keys(after.tableFingerprints)])].sort();
  for (const table of allTables) {
    const left = before.tableFingerprints[table] || null;
    const right = after.tableFingerprints[table] || null;
    if (JSON.stringify(left) !== JSON.stringify(right)) dataChanges.push({ table, before: left, after: right });
  }
  const schemaChanges = {
    tableCount: before.tableCount === after.tableCount ? null : { before: before.tableCount, after: after.tableCount },
    columnCount: before.schema.columnCount === after.schema.columnCount ? null : { before: before.schema.columnCount, after: after.schema.columnCount },
    indexEntryCount: before.schema.indexEntryCount === after.schema.indexEntryCount ? null : { before: before.schema.indexEntryCount, after: after.schema.indexEntryCount },
    columnsChanged: before.schema.columnsSha256 !== after.schema.columnsSha256,
    indexesChanged: before.schema.indexesSha256 !== after.schema.indexesSha256
  };
  const result = {
    targetDatabase: before.targetDatabase,
    schemaChanges,
    dataChangeCount: dataChanges.length,
    dataChanges,
    importantCountsChanged: JSON.stringify(before.importantCounts) !== JSON.stringify(after.importantCounts),
    invoiceSequenceChanged: JSON.stringify(before.invoiceSequence) !== JSON.stringify(after.invoiceSequence),
    invariantsChanged: JSON.stringify(before.invariants) !== JSON.stringify(after.invariants)
  };
  console.log(JSON.stringify(result, null, 2));
  if (dataChanges.length || result.importantCountsChanged || result.invoiceSequenceChanged || result.invariantsChanged) {
    process.exitCode = 2;
  }
}

async function main() {
  const command = String(process.argv[2] || "").trim().toLowerCase();
  if (command === "clone") return cloneDatabase();
  if (command === "snapshot") return captureSnapshot();
  if (command === "compare") return compareSnapshots();
  throw new Error("Expected command: clone, snapshot, or compare");
}

main().catch((error) => {
  console.error(`PHASE2_DATABASE_TOOL_FAILED name=${error.name || "Error"} code=${error.code || "UNKNOWN"} message=${error.message || "Unknown failure"}`);
  process.exitCode = 1;
});
