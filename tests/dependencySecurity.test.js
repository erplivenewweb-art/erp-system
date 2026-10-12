"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const nodemailer = require("nodemailer");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const lock = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package-lock.json"), "utf8"));

function installedVersion(packageName) {
  return String(lock.packages?.[`node_modules/${packageName}`]?.version || "");
}

test("patched dependency graph keeps Express 4 and resolves every audited package", () => {
  assert.equal(installedVersion("express"), "4.22.2");
  assert.equal(installedVersion("body-parser"), "1.20.6");
  assert.equal(installedVersion("proxy-addr"), "2.0.8");
  assert.equal(installedVersion("qs"), "6.16.0");
  assert.equal(installedVersion("mysql2"), "3.24.5");
  assert.equal(installedVersion("nodemailer"), "10.1.0");
});

test("Nodemailer 10 preserves the ERP createTransport and sendMail contract offline", async () => {
  const transporter = nodemailer.createTransport({
    jsonTransport: true,
    disableFileAccess: true,
    disableUrlAccess: true
  });
  const result = await transporter.sendMail({
    from: "security-test@example.invalid",
    to: "recipient@example.invalid",
    subject: "Offline compatibility check",
    text: "No external SMTP connection is used."
  });

  assert.equal(typeof result.message, "string");
  const payload = JSON.parse(result.message);
  assert.equal(payload.subject, "Offline compatibility check");
  assert.equal(payload.text, "No external SMTP connection is used.");
});

test("mysql2 promise API required by the ERP remains available without connecting", async () => {
  const mysql = require("mysql2/promise");
  assert.equal(typeof mysql.createPool, "function");
  const pool = mysql.createPool({
    host: "non-routable.invalid",
    user: "unused",
    database: "unused",
    waitForConnections: false
  });
  await pool.end();
});
