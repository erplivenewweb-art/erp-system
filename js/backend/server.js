const path = require("path");
const fs = require("fs");
const LOCAL_ENV_FILE = path.resolve(__dirname, "..", "..", ".env");
require("dotenv").config({ path: LOCAL_ENV_FILE });

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const {
  AUTH_COOKIE_NAME,
  attachUserIfPresent,
  authMiddleware,
  checkRole,
  normalizeRoleValue,
  requirePageAuth,
  setAuthAccessValidator,
  signAuthToken
} = require("./authMiddleware");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 8080;
app.set("trust proxy", 1);
const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND_INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const FRONTEND_CSS_DIR = path.join(FRONTEND_ROOT, "css");
const FRONTEND_JS_DIR = path.join(FRONTEND_ROOT, "js");
const FRONTEND_ICONS_DIR = path.join(FRONTEND_ROOT, "icons");
const FRONTEND_MANIFEST_FILE = path.join(FRONTEND_ROOT, "manifest.json");
const FRONTEND_SERVICE_WORKER_FILE = path.join(FRONTEND_ROOT, "service-worker.js");
const PROTECTED_PAGES = new Set([
  "dashboard.html",
  "process.html",
  "sticker.html",
  "stock.html",
  "billing.html",
  "invoice.html",
  "settings.html",
  "staff-management.html",
  "material-stock.html",
  "daily-report.html",
  "expense-manager.html",
  "transaction.html",
  "transaction-reports.html",
  "return.html",
  "admin-approval.html",
  "company-plans.html",
  "enforcement-qa-dashboard.html",
  "sales-history.html",
  "branch-management.html",
  "branch-transfer.html",
  "branch-receive.html",
  "branch-transfer-history.html",
  "branch-shortage-report.html",
  "branch-analytics.html",
  "transfer-ageing-report.html",
  "shortage-analytics.html",
  "stock-movement-ledger.html",
  "branch-reconciliation.html",
  "branch-audit-dashboard.html",
  "branch-snapshots.html",
  "branch-reconciliation-runs.html",
  "branch-exception-queue.html"
]);

const DEFAULT_ALLOWED_APP_ORIGINS = [
  "http://localhost:8080"
];
const SUPERADMIN_OPERATIONAL_READ_ONLY_MESSAGE =
  "SuperAdmin support mode is read-only for ERP operational data.";
const OPERATIONAL_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const OPERATIONAL_MUTATION_PATHS = [
  "/addsticker",
  "/deletesticker/",
  "/expenses",
  "/invoice-drafts/",
  "/materialstock/",
  "/process/",
  "/returnitem/",
  "/restoresticker/",
  "/savebilling",
  "/saveinvoice",
  "/savereturn",
  "/sales-history/",
  "/branches",
  "/branch-transfers",
  "/branch-audit",
  "/transaction/parties",
  "/transaction/transactions",
  "/updatesticker/"
];
const ALLOWED_APP_ORIGINS = new Set(
  [
    ...DEFAULT_ALLOWED_APP_ORIGINS,
    ...String(process.env.APP_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
  ].filter(Boolean)
);

function isAllowedCorsOrigin(origin = "") {
  const cleanOrigin = String(origin || "").trim().replace(/\/+$/, "");
  if (!cleanOrigin) return true;
  if (ALLOWED_APP_ORIGINS.has(cleanOrigin)) return true;

  try {
    const url = new URL(cleanOrigin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return !isProductionRuntime();
    }
    return false;
  } catch (_) {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachUserIfPresent);
app.use(modulePreviewEnforcementMiddleware);

function isOperationalMutationPath(pathname = "") {
  const cleanPath = String(pathname || "").trim().toLowerCase();
  return OPERATIONAL_MUTATION_PATHS.some((path) => cleanPath === path || cleanPath.startsWith(path));
}

function enforceSuperAdminOperationalReadOnly(req, res, next) {
  const method = String(req.method || "").trim().toUpperCase();
  if (
    OPERATIONAL_MUTATION_METHODS.has(method) &&
    isOperationalMutationPath(req.path) &&
    isSuperAdminUser(req.user)
  ) {
    return res.status(403).json({
      success: false,
      message: SUPERADMIN_OPERATIONAL_READ_ONLY_MESSAGE
    });
  }

  return next();
}

app.use(enforceSuperAdminOperationalReadOnly);

const MYSQL_ENV_KEYS = [
  "MYSQLHOST",
  "MYSQLUSER",
  "MYSQLPASSWORD",
  "MYSQLDATABASE",
  "MYSQLPORT"
];

const SMTP_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_ENABLED",
  "SMTP_DEBUG"
];

const SMTP_REQUIRED_ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM"
];

const SMTP_PLACEHOLDER_VALUES = new Set([
  "smtp.your-provider.com",
  "your-email@example.com",
  "your-password",
  "your-smtp-user",
  "your-smtp-password",
  "your_16_digit_gmail_app_password",
  "yourgmail@gmail.com",
  "no-reply@your-domain.com"
]);

function getMissingEnvKeys(keys) {
  return keys.filter((key) => !String(process.env[key] || "").trim());
}

function getDuplicateLocalEnvKeys(keys) {
  const keySet = new Set(keys);
  const counts = {};

  try {
    const content = fs.readFileSync(LOCAL_ENV_FILE, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const cleanLine = String(line || "").trim();
      if (!cleanLine || cleanLine.startsWith("#")) return;

      const separatorIndex = cleanLine.indexOf("=");
      if (separatorIndex <= 0) return;

      const key = cleanLine.slice(0, separatorIndex).trim();
      if (!keySet.has(key)) return;

      counts[key] = (counts[key] || 0) + 1;
    });
  } catch (_) {
    return [];
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function isSmtpPlaceholderValue(value) {
  return SMTP_PLACEHOLDER_VALUES.has(String(value || "").trim().toLowerCase());
}

function getSmtpPlaceholderReasons() {
  const checks = [
    ["SMTP_HOST", process.env.SMTP_HOST],
    ["SMTP_USER", process.env.SMTP_USER],
    ["SMTP_FROM", process.env.SMTP_FROM]
  ];
  const reasons = checks
    .filter(([, value]) => isSmtpPlaceholderValue(value))
    .map(([key]) => `${key} placeholder`);

  const pass = String(process.env.SMTP_PASS || "").trim();
  if (!pass) {
    reasons.push("SMTP_PASS missing");
  } else if (isSmtpPlaceholderValue(pass)) {
    reasons.push("SMTP_PASS placeholder");
  }

  return reasons;
}

function hasPlaceholderSmtpConfig() {
  return getSmtpPlaceholderReasons().length > 0;
}

function getSmtpPlaceholderMessage() {
  const reasons = getSmtpPlaceholderReasons();
  return reasons.length
    ? `SMTP not configured: ${reasons.join(", ")}.`
    : "";
}

function getRequiredSmtpEnvListText() {
  return SMTP_REQUIRED_ENV_KEYS.join(", ");
}

function getSafeSmtpDiagnostic(error) {
  const rawMessage = String(error?.message || error || "SMTP verification failed").trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (!rawMessage) return "SMTP verification failed.";
  if (lowerMessage.includes("invalid login") || lowerMessage.includes("authentication") || lowerMessage.includes("auth")) {
    return "SMTP authentication failed. Check SMTP_USER and SMTP_PASS.";
  }
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "SMTP connection timed out. Check SMTP_HOST, SMTP_PORT, and network access.";
  }
  if (lowerMessage.includes("certificate") || lowerMessage.includes("tls") || lowerMessage.includes("ssl")) {
    return "SMTP TLS/SSL verification failed. Check SMTP_SECURE and SMTP_PORT.";
  }
  if (lowerMessage.includes("getaddrinfo") || lowerMessage.includes("enotfound") || lowerMessage.includes("econnrefused")) {
    return "SMTP server connection failed. Check SMTP_HOST and SMTP_PORT.";
  }

  return "SMTP verification failed. Check provider settings and credentials.";
}

function getEmailDomainOnly(value) {
  const clean = String(value || "").trim();
  const atIndex = clean.lastIndexOf("@");
  return atIndex >= 0 && clean.slice(atIndex + 1) ? clean.slice(atIndex + 1) : "(missing)";
}

function getSmtpPassState() {
  const pass = String(process.env.SMTP_PASS || "").trim();
  if (!pass) return "missing";
  if (isSmtpPlaceholderValue(pass)) return "placeholder";
  return `set length ${pass.length}`;
}

function parseEnvBoolean(value, fallback = false) {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!clean) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(clean)) return true;
  if (["0", "false", "no", "n", "off"].includes(clean)) return false;
  return fallback;
}

function isSmtpEnabled() {
  return parseEnvBoolean(process.env.SMTP_ENABLED, true);
}

function isSmtpDebugEnabled() {
  return parseEnvBoolean(process.env.SMTP_DEBUG, false);
}

function isLocalRuntime() {
  const rawPort = String(process.env.PORT || "").trim();
  return !rawPort || rawPort === "8080";
}

function isProductionRuntime() {
  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  const railwayEnv = String(process.env.RAILWAY_ENVIRONMENT || "").trim();

  if (nodeEnv === "production") return true;
  if (railwayEnv) return true;

  return !isLocalRuntime();
}

function canUseLocalDbDefaults() {
  return isLocalRuntime() && !isProductionRuntime();
}

function getEnvWithLocalDefault(key, fallback = "") {
  const value = String(process.env[key] || "").trim();
  if (value) return value;

  if (!canUseLocalDbDefaults()) {
    return fallback;
  }

  switch (key) {
    case "MYSQLHOST":
      return "127.0.0.1";
    case "MYSQLUSER":
      return "root";
    case "MYSQLDATABASE":
      return "erp_system";
    case "MYSQLPORT":
      return "3306";
    case "MYSQLPASSWORD":
      return "";
    default:
      return fallback;
  }
}

function logEnvStatus() {
  const missingMysqlEnv = getMissingEnvKeys(MYSQL_ENV_KEYS);
  const missingSmtpEnv = isSmtpEnabled() ? getMissingEnvKeys(SMTP_REQUIRED_ENV_KEYS) : [];
  const missingSuperAdminPassword = !String(process.env.SUPERADMIN_PASSWORD || "").trim();
  const duplicateSuperAdminKeys = getDuplicateLocalEnvKeys(["SUPERADMIN_PASSWORD"]);

  if (missingMysqlEnv.length && canUseLocalDbDefaults()) {
    console.warn(
      `[CONFIG] Missing MySQL environment variables: ${missingMysqlEnv.join(", ")}. Local DB defaults will be used for local startup only.`
    );
  } else if (missingMysqlEnv.length) {
    console.error(
      `[CONFIG] Missing MySQL environment variables: ${missingMysqlEnv.join(", ")}`
    );
  }

  if (missingSuperAdminPassword && isProductionRuntime()) {
    console.error(
      "[CONFIG] SUPERADMIN_PASSWORD is missing. Production startup will fail safely until it is set."
    );
  } else if (missingSuperAdminPassword) {
    console.warn(
      "[CONFIG] SUPERADMIN_PASSWORD is missing. Startup will fail safely until it is set."
    );
  }

  if (duplicateSuperAdminKeys.length) {
    console.warn(
      "[CONFIG] Duplicate SUPERADMIN_PASSWORD entries found in local .env. Dotenv uses the last value; remove duplicates to avoid login confusion."
    );
  }

  if (missingSmtpEnv.length) {
    console.warn(
      `[CONFIG] SMTP is enabled but incomplete. Missing: ${missingSmtpEnv.join(", ")}. Required: ${getRequiredSmtpEnvListText()}. OTP email features will stay unavailable. See SMTP_SETUP.md.`
    );
  }
}

const MYSQL_CONFIG = {
  host: getEnvWithLocalDefault("MYSQLHOST"),
  user: getEnvWithLocalDefault("MYSQLUSER"),
  password: getEnvWithLocalDefault("MYSQLPASSWORD"),
  database: getEnvWithLocalDefault("MYSQLDATABASE"),
  port: Number(getEnvWithLocalDefault("MYSQLPORT", "3306") || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000
};

const pool = mysql.createPool(MYSQL_CONFIG);

const startupStatus = {
  port: PORT,
  db: "pending",
  smtp: "pending"
};

function logDbStartupConfig() {
  console.log("[STARTUP] DB CONFIG:", {
    host: MYSQL_CONFIG.host || "(missing)",
    database: MYSQL_CONFIG.database || "(missing)",
    port: MYSQL_CONFIG.port
  });
}

function logSmtpStartupConfig() {
  const enabled = isSmtpEnabled();
  if (!isSmtpDebugEnabled()) {
    if (!enabled) {
      console.log("[STARTUP] SMTP disabled for local development.");
    }
    return;
  }

  console.log("[STARTUP] SMTP SAFE DEBUG:", {
    enabled,
    host: String(process.env.SMTP_HOST || "").trim() || "(missing)",
    port: String(process.env.SMTP_PORT || "").trim() || "(missing)",
    secure: String(process.env.SMTP_SECURE || "").trim() || "(missing)",
    userDomain: getEmailDomainOnly(process.env.SMTP_USER),
    fromDomain: getEmailDomainOnly(process.env.SMTP_FROM),
    passState: getSmtpPassState()
  });
}

function logPortStartupConfig() {
  console.log("[STARTUP] PORT CONFIG:", {
    raw: String(process.env.PORT || "").trim() || "(missing)",
    resolved: PORT
  });
}

function validateDbStartupEnv() {
  const missingMysqlEnv = MYSQL_ENV_KEYS.filter(
    (key) => !String(getEnvWithLocalDefault(key) || "").trim() && key !== "MYSQLPASSWORD"
  );

  if (missingMysqlEnv.length) {
    throw new Error(
      `Missing required MySQL environment variables: ${missingMysqlEnv.join(", ")}`
    );
  }
}

function validateSuperAdminStartupEnv() {
  const configuredSuperAdminPassword = String(process.env.SUPERADMIN_PASSWORD || "").trim();

  if (!configuredSuperAdminPassword) {
    throw new Error(
      "Missing required environment variable: SUPERADMIN_PASSWORD. Startup is blocked for safety."
    );
  }
}

function validateJwtStartupEnv() {
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();

  if (!jwtSecret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
}

function getErrorDetail(error) {
  if (isProductionRuntime()) return undefined;
  return error?.message || String(error || "Unknown error");
}

function getSafeErrorMessage(error, fallback = "Internal server error") {
  const message = String(error?.message || "").trim();

  if (!message) {
    return fallback;
  }

  if (message === "CORS origin not allowed") {
    return "Origin not allowed";
  }

  return isProductionRuntime() ? fallback : message;
}

function getRequestIpAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return String(
    req.ip ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      ""
  ).trim();
}

function maskDebugIdentifier(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";

  const atIndex = clean.indexOf("@");
  if (atIndex > 0) {
    const name = clean.slice(0, atIndex);
    const domain = clean.slice(atIndex + 1);
    const maskedName =
      name.length <= 2
        ? `${name[0] || "*"}***`
        : `${name.slice(0, 2)}***${name.slice(-1)}`;
    return `${maskedName}@${domain}`;
  }

  if (clean.length <= 4) return `${clean[0] || "*"}***`;
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

function safeJsonStringify(value) {
  try {
    if (value === undefined) return null;
    return JSON.stringify(value);
  } catch (_) {
    return null;
  }
}

function sanitizeAuditPayload(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditPayload(item));
  }

  if (typeof value === "object") {
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (/password|token|secret|otp|authorization|cookie/i.test(key)) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = sanitizeAuditPayload(item);
      }
    }
    return clean;
  }

  return value;
}

function getAuditRequestId(req) {
  const headerValue = String(req.headers["x-request-id"] || req.headers["x-correlation-id"] || "").trim();
  if (headerValue) return headerValue.slice(0, 80);

  if (!req.auditRequestId) {
    req.auditRequestId = crypto.randomUUID();
  }

  return req.auditRequestId;
}

function getAccessActorRole(access, fallback = "") {
  return String(
    access?.actingUser?.role ||
      access?.user?.role ||
      fallback ||
      ""
  ).trim();
}

async function logActivitySafe(connectionOrPool, req, access, details = {}) {
  try {
    const connection = connectionOrPool || pool;
    const companyId =
      details.company_id ??
      details.companyId ??
      access?.companyScope ??
      getRequestedCompanyId(req) ??
      null;
    const userId =
      details.user_id ??
      details.userId ??
      access?.actingUserId ??
      getRequestedUserId(req) ??
      null;

    await connection.query(
      `
      INSERT INTO audit_log
      (
        company_id,
        user_id,
        actor_role,
        action_type,
        entity_type,
        entity_id,
        module_name,
        route,
        method,
        status,
        message,
        before_data,
        after_data,
        metadata,
        request_id,
        ip_address,
        user_agent,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        companyId,
        userId,
        getAccessActorRole(access, details.actor_role ?? details.actorRole),
        String(details.action_type ?? details.actionType ?? "").trim(),
        String(details.entity_type ?? details.entityType ?? "").trim(),
        String(details.entity_id ?? details.entityId ?? "").trim(),
        String(details.module_name ?? details.moduleName ?? "").trim(),
        String(details.route ?? req.originalUrl ?? req.path ?? "").trim().slice(0, 255),
        String(details.method ?? req.method ?? "").trim().toUpperCase().slice(0, 16),
        String(details.status ?? "").trim().toLowerCase().slice(0, 30),
        String(details.message ?? "").trim().slice(0, 500),
        safeJsonStringify(sanitizeAuditPayload(details.before_data ?? details.beforeData)),
        safeJsonStringify(sanitizeAuditPayload(details.after_data ?? details.afterData)),
        safeJsonStringify(sanitizeAuditPayload(details.metadata)),
        String(details.request_id ?? details.requestId ?? getAuditRequestId(req)).trim().slice(0, 80),
        getRequestIpAddress(req),
        String(req.headers["user-agent"] || "").trim()
      ]
    );
  } catch (error) {
    console.error("Activity log write failed:", error);
  }
}

async function logOtpActivitySafe(connectionOrPool, req, access, phase, status, message, metadata = {}) {
  await logActivitySafe(connectionOrPool, req, access, {
    companyId: metadata.companyId ?? access?.companyScope ?? null,
    userId: metadata.userId ?? access?.actingUserId ?? null,
    actorRole: metadata.actorRole ?? access?.actingUser?.role ?? "",
    actionType: phase,
    entityType: "OTP",
    entityId: String(metadata.purpose || "").trim(),
    moduleName: "security",
    status,
    message,
    metadata: {
      ...metadata,
      email: maskDebugIdentifier(metadata.email)
    }
  });
}

async function writeAuditLogSafe(connection, req, audit) {
  await logActivitySafe(connection, req, null, audit);
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || "").trim(), 10);
}

function looksLikeBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

function requireAuthPage(req, res, next) {
  return requirePageAuth(req, res, next);
}

function format3(value) {
  const n = Number(value || 0);
  return Number.isNaN(n) ? "0.000" : n.toFixed(3);
}

function normalizeReturnType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "RETURN_TO_STOCK") return "RETURN_TO_STOCK";
  if (clean === "DAMAGED_RETURN") return "DAMAGED_RETURN";
  return "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

const OTP_PURPOSES = {
  SETTINGS_UNLOCK: "SETTINGS_UNLOCK",
  PASSWORD_RESET: "PASSWORD_RESET"
};

const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 10;
const OTP_SESSION_EXPIRY_MINUTES = 15;
const OTP_VERIFY_ATTEMPT_LIMIT = 5;
const OTP_REQUEST_LIMIT_WINDOW_MINUTES = 15;
const OTP_REQUEST_LIMIT_COUNT = 3;
const SMTP_CONNECTION_TIMEOUT_MS = 8000;
const SMTP_GREETING_TIMEOUT_MS = 8000;
const SMTP_SOCKET_TIMEOUT_MS = 12000;

let mailTransporter = null;
let smtpReady = false;
let smtpFailureMessage = "";

const EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE = "Email service is not configured. Please contact admin.";

function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getFutureDate(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function normalizeOtpPurpose(value) {
  const clean = String(value || "").trim().toUpperCase();
  return Object.values(OTP_PURPOSES).includes(clean) ? clean : "";
}

function getSmtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    enabled: isSmtpEnabled(),
    host: String(process.env.SMTP_HOST || "").trim(),
    port,
    secure: parseEnvBoolean(process.env.SMTP_SECURE, port === 465),
    user: String(process.env.SMTP_USER || "").trim(),
    pass: String(process.env.SMTP_PASS || "").trim(),
    from: String(process.env.SMTP_FROM || "").trim()
  };
}

function markSmtpUnavailable(message = EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE) {
  smtpReady = false;
  smtpFailureMessage = message;
  mailTransporter = null;
}

function assertSmtpAvailableForOtp() {
  const config = getSmtpConfig();
  if (!config.enabled || startupStatus.smtp === "disabled" || startupStatus.smtp === "failed") {
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  if (!smtpReady && startupStatus.smtp !== "connected") {
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  const missingSmtpEnv = getMissingEnvKeys(SMTP_REQUIRED_ENV_KEYS);
  if (missingSmtpEnv.length) {
    markSmtpUnavailable(`SMTP configuration is incomplete. Missing: ${missingSmtpEnv.join(", ")}`);
    startupStatus.smtp = "failed";
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  if (hasPlaceholderSmtpConfig()) {
    markSmtpUnavailable(getSmtpPlaceholderMessage());
    startupStatus.smtp = "failed";
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }
}

function getMailTransporter() {
  const config = getSmtpConfig();
  if (!config.enabled || startupStatus.smtp === "disabled" || startupStatus.smtp === "failed") {
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  if (!smtpReady && startupStatus.smtp !== "connected") {
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  if (mailTransporter) return mailTransporter;

  const missingSmtpEnv = getMissingEnvKeys(SMTP_REQUIRED_ENV_KEYS);
  if (missingSmtpEnv.length) {
    markSmtpUnavailable(`SMTP configuration is incomplete. Missing: ${missingSmtpEnv.join(", ")}`);
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  if (hasPlaceholderSmtpConfig()) {
    markSmtpUnavailable(getSmtpPlaceholderMessage());
    startupStatus.smtp = "failed";
    throw new Error(EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE);
  }

  // Gmail requires an App Password. A normal Gmail password will be rejected with 535-5.7.8.
  mailTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  mailTransporter._erpFromEmail = config.from;

  return mailTransporter;
}

async function testSmtpConnection() {
  const config = getSmtpConfig();
  if (!config.enabled) {
    startupStatus.smtp = "disabled";
    markSmtpUnavailable("SMTP disabled.");
    return;
  }

  const missingSmtpEnv = getMissingEnvKeys(SMTP_REQUIRED_ENV_KEYS);
  if (missingSmtpEnv.length) {
    startupStatus.smtp = "failed";
    markSmtpUnavailable(`SMTP configuration is incomplete. Missing: ${missingSmtpEnv.join(", ")}`);
    console.warn(
      `[STARTUP] SMTP is enabled but incomplete. Missing: ${missingSmtpEnv.join(", ")}. Required: ${getRequiredSmtpEnvListText()}. OTP email features are unavailable. See SMTP_SETUP.md.`
    );
    return;
  }

  if (hasPlaceholderSmtpConfig()) {
    startupStatus.smtp = "failed";
    const placeholderMessage = getSmtpPlaceholderMessage();
    markSmtpUnavailable(placeholderMessage);
    console.warn(`[STARTUP] ${placeholderMessage} Replace placeholder SMTP values. See SMTP_SETUP.md.`);
    return;
  }

  smtpReady = true;
  startupStatus.smtp = "pending";
  const transporter = getMailTransporter();
  try {
    await transporter.verify();
    smtpReady = true;
  } catch (error) {
    startupStatus.smtp = "failed";
    markSmtpUnavailable(getSafeSmtpDiagnostic(error));
    console.warn("[STARTUP] SMTP verification failed. Email features are disabled until SMTP settings are fixed.");
    console.warn(`[STARTUP] SMTP warning: ${smtpFailureMessage}`);
  }
}

async function sendOtpEmail({ email, toEmail, otp, otpCode, purpose }) {
  const transporter = getMailTransporter();
  const targetEmail = normalizeEmail(email || toEmail);
  const finalOtpCode = String(otp || otpCode || "").trim();
  const fromEmail = String(process.env.SMTP_FROM || "").trim() || transporter._erpFromEmail;

  if (!fromEmail) {
    throw new Error("SMTP_FROM is required");
  }

  if (!targetEmail) {
    throw new Error("OTP email target is missing");
  }

  if (!finalOtpCode) {
    throw new Error("OTP code is missing");
  }

  const isSettingsOtp = purpose === OTP_PURPOSES.SETTINGS_UNLOCK;
  const subject = isSettingsOtp ? "ERP Settings Unlock Code" : "ERP Password Reset Code";
  const heading = isSettingsOtp ? "Settings Unlock Verification" : "Password Reset Verification";
  const description = isSettingsOtp
    ? "Use the following verification code to unlock ERP settings."
    : "Use the following verification code to reset your ERP password.";

  await transporter.sendMail({
    from: fromEmail,
    to: targetEmail,
    subject,
    text: `${heading}\n\n${description}\n\nCode: ${finalOtpCode}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\nIf you did not request this code, you can ignore this email.`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;color:#0f172a;">
        <h2 style="margin:0 0 12px;font-size:22px;">${heading}</h2>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">${description}</p>
        <div style="margin:0 0 18px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:8px;">Verification Code</div>
          <div style="font-size:32px;font-weight:800;letter-spacing:0.24em;color:#b7791f;">${finalOtpCode}</div>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this code, you can safely ignore this email.</p>
      </div>
    `
  });
}

const PARTY_TYPES = [
  "CUSTOMER",
  "SUPPLIER",
  "KARIGAR",
  "CUSTOMER_SUPPLIER",
  "BULLION_PARTY",
  "INTERNAL"
];

const TRANSACTION_TYPES = [
  "OPENING_BALANCE",
  "SALE_INVOICE",
  "SALE_RETURN",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
  "PAYMENT_RECEIVED",
  "PAYMENT_GIVEN",
  "ADVANCE_RECEIVED",
  "ADVANCE_GIVEN",
  "CASH_ADJUSTMENT",
  "METAL_RECEIVED",
  "METAL_GIVEN",
  "METAL_ADJUSTMENT",
  "METAL_SETTLEMENT_RECEIVED",
  "METAL_SETTLEMENT_GIVEN",
  "KARIGAR_ISSUE",
  "KARIGAR_RECEIVE",
  "KARIGAR_LABOUR",
  "KARIGAR_LOSS_ADJUSTMENT",
  "RATE_DIFF_ADJUSTMENT",
  "INTERNAL_TRANSFER"
];

function normalizePartyType(value) {
  const clean = String(value || "").trim().toUpperCase();
  return PARTY_TYPES.includes(clean) ? clean : "";
}

function normalizeTransactionType(value) {
  const clean = String(value || "").trim().toUpperCase();
  return TRANSACTION_TYPES.includes(clean) ? clean : "";
}

function normalizeMetalType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "GOLD") return "GOLD";
  if (clean === "SILVER") return "SILVER";
  return "";
}

function normalizeCashEntryType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "DEBIT") return "DEBIT";
  if (clean === "CREDIT") return "CREDIT";
  return "";
}

function normalizeMetalEntryType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "IN") return "IN";
  if (clean === "OUT") return "OUT";
  return "";
}

function normalizeTransactionStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "DRAFT") return "DRAFT";
  if (clean === "CANCELLED") return "CANCELLED";
  return "POSTED";
}

function normalizeSettlementType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "CASH") return "CASH";
  if (clean === "METAL") return "METAL";
  if (clean === "ADJUSTMENT") return "ADJUSTMENT";
  if (clean === "MIXED") return "MIXED";
  return "";
}

function getDefaultCashEntryType(transactionType) {
  switch (transactionType) {
    case "SALE_INVOICE":
    case "PURCHASE_RETURN":
    case "PAYMENT_GIVEN":
    case "ADVANCE_GIVEN":
      return "DEBIT";
    case "PURCHASE_INVOICE":
    case "SALE_RETURN":
    case "PAYMENT_RECEIVED":
    case "ADVANCE_RECEIVED":
    case "KARIGAR_LABOUR":
      return "CREDIT";
    default:
      return "";
  }
}

function getDefaultMetalEntryType(transactionType) {
  switch (transactionType) {
    case "METAL_RECEIVED":
    case "METAL_SETTLEMENT_RECEIVED":
    case "KARIGAR_ISSUE":
      return "IN";
    case "METAL_GIVEN":
    case "METAL_SETTLEMENT_GIVEN":
    case "KARIGAR_RECEIVE":
      return "OUT";
    default:
      return "";
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function hasProvidedValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function parseRequiredNumber(value, fieldName) {
  if (!hasProvidedValue(value)) {
    return { ok: false, message: `${fieldName} is required` };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a valid number` };
  }

  return { ok: true, value: parsed };
}

function parseOptionalNumber(value, fieldName, fallback = 0) {
  if (!hasProvidedValue(value)) {
    return { ok: true, value: fallback, provided: false };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a valid number` };
  }

  return { ok: true, value: parsed, provided: true };
}

function parseAdditiveMaterialPayload(body = {}) {
  const givenRaw = body.additiveGivenWeight ?? body.additive_given_weight;
  const returnedRaw = body.additiveReturnedWeight ?? body.additive_returned_weight;
  const parsedGiven = parseOptionalNumber(givenRaw, "Additive material given weight", 0);
  if (!parsedGiven.ok) return parsedGiven;

  const parsedReturned = parseOptionalNumber(returnedRaw, "Additive material returned weight", 0);
  if (!parsedReturned.ok) return parsedReturned;

  const givenWeight = parsedGiven.value;
  const returnedWeight = parsedReturned.value;

  if (givenWeight < 0) {
    return { ok: false, message: "Additive material given weight cannot be negative" };
  }

  if (returnedWeight < 0) {
    return { ok: false, message: "Additive material returned weight cannot be negative" };
  }

  if (returnedWeight > givenWeight) {
    return { ok: false, message: "Additive material returned weight cannot be greater than given weight" };
  }

  return {
    ok: true,
    givenWeight,
    returnedWeight,
    usedWeight: givenWeight - returnedWeight,
    materialLabel: String(body.additiveMaterialLabel ?? body.additive_material_label ?? "").trim()
  };
}

function normalizeProcessLotStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean === "COMPLETED" ? "COMPLETED" : "OPEN";
}

function normalizeProcessLotNo(value) {
  return String(value || "").trim();
}

function normalizeKarigarName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProcessName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProcessLotRow(row) {
  return {
    ...row,
    status: normalizeProcessLotStatus(row.status),
    work_category: normalizeWorkCategory(row.work_category),
    workCategory: normalizeWorkCategory(row.workCategory ?? row.work_category),
    raw_weight: toNumber(row.raw_weight),
    loss_weight: toNumber(row.loss_weight),
    final_weight: toNumber(row.final_weight),
    total_khadi_count: toNumber(row.total_khadi_count),
    expected_total_qty: toNumber(row.expected_total_qty),
    is_manual_lot: Number(row.is_manual_lot || 0) ? 1 : 0
  };
}

function isManualProcessLot(processLot) {
  return Number(processLot?.is_manual_lot || 0) === 1;
}

function normalizeWorkCategory(value = "") {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (!clean) return "REGULAR_SANKHA";
  if (clean === "REGULAR" || clean === "SANKHA") return "REGULAR_SANKHA";
  if (clean === "JALI") return "JALI_SANKHA";
  return clean.slice(0, 40) || "REGULAR_SANKHA";
}

function getWorkCategoryDestination(workCategory) {
  const category = normalizeWorkCategory(workCategory);
  const directStockCategories = new Set(["KDM", "PIN"]);
  if (directStockCategories.has(category)) return "STOCK";
  return "STICKER";
}

function normalizeMaterialType(value = "") {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (!clean) return "KDM";
  if (clean === "SOLDERING" || clean === "SOLDER") return "SOLDER";
  return clean.slice(0, 60) || "KDM";
}

function normalizeKarigarWorkRow(row) {
  return {
    ...row,
    issue_weight: toNumber(row.issue_weight),
    receive_weight: toNumber(row.receive_weight),
    loss_weight: toNumber(row.loss_weight),
    labour_amount: toNumber(row.labour_amount)
  };
}

function normalizeProcessStepStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "OPEN") return "OPEN";
  if (clean === "CANCELLED") return "CANCELLED";
  return "COMPLETED";
}

function normalizeProcessStepRow(row) {
  return {
    ...row,
    process_lot_id: Number(row.process_lot_id || 0),
    processLotId: Number(row.processLotId ?? row.process_lot_id ?? 0),
    step_no: Number(row.step_no || 0),
    input_weight: toNumber(row.input_weight),
    output_weight: toNumber(row.output_weight),
    recovery_weight: toNumber(row.recovery_weight),
    recoveryWeight: toNumber(row.recoveryWeight ?? row.recovery_weight),
    loss_weight: toNumber(row.loss_weight),
    input_qty: toNumber(row.input_qty),
    output_qty: toNumber(row.output_qty),
    loss_qty: toNumber(row.loss_qty),
    additive_given_weight: toNumber(row.additive_given_weight),
    additive_returned_weight: toNumber(row.additive_returned_weight),
    additive_used_weight: toNumber(row.additive_used_weight),
    additiveGivenWeight: toNumber(row.additiveGivenWeight ?? row.additive_given_weight),
    additiveReturnedWeight: toNumber(row.additiveReturnedWeight ?? row.additive_returned_weight),
    additiveUsedWeight: toNumber(row.additiveUsedWeight ?? row.additive_used_weight),
    additive_material_label: String(row.additive_material_label || ""),
    additiveMaterialLabel: String(row.additiveMaterialLabel ?? row.additive_material_label ?? "")
  };
}

function normalizeAdditiveIssueRow(row) {
  return {
    ...row,
    company_id: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    process_step_id: Number(row.process_step_id || 0),
    karigar_id: row.karigar_id === null || row.karigar_id === undefined ? null : Number(row.karigar_id),
    given_weight: toNumber(row.given_weight),
    returned_weight: toNumber(row.returned_weight),
    used_weight: toNumber(row.used_weight),
    givenWeight: toNumber(row.given_weight),
    returnedWeight: toNumber(row.returned_weight),
    usedWeight: toNumber(row.used_weight),
    pendingWeight: Math.max(toNumber(row.given_weight) - toNumber(row.returned_weight), 0),
    stock_item_id: row.stock_item_id === null || row.stock_item_id === undefined ? null : Number(row.stock_item_id),
    issue_stock_movement_id: row.issue_stock_movement_id === null || row.issue_stock_movement_id === undefined ? null : Number(row.issue_stock_movement_id),
    return_stock_movement_id: row.return_stock_movement_id === null || row.return_stock_movement_id === undefined ? null : Number(row.return_stock_movement_id),
    stockItemId: row.stockItemId ?? (row.stock_item_id === null || row.stock_item_id === undefined ? null : Number(row.stock_item_id)),
    issueStockMovementId: row.issueStockMovementId ?? (row.issue_stock_movement_id === null || row.issue_stock_movement_id === undefined ? null : Number(row.issue_stock_movement_id)),
    returnStockMovementId: row.returnStockMovementId ?? (row.return_stock_movement_id === null || row.return_stock_movement_id === undefined ? null : Number(row.return_stock_movement_id)),
    materialLabel: String(row.material_label || ""),
    materialType: normalizeAdditiveMaterialType(row.material_label),
    karigarName: String(row.karigar_name || ""),
    lotNo: String(row.lot_no || "")
  };
}

function normalizeProcessMaterialIssueRow(row) {
  return {
    ...row,
    company_id: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
    process_step_id: row.process_step_id === null || row.process_step_id === undefined ? null : Number(row.process_step_id),
    karigar_id: row.karigar_id === null || row.karigar_id === undefined ? null : Number(row.karigar_id),
    work_category: normalizeWorkCategory(row.work_category),
    workCategory: normalizeWorkCategory(row.workCategory ?? row.work_category),
    material_type: normalizeMaterialType(row.material_type),
    materialType: normalizeMaterialType(row.materialType ?? row.material_type),
    given_weight: toNumber(row.given_weight),
    returned_weight: toNumber(row.returned_weight),
    used_weight: toNumber(row.used_weight),
    givenWeight: toNumber(row.given_weight),
    returnedWeight: toNumber(row.returned_weight),
    usedWeight: toNumber(row.used_weight),
    pendingWeight: Math.max(toNumber(row.given_weight) - toNumber(row.returned_weight), 0),
    karigarName: String(row.karigar_name || ""),
    lotNo: String(row.lot_no || ""),
    status: String(row.status || "ISSUED").trim().toUpperCase()
  };
}

function isOutsideKarigarCategory(workCategory) {
  const category = normalizeWorkCategory(workCategory);
  return category === "JALI_SANKHA" || category === "MANGALSUTRA";
}

function isOutsideIssueStep(stepName) {
  const normalizedStepName = normalizeTemplateStepName(stepName);
  return normalizedStepName === "khadi issue" || normalizedStepName === "outside issue";
}

function isOutsideReceiveStep(stepName) {
  const normalizedStepName = normalizeTemplateStepName(stepName);
  return normalizedStepName === "jali receive" || normalizedStepName === "receive";
}

function getOutsideLedgerStatus(issueWeight, receiveWeight) {
  const issued = toNumber(issueWeight);
  const received = toNumber(receiveWeight);
  if (received <= 0) return "ISSUED";
  if (received + 0.0005 < issued) return "PARTIAL_RECEIVED";
  return "RECEIVED";
}

async function syncOutsideKarigarLedgerForStep(connection, step, access = {}) {
  const processStep = normalizeProcessStepRow(step || {});
  const companyId = Number(access.companyScope ?? processStep.company_id ?? processStep.companyId ?? 0);
  if (!companyId || processStep.status !== "COMPLETED") return null;

  const processLot = await getProcessLotById(connection, companyId, processStep.process_lot_id);
  const workCategory = normalizeWorkCategory(processLot?.work_category || processLot?.workCategory);
  if (!processLot || !isOutsideKarigarCategory(workCategory)) return null;

  const stepName = processStep.process_name || processStep.processName || "";
  const normalizedStepName = normalizeTemplateStepName(stepName);
  const lotNo = normalizeProcessLotNo(processLot.lot_no || processLot.lotNo || processStep.lot_no);
  const karigarName = normalizeKarigarName(processStep.karigar_name || processStep.karigarName || "");
  const userId = Number(access.actingUserId || access.userId || processStep.created_by || 0) || null;
  const isCategoryIssueStep =
    (workCategory === "JALI_SANKHA" && normalizedStepName === "khadi issue") ||
    (workCategory === "MANGALSUTRA" && normalizedStepName === "outside issue");
  const isCategoryReceiveStep =
    (workCategory === "JALI_SANKHA" && normalizedStepName === "jali receive") ||
    (workCategory === "MANGALSUTRA" && normalizedStepName === "receive");

  if (isOutsideIssueStep(stepName) && isCategoryIssueStep) {
    const issueWeight = toNumber(processStep.output_weight) > 0
      ? toNumber(processStep.output_weight)
      : toNumber(processStep.input_weight);
    if (issueWeight <= 0) return null;

    const [existingRows] = await connection.query(
      `
      SELECT id
      FROM outside_karigar_ledger
      WHERE company_id = ?
        AND issue_step_id = ?
      LIMIT 1
      `,
      [companyId, processStep.id]
    );

    if (existingRows.length) return { ledgerId: Number(existingRows[0].id || 0), action: "ISSUE_EXISTS" };

    const pendingWeight = Math.max(issueWeight, 0);
    const [insertResult] = await connection.query(
      `
      INSERT INTO outside_karigar_ledger
      (
        company_id, process_lot_id, work_category, lot_no, issue_step_id,
        receive_step_id, karigar_name, issue_weight, receive_weight, pending_weight,
        issue_date, receive_date, status, notes, created_by
      )
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, NOW(), NULL, 'ISSUED', NULL, ?)
      `,
      [
        companyId,
        Number(processLot.id || 0),
        workCategory,
        lotNo,
        processStep.id,
        karigarName,
        Number(format3(issueWeight)),
        Number(format3(pendingWeight)),
        userId
      ]
    );

    return { ledgerId: Number(insertResult.insertId || 0), action: "ISSUED" };
  }

  if (isOutsideReceiveStep(stepName) && isCategoryReceiveStep) {
    const receiveWeight = toNumber(processStep.output_weight);
    if (receiveWeight <= 0) return null;

    const [existingReceiveRows] = await connection.query(
      `
      SELECT id
      FROM outside_karigar_ledger
      WHERE company_id = ?
        AND receive_step_id = ?
      LIMIT 1
      `,
      [companyId, processStep.id]
    );

    if (existingReceiveRows.length) {
      return { ledgerId: Number(existingReceiveRows[0].id || 0), action: "RECEIVE_EXISTS" };
    }

    const [ledgerRows] = await connection.query(
      `
      SELECT *
      FROM outside_karigar_ledger
      WHERE company_id = ?
        AND process_lot_id = ?
        AND work_category = ?
        AND lot_no = ?
        AND COALESCE(pending_weight, 0) > 0
        AND UPPER(COALESCE(status, 'ISSUED')) IN ('ISSUED', 'PARTIAL_RECEIVED')
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [companyId, Number(processLot.id || 0), workCategory, lotNo]
    );

    if (!ledgerRows.length) return null;

    const ledger = ledgerRows[0];
    const totalReceiveWeight = toNumber(ledger.receive_weight) + receiveWeight;
    const pendingWeight = Math.max(toNumber(ledger.issue_weight) - totalReceiveWeight, 0);
    const status = getOutsideLedgerStatus(ledger.issue_weight, totalReceiveWeight);

    await connection.query(
      `
      UPDATE outside_karigar_ledger
      SET receive_step_id = ?,
          karigar_name = COALESCE(NULLIF(?, ''), karigar_name),
          receive_weight = ?,
          pending_weight = ?,
          receive_date = NOW(),
          status = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [
        processStep.id,
        karigarName,
        Number(format3(totalReceiveWeight)),
        Number(format3(pendingWeight)),
        status,
        ledger.id
      ]
    );

    return { ledgerId: Number(ledger.id || 0), action: status };
  }

  return null;
}

function normalizeAdditiveMaterialType(value = "") {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (clean.includes("PIN")) return "PIN";
  if (clean.includes("KDM") || clean.includes("SOLDER")) return "KDM";
  return "";
}

function getAdditiveMaterialForStep(stepName = "") {
  const normalizedStepName = normalizeTemplateStepName(stepName);
  if (["soldering", "solding", "solder", "kdm"].includes(normalizedStepName)) return "KDM";
  if (normalizedStepName === "fitting") return "PIN";
  return "";
}

function getAdditiveStockSource(materialType = "KDM") {
  const material = normalizeAdditiveMaterialType(materialType) || "KDM";
  return material === "PIN" ? "PROCESS_PIN" : "PROCESS_KDM";
}

async function findAdditiveStockItemForCompany(connection, companyId, materialType = "KDM", { forUpdate = false } = {}) {
  const cleanCompanyId = Number(companyId || 0);
  if (!cleanCompanyId) return null;
  const material = normalizeAdditiveMaterialType(materialType) || "KDM";
  const source = getAdditiveStockSource(material);
  const likeMaterial = `%${material}%`;

  const [rows] = await connection.query(
    `
    SELECT *
    FROM stock
    WHERE company_id = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
      AND deleted_at IS NULL
      AND (
        UPPER(COALESCE(source, '')) = ?
        OR UPPER(COALESCE(category, '')) = ?
        OR UPPER(COALESCE(category, '')) LIKE ?
        OR UPPER(COALESCE(product_name, '')) = ?
        OR UPPER(COALESCE(product_name, '')) LIKE ?
      )
      AND (
        barcode IS NULL
        OR TRIM(COALESCE(barcode, '')) = ''
      )
    ORDER BY
      CASE WHEN UPPER(COALESCE(source, '')) = ? THEN 0 ELSE 1 END,
      CASE WHEN UPPER(COALESCE(category, '')) = ? THEN 0 ELSE 1 END,
      CASE WHEN UPPER(COALESCE(product_name, '')) = ? THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [cleanCompanyId, source, material, likeMaterial, material, likeMaterial, source, material, material]
  );

  return rows.length ? rows[0] : null;
}

async function getAdditiveStockItemById(connection, companyId, stockItemId, materialType = "KDM", { forUpdate = false } = {}) {
  const cleanCompanyId = Number(companyId || 0);
  const cleanStockItemId = Number(stockItemId || 0);
  if (!cleanCompanyId || !cleanStockItemId) return null;
  const material = normalizeAdditiveMaterialType(materialType) || "KDM";
  const source = getAdditiveStockSource(material);
  const likeMaterial = `%${material}%`;

  const [rows] = await connection.query(
    `
    SELECT *
    FROM stock
    WHERE company_id = ?
      AND id = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
      AND deleted_at IS NULL
      AND (
        UPPER(COALESCE(source, '')) = ?
        OR UPPER(COALESCE(category, '')) = ?
        OR UPPER(COALESCE(category, '')) LIKE ?
        OR UPPER(COALESCE(product_name, '')) = ?
        OR UPPER(COALESCE(product_name, '')) LIKE ?
      )
      AND (
        barcode IS NULL
        OR TRIM(COALESCE(barcode, '')) = ''
      )
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [cleanCompanyId, cleanStockItemId, source, material, likeMaterial, material, likeMaterial]
  );

  return rows.length ? rows[0] : null;
}

async function findKdmStockItemForCompany(connection, companyId, options = {}) {
  return findAdditiveStockItemForCompany(connection, companyId, "KDM", options);
}

async function getKdmStockItemById(connection, companyId, stockItemId, options = {}) {
  return getAdditiveStockItemById(connection, companyId, stockItemId, "KDM", options);
}

function getSellableStockFilterSql(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
    AND ${prefix}barcode IS NOT NULL
    AND TRIM(COALESCE(${prefix}barcode, '')) <> ''
    AND UPPER(COALESCE(${prefix}source, '')) NOT IN ('PROCESS_KDM', 'PROCESS_PIN', 'PROCESS_RECOVERY')
    AND UPPER(COALESCE(${prefix}category, '')) NOT IN ('KDM', 'PIN', 'RECOVERY')
    AND UPPER(COALESCE(${prefix}product_name, '')) NOT IN ('KDM', 'PIN', 'RECOVERY')
    AND UPPER(COALESCE(${prefix}product_name, '')) NOT LIKE 'RECOVERY SILVER%'
    AND UPPER(COALESCE(NULLIF(TRIM(${prefix}stock_state), ''), ${prefix}status, 'IN_STOCK')) NOT IN ('IN_TRANSIT', 'TRANSFER_SHORTAGE')
  `;
}

function getSellableFinishedStockWhereSql(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
    ${getSellableStockFilterSql(alias)}
    AND UPPER(COALESCE(${prefix}status, 'IN_STOCK')) <> 'DELETED'
  `;
}

async function createAdditiveStockMovement(connection, {
  companyId,
  stockItemId,
  processStepId,
  additiveIssueId,
  movementType,
  weight,
  beforeWeight,
  afterWeight,
  createdBy = null,
  notes = ""
}) {
  const [insertResult] = await connection.query(
    `
    INSERT INTO process_additive_stock_movements
    (
      company_id, stock_item_id, process_step_id, additive_issue_id,
      movement_type, weight, before_weight, after_weight, notes, created_by, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      companyId,
      stockItemId,
      processStepId,
      additiveIssueId,
      movementType,
      Number(format3(weight)),
      Number(format3(beforeWeight)),
      Number(format3(afterWeight)),
      notes,
      createdBy
    ]
  );

  return Number(insertResult.insertId || 0);
}

async function getProcessStepAdditiveIssueTotals(connection, companyId, processStepId, { forUpdate = false } = {}) {
  const [issueRows] = await connection.query(
    `
    SELECT given_weight, returned_weight, used_weight, material_label
    FROM process_step_additive_issues
    WHERE company_id = ?
      AND process_step_id = ?
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [companyId, processStepId]
  );

  const totalGiven = issueRows.reduce((sum, row) => sum + toNumber(row.given_weight), 0);
  const totalReturned = issueRows.reduce((sum, row) => sum + toNumber(row.returned_weight), 0);
  const totalUsed = issueRows.reduce((sum, row) => {
    const usedWeight = hasProvidedValue(row.used_weight)
      ? toNumber(row.used_weight)
      : toNumber(row.given_weight) - toNumber(row.returned_weight);
    return sum + Math.max(usedWeight, 0);
  }, 0);
  const pendingWeight = Math.max(totalGiven - totalReturned, 0);
  const materialLabel = String(issueRows.find((row) => String(row.material_label || "").trim())?.material_label || "").trim();

  return {
    additiveGivenWeight: totalGiven,
    additiveReturnedWeight: totalReturned,
    additiveUsedWeight: totalUsed,
    additiveMaterialLabel: materialLabel,
    pendingWeight,
    issueCount: issueRows.length
  };
}

async function recalcProcessStepAdditiveTotals(connection, companyId, processStepId, options = {}) {
  const totals = await getProcessStepAdditiveIssueTotals(connection, companyId, processStepId, options);

  await connection.query(
    `
    UPDATE process_steps
    SET additive_given_weight = ?,
        additive_returned_weight = ?,
        additive_used_weight = ?,
        additive_material_label = ?
    WHERE company_id = ?
      AND id = ?
    `,
    [
      totals.additiveGivenWeight,
      totals.additiveReturnedWeight,
      totals.additiveUsedWeight,
      totals.additiveMaterialLabel,
      companyId,
      processStepId
    ]
  );

  return totals;
}

async function ensureProcessRecoveryStockEntry(connection, {
  companyId,
  createdBy,
  lotNo,
  stepId,
  recoveryWeight
}) {
  const cleanStepId = String(stepId || "").trim();
  const cleanLotNo = normalizeProcessLotNo(lotNo);
  const safeRecoveryWeight = toNumber(recoveryWeight);

  if (!cleanStepId || safeRecoveryWeight <= 0) {
    return { inserted: false, reason: "NO_RECOVERY" };
  }

  const [existingRows] = await connection.query(
    `
    SELECT id
    FROM stock
    WHERE company_id = ?
      AND reference_step_id = ?
    LIMIT 1
    `,
    [companyId, cleanStepId]
  );

  if (existingRows.length) {
    return { inserted: false, reason: "DUPLICATE_EXISTS", stockId: existingRows[0].id };
  }

  const [insertResult] = await connection.query(
    `
    INSERT INTO stock
    (
      product_name,
      category,
      weight,
      qty,
      lot_number,
      status,
      source,
      reference_step_id,
      company_id,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      cleanLotNo ? `Recovery Silver (${cleanLotNo})` : "Recovery Silver",
      "RECOVERY",
      Number(safeRecoveryWeight.toFixed(3)),
      0,
      cleanLotNo,
      "IN_STOCK",
      "PROCESS_RECOVERY",
      cleanStepId,
      companyId,
      createdBy || null
    ]
  );

  return { inserted: true, stockId: insertResult.insertId };
}

function normalizeExpenseRow(row) {
  return {
    ...row,
    amount: toNumber(row.amount)
  };
}

function normalizeCompanySettingsRow(row) {
  const base = {
    ownerEmail: "",
    top_title: "",
    company_name: "",
    gstin: "",
    account_no: "",
    ifsc: "",
    address: "",
    declaration: "",
    upi_id: "",
    upi_name: "",
    business_state: "Odisha",
    default_bill_type: "GST",
    default_tax_type: "CGST_SGST",
    default_rate_per_gram: 0,
    default_mc_rate: 0,
    subscription_plan: "basic",
    subscription_status: "active",
    subscription_start_date: "",
    subscription_end_date: ""
  };

  if (!row) return base;

  return {
    ownerEmail: String(row.owner_email || "").trim(),
    top_title: String(row.top_title || "").trim(),
    company_name: String(row.company_name || "").trim(),
    gstin: String(row.gstin || "").trim(),
    account_no: String(row.account_no || "").trim(),
    ifsc: String(row.ifsc || "").trim(),
    address: String(row.address || "").trim(),
    declaration: String(row.declaration || "").trim(),
    upi_id: String(row.upi_id || "").trim(),
    upi_name: String(row.upi_name || "").trim(),
    business_state: String(row.business_state || "Odisha").trim() || "Odisha",
    default_bill_type: String(row.default_bill_type || "GST").trim() || "GST",
    default_tax_type: String(row.default_tax_type || "CGST_SGST").trim() || "CGST_SGST",
    default_rate_per_gram: toNumber(row.default_rate_per_gram),
    default_mc_rate: toNumber(row.default_mc_rate),
    subscription_plan: String(row.subscription_plan || "basic").trim() || "basic",
    subscription_status: String(row.subscription_status || "active").trim() || "active",
    subscription_start_date: row.subscription_start_date || "",
    subscription_end_date: row.subscription_end_date || ""
  };
}

function mapInvoiceDraftPayload(draftRow, itemRows) {
  const safeDraft = draftRow || null;
  const items = Array.isArray(itemRows) ? itemRows : [];
  const pendingItems = items
    .filter((item) => String(item.item_stage || "").trim().toUpperCase() === "PENDING")
    .map((item) => ({
      id: item.id,
      barcode: item.barcode || "",
      productName: item.product_name || "",
      sku: item.sku || "",
      weight: toNumber(item.weight),
      purity: item.purity || "",
      size: item.size || "",
      lot: item.lot_number || "",
      company_id: item.company_id
    }));
  const processedItems = items
    .filter((item) => String(item.item_stage || "").trim().toUpperCase() === "READY")
    .map((item) => ({
      id: item.id,
      barcode: item.barcode || "",
      productName: item.product_name || "",
      sku: item.sku || "",
      weight: toNumber(item.weight),
      purity: item.purity || "",
      size: item.size || "",
      lot: item.lot_number || "",
      customerName: safeDraft?.customer_name || "",
      mobile: safeDraft?.mobile || "",
      invoiceDate: safeDraft?.invoice_date || "",
      invoiceNumber: safeDraft?.invoice_number || "",
      company_id: item.company_id
    }));

  return {
    draft: safeDraft
      ? {
          id: safeDraft.id,
          customerName: safeDraft.customer_name || "",
          mobile: safeDraft.mobile || "",
          invoiceNumber: safeDraft.invoice_number || "",
          invoiceDate: safeDraft.invoice_date || "",
          status: safeDraft.status || "DRAFT",
          company_id: safeDraft.company_id,
          created_by: safeDraft.created_by,
          updated_at: safeDraft.updated_at,
          created_at: safeDraft.created_at
        }
      : null,
    pendingItems,
    processedItems,
    items: [...pendingItems, ...processedItems]
  };
}

function parseBooleanLike(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

const BILLING_AMOUNT_TOLERANCE = 1;
const BILLING_WEIGHT_TOLERANCE = 0.001;

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function isAmountClose(actual, expected, tolerance = BILLING_AMOUNT_TOLERANCE) {
  return Math.abs(roundMoney(actual) - roundMoney(expected)) <= tolerance;
}

function isWeightClose(actual, expected, tolerance = BILLING_WEIGHT_TOLERANCE) {
  return Math.abs(Number(actual || 0) - Number(expected || 0)) <= tolerance;
}

function hasMeaningfulNumber(value) {
  return value !== null && value !== undefined && value !== "" && !Number.isNaN(Number(value));
}

function getBillingTaxModes(billType, taxType) {
  const cleanBillType = String(billType || "").trim().toUpperCase();
  const cleanTaxType = String(taxType || "").trim().toUpperCase();

  if (cleanBillType) {
    return [
      {
        billType: cleanBillType,
        taxType: cleanTaxType || "CGST_SGST",
        taxRate: cleanBillType === "GST" ? 0.03 : 0
      }
    ];
  }

  return [
    { billType: "GST", taxType: cleanTaxType || "CGST_SGST", taxRate: 0.03 },
    { billType: "NON_GST", taxType: cleanTaxType || "", taxRate: 0 }
  ];
}

function calculateBillingServerTotals(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const sellingRate = toNumber(payload.sellingRatePerGram || payload.ratePerGram);
  const companyRate = toNumber(payload.companyRatePerGram || payload.ratePerGram);
  const mcRate = toNumber(payload.mcRate);
  const roundOff = toNumber(payload.roundOff);

  const lines = items.map((item, index) => {
    const weight = toNumber(item.weight);
    const purity = toNumber(item.purity) > 0 ? toNumber(item.purity) : 100;
    const pureWeight = (weight * purity) / 100;
    const makingCharge = hasMeaningfulNumber(item.makingChargeAmount ?? item.making_charge_amount)
      ? toNumber(item.makingChargeAmount ?? item.making_charge_amount)
      : weight * mcRate;
    const customerLineAmount = pureWeight * sellingRate + makingCharge;
    const companyLineAmount = pureWeight * companyRate + makingCharge;
    const employeeMarginAmount = customerLineAmount - companyLineAmount;

    return {
      lineNo: index + 1,
      barcode: String(item.barcode || "").trim(),
      itemName: String(item.itemName || item.productName || item.product_name || "").trim(),
      lotNumber: String(item.lot || item.lot_number || "").trim(),
      weight,
      purity,
      pureWeight,
      makingCharge,
      sellingRatePerGram: sellingRate,
      companyRatePerGram: companyRate,
      customerLineAmount,
      companyLineAmount,
      employeeMarginAmount
    };
  });

  const totalWeight = lines.reduce((sum, line) => sum + line.weight, 0);
  const customerSubtotal = lines.reduce((sum, line) => sum + line.customerLineAmount, 0);
  const companySubtotal = lines.reduce((sum, line) => sum + line.companyLineAmount, 0);

  const candidates = getBillingTaxModes(payload.billType, payload.taxType).map((mode) => {
    const customerTax = customerSubtotal * mode.taxRate;
    const companyTax = companySubtotal * mode.taxRate;
    const customerTotal = customerSubtotal + customerTax + roundOff;
    const companyTotal = companySubtotal + companyTax;
    const isCgstSgst = mode.billType === "GST" && mode.taxType !== "IGST";
    const isIgst = mode.billType === "GST" && mode.taxType === "IGST";

    return {
      ...mode,
      totalItems: lines.length,
      totalWeight,
      subtotal: customerSubtotal,
      customerSubtotal,
      companySubtotal,
      cgst: isCgstSgst ? customerTax / 2 : 0,
      sgst: isCgstSgst ? customerTax / 2 : 0,
      igst: isIgst ? customerTax : 0,
      gstAmount: customerTax,
      companyCgst: isCgstSgst ? companyTax / 2 : 0,
      companySgst: isCgstSgst ? companyTax / 2 : 0,
      companyIgst: isIgst ? companyTax : 0,
      companyGstAmount: companyTax,
      roundOff,
      customerTotal,
      totalAmount: customerTotal,
      companyTotal,
      employeeMargin: customerTotal - companyTotal,
      lines
    };
  });

  return {
    totalItems: lines.length,
    totalWeight,
    subtotal: customerSubtotal,
    customerSubtotal,
    companySubtotal,
    lines,
    candidates
  };
}

function validateBillingTotals(payload) {
  const serverTotals = calculateBillingServerTotals(payload);
  const expectedCandidates = serverTotals.candidates;
  const submittedTotal = toNumber(payload.totalAmount || payload.customerTotal);
  const submittedCustomerTotal = toNumber(payload.customerTotal || payload.totalAmount);
  const submittedSubtotal = toNumber(payload.customerSubtotal || payload.subtotal);
  const submittedCompanyTotal = toNumber(payload.companyTotal);
  const submittedEmployeeMargin = toNumber(payload.employeeMargin);
  const submittedTotalWeight = toNumber(payload.totalWeight);
  const paidAmount = toNumber(payload.paidAmount);
  const dueAmount = toNumber(payload.dueAmount);

  const matchedTotals = expectedCandidates.find((expected) => {
    const subtotalOk = isAmountClose(submittedSubtotal, expected.subtotal);
    const totalOk =
      isAmountClose(submittedTotal, expected.totalAmount) &&
      isAmountClose(submittedCustomerTotal, expected.customerTotal);
    const companyTotalOk = isAmountClose(submittedCompanyTotal, expected.companyTotal);
    const marginOk = isAmountClose(submittedEmployeeMargin, expected.employeeMargin);
    const weightOk = isWeightClose(submittedTotalWeight, expected.totalWeight);

    return subtotalOk && totalOk && companyTotalOk && marginOk && weightOk;
  });

  if (!matchedTotals) {
    return {
      ok: false,
      message: "Billing total mismatch. Please recalculate and try again."
    };
  }

  if (paidAmount < 0 || dueAmount < 0) {
    return {
      ok: false,
      message: "Billing total mismatch. Please recalculate and try again."
    };
  }

  const maxPayable = Math.max(submittedTotal, submittedCustomerTotal, submittedCompanyTotal);
  if (paidAmount + dueAmount > maxPayable + BILLING_AMOUNT_TOLERANCE) {
    return {
      ok: false,
      message: "Billing total mismatch. Please recalculate and try again."
    };
  }

  return {
    ok: true,
    totals: matchedTotals
  };
}

function getTodayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

async function generateInvoiceNumberForCompany(connection, companyId, billDate, prefix = "BILL") {
  const cleanCompanyId = Number(companyId || 0);
  const cleanPrefix =
    String(prefix || "BILL")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 20) || "BILL";
  const parsedBillDate = hasProvidedValue(billDate) ? new Date(billDate) : new Date();
  const sequenceYear = Number.isNaN(parsedBillDate.getTime())
    ? new Date().getFullYear()
    : parsedBillDate.getFullYear();

  if (!connection || typeof connection.query !== "function") {
    throw new Error("A transaction connection is required to generate invoice number");
  }

  if (!cleanCompanyId) {
    throw new Error("Company id is required to generate invoice number");
  }

  const selectSequenceSql = `
    SELECT id, last_number
    FROM invoice_sequences
    WHERE company_id = ?
      AND sequence_year = ?
      AND prefix = ?
    LIMIT 1
    FOR UPDATE
  `;

  let [sequenceRows] = await connection.query(selectSequenceSql, [
    cleanCompanyId,
    sequenceYear,
    cleanPrefix
  ]);

  if (!sequenceRows.length) {
    try {
      await connection.query(
        `
        INSERT INTO invoice_sequences (company_id, prefix, sequence_year, last_number)
        VALUES (?, ?, ?, 0)
        `,
        [cleanCompanyId, cleanPrefix, sequenceYear]
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") {
        throw error;
      }
    }

    [sequenceRows] = await connection.query(selectSequenceSql, [
      cleanCompanyId,
      sequenceYear,
      cleanPrefix
    ]);
  }

  if (!sequenceRows.length) {
    throw new Error("Invoice sequence row could not be locked");
  }

  const nextNumber = Number(sequenceRows[0].last_number || 0) + 1;

  await connection.query(
    `
    UPDATE invoice_sequences
    SET last_number = ?
    WHERE id = ?
    `,
    [nextNumber, sequenceRows[0].id]
  );

  return `${cleanPrefix}-${sequenceYear}-${String(nextNumber).padStart(6, "0")}`;
}

function buildVoucherNo(transactionType) {
  const prefix = String(transactionType || "TXN")
    .replace(/[^A-Z]/g, "")
    .slice(0, 4) || "TXN";
  return `${prefix}-${Date.now()}`;
}

function getRequestedCompanyId(req) {
  const raw =
    req.query.companyId ??
    req.body.companyId ??
    req.body.company_id ??
    req.params.companyId ??
    null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getRequestedUserId(req) {
  const raw = req.user?.userId ?? null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getActingUserId(req) {
  const raw = req.user?.userId ?? null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function isSuperAdminUser(user) {
  if (!user) return false;
  return (
    String(user.role || "").trim().toLowerCase() === "superadmin" ||
    String(user.email || "").trim().toLowerCase() === "grudrapratap0@gmail.com"
  );
}

function normalizeAccessValue(value = "", fallback = "") {
  return String(value || fallback).trim().toUpperCase();
}

function parseAccessDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFutureAccessDate(value) {
  const date = parseAccessDate(value);
  return Boolean(date && date.getTime() > Date.now());
}

function getTokenIssuedAtDate(tokenPayload = {}) {
  const rawIssuedAt = Number(tokenPayload?.iat || 0);
  if (!rawIssuedAt) return null;
  const issuedAtMs = rawIssuedAt < 100000000000 ? rawIssuedAt * 1000 : rawIssuedAt;
  const date = new Date(issuedAtMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function accessDenied(status, message) {
  return { ok: false, status, message };
}

function getRequiredReason(req) {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    return {
      ok: false,
      message: "Reason is required"
    };
  }

  return {
    ok: true,
    reason: reason.slice(0, 500)
  };
}

function getRequiredFutureDate(req, fieldName) {
  const raw = String(req.body?.[fieldName] || "").trim();
  const date = parseAccessDate(raw);

  if (!date || date.getTime() <= Date.now()) {
    return {
      ok: false,
      message: `${fieldName} must be a future date/time`
    };
  }

  return {
    ok: true,
    value: date
  };
}

function validateAccessStateForUser(user, { enforceForceLogout = false, tokenPayload = null } = {}) {
  if (!user) {
    return accessDenied(401, "Authentication required");
  }

  const isSuperAdmin = isSuperAdminUser(user);
  const userLoginStatus = normalizeAccessValue(user.login_status, "ENABLED");

  if (user.deleted_at) {
    return accessDenied(403, "Account access is disabled. Please contact SuperAdmin.");
  }

  if (user.deactivated_at) {
    return accessDenied(403, "Account access is disabled. Please contact SuperAdmin.");
  }

  if (userLoginStatus === "DISABLED") {
    return accessDenied(403, "Account access is disabled. Please contact SuperAdmin.");
  }

  if (isFutureAccessDate(user.blocked_until)) {
    return accessDenied(403, "Account login is blocked temporarily. Please contact SuperAdmin.");
  }

  if (enforceForceLogout) {
    const forceLogoutAfter = parseAccessDate(user.force_logout_after);
    const tokenIssuedAt = getTokenIssuedAtDate(tokenPayload);
    if (forceLogoutAfter && tokenIssuedAt && forceLogoutAfter.getTime() > tokenIssuedAt.getTime()) {
      return accessDenied(401, "Session expired. Please login again.");
    }
  }

  if (isSuperAdmin) {
    return { ok: true };
  }

  const companyAccessStatus = normalizeAccessValue(user.company_access_status, "ACTIVE");
  const companyLoginStatus = normalizeAccessValue(user.company_login_status, "ENABLED");

  if (user.company_deleted_at) {
    return accessDenied(403, "Company access is disabled. Please contact SuperAdmin.");
  }

  if (user.company_deactivated_at) {
    return accessDenied(403, "Company access is disabled. Please contact SuperAdmin.");
  }

  if (companyLoginStatus === "DISABLED") {
    return accessDenied(403, "Company login is disabled. Please contact SuperAdmin.");
  }

  if (companyAccessStatus === "DEACTIVATED") {
    return accessDenied(403, "Company access is disabled. Please contact SuperAdmin.");
  }

  if (companyAccessStatus === "SUSPENDED" && isFutureAccessDate(user.company_suspended_until)) {
    return accessDenied(403, "Company access is suspended. Please contact SuperAdmin.");
  }

  return { ok: true };
}

async function validateActiveAuthenticatedRequest(req) {
  const userId = Number(req.user?.userId || 0);
  if (!userId) {
    return accessDenied(401, "Authentication required");
  }

  const user = await findUserById(userId);
  const access = validateAccessStateForUser(user, {
    enforceForceLogout: true,
    tokenPayload: req.user
  });

  if (!access.ok) {
    return access;
  }

  req.accessUser = user;
  return { ok: true };
}

setAuthAccessValidator(validateActiveAuthenticatedRequest);

function isApprovedAdminUser(user) {
  if (!user) return false;
  return (
    normalizeRoleValue(user.role || "").toLowerCase() === "owner" &&
    String(user.status || "").trim().toLowerCase() === "approved"
  );
}

const APPROVABLE_ROLES = [
  "Admin",
  "Billing",
  "Invoice",
  "Stock",
  "Sticker",
  "Process",
  "Expense",
  "Transaction"
];

function normalizeApprovedRole(value) {
  const clean = String(value || "").trim().toLowerCase();
  return APPROVABLE_ROLES.find((role) => role.toLowerCase() === clean) || null;
}

function sendAccessError(res, access) {
  return res.status(access.status || 403).json({
    success: false,
    message: access.message || "Access denied"
  });
}

async function resolveAccessContext(
  req,
  {
    requireActingUser = true,
    requireCompanyScope = false,
    allowSuperAdminAll = true
  } = {}
) {
  const requestedCompanyId = getRequestedCompanyId(req);
  const actingUserId = getActingUserId(req);

  if (!requireActingUser) {
    return {
      ok: true,
      actingUser: null,
      actingUserId,
      requestedCompanyId,
      actingCompanyId: null,
      isSuperAdmin: false,
      isApprovedAdmin: false,
      companyScope: requestedCompanyId
    };
  }

  if (actingUserId === null) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required"
    };
  }

  const actingUser = await findUserById(actingUserId);

  if (!actingUser) {
    return {
      ok: false,
      status: 401,
      message: "Acting user not found"
    };
  }

  const isSuperAdmin = isSuperAdminUser(actingUser);
  const isApprovedAdmin = isApprovedAdminUser(actingUser);
  const actingCompanyId =
    actingUser.company_id === null || actingUser.company_id === undefined
      ? null
      : Number(actingUser.company_id);

  if (isSuperAdmin) {
    if (requireCompanyScope && requestedCompanyId === null) {
      return {
        ok: false,
        status: 400,
        message: "companyId is required"
      };
    }

    return {
      ok: true,
      actingUser,
      actingUserId,
      requestedCompanyId,
      actingCompanyId,
      isSuperAdmin,
      isApprovedAdmin,
      companyScope: requestedCompanyId
    };
  }

  if (String(actingUser.status || "").trim().toLowerCase() !== "approved") {
    return {
      ok: false,
      status: 403,
      message: "Only approved users can access protected data"
    };
  }

  if (actingCompanyId === null || Number.isNaN(actingCompanyId)) {
    return {
      ok: false,
      status: 403,
      message: "Company scope is missing from your account"
    };
  }

  if (requestedCompanyId !== null && Number(requestedCompanyId) !== actingCompanyId) {
    return {
      ok: false,
      status: 403,
      message: "You cannot access data from another company"
    };
  }

  if (requireCompanyScope && actingCompanyId === null) {
    return {
      ok: false,
      status: 400,
      message: "companyId is required"
    };
  }

  return {
    ok: true,
    actingUser,
    actingUserId,
    requestedCompanyId,
    actingCompanyId,
    isSuperAdmin,
    isApprovedAdmin,
    companyScope: actingCompanyId
  };
}

function normalizeBranchType(value = "", fallback = "STORE") {
  const clean = String(value || fallback).trim().toUpperCase();
  if (["MAIN", "STORE", "WAREHOUSE", "OFFICE"].includes(clean)) return clean;
  return "";
}

function normalizeBranchStatus(value = "", fallback = "ACTIVE") {
  const clean = String(value || fallback).trim().toUpperCase();
  if (["ACTIVE", "INACTIVE"].includes(clean)) return clean;
  return "";
}

function normalizeBranchCode(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .slice(0, 50);
}

function getUserBranchId(user = {}) {
  const raw = user?.branch_id ?? user?.branchId ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function isBranchManagerRole(role = "") {
  const normalizedRole = normalizeRoleValue(role);
  return normalizedRole === "OWNER" || normalizedRole === "ACCOUNTS";
}

async function resolveBranchAccessContext(req, { requireCompanyScope = false } = {}) {
  const access = await resolveAccessContext(req, {
    requireActingUser: true,
    requireCompanyScope,
    allowSuperAdminAll: true
  });

  if (!access.ok) {
    return access;
  }

  const role = normalizeRoleValue(access.actingUser?.role || "");
  const userBranchId = getUserBranchId(access.actingUser);
  const canViewAllBranches = Boolean(access.isSuperAdmin || isBranchManagerRole(role) || userBranchId === null);
  const canManageBranches = Boolean(!access.isSuperAdmin && isBranchManagerRole(role));
  const isBranchLocked = Boolean(!access.isSuperAdmin && !isBranchManagerRole(role) && userBranchId !== null);

  return {
    ...access,
    role,
    userBranchId,
    branchScope: isBranchLocked ? userBranchId : null,
    canViewAllBranches,
    canManageBranches,
    isBranchLocked
  };
}

function sendSuperAdminReadOnlyError(res) {
  return res.status(403).json({
    success: false,
    message: SUPERADMIN_OPERATIONAL_READ_ONLY_MESSAGE
  });
}

function validateBranchPayload(body = {}, { partial = false } = {}) {
  const hasBranchCode = Object.prototype.hasOwnProperty.call(body, "branch_code") ||
    Object.prototype.hasOwnProperty.call(body, "branchCode");
  const hasBranchName = Object.prototype.hasOwnProperty.call(body, "branch_name") ||
    Object.prototype.hasOwnProperty.call(body, "branchName");
  const hasBranchType = Object.prototype.hasOwnProperty.call(body, "branch_type") ||
    Object.prototype.hasOwnProperty.call(body, "branchType");
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

  const branchCode = normalizeBranchCode(body.branch_code ?? body.branchCode ?? "");
  const branchName = String(body.branch_name ?? body.branchName ?? "").trim().slice(0, 150);
  const branchType = normalizeBranchType(body.branch_type ?? body.branchType ?? "STORE");
  const status = normalizeBranchStatus(body.status ?? "ACTIVE");
  const address = String(body.address ?? "").trim();
  const contactName = String(body.contact_name ?? body.contactName ?? "").trim().slice(0, 150);
  const contactPhone = String(body.contact_phone ?? body.contactPhone ?? "").trim().slice(0, 50);

  if ((!partial || hasBranchCode) && !branchCode) {
    return { ok: false, message: "branch_code cannot be empty" };
  }

  if ((!partial || hasBranchName) && !branchName) {
    return { ok: false, message: "branch_name cannot be empty" };
  }

  if ((!partial || hasBranchType) && !branchType) {
    return { ok: false, message: "branch_type must be MAIN, STORE, WAREHOUSE, or OFFICE" };
  }

  if ((!partial || hasStatus) && !status) {
    return { ok: false, message: "status must be ACTIVE or INACTIVE" };
  }

  return {
    ok: true,
    branch: {
      branchCode,
      branchName,
      branchType,
      status,
      address,
      contactName,
      contactPhone,
      hasBranchCode,
      hasBranchName,
      hasBranchType,
      hasStatus,
      hasAddress: Object.prototype.hasOwnProperty.call(body, "address"),
      hasContactName: Object.prototype.hasOwnProperty.call(body, "contact_name") ||
        Object.prototype.hasOwnProperty.call(body, "contactName"),
      hasContactPhone: Object.prototype.hasOwnProperty.call(body, "contact_phone") ||
        Object.prototype.hasOwnProperty.call(body, "contactPhone")
    }
  };
}

const QUICK_BRANCH_LOGIN_ROLES = new Set(["Billing", "Stock", "Sticker", "Process", "Invoice"]);

function normalizeQuickBranchLoginRole(value = "") {
  const clean = String(value || "").trim().toLowerCase();
  return [...QUICK_BRANCH_LOGIN_ROLES].find((role) => role.toLowerCase() === clean) || "";
}

function getRequestedBranchId(req) {
  const raw = req.query.branchId ?? req.query.branch_id ?? req.body?.branchId ?? req.body?.branch_id ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function normalizeStockReadStatus(value = "") {
  return String(value || "").trim().toUpperCase().slice(0, 40);
}

function getEffectiveStockState(row = {}) {
  return String(row.stock_state || row.stockState || row.status || "IN_STOCK").trim().toUpperCase();
}

async function validateReadableBranchScope(access, requestedBranchId = null) {
  if (access.isBranchLocked) {
    if (requestedBranchId !== null && Number(requestedBranchId) !== Number(access.userBranchId)) {
      return {
        ok: false,
        status: 403,
        message: "You cannot access another branch"
      };
    }

    return {
      ok: true,
      branchId: access.userBranchId,
      branch: null
    };
  }

  if (requestedBranchId === null) {
    return {
      ok: true,
      branchId: null,
      branch: null
    };
  }

  const whereParts = ["id = ?"];
  const params = [requestedBranchId];

  if (access.companyScope !== null) {
    whereParts.push("company_id = ?");
    params.push(access.companyScope);
  }

  const [rows] = await pool.query(
    `
    SELECT *
    FROM branches
    WHERE ${whereParts.join(" AND ")}
    LIMIT 1
    `,
    params
  );

  if (!rows.length) {
    return {
      ok: false,
      status: 404,
      message: "Branch not found in this company"
    };
  }

  return {
    ok: true,
    branchId: requestedBranchId,
    branch: rows[0]
  };
}

function buildBranchStockWhere(access, { branchId = null, status = "", stockState = "", search = "" } = {}) {
  const whereParts = [];
  const params = [];
  const normalizedStatus = normalizeStockReadStatus(status);
  const normalizedStockState = normalizeStockReadStatus(stockState);
  const cleanSearch = String(search || "").trim();

  if (access.companyScope !== null) {
    whereParts.push("s.company_id = ?");
    params.push(access.companyScope);
  }

  if (branchId !== null) {
    whereParts.push("s.current_branch_id = ?");
    params.push(branchId);
  }

  if (normalizedStatus) {
    whereParts.push("UPPER(COALESCE(s.status, '')) = ?");
    params.push(normalizedStatus);
  }

  if (normalizedStockState) {
    whereParts.push("UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = ?");
    params.push(normalizedStockState);
  }

  if (cleanSearch) {
    const likeSearch = `%${cleanSearch}%`;
    whereParts.push(`
      (
        s.barcode LIKE ?
        OR s.product_name LIKE ?
        OR s.lot_number LIKE ?
        OR s.sku LIKE ?
      )
    `);
    params.push(likeSearch, likeSearch, likeSearch, likeSearch);
  }

  return {
    whereSql: whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "",
    params
  };
}

function parsePositiveInteger(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function normalizeTransferStatus(value = "") {
  return String(value || "").trim().toUpperCase().slice(0, 40);
}

function canAccessTransferBranch(access, branchId) {
  if (!access?.isBranchLocked) return true;
  return Number(branchId || 0) === Number(access.userBranchId || 0);
}

function canCreateTransferFromBranch(access, fromBranchId) {
  if (access?.isSuperAdmin) return false;
  if (!access?.isBranchLocked) return true;
  return Number(fromBranchId || 0) === Number(access.userBranchId || 0);
}

function canReceiveTransferToBranch(access, toBranchId) {
  if (access?.isSuperAdmin) return false;
  if (!access?.isBranchLocked) return true;
  return Number(toBranchId || 0) === Number(access.userBranchId || 0);
}

function getRequestedBranchScopeValue(req = {}) {
  const raw = req.query?.branchId ?? req.query?.branch_id ?? req.body?.branchId ?? req.body?.branch_id ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

async function resolveOperationalBranchScope(connection, access, requestedBranchId = null) {
  if (!access?.ok) return access;

  if (access.isBranchLocked) {
    if (requestedBranchId !== null && Number(requestedBranchId) !== Number(access.userBranchId)) {
      return {
        ok: false,
        status: 403,
        message: "You cannot access another branch stock"
      };
    }

    return {
      ok: true,
      branchId: access.userBranchId,
      branch: null,
      isBranchFiltered: true
    };
  }

  if (requestedBranchId === null) {
    return {
      ok: true,
      branchId: null,
      branch: null,
      isBranchFiltered: false
    };
  }

  const whereParts = ["id = ?"];
  const params = [requestedBranchId];
  if (access.companyScope !== null) {
    whereParts.push("company_id = ?");
    params.push(access.companyScope);
  }

  const [rows] = await connection.query(
    `
    SELECT *
    FROM branches
    WHERE ${whereParts.join(" AND ")}
    LIMIT 1
    `,
    params
  );

  if (!rows.length) {
    return {
      ok: false,
      status: 404,
      message: "Branch not found in this company"
    };
  }

  return {
    ok: true,
    branchId: requestedBranchId,
    branch: rows[0],
    isBranchFiltered: true
  };
}

function appendOperationalStockVisibilityFilter(whereParts, {
  alias = "",
  includeSold = false,
  includeDeleted = false
} = {}) {
  const prefix = alias ? `${alias}.` : "";
  whereParts.push(`UPPER(COALESCE(NULLIF(TRIM(${prefix}stock_state), ''), ${prefix}status, 'IN_STOCK')) NOT IN ('IN_TRANSIT', 'TRANSFER_SHORTAGE')`);
  if (!includeSold) whereParts.push(`UPPER(COALESCE(${prefix}status, 'IN_STOCK')) <> 'SOLD'`);
  if (!includeDeleted) whereParts.push(`UPPER(COALESCE(${prefix}status, 'IN_STOCK')) <> 'DELETED'`);
}

function appendBranchScopeFilter(whereParts, params, branchScope, { alias = "" } = {}) {
  if (!branchScope?.isBranchFiltered || branchScope.branchId === null || branchScope.branchId === undefined) return;
  const prefix = alias ? `${alias}.` : "";
  whereParts.push(`${prefix}current_branch_id = ?`);
  params.push(branchScope.branchId);
}

function getBranchScopeResponse(branchScope = {}) {
  return {
    branchId: branchScope.branchId ?? null,
    branchName: branchScope.branch?.branch_name || null,
    branchCode: branchScope.branch?.branch_code || null,
    isBranchFiltered: Boolean(branchScope.isBranchFiltered)
  };
}

function getAnalyticsDateRange(req = {}) {
  const fromDate = String(req.query?.fromDate || req.query?.from_date || "").trim();
  const toDate = String(req.query?.toDate || req.query?.to_date || "").trim();
  return {
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : "",
    toDate: /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : ""
  };
}

function appendDateRangeFilter(whereParts, params, column, { fromDate = "", toDate = "" } = {}) {
  if (fromDate) {
    whereParts.push(`${column} >= ?`);
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    whereParts.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(toDate);
  }
}

function getAgeingLevel(hours = 0) {
  const value = Number(hours || 0);
  if (value >= 72) return "CRITICAL";
  if (value >= 24) return "WARNING";
  return "NORMAL";
}

function normalizeMovementType(value = "") {
  return String(value || "").trim().toUpperCase().slice(0, 40);
}

async function resolveAnalyticsAccess(req, { requireCompanyScope = true } = {}) {
  const access = await resolveBranchAccessContext(req, { requireCompanyScope });
  if (!access.ok) return { access };
  const requestedBranchId = getRequestedBranchScopeValue(req);
  const branchScope = await resolveOperationalBranchScope(pool, access, requestedBranchId);
  return { access, branchScope };
}

function buildAnalyticsStockScope(access, branchScope, { alias = "s" } = {}) {
  const whereParts = ["1 = 1"];
  const params = [];
  if (access.companyScope !== null) {
    whereParts.push(`${alias}.company_id = ?`);
    params.push(access.companyScope);
  }
  appendBranchScopeFilter(whereParts, params, branchScope, { alias });
  return { whereSql: whereParts.join(" AND "), params };
}

async function getBranchForCompany(connection, companyId, branchId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM branches
    WHERE id = ? AND company_id = ?
    LIMIT 1
    `,
    [branchId, companyId]
  );
  return rows[0] || null;
}

async function getTransferForAccess(connection, access, transferId, { forUpdate = false } = {}) {
  const lockSql = forUpdate ? "FOR UPDATE" : "";
  const whereParts = ["bt.id = ?"];
  const params = [transferId];

  if (access.companyScope !== null) {
    whereParts.push("bt.company_id = ?");
    params.push(access.companyScope);
  }

  if (access.isBranchLocked) {
    whereParts.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
    params.push(access.userBranchId, access.userBranchId);
  }

  const [rows] = await connection.query(
    `
    SELECT
      bt.*,
      fb.branch_code AS from_branch_code,
      fb.branch_name AS from_branch_name,
      tb.branch_code AS to_branch_code,
      tb.branch_name AS to_branch_name
    FROM branch_transfers bt
    LEFT JOIN branches fb
      ON fb.id = bt.from_branch_id
     AND fb.company_id = bt.company_id
    LEFT JOIN branches tb
      ON tb.id = bt.to_branch_id
     AND tb.company_id = bt.company_id
    WHERE ${whereParts.join(" AND ")}
    LIMIT 1
    ${lockSql}
    `,
    params
  );

  return rows[0] || null;
}

async function generateTransferNumberForCompany(connection, companyId) {
  const now = new Date();
  const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const prefix = `TRF-${dateKey}-`;

  const [rows] = await connection.query(
    `
    SELECT transfer_no
    FROM branch_transfers
    WHERE company_id = ?
      AND transfer_no LIKE ?
    ORDER BY transfer_no DESC
    LIMIT 1
    FOR UPDATE
    `,
    [companyId, `${prefix}%`]
  );

  const lastNo = String(rows[0]?.transfer_no || "");
  const lastSequence = Number(lastNo.slice(prefix.length)) || 0;
  const nextSequence = lastSequence + 1;
  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

async function writeBranchTransferAuditSafe(connection, req, access, {
  transferId = null,
  actionType = "",
  beforeData = null,
  afterData = null,
  reason = ""
} = {}) {
  try {
    await connection.query(
      `
      INSERT INTO branch_transfer_audit_logs
      (
        company_id,
        transfer_id,
        action_type,
        actor_user_id,
        before_data,
        after_data,
        reason,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        access.companyScope,
        transferId,
        String(actionType || "").trim().toUpperCase().slice(0, 80),
        access.actingUserId ?? null,
        safeJsonStringify(sanitizeAuditPayload(beforeData)),
        safeJsonStringify(sanitizeAuditPayload(afterData)),
        String(reason || "").trim()
      ]
    );
  } catch (error) {
    console.error("Branch transfer audit write failed:", error);
  }

  await logActivitySafe(connection, req, access, {
    actionType,
    entityType: "BRANCH_TRANSFER",
    entityId: transferId === null || transferId === undefined ? "" : String(transferId),
    moduleName: "branch-transfer",
    status: "success",
    message: reason || actionType,
    beforeData,
    afterData
  });
}

async function writeBranchReceiveLogSafe(executor, access, {
  transferId = null,
  barcode = null,
  stockId = null,
  branchId = null,
  scanStatus = "",
  reason = "",
  scannedBy = null,
  deviceInfo = null
} = {}) {
  try {
    await executor.query(
      `
      INSERT INTO branch_receive_logs
      (
        company_id,
        transfer_id,
        barcode,
        stock_id,
        branch_id,
        scan_status,
        reason,
        scanned_by,
        scanned_at,
        device_info
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        access.companyScope,
        transferId,
        barcode ? String(barcode).trim() : null,
        stockId ?? null,
        branchId ?? null,
        String(scanStatus || "").trim().toUpperCase().slice(0, 40),
        String(reason || "").trim() || null,
        scannedBy ?? access.actingUserId ?? null,
        deviceInfo ? String(deviceInfo).trim().slice(0, 1000) : null
      ]
    );
  } catch (error) {
    console.error("Branch receive log write failed:", error);
  }
}

async function requireSuperAdminAccess(req, res) {
  const access = await resolveAccessContext(req, {
    requireActingUser: true,
    requireCompanyScope: false,
    allowSuperAdminAll: true
  });

  if (!access.ok) {
    sendAccessError(res, access);
    return null;
  }

  if (!access.isSuperAdmin) {
    sendAccessError(res, {
      status: 403,
      message: "Only the SuperAdmin has access"
    });
    return null;
  }

  return access;
}

const DUPLICATE_BARCODE_MESSAGE = "Duplicate barcode found. Contact admin.";

function normalizeBarcodeForComparison(barcode) {
  return String(barcode || "").trim().toUpperCase();
}

function createBarcodeSafetyError(message = DUPLICATE_BARCODE_MESSAGE) {
  const error = new Error(message);
  error.status = 409;
  error.statusCode = 409;
  error.isBarcodeSafetyError = true;
  return error;
}

async function ensureSingleStockBarcode(companyId, barcode, db = pool) {
  const cleanBarcode = String(barcode || "").trim();
  if (!cleanBarcode) return cleanBarcode;

  const normalizedBarcode = normalizeBarcodeForComparison(cleanBarcode);
  const [rows] = await db.query(
    `
    SELECT COUNT(*) AS count
    FROM stock
    WHERE company_id = ?
      AND UPPER(TRIM(barcode)) = ?
      ${getSellableStockFilterSql()}
    `,
    [companyId, normalizedBarcode]
  );

  if (Number(rows?.[0]?.count || 0) > 1) {
    throw createBarcodeSafetyError();
  }

  return cleanBarcode;
}

function assertSingleStockRowAffected(result) {
  const affectedRows = Number(result?.affectedRows || 0);
  if (affectedRows > 1) {
    throw createBarcodeSafetyError();
  }
  return affectedRows;
}

function getBarcodeSafetyStatus(error, fallback = 500) {
  return error?.isBarcodeSafetyError ? Number(error.status || error.statusCode || 409) : fallback;
}

function getBarcodeSafetyMessage(error, fallback) {
  return error?.isBarcodeSafetyError ? error.message : fallback;
}

async function validateInvoiceSaveRequest(connection, invoiceNumber, items, companyId, branchScope = null) {
  const cleanInvoiceNumber = String(invoiceNumber || "").trim();

  if (!cleanInvoiceNumber) {
    return {
      ok: false,
      status: 400,
      message: "Invoice number missing"
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Items missing"
    };
  }

  const [existingInvoices] = await connection.query(
    `
    SELECT id
    FROM sales_history
    WHERE invoice_number = ? AND company_id = ?
    LIMIT 1
    `,
    [cleanInvoiceNumber, companyId]
  );

  if (existingInvoices.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "This invoice number already exists in this company"
    };
  }

  for (const item of items) {
    const barcode = String(item.barcode || "").trim();

    if (!barcode) continue;

    await ensureSingleStockBarcode(companyId, barcode, connection);

    const [stockRows] = await connection.query(
      `
      SELECT id, status, stock_state, current_branch_id, company_id
      FROM stock
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [barcode, companyId]
    );

    if (!stockRows.length) {
      return {
        ok: false,
        status: 400,
        message: `Barcode ${barcode} was not found in this company's stock`
      };
    }

    const stockRow = stockRows[0];
    const stockStatus = String(stockRow.status || "").trim().toUpperCase();
    const effectiveStockState = getEffectiveStockState(stockRow);

    if (stockStatus !== "IN_STOCK" || effectiveStockState !== "IN_STOCK") {
      return {
        ok: false,
        status: 400,
        message: `Barcode ${barcode} is not in sellable stock`
      };
    }

    if (branchScope?.isBranchFiltered && Number(stockRow.current_branch_id || 0) !== Number(branchScope.branchId || 0)) {
      return {
        ok: false,
        status: 403,
        message: `Barcode ${barcode} does not belong to the selected billing branch`
      };
    }
  }

  return {
    ok: true,
    invoiceNumber: cleanInvoiceNumber
  };
}

async function getCurrentInvoiceDraft(connection, companyId, userId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM invoice_drafts
    WHERE company_id = ?
      AND created_by = ?
      AND UPPER(COALESCE(status, 'DRAFT')) = 'DRAFT'
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, userId]
  );

  return rows[0] || null;
}

async function getOrCreateCurrentInvoiceDraft(connection, companyId, userId) {
  const existingDraft = await getCurrentInvoiceDraft(connection, companyId, userId);
  if (existingDraft) return existingDraft;

  const [insertResult] = await connection.query(
    `
    INSERT INTO invoice_drafts
    (
      company_id,
      customer_name,
      mobile,
      invoice_number,
      invoice_date,
      status,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (?, '', '', '', NULL, 'DRAFT', ?, ?, NOW(), NOW())
    `,
    [companyId, userId, userId]
  );

  const [rows] = await connection.query(
    `
    SELECT *
    FROM invoice_drafts
    WHERE id = ?
    LIMIT 1
    `,
    [insertResult.insertId]
  );

  return rows[0] || null;
}

async function getInvoiceDraftItems(connection, draftId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM invoice_draft_items
    WHERE draft_id = ?
    ORDER BY id ASC
    `,
    [draftId]
  );

  return rows;
}

async function getInvoiceDraftPayload(connection, draftId) {
  if (!draftId) {
    return mapInvoiceDraftPayload(null, []);
  }

  const [draftRows] = await connection.query(
    `
    SELECT *
    FROM invoice_drafts
    WHERE id = ?
    LIMIT 1
    `,
    [draftId]
  );

  const draftRow = draftRows[0] || null;
  const itemRows = draftRow ? await getInvoiceDraftItems(connection, draftId) : [];
  return mapInvoiceDraftPayload(draftRow, itemRows);
}

async function setSaleStatusAndSyncStock(connection, invoiceNumber, companyId, saleStatus) {
  const cleanInvoiceNumber = String(invoiceNumber || "").trim();

  const [saleRows] = await connection.query(
    `
    SELECT id
    FROM sales_history
    WHERE invoice_number = ? AND company_id = ?
    LIMIT 1
    `,
    [cleanInvoiceNumber, companyId]
  );

  if (!saleRows.length) {
    return {
      ok: false,
      status: 404,
      message: "Sale not found"
    };
  }

  const [itemRows] = await connection.query(
    `
    SELECT barcode
    FROM sales_items
    WHERE invoice_number = ? AND company_id = ?
    `,
    [cleanInvoiceNumber, companyId]
  );

  await connection.query(
    `
    UPDATE sales_history
    SET status = ?
    WHERE invoice_number = ? AND company_id = ?
    `,
    [saleStatus, cleanInvoiceNumber, companyId]
  );

  for (const item of itemRows) {
    const barcode = String(item.barcode || "").trim();

    if (!barcode) continue;

    await ensureSingleStockBarcode(companyId, barcode, connection);

    if (saleStatus === "DELETED") {
      const [stockResult] = await connection.query(
        `
        UPDATE stock
        SET status = 'IN_STOCK',
            invoice_number = '',
            sold_at = NULL
        WHERE barcode = ? AND company_id = ?
          ${getSellableStockFilterSql()}
        `,
        [barcode, companyId]
      );
      assertSingleStockRowAffected(stockResult);
      continue;
    }

    const [stockResult] = await connection.query(
      `
      UPDATE stock
      SET status = 'SOLD',
          invoice_number = ?,
          sold_at = COALESCE(sold_at, NOW())
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      `,
      [cleanInvoiceNumber, barcode, companyId]
    );
    assertSingleStockRowAffected(stockResult);
  }

  return {
    ok: true
  };
}

async function getLatestSaleItemByBarcode(connection, barcode, companyId) {
  const [rows] = await connection.query(
    `
    SELECT
      si.id,
      si.invoice_number,
      si.customer_name,
      si.product_name,
      si.sku,
      si.purity,
      si.size,
      si.weight,
      si.lot_number,
      si.item_status,
      si.return_type,
      si.returned_at,
      si.return_id,
      si.return_transaction_id,
      sh.id AS sale_id,
      sh.customer_name AS sale_customer_name,
      sh.mobile AS sale_mobile,
      sh.gst_number AS sale_gst_number,
      sh.payment_mode,
      sh.payment_status,
      sh.total_amount,
      sh.total_weight,
      sh.rate_per_gram,
      sh.mc_rate,
      sh.subtotal,
      sh.status AS sale_status,
      sh.invoice_date,
      sh.created_at AS sale_created_at
    FROM sales_items si
    LEFT JOIN sales_history sh
      ON sh.invoice_number = si.invoice_number
     AND sh.company_id = si.company_id
    WHERE si.barcode = ? AND si.company_id = ?
    ORDER BY si.id DESC
    LIMIT 1
    `,
    [barcode, companyId]
  );

  return rows.length ? rows[0] : null;
}

async function getCompanySettingsForCompany(connection, companyId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM company_settings
    WHERE company_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId]
  );

  return rows[0] || null;
}

async function cleanupOtpVerifications(connection) {
  await connection.query(
    `
    DELETE FROM otp_verifications
    WHERE
      (expires_at IS NOT NULL AND expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
      OR (session_expires_at IS NOT NULL AND session_expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
      OR (consumed_at IS NOT NULL AND consumed_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
    `
  );
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `
    SELECT
      u.*,
      c.company_name,
      c.owner_name AS company_owner_name,
      c.owner_email AS company_owner_email,
      c.status AS company_status,
      c.access_status AS company_access_status,
      c.login_status AS company_login_status,
      c.suspended_until AS company_suspended_until,
      c.deleted_at AS company_deleted_at,
      c.deactivated_at AS company_deactivated_at,
      c.access_reason AS company_access_reason
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE LOWER(u.email) = LOWER(?)
    LIMIT 1
    `,
    [email]
  );

  return rows.length ? rows[0] : null;
}

async function repairApprovedAdminCompanyLink(user) {
  if (!user || isSuperAdminUser(user)) return user;

  const role = normalizeRoleValue(user.role || "");
  const status = String(user.status || "").trim().toLowerCase();
  const email = normalizeEmail(user.email);
  const hasCompanyId =
    user.company_id !== null &&
    user.company_id !== undefined &&
    user.company_id !== "" &&
    !Number.isNaN(Number(user.company_id));

  if (hasCompanyId || role !== "OWNER" || status !== "approved" || !email) {
    return user;
  }

  const [companyRows] = await pool.query(
    `
    SELECT id, company_name, status, access_status, login_status, suspended_until, deleted_at, deactivated_at, access_reason
    FROM companies
    WHERE LOWER(owner_email) = LOWER(?)
    ORDER BY id DESC
    LIMIT 1
    `,
    [email]
  );

  if (!companyRows.length) {
    return user;
  }

  const company = companyRows[0];
  const companyId = Number(company.id || 0);
  if (!companyId) return user;

  await pool.query(
    `
    UPDATE users
    SET company_id = ?
    WHERE id = ?
      AND company_id IS NULL
    `,
    [companyId, user.id]
  );

  user.company_id = companyId;
  user.company_name = company.company_name || user.company_name || "";
  user.company_status = company.status || user.company_status || "";
  user.company_access_status = company.access_status || user.company_access_status || "";
  user.company_login_status = company.login_status || user.company_login_status || "";
  user.company_suspended_until = company.suspended_until || user.company_suspended_until || null;
  user.company_deleted_at = company.deleted_at || user.company_deleted_at || null;
  user.company_deactivated_at = company.deactivated_at || user.company_deactivated_at || null;
  user.company_access_reason = company.access_reason || user.company_access_reason || "";
  return user;
}

async function countRecentOtpRequests(connection, email, purpose, userId = null, companyId = null) {
  const [rows] = await connection.query(
    `
    SELECT COUNT(*) AS total
    FROM otp_verifications
    WHERE LOWER(email) = LOWER(?)
      AND purpose = ?
      AND user_id <=> ?
      AND company_id <=> ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `,
    [email, purpose, userId, companyId, OTP_REQUEST_LIMIT_WINDOW_MINUTES]
  );

  return Number(rows[0]?.total || 0);
}

async function getLatestOtpRecord(connection, email, purpose, userId = null, companyId = null) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM otp_verifications
    WHERE LOWER(email) = LOWER(?)
      AND purpose = ?
      AND user_id <=> ?
      AND company_id <=> ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [email, purpose, userId, companyId]
  );

  return rows[0] || null;
}

async function invalidateOtpPurposeForEmail(connection, email, purpose, userId = null, companyId = null) {
  await connection.query(
    `
    UPDATE otp_verifications
    SET consumed_at = NOW(),
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(?)
      AND purpose = ?
      AND user_id <=> ?
      AND company_id <=> ?
      AND consumed_at IS NULL
    `,
    [email, purpose, userId, companyId]
  );
}

async function getAllowedSettingsUnlockEmails(connection, access) {
  const emailSet = new Set();
  const pushEmail = (value) => {
    const normalized = normalizeEmail(value);
    if (normalized) emailSet.add(normalized);
  };

  if (access?.isSuperAdmin) {
    return emailSet;
  }

  const actorCompanyId =
    access?.actingCompanyId === null || access?.actingCompanyId === undefined
      ? null
      : Number(access.actingCompanyId);
  const scopedCompanyId =
    access?.companyScope === null || access?.companyScope === undefined
      ? null
      : Number(access.companyScope);
  const isSameCompanyOwnerAdmin =
    access?.isApprovedAdmin &&
    actorCompanyId !== null &&
    scopedCompanyId !== null &&
    !Number.isNaN(actorCompanyId) &&
    !Number.isNaN(scopedCompanyId) &&
    actorCompanyId === scopedCompanyId;

  if (!isSameCompanyOwnerAdmin) {
    return emailSet;
  }

  pushEmail(access?.actingUser?.email);
  pushEmail(access?.actingUser?.company_owner_email);

  if (access?.companyScope !== null && access?.companyScope !== undefined) {
    const settingsRow = await getCompanySettingsForCompany(connection, access.companyScope);
    pushEmail(settingsRow?.ownerEmail);
  }

  return emailSet;
}

async function auditDeniedSettingsAccess(connection, req, access, actionType, details = {}) {
  await writeAuditLogSafe(connection, req, {
    companyId: access?.companyScope ?? getRequestedCompanyId(req) ?? null,
    userId: access?.actingUserId ?? getRequestedUserId(req) ?? null,
    actionType,
    entityType: "SETTINGS",
    entityId: String(access?.companyScope ?? getRequestedCompanyId(req) ?? ""),
    beforeData: null,
    afterData: {
      denied: true,
      reason: details.reason || "SETTINGS_PERMISSION_DENIED",
      actorRole: access?.actingUser?.role ?? null,
      actorCompanyId: access?.actingCompanyId ?? null,
      requestedCompanyId: access?.requestedCompanyId ?? getRequestedCompanyId(req) ?? null,
      purpose: details.purpose || OTP_PURPOSES.SETTINGS_UNLOCK,
      email: details.email || null
    }
  });
}

function isSameCompanySettingsOwnerAdmin(access) {
  const actorCompanyId =
    access?.actingCompanyId === null || access?.actingCompanyId === undefined
      ? null
      : Number(access.actingCompanyId);
  const scopedCompanyId =
    access?.companyScope === null || access?.companyScope === undefined
      ? null
      : Number(access.companyScope);

  return (
    !access?.isSuperAdmin &&
    access?.isApprovedAdmin &&
    actorCompanyId !== null &&
    scopedCompanyId !== null &&
    !Number.isNaN(actorCompanyId) &&
    !Number.isNaN(scopedCompanyId) &&
    actorCompanyId === scopedCompanyId
  );
}

async function verifyOtpSessionToken(connection, { email, purpose, sessionToken, userId = null, companyId = null }) {
  const tokenHash = hashSecret(sessionToken);
  const [rows] = await connection.query(
    `
    SELECT *
    FROM otp_verifications
    WHERE LOWER(email) = LOWER(?)
      AND purpose = ?
      AND session_token_hash = ?
      AND verified_at IS NOT NULL
      AND consumed_at IS NULL
      AND session_expires_at IS NOT NULL
      AND session_expires_at >= NOW()
      AND (? IS NULL OR user_id = ?)
      AND (? IS NULL OR company_id <=> ?)
    ORDER BY id DESC
    LIMIT 1
    `,
    [email, purpose, tokenHash, userId, userId, companyId, companyId]
  );

  return rows[0] || null;
}

function estimateReturnLineAmount(saleItem, saleRow) {
  const weight = toNumber(saleItem?.weight);
  const purity = toNumber(saleItem?.purity) > 0 ? toNumber(saleItem?.purity) : 100;
  const pureWeight = weight * (purity / 100);
  const rate = toNumber(saleRow?.rate_per_gram);
  const mcRate = toNumber(saleRow?.mc_rate);
  const estimatedSubtotal = pureWeight * rate + pureWeight * mcRate;
  const saleSubtotal = toNumber(saleRow?.subtotal);
  const saleTotalAmount = toNumber(saleRow?.total_amount);

  if (saleSubtotal > 0 && saleTotalAmount > 0) {
    return estimatedSubtotal * (saleTotalAmount / saleSubtotal);
  }

  return estimatedSubtotal;
}

async function postReturnToTransactionFoundation(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const saleItem = payload.saleItem || null;
  const saleRow = payload.saleRow || null;
  const invoiceNumber = String(payload.invoiceNumber || saleItem?.invoice_number || "").trim();
  const customerName = String(payload.customerName || saleItem?.customer_name || saleRow?.customer_name || "").trim();
  const mobile = String(payload.mobile || saleRow?.mobile || "").trim();
  const gstNo = String(payload.gstNo || saleRow?.gst_number || "").trim();
  const returnType = normalizeReturnType(payload.returnType);
  const returnReason = String(payload.returnReason || "").trim();
  const returnDate = String(payload.returnDate || getTodayDateOnly()).trim();
  const productName = String(payload.productName || saleItem?.product_name || "").trim();
  const barcode = String(payload.barcode || saleItem?.barcode || "").trim();
  const lotNumber = String(payload.lotNumber || saleItem?.lot_number || "").trim();
  const grossWeight = toNumber(payload.weight || saleItem?.weight);
  const purity = toNumber(saleItem?.purity);
  const lineAmount = estimateReturnLineAmount(saleItem, saleRow);

  const party = await findOrCreateBillingParty(connection, {
    companyId,
    createdBy,
    partyName: customerName || "RETURN CUSTOMER",
    mobile,
    gstNo
  });

  const voucherNo = `RET-${invoiceNumber || Date.now()}-${barcode || Date.now()}`;
  const [txnInsert] = await connection.query(
    `
    INSERT INTO transaction_master
    (
      company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
      status, reference_no, invoice_no, source_module, payment_mode, payment_status,
      remarks, note, created_by
    )
    VALUES (?, ?, ?, 'SALE_RETURN', ?, ?, 'POSTED', ?, ?, 'return', ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      voucherNo,
      returnDate || null,
      party.id,
      party.party_type || "CUSTOMER",
      barcode || invoiceNumber,
      invoiceNumber,
      String(saleRow?.payment_mode || "").trim(),
      returnType,
      "Auto-posted from return module",
      `${returnType} | ${returnReason || "No reason"}`,
      createdBy
    ]
  );

  const transactionId = txnInsert.insertId;

  await connection.query(
    `
    INSERT INTO transaction_lines
    (
      transaction_id, line_no, item_name, barcode, lot_no, purity,
      gross_weight, fine_weight, qty, rate_per_gram, making_charge,
      line_amount, remarks
    )
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      transactionId,
      productName,
      barcode,
      lotNumber,
      purity,
      grossWeight,
      calculateFineWeight(grossWeight, purity),
      1,
      toNumber(saleRow?.rate_per_gram),
      toNumber(saleRow?.mc_rate),
      lineAmount,
      returnType === "DAMAGED_RETURN" ? "Damaged return adjustment" : "Return to stock adjustment"
    ]
  );

  await connection.query(
    `
    INSERT INTO invoice_transaction_link
    (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
    VALUES (?, ?, ?, 'SALE_RETURN', ?, ?)
    `,
    [companyId, invoiceNumber, transactionId, "Return transaction posting", createdBy]
  );

  if (lotNumber) {
    await connection.query(
      `
      INSERT INTO lot_transaction_link
      (company_id, lot_no, process_lot_no, transaction_id, link_type, remarks, created_by)
      VALUES (?, ?, ?, ?, 'SALE_RETURN', ?, ?)
      `,
      [companyId, lotNumber, lotNumber, transactionId, "Return linked to lot", createdBy]
    );
  }

  await createCashLedgerEntry(connection, {
    companyId,
    partyId: party.id,
    transactionId,
    entryDate: returnDate,
    entryType: "CREDIT",
    debitAmount: 0,
    creditAmount: lineAmount,
    referenceType: "SALE_RETURN",
    referenceNo: voucherNo,
    remarks: `Return credit for ${invoiceNumber || barcode}`,
    createdBy
  });

  await recalcPartyBalanceSummary(connection, companyId, party.id, transactionId);

  return {
    transactionId,
    partyId: party.id,
    estimatedAmount: lineAmount
  };
}

async function getReturnSummaryRows(companyId) {
  const whereClause = companyId !== null ? "WHERE company_id = ?" : "";
  const params = companyId !== null ? [companyId] : [];

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_returns,
      SUM(CASE WHEN UPPER(COALESCE(return_type, '')) = 'RETURN_TO_STOCK' THEN 1 ELSE 0 END) AS return_to_stock_count,
      SUM(CASE WHEN UPPER(COALESCE(return_type, '')) = 'DAMAGED_RETURN' THEN 1 ELSE 0 END) AS damaged_return_count,
      SUM(CASE WHEN DATE(return_date) = CURDATE() THEN 1 ELSE 0 END) AS today_returns
    FROM return_history
    ${whereClause}
    `,
    params
  );

  const [recentRows] = await pool.query(
    `
    SELECT
      id,
      barcode,
      invoice_number,
      customer_name,
      product_name,
      return_type,
      return_reason,
      return_date,
      company_id,
      created_by,
      created_at
    FROM return_history
    ${whereClause}
    ORDER BY id DESC
    LIMIT 10
    `,
    params
  );

  return {
    totalReturns: Number(rows[0]?.total_returns || 0),
    returnToStockCount: Number(rows[0]?.return_to_stock_count || 0),
    damagedReturnCount: Number(rows[0]?.damaged_return_count || 0),
    todayReturns: Number(rows[0]?.today_returns || 0),
    recentReturns: recentRows
  };
}

function normalizeMaterialMovementType(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "OPENING") return "OPENING";
  if (clean === "IN" || clean === "STOCK_IN") return "IN";
  if (clean === "OUT" || clean === "STOCK_OUT" || clean === "USED") return "OUT";
  if (clean === "ADJUSTMENT" || clean === "ADJUST") return "ADJUSTMENT";
  return "";
}

function getMaterialStockStatus(currentStock, lowStockLevel) {
  const current = Number(currentStock || 0);
  const lowLevel = Number(lowStockLevel || 0);

  if (current <= 0) return "OUT_OF_STOCK";
  if (current <= lowLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

async function syncMaterialStockBalance(connection, materialId, companyId = null) {
  const materialParams = [materialId];
  const materialFilter = companyId !== null ? "AND company_id = ?" : "";

  if (companyId !== null) {
    materialParams.push(companyId);
  }

  const [materialRows] = await connection.query(
    `
    SELECT id, low_stock_level
    FROM material_stock_items
    WHERE id = ?
    ${materialFilter}
    LIMIT 1
    `,
    materialParams
  );

  if (!materialRows.length) return null;

  const movementParams = [materialId];
  const movementFilter = companyId !== null ? "AND company_id = ?" : "";

  if (companyId !== null) {
    movementParams.push(companyId);
  }

  const [balanceRows] = await connection.query(
    `
    SELECT
      SUM(CASE WHEN movement_type = 'OPENING' THEN qty ELSE 0 END) AS opening_total,
      SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE 0 END) AS total_in,
      SUM(CASE WHEN movement_type = 'OUT' THEN qty ELSE 0 END) AS total_out,
      SUM(CASE WHEN movement_type = 'ADJUSTMENT' THEN qty ELSE 0 END) AS total_adjustment
    FROM material_stock_movements
    WHERE material_id = ?
    ${movementFilter}
    `,
    movementParams
  );

  const openingTotal = Number(balanceRows[0]?.opening_total || 0);
  const totalIn = Number(balanceRows[0]?.total_in || 0);
  const totalOut = Number(balanceRows[0]?.total_out || 0);
  const totalAdjustment = Number(balanceRows[0]?.total_adjustment || 0);
  const currentStock = openingTotal + totalIn + totalAdjustment - totalOut;
  const status = getMaterialStockStatus(currentStock, materialRows[0].low_stock_level);

  await connection.query(
    `
    UPDATE material_stock_items
    SET opening_stock = ?,
        current_stock = ?,
        status = ?,
        updated_at = NOW()
    WHERE id = ?
    `,
    [openingTotal, currentStock, status, materialId]
  );

  return {
    openingStock: openingTotal,
    totalIn,
    totalOut,
    totalAdjustment,
    currentStock,
    status
  };
}

async function getMaterialStockSummaryRows(companyId) {
  const whereClause = companyId !== null ? "WHERE msi.company_id = ?" : "";
  const params = companyId !== null ? [companyId] : [];

  const [itemSummaryRows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_material_types,
      COALESCE(SUM(current_stock), 0) AS total_current_stock,
      SUM(CASE WHEN status = 'LOW_STOCK' THEN 1 ELSE 0 END) AS low_stock_items,
      SUM(CASE WHEN status = 'OUT_OF_STOCK' THEN 1 ELSE 0 END) AS out_of_stock_items
    FROM material_stock_items msi
    ${whereClause}
    `,
    params
  );

  const movementWhereClause = companyId !== null ? "WHERE company_id = ?" : "";
  const movementParams = companyId !== null ? [companyId] : [];

  const [movementRows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN movement_type = 'IN' AND DATE(movement_date) = CURDATE() THEN qty ELSE 0 END), 0) AS today_stock_in,
      COALESCE(SUM(CASE WHEN movement_type = 'OUT' AND DATE(movement_date) = CURDATE() THEN qty ELSE 0 END), 0) AS today_stock_out
    FROM material_stock_movements
    ${movementWhereClause}
    `,
    movementParams
  );

  return {
    totalMaterialTypes: Number(itemSummaryRows[0]?.total_material_types || 0),
    totalCurrentStock: Number(itemSummaryRows[0]?.total_current_stock || 0),
    lowStockItems: Number(itemSummaryRows[0]?.low_stock_items || 0),
    outOfStockItems: Number(itemSummaryRows[0]?.out_of_stock_items || 0),
    todayStockIn: Number(movementRows[0]?.today_stock_in || 0),
    todayStockOut: Number(movementRows[0]?.today_stock_out || 0)
  };
}

function normalizeReportDateInput(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getNextDateString(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  parsed.setDate(parsed.getDate() + 1);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

async function handleUserApprovalAction(req, res, { action = "approve", label = "User" } = {}) {
  const targetUserId = Number(req.params.id);
  const access = await resolveAccessContext(req, {
    requireActingUser: true,
    requireCompanyScope: false,
    allowSuperAdminAll: true
  });

  if (!access.ok) {
    return sendAccessError(res, access);
  }

  if (!targetUserId) {
    return res.json({
      success: false,
      message: "User id is required"
    });
  }

  if (!access.isSuperAdmin && !access.isApprovedAdmin) {
    return res.json({
      success: false,
      message: `You do not have access to ${action === "approve" ? "approve" : "reject"}`
    });
  }

  const targetUser = await findUserById(targetUserId);

  if (!targetUser) {
    return res.json({
      success: false,
      message: "Target user not found"
    });
  }

  if (
    !access.isSuperAdmin &&
    (targetUser.company_id === null ||
      Number(targetUser.company_id) !== Number(access.actingCompanyId))
  ) {
    return res.json({
      success: false,
      message: `You can only ${action === "approve" ? "approve" : "reject"} your own company's ${label.toLowerCase()}`
    });
  }

  if (action === "approve") {
    const role = normalizeApprovedRole(req.body.role);

    if (!role) {
      return res.json({
        success: false,
        message: "A valid role is required"
      });
    }

    await pool.query(
      `
      UPDATE users
      SET role = ?, status = 'approved'
      WHERE id = ?
      `,
      [role, targetUserId]
    );

    return res.json({
      success: true,
      message: `${label} approved successfully`
    });
  }

  await pool.query(
    `
    UPDATE users
    SET status = 'rejected'
    WHERE id = ?
    `,
    [targetUserId]
  );

  return res.json({
    success: true,
    message: `${label} rejected successfully`
  });
}

async function getCompanyAccessSnapshot(connection, companyId) {
  const [rows] = await connection.query(
    `
    SELECT
      id,
      company_name,
      owner_name,
      owner_email,
      status,
      access_status,
      login_status,
      suspended_until,
      deleted_at,
      deactivated_at,
      access_reason,
      updated_by,
      updated_at,
      created_at
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  return rows[0] || null;
}

async function getUserAccessSnapshot(connection, userId) {
  const [rows] = await connection.query(
    `
    SELECT
      id,
      name,
      mobile,
      email,
      role,
      company_id,
      status,
      login_status,
      blocked_until,
      deleted_at,
      deactivated_at,
      force_logout_after,
      access_reason,
      updated_by,
      updated_at,
      created_at
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function runSuperAdminAccessMutation(req, res, {
  entityType,
  entityLabel,
  actionType,
  successMessage,
  selectSnapshot,
  mutate,
  preventSelfTarget = false
}) {
  let connection;

  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const targetId = Number(req.params.id || 0);
    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: `${entityLabel} id is required`
      });
    }

    if (preventSelfTarget && Number(access.actingUserId || 0) === targetId) {
      return res.status(400).json({
        success: false,
        message: "SuperAdmin cannot disable, delete, or force logout themselves"
      });
    }

    const reasonResult = getRequiredReason(req);
    if (!reasonResult.ok) {
      return res.status(400).json({
        success: false,
        message: reasonResult.message
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const before = await selectSnapshot(connection, targetId);
    if (!before) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `${entityLabel} not found`
      });
    }

    if (entityType === "USER" && isSuperAdminUser(before)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "SuperAdmin accounts cannot be managed from access-control actions."
      });
    }

    const mutationResult = await mutate(connection, {
      targetId,
      reason: reasonResult.reason,
      access,
      before
    });

    if (mutationResult?.ok === false) {
      await connection.rollback();
      return res.status(mutationResult.status || 400).json({
        success: false,
        message: mutationResult.message || "Access update failed"
      });
    }

    const after = await selectSnapshot(connection, targetId);

    await logActivitySafe(connection, req, access, {
      companyId: entityType === "COMPANY" ? targetId : before.company_id ?? null,
      userId: entityType === "USER" ? targetId : null,
      actionType,
      entityType,
      entityId: String(targetId),
      moduleName: "superadmin-access",
      status: "success",
      message: successMessage,
      beforeData: before,
      afterData: after,
      metadata: {
        reason: reasonResult.reason
      }
    });

    await connection.commit();

    return res.json({
      success: true,
      message: successMessage,
      [entityType === "COMPANY" ? "company" : "user"]: after
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error(`${actionType || "SuperAdmin access mutation"} error:`, error);
    return res.status(500).json({
      success: false,
      message: "Access update failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
}

async function testDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
    [tableName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    `,
    [tableName, columnName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function addColumnIfMissing(tableName, columnName, definitionSql) {
  const exists = await columnExists(tableName, columnName);
  if (!exists) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
    console.log(`Column added: ${tableName}.${columnName}`);
  }
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND index_name = ?
    `,
    [tableName, indexName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function addIndexIfMissing(tableName, indexName, definitionSql) {
  const exists = await indexExists(tableName, indexName);
  if (!exists) {
    try {
      await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} ${definitionSql}`);
      console.log(`Index added: ${tableName}.${indexName}`);
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        throw error;
      }
    }
  }
}

async function addUniqueIndexIfMissing(tableName, indexName, definitionSql) {
  const exists = await indexExists(tableName, indexName);
  if (!exists) {
    try {
      await pool.query(`ALTER TABLE ${tableName} ADD UNIQUE INDEX ${indexName} ${definitionSql}`);
      console.log(`Unique index added: ${tableName}.${indexName}`);
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        throw error;
      }
    }
  }
}

const ERP_MODULE_CATALOG = [
  { key: "DASHBOARD", name: "Dashboard", category: "CORE", description: "Core ERP dashboard", sortOrder: 10 },
  { key: "SETTINGS", name: "Settings", category: "CORE", description: "Company settings and configuration", sortOrder: 20 },
  { key: "STAFF_MANAGEMENT", name: "Staff Management", category: "CORE", description: "Company staff management", sortOrder: 30 },
  { key: "ADMIN_APPROVAL", name: "Admin Approval", category: "CORE", description: "Company and user approval workflows", sortOrder: 40 },
  { key: "PRODUCTION", name: "Production", category: "PRODUCTION", description: "Production dashboard and manufacturing workspace", sortOrder: 100 },
  { key: "PROCESS", name: "Process", category: "PRODUCTION", description: "Manufacturing process and lot tracking", sortOrder: 110 },
  { key: "STICKER", name: "Sticker", category: "PRODUCTION", description: "Barcode sticker creation and management", sortOrder: 120 },
  { key: "MATERIAL_STOCK", name: "Material Stock", category: "PRODUCTION", description: "Raw material stock management", sortOrder: 130 },
  { key: "STORE", name: "Store", category: "STORE", description: "Store and sales dashboard workspace", sortOrder: 200 },
  { key: "STOCK", name: "Stock", category: "STORE", description: "Finished goods stock management", sortOrder: 210 },
  { key: "BILLING", name: "Billing", category: "STORE", description: "Sales billing workflows", sortOrder: 220 },
  { key: "INVOICE", name: "Invoice", category: "STORE", description: "Invoice generation and viewing", sortOrder: 230 },
  { key: "SALES", name: "Sales", category: "STORE", description: "Sales history and sales reports", sortOrder: 240 },
  { key: "RETURN", name: "Return", category: "STORE", description: "Customer return workflows", sortOrder: 250 },
  { key: "DAILY_REPORT", name: "Daily Report", category: "STORE", description: "Daily sales and store reporting", sortOrder: 260 },
  { key: "EXPENSE", name: "Expense", category: "FINANCE", description: "Expense management", sortOrder: 300 },
  { key: "TRANSACTION", name: "Transaction", category: "FINANCE", description: "Accounts transaction ledger", sortOrder: 310 },
  { key: "PROFIT_REPORT", name: "Profit Report", category: "FINANCE", description: "Profit and loss reporting", sortOrder: 320 },
  { key: "BRANCH", name: "Branch", category: "BRANCH", description: "Branch setup and branch context", sortOrder: 400 },
  { key: "BRANCH_TRANSFER", name: "Branch Transfer", category: "BRANCH", description: "Branch stock transfer workflows", sortOrder: 410 },
  { key: "BRANCH_RECEIVE", name: "Branch Receive", category: "BRANCH", description: "Branch receiving workflows", sortOrder: 420 },
  { key: "BRANCH_AUDIT", name: "Branch Audit", category: "BRANCH", description: "Branch audit and reconciliation", sortOrder: 430 },
  { key: "AUDIT", name: "Audit", category: "REPORTING", description: "ERP audit reports", sortOrder: 500 },
  { key: "ANALYTICS", name: "Analytics", category: "REPORTING", description: "ERP analytics reports", sortOrder: 510 },
  { key: "PURCHASE", name: "Purchase", category: "FUTURE", description: "Future purchase module", sortOrder: 900, defaultEnabled: 0 }
];

const ERP_PLAN_CATALOG = [
  { key: "PRODUCTION_ONLY", name: "Production Only", description: "Manufacturing and production workflow access", isCustom: 0 },
  { key: "STORE_ONLY", name: "Store Only", description: "Store, sales, billing, and invoice workflow access", isCustom: 0 },
  { key: "BRANCH_STORE", name: "Branch Store", description: "Store workflow access with branch transfer and audit modules", isCustom: 0 },
  { key: "FULL_ERP", name: "Full ERP", description: "All currently available ERP modules", isCustom: 0 },
  { key: "CUSTOM", name: "Custom", description: "Company-specific module selection", isCustom: 1 }
];

const ERP_PLAN_MODULES = {
  PRODUCTION_ONLY: ["DASHBOARD", "SETTINGS", "STAFF_MANAGEMENT", "PRODUCTION", "PROCESS", "STICKER", "MATERIAL_STOCK"],
  STORE_ONLY: ["DASHBOARD", "SETTINGS", "STAFF_MANAGEMENT", "STORE", "STOCK", "BILLING", "INVOICE", "SALES", "RETURN", "DAILY_REPORT"],
  BRANCH_STORE: [
    "DASHBOARD",
    "SETTINGS",
    "STAFF_MANAGEMENT",
    "STORE",
    "STOCK",
    "BILLING",
    "INVOICE",
    "SALES",
    "RETURN",
    "DAILY_REPORT",
    "BRANCH",
    "BRANCH_TRANSFER",
    "BRANCH_RECEIVE",
    "BRANCH_AUDIT",
    "AUDIT",
    "ANALYTICS"
  ],
  FULL_ERP: ERP_MODULE_CATALOG.filter((moduleConfig) => moduleConfig.key !== "PURCHASE").map((moduleConfig) => moduleConfig.key),
  CUSTOM: []
};

async function seedSaasModuleCatalog() {
  let inserted = 0;

  for (const moduleConfig of ERP_MODULE_CATALOG) {
    const [result] = await pool.query(
      `
      INSERT INTO erp_modules
      (module_key, module_name, category, description, is_system, default_enabled, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        module_name = VALUES(module_name),
        category = VALUES(category),
        description = VALUES(description),
        is_system = VALUES(is_system),
        default_enabled = VALUES(default_enabled),
        sort_order = VALUES(sort_order),
        updated_at = NOW()
      `,
      [
        moduleConfig.key,
        moduleConfig.name,
        moduleConfig.category,
        moduleConfig.description,
        Number(moduleConfig.defaultEnabled ?? 1),
        Number(moduleConfig.sortOrder || 0)
      ]
    );

    if (Number(result?.affectedRows || 0) === 1) inserted += 1;
  }

  return inserted;
}

async function seedSaasPlans() {
  let inserted = 0;

  for (const planConfig of ERP_PLAN_CATALOG) {
    const [result] = await pool.query(
      `
      INSERT INTO erp_plans
      (plan_key, plan_name, description, is_custom, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        plan_name = VALUES(plan_name),
        description = VALUES(description),
        is_custom = VALUES(is_custom),
        status = VALUES(status),
        updated_at = NOW()
      `,
      [planConfig.key, planConfig.name, planConfig.description, Number(planConfig.isCustom || 0)]
    );

    if (Number(result?.affectedRows || 0) === 1) inserted += 1;
  }

  return inserted;
}

async function seedSaasPlanModules() {
  let inserted = 0;

  for (const [planKey, moduleKeys] of Object.entries(ERP_PLAN_MODULES)) {
    if (!moduleKeys.length) continue;

    const [planRows] = await pool.query("SELECT id FROM erp_plans WHERE plan_key = ? LIMIT 1", [planKey]);
    const planId = Number(planRows[0]?.id || 0);
    if (!planId) continue;

    for (const moduleKey of moduleKeys) {
      const [result] = await pool.query(
        `
        INSERT INTO erp_plan_modules (plan_id, module_key, enabled, created_at, updated_at)
        VALUES (?, ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          enabled = VALUES(enabled),
          updated_at = NOW()
        `,
        [planId, moduleKey]
      );

      if (Number(result?.affectedRows || 0) === 1) inserted += 1;
    }
  }

  return inserted;
}

async function backfillCompanySaasAccess() {
  if (!(await tableExists("companies"))) {
    return { companyCount: 0, planAssignmentsInserted: 0, moduleAccessInserted: 0 };
  }

  const [fullErpRows] = await pool.query("SELECT id FROM erp_plans WHERE plan_key = 'FULL_ERP' LIMIT 1");
  const fullErpPlanId = Number(fullErpRows[0]?.id || 0);
  if (!fullErpPlanId) {
    return { companyCount: 0, planAssignmentsInserted: 0, moduleAccessInserted: 0 };
  }

  const [companyRows] = await pool.query("SELECT id FROM companies WHERE id IS NOT NULL ORDER BY id ASC");

  const [assignmentResult] = await pool.query(
    `
    INSERT IGNORE INTO company_plan_assignments
    (company_id, plan_id, plan_key_snapshot, effective_from, effective_until, status, assigned_by, assigned_at, updated_by, updated_at)
    SELECT c.id, ?, 'FULL_ERP', CURDATE(), NULL, 'ACTIVE', NULL, NOW(), NULL, NOW()
    FROM companies c
    WHERE c.id IS NOT NULL
    `,
    [fullErpPlanId]
  );

  const [moduleAccessResult] = await pool.query(
    `
    INSERT IGNORE INTO company_module_access
    (company_id, module_key, enabled, source, reason, updated_by, updated_at)
    SELECT c.id, m.module_key, 1, 'PLAN', 'Phase 1 FULL_ERP safety backfill', NULL, NOW()
    FROM companies c
    CROSS JOIN erp_modules m
    WHERE c.id IS NOT NULL
    `
  );

  return {
    companyCount: companyRows.length,
    planAssignmentsInserted: Number(assignmentResult?.affectedRows || 0),
    moduleAccessInserted: Number(moduleAccessResult?.affectedRows || 0)
  };
}

async function ensureSaasModuleAccessFoundation() {
  const moduleInsertCount = await seedSaasModuleCatalog();
  const planInsertCount = await seedSaasPlans();
  const planModuleInsertCount = await seedSaasPlanModules();
  const backfillResult = await backfillCompanySaasAccess();

  console.log(
    `SaaS module foundation ensured: ${moduleInsertCount} module(s), ${planInsertCount} plan(s), ${planModuleInsertCount} plan-module row(s) inserted; ` +
      `${backfillResult.planAssignmentsInserted} company plan assignment(s), ${backfillResult.moduleAccessInserted} company module access row(s) backfilled across ${backfillResult.companyCount} compan${backfillResult.companyCount === 1 ? "y" : "ies"}`
  );
}

function normalizeModuleKey(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function normalizePlanKey(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

async function getSaasModuleCatalogRows() {
  const [rows] = await pool.query(
    `
    SELECT
      module_key,
      module_name,
      category,
      description,
      default_enabled,
      sort_order
    FROM erp_modules
    ORDER BY sort_order ASC, module_key ASC
    `
  );

  return rows;
}

function buildFallbackModuleAccessRows(moduleRows = []) {
  const fullErpModuleKeys = new Set(ERP_PLAN_MODULES.FULL_ERP.map((moduleKey) => normalizeModuleKey(moduleKey)));

  return moduleRows.map((moduleRow) => {
    const moduleKey = normalizeModuleKey(moduleRow.module_key);
    return {
      module_key: moduleKey,
      enabled: fullErpModuleKeys.has(moduleKey) ? 1 : 0,
      source: "FALLBACK",
      reason: "FULL_ERP compatibility fallback",
      updated_at: null
    };
  });
}

async function getCompanyPlanContext(companyId) {
  const cleanCompanyId = Number(companyId || 0);
  if (!cleanCompanyId) {
    return {
      company_id: null,
      plan: null,
      effective_from: null,
      effective_until: null,
      status: "",
      is_fallback: true
    };
  }

  const [rows] = await pool.query(
    `
    SELECT
      cpa.company_id,
      cpa.effective_from,
      cpa.effective_until,
      cpa.status,
      cpa.assigned_at,
      p.plan_key,
      p.plan_name,
      p.description,
      p.is_custom
    FROM company_plan_assignments cpa
    LEFT JOIN erp_plans p ON p.id = cpa.plan_id
    WHERE cpa.company_id = ?
    LIMIT 1
    `,
    [cleanCompanyId]
  );

  const row = rows[0] || null;
  if (row?.plan_key) {
    return {
      company_id: cleanCompanyId,
      plan: {
        plan_key: normalizePlanKey(row.plan_key),
        plan_name: row.plan_name || row.plan_key,
        description: row.description || "",
        is_custom: Number(row.is_custom || 0)
      },
      effective_from: row.effective_from ?? null,
      effective_until: row.effective_until ?? null,
      status: row.status || "ACTIVE",
      assigned_at: row.assigned_at ?? null,
      is_fallback: false
    };
  }

  const [fullErpRows] = await pool.query(
    `
    SELECT plan_key, plan_name, description, is_custom
    FROM erp_plans
    WHERE plan_key = 'FULL_ERP'
    LIMIT 1
    `
  );
  const fullErp = fullErpRows[0] || {
    plan_key: "FULL_ERP",
    plan_name: "Full ERP",
    description: "Compatibility fallback",
    is_custom: 0
  };

  return {
    company_id: cleanCompanyId,
    plan: {
      plan_key: normalizePlanKey(fullErp.plan_key || "FULL_ERP"),
      plan_name: fullErp.plan_name || "Full ERP",
      description: fullErp.description || "",
      is_custom: Number(fullErp.is_custom || 0)
    },
    effective_from: null,
    effective_until: null,
    status: "ACTIVE",
    assigned_at: null,
    is_fallback: true
  };
}

async function getCompanyEnabledModules(companyId) {
  const cleanCompanyId = Number(companyId || 0);
  const moduleRows = await getSaasModuleCatalogRows();

  if (!cleanCompanyId) {
    const fallbackRows = buildFallbackModuleAccessRows(moduleRows);
    const modules = fallbackRows.reduce((acc, row) => {
      acc[row.module_key] = Number(row.enabled || 0) === 1;
      return acc;
    }, {});

    return {
      modules,
      module_list: moduleRows.map((moduleRow) => {
        const moduleKey = normalizeModuleKey(moduleRow.module_key);
        return {
          module_key: moduleKey,
          module_name: moduleRow.module_name || moduleKey,
          category: moduleRow.category || "",
          enabled: Boolean(modules[moduleKey]),
          source: "FALLBACK"
        };
      }),
      raw_rows: fallbackRows,
      is_fallback: true
    };
  }

  const [accessRows] = await pool.query(
    `
    SELECT
      module_key,
      enabled,
      source,
      reason,
      updated_at
    FROM company_module_access
    WHERE company_id = ?
    ORDER BY module_key ASC
    `,
    [cleanCompanyId]
  );

  const rawRows = accessRows.length ? accessRows : buildFallbackModuleAccessRows(moduleRows);
  const accessByModule = new Map(
    rawRows.map((row) => [
      normalizeModuleKey(row.module_key),
      {
        ...row,
        module_key: normalizeModuleKey(row.module_key),
        enabled: Number(row.enabled || 0) === 1
      }
    ])
  );

  const modules = {};
  const moduleList = moduleRows.map((moduleRow) => {
    const moduleKey = normalizeModuleKey(moduleRow.module_key);
    const accessRow = accessByModule.get(moduleKey);
    const enabled = accessRow ? Boolean(accessRow.enabled) : false;
    modules[moduleKey] = enabled;

    return {
      module_key: moduleKey,
      module_name: moduleRow.module_name || moduleKey,
      category: moduleRow.category || "",
      description: moduleRow.description || "",
      enabled,
      source: accessRow?.source || (accessRows.length ? "MISSING" : "FALLBACK"),
      reason: accessRow?.reason || "",
      updated_at: accessRow?.updated_at ?? null
    };
  });

  return {
    modules,
    module_list: moduleList,
    raw_rows: rawRows.map((row) => ({
      module_key: normalizeModuleKey(row.module_key),
      enabled: Number(row.enabled || 0) === 1,
      source: row.source || (accessRows.length ? "PLAN" : "FALLBACK"),
      reason: row.reason || "",
      updated_at: row.updated_at ?? null
    })),
    is_fallback: !accessRows.length
  };
}

function isSaasPlanReaderRole(role = "") {
  const normalizedRole = normalizeRoleValue(role);
  return normalizedRole === "OWNER" || normalizedRole === "ACCOUNTS";
}

const MODULE_PREVIEW_ROUTE_RULES = [
  { moduleKey: "BILLING", pattern: /^\/billing(?:\.html)?$/i },
  { moduleKey: "BILLING", pattern: /^\/saveBilling$/i },
  { moduleKey: "BILLING", pattern: /^\/invoice-drafts(?:\/|$)/i },
  { moduleKey: "INVOICE", pattern: /^\/invoice(?:\.html)?$/i },
  { moduleKey: "INVOICE", pattern: /^\/saveInvoice$/i },
  { moduleKey: "PROCESS", pattern: /^\/process(?:\.html)?$/i },
  { moduleKey: "PROCESS", pattern: /^\/process(?:\/|$)/i },
  { moduleKey: "STICKER", pattern: /^\/sticker(?:\.html)?$/i },
  { moduleKey: "STICKER", pattern: /^\/(?:addSticker|updateSticker|deleteSticker|restoreSticker|getSticker)(?:\/|$)/i },
  { moduleKey: "STOCK", pattern: /^\/stock(?:\.html)?$/i },
  { moduleKey: "STOCK", pattern: /^\/getStock$/i },
  { moduleKey: "BRANCH", pattern: /^\/branch-management(?:\.html)?$/i },
  { moduleKey: "BRANCH", pattern: /^\/branches(?:\/|$)/i },
  { moduleKey: "BRANCH", pattern: /^\/branch-stock(?:\/|$)/i },
  { moduleKey: "BRANCH_TRANSFER", pattern: /^\/branch-transfer(?:\.html)?$/i },
  { moduleKey: "BRANCH_TRANSFER", pattern: /^\/branch-transfer-history(?:\.html)?$/i },
  { moduleKey: "BRANCH_TRANSFER", pattern: /^\/branch-transfers(?:\/|$)/i },
  { moduleKey: "BRANCH_RECEIVE", pattern: /^\/branch-receive(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-audit-dashboard(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-reconciliation(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-snapshots(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-reconciliation-runs(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-exception-queue(?:\.html)?$/i },
  { moduleKey: "BRANCH_AUDIT", pattern: /^\/branch-audit(?:\/|$)/i },
  { moduleKey: "ANALYTICS", pattern: /^\/branch-analytics(?:\.html|\/|$)/i },
  { moduleKey: "ANALYTICS", pattern: /^\/transfer-ageing-report(?:\.html)?$/i },
  { moduleKey: "ANALYTICS", pattern: /^\/shortage-analytics(?:\.html)?$/i },
  { moduleKey: "ANALYTICS", pattern: /^\/stock-movement-ledger(?:\.html)?$/i },
  { moduleKey: "PROFIT_REPORT", pattern: /^\/profit-report(?:\.html)?$/i },
  { moduleKey: "TRANSACTION", pattern: /^\/transaction(?:\.html|\/|$)/i },
  { moduleKey: "TRANSACTION", pattern: /^\/transaction-reports(?:\.html)?$/i }
];

const MODULE_ROUTE_AUDIT_CANDIDATES = [
  ...Array.from(PROTECTED_PAGES).map((page) => ({
    method: "GET",
    path: `/${page}`,
    source: "PROTECTED_PAGE",
    risk: page.includes("dashboard") || page.includes("report") || page.includes("analytics") ? "MEDIUM" : "LOW"
  })),
  { method: "*", path: "/getDailyReport", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/expenses", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/materialStock", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/saveReturn", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/getReturns", source: "KNOWN_API", risk: "LOW" },
  { method: "*", path: "/getReturnSummary", source: "KNOWN_API", risk: "LOW" },
  { method: "*", path: "/sales-history", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/getSalesHistory", source: "KNOWN_API", risk: "MEDIUM" },
  { method: "*", path: "/api/dashboard", source: "KNOWN_API", risk: "LOW" },
  { method: "*", path: "/api/smart-dashboard", source: "KNOWN_API", risk: "LOW" }
];

function getRegisteredModuleRouteMappings() {
  return MODULE_PREVIEW_ROUTE_RULES.map((rule, index) => ({
    id: index + 1,
    module_key: normalizeModuleKey(rule.moduleKey),
    method: rule.method || "*",
    pattern: String(rule.pattern || ""),
    status: "MAPPED"
  }));
}

function isRoutePathMapped(pathname = "") {
  const cleanPath = String(pathname || "").trim();
  if (!cleanPath) return false;
  return MODULE_PREVIEW_ROUTE_RULES.some((rule) => rule.pattern.test(cleanPath));
}

function getRouteModuleKey(req) {
  const requestPath = String(req.path || "").trim();
  if (!requestPath) return "";

  const matchedRule = MODULE_PREVIEW_ROUTE_RULES.find((rule) => rule.pattern.test(requestPath));
  return normalizeModuleKey(matchedRule?.moduleKey || "");
}

function getPreviewPageKey(req) {
  const requestPath = String(req.path || "").trim();
  if (!requestPath.toLowerCase().endsWith(".html")) return null;
  return path.basename(requestPath);
}

function normalizeEnforcementMode(value = "") {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "HARD_ENFORCEMENT") return "HARD_ENFORCEMENT";
  return "REPORT_ONLY";
}

async function getGlobalEnforcementMode() {
  const [rows] = await pool.query(
    `
    SELECT enforcement_mode, reason, updated_by, updated_at
    FROM module_enforcement_settings
    WHERE scope_type = 'GLOBAL'
    ORDER BY id ASC
    LIMIT 1
    `
  );

  const row = rows[0] || null;
  return {
    enforcement_mode: normalizeEnforcementMode(row?.enforcement_mode || "REPORT_ONLY"),
    reason: row?.reason || "",
    updated_by: row?.updated_by ?? null,
    updated_at: row?.updated_at ?? null,
    is_default: !row
  };
}

async function getCompanyEnforcementMode(companyId) {
  const cleanCompanyId = Number(companyId || 0);
  if (!cleanCompanyId) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT enforcement_mode, reason, updated_by, updated_at
    FROM module_enforcement_settings
    WHERE scope_type = 'COMPANY'
      AND company_id = ?
    LIMIT 1
    `,
    [cleanCompanyId]
  );

  const row = rows[0] || null;
  if (!row) return null;

  return {
    company_id: cleanCompanyId,
    enforcement_mode: normalizeEnforcementMode(row.enforcement_mode),
    reason: row.reason || "",
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null
  };
}

async function getEffectiveEnforcementMode(companyId) {
  const companyMode = await getCompanyEnforcementMode(companyId);
  if (companyMode) {
    return {
      enforcement_mode: companyMode.enforcement_mode,
      source: "COMPANY",
      company_override: companyMode
    };
  }

  const globalMode = await getGlobalEnforcementMode();
  return {
    enforcement_mode: globalMode.enforcement_mode,
    source: globalMode.is_default ? "DEFAULT" : "GLOBAL",
    global: globalMode
  };
}

async function isHardEnforcementEnabled(companyId) {
  const effectiveMode = await getEffectiveEnforcementMode(companyId);
  return effectiveMode.enforcement_mode === "HARD_ENFORCEMENT";
}

function getRequestCompanyIdForModulePreview(req) {
  const requestedCompanyId = getRequestedCompanyId(req);
  if (requestedCompanyId !== null) return requestedCompanyId;

  const tokenCompanyId = req.user?.companyId ?? req.user?.company_id ?? null;
  if (tokenCompanyId === null || tokenCompanyId === undefined || tokenCompanyId === "") return null;

  const parsed = Number(tokenCompanyId);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

async function isCompanyModuleEnabled(companyId, moduleKey) {
  const cleanCompanyId = Number(companyId || 0);
  const cleanModuleKey = normalizeModuleKey(moduleKey);
  if (!cleanCompanyId || !cleanModuleKey) return true;

  const moduleContext = await getCompanyEnabledModules(cleanCompanyId);
  if (!moduleContext?.modules || !Object.prototype.hasOwnProperty.call(moduleContext.modules, cleanModuleKey)) {
    return true;
  }

  return moduleContext.modules[cleanModuleKey] !== false;
}

async function logWouldBlockModuleAccess({
  req,
  companyId,
  userId,
  role,
  moduleKey,
  pageKey = null
}) {
  await pool.query(
    `
    INSERT INTO module_access_violation_logs
    (
      company_id,
      user_id,
      role,
      module_key,
      request_method,
      request_path,
      page_key,
      would_block,
      request_ip,
      user_agent,
      query_json,
      body_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW())
    `,
    [
      companyId ?? null,
      userId ?? null,
      String(role || "").trim().slice(0, 80),
      normalizeModuleKey(moduleKey),
      String(req.method || "").trim().toUpperCase().slice(0, 16),
      String(req.originalUrl || req.path || "").trim().slice(0, 255),
      pageKey ? String(pageKey).trim().slice(0, 120) : null,
      getRequestIpAddress(req),
      String(req.headers["user-agent"] || "").slice(0, 1000),
      safeJsonStringify(sanitizeAuditPayload(req.query || {})),
      safeJsonStringify(sanitizeAuditPayload(req.body || {}))
    ]
  );
}

async function logModuleEnforcementEvent({
  req,
  companyId,
  userId,
  role,
  moduleKey,
  enforcementMode,
  eventType
}) {
  await pool.query(
    `
    INSERT INTO module_access_enforcement_events
    (
      company_id,
      user_id,
      role,
      module_key,
      request_method,
      request_path,
      enforcement_mode,
      event_type,
      request_ip,
      user_agent,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      companyId ?? null,
      userId ?? null,
      String(role || "").trim().slice(0, 80),
      normalizeModuleKey(moduleKey),
      String(req.method || "").trim().toUpperCase().slice(0, 16),
      String(req.originalUrl || req.path || "").trim().slice(0, 255),
      normalizeEnforcementMode(enforcementMode),
      String(eventType || "WOULD_BLOCK").trim().toUpperCase() === "HARD_BLOCK" ? "HARD_BLOCK" : "WOULD_BLOCK",
      getRequestIpAddress(req),
      String(req.headers["user-agent"] || "").slice(0, 1000)
    ]
  );
}

async function modulePreviewEnforcementMiddleware(req, res, next) {
  try {
    if (!req.user) return next();

    const moduleKey = getRouteModuleKey(req);
    if (!moduleKey) return next();

    const companyId = getRequestCompanyIdForModulePreview(req);
    if (!companyId) return next();

    const enabled = await isCompanyModuleEnabled(companyId, moduleKey);
    if (enabled) return next();

    req.modulePreviewWarning = true;
    req.modulePreviewModule = moduleKey;
    res.setHeader("X-Module-Preview-Warning", "MODULE_DISABLED_PREVIEW");
    const effectiveMode = await getEffectiveEnforcementMode(companyId);
    const enforcementMode = normalizeEnforcementMode(effectiveMode.enforcement_mode);
    const eventType = enforcementMode === "HARD_ENFORCEMENT" ? "HARD_BLOCK" : "WOULD_BLOCK";

    await logWouldBlockModuleAccess({
      req,
      companyId,
      userId: getRequestedUserId(req),
      role: req.user?.role || "",
      moduleKey,
      pageKey: getPreviewPageKey(req)
    });
    await logModuleEnforcementEvent({
      req,
      companyId,
      userId: getRequestedUserId(req),
      role: req.user?.role || "",
      moduleKey,
      enforcementMode,
      eventType
    });

    if (enforcementMode === "HARD_ENFORCEMENT") {
      return res.status(403).json({
        success: false,
        message: "This module is not enabled for your company",
        module: moduleKey,
        enforcement_mode: "HARD_ENFORCEMENT"
      });
    }

    return next();
  } catch (error) {
    console.error("Module preview middleware failed open:", error);
    return next();
  }
}

async function getCompanyForPlanManagement(connection, companyId) {
  const [rows] = await connection.query(
    `
    SELECT id, company_name, status, access_status
    FROM companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId]
  );

  return rows[0] || null;
}

async function getPlanForAssignment(connection, planKey) {
  const [rows] = await connection.query(
    `
    SELECT id, plan_key, plan_name, is_custom, status
    FROM erp_plans
    WHERE plan_key = ?
      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
    LIMIT 1
    `,
    [normalizePlanKey(planKey)]
  );

  return rows[0] || null;
}

async function getPlanModuleKeySet(connection, planId) {
  const [rows] = await connection.query(
    `
    SELECT module_key
    FROM erp_plan_modules
    WHERE plan_id = ?
      AND COALESCE(enabled, 0) = 1
    `,
    [planId]
  );

  return new Set(rows.map((row) => normalizeModuleKey(row.module_key)).filter(Boolean));
}

async function getCompanyModuleAccessMap(connection, companyId) {
  const [rows] = await connection.query(
    `
    SELECT module_key, enabled, source, reason, updated_at
    FROM company_module_access
    WHERE company_id = ?
    `,
    [companyId]
  );

  return new Map(
    rows.map((row) => [
      normalizeModuleKey(row.module_key),
      {
        ...row,
        module_key: normalizeModuleKey(row.module_key),
        enabled: Number(row.enabled || 0) === 1
      }
    ])
  );
}

async function writeCompanyModuleAccessAudit(connection, {
  companyId,
  moduleKey,
  oldEnabled = null,
  newEnabled = null,
  oldPlanKey = "",
  newPlanKey = "",
  changedBy = null,
  reason = ""
}) {
  await connection.query(
    `
    INSERT INTO company_module_access_audit
    (
      company_id,
      module_key,
      old_enabled,
      new_enabled,
      old_plan_key,
      new_plan_key,
      changed_by,
      change_reason,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      companyId,
      normalizeModuleKey(moduleKey),
      oldEnabled === null || oldEnabled === undefined ? null : Number(Boolean(oldEnabled)),
      newEnabled === null || newEnabled === undefined ? null : Number(Boolean(newEnabled)),
      oldPlanKey ? normalizePlanKey(oldPlanKey) : null,
      newPlanKey ? normalizePlanKey(newPlanKey) : null,
      changedBy ?? null,
      String(reason || "").trim() || null
    ]
  );
}

async function warnIfSchemaPiecesMissing(tableName, columnNames = [], indexNames = []) {
  if (!(await tableExists(tableName))) {
    console.warn(`[SCHEMA WARNING] Table ${tableName} is missing. Startup will continue, but related features may not work until migrations run.`);
    return;
  }

  for (const columnName of columnNames) {
    if (!(await columnExists(tableName, columnName))) {
      console.warn(`[SCHEMA WARNING] Column ${tableName}.${columnName} is missing. Startup will continue, but related features may not work until migrations run.`);
    }
  }

  for (const indexName of indexNames) {
    if (!(await indexExists(tableName, indexName))) {
      console.warn(`[SCHEMA WARNING] Index ${tableName}.${indexName} is missing. Startup will continue, but related queries may be slower until migrations run.`);
    }
  }
}

async function warnForRecentSchemaSafety() {
  await warnIfSchemaPiecesMissing(
    "stock",
    ["category", "source", "manual_lot_id", "reference_step_id", "deleted_at", "updated_at"],
    ["idx_stock_recovery_unused"]
  );
  await warnIfSchemaPiecesMissing(
    "process_lots",
    ["work_category", "template_id", "completed_at", "completed_by", "is_manual_lot"],
    ["idx_process_lots_category_lot"]
  );
  await warnIfSchemaPiecesMissing(
    "process_step_additive_issues",
    ["stock_item_id", "issue_stock_movement_id", "return_stock_movement_id"],
    ["idx_additive_issues_stock_item", "idx_additive_issues_issue_movement", "idx_additive_issues_return_movement"]
  );
  await warnIfSchemaPiecesMissing(
    "outside_karigar_ledger",
    ["work_category", "pending_weight", "issue_step_id", "receive_step_id"],
    ["idx_outside_karigar_category_lot", "idx_outside_karigar_status"]
  );
}

async function dropIndexIfExists(tableName, indexName) {
  const exists = await indexExists(tableName, indexName);
  if (exists) {
    await pool.query(`ALTER TABLE ${tableName} DROP INDEX ${indexName}`);
    console.log(`Index dropped: ${tableName}.${indexName}`);
  }
}

function getPagination(req, { defaultLimit = 100, maxLimit = 1000 } = {}) {
  const requestedLimit = Number(req.query.limit ?? req.query.pageSize ?? defaultLimit);
  const requestedOffset = Number(req.query.offset ?? 0);
  const requestedPage = Number(req.query.page ?? 0);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(Math.trunc(requestedLimit), maxLimit))
    : 0;
  const pageOffset = limit && Number.isFinite(requestedPage) && requestedPage > 1
    ? (Math.trunc(requestedPage) - 1) * limit
    : 0;
  const directOffset = Number.isFinite(requestedOffset) ? Math.max(0, Math.trunc(requestedOffset)) : 0;

  return {
    limit,
    offset: pageOffset || directOffset,
    sql: limit ? `LIMIT ${limit} OFFSET ${pageOffset || directOffset}` : ""
  };
}

function setPaginationHeaders(res, pagination) {
  if (!pagination?.limit) return;
  res.setHeader("X-ERP-Limit", String(pagination.limit));
  res.setHeader("X-ERP-Offset", String(pagination.offset || 0));
}

function getAuthCookieOptions() {
  const production = isProductionRuntime();
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "None" : "Lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000
  };
}

function getClearAuthCookieOptions() {
  const options = getAuthCookieOptions();
  delete options.maxAge;
  return options;
}

const CATEGORY_PROCESS_TEMPLATES = {
  REGULAR_SANKHA: {
    name: "Default Jewellery Process",
    steps: [
      "Patta",
      "Hydraulic Press",
      "Soldering",
      "Acid Poda",
      "Cutting",
      "Fitting"
    ]
  },
  KDM: {
    name: "Default KDM Process",
    steps: [
      "Patta",
      "Cutting"
    ]
  },
  PIN: {
    name: "Default PIN Process",
    steps: [
      "Patta",
      "Katai",
      "Soldering",
      "Acid Poda",
      "GPC"
    ]
  },
  JALI_SANKHA: {
    name: "Default JALI SANKHA Process",
    steps: [
      "Khadi Issue",
      "Jali Receive",
      "Acid Poda",
      "Cutting",
      "GPC",
      "Fitting"
    ]
  },
  MANGALSUTRA: {
    name: "Default MANGALSUTRA Process",
    steps: [
      "Outside Issue",
      "Receive",
      "Cutting",
      "GPC"
    ]
  }
};

function buildProcessTemplateStepRow(companyId, templateId, stepName, index, workCategory = "REGULAR_SANKHA") {
  const normalizedStepName = String(stepName || "").trim().toLowerCase();
  const normalizedCategory = normalizeWorkCategory(workCategory);
  const materialType =
    ["soldering", "solding", "solder", "kdm"].includes(normalizedStepName)
      ? "KDM"
      : normalizedCategory === "REGULAR_SANKHA" && normalizedStepName === "fitting"
        ? "PIN"
        : "";
  const usesAdditiveMaterial = materialType ? 1 : 0;

  return [
    usesAdditiveMaterial,
    materialType,
    1,
    companyId,
    templateId,
    index + 1,
    stepName,
    1,
    0,
    "ACTIVE"
  ];
}

async function seedDefaultProcessTemplatesForCompanies() {
  if (
    !(await tableExists("companies")) ||
    !(await tableExists("process_templates")) ||
    !(await tableExists("process_template_steps"))
  ) {
    return;
  }

  const [companies] = await pool.query(`
    SELECT id
    FROM companies
    WHERE id IS NOT NULL
    ORDER BY id ASC
  `);

  for (const company of companies) {
    const companyId = Number(company.id || 0);
    if (!companyId) continue;

    for (const [category, templateConfig] of Object.entries(CATEGORY_PROCESS_TEMPLATES)) {
      const workCategory = normalizeWorkCategory(category);
      const [existingTemplates] = await pool.query(
        `
        SELECT id
        FROM process_templates
        WHERE company_id = ?
          AND work_category = ?
          AND is_default = 1
          AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
        LIMIT 1
        `,
        [companyId, workCategory]
      );

      if (existingTemplates.length) continue;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [insertResult] = await connection.query(
          `
          INSERT INTO process_templates
          (company_id, name, work_category, is_default, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 1, 'ACTIVE', NULL, NOW(), NOW())
          `,
          [companyId, templateConfig.name, workCategory]
        );

        const templateId = insertResult.insertId;
        const stepRows = templateConfig.steps.map((stepName, index) => {
          return buildProcessTemplateStepRow(companyId, templateId, stepName, index, workCategory);
        });

        await connection.query(
          `
          INSERT INTO process_template_steps
          (
            uses_additive_material, additive_material_label, additive_affects_output_weight,
            company_id, template_id, step_order, step_name, is_required, allow_repeat, status
          )
          VALUES ?
          `,
          [stepRows]
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  }
}

async function backfillAdditiveTemplateMetadata() {
  if (!(await tableExists("process_template_steps"))) {
    return;
  }

  const [solderingResult] = await pool.query(
    `
    UPDATE process_template_steps pts
    JOIN process_templates pt
      ON pt.id = pts.template_id
     AND pt.company_id = pts.company_id
    SET pts.uses_additive_material = 1,
        pts.additive_material_label = 'KDM',
        pts.additive_affects_output_weight = 1
    WHERE LOWER(TRIM(step_name)) IN ('soldering', 'solding', 'solder', 'kdm')
      AND COALESCE(pts.uses_additive_material, 0) = 0
    `
  );

  const [pinResult] = await pool.query(
    `
    UPDATE process_template_steps pts
    JOIN process_templates pt
      ON pt.id = pts.template_id
     AND pt.company_id = pts.company_id
    SET pts.uses_additive_material = 1,
        pts.additive_material_label = 'PIN',
        pts.additive_affects_output_weight = 1
    WHERE pt.work_category = 'REGULAR_SANKHA'
      AND LOWER(TRIM(pts.step_name)) = 'fitting'
    `
  );

  console.log(`Additive template metadata backfilled: KDM ${Number(solderingResult.affectedRows || 0)} row(s), PIN ${Number(pinResult.affectedRows || 0)} row(s) updated`);
}

async function backfillSolderingAdditiveTemplateMetadata() {
  await backfillAdditiveTemplateMetadata();
}

async function seedInvoiceSequencesFromSalesHistory() {
  if (!(await tableExists("invoice_sequences"))) {
    return;
  }

  const currentYear = new Date().getFullYear();
  let companyRows = [];

  if (await tableExists("companies")) {
    const [rows] = await pool.query(`
      SELECT id
      FROM companies
      WHERE id IS NOT NULL
      ORDER BY id ASC
    `);
    companyRows = rows;
  } else if (await tableExists("sales_history")) {
    const [rows] = await pool.query(`
      SELECT DISTINCT company_id AS id
      FROM sales_history
      WHERE company_id IS NOT NULL
      ORDER BY company_id ASC
    `);
    companyRows = rows;
  }

  for (const company of companyRows) {
    const companyId = Number(company.id || 0);
    if (!companyId) continue;

    await pool.query(
      `
      INSERT INTO invoice_sequences (company_id, prefix, sequence_year, last_number)
      VALUES (?, 'BILL', ?, 0)
      ON DUPLICATE KEY UPDATE
        last_number = GREATEST(last_number, VALUES(last_number))
      `,
      [companyId, currentYear]
    );
  }

  if (!(await tableExists("sales_history"))) {
    return;
  }

  const [sequenceRows] = await pool.query(`
    SELECT
      company_id,
      CAST(SUBSTRING(invoice_number, 6, 4) AS UNSIGNED) AS sequence_year,
      MAX(CAST(SUBSTRING(invoice_number, 11) AS UNSIGNED)) AS last_number
    FROM sales_history
    WHERE company_id IS NOT NULL
      AND invoice_number REGEXP '^BILL-[0-9]{4}-[0-9]{6}$'
    GROUP BY company_id, sequence_year
  `);

  for (const row of sequenceRows) {
    const companyId = Number(row.company_id || 0);
    const sequenceYear = Number(row.sequence_year || 0);
    const lastNumber = Number(row.last_number || 0);
    if (!companyId || !sequenceYear) continue;

    await pool.query(
      `
      INSERT INTO invoice_sequences (company_id, prefix, sequence_year, last_number)
      VALUES (?, 'BILL', ?, ?)
      ON DUPLICATE KEY UPDATE
        last_number = GREATEST(last_number, VALUES(last_number))
      `,
      [companyId, sequenceYear, lastNumber]
    );
  }

  console.log(`Invoice sequences seeded: ${companyRows.length} company row(s), ${sequenceRows.length} detected sequence row(s)`);
}

async function backfillBranchFoundation() {
  if (!(await tableExists("companies")) || !(await tableExists("branches"))) {
    return;
  }

  const [branchInsertResult] = await pool.query(`
    INSERT INTO branches
    (
      company_id,
      branch_code,
      branch_name,
      branch_type,
      address,
      contact_name,
      contact_phone,
      status,
      created_by,
      created_at,
      updated_at
    )
    SELECT
      c.id,
      'MAIN',
      'Main Branch',
      'MAIN',
      NULL,
      NULL,
      NULL,
      'ACTIVE',
      NULL,
      NOW(),
      NOW()
    FROM companies c
    WHERE c.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM branches b
        WHERE b.company_id = c.id
          AND UPPER(TRIM(b.branch_code)) = 'MAIN'
      )
  `);

  let stockBranchBackfillCount = 0;
  let stockStateBackfillCount = 0;

  if (await tableExists("stock")) {
    const hasCurrentBranchColumn = await columnExists("stock", "current_branch_id");
    const hasStockStateColumn = await columnExists("stock", "stock_state");

    if (hasCurrentBranchColumn) {
      const [stockBranchResult] = await pool.query(`
        UPDATE stock s
        JOIN (
          SELECT company_id, MIN(id) AS main_branch_id
          FROM branches
          WHERE UPPER(TRIM(branch_code)) = 'MAIN'
          GROUP BY company_id
        ) mb
          ON mb.company_id = s.company_id
        SET s.current_branch_id = mb.main_branch_id
        WHERE s.current_branch_id IS NULL
          AND s.company_id IS NOT NULL
      `);
      stockBranchBackfillCount = Number(stockBranchResult?.affectedRows || 0);
    }

    if (hasStockStateColumn) {
      const [stockStateResult] = await pool.query(`
        UPDATE stock
        SET stock_state = COALESCE(NULLIF(TRIM(status), ''), 'IN_STOCK')
        WHERE stock_state IS NULL
      `);
      stockStateBackfillCount = Number(stockStateResult?.affectedRows || 0);
    }
  }

  console.log(
    `Branch foundation backfilled: ${Number(branchInsertResult?.affectedRows || 0)} main branch row(s), ${stockBranchBackfillCount} stock branch row(s), ${stockStateBackfillCount} stock state row(s)`
  );
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) DEFAULT '',
      owner_email VARCHAR(255) DEFAULT '',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_signup_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) DEFAULT '',
      owner_email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      company_id INT DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      rejected_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) DEFAULT '',
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT '',
      company_id INT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      serial VARCHAR(50) DEFAULT '',
      product_name VARCHAR(255) DEFAULT '',
      purity VARCHAR(50) DEFAULT '',
      sku VARCHAR(100) DEFAULT '',
      mm VARCHAR(50) DEFAULT '',
      size VARCHAR(100) DEFAULT '',
      weight DECIMAL(10,3) DEFAULT 0.000,
      qty INT DEFAULT 1,
      category VARCHAR(120) DEFAULT '',
      lot_number VARCHAR(100) DEFAULT '',
      barcode VARCHAR(255) DEFAULT '',
      metal_type VARCHAR(50) DEFAULT '',
      process_type VARCHAR(100) DEFAULT '',
      source VARCHAR(120) DEFAULT '',
      manual_lot_id INT DEFAULT NULL,
      reference_step_id VARCHAR(50) DEFAULT '',
      used_in_process_step_id INT DEFAULT NULL,
      used_at DATETIME DEFAULT NULL,
      used_by INT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'IN_STOCK',
      invoice_number VARCHAR(100) DEFAULT '',
      sold_at DATETIME DEFAULT NULL,
      company_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(100) DEFAULT '',
      customer_name VARCHAR(255) DEFAULT '',
      mobile VARCHAR(20) DEFAULT '',
      gst_number VARCHAR(100) DEFAULT '',
      invoice_date VARCHAR(50) DEFAULT '',
      payment_mode VARCHAR(50) DEFAULT '',
      payment_status VARCHAR(50) DEFAULT '',
      paid_amount DECIMAL(12,2) DEFAULT 0.00,
      due_amount DECIMAL(12,2) DEFAULT 0.00,
      total_items INT DEFAULT 0,
      total_weight DECIMAL(12,3) DEFAULT 0.000,
      rate_per_gram DECIMAL(12,2) DEFAULT 0.00,
      mc_rate DECIMAL(12,2) DEFAULT 0.00,
      round_off DECIMAL(12,2) DEFAULT 0.00,
      subtotal DECIMAL(12,2) DEFAULT 0.00,
      total_amount DECIMAL(12,2) DEFAULT 0.00,
      employee_name VARCHAR(255) DEFAULT '',
      company_rate_per_gram DECIMAL(12,2) DEFAULT 0.00,
      selling_rate_per_gram DECIMAL(12,2) DEFAULT 0.00,
      margin_per_gram DECIMAL(12,2) DEFAULT 0.00,
      customer_subtotal DECIMAL(12,2) DEFAULT 0.00,
      customer_total_amount DECIMAL(12,2) DEFAULT 0.00,
      company_subtotal DECIMAL(12,2) DEFAULT 0.00,
      company_total_amount DECIMAL(12,2) DEFAULT 0.00,
      employee_margin_amount DECIMAL(12,2) DEFAULT 0.00,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      is_deleted TINYINT(1) DEFAULT 0,
      deleted_at DATETIME DEFAULT NULL,
      deleted_by INT DEFAULT NULL,
      delete_reason VARCHAR(255) DEFAULT '',
      company_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      prefix VARCHAR(20) NOT NULL DEFAULT 'BILL',
      sequence_year INT NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_invoice_sequence_company_year_prefix (company_id, sequence_year, prefix)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT DEFAULT NULL,
      invoice_number VARCHAR(100) DEFAULT '',
      barcode VARCHAR(255) DEFAULT '',
      product_name VARCHAR(255) DEFAULT '',
      sku VARCHAR(100) DEFAULT '',
      purity VARCHAR(50) DEFAULT '',
      size VARCHAR(100) DEFAULT '',
      weight DECIMAL(10,3) DEFAULT 0.000,
      lot_number VARCHAR(100) DEFAULT '',
      customer_name VARCHAR(255) DEFAULT '',
      pure_weight DECIMAL(12,3) DEFAULT 0.000,
      company_rate_per_gram DECIMAL(12,2) DEFAULT 0.00,
      selling_rate_per_gram DECIMAL(12,2) DEFAULT 0.00,
      customer_line_amount DECIMAL(12,2) DEFAULT 0.00,
      company_line_amount DECIMAL(12,2) DEFAULT 0.00,
      employee_margin_amount DECIMAL(12,2) DEFAULT 0.00,
      employee_name VARCHAR(255) DEFAULT '',
      is_deleted TINYINT(1) DEFAULT 0,
      deleted_at DATETIME DEFAULT NULL,
      deleted_by INT DEFAULT NULL,
      delete_reason VARCHAR(255) DEFAULT '',
      company_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS return_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      barcode VARCHAR(255) DEFAULT '',
      invoice_number VARCHAR(100) DEFAULT '',
      customer_name VARCHAR(255) DEFAULT '',
      product_name VARCHAR(255) DEFAULT '',
      sku VARCHAR(100) DEFAULT '',
      size VARCHAR(100) DEFAULT '',
      weight DECIMAL(10,3) DEFAULT 0.000,
      lot_number VARCHAR(100) DEFAULT '',
      return_type VARCHAR(50) DEFAULT '',
      return_reason VARCHAR(255) DEFAULT '',
      return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      company_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_code VARCHAR(50) NOT NULL,
      branch_name VARCHAR(150) NOT NULL,
      branch_type VARCHAR(30) DEFAULT 'MAIN',
      address TEXT NULL,
      contact_name VARCHAR(150) NULL,
      contact_phone VARCHAR(50) NULL,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      transfer_no VARCHAR(80) NOT NULL,
      from_branch_id INT NOT NULL,
      to_branch_id INT NOT NULL,
      status VARCHAR(40) DEFAULT 'CREATED',
      challan_no VARCHAR(80) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      dispatched_by INT NULL,
      received_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      dispatched_at DATETIME NULL,
      received_at DATETIME NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_transfer_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      transfer_id INT NOT NULL,
      stock_id INT NULL,
      barcode VARCHAR(120) NOT NULL,
      from_branch_id INT NOT NULL,
      to_branch_id INT NOT NULL,
      item_status VARCHAR(40) DEFAULT 'PENDING_DISPATCH',
      received_at DATETIME NULL,
      received_by INT NULL,
      mismatch_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_receive_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      transfer_id INT NULL,
      barcode VARCHAR(120) NULL,
      stock_id INT NULL,
      branch_id INT NULL,
      scan_status VARCHAR(40) NOT NULL,
      reason TEXT NULL,
      scanned_by INT NULL,
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      device_info TEXT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_transfer_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      transfer_id INT NULL,
      action_type VARCHAR(80) NOT NULL,
      actor_user_id INT NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_stock_snapshots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT NOT NULL,
      snapshot_date DATE NOT NULL,
      total_items INT DEFAULT 0,
      total_weight DECIMAL(14,3) DEFAULT 0.000,
      in_stock_items INT DEFAULT 0,
      in_stock_weight DECIMAL(14,3) DEFAULT 0.000,
      in_transit_items INT DEFAULT 0,
      in_transit_weight DECIMAL(14,3) DEFAULT 0.000,
      shortage_items INT DEFAULT 0,
      shortage_weight DECIMAL(14,3) DEFAULT 0.000,
      sold_items INT DEFAULT 0,
      damaged_items INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_branch_stock_snapshot_day (company_id, branch_id, snapshot_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_stock_snapshot_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      snapshot_id INT NOT NULL,
      branch_id INT NOT NULL,
      stock_id INT DEFAULT NULL,
      barcode VARCHAR(255) DEFAULT '',
      product_name VARCHAR(255) DEFAULT '',
      lot_number VARCHAR(120) DEFAULT '',
      weight DECIMAL(14,3) DEFAULT 0.000,
      status VARCHAR(50) DEFAULT '',
      stock_state VARCHAR(50) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_branch_snapshot_items_barcode (company_id, branch_id, barcode),
      INDEX idx_branch_snapshot_items_snapshot (snapshot_id),
      INDEX idx_branch_snapshot_items_stock (company_id, stock_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_reconciliation_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      run_no VARCHAR(80) NOT NULL,
      run_type VARCHAR(30) DEFAULT 'MANUAL',
      from_date DATE DEFAULT NULL,
      to_date DATE DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'COMPLETED',
      total_checked INT DEFAULT 0,
      exception_count INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      INDEX idx_branch_reconciliation_runs_scope (company_id, branch_id, created_at),
      UNIQUE KEY uq_branch_reconciliation_run_no (company_id, run_no)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_reconciliation_exceptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      run_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      stock_id INT DEFAULT NULL,
      barcode VARCHAR(255) DEFAULT '',
      exception_type VARCHAR(60) NOT NULL,
      severity VARCHAR(20) DEFAULT 'MEDIUM',
      expected_branch_id INT DEFAULT NULL,
      actual_branch_id INT DEFAULT NULL,
      expected_state VARCHAR(50) DEFAULT '',
      actual_state VARCHAR(50) DEFAULT '',
      description TEXT DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'OPEN',
      approved_by INT DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      resolution_note TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_branch_exceptions_scope_status (company_id, branch_id, status, severity),
      INDEX idx_branch_exceptions_run (run_id),
      INDEX idx_branch_exceptions_barcode (company_id, barcode),
      INDEX idx_branch_exceptions_type (company_id, exception_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branch_audit_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      alert_type VARCHAR(60) NOT NULL,
      title VARCHAR(255) DEFAULT '',
      message TEXT DEFAULT NULL,
      severity VARCHAR(20) DEFAULT 'MEDIUM',
      status VARCHAR(30) DEFAULT 'OPEN',
      reference_type VARCHAR(60) DEFAULT '',
      reference_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_by INT DEFAULT NULL,
      resolved_at DATETIME DEFAULT NULL,
      resolution_note TEXT DEFAULT NULL,
      INDEX idx_branch_audit_alerts_scope_status (company_id, branch_id, status, severity),
      INDEX idx_branch_audit_alerts_reference (company_id, reference_type, reference_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_stock_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      category VARCHAR(120) DEFAULT '',
      material_name VARCHAR(255) DEFAULT '',
      variant VARCHAR(255) DEFAULT '',
      size VARCHAR(120) DEFAULT '',
      unit VARCHAR(50) DEFAULT '',
      opening_stock DECIMAL(12,3) DEFAULT 0.000,
      current_stock DECIMAL(12,3) DEFAULT 0.000,
      low_stock_level DECIMAL(12,3) DEFAULT 0.000,
      supplier_name VARCHAR(255) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'IN_STOCK',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      material_id INT NOT NULL,
      movement_type VARCHAR(50) DEFAULT '',
      qty DECIMAL(12,3) DEFAULT 0.000,
      unit VARCHAR(50) DEFAULT '',
      movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      supplier_name VARCHAR(255) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      reference_no VARCHAR(120) DEFAULT '',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS party_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      party_code VARCHAR(80) DEFAULT '',
      party_name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) DEFAULT '',
      party_type VARCHAR(50) DEFAULT '',
      status VARCHAR(50) DEFAULT 'ACTIVE',
      mobile VARCHAR(20) DEFAULT '',
      alternate_mobile VARCHAR(20) DEFAULT '',
      gst_no VARCHAR(100) DEFAULT '',
      pan_no VARCHAR(50) DEFAULT '',
      address_line1 VARCHAR(255) DEFAULT '',
      address_line2 VARCHAR(255) DEFAULT '',
      city VARCHAR(120) DEFAULT '',
      state VARCHAR(120) DEFAULT '',
      pin_code VARCHAR(20) DEFAULT '',
      contact_person VARCHAR(255) DEFAULT '',
      default_metal_type VARCHAR(20) DEFAULT '',
      default_purity DECIMAL(8,3) DEFAULT 0.000,
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS party_opening_balance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      party_id INT NOT NULL,
      opening_date DATE DEFAULT NULL,
      cash_receivable DECIMAL(14,2) DEFAULT 0.00,
      cash_payable DECIMAL(14,2) DEFAULT 0.00,
      gold_gross_receivable DECIMAL(14,3) DEFAULT 0.000,
      gold_gross_payable DECIMAL(14,3) DEFAULT 0.000,
      gold_fine_receivable DECIMAL(14,3) DEFAULT 0.000,
      gold_fine_payable DECIMAL(14,3) DEFAULT 0.000,
      silver_gross_receivable DECIMAL(14,3) DEFAULT 0.000,
      silver_gross_payable DECIMAL(14,3) DEFAULT 0.000,
      silver_fine_receivable DECIMAL(14,3) DEFAULT 0.000,
      silver_fine_payable DECIMAL(14,3) DEFAULT 0.000,
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metal_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      metal_code VARCHAR(20) NOT NULL,
      metal_name VARCHAR(100) DEFAULT '',
      default_unit VARCHAR(20) DEFAULT 'GRAM',
      status VARCHAR(50) DEFAULT 'ACTIVE',
      remarks TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      voucher_no VARCHAR(100) NOT NULL,
      voucher_date DATE DEFAULT NULL,
      voucher_time TIME DEFAULT NULL,
      transaction_type VARCHAR(60) DEFAULT '',
      party_id INT NOT NULL,
      party_type VARCHAR(50) DEFAULT '',
      status VARCHAR(50) DEFAULT 'POSTED',
      reference_no VARCHAR(120) DEFAULT '',
      invoice_no VARCHAR(120) DEFAULT '',
      purchase_no VARCHAR(120) DEFAULT '',
      lot_no VARCHAR(120) DEFAULT '',
      process_lot_no VARCHAR(120) DEFAULT '',
      karigar_id INT DEFAULT NULL,
      source_module VARCHAR(80) DEFAULT '',
      payment_mode VARCHAR(50) DEFAULT '',
      payment_status VARCHAR(50) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      note TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      approved_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_lines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL,
      line_no INT DEFAULT 1,
      item_name VARCHAR(255) DEFAULT '',
      item_id INT DEFAULT NULL,
      barcode VARCHAR(255) DEFAULT '',
      lot_no VARCHAR(120) DEFAULT '',
      metal_type VARCHAR(20) DEFAULT '',
      purity DECIMAL(8,3) DEFAULT 0.000,
      gross_weight DECIMAL(14,3) DEFAULT 0.000,
      net_weight DECIMAL(14,3) DEFAULT 0.000,
      fine_weight DECIMAL(14,3) DEFAULT 0.000,
      qty DECIMAL(14,3) DEFAULT 0.000,
      rate_per_gram DECIMAL(14,2) DEFAULT 0.00,
      metal_value DECIMAL(14,2) DEFAULT 0.00,
      making_charge DECIMAL(14,2) DEFAULT 0.00,
      hallmark_charge DECIMAL(14,2) DEFAULT 0.00,
      labour_charge DECIMAL(14,2) DEFAULT 0.00,
      other_charge DECIMAL(14,2) DEFAULT 0.00,
      discount_amount DECIMAL(14,2) DEFAULT 0.00,
      gst_amount DECIMAL(14,2) DEFAULT 0.00,
      line_amount DECIMAL(14,2) DEFAULT 0.00,
      remarks TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_settlements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      transaction_id INT NOT NULL,
      settlement_type VARCHAR(30) DEFAULT '',
      against_transaction_id INT DEFAULT NULL,
      against_invoice_no VARCHAR(120) DEFAULT '',
      against_voucher_no VARCHAR(120) DEFAULT '',
      cash_amount DECIMAL(14,2) DEFAULT 0.00,
      metal_type VARCHAR(20) DEFAULT '',
      gross_weight DECIMAL(14,3) DEFAULT 0.000,
      fine_weight DECIMAL(14,3) DEFAULT 0.000,
      purity DECIMAL(8,3) DEFAULT 0.000,
      rate_basis DECIMAL(14,2) DEFAULT 0.00,
      settlement_date DATE DEFAULT NULL,
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cash_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      party_id INT NOT NULL,
      transaction_id INT NOT NULL,
      entry_date DATE DEFAULT NULL,
      entry_type VARCHAR(20) DEFAULT '',
      debit_amount DECIMAL(14,2) DEFAULT 0.00,
      credit_amount DECIMAL(14,2) DEFAULT 0.00,
      running_balance DECIMAL(14,2) DEFAULT 0.00,
      reference_type VARCHAR(60) DEFAULT '',
      reference_no VARCHAR(120) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metal_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      party_id INT NOT NULL,
      transaction_id INT NOT NULL,
      entry_date DATE DEFAULT NULL,
      metal_type VARCHAR(20) DEFAULT '',
      entry_type VARCHAR(20) DEFAULT '',
      purity DECIMAL(8,3) DEFAULT 0.000,
      gross_in DECIMAL(14,3) DEFAULT 0.000,
      gross_out DECIMAL(14,3) DEFAULT 0.000,
      fine_in DECIMAL(14,3) DEFAULT 0.000,
      fine_out DECIMAL(14,3) DEFAULT 0.000,
      running_gross_balance DECIMAL(14,3) DEFAULT 0.000,
      running_fine_balance DECIMAL(14,3) DEFAULT 0.000,
      reference_type VARCHAR(60) DEFAULT '',
      reference_no VARCHAR(120) DEFAULT '',
      lot_no VARCHAR(120) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS party_balance_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      party_id INT NOT NULL,
      cash_balance DECIMAL(14,2) DEFAULT 0.00,
      gold_gross_balance DECIMAL(14,3) DEFAULT 0.000,
      gold_fine_balance DECIMAL(14,3) DEFAULT 0.000,
      silver_gross_balance DECIMAL(14,3) DEFAULT 0.000,
      silver_fine_balance DECIMAL(14,3) DEFAULT 0.000,
      last_transaction_id INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_transaction_link (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      invoice_no VARCHAR(120) DEFAULT '',
      transaction_id INT NOT NULL,
      link_type VARCHAR(60) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_transaction_link (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      purchase_no VARCHAR(120) DEFAULT '',
      transaction_id INT NOT NULL,
      link_type VARCHAR(60) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lot_transaction_link (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      lot_no VARCHAR(120) DEFAULT '',
      process_lot_no VARCHAR(120) DEFAULT '',
      transaction_id INT NOT NULL,
      link_type VARCHAR(60) DEFAULT '',
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS karigar_transaction_link (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      karigar_id INT NOT NULL,
      transaction_id INT NOT NULL,
      lot_no VARCHAR(120) DEFAULT '',
      process_lot_no VARCHAR(120) DEFAULT '',
      issue_weight DECIMAL(14,3) DEFAULT 0.000,
      receive_weight DECIMAL(14,3) DEFAULT 0.000,
      loss_weight DECIMAL(14,3) DEFAULT 0.000,
      labour_amount DECIMAL(14,2) DEFAULT 0.00,
      remarks TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      work_category VARCHAR(40) DEFAULT 'REGULAR_SANKHA',
      is_default TINYINT(1) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_template_steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      template_id INT NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(255) NOT NULL,
      is_required TINYINT(1) DEFAULT 1,
      allow_repeat TINYINT(1) DEFAULT 0,
      uses_additive_material TINYINT(1) DEFAULT 0,
      additive_material_label VARCHAR(120) DEFAULT '',
      additive_affects_output_weight TINYINT(1) DEFAULT 1,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_process_template_steps_order (company_id, template_id, step_order)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_lots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      lot_no VARCHAR(120) NOT NULL,
      raw_weight DECIMAL(14,3) DEFAULT 0.000,
      loss_weight DECIMAL(14,3) DEFAULT 0.000,
      final_weight DECIMAL(14,3) DEFAULT 0.000,
      total_khadi_count INT DEFAULT 1,
      expected_total_qty DECIMAL(14,3) DEFAULT 0.000,
      work_category VARCHAR(40) DEFAULT 'REGULAR_SANKHA',
      status ENUM('OPEN', 'COMPLETED') DEFAULT 'OPEN',
      template_id INT DEFAULT NULL,
      template_snapshot_json JSON DEFAULT NULL,
      template_version_label VARCHAR(120) DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      completed_by INT DEFAULT NULL,
      is_manual_lot TINYINT(1) DEFAULT 0,
      manual_reason VARCHAR(255) DEFAULT '',
      manual_created_by INT DEFAULT NULL,
      manual_created_at DATETIME DEFAULT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_process_lots_company_category_lot (company_id, work_category, lot_no)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      process_lot_id INT DEFAULT NULL,
      lot_no VARCHAR(120) NOT NULL,
      step_no INT NOT NULL,
      process_name VARCHAR(255) NOT NULL,
      karigar_id INT DEFAULT NULL,
      karigar_name VARCHAR(255) DEFAULT '',
      input_weight DECIMAL(14,3) DEFAULT 0.000,
      output_weight DECIMAL(14,3) DEFAULT 0.000,
      recovery_weight DECIMAL(14,3) DEFAULT 0.000,
      loss_weight DECIMAL(14,3) DEFAULT 0.000,
      additive_given_weight DECIMAL(14,3) DEFAULT 0.000,
      additive_returned_weight DECIMAL(14,3) DEFAULT 0.000,
      additive_used_weight DECIMAL(14,3) DEFAULT 0.000,
      additive_material_label VARCHAR(120) DEFAULT '',
      input_qty DECIMAL(14,3) DEFAULT 0.000,
      output_qty DECIMAL(14,3) DEFAULT 0.000,
      loss_qty DECIMAL(14,3) DEFAULT 0.000,
      loss_reason VARCHAR(255) DEFAULT '',
      status VARCHAR(30) DEFAULT 'COMPLETED',
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_process_steps_company_process_lot_step (company_id, process_lot_id, step_no)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_step_additive_issues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      process_step_id INT NOT NULL,
      lot_no VARCHAR(120) DEFAULT '',
      karigar_id INT DEFAULT NULL,
      karigar_name VARCHAR(255) DEFAULT '',
      material_label VARCHAR(120) DEFAULT '',
      given_weight DECIMAL(14,3) DEFAULT 0.000,
      returned_weight DECIMAL(14,3) DEFAULT 0.000,
      used_weight DECIMAL(14,3) DEFAULT 0.000,
      stock_item_id INT DEFAULT NULL,
      issue_stock_movement_id INT DEFAULT NULL,
      return_stock_movement_id INT DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'ISSUED',
      issued_by INT DEFAULT NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      returned_by INT DEFAULT NULL,
      returned_at DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_additive_stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      stock_item_id INT DEFAULT NULL,
      process_step_id INT DEFAULT NULL,
      additive_issue_id INT DEFAULT NULL,
      movement_type VARCHAR(30) DEFAULT '',
      weight DECIMAL(14,3) DEFAULT 0.000,
      before_weight DECIMAL(14,3) DEFAULT 0.000,
      after_weight DECIMAL(14,3) DEFAULT 0.000,
      notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_material_issues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      lot_no VARCHAR(120) DEFAULT '',
      work_category VARCHAR(40) DEFAULT 'REGULAR_SANKHA',
      process_step_id INT DEFAULT NULL,
      material_type VARCHAR(60) DEFAULT 'KDM',
      given_weight DECIMAL(14,3) DEFAULT 0.000,
      returned_weight DECIMAL(14,3) DEFAULT 0.000,
      used_weight DECIMAL(14,3) DEFAULT 0.000,
      karigar_id INT DEFAULT NULL,
      karigar_name VARCHAR(255) DEFAULT '',
      status VARCHAR(30) DEFAULT 'ISSUED',
      issued_by INT DEFAULT NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      returned_by INT DEFAULT NULL,
      returned_at DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_step_recovery_inputs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      process_step_id INT NOT NULL,
      stock_id INT NOT NULL,
      weight DECIMAL(14,3) DEFAULT 0.000,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_process_step_recovery_stock (company_id, stock_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS outside_karigar_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      process_lot_id INT DEFAULT NULL,
      work_category VARCHAR(40) DEFAULT 'REGULAR_SANKHA',
      lot_no VARCHAR(120) DEFAULT '',
      issue_step_id INT DEFAULT NULL,
      receive_step_id INT DEFAULT NULL,
      karigar_name VARCHAR(255) DEFAULT '',
      issue_weight DECIMAL(14,3) DEFAULT 0.000,
      receive_weight DECIMAL(14,3) DEFAULT 0.000,
      pending_weight DECIMAL(14,3) DEFAULT 0.000,
      issue_date DATETIME DEFAULT NULL,
      receive_date DATETIME DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'ISSUED',
      notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS karigar_work (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      karigar_name VARCHAR(255) NOT NULL,
      lot_no VARCHAR(120) DEFAULT '',
      issue_weight DECIMAL(14,3) DEFAULT 0.000,
      receive_weight DECIMAL(14,3) DEFAULT 0.000,
      loss_weight DECIMAL(14,3) DEFAULT 0.000,
      labour_amount DECIMAL(14,2) DEFAULT 0.00,
      work_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      person VARCHAR(255) DEFAULT '',
      expense_date DATE DEFAULT NULL,
      expense_time TIME DEFAULT NULL,
      amount DECIMAL(14,2) DEFAULT 0.00,
      category VARCHAR(120) DEFAULT '',
      reason VARCHAR(255) DEFAULT '',
      note TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_drafts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      customer_name VARCHAR(255) DEFAULT '',
      mobile VARCHAR(30) DEFAULT '',
      invoice_number VARCHAR(120) DEFAULT '',
      invoice_date DATE DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      converted_invoice_no VARCHAR(120) DEFAULT '',
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_draft_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      draft_id INT NOT NULL,
      company_id INT DEFAULT NULL,
      barcode VARCHAR(255) DEFAULT '',
      product_name VARCHAR(255) DEFAULT '',
      sku VARCHAR(120) DEFAULT '',
      purity VARCHAR(120) DEFAULT '',
      size VARCHAR(120) DEFAULT '',
      weight DECIMAL(14,3) DEFAULT 0.000,
      lot_number VARCHAR(120) DEFAULT '',
      item_stage VARCHAR(30) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      owner_email VARCHAR(255) DEFAULT '',
      top_title VARCHAR(255) DEFAULT '',
      company_name VARCHAR(255) DEFAULT '',
      gstin VARCHAR(120) DEFAULT '',
      account_no VARCHAR(120) DEFAULT '',
      ifsc VARCHAR(80) DEFAULT '',
      address TEXT DEFAULT NULL,
      declaration TEXT DEFAULT NULL,
      upi_id VARCHAR(255) DEFAULT '',
      upi_name VARCHAR(255) DEFAULT '',
      business_state VARCHAR(120) DEFAULT 'Odisha',
      default_bill_type VARCHAR(50) DEFAULT 'GST',
      default_tax_type VARCHAR(50) DEFAULT 'CGST_SGST',
      default_rate_per_gram DECIMAL(14,2) DEFAULT 0.00,
      default_mc_rate DECIMAL(14,2) DEFAULT 0.00,
      subscription_plan VARCHAR(80) DEFAULT 'basic',
      subscription_status VARCHAR(80) DEFAULT 'active',
      subscription_start_date DATE DEFAULT NULL,
      subscription_end_date DATE DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      actor_role VARCHAR(80) DEFAULT '',
      action_type VARCHAR(80) DEFAULT '',
      entity_type VARCHAR(80) DEFAULT '',
      entity_id VARCHAR(255) DEFAULT '',
      module_name VARCHAR(80) DEFAULT '',
      route VARCHAR(255) DEFAULT '',
      method VARCHAR(16) DEFAULT '',
      status VARCHAR(30) DEFAULT '',
      message VARCHAR(500) DEFAULT '',
      before_data JSON DEFAULT NULL,
      after_data JSON DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      request_id VARCHAR(80) DEFAULT '',
      ip_address VARCHAR(120) DEFAULT '',
      user_agent TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_company_created (company_id, created_at),
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_action (action_type)
    )
  `);

  await addColumnIfMissing("audit_log", "actor_role", "VARCHAR(80) DEFAULT ''");
  await addColumnIfMissing("audit_log", "module_name", "VARCHAR(80) DEFAULT ''");
  await addColumnIfMissing("audit_log", "route", "VARCHAR(255) DEFAULT ''");
  await addColumnIfMissing("audit_log", "method", "VARCHAR(16) DEFAULT ''");
  await addColumnIfMissing("audit_log", "status", "VARCHAR(30) DEFAULT ''");
  await addColumnIfMissing("audit_log", "message", "VARCHAR(500) DEFAULT ''");
  await addColumnIfMissing("audit_log", "metadata", "JSON DEFAULT NULL");
  await addColumnIfMissing("audit_log", "request_id", "VARCHAR(80) DEFAULT ''");
  await addIndexIfMissing("audit_log", "idx_audit_company_created", "(company_id, created_at)");
  await addIndexIfMissing("audit_log", "idx_audit_company_entity", "(company_id, entity_type, entity_id)");
  await addIndexIfMissing("audit_log", "idx_audit_user_created", "(user_id, created_at)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS erp_modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_key VARCHAR(80) NOT NULL,
      module_name VARCHAR(150) NOT NULL,
      category VARCHAR(80) DEFAULT '',
      description TEXT DEFAULT NULL,
      is_system TINYINT(1) DEFAULT 0,
      default_enabled TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_erp_modules_key (module_key),
      INDEX idx_erp_modules_key (module_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS erp_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plan_key VARCHAR(80) NOT NULL,
      plan_name VARCHAR(150) NOT NULL,
      description TEXT DEFAULT NULL,
      is_custom TINYINT(1) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_erp_plans_key (plan_key),
      INDEX idx_erp_plans_key (plan_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS erp_plan_modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plan_id INT NOT NULL,
      module_key VARCHAR(80) NOT NULL,
      enabled TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_erp_plan_modules_plan_module (plan_id, module_key),
      INDEX idx_erp_plan_modules_plan_module (plan_id, module_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_plan_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      plan_id INT NOT NULL,
      plan_key_snapshot VARCHAR(80) NOT NULL,
      effective_from DATE NOT NULL,
      effective_until DATE DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      assigned_by INT DEFAULT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_company_plan_assignments_company (company_id),
      INDEX idx_company_plan_assignments_company (company_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_module_access (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      module_key VARCHAR(80) NOT NULL,
      enabled TINYINT(1) DEFAULT 1,
      source VARCHAR(30) DEFAULT 'PLAN',
      reason TEXT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_company_module_access_company_module (company_id, module_key),
      INDEX idx_company_module_access_company_module (company_id, module_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_module_access_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      module_key VARCHAR(80) NOT NULL,
      old_enabled TINYINT(1) DEFAULT NULL,
      new_enabled TINYINT(1) DEFAULT NULL,
      old_plan_key VARCHAR(80) DEFAULT NULL,
      new_plan_key VARCHAR(80) DEFAULT NULL,
      changed_by INT DEFAULT NULL,
      change_reason TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_company_module_access_audit_company_module (company_id, module_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS module_access_violation_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      role VARCHAR(80) DEFAULT '',
      module_key VARCHAR(80) NOT NULL,
      request_method VARCHAR(16) DEFAULT '',
      request_path VARCHAR(255) DEFAULT '',
      page_key VARCHAR(120) DEFAULT NULL,
      would_block TINYINT(1) DEFAULT 1,
      request_ip VARCHAR(120) DEFAULT '',
      user_agent TEXT DEFAULT NULL,
      query_json JSON DEFAULT NULL,
      body_json JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_module_access_violation_company_module (company_id, module_key),
      INDEX idx_module_access_violation_created (created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS module_enforcement_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scope_type VARCHAR(30) NOT NULL,
      company_id INT DEFAULT NULL,
      enforcement_mode VARCHAR(40) NOT NULL DEFAULT 'REPORT_ONLY',
      reason TEXT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_module_enforcement_scope_company (scope_type, company_id),
      INDEX idx_module_enforcement_company (company_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS module_access_enforcement_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      role VARCHAR(80) DEFAULT '',
      module_key VARCHAR(80) NOT NULL,
      request_method VARCHAR(16) DEFAULT '',
      request_path VARCHAR(255) DEFAULT '',
      enforcement_mode VARCHAR(40) DEFAULT 'REPORT_ONLY',
      event_type VARCHAR(30) NOT NULL,
      request_ip VARCHAR(120) DEFAULT '',
      user_agent TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_module_enforcement_events_company_module (company_id, module_key),
      INDEX idx_module_enforcement_events_type_created (event_type, created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      user_id INT DEFAULT NULL,
      company_id INT DEFAULT NULL,
      purpose VARCHAR(50) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME DEFAULT NULL,
      attempt_count INT DEFAULT 0,
      resend_count INT DEFAULT 0,
      last_sent_at DATETIME DEFAULT NULL,
      blocked_until DATETIME DEFAULT NULL,
      session_token_hash VARCHAR(255) DEFAULT NULL,
      session_expires_at DATETIME DEFAULT NULL,
      consumed_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_otp_email_purpose (email, purpose),
      INDEX idx_otp_expiry (expires_at),
      INDEX idx_otp_session (session_expires_at)
    )
  `);

  await pool.query(
    `
    INSERT INTO metal_master (company_id, metal_code, metal_name, default_unit, status)
    SELECT NULL, 'GOLD', 'Gold', 'GRAM', 'ACTIVE'
    WHERE NOT EXISTS (
      SELECT 1 FROM metal_master WHERE company_id IS NULL AND metal_code = 'GOLD'
    )
    `
  );

  await pool.query(
    `
    INSERT INTO metal_master (company_id, metal_code, metal_name, default_unit, status)
    SELECT NULL, 'SILVER', 'Silver', 'GRAM', 'ACTIVE'
    WHERE NOT EXISTS (
      SELECT 1 FROM metal_master WHERE company_id IS NULL AND metal_code = 'SILVER'
    )
    `
  );

  if (await tableExists("users")) {
    await addColumnIfMissing("users", "mobile", "VARCHAR(20) DEFAULT ''");
    await addColumnIfMissing("users", "role", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("users", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("users", "branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("users", "status", "VARCHAR(50) DEFAULT 'pending'");
    await addColumnIfMissing("users", "login_status", "VARCHAR(30) DEFAULT 'ENABLED'");
    await addColumnIfMissing("users", "blocked_until", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("users", "deleted_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("users", "deactivated_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("users", "force_logout_after", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("users", "access_reason", "VARCHAR(500) DEFAULT ''");
    await addColumnIfMissing("users", "updated_by", "INT DEFAULT NULL");
    await addColumnIfMissing("users", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addColumnIfMissing("users", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addIndexIfMissing("users", "idx_users_company_login_status", "(company_id, login_status)");
    await addIndexIfMissing("users", "idx_users_deleted_at", "(deleted_at)");
    await addIndexIfMissing("users", "idx_users_force_logout_after", "(force_logout_after)");
  }

  if (await tableExists("companies")) {
    await addColumnIfMissing("companies", "owner_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("companies", "owner_email", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("companies", "status", "VARCHAR(50) DEFAULT 'active'");
    await addColumnIfMissing("companies", "access_status", "VARCHAR(30) DEFAULT 'ACTIVE'");
    await addColumnIfMissing("companies", "login_status", "VARCHAR(30) DEFAULT 'ENABLED'");
    await addColumnIfMissing("companies", "suspended_until", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("companies", "deleted_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("companies", "deactivated_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("companies", "access_reason", "VARCHAR(500) DEFAULT ''");
    await addColumnIfMissing("companies", "updated_by", "INT DEFAULT NULL");
    await addColumnIfMissing("companies", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addColumnIfMissing("companies", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addIndexIfMissing("companies", "idx_companies_access_status", "(access_status)");
    await addIndexIfMissing("companies", "idx_companies_login_status", "(login_status)");
    await addIndexIfMissing("companies", "idx_companies_deleted_at", "(deleted_at)");
  }

  if (await tableExists("company_signup_requests")) {
    await addColumnIfMissing("company_signup_requests", "mobile", "VARCHAR(20) DEFAULT ''");
    await addColumnIfMissing("company_signup_requests", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("company_signup_requests", "approved_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("company_signup_requests", "rejected_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("company_signup_requests", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("stock")) {
    await addColumnIfMissing("stock", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "qty", "INT DEFAULT 1");
    await addColumnIfMissing("stock", "category", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("stock", "source", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("stock", "manual_lot_id", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "reference_step_id", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("stock", "used_in_process_step_id", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "used_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("stock", "used_by", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "current_branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "stock_state", "VARCHAR(30) DEFAULT NULL");
    await addColumnIfMissing("stock", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("stock", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("stock", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addColumnIfMissing("stock", "deleted_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("stock", "invoice_number", "VARCHAR(100) DEFAULT ''");
    await addColumnIfMissing("stock", "sold_at", "DATETIME DEFAULT NULL");
  }

  if (await tableExists("sales_history")) {
    await addColumnIfMissing("sales_history", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_history", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("sales_history", "total_items", "INT DEFAULT 0");
    await addColumnIfMissing("sales_history", "total_weight", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("sales_history", "status", "VARCHAR(50) DEFAULT 'ACTIVE'");
    await addColumnIfMissing("sales_history", "employee_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("sales_history", "company_rate_per_gram", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "selling_rate_per_gram", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "margin_per_gram", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "customer_subtotal", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "customer_total_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "company_subtotal", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "company_total_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "employee_margin_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_history", "is_deleted", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("sales_history", "deleted_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("sales_history", "deleted_by", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_history", "delete_reason", "VARCHAR(255) DEFAULT ''");
  }

  if (await tableExists("invoice_sequences")) {
    await addColumnIfMissing("invoice_sequences", "company_id", "INT NOT NULL");
    await addColumnIfMissing("invoice_sequences", "prefix", "VARCHAR(20) NOT NULL DEFAULT 'BILL'");
    await addColumnIfMissing("invoice_sequences", "sequence_year", "INT NOT NULL");
    await addColumnIfMissing("invoice_sequences", "last_number", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("invoice_sequences", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("invoice_sequences", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addUniqueIndexIfMissing(
      "invoice_sequences",
      "uq_invoice_sequence_company_year_prefix",
      "(company_id, sequence_year, prefix)"
    );
  }

  if (await tableExists("sales_items")) {
    await addColumnIfMissing("sales_items", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_items", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("sales_items", "item_status", "VARCHAR(50) DEFAULT 'SOLD'");
    await addColumnIfMissing("sales_items", "return_type", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("sales_items", "returned_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("sales_items", "return_id", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_items", "return_transaction_id", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_items", "pure_weight", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("sales_items", "company_rate_per_gram", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_items", "selling_rate_per_gram", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_items", "customer_line_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_items", "company_line_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_items", "employee_margin_amount", "DECIMAL(12,2) DEFAULT 0.00");
    await addColumnIfMissing("sales_items", "employee_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("sales_items", "is_deleted", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("sales_items", "deleted_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("sales_items", "deleted_by", "INT DEFAULT NULL");
    await addColumnIfMissing("sales_items", "delete_reason", "VARCHAR(255) DEFAULT ''");
  }

  if (await tableExists("return_history")) {
    await addColumnIfMissing("return_history", "barcode", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("return_history", "invoice_number", "VARCHAR(100) DEFAULT ''");
    await addColumnIfMissing("return_history", "customer_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("return_history", "product_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("return_history", "sku", "VARCHAR(100) DEFAULT ''");
    await addColumnIfMissing("return_history", "size", "VARCHAR(100) DEFAULT ''");
    await addColumnIfMissing("return_history", "weight", "DECIMAL(10,3) DEFAULT 0.000");
    await addColumnIfMissing("return_history", "lot_number", "VARCHAR(100) DEFAULT ''");
    await addColumnIfMissing("return_history", "return_type", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("return_history", "return_reason", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("return_history", "return_date", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("return_history", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("return_history", "party_id", "INT DEFAULT NULL");
    await addColumnIfMissing("return_history", "estimated_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("return_history", "transaction_id", "INT DEFAULT NULL");
    await addColumnIfMissing("return_history", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("return_history", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("material_stock_items")) {
    await addColumnIfMissing("material_stock_items", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("material_stock_items", "category", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "material_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "variant", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "size", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "unit", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "opening_stock", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("material_stock_items", "current_stock", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("material_stock_items", "low_stock_level", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("material_stock_items", "supplier_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("material_stock_items", "remarks", "TEXT DEFAULT NULL");
    await addColumnIfMissing("material_stock_items", "status", "VARCHAR(50) DEFAULT 'IN_STOCK'");
    await addColumnIfMissing("material_stock_items", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("material_stock_items", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("material_stock_items", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("material_stock_movements")) {
    await addColumnIfMissing("material_stock_movements", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("material_stock_movements", "material_id", "INT NOT NULL");
    await addColumnIfMissing("material_stock_movements", "movement_type", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("material_stock_movements", "qty", "DECIMAL(12,3) DEFAULT 0.000");
    await addColumnIfMissing("material_stock_movements", "unit", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("material_stock_movements", "movement_date", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("material_stock_movements", "supplier_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("material_stock_movements", "remarks", "TEXT DEFAULT NULL");
    await addColumnIfMissing("material_stock_movements", "reference_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("material_stock_movements", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("material_stock_movements", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_templates")) {
    await addColumnIfMissing("process_templates", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_templates", "name", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("process_templates", "work_category", "VARCHAR(40) DEFAULT 'REGULAR_SANKHA'");
    await addColumnIfMissing("process_templates", "is_default", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("process_templates", "status", "VARCHAR(30) DEFAULT 'ACTIVE'");
    await addColumnIfMissing("process_templates", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_templates", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_templates", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await pool.query(`
      UPDATE process_templates
      SET work_category = 'REGULAR_SANKHA'
      WHERE work_category IS NULL OR TRIM(work_category) = ''
    `);
  }

  if (await tableExists("process_template_steps")) {
    await addColumnIfMissing("process_template_steps", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_template_steps", "template_id", "INT NOT NULL");
    await addColumnIfMissing("process_template_steps", "step_order", "INT NOT NULL");
    await addColumnIfMissing("process_template_steps", "step_name", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("process_template_steps", "is_required", "TINYINT(1) DEFAULT 1");
    await addColumnIfMissing("process_template_steps", "allow_repeat", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("process_template_steps", "uses_additive_material", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("process_template_steps", "additive_material_label", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("process_template_steps", "additive_affects_output_weight", "TINYINT(1) DEFAULT 1");
    await addColumnIfMissing("process_template_steps", "status", "VARCHAR(30) DEFAULT 'ACTIVE'");
    await addColumnIfMissing("process_template_steps", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_lots")) {
    await addColumnIfMissing("process_lots", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_lots", "lot_no", "VARCHAR(120) NOT NULL");
    await addColumnIfMissing("process_lots", "raw_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_lots", "loss_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_lots", "final_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_lots", "total_khadi_count", "INT DEFAULT 1");
    await addColumnIfMissing("process_lots", "expected_total_qty", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_lots", "work_category", "VARCHAR(40) DEFAULT 'REGULAR_SANKHA'");
    await addColumnIfMissing("process_lots", "status", "ENUM('OPEN', 'COMPLETED') DEFAULT 'OPEN'");
    await addColumnIfMissing("process_lots", "template_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_lots", "template_snapshot_json", "JSON DEFAULT NULL");
    await addColumnIfMissing("process_lots", "template_version_label", "VARCHAR(120) DEFAULT NULL");
    await addColumnIfMissing("process_lots", "completed_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_lots", "completed_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_lots", "is_manual_lot", "TINYINT(1) DEFAULT 0");
    await addColumnIfMissing("process_lots", "manual_reason", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("process_lots", "manual_created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_lots", "manual_created_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_lots", "saved_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_lots", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_lots", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_lots", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await pool.query(`
      UPDATE process_lots
      SET work_category = 'REGULAR_SANKHA'
      WHERE work_category IS NULL OR TRIM(work_category) = ''
    `);
  }

  if (await tableExists("process_steps")) {
    await addColumnIfMissing("process_steps", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_steps", "process_lot_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_steps", "lot_no", "VARCHAR(120) NOT NULL");
    await addColumnIfMissing("process_steps", "step_no", "INT NOT NULL");
    await addColumnIfMissing("process_steps", "process_name", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("process_steps", "karigar_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_steps", "karigar_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("process_steps", "input_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "output_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "recovery_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "loss_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "additive_given_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "additive_returned_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "additive_used_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "additive_material_label", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("process_steps", "input_qty", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "output_qty", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "loss_qty", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_steps", "loss_reason", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("process_steps", "status", "VARCHAR(30) DEFAULT 'COMPLETED'");
    await addColumnIfMissing("process_steps", "started_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_steps", "completed_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_steps", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_steps", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_steps", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_step_additive_issues")) {
    await addColumnIfMissing("process_step_additive_issues", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "process_step_id", "INT NOT NULL");
    await addColumnIfMissing("process_step_additive_issues", "lot_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("process_step_additive_issues", "karigar_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "karigar_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("process_step_additive_issues", "material_label", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("process_step_additive_issues", "given_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_step_additive_issues", "returned_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_step_additive_issues", "used_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_step_additive_issues", "stock_item_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "issue_stock_movement_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "return_stock_movement_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "status", "VARCHAR(30) DEFAULT 'ISSUED'");
    await addColumnIfMissing("process_step_additive_issues", "issued_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "issued_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_step_additive_issues", "returned_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "returned_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "notes", "TEXT DEFAULT NULL");
    await addColumnIfMissing("process_step_additive_issues", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_step_additive_issues", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_additive_stock_movements")) {
    await addColumnIfMissing("process_additive_stock_movements", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "stock_item_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "process_step_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "additive_issue_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "movement_type", "VARCHAR(30) DEFAULT ''");
    await addColumnIfMissing("process_additive_stock_movements", "weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_additive_stock_movements", "before_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_additive_stock_movements", "after_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_additive_stock_movements", "notes", "TEXT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_additive_stock_movements", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_material_issues")) {
    await addColumnIfMissing("process_material_issues", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "lot_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("process_material_issues", "work_category", "VARCHAR(40) DEFAULT 'REGULAR_SANKHA'");
    await addColumnIfMissing("process_material_issues", "process_step_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "material_type", "VARCHAR(60) DEFAULT 'KDM'");
    await addColumnIfMissing("process_material_issues", "given_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_material_issues", "returned_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_material_issues", "used_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_material_issues", "karigar_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "karigar_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("process_material_issues", "status", "VARCHAR(30) DEFAULT 'ISSUED'");
    await addColumnIfMissing("process_material_issues", "issued_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "issued_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_material_issues", "returned_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "returned_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "notes", "TEXT DEFAULT NULL");
    await addColumnIfMissing("process_material_issues", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("process_material_issues", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("process_step_recovery_inputs")) {
    await addColumnIfMissing("process_step_recovery_inputs", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_recovery_inputs", "process_step_id", "INT NOT NULL");
    await addColumnIfMissing("process_step_recovery_inputs", "stock_id", "INT NOT NULL");
    await addColumnIfMissing("process_step_recovery_inputs", "weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("process_step_recovery_inputs", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("process_step_recovery_inputs", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("outside_karigar_ledger")) {
    await addColumnIfMissing("outside_karigar_ledger", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "process_lot_id", "INT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "work_category", "VARCHAR(40) DEFAULT 'REGULAR_SANKHA'");
    await addColumnIfMissing("outside_karigar_ledger", "lot_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("outside_karigar_ledger", "issue_step_id", "INT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "receive_step_id", "INT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "karigar_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("outside_karigar_ledger", "issue_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("outside_karigar_ledger", "receive_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("outside_karigar_ledger", "pending_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("outside_karigar_ledger", "issue_date", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "receive_date", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "status", "VARCHAR(30) DEFAULT 'ISSUED'");
    await addColumnIfMissing("outside_karigar_ledger", "notes", "TEXT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("outside_karigar_ledger", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("outside_karigar_ledger", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("karigar_work")) {
    await addColumnIfMissing("karigar_work", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("karigar_work", "karigar_name", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("karigar_work", "lot_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("karigar_work", "issue_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("karigar_work", "receive_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("karigar_work", "loss_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("karigar_work", "labour_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("karigar_work", "work_time", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("karigar_work", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("karigar_work", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("karigar_work", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("expenses")) {
    await addColumnIfMissing("expenses", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("expenses", "person", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("expenses", "expense_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("expenses", "expense_time", "TIME DEFAULT NULL");
    await addColumnIfMissing("expenses", "amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("expenses", "category", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("expenses", "reason", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("expenses", "note", "TEXT DEFAULT NULL");
    await addColumnIfMissing("expenses", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("expenses", "updated_by", "INT DEFAULT NULL");
    await addColumnIfMissing("expenses", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("expenses", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("invoice_drafts")) {
    await addColumnIfMissing("invoice_drafts", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("invoice_drafts", "customer_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("invoice_drafts", "mobile", "VARCHAR(30) DEFAULT ''");
    await addColumnIfMissing("invoice_drafts", "invoice_number", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_drafts", "invoice_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("invoice_drafts", "status", "VARCHAR(50) DEFAULT 'DRAFT'");
    await addColumnIfMissing("invoice_drafts", "converted_invoice_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_drafts", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("invoice_drafts", "updated_by", "INT DEFAULT NULL");
    await addColumnIfMissing("invoice_drafts", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("invoice_drafts", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("invoice_draft_items")) {
    await addColumnIfMissing("invoice_draft_items", "draft_id", "INT NOT NULL");
    await addColumnIfMissing("invoice_draft_items", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("invoice_draft_items", "barcode", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "product_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "sku", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "purity", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "size", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("invoice_draft_items", "lot_number", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("invoice_draft_items", "item_stage", "VARCHAR(30) DEFAULT 'PENDING'");
    await addColumnIfMissing("invoice_draft_items", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("invoice_draft_items", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("company_settings")) {
    await addColumnIfMissing("company_settings", "company_id", "INT NOT NULL");
    await addColumnIfMissing("company_settings", "owner_email", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("company_settings", "top_title", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("company_settings", "company_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("company_settings", "gstin", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("company_settings", "account_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("company_settings", "ifsc", "VARCHAR(80) DEFAULT ''");
    await addColumnIfMissing("company_settings", "address", "TEXT DEFAULT NULL");
    await addColumnIfMissing("company_settings", "declaration", "TEXT DEFAULT NULL");
    await addColumnIfMissing("company_settings", "upi_id", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("company_settings", "upi_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("company_settings", "business_state", "VARCHAR(120) DEFAULT 'Odisha'");
    await addColumnIfMissing("company_settings", "default_bill_type", "VARCHAR(50) DEFAULT 'GST'");
    await addColumnIfMissing("company_settings", "default_tax_type", "VARCHAR(50) DEFAULT 'CGST_SGST'");
    await addColumnIfMissing("company_settings", "default_rate_per_gram", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("company_settings", "default_mc_rate", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("company_settings", "subscription_plan", "VARCHAR(80) DEFAULT 'basic'");
    await addColumnIfMissing("company_settings", "subscription_status", "VARCHAR(80) DEFAULT 'active'");
    await addColumnIfMissing("company_settings", "subscription_start_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("company_settings", "subscription_end_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("company_settings", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("company_settings", "updated_by", "INT DEFAULT NULL");
    await addColumnIfMissing("company_settings", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("company_settings", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("audit_log")) {
    await addColumnIfMissing("audit_log", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("audit_log", "user_id", "INT DEFAULT NULL");
    await addColumnIfMissing("audit_log", "action_type", "VARCHAR(80) DEFAULT ''");
    await addColumnIfMissing("audit_log", "entity_type", "VARCHAR(80) DEFAULT ''");
    await addColumnIfMissing("audit_log", "entity_id", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("audit_log", "before_data", "JSON DEFAULT NULL");
    await addColumnIfMissing("audit_log", "after_data", "JSON DEFAULT NULL");
    await addColumnIfMissing("audit_log", "ip_address", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("audit_log", "user_agent", "TEXT DEFAULT NULL");
    await addColumnIfMissing("audit_log", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("otp_verifications")) {
    await addColumnIfMissing("otp_verifications", "email", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("otp_verifications", "user_id", "INT DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "purpose", "VARCHAR(50) NOT NULL");
    await addColumnIfMissing("otp_verifications", "otp_hash", "VARCHAR(255) NOT NULL");
    await addColumnIfMissing("otp_verifications", "expires_at", "DATETIME NOT NULL");
    await addColumnIfMissing("otp_verifications", "verified_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "attempt_count", "INT DEFAULT 0");
    await addColumnIfMissing("otp_verifications", "resend_count", "INT DEFAULT 0");
    await addColumnIfMissing("otp_verifications", "last_sent_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "blocked_until", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "session_token_hash", "VARCHAR(255) DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "session_expires_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "consumed_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("otp_verifications", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("otp_verifications", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("branches")) {
    await addColumnIfMissing("branches", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branches", "branch_code", "VARCHAR(50) NOT NULL");
    await addColumnIfMissing("branches", "branch_name", "VARCHAR(150) NOT NULL");
    await addColumnIfMissing("branches", "branch_type", "VARCHAR(30) DEFAULT 'MAIN'");
    await addColumnIfMissing("branches", "address", "TEXT NULL");
    await addColumnIfMissing("branches", "contact_name", "VARCHAR(150) NULL");
    await addColumnIfMissing("branches", "contact_phone", "VARCHAR(50) NULL");
    await addColumnIfMissing("branches", "status", "VARCHAR(30) DEFAULT 'ACTIVE'");
    await addColumnIfMissing("branches", "created_by", "INT NULL");
    await addColumnIfMissing("branches", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branches", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_transfers")) {
    await addColumnIfMissing("branch_transfers", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfers", "transfer_no", "VARCHAR(80) NOT NULL");
    await addColumnIfMissing("branch_transfers", "from_branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfers", "to_branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfers", "status", "VARCHAR(40) DEFAULT 'CREATED'");
    await addColumnIfMissing("branch_transfers", "challan_no", "VARCHAR(80) NULL");
    await addColumnIfMissing("branch_transfers", "notes", "TEXT NULL");
    await addColumnIfMissing("branch_transfers", "created_by", "INT NULL");
    await addColumnIfMissing("branch_transfers", "dispatched_by", "INT NULL");
    await addColumnIfMissing("branch_transfers", "received_by", "INT NULL");
    await addColumnIfMissing("branch_transfers", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_transfers", "dispatched_at", "DATETIME NULL");
    await addColumnIfMissing("branch_transfers", "received_at", "DATETIME NULL");
    await addColumnIfMissing("branch_transfers", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_transfer_items")) {
    await addColumnIfMissing("branch_transfer_items", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfer_items", "transfer_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfer_items", "stock_id", "INT NULL");
    await addColumnIfMissing("branch_transfer_items", "barcode", "VARCHAR(120) NOT NULL");
    await addColumnIfMissing("branch_transfer_items", "from_branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfer_items", "to_branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfer_items", "item_status", "VARCHAR(40) DEFAULT 'PENDING_DISPATCH'");
    await addColumnIfMissing("branch_transfer_items", "received_at", "DATETIME NULL");
    await addColumnIfMissing("branch_transfer_items", "received_by", "INT NULL");
    await addColumnIfMissing("branch_transfer_items", "mismatch_reason", "TEXT NULL");
    await addColumnIfMissing("branch_transfer_items", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_transfer_items", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_receive_logs")) {
    await addColumnIfMissing("branch_receive_logs", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_receive_logs", "transfer_id", "INT NULL");
    await addColumnIfMissing("branch_receive_logs", "barcode", "VARCHAR(120) NULL");
    await addColumnIfMissing("branch_receive_logs", "stock_id", "INT NULL");
    await addColumnIfMissing("branch_receive_logs", "branch_id", "INT NULL");
    await addColumnIfMissing("branch_receive_logs", "scan_status", "VARCHAR(40) NOT NULL");
    await addColumnIfMissing("branch_receive_logs", "reason", "TEXT NULL");
    await addColumnIfMissing("branch_receive_logs", "scanned_by", "INT NULL");
    await addColumnIfMissing("branch_receive_logs", "scanned_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_receive_logs", "device_info", "TEXT NULL");
  }

  if (await tableExists("branch_transfer_audit_logs")) {
    await addColumnIfMissing("branch_transfer_audit_logs", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "transfer_id", "INT NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "action_type", "VARCHAR(80) NOT NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "actor_user_id", "INT NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "before_data", "JSON NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "after_data", "JSON NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "reason", "TEXT NULL");
    await addColumnIfMissing("branch_transfer_audit_logs", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_stock_snapshots")) {
    await addColumnIfMissing("branch_stock_snapshots", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_stock_snapshots", "branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_stock_snapshots", "snapshot_date", "DATE NOT NULL");
    await addColumnIfMissing("branch_stock_snapshots", "total_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "total_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("branch_stock_snapshots", "in_stock_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "in_stock_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("branch_stock_snapshots", "in_transit_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "in_transit_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("branch_stock_snapshots", "shortage_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "shortage_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("branch_stock_snapshots", "sold_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "damaged_items", "INT DEFAULT 0");
    await addColumnIfMissing("branch_stock_snapshots", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_stock_snapshots", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_stock_snapshots", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await addUniqueIndexIfMissing("branch_stock_snapshots", "uq_branch_stock_snapshot_day", "(company_id, branch_id, snapshot_date)");
  }

  if (await tableExists("branch_stock_snapshot_items")) {
    await addColumnIfMissing("branch_stock_snapshot_items", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_stock_snapshot_items", "snapshot_id", "INT NOT NULL");
    await addColumnIfMissing("branch_stock_snapshot_items", "branch_id", "INT NOT NULL");
    await addColumnIfMissing("branch_stock_snapshot_items", "stock_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_stock_snapshot_items", "barcode", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("branch_stock_snapshot_items", "product_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("branch_stock_snapshot_items", "lot_number", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("branch_stock_snapshot_items", "weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("branch_stock_snapshot_items", "status", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("branch_stock_snapshot_items", "stock_state", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("branch_stock_snapshot_items", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_reconciliation_runs")) {
    await addColumnIfMissing("branch_reconciliation_runs", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "run_no", "VARCHAR(80) NOT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "run_type", "VARCHAR(30) DEFAULT 'MANUAL'");
    await addColumnIfMissing("branch_reconciliation_runs", "from_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "to_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "status", "VARCHAR(30) DEFAULT 'COMPLETED'");
    await addColumnIfMissing("branch_reconciliation_runs", "total_checked", "INT DEFAULT 0");
    await addColumnIfMissing("branch_reconciliation_runs", "exception_count", "INT DEFAULT 0");
    await addColumnIfMissing("branch_reconciliation_runs", "created_by", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_reconciliation_runs", "completed_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_runs", "notes", "TEXT DEFAULT NULL");
    await addUniqueIndexIfMissing("branch_reconciliation_runs", "uq_branch_reconciliation_run_no", "(company_id, run_no)");
  }

  if (await tableExists("branch_reconciliation_exceptions")) {
    await addColumnIfMissing("branch_reconciliation_exceptions", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "run_id", "INT NOT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "stock_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "barcode", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("branch_reconciliation_exceptions", "exception_type", "VARCHAR(60) NOT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "severity", "VARCHAR(20) DEFAULT 'MEDIUM'");
    await addColumnIfMissing("branch_reconciliation_exceptions", "expected_branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "actual_branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "expected_state", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("branch_reconciliation_exceptions", "actual_state", "VARCHAR(50) DEFAULT ''");
    await addColumnIfMissing("branch_reconciliation_exceptions", "description", "TEXT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "status", "VARCHAR(30) DEFAULT 'OPEN'");
    await addColumnIfMissing("branch_reconciliation_exceptions", "approved_by", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "approved_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "resolution_note", "TEXT DEFAULT NULL");
    await addColumnIfMissing("branch_reconciliation_exceptions", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_reconciliation_exceptions", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  }

  if (await tableExists("branch_audit_alerts")) {
    await addColumnIfMissing("branch_audit_alerts", "company_id", "INT NOT NULL");
    await addColumnIfMissing("branch_audit_alerts", "branch_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_audit_alerts", "alert_type", "VARCHAR(60) NOT NULL");
    await addColumnIfMissing("branch_audit_alerts", "title", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("branch_audit_alerts", "message", "TEXT DEFAULT NULL");
    await addColumnIfMissing("branch_audit_alerts", "severity", "VARCHAR(20) DEFAULT 'MEDIUM'");
    await addColumnIfMissing("branch_audit_alerts", "status", "VARCHAR(30) DEFAULT 'OPEN'");
    await addColumnIfMissing("branch_audit_alerts", "reference_type", "VARCHAR(60) DEFAULT ''");
    await addColumnIfMissing("branch_audit_alerts", "reference_id", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_audit_alerts", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing("branch_audit_alerts", "resolved_by", "INT DEFAULT NULL");
    await addColumnIfMissing("branch_audit_alerts", "resolved_at", "DATETIME DEFAULT NULL");
    await addColumnIfMissing("branch_audit_alerts", "resolution_note", "TEXT DEFAULT NULL");
  }

  await backfillBranchFoundation();

  if (await tableExists("stock")) {
    await addIndexIfMissing("stock", "idx_stock_company_status", "(company_id, status)");
    await addIndexIfMissing("stock", "idx_stock_company_invoice", "(company_id, invoice_number)");
    await addIndexIfMissing("stock", "idx_stock_company_created", "(company_id, created_at)");
    await addIndexIfMissing("stock", "idx_stock_recovery_step", "(company_id, reference_step_id)");
    await addIndexIfMissing("stock", "idx_stock_recovery_unused", "(company_id, category, source, status)");
    await addIndexIfMissing("stock", "idx_stock_company_branch_status", "(company_id, current_branch_id, status)");
    await addIndexIfMissing("stock", "idx_stock_company_stock_state", "(company_id, stock_state)");
    await addIndexIfMissing("stock", "idx_stock_company_barcode", "(company_id, barcode)");
  }

  if (await tableExists("users")) {
    await addIndexIfMissing("users", "idx_users_company_branch", "(company_id, branch_id)");
  }

  if (await tableExists("branches")) {
    await addIndexIfMissing("branches", "idx_branches_company_code", "(company_id, branch_code)");
    await addIndexIfMissing("branches", "idx_branches_company_status", "(company_id, status)");
  }

  if (await tableExists("branch_transfers")) {
    await addIndexIfMissing("branch_transfers", "idx_branch_transfers_scope_status", "(company_id, from_branch_id, to_branch_id, status)");
    await addIndexIfMissing("branch_transfers", "idx_branch_transfers_transfer_no", "(company_id, transfer_no)");
  }

  if (await tableExists("branch_transfer_items")) {
    await addIndexIfMissing("branch_transfer_items", "idx_branch_transfer_items_transfer_barcode", "(company_id, transfer_id, barcode)");
    await addIndexIfMissing("branch_transfer_items", "idx_branch_transfer_items_barcode_status", "(company_id, barcode, item_status)");
  }

  if (await tableExists("branch_receive_logs")) {
    await addIndexIfMissing("branch_receive_logs", "idx_branch_receive_logs_transfer_barcode", "(company_id, transfer_id, barcode)");
  }

  if (await tableExists("branch_transfer_audit_logs")) {
    await addIndexIfMissing("branch_transfer_audit_logs", "idx_branch_transfer_audit_scope_action", "(company_id, transfer_id, action_type)");
  }

  if (await tableExists("branch_stock_snapshot_items")) {
    await addIndexIfMissing("branch_stock_snapshot_items", "idx_branch_snapshot_items_barcode", "(company_id, branch_id, barcode)");
    await addIndexIfMissing("branch_stock_snapshot_items", "idx_branch_snapshot_items_snapshot", "(snapshot_id)");
    await addIndexIfMissing("branch_stock_snapshot_items", "idx_branch_snapshot_items_stock", "(company_id, stock_id)");
  }

  if (await tableExists("branch_reconciliation_runs")) {
    await addIndexIfMissing("branch_reconciliation_runs", "idx_branch_reconciliation_runs_scope", "(company_id, branch_id, created_at)");
  }

  if (await tableExists("branch_reconciliation_exceptions")) {
    await addIndexIfMissing("branch_reconciliation_exceptions", "idx_branch_exceptions_scope_status", "(company_id, branch_id, status, severity)");
    await addIndexIfMissing("branch_reconciliation_exceptions", "idx_branch_exceptions_run", "(run_id)");
    await addIndexIfMissing("branch_reconciliation_exceptions", "idx_branch_exceptions_barcode", "(company_id, barcode)");
    await addIndexIfMissing("branch_reconciliation_exceptions", "idx_branch_exceptions_type", "(company_id, exception_type)");
  }

  if (await tableExists("branch_audit_alerts")) {
    await addIndexIfMissing("branch_audit_alerts", "idx_branch_audit_alerts_scope_status", "(company_id, branch_id, status, severity)");
    await addIndexIfMissing("branch_audit_alerts", "idx_branch_audit_alerts_reference", "(company_id, reference_type, reference_id)");
  }

  if (await tableExists("process_step_recovery_inputs")) {
    await addIndexIfMissing("process_step_recovery_inputs", "idx_recovery_inputs_step", "(company_id, process_step_id)");
    await addUniqueIndexIfMissing("process_step_recovery_inputs", "uq_process_step_recovery_stock", "(company_id, stock_id)");
  }

  if (await tableExists("sales_history")) {
    await addIndexIfMissing("sales_history", "idx_sales_company_invoice", "(company_id, invoice_number)");
    await addIndexIfMissing("sales_history", "idx_sales_company_status", "(company_id, status)");
    await addIndexIfMissing("sales_history", "idx_sales_company_created", "(company_id, created_at)");
    await addIndexIfMissing("sales_history", "idx_sales_company_deleted", "(company_id, is_deleted, id)");
  }

  if (await tableExists("sales_items")) {
    await addIndexIfMissing("sales_items", "idx_sales_items_sale", "(sale_id)");
    await addIndexIfMissing("sales_items", "idx_sales_items_company_invoice", "(company_id, invoice_number)");
  }

  if (await tableExists("return_history")) {
    await addIndexIfMissing("return_history", "idx_returns_company_created", "(company_id, created_at)");
    await addIndexIfMissing("return_history", "idx_returns_company_date", "(company_id, return_date)");
    await addIndexIfMissing("return_history", "idx_returns_company_invoice", "(company_id, invoice_number)");
  }

  if (await tableExists("process_lots")) {
    await addIndexIfMissing("process_lots", "idx_process_lots_category_lot", "(company_id, work_category, lot_no)");
    await addUniqueIndexIfMissing("process_lots", "uq_process_lots_company_category_lot", "(company_id, work_category, lot_no)");
  }

  if (await tableExists("process_steps")) {
    await pool.query(`
      UPDATE process_steps ps
      JOIN process_lots pl
        ON pl.company_id = ps.company_id
       AND pl.lot_no = ps.lot_no
       AND pl.work_category = 'REGULAR_SANKHA'
      SET ps.process_lot_id = pl.id
      WHERE ps.process_lot_id IS NULL
         OR ps.process_lot_id = 0
    `);
    await dropIndexIfExists("process_steps", "uq_process_steps_company_lot_step");
    await addIndexIfMissing("process_steps", "idx_process_steps_lot_step", "(company_id, lot_no, step_no)");
    await addIndexIfMissing("process_steps", "idx_process_steps_lot_status", "(company_id, lot_no, status)");
    await addIndexIfMissing("process_steps", "idx_process_steps_karigar", "(company_id, karigar_id)");
    await addIndexIfMissing("process_steps", "idx_process_steps_process_lot", "(process_lot_id)");
    await addIndexIfMissing("process_steps", "idx_process_steps_completed", "(company_id, completed_at)");
    await addUniqueIndexIfMissing("process_steps", "uq_process_steps_company_process_lot_step", "(company_id, process_lot_id, step_no)");
  }

  if (await tableExists("process_step_additive_issues")) {
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_step", "(company_id, process_step_id)");
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_lot", "(company_id, lot_no, status)");
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_karigar", "(company_id, karigar_id)");
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_stock_item", "(company_id, stock_item_id)");
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_issue_movement", "(issue_stock_movement_id)");
    await addIndexIfMissing("process_step_additive_issues", "idx_additive_issues_return_movement", "(return_stock_movement_id)");
  }

  if (await tableExists("process_additive_stock_movements")) {
    await addIndexIfMissing("process_additive_stock_movements", "idx_additive_stock_movements_stock", "(company_id, stock_item_id)");
    await addIndexIfMissing("process_additive_stock_movements", "idx_additive_stock_movements_step", "(company_id, process_step_id)");
    await addIndexIfMissing("process_additive_stock_movements", "idx_additive_stock_movements_issue", "(additive_issue_id)");
  }

  if (await tableExists("process_material_issues")) {
    await addIndexIfMissing("process_material_issues", "idx_material_issues_category_lot", "(company_id, work_category, lot_no)");
    await addIndexIfMissing("process_material_issues", "idx_material_issues_type_status", "(company_id, material_type, status)");
    await addIndexIfMissing("process_material_issues", "idx_material_issues_lot_type", "(company_id, lot_no, material_type)");
  }

  if (await tableExists("outside_karigar_ledger")) {
    await addIndexIfMissing("outside_karigar_ledger", "idx_outside_karigar_category_lot", "(company_id, work_category, lot_no)");
    await addIndexIfMissing("outside_karigar_ledger", "idx_outside_karigar_status", "(company_id, status)");
    await addIndexIfMissing("outside_karigar_ledger", "idx_outside_karigar_name", "(company_id, karigar_name)");
    await addIndexIfMissing("outside_karigar_ledger", "idx_outside_karigar_issue_step", "(issue_step_id)");
    await addIndexIfMissing("outside_karigar_ledger", "idx_outside_karigar_receive_step", "(receive_step_id)");
  }

  if (await tableExists("process_templates")) {
    await addIndexIfMissing("process_templates", "idx_process_templates_company_default", "(company_id, is_default, status)");
    await addIndexIfMissing("process_templates", "idx_process_templates_category_default", "(company_id, work_category, is_default, status)");
  }

  if (await tableExists("process_template_steps")) {
    await addIndexIfMissing("process_template_steps", "idx_process_template_steps_template", "(company_id, template_id)");
    await addUniqueIndexIfMissing("process_template_steps", "uq_process_template_steps_order", "(company_id, template_id, step_order)");
  }

  if (await tableExists("transaction_master")) {
    await addIndexIfMissing("transaction_master", "idx_txn_company_id", "(company_id, id)");
    await addIndexIfMissing("transaction_master", "idx_txn_company_party", "(company_id, party_id)");
    await addIndexIfMissing("transaction_master", "idx_txn_company_status", "(company_id, status)");
    await addIndexIfMissing("transaction_master", "idx_txn_company_invoice", "(company_id, invoice_no)");
    await addIndexIfMissing("transaction_master", "idx_txn_company_date", "(company_id, voucher_date)");
    await addIndexIfMissing("transaction_master", "idx_txn_created", "(created_at)");
  }

  if (await tableExists("transaction_lines")) {
    await addColumnIfMissing("transaction_lines", "line_no", "INT DEFAULT 1");
    await addColumnIfMissing("transaction_lines", "item_name", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("transaction_lines", "item_id", "INT DEFAULT NULL");
    await addColumnIfMissing("transaction_lines", "barcode", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("transaction_lines", "lot_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("transaction_lines", "metal_type", "VARCHAR(20) DEFAULT ''");
    await addColumnIfMissing("transaction_lines", "purity", "DECIMAL(8,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_lines", "gross_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_lines", "net_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_lines", "fine_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_lines", "qty", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_lines", "rate_per_gram", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "metal_value", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "making_charge", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "hallmark_charge", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "labour_charge", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "other_charge", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "discount_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "gst_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "line_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_lines", "remarks", "TEXT DEFAULT NULL");
    await addIndexIfMissing("transaction_lines", "idx_txn_lines_transaction", "(transaction_id)");
  }

  if (await tableExists("transaction_settlements")) {
    await addColumnIfMissing("transaction_settlements", "company_id", "INT DEFAULT NULL");
    await addColumnIfMissing("transaction_settlements", "settlement_type", "VARCHAR(40) DEFAULT 'CASH'");
    await addColumnIfMissing("transaction_settlements", "against_transaction_id", "INT DEFAULT NULL");
    await addColumnIfMissing("transaction_settlements", "against_invoice_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("transaction_settlements", "against_voucher_no", "VARCHAR(120) DEFAULT ''");
    await addColumnIfMissing("transaction_settlements", "cash_amount", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_settlements", "metal_type", "VARCHAR(20) DEFAULT ''");
    await addColumnIfMissing("transaction_settlements", "gross_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_settlements", "fine_weight", "DECIMAL(14,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_settlements", "purity", "DECIMAL(8,3) DEFAULT 0.000");
    await addColumnIfMissing("transaction_settlements", "rate_basis", "DECIMAL(14,2) DEFAULT 0.00");
    await addColumnIfMissing("transaction_settlements", "settlement_date", "DATE DEFAULT NULL");
    await addColumnIfMissing("transaction_settlements", "remarks", "TEXT DEFAULT NULL");
    await addColumnIfMissing("transaction_settlements", "created_by", "INT DEFAULT NULL");
  }

  if (await tableExists("cash_ledger")) {
    await addIndexIfMissing("cash_ledger", "idx_cash_company_party", "(company_id, party_id)");
    await addIndexIfMissing("cash_ledger", "idx_cash_transaction", "(transaction_id)");
    await addIndexIfMissing("cash_ledger", "idx_cash_company_date", "(company_id, entry_date)");
  }

  if (await tableExists("metal_ledger")) {
    await addIndexIfMissing("metal_ledger", "idx_metal_company_party", "(company_id, party_id)");
    await addIndexIfMissing("metal_ledger", "idx_metal_transaction", "(transaction_id)");
    await addIndexIfMissing("metal_ledger", "idx_metal_company_date", "(company_id, entry_date)");
    await addIndexIfMissing("metal_ledger", "idx_metal_company_type", "(company_id, metal_type)");
  }

  await seedDefaultProcessTemplatesForCompanies();
  await backfillSolderingAdditiveTemplateMetadata();
  await seedInvoiceSequencesFromSalesHistory();
  await ensureSaasModuleAccessFoundation();
  await warnForRecentSchemaSafety();

  console.log("Schema ensured ✅");
}

async function ensurePartyBalanceSummaryRow(connection, companyId, partyId) {
  await connection.query(
    `
    INSERT INTO party_balance_summary
    (
      company_id, party_id, cash_balance,
      gold_gross_balance, gold_fine_balance,
      silver_gross_balance, silver_fine_balance,
      updated_at
    )
    SELECT ?, ?, 0.00, 0.000, 0.000, 0.000, 0.000, NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM party_balance_summary
      WHERE company_id = ? AND party_id = ?
    )
    `,
    [companyId, partyId, companyId, partyId]
  );
}

async function recalcPartyBalanceSummary(connection, companyId, partyId, lastTransactionId = null) {
  const [cashRows] = await connection.query(
    `
    SELECT COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) AS cash_balance
    FROM cash_ledger
    WHERE company_id = ? AND party_id = ?
    `,
    [companyId, partyId]
  );

  const [metalRows] = await connection.query(
    `
    SELECT
      metal_type,
      COALESCE(SUM(gross_in), 0) - COALESCE(SUM(gross_out), 0) AS gross_balance,
      COALESCE(SUM(fine_in), 0) - COALESCE(SUM(fine_out), 0) AS fine_balance
    FROM metal_ledger
    WHERE company_id = ? AND party_id = ?
    GROUP BY metal_type
    `,
    [companyId, partyId]
  );

  let goldGross = 0;
  let goldFine = 0;
  let silverGross = 0;
  let silverFine = 0;

  metalRows.forEach((row) => {
    const metalType = normalizeMetalType(row.metal_type);
    if (metalType === "GOLD") {
      goldGross = toNumber(row.gross_balance);
      goldFine = toNumber(row.fine_balance);
    }
    if (metalType === "SILVER") {
      silverGross = toNumber(row.gross_balance);
      silverFine = toNumber(row.fine_balance);
    }
  });

  await ensurePartyBalanceSummaryRow(connection, companyId, partyId);

  await connection.query(
    `
    UPDATE party_balance_summary
    SET cash_balance = ?,
        gold_gross_balance = ?,
        gold_fine_balance = ?,
        silver_gross_balance = ?,
        silver_fine_balance = ?,
        last_transaction_id = ?,
        updated_at = NOW()
    WHERE company_id = ? AND party_id = ?
    `,
    [
      toNumber(cashRows[0]?.cash_balance),
      goldGross,
      goldFine,
      silverGross,
      silverFine,
      lastTransactionId,
      companyId,
      partyId
    ]
  );
}

async function createCashLedgerEntry(connection, payload) {
  const companyId = Number(payload.companyId);
  const partyId = Number(payload.partyId);
  const transactionId = Number(payload.transactionId);
  const debitAmount = toNumber(payload.debitAmount);
  const creditAmount = toNumber(payload.creditAmount);

  const [balanceRows] = await connection.query(
    `
    SELECT running_balance
    FROM cash_ledger
    WHERE company_id = ? AND party_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, partyId]
  );

  const previousBalance = toNumber(balanceRows[0]?.running_balance);
  const runningBalance = previousBalance + debitAmount - creditAmount;

  await connection.query(
    `
    INSERT INTO cash_ledger
    (
      company_id, party_id, transaction_id, entry_date, entry_type,
      debit_amount, credit_amount, running_balance,
      reference_type, reference_no, remarks, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      partyId,
      transactionId,
      String(payload.entryDate || getTodayDateOnly()).trim(),
      normalizeCashEntryType(payload.entryType),
      debitAmount,
      creditAmount,
      runningBalance,
      String(payload.referenceType || "").trim(),
      String(payload.referenceNo || "").trim(),
      String(payload.remarks || "").trim(),
      payload.createdBy ?? null
    ]
  );
}

async function createMetalLedgerEntry(connection, payload) {
  const companyId = Number(payload.companyId);
  const partyId = Number(payload.partyId);
  const transactionId = Number(payload.transactionId);
  const metalType = normalizeMetalType(payload.metalType);
  const grossIn = toNumber(payload.grossIn);
  const grossOut = toNumber(payload.grossOut);
  const fineIn = toNumber(payload.fineIn);
  const fineOut = toNumber(payload.fineOut);

  const [balanceRows] = await connection.query(
    `
    SELECT running_gross_balance, running_fine_balance
    FROM metal_ledger
    WHERE company_id = ? AND party_id = ? AND metal_type = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [companyId, partyId, metalType]
  );

  const runningGrossBalance = toNumber(balanceRows[0]?.running_gross_balance) + grossIn - grossOut;
  const runningFineBalance = toNumber(balanceRows[0]?.running_fine_balance) + fineIn - fineOut;

  await connection.query(
    `
    INSERT INTO metal_ledger
    (
      company_id, party_id, transaction_id, entry_date, metal_type, entry_type,
      purity, gross_in, gross_out, fine_in, fine_out,
      running_gross_balance, running_fine_balance,
      reference_type, reference_no, lot_no, remarks, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      partyId,
      transactionId,
      String(payload.entryDate || getTodayDateOnly()).trim(),
      metalType,
      normalizeMetalEntryType(payload.entryType),
      toNumber(payload.purity),
      grossIn,
      grossOut,
      fineIn,
      fineOut,
      runningGrossBalance,
      runningFineBalance,
      String(payload.referenceType || "").trim(),
      String(payload.referenceNo || "").trim(),
      String(payload.lotNo || "").trim(),
      String(payload.remarks || "").trim(),
      payload.createdBy ?? null
    ]
  );
}

async function getPartyByIdForCompany(connection, companyId, partyId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM party_master
    WHERE id = ? AND company_id = ?
    LIMIT 1
    `,
    [partyId, companyId]
  );

  return rows.length ? rows[0] : null;
}

async function findOrCreateBillingParty(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const partyName = String(payload.partyName || "").trim();
  const mobile = String(payload.mobile || "").trim();
  const gstNo = String(payload.gstNo || "").trim();

  const [existingRows] = await connection.query(
    `
    SELECT *
    FROM party_master
    WHERE company_id = ?
      AND LOWER(TRIM(party_name)) = LOWER(TRIM(?))
      AND party_type IN ('CUSTOMER', 'CUSTOMER_SUPPLIER')
    ORDER BY CASE WHEN party_type = 'CUSTOMER' THEN 0 ELSE 1 END, id ASC
    LIMIT 1
    `,
    [companyId, partyName]
  );

  if (existingRows.length) {
    const party = existingRows[0];
    if ((!party.mobile && mobile) || (!party.gst_no && gstNo)) {
      await connection.query(
        `
        UPDATE party_master
        SET mobile = CASE WHEN TRIM(COALESCE(mobile, '')) = '' THEN ? ELSE mobile END,
            gst_no = CASE WHEN TRIM(COALESCE(gst_no, '')) = '' THEN ? ELSE gst_no END,
            updated_at = NOW()
        WHERE id = ?
        `,
        [mobile, gstNo, party.id]
      );
    }

    await ensurePartyBalanceSummaryRow(connection, companyId, party.id);
    return { ...party, mobile: party.mobile || mobile, gst_no: party.gst_no || gstNo };
  }

  const [insertResult] = await connection.query(
    `
    INSERT INTO party_master
    (
      company_id, party_code, party_name, display_name, party_type, status,
      mobile, gst_no, remarks, created_by
    )
    VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE', ?, ?, ?, ?)
    `,
    [
      companyId,
      `CUST-${Date.now()}`,
      partyName,
      partyName,
      mobile,
      gstNo,
      "Auto-created from billing save",
      createdBy
    ]
  );

  await ensurePartyBalanceSummaryRow(connection, companyId, insertResult.insertId);

  return {
    id: insertResult.insertId,
    company_id: companyId,
    party_name: partyName,
    display_name: partyName,
    party_type: "CUSTOMER",
    mobile,
    gst_no: gstNo
  };
}

async function findOrCreateKarigarParty(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const partyName = normalizeKarigarName(payload.partyName);

  if (!partyName) {
    throw new Error("Karigar party name missing");
  }

  const [existingRows] = await connection.query(
    `
    SELECT *
    FROM party_master
    WHERE company_id = ?
      AND LOWER(TRIM(party_name)) = LOWER(TRIM(?))
      AND party_type = 'KARIGAR'
    ORDER BY id ASC
    LIMIT 1
    `,
    [companyId, partyName]
  );

  if (existingRows.length) {
    const party = existingRows[0];
    await ensurePartyBalanceSummaryRow(connection, companyId, party.id);
    return party;
  }

  const [insertResult] = await connection.query(
    `
    INSERT INTO party_master
    (
      company_id, party_code, party_name, display_name, party_type, status,
      remarks, created_by
    )
    VALUES (?, ?, ?, ?, 'KARIGAR', 'ACTIVE', ?, ?)
    `,
    [
      companyId,
      `KAR-${Date.now()}`,
      partyName,
      partyName,
      "Auto-created from process karigar work",
      createdBy
    ]
  );

  await ensurePartyBalanceSummaryRow(connection, companyId, insertResult.insertId);

  return {
    id: insertResult.insertId,
    company_id: companyId,
    party_name: partyName,
    display_name: partyName,
    party_type: "KARIGAR",
    default_metal_type: "",
    default_purity: 0
  };
}

function getPurityRatio(value) {
  const purity = toNumber(value);
  if (purity <= 0) return 0;
  if (purity > 100) return purity / 1000;
  if (purity > 1) return purity / 100;
  return purity;
}

function calculateFineWeight(grossWeight, purity) {
  return toNumber(grossWeight) * getPurityRatio(purity);
}

async function getLotMetalContext(connection, payload) {
  const companyId = Number(payload.companyId);
  const lotNo = normalizeProcessLotNo(payload.lotNo);
  const party = payload.party || null;

  const [stockRows] = await connection.query(
    `
    SELECT metal_type, purity
    FROM stock
    WHERE company_id = ?
      AND lot_number = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'
    ORDER BY id ASC
    `,
    [companyId, lotNo]
  );

  for (const row of stockRows) {
    const metalType = normalizeMetalType(row.metal_type);
    if (!metalType) continue;

    return {
      metalType,
      purity: toNumber(row.purity)
    };
  }

  const fallbackMetalType = normalizeMetalType(party?.default_metal_type);
  if (fallbackMetalType) {
    return {
      metalType: fallbackMetalType,
      purity: toNumber(party?.default_purity)
    };
  }

  throw new Error(`Metal context was not found for lot ${lotNo}`);
}

async function createProcessKarigarTransaction(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const partyId = Number(payload.partyId);
  const karigarId = Number(payload.karigarId || payload.partyId);
  const transactionType = normalizeTransactionType(payload.transactionType);
  const voucherDate = String(payload.voucherDate || getTodayDateOnly()).trim() || getTodayDateOnly();
  const voucherNo = String(payload.voucherNo || buildVoucherNo(transactionType)).trim();
  const lotNo = normalizeProcessLotNo(payload.lotNo);
  const processLotNo = normalizeProcessLotNo(payload.processLotNo || lotNo);
  const metalType = normalizeMetalType(payload.metalType);
  const purity = toNumber(payload.purity);
  const grossWeight = toNumber(payload.grossWeight);
  const fineWeight = calculateFineWeight(grossWeight, purity);
  const remarks = String(payload.remarks || "").trim();

  if (!partyId || !transactionType || !metalType || grossWeight <= 0) {
    return null;
  }

  const party = await getPartyByIdForCompany(connection, companyId, partyId);
  if (!party) {
    throw new Error("Karigar party not found");
  }

  const finalPartyType = normalizePartyType(party.party_type) || "KARIGAR";
  const metalEntryType =
    transactionType === "KARIGAR_ISSUE"
      ? "IN"
      : transactionType === "KARIGAR_RECEIVE" || transactionType === "KARIGAR_LOSS_ADJUSTMENT"
        ? "OUT"
        : "";

  if (!metalEntryType) {
    return null;
  }

  const [insertResult] = await connection.query(
    `
    INSERT INTO transaction_master
    (
      company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
      status, lot_no, process_lot_no, karigar_id, source_module,
      remarks, note, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      voucherNo,
      voucherDate,
      transactionType,
      partyId,
      finalPartyType,
      lotNo,
      processLotNo,
      karigarId,
      "process_module",
      remarks,
      "Auto-posted from process karigar work",
      createdBy
    ]
  );

  const transactionId = Number(insertResult.insertId);

  await connection.query(
    `
    INSERT INTO transaction_lines
    (
      transaction_id, line_no, item_name, lot_no, metal_type, purity,
      gross_weight, fine_weight, qty, line_amount, remarks
    )
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [
      transactionId,
      transactionType,
      lotNo,
      metalType,
      purity,
      grossWeight,
      fineWeight,
      grossWeight,
      remarks
    ]
  );

  await createMetalLedgerEntry(connection, {
    companyId,
    partyId,
    transactionId,
    entryDate: voucherDate,
    metalType,
    entryType: metalEntryType,
    purity,
    grossIn: metalEntryType === "IN" ? grossWeight : 0,
    grossOut: metalEntryType === "OUT" ? grossWeight : 0,
    fineIn: metalEntryType === "IN" ? fineWeight : 0,
    fineOut: metalEntryType === "OUT" ? fineWeight : 0,
    referenceType: transactionType,
    referenceNo: voucherNo,
    lotNo,
    remarks,
    createdBy
  });

  await connection.query(
    `
    INSERT INTO lot_transaction_link
    (company_id, lot_no, process_lot_no, transaction_id, link_type, remarks, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [companyId, lotNo, processLotNo, transactionId, transactionType, remarks, createdBy]
  );

  await connection.query(
    `
    INSERT INTO karigar_transaction_link
    (
      company_id, karigar_id, transaction_id, lot_no, process_lot_no,
      issue_weight, receive_weight, loss_weight, labour_amount, remarks, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `,
    [
      companyId,
      karigarId,
      transactionId,
      lotNo,
      processLotNo,
      transactionType === "KARIGAR_ISSUE" ? grossWeight : 0,
      transactionType === "KARIGAR_RECEIVE" ? grossWeight : 0,
      transactionType === "KARIGAR_LOSS_ADJUSTMENT" ? grossWeight : 0,
      remarks,
      createdBy
    ]
  );

  await recalcPartyBalanceSummary(connection, companyId, partyId, transactionId);

  return {
    transactionId,
    voucherNo,
    transactionType,
    grossWeight,
    fineWeight,
    metalType,
    purity
  };
}

async function postKarigarWorkTransactions(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const karigarName = normalizeKarigarName(payload.karigarName);
  const lotNo = normalizeProcessLotNo(payload.lotNo);
  const processLotNo = normalizeProcessLotNo(payload.processLotNo || lotNo);
  const issueWeight = toNumber(payload.issueWeight);
  const receiveWeight = toNumber(payload.receiveWeight);
  const lossWeight = toNumber(payload.lossWeight);
  const workId = Number(payload.workId || 0);

  if (!karigarName || !lotNo) {
    return {
      party: null,
      transactions: []
    };
  }

  const party = await findOrCreateKarigarParty(connection, {
    companyId,
    partyName: karigarName,
    createdBy
  });

  const lotContext = await getLotMetalContext(connection, {
    companyId,
    lotNo,
    party
  });

  const voucherDate = String(payload.voucherDate || getTodayDateOnly()).trim() || getTodayDateOnly();
  const remarksBase = `Auto-posted from karigar work #${workId || "new"} (${karigarName} / Lot ${lotNo})`;
  const transactions = [];

  if (issueWeight > 0) {
    const txn = await createProcessKarigarTransaction(connection, {
      companyId,
      createdBy,
      partyId: party.id,
      karigarId: party.id,
      transactionType: "KARIGAR_ISSUE",
      voucherDate,
      voucherNo: `KISS-${Date.now()}-${workId || 0}`,
      lotNo,
      processLotNo,
      metalType: lotContext.metalType,
      purity: lotContext.purity,
      grossWeight: issueWeight,
      remarks: `${remarksBase} | Issue`
    });
    if (txn) transactions.push(txn);
  }

  if (receiveWeight > 0) {
    const txn = await createProcessKarigarTransaction(connection, {
      companyId,
      createdBy,
      partyId: party.id,
      karigarId: party.id,
      transactionType: "KARIGAR_RECEIVE",
      voucherDate,
      voucherNo: `KREC-${Date.now()}-${workId || 0}`,
      lotNo,
      processLotNo,
      metalType: lotContext.metalType,
      purity: lotContext.purity,
      grossWeight: receiveWeight,
      remarks: `${remarksBase} | Receive`
    });
    if (txn) transactions.push(txn);
  }

  if (lossWeight > 0) {
    const txn = await createProcessKarigarTransaction(connection, {
      companyId,
      createdBy,
      partyId: party.id,
      karigarId: party.id,
      transactionType: "KARIGAR_LOSS_ADJUSTMENT",
      voucherDate,
      voucherNo: `KLOS-${Date.now()}-${workId || 0}`,
      lotNo,
      processLotNo,
      metalType: lotContext.metalType,
      purity: lotContext.purity,
      grossWeight: lossWeight,
      remarks: `${remarksBase} | Loss`
    });
    if (txn) transactions.push(txn);
  }

  return {
    party,
    transactions
  };
}

function getBillingItemMetalType(items) {
  if (!Array.isArray(items)) return "";

  for (const item of items) {
    const metalType = normalizeMetalType(item?.metalType || item?.metal_type);
    if (metalType) return metalType;
  }

  return "";
}

async function findExistingSaleInvoiceTransaction(connection, companyId, invoiceNo) {
  const [rows] = await connection.query(
    `
    SELECT tm.id, tm.voucher_no
    FROM invoice_transaction_link itl
    INNER JOIN transaction_master tm ON tm.id = itl.transaction_id
    WHERE itl.company_id = ?
      AND itl.invoice_no = ?
      AND tm.transaction_type = 'SALE_INVOICE'
    ORDER BY tm.id DESC
    LIMIT 1
    `,
    [companyId, invoiceNo]
  );

  return rows.length ? rows[0] : null;
}

async function postBillingToTransactionFoundation(connection, payload) {
  const companyId = Number(payload.companyId);
  const createdBy = payload.createdBy ?? null;
  const invoiceNumber = String(payload.invoiceNumber || "").trim();
  const customerName = String(payload.customerName || "").trim();
  const mobile = String(payload.mobile || "").trim();
  const gstNo = String(payload.gstNo || "").trim();
  const billDate = String(payload.billDate || getTodayDateOnly()).trim();
  const paymentMode = String(payload.paymentMode || "").trim();
  const paymentStatus = String(payload.paymentStatus || "").trim();
  const paidAmount = toNumber(payload.paidAmount);
  const dueAmount = toNumber(payload.dueAmount);
  const totalAmount = toNumber(payload.totalAmount);
  const totalWeight = toNumber(payload.totalWeight);
  const ratePerGram = toNumber(payload.ratePerGram);
  const mcRate = toNumber(payload.mcRate);
  const roundOff = toNumber(payload.roundOff);
  const subtotal = toNumber(payload.subtotal);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const metalPercent = toNumber(payload.metalPercent);
  const metalPayable = toNumber(payload.metalPayable);
  const metalNote = String(payload.metalNote || "").trim();
  const metalType = normalizeMetalType(payload.metalType || getBillingItemMetalType(items));

  const existingSaleTxn = await findExistingSaleInvoiceTransaction(connection, companyId, invoiceNumber);
  if (existingSaleTxn) {
    throw new Error(`Billing transaction posting already exists for invoice ${invoiceNumber}`);
  }

  const party = await findOrCreateBillingParty(connection, {
    companyId,
    createdBy,
    partyName: customerName,
    mobile,
    gstNo
  });

  const saleVoucherNo = invoiceNumber;
  const [saleTxnInsert] = await connection.query(
    `
    INSERT INTO transaction_master
    (
      company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
      status, reference_no, invoice_no, source_module, payment_mode, payment_status,
      remarks, note, created_by
    )
    VALUES (?, ?, ?, 'SALE_INVOICE', ?, ?, 'POSTED', ?, ?, 'billing', ?, ?, ?, ?, ?)
    `,
    [
      companyId,
      saleVoucherNo,
      billDate || null,
      party.id,
      party.party_type || "CUSTOMER",
      invoiceNumber,
      invoiceNumber,
      paymentMode,
      paymentStatus,
      "Auto-posted from billing",
      `Bill total ${totalAmount.toFixed(2)} | Weight ${totalWeight.toFixed(3)}g`,
      createdBy
    ]
  );

  const saleTransactionId = saleTxnInsert.insertId;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    await connection.query(
      `
      INSERT INTO transaction_lines
      (
        transaction_id, line_no, item_name, barcode, lot_no, metal_type,
        purity, gross_weight, fine_weight, qty, rate_per_gram, metal_value,
        making_charge, hallmark_charge, line_amount, remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        saleTransactionId,
        index + 1,
        String(item.itemName || item.productName || item.product_name || "").trim(),
        String(item.barcode || "").trim(),
        String(item.lot || item.lot_number || "").trim(),
        normalizeMetalType(item.metalType || item.metal_type || metalType),
        toNumber(item.purity),
        toNumber(item.weight),
        toNumber(item.fineWeight ?? item.fine_weight ?? item.weight),
        toNumber(item.qty || 1),
        ratePerGram,
        toNumber(item.metalValue ?? item.metal_value ?? 0),
        mcRate,
        toNumber(item.hallmarkCharge ?? item.hallmark_charge ?? 0),
        toNumber(item.totalPrice ?? item.total_price ?? 0),
        "Billing item line"
      ]
    );
  }

  await connection.query(
    `
    INSERT INTO invoice_transaction_link
    (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
    VALUES (?, ?, ?, 'SALE_INVOICE', ?, ?)
    `,
    [companyId, invoiceNumber, saleTransactionId, "Billing sale posting", createdBy]
  );

  await createCashLedgerEntry(connection, {
    companyId,
    partyId: party.id,
    transactionId: saleTransactionId,
    entryDate: billDate,
    entryType: "DEBIT",
    debitAmount: totalAmount,
    creditAmount: 0,
    referenceType: "SALE_INVOICE",
    referenceNo: saleVoucherNo,
    remarks: "Billing total receivable posted",
    createdBy
  });

  let lastTransactionId = saleTransactionId;

  if (paidAmount > 0) {
    const paymentVoucherNo = `PAY-${invoiceNumber}`;
    const [paymentTxnInsert] = await connection.query(
      `
      INSERT INTO transaction_master
      (
        company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
        status, reference_no, invoice_no, source_module, payment_mode, payment_status,
        remarks, note, created_by
      )
      VALUES (?, ?, ?, 'PAYMENT_RECEIVED', ?, ?, 'POSTED', ?, ?, 'billing', ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        paymentVoucherNo,
        billDate || null,
        party.id,
        party.party_type || "CUSTOMER",
        invoiceNumber,
        invoiceNumber,
        paymentMode,
        paymentStatus || "Paid",
        "Auto-posted payment from billing",
        `Cash/online receipt ${paidAmount.toFixed(2)}`,
        createdBy
      ]
    );

    const paymentTransactionId = paymentTxnInsert.insertId;

    await connection.query(
      `
      INSERT INTO transaction_settlements
      (
        company_id, transaction_id, settlement_type, against_transaction_id,
        against_invoice_no, against_voucher_no, cash_amount, settlement_date,
        remarks, created_by
      )
      VALUES (?, ?, 'CASH', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        paymentTransactionId,
        saleTransactionId,
        invoiceNumber,
        saleVoucherNo,
        paidAmount,
        billDate || null,
        "Billing payment settlement",
        createdBy
      ]
    );

    await connection.query(
      `
      INSERT INTO invoice_transaction_link
      (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
      VALUES (?, ?, ?, 'PAYMENT_RECEIVED', ?, ?)
      `,
      [companyId, invoiceNumber, paymentTransactionId, "Billing payment posting", createdBy]
    );

    await createCashLedgerEntry(connection, {
      companyId,
      partyId: party.id,
      transactionId: paymentTransactionId,
      entryDate: billDate,
      entryType: "CREDIT",
      debitAmount: 0,
      creditAmount: paidAmount,
      referenceType: "PAYMENT_RECEIVED",
      referenceNo: paymentVoucherNo,
      remarks: "Billing payment received posted",
      createdBy
    });

    lastTransactionId = paymentTransactionId;
  }

  const metalSettlementAmount = Math.max(totalAmount - paidAmount - dueAmount, 0);
  const shouldPostMetalSettlement =
    metalPayable > 0 &&
    (paymentMode.toUpperCase() === "METAL" || paymentStatus.toUpperCase() === "METAL SETTLED" || metalSettlementAmount > 0);

  if (shouldPostMetalSettlement) {
    const metalVoucherNo = `MET-${invoiceNumber}`;
    const effectiveRateBasis =
      metalSettlementAmount > 0
        ? metalSettlementAmount / Math.max(metalPayable, 1)
        : ratePerGram;

    const [metalTxnInsert] = await connection.query(
      `
      INSERT INTO transaction_master
      (
        company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
        status, reference_no, invoice_no, source_module, payment_mode, payment_status,
        remarks, note, created_by
      )
      VALUES (?, ?, ?, 'METAL_SETTLEMENT_RECEIVED', ?, ?, 'POSTED', ?, ?, 'billing', 'METAL', ?, ?, ?, ?)
      `,
      [
        companyId,
        metalVoucherNo,
        billDate || null,
        party.id,
        party.party_type || "CUSTOMER",
        invoiceNumber,
        invoiceNumber,
        paymentStatus || "Metal Settled",
        "Auto-posted metal settlement from billing",
        metalNote || `Metal settlement ${metalPayable.toFixed(3)}g`,
        createdBy
      ]
    );

    const metalTransactionId = metalTxnInsert.insertId;

    await connection.query(
      `
      INSERT INTO transaction_settlements
      (
        company_id, transaction_id, settlement_type, against_transaction_id,
        against_invoice_no, against_voucher_no, cash_amount, metal_type,
        gross_weight, fine_weight, purity, rate_basis, settlement_date,
        remarks, created_by
      )
      VALUES (?, ?, 'METAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        metalTransactionId,
        saleTransactionId,
        invoiceNumber,
        saleVoucherNo,
        metalSettlementAmount,
        metalType,
        metalPayable,
        metalPayable,
        metalPercent,
        effectiveRateBasis,
        billDate || null,
        metalNote || "Billing metal settlement",
        createdBy
      ]
    );

    await connection.query(
      `
      INSERT INTO invoice_transaction_link
      (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
      VALUES (?, ?, ?, 'METAL_SETTLEMENT_RECEIVED', ?, ?)
      `,
      [companyId, invoiceNumber, metalTransactionId, "Billing metal settlement posting", createdBy]
    );

    await createMetalLedgerEntry(connection, {
      companyId,
      partyId: party.id,
      transactionId: metalTransactionId,
      entryDate: billDate,
      metalType: metalType || "SILVER",
      entryType: "IN",
      purity: metalPercent,
      grossIn: metalPayable,
      grossOut: 0,
      fineIn: metalPayable,
      fineOut: 0,
      referenceType: "METAL_SETTLEMENT_RECEIVED",
      referenceNo: metalVoucherNo,
      remarks: metalNote || "Billing metal settlement received",
      createdBy
    });

    if (metalSettlementAmount > 0) {
      await createCashLedgerEntry(connection, {
        companyId,
        partyId: party.id,
        transactionId: metalTransactionId,
        entryDate: billDate,
        entryType: "CREDIT",
        debitAmount: 0,
        creditAmount: metalSettlementAmount,
        referenceType: "METAL_SETTLEMENT_RECEIVED",
        referenceNo: metalVoucherNo,
        remarks: "Billing metal settlement adjusted against receivable",
        createdBy
      });
    }

    lastTransactionId = metalTransactionId;
  }

  await recalcPartyBalanceSummary(connection, companyId, party.id, lastTransactionId);

  return {
    partyId: party.id,
    saleTransactionId,
    lastTransactionId
  };
}

async function findUserById(userId) {
  const [rows] = await pool.query(
    `
    SELECT 
      u.*,
      c.company_name,
      c.owner_name AS company_owner_name,
      c.owner_email AS company_owner_email,
      c.status AS company_status,
      c.access_status AS company_access_status,
      c.login_status AS company_login_status,
      c.suspended_until AS company_suspended_until,
      c.deleted_at AS company_deleted_at,
      c.deactivated_at AS company_deactivated_at,
      c.access_reason AS company_access_reason
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows.length ? rows[0] : null;
}

async function verifyPasswordForUser(user, password) {
  const storedPassword = String(user?.password || "");
  const cleanPassword = String(password || "").trim();

  if (!storedPassword || !cleanPassword) {
    return false;
  }

  if (looksLikeBcryptHash(storedPassword)) {
    return bcrypt.compare(cleanPassword, storedPassword);
  }

  if (storedPassword !== cleanPassword) {
    return false;
  }

  const upgradedHash = await hashPassword(cleanPassword);
  await pool.query(
    `
    UPDATE users
    SET password = ?
    WHERE id = ?
    `,
    [upgradedHash, user.id]
  );
  user.password = upgradedHash;

  return true;
}

async function ensureSuperAdminExists() {
  try {
    const superAdminEmail = "grudrapratap0@gmail.com";
    const configuredSuperAdminPassword = String(process.env.SUPERADMIN_PASSWORD || "").trim();
    if (!configuredSuperAdminPassword) {
      throw new Error(
        "SUPERADMIN_PASSWORD is required. Refusing to use any built-in fallback password."
      );
    }

    const superAdminPassword = configuredSuperAdminPassword;
    const superAdminPasswordHash = await hashPassword(superAdminPassword);
    console.log("[STARTUP] SUPERADMIN_PASSWORD detected.");
    console.log("[STARTUP] SuperAdmin syncing.");

    const [rows] = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [superAdminEmail]
    );

    if (rows.length > 0) {
      await pool.query(
        `
        UPDATE users
        SET password = ?, role = 'SuperAdmin', status = 'approved', company_id = NULL
        WHERE LOWER(email) = LOWER(?)
        `,
        [superAdminPasswordHash, superAdminEmail]
      );
      console.log("[STARTUP] SuperAdmin synced.");
      return;
    }

    await pool.query(
      `
      INSERT INTO users
      (name, mobile, email, password, role, status, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "Super Admin",
        "",
        superAdminEmail,
        superAdminPasswordHash,
        "SuperAdmin",
        "approved",
        null
      ]
    );

    console.log("[STARTUP] SuperAdmin synced.");
  } catch (error) {
    console.error("SuperAdmin create error:", error);
  }
}

/* =========================
   BASIC ROUTES
========================= */
app.use("/css", express.static(FRONTEND_CSS_DIR));
app.use("/icons", express.static(FRONTEND_ICONS_DIR));
app.use("/js/backend", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found"
  });
});
app.use("/js", express.static(FRONTEND_JS_DIR));

app.get("/manifest.json", (req, res) => {
  return res.sendFile(FRONTEND_MANIFEST_FILE);
});

app.get("/service-worker.js", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  return res.sendFile(FRONTEND_SERVICE_WORKER_FILE);
});

app.get("/", (req, res) => {
  return res.sendFile(FRONTEND_INDEX_FILE);
});

app.get("/:page", (req, res, next) => {
  const page = String(req.params.page || "").trim();

  if (!page.endsWith(".html")) {
    return next();
  }

  const requestedFile = path.join(FRONTEND_ROOT, page);

  const sendRequestedPage = () =>
    res.sendFile(requestedFile, (error) => {
      if (error) {
        return next();
      }
    });

  if (PROTECTED_PAGES.has(page)) {
    return requireAuthPage(req, res, sendRequestedPage);
  }

  return sendRequestedPage();
});

app.get("/api/test", (req, res) => {
  return res.status(200).send("API TEST OK");
});

app.get("/health", async (req, res) => {
  return res.status(200).json({
    success: true,
    app: "ok",
    status: "live"
  });
});

app.get("/ready", async (req, res) => {
  try {
    await testDbConnection();
    return res.status(200).json({
      success: true,
      app: "ok",
      status: "ready",
      db: startupStatus.db,
      smtp: startupStatus.smtp,
      port: startupStatus.port
    });
  } catch (error) {
    console.error("Readiness check error:", error);
    return res.status(500).json({
      success: false,
      app: "ok",
      status: "not_ready",
      db: "failed",
      smtp: startupStatus.smtp,
      port: startupStatus.port,
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   DASHBOARD
========================= */
app.get("/api/dashboard", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const requestedBranchId = getRequestedBranchScopeValue(req);
    const branchScope = await resolveOperationalBranchScope(pool, access, requestedBranchId);
    if (!branchScope.ok) {
      return res.status(branchScope.status || 403).json({
        success: false,
        message: branchScope.message || "Branch access denied"
      });
    }

    const sellableStockFilter = getSellableFinishedStockWhereSql();
    const stockWhereParts = ["1 = 1"];
    const stockParams = [];
    if (companyId !== null) {
      stockWhereParts.push("company_id = ?");
      stockParams.push(companyId);
    }
    if (branchScope.isBranchFiltered) {
      stockWhereParts.push("current_branch_id = ?");
      stockParams.push(branchScope.branchId);
    }
    const stockWhere = `WHERE ${stockWhereParts.join(" AND ")} ${sellableStockFilter}`;

    const salesWhere = companyId !== null ? "WHERE company_id = ?" : "";
    const salesParams = companyId !== null ? [companyId] : [];

    const [stockSummary] = await pool.query(
      `
      SELECT COUNT(*) AS total_items, COALESCE(SUM(weight), 0) AS total_weight
      FROM stock
      ${stockWhere}
      `,
      stockParams
    );

    const [soldSummary] = await pool.query(
      `
      SELECT COUNT(*) AS sold_items
      FROM stock
      ${stockWhere}
        AND status = 'SOLD'
      `,
      stockParams
    );

    const [inStockSummary] = await pool.query(
      `
      SELECT COUNT(*) AS in_stock_items
      FROM stock
      ${stockWhere}
        AND status = 'IN_STOCK'
      `,
      stockParams
    );

    const [salesSummary] = await pool.query(
      `
      SELECT COUNT(*) AS total_sales, COALESCE(SUM(total_amount), 0) AS total_sales_amount
      FROM sales_history
      ${salesWhere}
      `,
      salesParams
    );

    const [recentInvoices] = await pool.query(
      `
      SELECT invoice_number, customer_name, total_amount, invoice_date, created_at, company_id
      FROM sales_history
      ${salesWhere}
      ORDER BY id DESC
      LIMIT 8
      `,
      salesParams
    );

    const [recentStock] = await pool.query(
      `
      SELECT barcode, product_name, category, source, lot_number, size, weight, status, company_id, created_at
      FROM stock
      ${stockWhere}
      ORDER BY id DESC
      LIMIT 8
      `,
      stockParams
    );

    const branchSummaryParams = [];
    const branchSummaryWhereParts = ["1 = 1"];
    if (companyId !== null) {
      branchSummaryWhereParts.push("s.company_id = ?");
      branchSummaryParams.push(companyId);
    }
    appendBranchScopeFilter(branchSummaryWhereParts, branchSummaryParams, branchScope, { alias: "s" });

    const [branchStockSummary] = await pool.query(
      `
      SELECT
        s.current_branch_id,
        b.branch_code,
        b.branch_name,
        COUNT(*) AS stock_count,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(s.status, 'IN_STOCK')) = 'IN_STOCK'
          AND UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_STOCK'
          THEN s.weight ELSE 0 END), 0) AS stock_weight,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_count,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN s.weight ELSE 0 END), 0) AS in_transit_weight
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      WHERE ${branchSummaryWhereParts.join(" AND ")}
        AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      GROUP BY s.current_branch_id, b.branch_code, b.branch_name
      ORDER BY b.branch_name ASC, s.current_branch_id ASC
      `,
      branchSummaryParams
    );

    const [branchSalesSummary] = await pool.query(
      `
      SELECT
        s.current_branch_id,
        b.branch_code,
        b.branch_name,
        COUNT(DISTINCT si.id) AS sold_items,
        COALESCE(SUM(si.weight), 0) AS sold_weight
      FROM sales_items si
      INNER JOIN stock s
        ON s.company_id = si.company_id
       AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      WHERE ${branchSummaryWhereParts.join(" AND ")}
      GROUP BY s.current_branch_id, b.branch_code, b.branch_name
      ORDER BY b.branch_name ASC, s.current_branch_id ASC
      LIMIT 200
      `,
      branchSummaryParams
    );

    const returnSummary = await getReturnSummaryRows(companyId);

    return res.json({
      success: true,
      totalStock: Number(stockSummary[0]?.total_items || 0),
      totalWeight: Number(stockSummary[0]?.total_weight || 0),
      soldItems: Number(soldSummary[0]?.sold_items || 0),
      availableItems: Number(inStockSummary[0]?.in_stock_items || 0),
      normalReturns: returnSummary.returnToStockCount,
      damagedReturns: returnSummary.damagedReturnCount,
      totalSales: Number(salesSummary[0]?.total_sales || 0),
      totalSalesAmount: Number(salesSummary[0]?.total_sales_amount || 0),
      recentInvoices,
      recentStock,
      recentReturns: returnSummary.recentReturns,
      branchScope: getBranchScopeResponse(branchScope),
      branchStockSummary,
      branchSalesSummary
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ success: false, message: "Dashboard fetch failed" });
  }
});

app.get("/api/smart-dashboard", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const reportDate = normalizeReportDateInput(req.query.date);
    const nextDate = getNextDateString(reportDate);
    const companyFilter = companyId !== null ? "AND company_id = ?" : "";
    const companyParams = companyId !== null ? [companyId] : [];

    const [productionRows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(weight), 0) AS today_production_weight,
        COALESCE(SUM(COALESCE(qty, 1)), 0) AS today_production_qty,
        COUNT(*) AS today_production_count
      FROM stock
      WHERE created_at >= ?
        AND created_at < ?
        ${getSellableFinishedStockWhereSql()}
        ${companyFilter}
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [salesRows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(total_amount), 0) AS today_sales_amount,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(employee_margin_amount, 0) <> 0 THEN employee_margin_amount
            WHEN COALESCE(company_total_amount, 0) <> 0 THEN total_amount - company_total_amount
            ELSE 0
          END
        ), 0) AS today_billing_margin
      FROM sales_history
      WHERE created_at >= ?
        AND created_at < ?
        AND COALESCE(is_deleted, 0) = 0
        ${companyFilter}
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [processLossRows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(loss_weight), 0) AS today_process_loss_weight,
        COALESCE(SUM(loss_qty), 0) AS today_process_loss_qty
      FROM process_steps
      WHERE UPPER(COALESCE(status, '')) = 'COMPLETED'
        AND COALESCE(completed_at, created_at) >= ?
        AND COALESCE(completed_at, created_at) < ?
        ${companyFilter}
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [lotRows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN UPPER(COALESCE(status, 'OPEN')) = 'COMPLETED' THEN 0 ELSE 1 END) AS open_lots,
        SUM(CASE WHEN UPPER(COALESCE(status, '')) = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_lots
      FROM process_lots
      WHERE 1 = 1
        ${companyFilter}
      `,
      companyParams
    );

    const [pendingRows] = await pool.query(
      `
      SELECT COUNT(DISTINCT pending_lots.lot_key) AS pending_process_lots
      FROM (
        SELECT COALESCE(CONCAT('ID:', id), CONCAT('LOT:', work_category, ':', lot_no)) AS lot_key
        FROM process_lots
        WHERE UPPER(COALESCE(status, 'OPEN')) <> 'COMPLETED'
          ${companyFilter}
        UNION
        SELECT COALESCE(CONCAT('ID:', process_lot_id), CONCAT('LOT:', lot_no)) AS lot_key
        FROM process_steps
        WHERE UPPER(COALESCE(status, '')) <> 'COMPLETED'
          ${companyFilter}
      ) pending_lots
      `,
      [...companyParams, ...companyParams]
    );

    const [karigarRows] = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(karigar_name, ''), 'Unassigned') AS karigar_name,
        COUNT(*) AS step_count,
        COALESCE(SUM(input_weight), 0) AS total_input_weight,
        COALESCE(SUM(output_weight), 0) AS total_output_weight,
        COALESCE(SUM(loss_weight), 0) AS total_loss_weight,
        CASE
          WHEN COALESCE(SUM(input_weight), 0) > 0
          THEN (COALESCE(SUM(loss_weight), 0) / COALESCE(SUM(input_weight), 0)) * 100
          ELSE 0
        END AS loss_percent
      FROM process_steps
      WHERE UPPER(COALESCE(status, '')) = 'COMPLETED'
        AND COALESCE(completed_at, created_at) >= ?
        AND COALESCE(completed_at, created_at) < ?
        ${companyFilter}
      GROUP BY COALESCE(NULLIF(karigar_name, ''), 'Unassigned')
      HAVING COALESCE(SUM(input_weight), 0) > 0
      ORDER BY loss_percent ASC, total_input_weight DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [highLossRows] = await pool.query(
      `
      SELECT
        id,
        lot_no,
        process_name,
        COALESCE(NULLIF(karigar_name, ''), 'Unassigned') AS karigar_name,
        input_weight,
        output_weight,
        loss_weight,
        input_qty,
        output_qty,
        loss_qty,
        CASE
          WHEN COALESCE(input_weight, 0) > 0
          THEN (COALESCE(loss_weight, 0) / COALESCE(input_weight, 0)) * 100
          ELSE 0
        END AS loss_percent,
        COALESCE(completed_at, created_at) AS completed_at
      FROM process_steps
      WHERE UPPER(COALESCE(status, '')) = 'COMPLETED'
        AND COALESCE(input_weight, 0) > 0
        AND (COALESCE(loss_weight, 0) / COALESCE(input_weight, 0)) * 100 > 5
        AND COALESCE(completed_at, created_at) >= ?
        AND COALESCE(completed_at, created_at) < ?
        ${companyFilter}
      ORDER BY loss_percent DESC, COALESCE(completed_at, created_at) DESC
      LIMIT 20
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [recoveryRows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(weight), 0) AS total_recovery_weight
      FROM stock
      WHERE UPPER(COALESCE(category, '')) = 'RECOVERY'
        AND UPPER(COALESCE(source, '')) = 'PROCESS_RECOVERY'
        AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
        ${companyFilter}
      `,
      companyParams
    );

    const [pendingKdmRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS pending_kdm_issue_count,
        COALESCE(SUM(pending_weight), 0) AS pending_kdm_weight,
        COUNT(DISTINCT lot_no) AS pending_kdm_blocked_lots
      FROM (
        SELECT
          lot_no,
          GREATEST(COALESCE(given_weight, 0) - COALESCE(returned_weight, 0), 0) AS pending_weight
        FROM process_step_additive_issues
        WHERE 1 = 1
          ${companyFilter}
      ) pending_kdm
      WHERE pending_weight > 0
      `,
      companyParams
    );

    const [billingSummaryRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(paid_amount), 0) AS total_paid,
        COALESCE(SUM(due_amount), 0) AS total_due,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(employee_margin_amount, 0) <> 0 THEN employee_margin_amount
            WHEN COALESCE(company_total_amount, 0) <> 0 THEN total_amount - company_total_amount
            ELSE 0
          END
        ), 0) AS total_margin
      FROM sales_history
      WHERE created_at >= ?
        AND created_at < ?
        AND COALESCE(is_deleted, 0) = 0
        ${companyFilter}
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const bestKarigarRow = karigarRows[0] || null;
    const worstKarigarRow = karigarRows.length ? karigarRows[karigarRows.length - 1] : null;
    const formatKarigar = (row) => row
      ? {
          name: String(row.karigar_name || "Unassigned"),
          stepCount: Number(row.step_count || 0),
          totalInputWeight: Number(row.total_input_weight || 0),
          totalOutputWeight: Number(row.total_output_weight || 0),
          totalLossWeight: Number(row.total_loss_weight || 0),
          lossPercent: Number(row.loss_percent || 0)
        }
      : null;
    const topLossKarigars = [...karigarRows]
      .sort((a, b) => Number(b.total_loss_weight || 0) - Number(a.total_loss_weight || 0))
      .slice(0, 5);

    return res.json({
      success: true,
      date: reportDate,
      companyId,
      todayProductionWeight: Number(productionRows[0]?.today_production_weight || 0),
      todayProductionQty: Number(
        productionRows[0]?.today_production_qty || productionRows[0]?.today_production_count || 0
      ),
      todaySalesAmount: Number(salesRows[0]?.today_sales_amount || 0),
      todayBillingMargin: Number(salesRows[0]?.today_billing_margin || 0),
      todayProcessLossWeight: Number(processLossRows[0]?.today_process_loss_weight || 0),
      todayProcessLossQty: Number(processLossRows[0]?.today_process_loss_qty || 0),
      openLots: Number(lotRows[0]?.open_lots || 0),
      completedLots: Number(lotRows[0]?.completed_lots || 0),
      pendingProcessLots: Number(pendingRows[0]?.pending_process_lots || 0),
      totalRecoveryWeight: Number(recoveryRows[0]?.total_recovery_weight || 0),
      pendingKdmWeight: Number(pendingKdmRows[0]?.pending_kdm_weight || 0),
      pendingKdmIssueCount: Number(pendingKdmRows[0]?.pending_kdm_issue_count || 0),
      readyForStickerLots: Number(lotRows[0]?.completed_lots || 0),
      lotStatusCounts: {
        open: Number(lotRows[0]?.open_lots || 0),
        completed: Number(lotRows[0]?.completed_lots || 0),
        pendingKdmBlocked: Number(pendingKdmRows[0]?.pending_kdm_blocked_lots || 0)
      },
      billingSummary: {
        invoiceCount: Number(billingSummaryRows[0]?.invoice_count || 0),
        totalSales: Number(billingSummaryRows[0]?.total_sales || 0),
        totalPaid: Number(billingSummaryRows[0]?.total_paid || 0),
        totalDue: Number(billingSummaryRows[0]?.total_due || 0),
        totalMargin: Number(billingSummaryRows[0]?.total_margin || 0)
      },
      karigarLossSummary: topLossKarigars.map((row) => ({
        name: String(row.karigar_name || "Unassigned"),
        steps: Number(row.step_count || 0),
        lossWeight: Number(row.total_loss_weight || 0),
        lossPercent: Number(row.loss_percent || 0)
      })),
      bestKarigar: formatKarigar(bestKarigarRow),
      worstKarigar: formatKarigar(worstKarigarRow),
      highLossAlerts: highLossRows.map((row) => ({
        id: row.id,
        lotNo: row.lot_no || "",
        processName: row.process_name || "",
        karigarName: row.karigar_name || "Unassigned",
        inputWeight: Number(row.input_weight || 0),
        outputWeight: Number(row.output_weight || 0),
        lossWeight: Number(row.loss_weight || 0),
        inputQty: Number(row.input_qty || 0),
        outputQty: Number(row.output_qty || 0),
        lossQty: Number(row.loss_qty || 0),
        lossPercent: Number(row.loss_percent || 0),
        completedAt: row.completed_at || null
      }))
    });
  } catch (error) {
    console.error("Smart dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Smart dashboard fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   COMPANY SETTINGS
========================= */
app.get("/settings/company", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.companyScope === null) {
      return res.json({
        success: true,
        settings: normalizeCompanySettingsRow(null)
      });
    }

    const row = await getCompanySettingsForCompany(pool, access.companyScope);

    return res.json({
      success: true,
      settings: normalizeCompanySettingsRow(row)
    });
  } catch (error) {
    console.error("Company settings fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Company settings fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/otp/request", async (req, res) => {
  let connection;
  let auditEmail = "";
  let auditPurpose = "";
  let access = null;
  let transactionStarted = false;

  try {
    const email = normalizeEmail(req.body.email);
    const purpose = normalizeOtpPurpose(req.body.purpose);
    auditEmail = email;
    auditPurpose = purpose || String(req.body.purpose || "").trim();

    if (!email) {
      await logOtpActivitySafe(pool, req, null, "OTP_REQUEST", "failed", "OTP request validation failed", {
        email,
        purpose: auditPurpose,
        reason: "EMAIL_REQUIRED"
      });
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!purpose) {
      await logOtpActivitySafe(pool, req, null, "OTP_REQUEST", "failed", "OTP request validation failed", {
        email,
        purpose: auditPurpose,
        reason: "PURPOSE_REQUIRED"
      });
      return res.status(400).json({
        success: false,
        message: "OTP purpose is required"
      });
    }

    assertSmtpAvailableForOtp();

    connection = await pool.getConnection();
    await cleanupOtpVerifications(connection);

    let targetUser = null;
    let targetCompanyId = null;
    let actingUserId = null;

    if (purpose === OTP_PURPOSES.SETTINGS_UNLOCK) {
      access = await resolveAccessContext(req, {
        requireActingUser: true,
        requireCompanyScope: false,
        allowSuperAdminAll: true
      });

      if (!access.ok) {
        await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "denied", "OTP request access denied", {
          email,
          purpose,
          reason: access.message || "ACCESS_DENIED"
        });
        return sendAccessError(res, access);
      }

      if (access.isSuperAdmin) {
        await auditDeniedSettingsAccess(connection, req, access, "SETTINGS_UNLOCK_DENIED", {
          reason: "SUPERADMIN_SETTINGS_UNLOCK_DENIED",
          email,
          purpose
        });
        await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "denied", "SuperAdmin settings unlock denied", {
          email,
          purpose,
          reason: "SUPERADMIN_SETTINGS_UNLOCK_DENIED"
        });
        return res.status(403).json({
          success: false,
          message: "Only the company owner/admin can unlock company settings"
        });
      }

      if (!isSameCompanySettingsOwnerAdmin(access)) {
        await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "denied", "Settings unlock denied", {
          email,
          purpose,
          reason: "NOT_COMPANY_OWNER_ADMIN"
        });
        return res.status(403).json({
          success: false,
          message: "Only the company owner/admin can unlock company settings"
        });
      }

      const allowedEmails = await getAllowedSettingsUnlockEmails(connection, access);
      if (!allowedEmails.has(email)) {
        await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "denied", "Settings unlock email denied", {
          email,
          purpose,
          reason: "EMAIL_NOT_ALLOWED"
        });
        return res.status(403).json({
          success: false,
          message: "Entered email is not allowed for settings verification"
        });
      }

      targetUser = access.actingUser || null;
      targetCompanyId = access.companyScope ?? getRequestedCompanyId(req);
      actingUserId = access.actingUserId ?? null;
    } else {
      targetUser = await findUserByEmail(email);
      if (!targetUser) {
        await logOtpActivitySafe(connection, req, null, "OTP_REQUEST", "denied", "OTP request email not registered", {
          email,
          purpose,
          reason: "USER_NOT_FOUND"
        });
        return res.json({
          success: true,
          message: "If the email is registered, a verification code has been sent."
        });
      }

      targetCompanyId = targetUser.company_id ?? null;
      actingUserId = targetUser.id ?? null;
    }

    const recentCount = await countRecentOtpRequests(connection, email, purpose, actingUserId, targetCompanyId);
    if (recentCount >= OTP_REQUEST_LIMIT_COUNT) {
      await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "failed", "OTP request rate limit reached", {
        email,
        purpose,
        companyId: targetCompanyId,
        userId: actingUserId,
        reason: "REQUEST_LIMIT"
      });
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please try again later."
      });
    }

    const latestOtp = await getLatestOtpRecord(connection, email, purpose, actingUserId, targetCompanyId);
    if (
      latestOtp &&
      latestOtp.last_sent_at &&
      Date.now() - new Date(latestOtp.last_sent_at).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "failed", "OTP request cooldown active", {
        email,
        purpose,
        companyId: targetCompanyId,
        userId: actingUserId,
        reason: "RESEND_COOLDOWN"
      });
      return res.status(429).json({
        success: false,
        message: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`
      });
    }

    const otpCode = generateOtpCode();
    const otpHash = hashSecret(otpCode);

    await connection.beginTransaction();
    transactionStarted = true;

    await invalidateOtpPurposeForEmail(connection, email, purpose, actingUserId, targetCompanyId);

    await connection.query(
      `
      INSERT INTO otp_verifications
      (
        email, user_id, company_id, purpose, otp_hash, expires_at,
        attempt_count, resend_count, last_sent_at, blocked_until,
        session_token_hash, session_expires_at, consumed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, NOW(), NULL, NULL, NULL, NULL, NOW(), NOW())
      `,
      [
        email,
        actingUserId,
        targetCompanyId,
        purpose,
        otpHash,
        getFutureDate(OTP_EXPIRY_MINUTES)
      ]
    );

    await sendOtpEmail({
      toEmail: email,
      otpCode,
      purpose
    });

    await connection.commit();
    transactionStarted = false;

    await logOtpActivitySafe(connection, req, access, "OTP_REQUEST", "success", "OTP request accepted", {
      email,
      purpose,
      companyId: targetCompanyId,
      userId: actingUserId
    });

    return res.json({
      success: true,
      message:
        purpose === OTP_PURPOSES.SETTINGS_UNLOCK
          ? "A verification code has been sent to your registered email."
          : "If the email is registered, a verification code has been sent."
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (_) {}
      transactionStarted = false;
    }

    await logOtpActivitySafe(connection || pool, req, access, "OTP_REQUEST", "failed", "OTP request failed", {
      email: auditEmail,
      purpose: auditPurpose,
      reason: "SERVER_ERROR",
      error: error?.message || "Unknown error"
    });
    console.error("OTP request error:", error);
    if (error?.message === EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE) {
      return res.status(503).json({
        success: false,
        message: EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE
      });
    }
    return res.status(500).json({
      success: false,
      message: "OTP request failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/otp/verify", async (req, res) => {
  let connection;
  let auditEmail = "";
  let auditPurpose = "";
  let access = null;

  try {
    const email = normalizeEmail(req.body.email);
    const purpose = normalizeOtpPurpose(req.body.purpose);
    const otp = String(req.body.otp || "").trim();
    auditEmail = email;
    auditPurpose = purpose || String(req.body.purpose || "").trim();

    if (!email || !purpose || !otp) {
      await logOtpActivitySafe(pool, req, null, "OTP_VERIFY", "failed", "OTP verify validation failed", {
        email,
        purpose: auditPurpose,
        reason: "MISSING_REQUIRED_FIELDS"
      });
      return res.status(400).json({
        success: false,
        message: "Email, purpose, and OTP are required"
      });
    }

    connection = await pool.getConnection();
    await cleanupOtpVerifications(connection);

    let expectedUserId = null;
    let expectedCompanyId = null;

    if (purpose === OTP_PURPOSES.SETTINGS_UNLOCK) {
      access = await resolveAccessContext(req, {
        requireActingUser: true,
        requireCompanyScope: false,
        allowSuperAdminAll: true
      });

      if (!access.ok) {
        await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "denied", "OTP verify access denied", {
          email,
          purpose,
          reason: access.message || "ACCESS_DENIED"
        });
        return sendAccessError(res, access);
      }

      if (access.isSuperAdmin) {
        await auditDeniedSettingsAccess(connection, req, access, "SETTINGS_UNLOCK_DENIED", {
          reason: "SUPERADMIN_SETTINGS_VERIFY_DENIED",
          email,
          purpose
        });
        await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "denied", "SuperAdmin settings verify denied", {
          email,
          purpose,
          reason: "SUPERADMIN_SETTINGS_VERIFY_DENIED"
        });
        return res.status(403).json({
          success: false,
          message: "Only the company owner/admin can unlock company settings"
        });
      }

      if (!isSameCompanySettingsOwnerAdmin(access)) {
        await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "denied", "Settings verify denied", {
          email,
          purpose,
          reason: "NOT_COMPANY_OWNER_ADMIN"
        });
        return res.status(403).json({
          success: false,
          message: "Only the company owner/admin can unlock company settings"
        });
      }

      const allowedEmails = await getAllowedSettingsUnlockEmails(connection, access);
      if (!allowedEmails.has(email)) {
        await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "denied", "Settings verify email denied", {
          email,
          purpose,
          reason: "EMAIL_NOT_ALLOWED"
        });
        return res.status(403).json({
          success: false,
          message: "Entered email is not allowed for settings verification"
        });
      }

      expectedUserId = access.actingUserId ?? null;
      expectedCompanyId = access.companyScope ?? getRequestedCompanyId(req);
    } else {
      const passwordResetUser = await findUserByEmail(email);
      if (!passwordResetUser) {
        await logOtpActivitySafe(connection, req, null, "OTP_VERIFY", "denied", "OTP verify email not registered", {
          email,
          purpose,
          reason: "USER_NOT_FOUND"
        });
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification code"
        });
      }

      expectedUserId = passwordResetUser.id ?? null;
      expectedCompanyId = passwordResetUser.company_id ?? null;
    }

    const otpRow = await getLatestOtpRecord(connection, email, purpose, expectedUserId, expectedCompanyId);

    if (!otpRow || otpRow.consumed_at) {
      await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "failed", "OTP verify record invalid", {
        email,
        purpose,
        companyId: expectedCompanyId,
        userId: expectedUserId,
        reason: "INVALID_OR_CONSUMED"
      });
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }

    if (otpRow.blocked_until && new Date(otpRow.blocked_until).getTime() > Date.now()) {
      await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "failed", "OTP verify blocked", {
        email,
        purpose,
        companyId: expectedCompanyId,
        userId: expectedUserId,
        reason: "BLOCKED"
      });
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new code later."
      });
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      await connection.query(
        `
        UPDATE otp_verifications
        SET consumed_at = NOW(), updated_at = NOW()
        WHERE id = ?
        `,
        [otpRow.id]
      );

      await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "failed", "OTP verify expired", {
        email,
        purpose,
        companyId: expectedCompanyId,
        userId: expectedUserId,
        reason: "EXPIRED"
      });

      return res.status(400).json({
        success: false,
        message: "Verification code has expired"
      });
    }

    if (
      (expectedUserId !== null && Number(otpRow.user_id || 0) !== Number(expectedUserId)) ||
      (expectedCompanyId !== null && Number(otpRow.company_id || 0) !== Number(expectedCompanyId))
    ) {
      await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "denied", "OTP verify context mismatch", {
        email,
        purpose,
        companyId: expectedCompanyId,
        userId: expectedUserId,
        reason: "CONTEXT_MISMATCH"
      });
      return res.status(403).json({
        success: false,
        message: "Verification request does not match the current user"
      });
    }

    const otpMatches = hashSecret(otp) === otpRow.otp_hash;
    if (!otpMatches) {
      const nextAttempts = Number(otpRow.attempt_count || 0) + 1;
      const reachedLimit = nextAttempts >= OTP_VERIFY_ATTEMPT_LIMIT;

      await connection.query(
        `
        UPDATE otp_verifications
        SET attempt_count = ?,
            blocked_until = CASE WHEN ? THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE) ELSE blocked_until END,
            updated_at = NOW()
        WHERE id = ?
        `,
        [nextAttempts, reachedLimit ? 1 : 0, otpRow.id]
      );

      await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "failed", "OTP verify code mismatch", {
        email,
        purpose,
        companyId: expectedCompanyId,
        userId: expectedUserId,
        reason: reachedLimit ? "ATTEMPT_LIMIT_REACHED" : "CODE_MISMATCH",
        attemptCount: nextAttempts
      });

      return res.status(400).json({
        success: false,
        message: reachedLimit
          ? "Too many failed attempts. Please request a new verification code."
          : "Invalid verification code"
      });
    }

    const sessionToken = generateSessionToken();
    await connection.query(
      `
      UPDATE otp_verifications
      SET verified_at = NOW(),
          session_token_hash = ?,
          session_expires_at = ?,
          consumed_at = NULL,
          updated_at = NOW()
      WHERE id = ?
      `,
      [hashSecret(sessionToken), getFutureDate(OTP_SESSION_EXPIRY_MINUTES), otpRow.id]
    );

    await logOtpActivitySafe(connection, req, access, "OTP_VERIFY", "success", "OTP verified", {
      email,
      purpose,
      companyId: expectedCompanyId,
      userId: expectedUserId
    });

    return res.json({
      success: true,
      message:
        purpose === OTP_PURPOSES.SETTINGS_UNLOCK
          ? "Settings have been unlocked successfully."
          : "Verification successful. You can now reset your password.",
      purpose,
      sessionToken
    });
  } catch (error) {
    await logOtpActivitySafe(connection || pool, req, access, "OTP_VERIFY", "failed", "OTP verification failed", {
      email: auditEmail,
      purpose: auditPurpose,
      reason: "SERVER_ERROR",
      error: error?.message || "Unknown error"
    });
    console.error("OTP verify error:", error);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/auth/reset-password", async (req, res) => {
  let connection;

  try {
    const email = normalizeEmail(req.body.email);
    const sessionToken = String(req.body.resetToken || req.body.sessionToken || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!email || !sessionToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset token, and new password are required"
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters long."
      });
    }

    connection = await pool.getConnection();
    await cleanupOtpVerifications(connection);

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset session is invalid or expired"
      });
    }

    const verifiedSession = await verifyOtpSessionToken(connection, {
      email,
      purpose: OTP_PURPOSES.PASSWORD_RESET,
      sessionToken,
      userId: user.id ?? null,
      companyId: user.company_id ?? null
    });

    if (!verifiedSession) {
      return res.status(400).json({
        success: false,
        message: "Password reset session is invalid or expired"
      });
    }

    await connection.beginTransaction();

    const newPasswordHash = await hashPassword(newPassword);

    await connection.query(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [newPasswordHash, user.id]
    );

    await connection.query(
      `
      UPDATE otp_verifications
      SET consumed_at = NOW(), updated_at = NOW()
      WHERE LOWER(email) = LOWER(?)
        AND purpose = ?
        AND user_id <=> ?
        AND company_id <=> ?
        AND consumed_at IS NULL
      `,
      [email, OTP_PURPOSES.PASSWORD_RESET, user.id ?? null, user.company_id ?? null]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Password has been reset successfully."
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/settings/company", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    const companyId = access.companyScope;
    if (companyId === null) {
      return res.status(400).json({
        success: false,
        message: "Company scope missing for settings save"
      });
    }

    if (access.isSuperAdmin) {
      await auditDeniedSettingsAccess(connection, req, access, "SETTINGS_SAVE_DENIED", {
        reason: "SUPERADMIN_SETTINGS_SAVE_DENIED",
        email: normalizeEmail(req.body.verificationEmail || req.body.unlockEmail || req.body.ownerEmail),
        purpose: OTP_PURPOSES.SETTINGS_UNLOCK
      });
      return res.status(403).json({
        success: false,
        message: "Only the company owner/admin can save company settings"
      });
    }

    if (!isSameCompanySettingsOwnerAdmin(access)) {
      return res.status(403).json({
        success: false,
        message: "Only the company owner/admin can save company settings"
      });
    }

    const ownerEmail = normalizeEmail(req.body.verificationEmail || req.body.unlockEmail || req.body.ownerEmail);
    const settingsUnlockToken = String(req.body.settingsUnlockToken || "").trim();

    if (!ownerEmail || !settingsUnlockToken) {
      return res.status(403).json({
        success: false,
        message: "Settings unlock verification required"
      });
    }

    const verifiedUnlock = await verifyOtpSessionToken(connection, {
      email: ownerEmail,
      purpose: OTP_PURPOSES.SETTINGS_UNLOCK,
      sessionToken: settingsUnlockToken,
      userId: access.actingUserId ?? null,
      companyId
    });

    if (!verifiedUnlock) {
      return res.status(403).json({
        success: false,
        message: "Settings unlock session is invalid or expired"
      });
    }

    const createdBy = access.actingUserId ?? getRequestedUserId(req);
    const payload = normalizeCompanySettingsRow({
      owner_email: req.body.ownerEmail,
      top_title: req.body.top_title,
      company_name: req.body.company_name,
      gstin: req.body.gstin,
      account_no: req.body.account_no,
      ifsc: req.body.ifsc,
      address: req.body.address,
      declaration: req.body.declaration,
      upi_id: req.body.upi_id,
      upi_name: req.body.upi_name,
      business_state: req.body.business_state,
      default_bill_type: req.body.default_bill_type,
      default_tax_type: req.body.default_tax_type,
      default_rate_per_gram: req.body.default_rate_per_gram,
      default_mc_rate: req.body.default_mc_rate,
      subscription_plan: req.body.subscription_plan,
      subscription_status: req.body.subscription_status,
      subscription_start_date: req.body.subscription_start_date,
      subscription_end_date: req.body.subscription_end_date
    });

    const existingRow = await getCompanySettingsForCompany(connection, companyId);

    if (existingRow) {
      await connection.query(
        `
        UPDATE company_settings
        SET owner_email = ?,
            top_title = ?,
            company_name = ?,
            gstin = ?,
            account_no = ?,
            ifsc = ?,
            address = ?,
            declaration = ?,
            upi_id = ?,
            upi_name = ?,
            business_state = ?,
            default_bill_type = ?,
            default_tax_type = ?,
            default_rate_per_gram = ?,
            default_mc_rate = ?,
            subscription_plan = ?,
            subscription_status = ?,
            subscription_start_date = ?,
            subscription_end_date = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [
          payload.ownerEmail,
          payload.top_title,
          payload.company_name,
          payload.gstin,
          payload.account_no,
          payload.ifsc,
          payload.address,
          payload.declaration,
          payload.upi_id,
          payload.upi_name,
          payload.business_state,
          payload.default_bill_type,
          payload.default_tax_type,
          payload.default_rate_per_gram,
          payload.default_mc_rate,
          payload.subscription_plan,
          payload.subscription_status,
          payload.subscription_start_date || null,
          payload.subscription_end_date || null,
          createdBy,
          existingRow.id
        ]
      );
    } else {
      await connection.query(
        `
        INSERT INTO company_settings
        (
          company_id, owner_email, top_title, company_name, gstin, account_no, ifsc,
          address, declaration, upi_id, upi_name, business_state, default_bill_type,
          default_tax_type, default_rate_per_gram, default_mc_rate, subscription_plan,
          subscription_status, subscription_start_date, subscription_end_date,
          created_by, updated_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          companyId,
          payload.ownerEmail,
          payload.top_title,
          payload.company_name,
          payload.gstin,
          payload.account_no,
          payload.ifsc,
          payload.address,
          payload.declaration,
          payload.upi_id,
          payload.upi_name,
          payload.business_state,
          payload.default_bill_type,
          payload.default_tax_type,
          payload.default_rate_per_gram,
          payload.default_mc_rate,
          payload.subscription_plan,
          payload.subscription_status,
          payload.subscription_start_date || null,
          payload.subscription_end_date || null,
          createdBy,
          createdBy
        ]
      );
    }

    const savedRow = await getCompanySettingsForCompany(connection, companyId);
    await writeAuditLogSafe(connection, req, {
      companyId,
      userId: createdBy ?? null,
      actionType: "SETTINGS_CHANGE",
      entityType: "SETTINGS",
      entityId: String(companyId),
      beforeData: existingRow || null,
      afterData: savedRow || {
        company_id: companyId,
        ...payload,
        updated_by: createdBy ?? null
      }
    });

    return res.json({
      success: true,
      message: "Settings saved successfully",
      settings: normalizeCompanySettingsRow(savedRow)
    });
  } catch (error) {
    console.error("Company settings save error:", error);
    return res.status(500).json({
      success: false,
      message: "Company settings save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   EXPENSE MANAGER
========================= */
app.get("/expenses", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const params = [];
    let whereClause = "";

    if (companyId !== null) {
      whereClause = "WHERE e.company_id = ?";
      params.push(companyId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        e.*,
        DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(e.expense_time, '%H:%i') AS time,
        c.company_name,
        u.name AS created_by_name
      FROM expenses e
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN users u ON u.id = e.created_by
      ${whereClause}
      ORDER BY e.expense_date DESC, e.expense_time DESC, e.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      expenses: rows.map((row) => normalizeExpenseRow(row))
    });
  } catch (error) {
    console.error("Expense fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Expense fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/expenses", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const person = String(req.body.person || "").trim();
    const expenseDate = String(req.body.date || req.body.expenseDate || "").trim();
    const expenseTime = String(req.body.time || req.body.expenseTime || "").trim();
    const amount = Number(req.body.amount || 0);
    const category = String(req.body.category || "").trim();
    const reason = String(req.body.reason || "").trim();
    const note = String(req.body.note || "").trim();

    if (!person || !expenseDate || amount <= 0 || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, date, amount, and category are required"
      });
    }

    connection = await pool.getConnection();
    const [insertResult] = await connection.query(
      `
      INSERT INTO expenses
      (
        company_id,
        person,
        expense_date,
        expense_time,
        amount,
        category,
        reason,
        note,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        access.companyScope,
        person,
        expenseDate,
        expenseTime || null,
        amount,
        category,
        reason,
        note,
        access.actingUserId ?? getRequestedUserId(req),
        access.actingUserId ?? getRequestedUserId(req)
      ]
    );

    const [rows] = await connection.query(
      `
      SELECT
        e.*,
        DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(e.expense_time, '%H:%i') AS time
      FROM expenses e
      WHERE e.id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    return res.json({
      success: true,
      message: "Expense saved successfully",
      expense: normalizeExpenseRow(rows[0] || {})
    });
  } catch (error) {
    console.error("Expense save error:", error);
    return res.status(500).json({
      success: false,
      message: "Expense save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/expenses/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  let connection;

  try {
    const expenseId = Number(req.params.id);
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!expenseId) {
      return res.status(400).json({
        success: false,
        message: "Expense id missing"
      });
    }

    const person = String(req.body.person || "").trim();
    const expenseDate = String(req.body.date || req.body.expenseDate || "").trim();
    const expenseTime = String(req.body.time || req.body.expenseTime || "").trim();
    const amount = Number(req.body.amount || 0);
    const category = String(req.body.category || "").trim();
    const reason = String(req.body.reason || "").trim();
    const note = String(req.body.note || "").trim();

    if (!person || !expenseDate || amount <= 0 || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, date, amount, and category are required"
      });
    }

    connection = await pool.getConnection();

    const [existingRows] = await connection.query(
      `
      SELECT id
      FROM expenses
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [expenseId, access.companyScope]
    );

    if (!existingRows.length) {
      return res.status(404).json({
        success: false,
        message: "Expense not found"
      });
    }

    await connection.query(
      `
      UPDATE expenses
      SET person = ?,
          expense_date = ?,
          expense_time = ?,
          amount = ?,
          category = ?,
          reason = ?,
          note = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [
        person,
        expenseDate,
        expenseTime || null,
        amount,
        category,
        reason,
        note,
        access.actingUserId ?? getRequestedUserId(req),
        expenseId,
        access.companyScope
      ]
    );

    const [rows] = await connection.query(
      `
      SELECT
        e.*,
        DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(e.expense_time, '%H:%i') AS time
      FROM expenses e
      WHERE e.id = ?
      LIMIT 1
      `,
      [expenseId]
    );

    return res.json({
      success: true,
      message: "Expense updated successfully",
      expense: normalizeExpenseRow(rows[0] || {})
    });
  } catch (error) {
    console.error("Expense update error:", error);
    return res.status(500).json({
      success: false,
      message: "Expense update failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/expenses/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  try {
    const expenseId = Number(req.params.id);
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!expenseId) {
      return res.status(400).json({
        success: false,
        message: "Expense id missing"
      });
    }

    const [deleteResult] = await pool.query(
      `
      DELETE FROM expenses
      WHERE id = ? AND company_id = ?
      `,
      [expenseId, access.companyScope]
    );

    if (Number(deleteResult.affectedRows || 0) === 0) {
      return res.status(404).json({
        success: false,
        message: "Expense not found"
      });
    }

    return res.json({
      success: true,
      message: "Expense deleted successfully"
    });
  } catch (error) {
    console.error("Expense delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Expense delete failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   DAILY REPORT
========================= */
app.get("/getDailyReport", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const reportDate = normalizeReportDateInput(req.query.date);
    const nextDate = getNextDateString(reportDate);
    const companyParams = companyId !== null ? [companyId] : [];

    const [processRows] = await pool.query(
      `
      SELECT
        pl.id,
        pl.lot_no AS lotNo,
        pl.raw_weight AS rawWeight,
        pl.loss_weight AS lossWeight,
        pl.final_weight AS finalWeight,
        COALESCE((
          SELECT SUM(kw.issue_weight)
          FROM karigar_work kw
          WHERE kw.company_id = pl.company_id
            AND kw.lot_no = pl.lot_no
        ), 0) AS usedWeight,
        (pl.raw_weight - COALESCE((
          SELECT SUM(kw.issue_weight)
          FROM karigar_work kw
          WHERE kw.company_id = pl.company_id
            AND kw.lot_no = pl.lot_no
        ), 0)) AS balanceWeight,
        pl.saved_at AS savedAt,
        pl.company_id,
        c.company_name
      FROM process_lots pl
      LEFT JOIN companies c ON c.id = pl.company_id
      WHERE pl.saved_at >= ?
        AND pl.saved_at < ?
        ${companyId !== null ? "AND pl.company_id = ?" : ""}
      ORDER BY pl.saved_at DESC, pl.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [stockCreatedRows] = await pool.query(
      `
      SELECT
        s.id,
        s.serial,
        s.product_name,
        s.barcode,
        s.lot_number,
        s.size,
        s.weight,
        s.qty,
        s.created_at,
        s.company_id,
        c.company_name
      FROM stock s
      LEFT JOIN companies c ON c.id = s.company_id
      WHERE s.created_at >= ?
        AND s.created_at < ?
        ${companyId !== null ? "AND s.company_id = ?" : ""}
      ORDER BY s.created_at DESC, s.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [stockSoldRows] = await pool.query(
      `
      SELECT
        s.id,
        s.serial,
        s.product_name,
        s.barcode,
        s.lot_number,
        s.size,
        s.weight,
        s.qty,
        s.invoice_number,
        s.sold_at,
        s.company_id,
        c.company_name
      FROM stock s
      LEFT JOIN companies c ON c.id = s.company_id
      WHERE s.sold_at IS NOT NULL
        AND s.sold_at >= ?
        AND s.sold_at < ?
        ${companyId !== null ? "AND s.company_id = ?" : ""}
      ORDER BY s.sold_at DESC, s.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [invoiceRows] = await pool.query(
      `
      SELECT
        sh.id,
        sh.invoice_number,
        sh.customer_name,
        sh.mobile,
        sh.invoice_date,
        sh.payment_mode,
        sh.payment_status,
        sh.employee_name,
        sh.total_items,
        sh.total_weight,
        sh.total_amount,
        sh.customer_total_amount,
        sh.company_total_amount,
        sh.employee_margin_amount,
        sh.paid_amount,
        sh.due_amount,
        sh.status,
        sh.created_at,
        sh.company_id,
        c.company_name
      FROM sales_history sh
      LEFT JOIN companies c ON c.id = sh.company_id
      WHERE sh.created_at >= ?
        AND sh.created_at < ?
        ${companyId !== null ? "AND sh.company_id = ?" : ""}
      ORDER BY sh.created_at DESC, sh.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [returnRows] = await pool.query(
      `
      SELECT
        rh.id,
        rh.barcode,
        rh.invoice_number,
        rh.customer_name,
        rh.product_name,
        rh.size,
        rh.weight,
        rh.return_type,
        rh.return_reason,
        rh.return_date,
        rh.company_id,
        c.company_name
      FROM return_history rh
      LEFT JOIN companies c ON c.id = rh.company_id
      LEFT JOIN users u ON u.id = rh.created_by
      WHERE rh.return_date >= ?
        AND rh.return_date < ?
        ${companyId !== null ? "AND rh.company_id = ?" : ""}
      ORDER BY rh.return_date DESC, rh.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [materialRows] = await pool.query(
      `
      SELECT
        msm.id,
        msm.movement_type,
        msm.qty,
        msm.unit,
        msm.movement_date,
        msm.supplier_name,
        msm.reference_no,
        msm.remarks,
        msi.category,
        msi.material_name,
        msi.variant,
        msi.size,
        msi.low_stock_level,
        msi.current_stock,
        msi.status,
        msm.company_id,
        c.company_name
      FROM material_stock_movements msm
      LEFT JOIN material_stock_items msi ON msi.id = msm.material_id
      LEFT JOIN companies c ON c.id = msm.company_id
      WHERE msm.movement_date >= ?
        AND msm.movement_date < ?
        ${companyId !== null ? "AND msm.company_id = ?" : ""}
      ORDER BY msm.movement_date DESC, msm.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [expenseRows] = await pool.query(
      `
      SELECT
        e.id,
        DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(e.expense_time, '%H:%i') AS time,
        e.person,
        e.category,
        e.reason,
        e.note,
        e.amount,
        e.company_id,
        c.company_name
      FROM expenses e
      LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.expense_date >= ?
        AND e.expense_date < ?
        ${companyId !== null ? "AND e.company_id = ?" : ""}
      ORDER BY e.expense_date DESC, e.expense_time DESC, e.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const [transactionRows] = await pool.query(
      `
      SELECT
        tm.id,
        COALESCE(DATE_FORMAT(tm.voucher_date, '%Y-%m-%d'), DATE_FORMAT(tm.created_at, '%Y-%m-%d')) AS date,
        COALESCE(TIME_FORMAT(tm.voucher_time, '%H:%i'), TIME_FORMAT(tm.created_at, '%H:%i')) AS time,
        COALESCE(pm.party_name, '') AS customer,
        tm.transaction_type AS type,
        COALESCE((
          SELECT tl.item_name
          FROM transaction_lines tl
          WHERE tl.transaction_id = tm.id
          ORDER BY tl.line_no ASC, tl.id ASC
          LIMIT 1
        ), '') AS itemName,
        COALESCE((
          SELECT tl.qty
          FROM transaction_lines tl
          WHERE tl.transaction_id = tm.id
          ORDER BY tl.line_no ASC, tl.id ASC
          LIMIT 1
        ), 0) AS qty,
        COALESCE((
          SELECT tl.gross_weight
          FROM transaction_lines tl
          WHERE tl.transaction_id = tm.id
          ORDER BY tl.line_no ASC, tl.id ASC
          LIMIT 1
        ), 0) AS grossWeight,
        tm.payment_mode AS mode,
        COALESCE((
          SELECT tl.line_amount
          FROM transaction_lines tl
          WHERE tl.transaction_id = tm.id
          ORDER BY tl.line_no ASC, tl.id ASC
          LIMIT 1
        ), 0) AS amount,
        COALESCE(tm.note, tm.remarks, '') AS note,
        tm.company_id,
        c.company_name
      FROM transaction_master tm
      LEFT JOIN party_master pm ON pm.id = tm.party_id
      LEFT JOIN companies c ON c.id = tm.company_id
      WHERE tm.created_at >= ?
        AND tm.created_at < ?
        AND UPPER(COALESCE(tm.status, 'POSTED')) <> 'CANCELLED'
        ${companyId !== null ? "AND tm.company_id = ?" : ""}
      ORDER BY tm.created_at DESC, tm.id DESC
      `,
      [reportDate, nextDate, ...companyParams]
    );

    const materialSummary = await getMaterialStockSummaryRows(companyId);
    const totalBillingAmount = invoiceRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalCustomerAmount = invoiceRows.reduce((sum, row) => sum + Number(row.customer_total_amount || row.total_amount || 0), 0);
    const totalCompanyAmount = invoiceRows.reduce((sum, row) => sum + Number(row.company_total_amount || 0), 0);
    const totalEmployeeMargin = invoiceRows.reduce((sum, row) => sum + Number(row.employee_margin_amount || 0), 0);
    const totalBills = invoiceRows.length;
    const totalReturns = returnRows.length;
    const normalReturns = returnRows.filter((row) => normalizeReturnType(row.return_type) === "RETURN_TO_STOCK").length;
    const damagedReturns = returnRows.filter((row) => normalizeReturnType(row.return_type) === "DAMAGED_RETURN").length;
    const materialIn = materialRows
      .filter((row) => normalizeMaterialMovementType(row.movement_type) === "IN")
      .reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const materialOut = materialRows
      .filter((row) => normalizeMaterialMovementType(row.movement_type) === "OUT")
      .reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const totalExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return res.json({
      success: true,
      date: reportDate,
      companyScope: companyId,
      summary: {
        totalProcessCount: processRows.length,
        totalStickersCreated: stockCreatedRows.length,
        stockAdded: stockCreatedRows.length,
        stockSold: stockSoldRows.length,
        totalReturns,
        normalReturns,
        damagedReturns,
        totalBillingAmount,
        totalCustomerAmount,
        totalCompanyAmount,
        totalEmployeeMargin,
        totalBills,
        totalExpenses,
        totalTransactions: transactionRows.length,
        materialIn,
        materialOut,
        lowStockCount: materialSummary.lowStockItems
      },
      sections: {
        process: {
          rows: processRows.map((row) => ({
            ...row,
            rawWeight: toNumber(row.rawWeight),
            lossWeight: toNumber(row.lossWeight),
            finalWeight: toNumber(row.finalWeight),
            usedWeight: toNumber(row.usedWeight),
            balanceWeight: toNumber(row.balanceWeight)
          })),
          totalCount: processRows.length
        },
        sticker: {
          rows: stockCreatedRows,
          totalCreated: stockCreatedRows.length
        },
        stock: {
          addedRows: stockCreatedRows,
          soldRows: stockSoldRows,
          addedCount: stockCreatedRows.length,
          soldCount: stockSoldRows.length
        },
        material: {
          rows: materialRows,
          totalIn: materialIn,
          totalOut: materialOut,
          lowStockCount: materialSummary.lowStockItems
        },
        invoiceBilling: {
          rows: invoiceRows,
          totalBills,
          totalBillingAmount,
          totalCustomerAmount,
          totalCompanyAmount,
          totalEmployeeMargin
        },
        returns: {
          rows: returnRows,
          totalReturns,
          normalReturns,
          damagedReturns
        },
        salesHistory: {
          rows: invoiceRows,
          totalSalesCount: totalBills,
          totalSalesAmount: totalBillingAmount,
          totalCustomerAmount,
          totalCompanyAmount,
          totalEmployeeMargin
        },
        expenses: {
          rows: expenseRows.map((row) => normalizeExpenseRow(row)),
          totalExpenses
        },
        transactions: {
          rows: transactionRows.map((row) => ({
            ...row,
            qty: toNumber(row.qty),
            grossWeight: toNumber(row.grossWeight),
            amount: toNumber(row.amount)
          })),
          totalTransactions: transactionRows.length
        }
      }
    });
  } catch (error) {
    console.error("Get daily report error:", error);
    return res.status(500).json({
      success: false,
      message: "Daily report fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   GET ALL STOCK
========================= */
app.get("/getStock", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const requestedBranchId = getRequestedBranchScopeValue(req);
    const branchScope = await resolveOperationalBranchScope(pool, access, requestedBranchId);
    if (!branchScope.ok) {
      return res.status(branchScope.status || 403).json({
        success: false,
        message: branchScope.message || "Branch access denied"
      });
    }

    const whereParts = [];
    const params = [];
    if (companyId !== null) {
      whereParts.push("s.company_id = ?");
      params.push(companyId);
    }
    appendBranchScopeFilter(whereParts, params, branchScope, { alias: "s" });
    appendOperationalStockVisibilityFilter(whereParts, { alias: "s" });
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 2000 });

    const [rows] = await pool.query(
      `
      SELECT
        s.*,
        b.branch_code,
        b.branch_name,
        b.branch_type,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS effective_stock_state
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      ${whereClause}
      ORDER BY
        CAST(COALESCE(s.lot_number, '0') AS UNSIGNED) ASC,
        CAST(COALESCE(s.serial, '0') AS UNSIGNED) ASC,
        s.id ASC
      ${pagination.sql}
      `,
      params
    );

    setPaginationHeaders(res, pagination);
    res.setHeader("X-Branch-Scope", JSON.stringify(getBranchScopeResponse(branchScope)));
    return res.json(rows);
  } catch (error) {
    console.error("Get stock error:", error);
    return res.status(500).json({
      success: false,
      message: "Stock fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/process/data", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const lotWhereClause = companyId !== null ? "WHERE company_id = ?" : "";
    const lotParams = companyId !== null ? [companyId] : [];
    const workWhereClause = companyId !== null ? "WHERE company_id = ?" : "";
    const workParams = companyId !== null ? [companyId] : [];

    const [lotRows] = await pool.query(
      `
      SELECT *
      FROM process_lots
      ${lotWhereClause}
      ORDER BY
        CAST(COALESCE(lot_no, '0') AS UNSIGNED) ASC,
        lot_no ASC,
        work_category ASC,
        id ASC
      `,
      lotParams
    );

    const [workRows] = await pool.query(
      `
      SELECT *
      FROM karigar_work
      ${workWhereClause}
      ORDER BY id ASC
      `,
      workParams
    );

    return res.json({
      success: true,
      lots: lotRows.map(normalizeProcessLotRow),
      karigarWork: workRows.map(normalizeKarigarWorkRow)
    });
  } catch (error) {
    console.error("Get process data error:", error);
    return res.status(500).json({
      success: false,
      message: "Process data fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/process/lots/:lotNo/next-step", authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.params.lotNo);
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || "REGULAR_SANKHA");
    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "Lot No is required"
      });
    }

    const processLot = await getProcessLotForSteps(connection, access.companyScope, lotNo, workCategory);
    if (!processLot) {
      return res.status(404).json({
        success: false,
        message: `Process lot ${lotNo} not found`
      });
    }

    if (isManualProcessLot(processLot)) {
      return res.status(400).json({
        success: false,
        message: "Manual lots are not available in the process workflow yet"
      });
    }

    const templateContext = await getProcessTemplateStepsForLot(connection, access.companyScope, processLot);
    const templateSteps = templateContext.steps;
    const template = templateSteps.map((step) => step.stepName);

    const [completedRows] = await connection.query(
      `
      SELECT process_name
      FROM process_steps
      WHERE company_id = ?
        AND process_lot_id = ?
        AND status = 'COMPLETED'
      ORDER BY step_no ASC, id ASC
      `,
      [access.companyScope, processLot.id]
    );

    const completedSteps = completedRows
      .map((row) => String(row.process_name || "").trim())
      .filter(Boolean);
    const completedNameSet = new Set(completedSteps.map(normalizeTemplateStepName));
    const completedTemplateSteps = template.filter((stepName) => {
      return completedNameSet.has(normalizeTemplateStepName(stepName));
    });
    const nextTemplateStep = templateSteps.find((step) => {
      return !completedNameSet.has(normalizeTemplateStepName(step.stepName));
    }) || null;
    const nextStep = nextTemplateStep?.stepName || null;
    const totalSteps = template.length;
    const completedCount = completedTemplateSteps.length;
    const usesAdditiveMaterial = Boolean(nextTemplateStep?.usesAdditiveMaterial);

    return res.json({
      success: true,
      template,
      templateSteps,
      completedSteps,
      nextStep,
      usesAdditiveMaterial,
      additiveMaterialLabel: usesAdditiveMaterial ? String(nextTemplateStep?.additiveMaterialLabel || "") : "",
      additiveAffectsOutputWeight: usesAdditiveMaterial ? Boolean(nextTemplateStep?.additiveAffectsOutputWeight) : false,
      progress: `${completedCount}/${totalSteps}`,
      isReadyToComplete: totalSteps > 0 && completedCount >= totalSteps
    });
  } catch (error) {
    console.error("Get process lot next step error:", error);
    return res.status(500).json({
      success: false,
      message: "Process next step fetch failed",
      error: getErrorDetail(error)
    });
  } finally {
    connection.release();
  }
});

async function getProcessLotForSteps(connection, companyId, lotNo, workCategory = "REGULAR_SANKHA") {
  const normalizedCategory = normalizeWorkCategory(workCategory || "REGULAR_SANKHA");
  const [rows] = await connection.query(
    `
    SELECT *
    FROM process_lots
    WHERE company_id = ?
      AND work_category = ?
      AND lot_no = ?
    LIMIT 1
    `,
    [companyId, normalizedCategory, lotNo]
  );
  return rows.length ? normalizeProcessLotRow(rows[0]) : null;
}

async function getProcessLotById(connection, companyId, processLotId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM process_lots
    WHERE company_id = ?
      AND id = ?
    LIMIT 1
    `,
    [companyId, processLotId]
  );
  return rows.length ? normalizeProcessLotRow(rows[0]) : null;
}

async function getProcessStepCount(connection, companyId, processLotId) {
  const [rows] = await connection.query(
    `
    SELECT COUNT(*) AS total
    FROM process_steps
    WHERE company_id = ?
      AND process_lot_id = ?
    `,
    [companyId, processLotId]
  );
  return Number(rows[0]?.total || 0);
}

async function getOpenProcessStep(connection, companyId, processLotId, excludeStepId = null) {
  const params = [companyId, processLotId];
  let excludeSql = "";
  if (excludeStepId) {
    excludeSql = "AND id <> ?";
    params.push(Number(excludeStepId));
  }

  const [rows] = await connection.query(
    `
    SELECT *
    FROM process_steps
    WHERE company_id = ?
      AND process_lot_id = ?
      AND status = 'OPEN'
      ${excludeSql}
    ORDER BY step_no ASC, id ASC
    LIMIT 1
    `,
    params
  );
  return rows.length ? normalizeProcessStepRow(rows[0]) : null;
}

async function getLastCompletedProcessStep(connection, companyId, processLotId) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM process_steps
    WHERE company_id = ?
      AND process_lot_id = ?
      AND status = 'COMPLETED'
    ORDER BY step_no DESC, id DESC
    LIMIT 1
    `,
    [companyId, processLotId]
  );
  return rows.length ? normalizeProcessStepRow(rows[0]) : null;
}

function normalizeTemplateStepName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function getProcessTemplateById(connection, companyId, templateId) {
  const cleanTemplateId = Number(templateId || 0);
  if (!cleanTemplateId) return null;

  const [templateRows] = await connection.query(
    `
    SELECT id, name, work_category
    FROM process_templates
    WHERE company_id = ?
      AND id = ?
      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
    LIMIT 1
    `,
    [companyId, cleanTemplateId]
  );

  if (!templateRows.length) return null;

  const [stepRows] = await connection.query(
    `
    SELECT
      step_order,
      step_name,
      is_required,
      allow_repeat,
      uses_additive_material,
      additive_material_label,
      additive_affects_output_weight
    FROM process_template_steps
    WHERE company_id = ?
      AND template_id = ?
      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
    ORDER BY step_order ASC, id ASC
    `,
    [companyId, cleanTemplateId]
  );

  return {
    id: Number(templateRows[0].id || 0),
    name: String(templateRows[0].name || ""),
    workCategory: normalizeWorkCategory(templateRows[0].work_category),
    steps: stepRows
      .map((row) => {
        const stepName = String(row.step_name || "").trim();
        if (!stepName) return null;

        return {
          stepOrder: Number(row.step_order || 0),
          stepName,
          isRequired: Boolean(Number(row.is_required ?? 1)),
          allowRepeat: Boolean(Number(row.allow_repeat || 0)),
          usesAdditiveMaterial: Boolean(Number(row.uses_additive_material || 0)),
          additiveMaterialLabel: String(row.additive_material_label || ""),
          additiveAffectsOutputWeight: Boolean(Number(row.additive_affects_output_weight ?? 1))
        };
      })
      .filter(Boolean)
  };
}

async function getDefaultProcessTemplateForCategory(connection, companyId, workCategory) {
  const lotWorkCategory = normalizeWorkCategory(workCategory || "REGULAR_SANKHA");
  const categoryCandidates = lotWorkCategory === "REGULAR_SANKHA"
    ? ["REGULAR_SANKHA"]
    : [lotWorkCategory, "REGULAR_SANKHA"];

  for (const candidate of categoryCandidates) {
    const [rows] = await connection.query(
      `
      SELECT id
      FROM process_templates
      WHERE company_id = ?
        AND work_category = ?
        AND is_default = 1
        AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
      ORDER BY id ASC
      LIMIT 1
      `,
      [companyId, candidate]
    );

    const template = await getProcessTemplateById(connection, companyId, rows[0]?.id);
    if (template?.steps?.length) return template;
  }

  const [legacyRows] = await connection.query(
    `
    SELECT id
    FROM process_templates
    WHERE company_id = ?
      AND is_default = 1
      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
    ORDER BY id ASC
    LIMIT 1
    `,
    [companyId]
  );

  return getProcessTemplateById(connection, companyId, legacyRows[0]?.id);
}

function buildProcessTemplateSnapshot(template) {
  if (!template?.id || !Array.isArray(template.steps) || !template.steps.length) return null;

  return {
    templateId: Number(template.id),
    templateName: String(template.name || ""),
    workCategory: normalizeWorkCategory(template.workCategory),
    steps: template.steps.map((step, index) => ({
      stepOrder: Number(step.stepOrder || index + 1),
      stepName: String(step.stepName || ""),
      isRequired: Boolean(step.isRequired ?? true),
      allowRepeat: Boolean(step.allowRepeat || false),
      usesAdditiveMaterial: Boolean(step.usesAdditiveMaterial || false),
      additiveMaterialLabel: String(step.additiveMaterialLabel || ""),
      additiveAffectsOutputWeight: Boolean(step.additiveAffectsOutputWeight ?? true)
    }))
  };
}

function getProcessTemplateStepsFromSnapshot(snapshotValue) {
  if (!snapshotValue) return [];

  let snapshot = snapshotValue;
  if (typeof snapshotValue === "string") {
    try {
      snapshot = JSON.parse(snapshotValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(snapshot?.steps)) return [];

  return snapshot.steps
    .map((step) => {
      const stepName = String(step?.stepName || step?.step_name || "").trim();
      if (!stepName) return null;

      return {
        stepName,
        usesAdditiveMaterial: Boolean(step?.usesAdditiveMaterial ?? step?.uses_additive_material ?? false),
        additiveMaterialLabel: String(step?.additiveMaterialLabel || step?.additive_material_label || ""),
        additiveAffectsOutputWeight: Boolean(step?.additiveAffectsOutputWeight ?? step?.additive_affects_output_weight ?? true)
      };
    })
    .filter(Boolean);
}

async function getProcessTemplateStepsForLot(connection, companyId, processLot) {
  let templateId = Number(processLot?.template_id || 0) || null;
  const lotWorkCategory = normalizeWorkCategory(processLot?.work_category || processLot?.workCategory || "REGULAR_SANKHA");

  const snapshotSteps = getProcessTemplateStepsFromSnapshot(processLot?.template_snapshot_json);
  if (templateId && snapshotSteps.length) {
    return {
      templateId,
      steps: snapshotSteps
    };
  }

  if (!templateId) {
    const [defaultRows] = await connection.query(
      `
      SELECT id
      FROM process_templates
      WHERE company_id = ?
        AND work_category = ?
        AND is_default = 1
        AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
      ORDER BY id ASC
      LIMIT 1
      `,
      [companyId, lotWorkCategory]
    );
    templateId = Number(defaultRows[0]?.id || 0) || null;
  }

  if (!templateId && lotWorkCategory !== "REGULAR_SANKHA") {
    const [regularRows] = await connection.query(
      `
      SELECT id
      FROM process_templates
      WHERE company_id = ?
        AND work_category = 'REGULAR_SANKHA'
        AND is_default = 1
        AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
      ORDER BY id ASC
      LIMIT 1
      `,
      [companyId]
    );
    templateId = Number(regularRows[0]?.id || 0) || null;
  }

  if (!templateId) {
    const [legacyRows] = await connection.query(
      `
      SELECT id
      FROM process_templates
      WHERE company_id = ?
        AND is_default = 1
        AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
      ORDER BY id ASC
      LIMIT 1
      `,
      [companyId]
    );
    templateId = Number(legacyRows[0]?.id || 0) || null;
  }

  if (!templateId) {
    return {
      templateId: null,
      steps: []
    };
  }

  const [stepRows] = await connection.query(
    `
    SELECT
      step_name,
      uses_additive_material,
      additive_material_label,
      additive_affects_output_weight
    FROM process_template_steps
    WHERE company_id = ?
      AND template_id = ?
      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
    ORDER BY step_order ASC, id ASC
    `,
    [companyId, templateId]
  );

  return {
    templateId,
    steps: stepRows
      .map((row) => {
        const stepName = String(row.step_name || "").trim();
        if (!stepName) return null;

        return {
          stepName,
          usesAdditiveMaterial: Boolean(Number(row.uses_additive_material || 0)),
          additiveMaterialLabel: String(row.additive_material_label || ""),
          additiveAffectsOutputWeight: Boolean(Number(row.additive_affects_output_weight ?? 1))
        };
      })
      .filter(Boolean)
  };
}

async function validateStickerAgainstProcessOutput(connection, companyId, lotNo, nextWeight, nextQty = 1, excludeStockId = null, qtyProvided = true) {
  const cleanLot = normalizeProcessLotNo(lotNo);
  if (!cleanLot) return { ok: true };

  const stickerWeight = toNumber(nextWeight);
  const stickerQty = toNumber(nextQty);
  if (stickerWeight <= 0) {
    return {
      ok: false,
      message: "Sticker weight must be greater than zero"
    };
  }

  if (stickerQty <= 0) {
    return {
      ok: false,
      message: "Sticker quantity must be greater than zero"
    };
  }

  const [lotRows] = await connection.query(
    `
    SELECT *
    FROM process_lots
    WHERE company_id = ?
      AND lot_no = ?
      AND UPPER(COALESCE(status, 'OPEN')) = 'COMPLETED'
    ORDER BY id ASC
    `,
    [companyId, cleanLot]
  );
  const completedLots = lotRows.map(normalizeProcessLotRow);
  const stickerLots = completedLots.filter((lot) => getWorkCategoryDestination(lot.workCategory || lot.work_category) === "STICKER");
  const directStockLot = completedLots.find((lot) => getWorkCategoryDestination(lot.workCategory || lot.work_category) === "STOCK");
  const processLot = stickerLots[0] || null;

  if (!processLot && directStockLot) {
    return {
      ok: false,
      message: `Lot ${cleanLot} is already in Stock and is not available for Sticker`
    };
  }

  if (!processLot || normalizeProcessLotStatus(processLot.status) !== "COMPLETED") {
    return {
      ok: false,
      message: `Lot ${cleanLot} must be marked COMPLETED before sticker creation`
    };
  }

  if (isManualProcessLot(processLot)) {
    return { ok: true };
  }

  const finalStep = await getLastCompletedProcessStep(connection, companyId, processLot.id);
  if (!finalStep) {
    return {
      ok: false,
      message: `Lot ${cleanLot} has no completed process output for sticker creation`
    };
  }

  const params = [companyId, cleanLot];
  let excludeSql = "";
  if (excludeStockId) {
    excludeSql = "AND id <> ?";
    params.push(Number(excludeStockId));
  }

  const [usageRows] = await connection.query(
    `
    SELECT COALESCE(SUM(weight), 0) AS used_weight,
      COALESCE(SUM(qty), 0) AS used_qty
    FROM stock
    WHERE company_id = ?
      AND lot_number = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'
      ${excludeSql}
    `,
    params
  );

  const usedWeight = toNumber(usageRows[0]?.used_weight);
  const usedQty = toNumber(usageRows[0]?.used_qty);
  const totalWeight = usedWeight + stickerWeight;
  const totalQty = usedQty + stickerQty;
  const allowedWeight = toNumber(finalStep.output_weight);
  const allowedQty = toNumber(finalStep.output_qty);

  if (allowedQty > 0 && !qtyProvided) {
    return {
      ok: false,
      message: "Sticker quantity is required when quantity tracking is active"
    };
  }

  if (allowedWeight > 0 && totalWeight > allowedWeight + 0.0005) {
    return {
      ok: false,
      message: `Sticker weight exceeds final process output for lot ${cleanLot}. Allowed ${allowedWeight.toFixed(3)}g, attempted ${totalWeight.toFixed(3)}g.`
    };
  }

  if (allowedQty > 0 && totalQty > allowedQty + 0.0005) {
    return {
      ok: false,
      message: `Sticker quantity exceeds final process output for lot ${cleanLot}. Allowed ${allowedQty}, attempted ${totalQty}.`
    };
  }

  return { ok: true };
}

async function moveCompletedProcessLotToStock(connection, companyId, processLot, finalStep, userId = null) {
  const workCategory = normalizeWorkCategory(processLot?.work_category || processLot?.workCategory);
  if (getWorkCategoryDestination(workCategory) !== "STOCK") return null;

  const outputWeight = toNumber(finalStep?.output_weight);
  if (outputWeight <= 0) return null;

  const lotNo = normalizeProcessLotNo(processLot?.lot_no || processLot?.lotNo);
  const source = workCategory === "PIN" ? "PROCESS_PIN" : "PROCESS_KDM";
  const referenceStepId = String(finalStep?.id || "").trim();
  const outputQty = toNumber(finalStep?.output_qty);
  const expectedQty = toNumber(processLot?.expected_total_qty);
  const qty = Math.max(1, Math.round(outputQty > 0 ? outputQty : expectedQty > 0 ? expectedQty : 1));

  const [existingRows] = await connection.query(
    `
    SELECT id
    FROM stock
    WHERE company_id = ?
      AND source = ?
      AND manual_lot_id = ?
    LIMIT 1
    `,
    [companyId, source, Number(processLot?.id || 0)]
  );

  if (existingRows.length) {
    return {
      stockId: Number(existingRows[0].id || 0),
      alreadyMoved: true
    };
  }

  const [insertResult] = await connection.query(
    `
    INSERT INTO stock (
      serial,
      product_name,
      purity,
      sku,
      mm,
      size,
      weight,
      qty,
      category,
      lot_number,
      barcode,
      metal_type,
      process_type,
      source,
      manual_lot_id,
      reference_step_id,
      status,
      company_id,
      created_by,
      deleted_at
    ) VALUES (?, ?, '', '', '', '', ?, ?, ?, ?, NULL, '', ?, ?, ?, ?, 'IN_STOCK', ?, ?, NULL)
    `,
    [
      "",
      workCategory,
      Number(format3(outputWeight)),
      qty,
      workCategory,
      lotNo,
      workCategory,
      source,
      Number(processLot?.id || 0) || null,
      referenceStepId,
      companyId,
      userId
    ]
  );

  return {
    stockId: Number(insertResult.insertId || 0),
    alreadyMoved: false
  };
}

async function getNextProcessStepContext(connection, companyId, lotNo, workCategory = "REGULAR_SANKHA", excludeStepId = null) {
  const processLot = await getProcessLotForSteps(connection, companyId, lotNo, workCategory);
  if (!processLot) {
    return {
      ok: false,
      message: "Process lot must be saved before process-wise steps can be tracked"
    };
  }

  if (isManualProcessLot(processLot)) {
    return {
      ok: false,
      message: "Manual lots are not available in the process workflow yet",
      processLot
    };
  }

  const openStep = await getOpenProcessStep(connection, companyId, processLot.id, excludeStepId);
  if (openStep) {
    return {
      ok: false,
      message: "Previous process step is still OPEN. Complete it before starting the next step.",
      processLot,
      openStep
    };
  }

  const lastCompletedStep = await getLastCompletedProcessStep(connection, companyId, processLot.id);
  const [stepRows] = await connection.query(
    `
    SELECT COALESCE(MAX(step_no), 0) AS max_step_no
    FROM process_steps
    WHERE company_id = ? AND process_lot_id = ?
    `,
    [companyId, processLot.id]
  );
  const lastStepNo = Number(stepRows[0]?.max_step_no || 0);
  const nextStepNo = lastStepNo + 1;

  if (lastCompletedStep && Number(lastCompletedStep.step_no || 0) !== lastStepNo) {
    return {
      ok: false,
      message: "Process step ordering is inconsistent. Complete steps in sequence before adding a new step.",
      processLot,
      lastCompletedStep
    };
  }

  return {
    ok: true,
    processLot,
    lastCompletedStep,
    nextStepNo,
    inputWeight: lastCompletedStep ? toNumber(lastCompletedStep.output_weight) : toNumber(processLot.raw_weight),
    inputQty: lastCompletedStep ? toNumber(lastCompletedStep.output_qty) : toNumber(processLot.expected_total_qty),
    source: lastCompletedStep ? "PREVIOUS_PROCESS_OUTPUT" : "PROCESS_LOT_RAW_WEIGHT"
  };
}

app.get("/process/steps", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || req.query.lot);
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || "REGULAR_SANKHA");
    const params = [];
    const whereParts = [];

    if (companyId !== null) {
      whereParts.push("company_id = ?");
      params.push(companyId);
    }

    if (lotNo && companyId !== null) {
      const connection = await pool.getConnection();
      try {
        const processLot = await getProcessLotForSteps(connection, companyId, lotNo, workCategory);
        if (!processLot) {
          return res.json({
            success: true,
            steps: []
          });
        }
        whereParts.push("process_lot_id = ?");
        params.push(processLot.id);
      } finally {
        connection.release();
      }
    } else if (lotNo) {
      whereParts.push("lot_no = ?");
      params.push(lotNo);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT *
      FROM process_steps
      ${whereClause}
      ORDER BY lot_no ASC, step_no ASC, id ASC
      `,
      params
    );

    return res.json({
      success: true,
      steps: rows.map(normalizeProcessStepRow)
    });
  } catch (error) {
    console.error("Get process steps error:", error);
    return res.status(500).json({
      success: false,
      message: "Process steps fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/process/recovery-stock", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        product_name,
        category,
        weight,
        qty,
        lot_number,
        status,
        source,
        reference_step_id,
        company_id,
        created_by,
        created_at,
        updated_at
      FROM stock
      WHERE company_id = ?
        AND UPPER(COALESCE(category, '')) = 'RECOVERY'
        AND UPPER(COALESCE(source, '')) = 'PROCESS_RECOVERY'
        AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
        AND COALESCE(weight, 0) > 0
        AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      `,
      [access.companyScope]
    );

    return res.json({
      success: true,
      recoveryStock: rows.map((row) => ({
        ...row,
        weight: toNumber(row.weight),
        qty: toNumber(row.qty)
      }))
    });
  } catch (error) {
    console.error("Get process recovery stock error:", error);
    return res.status(500).json({
      success: false,
      message: "Process recovery stock fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/process/additive-issues", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || req.query.lot);
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || "REGULAR_SANKHA");
    const requestedMaterialType = normalizeAdditiveMaterialType(
      req.query.materialType ||
      req.query.material_type ||
      getAdditiveMaterialForStep(req.query.stepName || req.query.step_name || "")
    ) || "KDM";
    const params = [access.companyScope];
    const whereParts = ["pai.company_id = ?"];

    if (lotNo) {
      const connection = await pool.getConnection();
      try {
        const processLot = await getProcessLotForSteps(connection, access.companyScope, lotNo, workCategory);
        if (!processLot) {
          return res.json({
            success: true,
            lotNo,
            totalGiven: 0,
            totalReturned: 0,
            pendingWeight: 0,
            issues: []
          });
        }
        whereParts.push("ps.process_lot_id = ?");
        params.push(processLot.id);
      } finally {
        connection.release();
      }
    }

    whereParts.push("UPPER(COALESCE(pai.material_label, '')) LIKE ?");
    params.push(`%${requestedMaterialType}%`);

    const [rows] = await pool.query(
      `
      SELECT pai.*, ps.input_weight AS issue_step_input_weight
      FROM process_step_additive_issues pai
      LEFT JOIN process_steps ps
        ON ps.id = pai.process_step_id
       AND ps.company_id = pai.company_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY pai.issued_at DESC, pai.id DESC
      `,
      params
    );

    const issues = rows.map(normalizeAdditiveIssueRow);
    const totalGiven = issues.reduce((sum, issue) => sum + issue.givenWeight, 0);
    const totalReturned = issues.reduce((sum, issue) => sum + issue.returnedWeight, 0);
    const usedAdditiveWeight = Math.max(totalGiven - totalReturned, 0);
    const additiveStockItem = await findAdditiveStockItemForCompany(pool, access.companyScope, requestedMaterialType);
    const availableAdditiveStock = toNumber(additiveStockItem?.weight);

    return res.json({
      success: true,
      lotNo: lotNo || null,
      materialType: requestedMaterialType,
      materialLabel: requestedMaterialType,
      totalGiven,
      totalReturned,
      pendingWeight: usedAdditiveWeight,
      availableAdditiveStock,
      availableKdmStock: requestedMaterialType === "KDM" ? availableAdditiveStock : 0,
      usedAdditiveWeight,
      projectedAllowedOutput: toNumber(rows[0]?.issue_step_input_weight) + usedAdditiveWeight,
      issues
    });
  } catch (error) {
    console.error("Get process additive issues error:", error);
    return res.status(500).json({
      success: false,
      message: "Process additive issues fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/process/steps/:id/additive-issue", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const stepId = Number(req.params.id || 0);
    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no || req.body.lot);
    const workCategory = normalizeWorkCategory(req.body.workCategory || req.body.work_category || "REGULAR_SANKHA");
    const givenRaw = req.body.given_weight ?? req.body.givenWeight;
    const parsedGiven = parseRequiredNumber(givenRaw, "Additive material given weight");
    const karigarIdRaw = req.body.karigarId ?? req.body.karigar_id ?? null;
    const karigarId = karigarIdRaw === null || karigarIdRaw === undefined || karigarIdRaw === "" ? null : Number(karigarIdRaw);
    const karigarName = normalizeKarigarName(req.body.karigar || req.body.karigarName || req.body.karigar_name || "");
    const requestedMaterialLabel = String(req.body.materialLabel || req.body.material_label || req.body.additiveMaterialLabel || "").trim();
    const notes = String(req.body.notes || req.body.note || "").trim();

    if (!stepId) {
      return res.status(400).json({
        success: false,
        message: "Process step id is required"
      });
    }

    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "Lot No is required"
      });
    }

    if (!parsedGiven.ok || parsedGiven.value <= 0) {
      return res.status(400).json({
        success: false,
        message: parsedGiven.ok ? "Additive material given weight must be greater than zero" : parsedGiven.message
      });
    }

    if (karigarIdRaw !== null && karigarIdRaw !== undefined && karigarIdRaw !== "" && (!Number.isInteger(karigarId) || karigarId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Karigar id must be valid"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [stepRows] = await connection.query(
      `
      SELECT ps.*
      FROM process_steps ps
      JOIN process_lots pl
        ON pl.id = ps.process_lot_id
       AND pl.company_id = ps.company_id
      WHERE ps.id = ?
        AND ps.company_id = ?
        AND ps.lot_no = ?
        AND pl.work_category = ?
      LIMIT 1
      `,
      [stepId, access.companyScope, lotNo, workCategory]
    );

    if (!stepRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Process step not found for this lot"
      });
    }

    const step = normalizeProcessStepRow(stepRows[0]);
    const processLot = await getProcessLotById(connection, access.companyScope, step.process_lot_id);
    if (isManualProcessLot(processLot)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Manual lots are not available for additive material issue yet"
      });
    }

    const materialType =
      getAdditiveMaterialForStep(step.process_name || step.processName) ||
      normalizeAdditiveMaterialType(requestedMaterialLabel) ||
      "KDM";
    const materialLabel = materialType;
    const finalKarigarId = karigarId ?? step.karigar_id ?? null;
    const finalKarigarName = karigarName || step.karigar_name || "";
    const additiveStockItem = await findAdditiveStockItemForCompany(connection, access.companyScope, materialType, { forUpdate: true });
    const availableAdditiveStockBefore = toNumber(additiveStockItem?.weight);

    if (!additiveStockItem) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Only 0.000g ${materialType} available. ${parsedGiven.value.toFixed(3)}g shortage.`
      });
    }

    if (availableAdditiveStockBefore + 0.0005 < parsedGiven.value) {
      const shortage = parsedGiven.value - availableAdditiveStockBefore;
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Only ${availableAdditiveStockBefore.toFixed(3)}g ${materialType} available. ${shortage.toFixed(3)}g shortage.`
      });
    }

    const availableAdditiveStockAfter = Number(format3(availableAdditiveStockBefore - parsedGiven.value));

    const [insertResult] = await connection.query(
      `
      INSERT INTO process_step_additive_issues
      (
        company_id, process_step_id, lot_no, karigar_id, karigar_name,
        material_label, given_weight, returned_weight, used_weight, stock_item_id, status,
        issued_by, issued_at, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.000, 0.000, ?, 'ISSUED', ?, NOW(), ?)
      `,
      [
        access.companyScope,
        stepId,
        lotNo,
        finalKarigarId,
        finalKarigarName,
        materialLabel,
        parsedGiven.value,
        Number(additiveStockItem.id || 0),
        access.actingUserId,
        notes
      ]
    );

    await connection.query(
      `
      UPDATE stock
      SET weight = ?,
          updated_at = NOW()
      WHERE company_id = ?
        AND id = ?
      `,
      [availableAdditiveStockAfter, access.companyScope, additiveStockItem.id]
    );

    const issueStockMovementId = await createAdditiveStockMovement(connection, {
      companyId: access.companyScope,
      stockItemId: Number(additiveStockItem.id || 0),
      processStepId: stepId,
      additiveIssueId: insertResult.insertId,
      movementType: "ISSUE",
      weight: parsedGiven.value,
      beforeWeight: availableAdditiveStockBefore,
      afterWeight: availableAdditiveStockAfter,
      createdBy: access.actingUserId,
      notes: `${materialType} issue for lot ${lotNo}`
    });

    await connection.query(
      `
      UPDATE process_step_additive_issues
      SET issue_stock_movement_id = ?
      WHERE id = ?
        AND company_id = ?
      `,
      [issueStockMovementId, insertResult.insertId, access.companyScope]
    );

    const totals = await recalcProcessStepAdditiveTotals(connection, access.companyScope, stepId);

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_step_additive_issues
      WHERE id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `${materialType} issue saved`,
      issue: savedRows.length ? normalizeAdditiveIssueRow(savedRows[0]) : null,
      materialType,
      materialLabel,
      availableAdditiveStock: availableAdditiveStockAfter,
      availableKdmStock: materialType === "KDM" ? availableAdditiveStockAfter : 0,
      usedAdditiveWeight: totals.additiveUsedWeight,
      projectedAllowedOutput: toNumber(step.input_weight) + totals.additiveUsedWeight
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Save process additive issue error:", error);
    return res.status(500).json({
      success: false,
      message: "Process additive issue save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/process/additive-issues/:id/return", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const issueId = Number(req.params.id || 0);
    const returnedRaw = req.body.returned_weight ?? req.body.returnedWeight;
    const parsedReturned = parseRequiredNumber(returnedRaw, "Additive material returned weight");
    const notesProvided = req.body.notes !== undefined || req.body.note !== undefined;
    const notes = String(req.body.notes ?? req.body.note ?? "").trim();

    if (!issueId) {
      return res.status(400).json({
        success: false,
        message: "Additive issue id is required"
      });
    }

    if (!parsedReturned.ok) {
      return res.status(400).json({
        success: false,
        message: parsedReturned.message
      });
    }

    const returnedWeight = parsedReturned.value;
    if (returnedWeight < 0) {
      return res.status(400).json({
        success: false,
        message: "Additive material returned weight cannot be negative"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [issueRows] = await connection.query(
      `
      SELECT *
      FROM process_step_additive_issues
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [issueId, access.companyScope]
    );

    if (!issueRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Additive material issue not found"
      });
    }

    const issue = normalizeAdditiveIssueRow(issueRows[0]);
    const materialType = normalizeAdditiveMaterialType(issue.materialLabel) || "KDM";
    const [issueLotRows] = await connection.query(
      `
      SELECT pl.*, ps.input_weight AS issue_step_input_weight
      FROM process_steps ps
      JOIN process_lots pl
        ON pl.id = ps.process_lot_id
       AND pl.company_id = ps.company_id
      WHERE ps.company_id = ?
        AND ps.id = ?
      LIMIT 1
      `,
      [access.companyScope, issue.process_step_id]
    );
    const processLot = issueLotRows.length ? normalizeProcessLotRow(issueLotRows[0]) : null;
    const issueStepInputWeight = toNumber(issueLotRows[0]?.issue_step_input_weight);
    if (isManualProcessLot(processLot)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Manual lots are not available for additive material return yet"
      });
    }

    if (returnedWeight > issue.givenWeight) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `${materialType} returned weight cannot be greater than given weight`
      });
    }

    const [stepIssueRows] = await connection.query(
      `
      SELECT id, given_weight, returned_weight
      FROM process_step_additive_issues
      WHERE company_id = ?
        AND process_step_id = ?
      FOR UPDATE
      `,
      [access.companyScope, issue.process_step_id]
    );

    const totalGiven = stepIssueRows.reduce((sum, row) => sum + toNumber(row.given_weight), 0);
    const totalReturned = stepIssueRows.reduce((sum, row) => {
      return sum + (Number(row.id) === issueId ? returnedWeight : toNumber(row.returned_weight));
    }, 0);

    if (totalReturned > totalGiven) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Total returned ${materialType} cannot exceed total given ${materialType}`
      });
    }

    let additiveStockItem = issue.stockItemId
      ? await getAdditiveStockItemById(connection, access.companyScope, issue.stockItemId, materialType, { forUpdate: true })
      : null;
    if (!additiveStockItem) {
      additiveStockItem = await findAdditiveStockItemForCompany(connection, access.companyScope, materialType, { forUpdate: true });
    }

    if (!additiveStockItem) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `${materialType} stock item not found`
      });
    }

    const previousReturnedWeight = toNumber(issue.returnedWeight);
    const returnDelta = returnedWeight - previousReturnedWeight;
    const availableAdditiveStockBefore = toNumber(additiveStockItem.weight);
    const availableAdditiveStockAfter = Number(format3(availableAdditiveStockBefore + returnDelta));

    if (availableAdditiveStockAfter < -0.0005) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `${materialType} stock cannot go below zero`
      });
    }

    let returnStockMovementId = issue.returnStockMovementId || null;
    if (Math.abs(returnDelta) > 0.0005) {
      await connection.query(
        `
        UPDATE stock
        SET weight = ?,
            updated_at = NOW()
        WHERE company_id = ?
          AND id = ?
        `,
        [Math.max(availableAdditiveStockAfter, 0), access.companyScope, additiveStockItem.id]
      );

      returnStockMovementId = await createAdditiveStockMovement(connection, {
        companyId: access.companyScope,
        stockItemId: Number(additiveStockItem.id || 0),
        processStepId: issue.process_step_id,
        additiveIssueId: issueId,
        movementType: returnDelta >= 0 ? "RETURN" : "RETURN_ADJUSTMENT",
        weight: Math.abs(returnDelta),
        beforeWeight: availableAdditiveStockBefore,
        afterWeight: Math.max(availableAdditiveStockAfter, 0),
        createdBy: access.actingUserId,
        notes: `${materialType} return for lot ${issue.lotNo || ""}`
      });
    }

    const usedWeight = issue.givenWeight - returnedWeight;
    const nextStatus = returnedWeight > 0 ? "RETURNED" : "ISSUED";
    await connection.query(
      `
      UPDATE process_step_additive_issues
      SET returned_weight = ?,
          used_weight = ?,
          stock_item_id = COALESCE(stock_item_id, ?),
          return_stock_movement_id = ?,
          status = ?,
          returned_by = ?,
          returned_at = ?,
          notes = CASE WHEN ? THEN ? ELSE notes END
      WHERE id = ?
        AND company_id = ?
      `,
      [
        returnedWeight,
        usedWeight,
        Number(additiveStockItem.id || 0),
        returnStockMovementId,
        nextStatus,
        returnedWeight > 0 ? access.actingUserId : null,
        returnedWeight > 0 ? new Date() : null,
        notesProvided ? 1 : 0,
        notes,
        issueId,
        access.companyScope
      ]
    );

    const totals = await recalcProcessStepAdditiveTotals(connection, access.companyScope, issue.process_step_id);

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_step_additive_issues
      WHERE id = ?
      LIMIT 1
      `,
      [issueId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `${materialType} return saved`,
      issue: savedRows.length ? normalizeAdditiveIssueRow(savedRows[0]) : null,
      totals,
      materialType,
      materialLabel: materialType,
      availableAdditiveStock: Math.max(availableAdditiveStockAfter, 0),
      availableKdmStock: materialType === "KDM" ? Math.max(availableAdditiveStockAfter, 0) : 0,
      usedAdditiveWeight: totals.additiveUsedWeight,
      projectedAllowedOutput: issueStepInputWeight + totals.additiveUsedWeight
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Return process additive issue error:", error);
    return res.status(500).json({
      success: false,
      message: "Process additive issue return failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/process/material-issues", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no || req.body.lot);
    const requestedWorkCategory = req.body.workCategory ?? req.body.work_category;
    const rawMaterialType = String(req.body.materialType || req.body.material_type || req.body.materialLabel || req.body.material_label || "").trim();
    const materialType = rawMaterialType ? normalizeMaterialType(rawMaterialType) : "";
    const givenRaw = req.body.givenWeight ?? req.body.given_weight;
    const parsedGiven = parseRequiredNumber(givenRaw, "Material given weight");
    const karigarIdRaw = req.body.karigarId ?? req.body.karigar_id ?? null;
    const karigarId = karigarIdRaw === null || karigarIdRaw === undefined || karigarIdRaw === "" ? null : Number(karigarIdRaw);
    const karigarName = normalizeKarigarName(req.body.karigarName || req.body.karigar_name || req.body.karigar || "");
    const notes = String(req.body.notes || req.body.note || "").trim();

    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "Lot No is required"
      });
    }

    if (!materialType) {
      return res.status(400).json({
        success: false,
        message: "Material type is required"
      });
    }

    if (!parsedGiven.ok || parsedGiven.value <= 0) {
      return res.status(400).json({
        success: false,
        message: parsedGiven.ok ? "Material given weight must be greater than zero" : parsedGiven.message
      });
    }

    if (karigarIdRaw !== null && karigarIdRaw !== undefined && karigarIdRaw !== "" && (!Number.isInteger(karigarId) || karigarId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Karigar id must be valid"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const requestedLotCategory = normalizeWorkCategory(requestedWorkCategory || "REGULAR_SANKHA");
    const processLot = await getProcessLotForSteps(connection, access.companyScope, lotNo, requestedLotCategory);
    if (!processLot) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Process lot not found for this company"
      });
    }

    const workCategory = normalizeWorkCategory(requestedWorkCategory || processLot.work_category || processLot.workCategory);

    const [insertResult] = await connection.query(
      `
      INSERT INTO process_material_issues
      (
        company_id, lot_no, work_category, process_step_id, material_type,
        given_weight, returned_weight, used_weight, karigar_id, karigar_name,
        status, issued_by, issued_at, notes
      )
      VALUES (?, ?, ?, NULL, ?, ?, 0.000, 0.000, ?, ?, 'ISSUED', ?, NOW(), ?)
      `,
      [
        access.companyScope,
        lotNo,
        workCategory,
        materialType,
        parsedGiven.value,
        karigarId,
        karigarName,
        access.actingUserId,
        notes
      ]
    );

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_material_issues
      WHERE id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Material issue saved",
      issue: savedRows.length ? normalizeProcessMaterialIssueRow(savedRows[0]) : null
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Save process material issue error:", error);
    return res.status(500).json({
      success: false,
      message: "Process material issue save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/process/material-issues", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || req.query.lot);
    const materialTypeRaw = req.query.materialType || req.query.material_type || "";
    const materialType = String(materialTypeRaw || "").trim() ? normalizeMaterialType(materialTypeRaw) : "";
    const workCategoryRaw = req.query.workCategory || req.query.work_category || "";
    const workCategory = String(workCategoryRaw || "").trim() ? normalizeWorkCategory(workCategoryRaw) : "";
    const params = [access.companyScope];
    const whereParts = ["company_id = ?"];

    if (lotNo) {
      whereParts.push("lot_no = ?");
      params.push(lotNo);
    }

    if (materialType) {
      whereParts.push("material_type = ?");
      params.push(materialType);
    }

    if (workCategory) {
      whereParts.push("work_category = ?");
      params.push(workCategory);
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM process_material_issues
      WHERE ${whereParts.join(" AND ")}
      ORDER BY issued_at DESC, id DESC
      `,
      params
    );

    const issues = rows.map(normalizeProcessMaterialIssueRow);
    const totalGiven = issues.reduce((sum, issue) => sum + issue.givenWeight, 0);
    const totalReturned = issues.reduce((sum, issue) => sum + issue.returnedWeight, 0);
    const totalUsed = issues.reduce((sum, issue) => sum + issue.usedWeight, 0);

    return res.json({
      success: true,
      lotNo: lotNo || null,
      materialType: materialType || null,
      workCategory: workCategory || null,
      totalGiven,
      totalReturned,
      totalUsed,
      pendingWeight: Math.max(totalGiven - totalReturned, 0),
      issues
    });
  } catch (error) {
    console.error("Get process material issues error:", error);
    return res.status(500).json({
      success: false,
      message: "Process material issues fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/process/outside-karigar-ledger", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || req.query.lot);
    const workCategoryRaw = req.query.workCategory || req.query.work_category || "";
    const workCategory = String(workCategoryRaw || "").trim() ? normalizeWorkCategory(workCategoryRaw) : "";
    const status = String(req.query.status || "").trim().toUpperCase();

    if (workCategory && !isOutsideKarigarCategory(workCategory)) {
      return res.json({
        success: true,
        ledger: []
      });
    }

    const params = [access.companyScope];
    const whereParts = [
      "company_id = ?",
      "work_category IN ('JALI_SANKHA', 'MANGALSUTRA')"
    ];

    if (lotNo) {
      whereParts.push("lot_no = ?");
      params.push(lotNo);
    }

    if (workCategory && isOutsideKarigarCategory(workCategory)) {
      whereParts.push("work_category = ?");
      params.push(workCategory);
    }

    if (status) {
      whereParts.push("UPPER(COALESCE(status, '')) = ?");
      params.push(status);
    }

    const [rows] = await pool.query(
      `
      SELECT
        lot_no,
        work_category,
        karigar_name,
        issue_weight,
        receive_weight,
        pending_weight,
        status,
        issue_date,
        receive_date
      FROM outside_karigar_ledger
      WHERE ${whereParts.join(" AND ")}
      ORDER BY
        COALESCE(issue_date, created_at) DESC,
        id DESC
      `,
      params
    );

    return res.json({
      success: true,
      ledger: rows.map((row) => ({
        lot_no: String(row.lot_no || ""),
        work_category: normalizeWorkCategory(row.work_category),
        karigar_name: String(row.karigar_name || ""),
        issue_weight: toNumber(row.issue_weight),
        receive_weight: toNumber(row.receive_weight),
        pending_weight: toNumber(row.pending_weight),
        status: String(row.status || "ISSUED").trim().toUpperCase(),
        issue_date: row.issue_date || null,
        receive_date: row.receive_date || null
      }))
    });
  } catch (error) {
    console.error("Get outside karigar ledger error:", error);
    return res.status(500).json({
      success: false,
      message: "Outside karigar ledger fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/process/material-issues/:id/return", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const issueId = Number(req.params.id || 0);
    const returnedRaw = req.body.returnedWeight ?? req.body.returned_weight;
    const parsedReturned = parseRequiredNumber(returnedRaw, "Material returned weight");
    const notesProvided = req.body.notes !== undefined || req.body.note !== undefined;
    const notes = String(req.body.notes ?? req.body.note ?? "").trim();

    if (!issueId) {
      return res.status(400).json({
        success: false,
        message: "Material issue id is required"
      });
    }

    if (!parsedReturned.ok) {
      return res.status(400).json({
        success: false,
        message: parsedReturned.message
      });
    }

    const returnedWeight = parsedReturned.value;
    if (returnedWeight < 0) {
      return res.status(400).json({
        success: false,
        message: "Material returned weight cannot be negative"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [issueRows] = await connection.query(
      `
      SELECT *
      FROM process_material_issues
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [issueId, access.companyScope]
    );

    if (!issueRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Material issue not found"
      });
    }

    const issue = normalizeProcessMaterialIssueRow(issueRows[0]);
    if (returnedWeight > issue.givenWeight) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Material returned weight cannot be greater than given weight"
      });
    }

    const usedWeight = Math.max(issue.givenWeight - returnedWeight, 0);
    const nextStatus =
      returnedWeight <= 0
        ? "ISSUED"
        : returnedWeight >= issue.givenWeight
          ? "RETURNED"
          : "PARTIAL_RETURN";

    await connection.query(
      `
      UPDATE process_material_issues
      SET returned_weight = ?,
          used_weight = ?,
          status = ?,
          returned_by = ?,
          returned_at = ?,
          notes = CASE WHEN ? THEN ? ELSE notes END
      WHERE id = ?
        AND company_id = ?
      `,
      [
        returnedWeight,
        usedWeight,
        nextStatus,
        returnedWeight > 0 ? access.actingUserId : null,
        returnedWeight > 0 ? new Date() : null,
        notesProvided ? 1 : 0,
        notes,
        issueId,
        access.companyScope
      ]
    );

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_material_issues
      WHERE id = ?
      LIMIT 1
      `,
      [issueId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Material return saved",
      issue: savedRows.length ? normalizeProcessMaterialIssueRow(savedRows[0]) : null
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Return process material issue error:", error);
    return res.status(500).json({
      success: false,
      message: "Process material issue return failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/process/next-input", authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || req.query.lot);
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || "REGULAR_SANKHA");
    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "lotNo is required"
      });
    }

    const context = await getNextProcessStepContext(connection, access.companyScope, lotNo, workCategory);
    return res.status(context.ok ? 200 : 400).json({
      success: context.ok,
      message: context.ok ? "Next process input resolved" : context.message,
      lotNo,
      processLot: context.processLot || null,
      openStep: context.openStep || null,
      lastCompletedStep: context.lastCompletedStep || null,
      nextStepNo: context.nextStepNo || null,
      inputWeight: context.inputWeight ?? null,
      inputQty: context.inputQty ?? 0,
      source: context.source || ""
    });
  } catch (error) {
    console.error("Get process next input error:", error);
    return res.status(500).json({
      success: false,
      message: "Process next input fetch failed",
      error: getErrorDetail(error)
    });
  } finally {
    connection.release();
  }
});

app.post("/process/steps", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const userId = access.actingUserId;
    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no || req.body.lot);
    const workCategory = normalizeWorkCategory(req.body.workCategory || req.body.work_category || "REGULAR_SANKHA");
    const processName = normalizeProcessName(req.body.processName || req.body.process_name || "");
    const karigarIdRaw = req.body.karigarId ?? req.body.karigar_id ?? null;
    const karigarId = karigarIdRaw === null || karigarIdRaw === undefined || karigarIdRaw === "" ? null : Number(karigarIdRaw);
    const karigarName = normalizeKarigarName(req.body.karigarName || req.body.karigar_name || "");
    const outputWeightRaw = req.body.outputWeight ?? req.body.output_weight;
    const outputProvided = hasProvidedValue(outputWeightRaw);
    const recoveryWeightRaw = req.body.recoveryWeight ?? req.body.recovery_weight;
    const recoveryProvided = hasProvidedValue(recoveryWeightRaw);
    const inputQtyRaw = req.body.inputQty ?? req.body.input_qty;
    const inputQtyProvided = hasProvidedValue(inputQtyRaw);
    const outputQtyRaw = req.body.outputQty ?? req.body.output_qty;
    const outputQtyProvided = hasProvidedValue(outputQtyRaw);
    const lossReason = String(req.body.lossReason || req.body.loss_reason || "").trim();
    const requestedStatus = normalizeProcessStepStatus(req.body.status || (outputProvided ? "COMPLETED" : "OPEN"));
    const recoveryStockIdsRaw = req.body.recoveryStockIds ?? req.body.recovery_stock_ids ?? [];

    if (!lotNo || !processName) {
      return res.status(400).json({
        success: false,
        message: "Lot number and process name are required"
      });
    }

    if (!Array.isArray(recoveryStockIdsRaw)) {
      return res.status(400).json({
        success: false,
        message: "recoveryStockIds must be an array"
      });
    }

    const recoveryStockIds = [...new Set(
      recoveryStockIdsRaw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (recoveryStockIds.length !== recoveryStockIdsRaw.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid recovery stock selection"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const context = await getNextProcessStepContext(connection, companyId, lotNo, workCategory);
    if (!context.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: context.message,
        openStep: context.openStep || null
      });
    }

    let selectedRecoveryRows = [];
    let selectedRecoveryWeight = 0;
    if (recoveryStockIds.length) {
      const placeholders = recoveryStockIds.map(() => "?").join(", ");
      const [stockRows] = await connection.query(
        `
        SELECT
          id,
          category,
          source,
          status,
          weight,
          company_id,
          used_in_process_step_id
        FROM stock
        WHERE company_id = ?
          AND id IN (${placeholders})
        FOR UPDATE
        `,
        [companyId, ...recoveryStockIds]
      );

      if (stockRows.length !== recoveryStockIds.length) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "One or more selected recovery stock items are unavailable for this company"
        });
      }

      const alreadyUsedRow = stockRows.find((row) => {
        return (
          String(row.status || "").trim().toUpperCase() !== "IN_STOCK" ||
          row.used_in_process_step_id
        );
      });

      if (alreadyUsedRow) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Selected recovery stock has already been used"
        });
      }

      const invalidRecoveryRow = stockRows.find((row) => {
        return (
          String(row.category || "").trim().toUpperCase() !== "RECOVERY" ||
          String(row.source || "").trim().toUpperCase() !== "PROCESS_RECOVERY" ||
          toNumber(row.weight) <= 0
        );
      });

      if (invalidRecoveryRow) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Selected stock must be unused process recovery stock"
        });
      }

      selectedRecoveryRows = stockRows;
      selectedRecoveryWeight = selectedRecoveryRows.reduce((sum, row) => sum + toNumber(row.weight), 0);
    }

    const effectiveInputWeight = toNumber(context.inputWeight) + selectedRecoveryWeight;
    const additivePayload = parseAdditiveMaterialPayload(req.body);
    if (!additivePayload.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: additivePayload.message
      });
    }
    const additiveGivenWeight = additivePayload.givenWeight;
    const additiveReturnedWeight = additivePayload.returnedWeight;
    const additiveUsedWeight = additivePayload.usedWeight;
    const additiveMaterialLabel = additivePayload.materialLabel;
    const allowedInputWeight = effectiveInputWeight + additiveUsedWeight;

    if (effectiveInputWeight <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Input weight must be greater than zero"
      });
    }

    let outputWeight = 0;
    if (requestedStatus === "COMPLETED") {
      const parsedOutputWeight = parseRequiredNumber(outputWeightRaw, "Output weight");
      if (!parsedOutputWeight.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedOutputWeight.message
        });
      }
      outputWeight = parsedOutputWeight.value;
    } else if (outputProvided) {
      const parsedOutputWeight = parseOptionalNumber(outputWeightRaw, "Output weight");
      if (!parsedOutputWeight.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedOutputWeight.message
        });
      }
      outputWeight = parsedOutputWeight.value;
    }

    if (outputWeight < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output weight cannot be negative"
      });
    }

    if (requestedStatus === "COMPLETED" && outputWeight > allowedInputWeight) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output weight cannot be greater than input weight plus additive material used weight"
      });
    }

    let recoveryWeight = 0;
    if (recoveryProvided) {
      const parsedRecoveryWeight = parseOptionalNumber(recoveryWeightRaw, "Recovery weight");
      if (!parsedRecoveryWeight.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedRecoveryWeight.message
        });
      }
      recoveryWeight = parsedRecoveryWeight.value;
    }

    if (recoveryWeight < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Recovery weight cannot be negative"
      });
    }

    if (requestedStatus === "COMPLETED" && outputWeight + recoveryWeight > allowedInputWeight) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output weight plus recovery weight cannot be greater than input weight plus additive material used weight"
      });
    }

    let requestedInputQty = context.inputQty;
    if (!context.lastCompletedStep && inputQtyProvided) {
      const parsedInputQty = parseRequiredNumber(inputQtyRaw, "Input quantity");
      if (!parsedInputQty.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedInputQty.message
        });
      }
      requestedInputQty = parsedInputQty.value;
    }

    const inputQty = context.lastCompletedStep ? context.inputQty : requestedInputQty;
    if (inputQty < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Input quantity cannot be negative"
      });
    }

    let outputQty = 0;
    if (requestedStatus === "COMPLETED" && inputQty > 0 && !outputQtyProvided) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity is required when input quantity is entered"
      });
    }

    if (outputQtyProvided) {
      const parsedOutputQty = parseRequiredNumber(outputQtyRaw, "Output quantity");
      if (!parsedOutputQty.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedOutputQty.message
        });
      }
      outputQty = parsedOutputQty.value;
    }

    if (outputQty < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity cannot be negative"
      });
    }

    if (requestedStatus === "COMPLETED" && outputQty > inputQty) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity cannot be greater than input quantity"
      });
    }

    const finalStatus = requestedStatus === "OPEN" ? "OPEN" : "COMPLETED";
    const finalOutputWeight = finalStatus === "COMPLETED" ? outputWeight : 0;
    const finalRecoveryWeight = finalStatus === "COMPLETED" ? recoveryWeight : 0;
    const lossWeight = finalStatus === "COMPLETED" ? allowedInputWeight - finalOutputWeight - finalRecoveryWeight : 0;
    const finalOutputQty = finalStatus === "COMPLETED" ? outputQty : 0;
    const lossQty = finalStatus === "COMPLETED" ? inputQty - finalOutputQty : 0;
    const warnings = [];

    if (lossWeight < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Loss weight cannot be negative"
      });
    }

    console.log("[PROCESS_STEP_SAVE]", {
      inputWeight: effectiveInputWeight,
      baseInputWeight: context.inputWeight,
      recoveryInputWeight: selectedRecoveryWeight,
      additiveGivenWeight,
      additiveReturnedWeight,
      additiveUsedWeight,
      outputWeight: finalOutputWeight,
      recoveryWeight: finalRecoveryWeight,
      lossWeight
    });

    if (finalStatus === "COMPLETED" && inputQty > 0 && (lossQty / inputQty) > 0.05) {
      warnings.push("Quantity loss is above 5% for this process step");
    }

    const [insertResult] = await connection.query(
      `
      INSERT INTO process_steps
      (
        company_id, process_lot_id, lot_no, step_no, process_name,
        karigar_id, karigar_name, input_weight, output_weight, recovery_weight, loss_weight,
        additive_given_weight, additive_returned_weight, additive_used_weight, additive_material_label,
        input_qty, output_qty, loss_qty, loss_reason, status, started_at, completed_at, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `,
      [
        companyId,
        context.processLot.id,
        lotNo,
        context.nextStepNo,
        processName,
        karigarId,
        karigarName,
        effectiveInputWeight,
        finalOutputWeight,
        finalRecoveryWeight,
        lossWeight,
        additiveGivenWeight,
        additiveReturnedWeight,
        additiveUsedWeight,
        additiveMaterialLabel,
        inputQty,
        finalOutputQty,
        lossQty,
        lossReason,
        finalStatus,
        finalStatus === "COMPLETED" ? new Date() : null,
        userId
      ]
    );

    for (const recoveryRow of selectedRecoveryRows) {
      try {
        await connection.query(
          `
          INSERT INTO process_step_recovery_inputs
          (
            company_id,
            process_step_id,
            stock_id,
            weight,
            created_by,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, NOW())
          `,
          [
            companyId,
            insertResult.insertId,
            recoveryRow.id,
            toNumber(recoveryRow.weight),
            userId
          ]
        );
      } catch (insertError) {
        if (insertError?.code === "ER_DUP_ENTRY") {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Selected recovery stock has already been used"
          });
        }
        throw insertError;
      }
    }

    if (selectedRecoveryRows.length) {
      const placeholders = selectedRecoveryRows.map(() => "?").join(", ");
      const [updateResult] = await connection.query(
        `
        UPDATE stock
        SET status = 'USED',
            used_in_process_step_id = ?,
            used_at = NOW(),
            used_by = ?
        WHERE company_id = ?
          AND id IN (${placeholders})
          AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
        `,
        [insertResult.insertId, userId, companyId, ...selectedRecoveryRows.map((row) => row.id)]
      );

      if (updateResult.affectedRows !== selectedRecoveryRows.length) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Selected recovery stock has already been used"
        });
      }
    }

    await ensureProcessRecoveryStockEntry(connection, {
      companyId,
      createdBy: userId,
      lotNo,
      stepId: insertResult.insertId,
      recoveryWeight: finalRecoveryWeight
    });

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_steps
      WHERE id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    if (finalStatus === "COMPLETED" && savedRows.length) {
      await syncOutsideKarigarLedgerForStep(connection, savedRows[0], {
        companyScope: companyId,
        actingUserId: userId
      });
    }

    await connection.commit();

    return res.json({
      success: true,
      message: finalStatus === "COMPLETED" ? "Process step completed successfully" : "Process step saved as open",
      step: savedRows.length ? normalizeProcessStepRow(savedRows[0]) : null,
      warnings
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Save process step error:", error);
    return res.status(500).json({
      success: false,
      message: "Process step save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/process/steps/:id/complete", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const stepId = Number(req.params.id || 0);
    const outputWeightRaw = req.body.outputWeight ?? req.body.output_weight;
    const parsedOutputWeight = parseRequiredNumber(outputWeightRaw, "Output weight");
    const recoveryWeightRaw = req.body.recoveryWeight ?? req.body.recovery_weight;
    const recoveryProvided = hasProvidedValue(recoveryWeightRaw);
    const outputQtyRaw = req.body.outputQty ?? req.body.output_qty;
    const outputQtyProvided = hasProvidedValue(outputQtyRaw);
    const lossReason = String(req.body.lossReason || req.body.loss_reason || "").trim();
    const additivePayload = parseAdditiveMaterialPayload(req.body);

    if (!stepId) {
      return res.status(400).json({
        success: false,
        message: "Process step id is required"
      });
    }

    if (!parsedOutputWeight.ok) {
      return res.status(400).json({
        success: false,
        message: parsedOutputWeight.message
      });
    }

    if (!additivePayload.ok) {
      return res.status(400).json({
        success: false,
        message: additivePayload.message
      });
    }

    const outputWeight = parsedOutputWeight.value;
    if (outputWeight < 0) {
      return res.status(400).json({
        success: false,
        message: "Output weight cannot be negative"
      });
    }

    let recoveryWeight = 0;
    if (recoveryProvided) {
      const parsedRecoveryWeight = parseOptionalNumber(recoveryWeightRaw, "Recovery weight");
      if (!parsedRecoveryWeight.ok) {
        return res.status(400).json({
          success: false,
          message: parsedRecoveryWeight.message
        });
      }
      recoveryWeight = parsedRecoveryWeight.value;
    }

    if (recoveryWeight < 0) {
      return res.status(400).json({
        success: false,
        message: "Recovery weight cannot be negative"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [stepRows] = await connection.query(
      `
      SELECT *
      FROM process_steps
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [stepId, access.companyScope]
    );

    if (!stepRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Process step not found"
      });
    }

    const step = normalizeProcessStepRow(stepRows[0]);
    const processLot = await getProcessLotById(connection, access.companyScope, step.process_lot_id);
    if (isManualProcessLot(processLot)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Manual lots are not available in the process workflow yet"
      });
    }

    if (step.status !== "OPEN") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only OPEN process steps can be completed"
      });
    }

    if (step.input_weight <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Input weight must be greater than zero"
      });
    }

    const issueTotals = await recalcProcessStepAdditiveTotals(connection, access.companyScope, stepId, {
      forUpdate: true
    });
    const hasIssueLedger = issueTotals.issueCount > 0;

    const additiveGivenWeight = hasIssueLedger ? issueTotals.additiveGivenWeight : additivePayload.givenWeight;
    const additiveReturnedWeight = hasIssueLedger ? issueTotals.additiveReturnedWeight : additivePayload.returnedWeight;
    const additiveUsedWeight = hasIssueLedger ? issueTotals.additiveUsedWeight : additivePayload.usedWeight;
    const additiveMaterialLabel = hasIssueLedger
      ? (issueTotals.additiveMaterialLabel || additivePayload.materialLabel)
      : additivePayload.materialLabel;
    const allowedInputWeight = step.input_weight + additiveUsedWeight;

    if (outputWeight + recoveryWeight > allowedInputWeight) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output weight plus recovery weight cannot be greater than input weight plus additive material used weight"
      });
    }

    let outputQty = 0;
    if (step.input_qty > 0 && !outputQtyProvided) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity is required when input quantity is entered"
      });
    }

    if (step.input_qty < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Input quantity cannot be negative"
      });
    }

    if (outputQtyProvided) {
      const parsedOutputQty = parseRequiredNumber(outputQtyRaw, "Output quantity");
      if (!parsedOutputQty.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: parsedOutputQty.message
        });
      }
      outputQty = parsedOutputQty.value;
    }

    if (outputQty < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity cannot be negative"
      });
    }

    if (outputQty > step.input_qty) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Output quantity cannot be greater than input quantity"
      });
    }

    const lossWeight = allowedInputWeight - outputWeight - recoveryWeight;
    const lossQty = step.input_qty - outputQty;
    const warnings = [];

    if (lossWeight < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Loss weight cannot be negative"
      });
    }

    console.log("[PROCESS_STEP_COMPLETE]", {
      inputWeight: step.input_weight,
      additiveGivenWeight,
      additiveReturnedWeight,
      additiveUsedWeight,
      outputWeight,
      recoveryWeight,
      lossWeight
    });

    if (step.input_qty > 0 && (lossQty / step.input_qty) > 0.05) {
      warnings.push("Quantity loss is above 5% for this process step");
    }

    await connection.query(
      `
      UPDATE process_steps
      SET output_weight = ?,
          recovery_weight = ?,
          loss_weight = ?,
          additive_given_weight = ?,
          additive_returned_weight = ?,
          additive_used_weight = ?,
          additive_material_label = ?,
          output_qty = ?,
          loss_qty = ?,
          loss_reason = ?,
          status = 'COMPLETED',
          completed_at = NOW()
      WHERE id = ?
      `,
      [
        outputWeight,
        recoveryWeight,
        lossWeight,
        additiveGivenWeight,
        additiveReturnedWeight,
        additiveUsedWeight,
        additiveMaterialLabel,
        outputQty,
        lossQty,
        lossReason || step.loss_reason || "",
        stepId
      ]
    );

    await ensureProcessRecoveryStockEntry(connection, {
      companyId: access.companyScope,
      createdBy: access.actingUserId,
      lotNo: step.lot_no,
      stepId,
      recoveryWeight
    });

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_steps
      WHERE id = ?
      LIMIT 1
      `,
      [stepId]
    );

    if (savedRows.length) {
      await syncOutsideKarigarLedgerForStep(connection, savedRows[0], {
        companyScope: access.companyScope,
        actingUserId: access.actingUserId
      });
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Process step completed successfully",
      step: savedRows.length ? normalizeProcessStepRow(savedRows[0]) : null,
      warnings
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Complete process step error:", error);
    return res.status(500).json({
      success: false,
      message: "Process step completion failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/process/loss-summary", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const lotNo = normalizeProcessLotNo(req.query.lotNo || req.query.lot_no || "");
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || "REGULAR_SANKHA");
    const karigarId = Number(req.query.karigarId || req.query.karigar_id || 0);
    const fromDate = String(req.query.fromDate || req.query.from_date || "").trim();
    const toDate = String(req.query.toDate || req.query.to_date || "").trim();
    const params = [];
    const whereParts = ["status = 'COMPLETED'"];

    if (companyId !== null) {
      whereParts.push("company_id = ?");
      params.push(companyId);
    }
    if (lotNo && companyId !== null) {
      const connection = await pool.getConnection();
      try {
        const processLot = await getProcessLotForSteps(connection, companyId, lotNo, workCategory);
        if (!processLot) {
          return res.json({
            success: true,
            lotSummary: [],
            karigarSummary: [],
            processSummary: []
          });
        }
        whereParts.push("process_lot_id = ?");
        params.push(processLot.id);
      } finally {
        connection.release();
      }
    } else if (lotNo) {
      whereParts.push("lot_no = ?");
      params.push(lotNo);
    }
    if (karigarId) {
      whereParts.push("karigar_id = ?");
      params.push(karigarId);
    }
    if (fromDate) {
      whereParts.push("DATE(COALESCE(completed_at, created_at)) >= ?");
      params.push(fromDate);
    }
    if (toDate) {
      whereParts.push("DATE(COALESCE(completed_at, created_at)) <= ?");
      params.push(toDate);
    }

    const whereClause = `WHERE ${whereParts.join(" AND ")}`;
    const [lotSummary] = await pool.query(
      `
      SELECT process_lot_id, lot_no, COUNT(*) AS step_count, COALESCE(SUM(input_weight), 0) AS total_input,
        COALESCE(SUM(output_weight), 0) AS total_output, COALESCE(SUM(loss_weight), 0) AS total_loss,
        COALESCE(SUM(input_qty), 0) AS total_input_qty,
        COALESCE(SUM(output_qty), 0) AS total_output_qty,
        COALESCE(SUM(loss_qty), 0) AS total_loss_qty
      FROM process_steps
      ${whereClause}
      GROUP BY process_lot_id, lot_no
      ORDER BY lot_no ASC
      `,
      params
    );
    const [karigarSummary] = await pool.query(
      `
      SELECT COALESCE(karigar_id, 0) AS karigar_id, COALESCE(NULLIF(karigar_name, ''), 'Unassigned') AS karigar_name,
        COUNT(*) AS step_count, COALESCE(SUM(input_weight), 0) AS total_input,
        COALESCE(SUM(output_weight), 0) AS total_output, COALESCE(SUM(loss_weight), 0) AS total_loss,
        COALESCE(SUM(input_qty), 0) AS total_input_qty,
        COALESCE(SUM(output_qty), 0) AS total_output_qty,
        COALESCE(SUM(loss_qty), 0) AS total_loss_qty
      FROM process_steps
      ${whereClause}
      GROUP BY COALESCE(karigar_id, 0), COALESCE(NULLIF(karigar_name, ''), 'Unassigned')
      ORDER BY karigar_name ASC
      `,
      params
    );
    const [processSummary] = await pool.query(
      `
      SELECT process_name, COUNT(*) AS step_count, COALESCE(SUM(input_weight), 0) AS total_input,
        COALESCE(SUM(output_weight), 0) AS total_output, COALESCE(SUM(loss_weight), 0) AS total_loss,
        COALESCE(SUM(input_qty), 0) AS total_input_qty,
        COALESCE(SUM(output_qty), 0) AS total_output_qty,
        COALESCE(SUM(loss_qty), 0) AS total_loss_qty
      FROM process_steps
      ${whereClause}
      GROUP BY process_name
      ORDER BY process_name ASC
      `,
      params
    );

    return res.json({
      success: true,
      lotSummary,
      karigarSummary,
      processSummary
    });
  } catch (error) {
    console.error("Get process loss summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Process loss summary fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/process/lots", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const userId = access.actingUserId;
    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no);
    const workCategory = normalizeWorkCategory(req.body.workCategory ?? req.body.work_category ?? "REGULAR_SANKHA");
    const rawWeight = toNumber(req.body.rawWeight ?? req.body.raw_weight);
    const lossWeight = toNumber(req.body.lossWeight ?? req.body.loss_weight);
    const finalWeight = toNumber(req.body.finalWeight ?? req.body.final_weight, rawWeight - lossWeight);
    const totalKhadiCount = Math.max(1, Math.floor(toNumber(req.body.totalKhadiCount ?? req.body.total_khadi_count, 1)));
    const expectedTotalQty = toNumber(req.body.expectedTotalQty ?? req.body.expected_total_qty);

    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "lotNo is required"
      });
    }

    if (rawWeight < 0 || lossWeight < 0 || finalWeight < 0 || expectedTotalQty < 0) {
      return res.status(400).json({
        success: false,
        message: "Process lot weights and quantities cannot be negative"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const categoryTemplate = await getDefaultProcessTemplateForCategory(connection, companyId, workCategory);
    const templateId = Number(categoryTemplate?.id || 0) || null;
    const templateSnapshot = buildProcessTemplateSnapshot(categoryTemplate);
    const templateSnapshotJson = templateSnapshot ? JSON.stringify(templateSnapshot) : null;
    const templateVersionLabel = categoryTemplate?.name ? String(categoryTemplate.name).slice(0, 120) : null;

    const [existingRows] = await connection.query(
      `
      SELECT id, raw_weight, is_manual_lot
      FROM process_lots
      WHERE company_id = ?
        AND work_category = ?
        AND lot_no = ?
      LIMIT 1
      `,
      [companyId, workCategory, lotNo]
    );

    let processLotId = null;

    if (existingRows.length) {
      if (Number(existingRows[0].is_manual_lot || 0) === 1) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Manual lots cannot be edited through the process lot workflow"
        });
      }

      processLotId = Number(existingRows[0].id);
      const existingRawWeight = toNumber(existingRows[0].raw_weight);
      const stepCount = await getProcessStepCount(connection, companyId, processLotId);
      if (stepCount > 0 && Math.abs(existingRawWeight - rawWeight) > 0.0005) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Cannot update raw weight after process steps already exist"
        });
      }

      await connection.query(
        `
        UPDATE process_lots
        SET raw_weight = ?,
            loss_weight = ?,
            final_weight = ?,
            total_khadi_count = ?,
            expected_total_qty = ?,
            work_category = ?,
            template_id = ?,
            template_snapshot_json = ?,
            template_version_label = ?,
            saved_at = NOW(),
            created_by = ?
        WHERE id = ?
        `,
        [
          rawWeight,
          lossWeight,
          finalWeight,
          totalKhadiCount,
          expectedTotalQty,
          workCategory,
          templateId,
          templateSnapshotJson,
          templateVersionLabel,
          userId,
          processLotId
        ]
      );
    } else {
      const [insertResult] = await connection.query(
        `
        INSERT INTO process_lots
        (
          company_id, lot_no, raw_weight, loss_weight, final_weight, total_khadi_count,
          expected_total_qty, work_category, template_id, template_snapshot_json,
          template_version_label, saved_at, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `,
        [
          companyId,
          lotNo,
          rawWeight,
          lossWeight,
          finalWeight,
          totalKhadiCount,
          expectedTotalQty,
          workCategory,
          templateId,
          templateSnapshotJson,
          templateVersionLabel,
          userId
        ]
      );
      processLotId = Number(insertResult.insertId);
    }

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_lots
      WHERE id = ?
      LIMIT 1
      `,
      [processLotId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Process lot saved successfully",
      lot: savedRows.length ? normalizeProcessLotRow(savedRows[0]) : null
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Save process lot error:", error);
    return res.status(500).json({
      success: false,
      message: "Process lot save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/process/manual-lots", authMiddleware, async (req, res) => {
  let connection;
  let access = null;

  try {
    access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      await logActivitySafe(pool, req, access, {
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        moduleName: "process",
        status: "denied",
        message: "Manual lot access denied",
        metadata: {
          reason: access.message || "ACCESS_DENIED",
          lotNo: normalizeProcessLotNo(req.body.lotNo || req.body.lot_no)
        }
      });
      return sendAccessError(res, access);
    }

    if (!access.isSuperAdmin && !access.isApprovedAdmin) {
      await logActivitySafe(pool, req, access, {
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        moduleName: "process",
        status: "denied",
        message: "Manual lot role denied",
        metadata: {
          reason: "ROLE_DENIED",
          lotNo: normalizeProcessLotNo(req.body.lotNo || req.body.lot_no)
        }
      });
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const companyId = access.companyScope;
    const userId = access.actingUserId;
    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no);
    const reason = String(req.body.reason || req.body.manual_reason || "").trim();

    if (!lotNo) {
      await logActivitySafe(pool, req, access, {
        companyId,
        userId,
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        moduleName: "process",
        status: "failed",
        message: "Manual lot validation failed",
        metadata: {
          reason: "LOT_NO_REQUIRED"
        }
      });
      return res.status(400).json({
        success: false,
        message: "lotNo is required"
      });
    }

    if (!reason) {
      await logActivitySafe(pool, req, access, {
        companyId,
        userId,
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        entityId: lotNo,
        moduleName: "process",
        status: "failed",
        message: "Manual lot validation failed",
        metadata: {
          reason: "MANUAL_REASON_REQUIRED",
          lotNo
        }
      });
      return res.status(400).json({
        success: false,
        message: "Manual lot reason is required"
      });
    }

    if (reason.length > 255) {
      await logActivitySafe(pool, req, access, {
        companyId,
        userId,
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        entityId: lotNo,
        moduleName: "process",
        status: "failed",
        message: "Manual lot validation failed",
        metadata: {
          reason: "MANUAL_REASON_TOO_LONG",
          lotNo
        }
      });
      return res.status(400).json({
        success: false,
        message: "Manual lot reason must be 255 characters or less"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT id
      FROM process_lots
      WHERE company_id = ? AND lot_no = ?
      LIMIT 1
      FOR UPDATE
      `,
      [companyId, lotNo]
    );

    if (existingRows.length) {
      await connection.rollback();
      await logActivitySafe(connection, req, access, {
        companyId,
        userId,
        actionType: "CREATE",
        entityType: "PROCESS_MANUAL_LOT",
        entityId: lotNo,
        moduleName: "process",
        status: "denied",
        message: "Manual lot duplicate denied",
        metadata: {
          reason: "DUPLICATE_LOT_NO",
          lotNo
        }
      });
      return res.status(409).json({
        success: false,
        message: "This lot number already exists for the selected company"
      });
    }

    const [insertResult] = await connection.query(
      `
      INSERT INTO process_lots
      (
        company_id,
        lot_no,
        status,
        is_manual_lot,
        manual_reason,
        manual_created_by,
        manual_created_at,
        completed_at,
        completed_by,
        saved_at,
        created_by
      )
      VALUES (?, ?, 'COMPLETED', 1, ?, ?, NOW(), NOW(), ?, NOW(), ?)
      `,
      [companyId, lotNo, reason, userId, userId, userId]
    );

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_lots
      WHERE id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    await logActivitySafe(connection, req, access, {
      companyId,
      userId,
      actionType: "CREATE",
      entityType: "PROCESS_MANUAL_LOT",
      entityId: lotNo,
      moduleName: "process",
      status: "success",
      message: "Manual lot created",
      afterData: {
        id: insertResult.insertId,
        lotNo,
        status: "COMPLETED",
        isManualLot: true,
        manualCreatedBy: userId
      },
      metadata: {
        lotNo
      }
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Manual lot created successfully",
      lot: savedRows.length ? normalizeProcessLotRow(savedRows[0]) : null
    });
  } catch (error) {
    if (connection) await connection.rollback();
    await logActivitySafe(connection || pool, req, access, {
      actionType: "CREATE",
      entityType: "PROCESS_MANUAL_LOT",
      moduleName: "process",
      status: "failed",
      message: "Manual lot creation failed",
      metadata: {
        lotNo: normalizeProcessLotNo(req.body?.lotNo || req.body?.lot_no),
        reason: "SERVER_ERROR",
        error: error?.message || "Unknown error"
      }
    });
    console.error("Create manual process lot error:", error);
    return res.status(500).json({
      success: false,
      message: "Manual lot creation failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/process/karigar-work", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const userId = access.actingUserId;
    const karigarName = normalizeKarigarName(req.body.karigarName || req.body.karigar_name || req.body.name);
    const lotNo = normalizeProcessLotNo(req.body.lotNo || req.body.lot_no || req.body.lot);
    const processLotNo = normalizeProcessLotNo(req.body.processLotNo || req.body.process_lot_no || lotNo);
    const issueWeight = toNumber(req.body.issueWeight ?? req.body.issue_weight ?? req.body.given);
    const receiveWeight = toNumber(req.body.receiveWeight ?? req.body.receive_weight ?? req.body.returned);
    const requestedLossWeight = req.body.lossWeight ?? req.body.loss_weight ?? req.body.loss;
    const lossWeight =
      requestedLossWeight === undefined || requestedLossWeight === null || requestedLossWeight === ""
        ? issueWeight - receiveWeight
        : toNumber(requestedLossWeight);
    const labourAmount = toNumber(req.body.labourAmount ?? req.body.labour_amount ?? req.body.labour);

    if (!karigarName || !lotNo) {
      return res.status(400).json({
        success: false,
        message: "Karigar name and lot number are required"
      });
    }

    if (issueWeight <= 0) {
      return res.status(400).json({
        success: false,
        message: "Issue weight must be greater than 0"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `
      INSERT INTO karigar_work
      (
        company_id, karigar_name, lot_no,
        issue_weight, receive_weight, loss_weight, labour_amount,
        work_time, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [companyId, karigarName, lotNo, issueWeight, receiveWeight, lossWeight, labourAmount, userId]
    );

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM karigar_work
      WHERE id = ?
      LIMIT 1
      `,
      [insertResult.insertId]
    );

    const savedWork = savedRows.length ? normalizeKarigarWorkRow(savedRows[0]) : null;
    const workDate =
      String(savedWork?.work_time || "").trim().slice(0, 10) ||
      getTodayDateOnly();

    const postingResult = await postKarigarWorkTransactions(connection, {
      companyId,
      createdBy: userId,
      workId: insertResult.insertId,
      karigarName,
      lotNo,
      processLotNo,
      issueWeight,
      receiveWeight,
      lossWeight,
      voucherDate: workDate
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Karigar work saved successfully",
      work: savedWork,
      transactionPosting: {
        partyId: postingResult.party?.id ?? null,
        transactionCount: postingResult.transactions.length,
        transactions: postingResult.transactions
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Save karigar work error:", error);
    return res.status(500).json({
      success: false,
      message: "Karigar work save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   GET ITEM BY BARCODE
========================= */
app.get("/getSticker/:barcode", authMiddleware, async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    await ensureSingleStockBarcode(companyId, barcode);

    const [rows] = await pool.query(
      `
      SELECT *
      FROM stock
      WHERE barcode = ?
        AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [barcode, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    return res.json({
      success: true,
      item: rows[0]
    });
  } catch (error) {
    console.error("Get sticker error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Fetch failed"),
      error: getErrorDetail(error)
    });
  }
});

app.get("/getReturnItem/:barcode", authMiddleware, async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    await ensureSingleStockBarcode(companyId, barcode);

    const [rows] = await pool.query(
      `
      SELECT
        s.*,
        si.invoice_number AS sale_invoice_number,
        si.customer_name AS sale_customer_name,
        si.product_name AS sale_product_name,
        si.sku AS sale_sku,
        si.size AS sale_size,
        si.weight AS sale_weight,
        si.lot_number AS sale_lot_number
      FROM stock s
      LEFT JOIN (
        SELECT si1.*
        FROM sales_items si1
        INNER JOIN (
          SELECT barcode, company_id, MAX(id) AS max_id
          FROM sales_items
          WHERE barcode = ? AND company_id = ?
          GROUP BY barcode, company_id
        ) latest
          ON latest.max_id = si1.id
      ) si
        ON si.barcode = s.barcode
       AND si.company_id = s.company_id
      WHERE s.barcode = ? AND s.company_id = ?
        ${getSellableStockFilterSql("s")}
      LIMIT 1
      `,
      [barcode, companyId, barcode, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const item = rows[0];
    return res.json({
      success: true,
      item: {
        ...item,
        invoice_number: item.sale_invoice_number || item.invoice_number || "",
        customer_name: item.sale_customer_name || "",
        product_name: item.product_name || item.sale_product_name || "",
        sku: item.sku || item.sale_sku || "",
        size: item.size || item.sale_size || "",
        weight: item.weight || item.sale_weight || 0,
        lot_number: item.lot_number || item.sale_lot_number || ""
      }
    });
  } catch (error) {
    console.error("Get return item error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Return item fetch failed"),
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   RETURN MANAGEMENT
========================= */
app.post("/saveReturn", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const barcode = String(req.body.barcode || "").trim();
    const returnType = normalizeReturnType(req.body.return_type || req.body.returnType);
    const returnReason = String(req.body.return_reason || req.body.returnReason || "").trim();
    const finalCompanyId = access.companyScope;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    if (!returnType) {
      return res.status(400).json({
        success: false,
        message: "A valid return_type is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await ensureSingleStockBarcode(finalCompanyId, barcode, connection);

    const [stockRows] = await connection.query(
      `
      SELECT *
      FROM stock
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [barcode, finalCompanyId]
    );

    if (!stockRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Barcode was not found in this company's stock"
      });
    }

    const stockItem = stockRows[0];
    const currentStatus = String(stockItem.status || "").trim().toUpperCase();

    if (currentStatus === "DELETED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "You cannot save a return for a deleted stock item"
      });
    }

    if (returnType === "RETURN_TO_STOCK" && currentStatus === "IN_STOCK") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This item is already marked as IN_STOCK"
      });
    }

    if (returnType === "DAMAGED_RETURN" && currentStatus === "DAMAGED_RETURN") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This item is already marked as DAMAGED_RETURN"
      });
    }

    const saleItem = await getLatestSaleItemByBarcode(connection, barcode, finalCompanyId);
    const invoiceNumber = String(
      req.body.invoice_number ||
        req.body.invoiceNumber ||
        stockItem.invoice_number ||
        saleItem?.invoice_number ||
        ""
    ).trim();
    const customerName = String(
      req.body.customer_name ||
        req.body.customerName ||
        saleItem?.customer_name ||
        ""
    ).trim();
    const productName = String(
      req.body.product_name ||
        req.body.productName ||
        stockItem.product_name ||
        saleItem?.product_name ||
        ""
    ).trim();
    const sku = String(req.body.sku || stockItem.sku || saleItem?.sku || "").trim();
    const size = String(req.body.size || stockItem.size || saleItem?.size || "").trim();
    const weight = Number(req.body.weight || stockItem.weight || saleItem?.weight || 0);
    const lotNumber = String(
      req.body.lot_number || req.body.lotNumber || stockItem.lot_number || saleItem?.lot_number || ""
    ).trim();
    const saleStatus = String(saleItem?.sale_status || "").trim().toUpperCase();
    const saleItemStatus = String(saleItem?.item_status || "").trim().toUpperCase();

    if (!saleItem || !invoiceNumber) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "No matching sold invoice item was found for this return"
      });
    }

    if (saleStatus === "DELETED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "You cannot save a return for a deleted sale item"
      });
    }

    if (saleItemStatus === "RETURN_TO_STOCK" || saleItemStatus === "DAMAGED_RETURN") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This sale item has already been returned"
      });
    }

    const nextStockStatus =
      returnType === "RETURN_TO_STOCK" ? "IN_STOCK" : "DAMAGED_RETURN";

    if (returnType === "RETURN_TO_STOCK") {
      const [stockResult] = await connection.query(
        `
        UPDATE stock
        SET status = 'IN_STOCK',
            invoice_number = '',
            sold_at = NULL
        WHERE barcode = ? AND company_id = ?
          ${getSellableStockFilterSql()}
        `,
        [barcode, finalCompanyId]
      );
      assertSingleStockRowAffected(stockResult);
    } else {
      const [stockResult] = await connection.query(
        `
        UPDATE stock
        SET status = 'DAMAGED_RETURN'
        WHERE barcode = ? AND company_id = ?
          ${getSellableStockFilterSql()}
        `,
        [barcode, finalCompanyId]
      );
      assertSingleStockRowAffected(stockResult);
    }

    const transactionPosting = await postReturnToTransactionFoundation(connection, {
      companyId: finalCompanyId,
      createdBy: access.actingUserId,
      saleItem,
      saleRow: saleItem,
      invoiceNumber,
      customerName,
      mobile: saleItem?.sale_mobile || "",
      gstNo: saleItem?.sale_gst_number || "",
      returnType,
      returnReason,
      returnDate: getTodayDateOnly(),
      productName,
      barcode,
      lotNumber,
      weight
    });

    const [returnInsert] = await connection.query(
      `
      INSERT INTO return_history
      (
        barcode,
        invoice_number,
        customer_name,
        product_name,
        sku,
        size,
        weight,
        lot_number,
        return_type,
        return_reason,
        return_date,
        company_id,
        party_id,
        estimated_amount,
        transaction_id,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, NOW())
      `,
      [
        barcode,
        invoiceNumber,
        customerName,
        productName,
        sku,
        size,
        Number.isNaN(weight) ? 0 : weight,
        lotNumber,
        returnType,
        returnReason,
        finalCompanyId,
        transactionPosting.partyId,
        transactionPosting.estimatedAmount,
        transactionPosting.transactionId,
        access.actingUserId
      ]
    );

    await connection.query(
      `
      UPDATE sales_items
      SET item_status = ?,
          return_type = ?,
          returned_at = NOW(),
          return_id = ?,
          return_transaction_id = ?
      WHERE id = ?
      `,
      [
        returnType,
        returnType,
        returnInsert.insertId,
        transactionPosting.transactionId,
        saleItem.id
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Return saved successfully",
      item: {
        barcode,
        invoice_number: invoiceNumber,
        customer_name: customerName,
        product_name: productName,
        sku,
        size,
        weight: Number.isNaN(weight) ? 0 : weight,
        lot_number: lotNumber,
        return_type: returnType,
        return_reason: returnReason,
        company_id: finalCompanyId,
        stock_status: nextStockStatus,
        transaction_id: transactionPosting.transactionId,
        estimated_amount: transactionPosting.estimatedAmount
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Save return error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Return save failed"),
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/getReturns", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const whereClause = companyId !== null ? "WHERE rh.company_id = ?" : "";
    const params = companyId !== null ? [companyId] : [];
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 1000 });

    const [rows] = await pool.query(
      `
      SELECT
        rh.*,
        c.company_name,
        u.name AS created_by_name
      FROM return_history rh
      LEFT JOIN companies c ON c.id = rh.company_id
      LEFT JOIN users u ON u.id = rh.created_by
      ${whereClause}
      ORDER BY rh.id DESC
      ${pagination.sql}
      `,
      params
    );

    return res.json({
      success: true,
      returns: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("Get returns error:", error);
    return res.status(500).json({
      success: false,
      message: "Returns fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/getReturnSummary", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const summary = await getReturnSummaryRows(companyId);

    return res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error("Get return summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Return summary fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   MATERIAL STOCK
========================= */
app.post("/materialStock/items", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const category = String(req.body.category || "").trim();
    const materialName = String(req.body.material_name || req.body.materialName || "").trim();
    const variant = String(req.body.variant || "").trim();
    const size = String(req.body.size || "").trim();
    const unit = String(req.body.unit || "").trim();
    const openingStock = Number(req.body.opening_stock ?? req.body.openingStock ?? 0);
    const lowStockLevel = Number(req.body.low_stock_level ?? req.body.lowStockLevel ?? 0);
    const supplierName = String(req.body.supplier_name || req.body.supplierName || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const finalCompanyId = access.companyScope;
    const finalUserId = access.actingUserId ?? getRequestedUserId(req);

    if (!category || !materialName || !unit) {
      return res.status(400).json({
        success: false,
        message: "Category, material name, and unit are required"
      });
    }

    if (Number.isNaN(openingStock) || Number.isNaN(lowStockLevel)) {
      return res.status(400).json({
        success: false,
        message: "Opening stock and low stock level must be valid numbers"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM material_stock_items
      WHERE company_id = ?
        AND LOWER(TRIM(category)) = LOWER(TRIM(?))
        AND LOWER(TRIM(material_name)) = LOWER(TRIM(?))
        AND LOWER(TRIM(COALESCE(variant, ''))) = LOWER(TRIM(?))
        AND LOWER(TRIM(COALESCE(size, ''))) = LOWER(TRIM(?))
        AND LOWER(TRIM(unit)) = LOWER(TRIM(?))
      LIMIT 1
      `,
      [finalCompanyId, category, materialName, variant, size, unit]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This material variant/size/unit already exists in the same company"
      });
    }

    const status = getMaterialStockStatus(openingStock, lowStockLevel);

    const [insertResult] = await connection.query(
      `
      INSERT INTO material_stock_items (
        company_id, category, material_name, variant, size, unit,
        opening_stock, current_stock, low_stock_level, supplier_name, remarks, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalCompanyId,
        category,
        materialName,
        variant,
        size,
        unit,
        openingStock,
        openingStock,
        lowStockLevel,
        supplierName,
        remarks,
        status,
        finalUserId
      ]
    );

    await connection.query(
      `
      INSERT INTO material_stock_movements (
        company_id, material_id, movement_type, qty, unit, movement_date,
        supplier_name, remarks, reference_no, created_by
      ) VALUES (?, ?, 'OPENING', ?, ?, NOW(), ?, ?, 'OPENING', ?)
      `,
      [finalCompanyId, insertResult.insertId, openingStock, unit, supplierName, remarks, finalUserId]
    );

    await syncMaterialStockBalance(connection, insertResult.insertId, finalCompanyId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Material item saved successfully",
      materialId: insertResult.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create material item error:", error);
    return res.status(500).json({
      success: false,
      message: "Material item save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/materialStock/items/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const materialId = Number(req.params.id);
    const category = String(req.body.category || "").trim();
    const materialName = String(req.body.material_name || req.body.materialName || "").trim();
    const variant = String(req.body.variant || "").trim();
    const size = String(req.body.size || "").trim();
    const unit = String(req.body.unit || "").trim();
    const openingStock = Number(req.body.opening_stock ?? req.body.openingStock ?? 0);
    const lowStockLevel = Number(req.body.low_stock_level ?? req.body.lowStockLevel ?? 0);
    const supplierName = String(req.body.supplier_name || req.body.supplierName || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const finalCompanyId = access.companyScope;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Material id is required"
      });
    }

    if (!category || !materialName || !unit) {
      return res.status(400).json({
        success: false,
        message: "Category, material name, and unit are required"
      });
    }

    if (Number.isNaN(openingStock) || Number.isNaN(lowStockLevel)) {
      return res.status(400).json({
        success: false,
        message: "Opening stock and low stock level must be valid numbers"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT id
      FROM material_stock_items
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [materialId, finalCompanyId]
    );

    if (!existingRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Material item not found"
      });
    }

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM material_stock_items
      WHERE company_id = ?
        AND id <> ?
        AND LOWER(TRIM(category)) = LOWER(TRIM(?))
        AND LOWER(TRIM(material_name)) = LOWER(TRIM(?))
        AND LOWER(TRIM(COALESCE(variant, ''))) = LOWER(TRIM(?))
        AND LOWER(TRIM(COALESCE(size, ''))) = LOWER(TRIM(?))
        AND LOWER(TRIM(unit)) = LOWER(TRIM(?))
      LIMIT 1
      `,
      [finalCompanyId, materialId, category, materialName, variant, size, unit]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This material identity already exists in the same company"
      });
    }

    await connection.query(
      `
      UPDATE material_stock_items
      SET category = ?,
          material_name = ?,
          variant = ?,
          size = ?,
          unit = ?,
          low_stock_level = ?,
          supplier_name = ?,
          remarks = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [category, materialName, variant, size, unit, lowStockLevel, supplierName, remarks, materialId, finalCompanyId]
    );

    const [openingRows] = await connection.query(
      `
      SELECT id
      FROM material_stock_movements
      WHERE material_id = ? AND company_id = ? AND movement_type = 'OPENING'
      ORDER BY id ASC
      LIMIT 1
      `,
      [materialId, finalCompanyId]
    );

    if (openingRows.length > 0) {
      await connection.query(
        `
        UPDATE material_stock_movements
        SET qty = ?,
            unit = ?,
            supplier_name = ?,
            remarks = ?
        WHERE id = ?
        `,
        [openingStock, unit, supplierName, remarks, openingRows[0].id]
      );
    } else {
      await connection.query(
        `
        INSERT INTO material_stock_movements (
          company_id, material_id, movement_type, qty, unit, movement_date,
          supplier_name, remarks, reference_no, created_by
        ) VALUES (?, ?, 'OPENING', ?, ?, NOW(), ?, ?, 'OPENING', ?)
        `,
        [finalCompanyId, materialId, openingStock, unit, supplierName, remarks, access.actingUserId]
      );
    }

    await syncMaterialStockBalance(connection, materialId, finalCompanyId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Material item updated successfully"
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Update material item error:", error);
    return res.status(500).json({
      success: false,
      message: "Material item update failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/materialStock/items", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const whereClause = companyId !== null ? "WHERE msi.company_id = ?" : "";
    const params = companyId !== null ? [companyId] : [];

    const [rows] = await pool.query(
      `
      SELECT
        msi.*,
        COALESCE(SUM(CASE WHEN msm.movement_type = 'OPENING' THEN msm.qty ELSE 0 END), 0) AS opening_total,
        COALESCE(SUM(CASE WHEN msm.movement_type = 'IN' THEN msm.qty ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN msm.movement_type = 'OUT' THEN msm.qty ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN msm.movement_type = 'ADJUSTMENT' THEN msm.qty ELSE 0 END), 0) AS total_adjustment,
        MAX(msm.movement_date) AS last_movement_date,
        c.company_name,
        u.name AS created_by_name
      FROM material_stock_items msi
      LEFT JOIN material_stock_movements msm ON msm.material_id = msi.id
      LEFT JOIN companies c ON c.id = msi.company_id
      LEFT JOIN users u ON u.id = msi.created_by
      ${whereClause}
      GROUP BY msi.id
      ORDER BY msi.category ASC, msi.material_name ASC, msi.variant ASC, msi.size ASC, msi.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      items: rows.map((row) => ({
        ...row,
        opening_total: Number(row.opening_total || 0),
        total_in: Number(row.total_in || 0),
        total_out: Number(row.total_out || 0),
        total_adjustment: Number(row.total_adjustment || 0),
        opening_stock: Number(row.opening_stock || 0),
        current_stock: Number(row.current_stock || 0),
        low_stock_level: Number(row.low_stock_level || 0)
      }))
    });
  } catch (error) {
    console.error("Get material items error:", error);
    return res.status(500).json({
      success: false,
      message: "Material items fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/materialStock/movements", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const materialId = Number(req.body.material_id ?? req.body.materialId ?? 0);
    const movementType = normalizeMaterialMovementType(req.body.movement_type || req.body.movementType);
    const qty = Number(req.body.qty ?? req.body.quantity ?? 0);
    const movementDateRaw = String(req.body.movement_date || req.body.movementDate || "").trim();
    const supplierName = String(req.body.supplier_name || req.body.supplierName || "").trim();
    const referenceNo = String(req.body.reference_no || req.body.referenceNo || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const finalCompanyId = access.companyScope;
    const finalUserId = access.actingUserId ?? getRequestedUserId(req);

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Please select a material"
      });
    }

    if (!movementType || movementType === "OPENING") {
      return res.status(400).json({
        success: false,
        message: "A valid movement type is required"
      });
    }

    if (Number.isNaN(qty) || qty === 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be valid"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [materialRows] = await connection.query(
      `
      SELECT *
      FROM material_stock_items
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [materialId, finalCompanyId]
    );

    if (!materialRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Material item not found"
      });
    }

    const material = materialRows[0];
    const safeQty = movementType === "ADJUSTMENT" ? qty : Math.abs(qty);
    const projectedStock =
      Number(material.current_stock || 0) +
      (movementType === "IN" ? safeQty : 0) +
      (movementType === "OUT" ? -safeQty : 0) +
      (movementType === "ADJUSTMENT" ? safeQty : 0);

    if (projectedStock < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Current stock cannot go below zero"
      });
    }

    const movementDate = movementDateRaw ? movementDateRaw : new Date().toISOString().slice(0, 10);

    await connection.query(
      `
      INSERT INTO material_stock_movements (
        company_id, material_id, movement_type, qty, unit, movement_date,
        supplier_name, remarks, reference_no, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalCompanyId,
        materialId,
        movementType,
        safeQty,
        String(material.unit || "").trim(),
        movementDate,
        supplierName || String(material.supplier_name || "").trim(),
        remarks,
        referenceNo,
        finalUserId
      ]
    );

    await syncMaterialStockBalance(connection, materialId, finalCompanyId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Material movement saved successfully"
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create material movement error:", error);
    return res.status(500).json({
      success: false,
      message: "Material movement save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/materialStock/movements", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const whereClause = companyId !== null ? "WHERE msm.company_id = ?" : "";
    const params = companyId !== null ? [companyId] : [];

    const [rows] = await pool.query(
      `
      SELECT
        msm.*,
        msi.category,
        msi.material_name,
        msi.variant,
        msi.size,
        msi.low_stock_level,
        c.company_name,
        u.name AS created_by_name
      FROM material_stock_movements msm
      LEFT JOIN material_stock_items msi ON msi.id = msm.material_id
      LEFT JOIN companies c ON c.id = msm.company_id
      LEFT JOIN users u ON u.id = msm.created_by
      ${whereClause}
      ORDER BY msm.movement_date DESC, msm.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      movements: rows.map((row) => ({
        ...row,
        qty: Number(row.qty || 0),
        low_stock_level: Number(row.low_stock_level || 0)
      }))
    });
  } catch (error) {
    console.error("Get material movements error:", error);
    return res.status(500).json({
      success: false,
      message: "Material movements fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/materialStock/summary", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const summary = await getMaterialStockSummaryRows(companyId);

    return res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error("Get material stock summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Material stock summary fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   ADD STICKER
========================= */
app.post("/addSticker", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const {
      serial,
      productName,
      purity,
      sku,
      mm,
      size,
      weight,
      lot,
      metalType,
      processType,
      barcode,
      qty,
      companyId
    } = req.body;

    const finalCompanyId = access.companyScope;
    const finalUserId = access.actingUserId ?? getRequestedUserId(req);

    if (!serial || !productName || !purity || !sku || !size || !weight || !lot || !barcode) {
      return res.json({
        success: false,
        message: "Serial, product, purity, SKU, size, weight, lot, and barcode are required"
      });
    }

    const cleanLot = String(lot).trim();
    const cleanSerial = String(serial).trim();
    const cleanBarcode = String(barcode).trim();
    await ensureSingleStockBarcode(finalCompanyId, cleanBarcode);

    const parsedWeight = parseRequiredNumber(weight, "Sticker weight");
    if (!parsedWeight.ok || parsedWeight.value <= 0) {
      return res.json({
        success: false,
        message: parsedWeight.ok ? "Sticker weight must be greater than zero" : parsedWeight.message
      });
    }

    const qtyProvided = hasProvidedValue(qty);
    const parsedQty = parseOptionalNumber(qty, "Sticker quantity", 1);
    if (!parsedQty.ok || parsedQty.value <= 0) {
      return res.json({
        success: false,
        message: parsedQty.ok ? "Sticker quantity must be greater than zero" : parsedQty.message
      });
    }

    const [dupLotSerial] = await pool.query(
      `
      SELECT id FROM stock
      WHERE lot_number = ?
        AND serial = ?
        AND company_id = ?
        AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
      LIMIT 1
      `,
      [cleanLot, cleanSerial, finalCompanyId]
    );

    if (dupLotSerial.length > 0) {
      return res.json({
        success: false,
        message: `Serial ${cleanSerial} already exists in lot ${cleanLot}`
      });
    }

    const [dupBarcode] = await pool.query(
      `
      SELECT id FROM stock
      WHERE UPPER(TRIM(barcode)) = ?
        AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [normalizeBarcodeForComparison(cleanBarcode), finalCompanyId]
    );

    if (dupBarcode.length > 0) {
      return res.json({
        success: false,
        message: `Barcode ${cleanBarcode} already exists`
      });
    }

    const stickerLimit = await validateStickerAgainstProcessOutput(
      pool,
      finalCompanyId,
      cleanLot,
      Number(format3(parsedWeight.value)),
      parsedQty.value,
      null,
      qtyProvided
    );
    if (!stickerLimit.ok) {
      return res.json({
        success: false,
        message: stickerLimit.message
      });
    }

    const stickerProcessLot = await getProcessLotForSteps(pool, finalCompanyId, cleanLot);
    const isManualStickerLot = isManualProcessLot(stickerProcessLot);

    await pool.query(
      `
      INSERT INTO stock (
        serial,
        product_name,
        purity,
        sku,
        mm,
        size,
        weight,
        qty,
        lot_number,
        barcode,
        metal_type,
        process_type,
        source,
        manual_lot_id,
        status,
        company_id,
        created_by,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cleanSerial,
        String(productName).trim(),
        String(purity).trim(),
        String(sku).trim(),
        String(mm || "").trim(),
        String(size).trim(),
        Number(format3(parsedWeight.value)),
        parsedQty.value,
        cleanLot,
        cleanBarcode,
        String(metalType || "").trim(),
        String(processType || "").trim(),
        isManualStickerLot ? "MANUAL_ENTRY" : "",
        isManualStickerLot ? Number(stickerProcessLot.id || 0) || null : null,
        "IN_STOCK",
        finalCompanyId,
        finalUserId,
        null
      ]
    );

    return res.json({
      success: true,
      message: "Sticker added successfully"
    });
  } catch (err) {
    console.error("Add sticker error:", err);
    return res.status(getBarcodeSafetyStatus(err)).json({
      success: false,
      message: getBarcodeSafetyMessage(err, "Add sticker failed"),
      error: err.message
    });
  }
});

/* =========================
   UPDATE STICKER
========================= */
app.put("/updateSticker/:barcode", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const oldBarcode = String(req.params.barcode || "").trim();

    const {
      serial = "",
      productName = "",
      purity = "",
      sku = "",
      mm = "",
      size = "",
      weight,
      lot = "",
      barcode = oldBarcode,
      metalType = "",
      processType = "",
      qty,
      status = "IN_STOCK",
      companyId = null,
      invoiceNumber = ""
    } = req.body;

    const finalCompanyId = access.companyScope;

    if (!oldBarcode) {
      return res.json({ success: false, message: "Old barcode is missing" });
    }

    await ensureSingleStockBarcode(finalCompanyId, oldBarcode);

    if (String(status).toUpperCase() === "SOLD") {
      const soldParams = ["SOLD", String(invoiceNumber || "").trim(), oldBarcode, finalCompanyId];
      const soldSql = `
        UPDATE stock
        SET status = ?, invoice_number = ?, sold_at = NOW(), deleted_at = NULL
        WHERE barcode = ?
          AND company_id = ?
          ${getSellableStockFilterSql()}
      `;

      const [soldResult] = await pool.query(soldSql, soldParams);
      const soldAffectedRows = assertSingleStockRowAffected(soldResult);

      if (soldAffectedRows === 0) {
        return res.json({ success: false, message: "Sticker item not found" });
      }

      return res.json({
        success: true,
        message: "Sticker updated successfully"
      });
    }

    if (!serial || !productName || !purity || !sku || !size || !weight || !lot) {
      return res.json({
        success: false,
        message: "Serial, product, purity, SKU, size, weight, and lot are required"
      });
    }

    const cleanLot = String(lot).trim();
    const cleanSerial = String(serial).trim();
    const newBarcode = String(barcode || oldBarcode).trim();
    await ensureSingleStockBarcode(finalCompanyId, oldBarcode);
    await ensureSingleStockBarcode(finalCompanyId, newBarcode);

    const parsedWeight = parseRequiredNumber(weight, "Sticker weight");
    if (!parsedWeight.ok || parsedWeight.value <= 0) {
      return res.json({
        success: false,
        message: parsedWeight.ok ? "Sticker weight must be greater than zero" : parsedWeight.message
      });
    }

    const qtyProvided = hasProvidedValue(qty);
    const parsedQty = parseOptionalNumber(qty, "Sticker quantity", 1);
    if (!parsedQty.ok || parsedQty.value <= 0) {
      return res.json({
        success: false,
        message: parsedQty.ok ? "Sticker quantity must be greater than zero" : parsedQty.message
      });
    }

    const [currentRows] = await pool.query(
      `
      SELECT id
      FROM stock
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [oldBarcode, finalCompanyId]
    );

    if (currentRows.length === 0) {
      return res.json({ success: false, message: "Sticker item not found" });
    }

    const currentId = currentRows[0].id;

    const [dupLotSerial] = await pool.query(
      `
      SELECT id FROM stock
      WHERE lot_number = ?
        AND serial = ?
        AND company_id = ?
        AND id <> ?
        AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
      LIMIT 1
      `,
      [cleanLot, cleanSerial, finalCompanyId, currentId]
    );

    if (dupLotSerial.length > 0) {
      return res.json({
        success: false,
        message: `Serial ${cleanSerial} already exists in lot ${cleanLot}`
      });
    }

    const [dupBarcode] = await pool.query(
      `
      SELECT id FROM stock
      WHERE UPPER(TRIM(barcode)) = ?
        AND company_id = ?
        AND id <> ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [normalizeBarcodeForComparison(newBarcode), finalCompanyId, currentId]
    );

    if (dupBarcode.length > 0) {
      return res.json({
        success: false,
        message: `Barcode ${newBarcode} already exists`
      });
    }

    const stickerLimit = await validateStickerAgainstProcessOutput(
      pool,
      finalCompanyId,
      cleanLot,
      Number(format3(parsedWeight.value)),
      parsedQty.value,
      currentId,
      qtyProvided
    );
    if (!stickerLimit.ok) {
      return res.json({
        success: false,
        message: stickerLimit.message
      });
    }

    const stickerProcessLot = await getProcessLotForSteps(pool, finalCompanyId, cleanLot);
    const isManualStickerLot = isManualProcessLot(stickerProcessLot);

    await pool.query(
      `
      UPDATE stock
      SET
        serial = ?,
        product_name = ?,
        purity = ?,
        sku = ?,
        mm = ?,
        size = ?,
        weight = ?,
        qty = ?,
        lot_number = ?,
        barcode = ?,
        metal_type = ?,
        process_type = ?,
        source = ?,
        manual_lot_id = ?,
        status = ?,
        deleted_at = CASE WHEN ? = 'DELETED' THEN NOW() ELSE NULL END
      WHERE id = ?
      `,
      [
        cleanSerial,
        String(productName).trim(),
        String(purity).trim(),
        String(sku).trim(),
        String(mm || "").trim(),
        String(size).trim(),
        Number(format3(parsedWeight.value)),
        parsedQty.value,
        cleanLot,
        newBarcode,
        String(metalType || "").trim(),
        String(processType || "").trim(),
        isManualStickerLot ? "MANUAL_ENTRY" : "",
        isManualStickerLot ? Number(stickerProcessLot.id || 0) || null : null,
        String(status || "IN_STOCK").trim(),
        String(status || "IN_STOCK").trim(),
        currentId
      ]
    );

    return res.json({
      success: true,
      message: "Sticker updated successfully"
    });
  } catch (error) {
    console.error("Update sticker error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Server error"),
      error: getErrorDetail(error)
    });
  }
});
/* =========================
   DELETE STICKER (SOFT DELETE)
========================= */
app.delete("/deleteSticker/:barcode", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!barcode) {
      return res.json({
        success: false,
        message: "Barcode is required"
      });
    }

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    await ensureSingleStockBarcode(companyId, barcode);

    const query = `
      UPDATE stock
      SET status = 'DELETED', deleted_at = NOW()
      WHERE barcode = ?
        AND company_id = ?
        ${getSellableStockFilterSql()}
    `;
    const params = [barcode, companyId];

    const [result] = await pool.query(query, params);
    const affectedRows = assertSingleStockRowAffected(result);

    if (affectedRows === 0) {
      return res.json({
        success: false,
        message: "Sticker item not found"
      });
    }

    return res.json({
      success: true,
      message: "Sticker deleted successfully"
    });
  } catch (error) {
    console.error("Delete sticker error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Server error"),
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   RESTORE STICKER
========================= */
app.put("/restoreSticker/:barcode", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!barcode) {
      return res.json({
        success: false,
        message: "Barcode is required"
      });
    }

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    await ensureSingleStockBarcode(companyId, barcode);

    const query = `
      UPDATE stock
      SET status = 'IN_STOCK', deleted_at = NULL
      WHERE barcode = ?
        AND company_id = ?
        ${getSellableStockFilterSql()}
    `;
    const params = [barcode, companyId];

    const [result] = await pool.query(query, params);
    const affectedRows = assertSingleStockRowAffected(result);

    if (affectedRows === 0) {
      return res.json({
        success: false,
        message: "No item was found to restore"
      });
    }

    return res.json({
      success: true,
      message: "Sticker restored successfully"
    });
  } catch (err) {
    console.error("Restore error:", err);
    return res.status(getBarcodeSafetyStatus(err)).json({
      success: false,
      message: getBarcodeSafetyMessage(err, "Restore failed"),
      error: err.message
    });
  }
});

/* =========================
   INVOICE DRAFTS
========================= */
app.get("/invoice-drafts/current", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    const draftRow = await getCurrentInvoiceDraft(
      connection,
      access.companyScope,
      access.actingUserId ?? getRequestedUserId(req)
    );

    const payload = draftRow
      ? await getInvoiceDraftPayload(connection, draftRow.id)
      : mapInvoiceDraftPayload(null, []);

    return res.json({
      success: true,
      ...payload
    });
  } catch (error) {
    console.error("Current invoice draft fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Current invoice draft fetch failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/invoice-drafts/current/header", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    const actingUserId = access.actingUserId ?? getRequestedUserId(req);
    const draftRow = await getOrCreateCurrentInvoiceDraft(connection, access.companyScope, actingUserId);

    await connection.query(
      `
      UPDATE invoice_drafts
      SET customer_name = ?,
          mobile = ?,
          invoice_number = ?,
          invoice_date = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [
        String(req.body.customerName || "").trim(),
        String(req.body.mobile || "").trim(),
        String(req.body.invoiceNumber || "").trim(),
        String(req.body.invoiceDate || "").trim() || null,
        actingUserId,
        draftRow.id,
        access.companyScope
      ]
    );

    const payload = await getInvoiceDraftPayload(connection, draftRow.id);
    return res.json({
      success: true,
      message: "Invoice draft header saved",
      ...payload
    });
  } catch (error) {
    console.error("Invoice draft header save error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft header save failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/invoice-drafts/current/items", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const barcode = String(req.body.barcode || "").trim();
    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode missing"
      });
    }

    connection = await pool.getConnection();
    const requestedBranchId = getRequestedBranchScopeValue(req);
    const branchScope = await resolveOperationalBranchScope(connection, access, requestedBranchId);
    if (!branchScope.ok) {
      return res.status(branchScope.status || 403).json({
        success: false,
        message: branchScope.message || "Branch access denied"
      });
    }

    const actingUserId = access.actingUserId ?? getRequestedUserId(req);
    const draftRow = await getOrCreateCurrentInvoiceDraft(connection, access.companyScope, actingUserId);
    await ensureSingleStockBarcode(access.companyScope, barcode, connection);

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM invoice_draft_items
      WHERE draft_id = ? AND barcode = ?
      LIMIT 1
      `,
      [draftRow.id, barcode]
    );

    if (duplicateRows.length > 0) {
      const payload = await getInvoiceDraftPayload(connection, draftRow.id);
      return res.json({
        success: true,
        message: "Barcode already present in draft",
        ...payload
      });
    }

    const [stockRows] = await connection.query(
      `
      SELECT *
      FROM stock
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      LIMIT 1
      `,
      [barcode, access.companyScope]
    );

    if (!stockRows.length) {
      return res.status(404).json({
        success: false,
        message: "The barcode was not found in stock"
      });
    }

    const stockRow = stockRows[0];
    const stockStatus = String(stockRow.status || "IN_STOCK").trim().toUpperCase();
    const effectiveStockState = getEffectiveStockState(stockRow);
    if (stockStatus !== "IN_STOCK" || effectiveStockState !== "IN_STOCK") {
      return res.status(400).json({
        success: false,
        message: "This barcode is not in sellable stock"
      });
    }

    if (branchScope.isBranchFiltered && Number(stockRow.current_branch_id || 0) !== Number(branchScope.branchId || 0)) {
      return res.status(403).json({
        success: false,
        message: "This barcode does not belong to the selected billing branch"
      });
    }

    await connection.query(
      `
      INSERT INTO invoice_draft_items
      (
        draft_id,
        company_id,
        barcode,
        product_name,
        sku,
        purity,
        size,
        weight,
        lot_number,
        item_stage,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
      `,
      [
        draftRow.id,
        access.companyScope,
        barcode,
        String(stockRow.product_name || "").trim(),
        String(stockRow.sku || "").trim(),
        String(stockRow.purity || "").trim(),
        String(stockRow.size || "").trim(),
        Number(stockRow.weight || 0),
        String(stockRow.lot_number || "").trim()
      ]
    );

    const payload = await getInvoiceDraftPayload(connection, draftRow.id);
    return res.json({
      success: true,
      message: "Invoice draft item added",
      ...payload
    });
  } catch (error) {
    console.error("Invoice draft item add error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft item add failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/invoice-drafts/current/items/:barcode", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const barcode = String(req.params.barcode || "").trim();
    connection = await pool.getConnection();
    const draftRow = await getCurrentInvoiceDraft(
      connection,
      access.companyScope,
      access.actingUserId ?? getRequestedUserId(req)
    );

    if (!draftRow) {
      return res.json({
        success: true,
        message: "Invoice draft already empty",
        ...mapInvoiceDraftPayload(null, [])
      });
    }

    await connection.query(
      `
      DELETE FROM invoice_draft_items
      WHERE draft_id = ? AND barcode = ?
      `,
      [draftRow.id, barcode]
    );

    const payload = await getInvoiceDraftPayload(connection, draftRow.id);
    return res.json({
      success: true,
      message: "Invoice draft item removed",
      ...payload
    });
  } catch (error) {
    console.error("Invoice draft item delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft item delete failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/invoice-drafts/current/apply-details", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const customerName = String(req.body.customerName || "").trim();
    const mobile = String(req.body.mobile || "").trim();
    const invoiceNumber = String(req.body.invoiceNumber || "").trim();
    const invoiceDate = String(req.body.invoiceDate || "").trim();

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "Please enter the customer name"
      });
    }

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Please enter the invoice number"
      });
    }

    connection = await pool.getConnection();
    const actingUserId = access.actingUserId ?? getRequestedUserId(req);
    const draftRow = await getCurrentInvoiceDraft(connection, access.companyScope, actingUserId);

    if (!draftRow) {
      return res.status(400).json({
        success: false,
        message: "Please scan a barcode first"
      });
    }

    const [pendingRows] = await connection.query(
      `
      SELECT id
      FROM invoice_draft_items
      WHERE draft_id = ?
        AND UPPER(COALESCE(item_stage, 'PENDING')) = 'PENDING'
      LIMIT 1
      `,
      [draftRow.id]
    );

    if (!pendingRows.length) {
      return res.status(400).json({
        success: false,
        message: "Please scan a barcode first"
      });
    }

    await connection.query(
      `
      UPDATE invoice_drafts
      SET customer_name = ?,
          mobile = ?,
          invoice_number = ?,
          invoice_date = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [
        customerName,
        mobile,
        invoiceNumber,
        invoiceDate || null,
        actingUserId,
        draftRow.id,
        access.companyScope
      ]
    );

    await connection.query(
      `
      UPDATE invoice_draft_items
      SET item_stage = 'READY',
          updated_at = NOW()
      WHERE draft_id = ?
        AND UPPER(COALESCE(item_stage, 'PENDING')) = 'PENDING'
      `,
      [draftRow.id]
    );

    const payload = await getInvoiceDraftPayload(connection, draftRow.id);
    return res.json({
      success: true,
      message: "The barcode has been updated with customer details",
      ...payload
    });
  } catch (error) {
    console.error("Invoice draft apply details error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft update failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/invoice-drafts/current", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    const actingUserId = access.actingUserId ?? getRequestedUserId(req);
    const draftRow = await getCurrentInvoiceDraft(connection, access.companyScope, actingUserId);

    if (!draftRow) {
      return res.json({
        success: true,
        message: "Invoice draft cleared",
        ...mapInvoiceDraftPayload(null, [])
      });
    }

    await connection.query(
      `
      DELETE FROM invoice_draft_items
      WHERE draft_id = ?
      `,
      [draftRow.id]
    );

    await connection.query(
      `
      UPDATE invoice_drafts
      SET customer_name = '',
          mobile = '',
          invoice_number = '',
          invoice_date = NULL,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [actingUserId, draftRow.id, access.companyScope]
    );

    const payload = await getInvoiceDraftPayload(connection, draftRow.id);
    return res.json({
      success: true,
      message: "Invoice draft cleared",
      ...payload
    });
  } catch (error) {
    console.error("Invoice draft clear error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft clear failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/invoice-drafts/:id/billing", authMiddleware, async (req, res) => {
  let connection;

  try {
    const draftId = Number(req.params.id);
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!draftId) {
      return res.status(400).json({
        success: false,
        message: "Draft id missing"
      });
    }

    connection = await pool.getConnection();
    const [draftRows] = await connection.query(
      `
      SELECT *
      FROM invoice_drafts
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [draftId, access.companyScope]
    );

    const draftRow = draftRows[0] || null;
    if (!draftRow) {
      return res.status(404).json({
        success: false,
        message: "Invoice draft not found"
      });
    }

    const [itemRows] = await connection.query(
      `
      SELECT *
      FROM invoice_draft_items
      WHERE draft_id = ?
        AND UPPER(COALESCE(item_stage, 'PENDING')) = 'READY'
      ORDER BY id ASC
      `,
      [draftId]
    );

    return res.json({
      success: true,
      draft: {
        id: draftRow.id,
        customerName: draftRow.customer_name || "",
        mobile: draftRow.mobile || "",
        invoiceNumber: draftRow.invoice_number || "",
        invoiceDate: draftRow.invoice_date || "",
        status: draftRow.status || "DRAFT"
      },
      items: itemRows.map((item) => ({
        id: item.id,
        barcode: item.barcode || "",
        productName: item.product_name || "",
        product_name: item.product_name || "",
        itemName: item.product_name || "",
        sku: item.sku || "",
        purity: item.purity || "",
        size: item.size || "",
        weight: toNumber(item.weight),
        lot: item.lot_number || "",
        lot_number: item.lot_number || "",
        customerName: draftRow.customer_name || "",
        mobile: draftRow.mobile || "",
        invoiceDate: draftRow.invoice_date || "",
        invoiceNumber: draftRow.invoice_number || "",
        company_id: item.company_id
      }))
    });
  } catch (error) {
    console.error("Invoice draft billing fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice draft billing fetch failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   SAVE INVOICE
========================= */
app.post("/saveInvoice", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "Legacy invoice save is disabled. Use the secured billing save flow."
  });

  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const {
      invoiceNumber = "",
      customerName = "",
      mobile = "",
      gstNumber = "",
      invoiceDate = "",
      paymentMode = "",
      paymentStatus = "",
      paidAmount = 0,
      dueAmount = 0,
      ratePerGram = 0,
      mcRate = 0,
      roundOff = 0,
      subtotal = 0,
      grandTotal = 0,
      items = [],
      companyId = null
    } = req.body;

    const finalCompanyId = access.companyScope;
    const validation = await validateInvoiceSaveRequest(
      connection,
      invoiceNumber,
      items,
      finalCompanyId
    );

    if (!validation.ok) {
      await connection.rollback();
      return res.status(validation.status || 400).json({
        success: false,
        message: validation.message
      });
    }

    const cleanInvoiceNumber = validation.invoiceNumber;

    const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || 0), 0);

    const [saleInsert] = await connection.query(
      `
      INSERT INTO sales_history
      (
        invoice_number, customer_name, mobile, gst_number, invoice_date,
        payment_mode, payment_status, paid_amount, due_amount,
        total_items, total_weight,
        rate_per_gram, mc_rate, round_off, subtotal, total_amount, created_at, company_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        cleanInvoiceNumber,
        customerName,
        mobile,
        gstNumber,
        invoiceDate,
        paymentMode,
        paymentStatus,
        Number(paidAmount || 0),
        Number(dueAmount || 0),
        Number(items.length || 0),
        Number(totalWeight || 0),
        Number(ratePerGram || 0),
        Number(mcRate || 0),
        Number(roundOff || 0),
        Number(subtotal || 0),
        Number(grandTotal || 0),
        finalCompanyId
      ]
    );

    const saleId = saleInsert.insertId;

    for (const item of items) {
      const barcode = String(item.barcode || "").trim();

      await connection.query(
        `
        INSERT INTO sales_items
        (
          sale_id, invoice_number, barcode, product_name, sku, purity, size, weight, lot_number, customer_name, created_at, company_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `,
        [
          saleId,
          cleanInvoiceNumber,
          barcode,
          item.productName || item.product_name || "",
          item.sku || "",
          item.purity || "",
          item.size || "",
          Number(item.weight || 0),
          item.lot || item.lot_number || "",
          customerName,
          finalCompanyId
        ]
      );

      if (barcode) {
        const [stockUpdateResult] = await connection.query(
          `
          UPDATE stock
          SET status = 'SOLD', invoice_number = ?, sold_at = NOW()
          WHERE barcode = ?
            AND company_id = ?
            ${getSellableStockFilterSql()}
            AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
            AND UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
          `,
          [cleanInvoiceNumber, barcode, finalCompanyId]
        );

        const affectedRows = assertSingleStockRowAffected(stockUpdateResult);
        if (affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Barcode ${barcode} could not be marked as SOLD in this company's stock`
          });
        }
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Invoice saved successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("Save invoice error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Invoice save failed"),
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   SAVE BILLING
========================= */
app.post("/saveBilling", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const {
      invoiceNumber = "",
      customerName = "",
      mobile = "",
      gstNo = "",
      billDate = "",
      paymentMode = "",
      paymentStatus = "",
      paidAmount = 0,
      dueAmount = 0,
      billType = "",
      taxType = "",
      totalAmount = 0,
      totalItems = 0,
      totalCount = 0,
      totalWeight = 0,
      ratePerGram = 0,
      companyRatePerGram = 0,
      sellingRatePerGram = 0,
      marginPerGram = 0,
      mcRate = 0,
      roundOff = 0,
      subtotal = 0,
      customerSubtotal = 0,
      customerTotal = 0,
      companySubtotal = 0,
      companyTotal = 0,
      employeeMargin = 0,
      employeeName = "",
      metalPercent = 0,
      metalPayable = 0,
      metalNote = "",
      items = [],
      invoiceDraftId = null,
      branchId = null,
      branch_id = null,
      company_id = null,
      companyId = null
    } = req.body;

    const finalCompanyId = access.companyScope;
    const submittedBranchId = getRequestedBranchScopeValue({ ...req, body: { ...req.body, branchId: branchId ?? branch_id } });
    const billingBranchId = access.isBranchLocked ? access.userBranchId : submittedBranchId;
    const branchScope = await resolveOperationalBranchScope(connection, access, billingBranchId);
    if (!branchScope.ok) {
      await connection.rollback();
      return res.status(branchScope.status || 403).json({
        success: false,
        message: branchScope.message || "Branch access denied"
      });
    }

    let finalInvoiceNumber = String(invoiceNumber || "").trim();

    if (!finalInvoiceNumber) {
      finalInvoiceNumber = await generateInvoiceNumberForCompany(
        connection,
        finalCompanyId,
        billDate,
        "BILL"
      );
    }

    const validation = await validateInvoiceSaveRequest(
      connection,
      finalInvoiceNumber,
      items,
      finalCompanyId,
      branchScope
    );

    if (!validation.ok) {
      await connection.rollback();
      return res.status(validation.status || 400).json({
        success: false,
        message: validation.message
      });
    }

    const cleanInvoiceNumber = validation.invoiceNumber;

    const finalTotalItems = Number(totalItems || totalCount || items.length || 0);
    const finalTotalWeight = Number(
      totalWeight || items.reduce((sum, item) => sum + Number(item.weight || 0), 0)
    );

    const billingTotalsValidation = validateBillingTotals({
      billType,
      taxType,
      totalAmount,
      totalWeight: finalTotalWeight,
      ratePerGram,
      sellingRatePerGram,
      companyRatePerGram,
      mcRate,
      roundOff,
      subtotal,
      customerSubtotal,
      customerTotal,
      companyTotal,
      employeeMargin,
      paidAmount,
      dueAmount,
      items
    });

    if (!billingTotalsValidation.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: billingTotalsValidation.message
      });
    }

    const billingTotals = billingTotalsValidation.totals;
    const billingLines = Array.isArray(billingTotals?.lines) ? billingTotals.lines : [];
    const ledgerItems = items.map((item, index) => {
      const line = billingLines[index] || {};
      return {
        ...item,
        pureWeight: line.pureWeight,
        pure_weight: line.pureWeight,
        fineWeight: line.pureWeight,
        fine_weight: line.pureWeight,
        companyRatePerGram: line.companyRatePerGram,
        company_rate_per_gram: line.companyRatePerGram,
        sellingRatePerGram: line.sellingRatePerGram,
        selling_rate_per_gram: line.sellingRatePerGram,
        customerLineAmount: line.customerLineAmount,
        customer_line_amount: line.customerLineAmount,
        companyLineAmount: line.companyLineAmount,
        company_line_amount: line.companyLineAmount,
        employeeMarginAmount: line.employeeMarginAmount,
        employee_margin_amount: line.employeeMarginAmount,
        totalPrice: line.customerLineAmount,
        total_price: line.customerLineAmount
      };
    });

    const [saleInsert] = await connection.query(
      `
      INSERT INTO sales_history
      (
        invoice_number,
        customer_name,
        mobile,
        gst_number,
        invoice_date,
        payment_mode,
        payment_status,
        paid_amount,
        due_amount,
        total_items,
        total_weight,
        rate_per_gram,
        company_rate_per_gram,
        selling_rate_per_gram,
        margin_per_gram,
        mc_rate,
        round_off,
        subtotal,
        customer_subtotal,
        customer_total_amount,
        company_subtotal,
        company_total_amount,
        employee_margin_amount,
        employee_name,
        total_amount,
        status,
        company_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NOW())
      `,
      [
        cleanInvoiceNumber,
        String(customerName || "").trim(),
        String(mobile || "").trim(),
        String(gstNo || "").trim(),
        String(billDate || "").trim(),
        String(paymentMode || "").trim(),
        String(paymentStatus || "").trim(),
        Number(paidAmount || 0),
        Number(dueAmount || 0),
        Number(billingTotals.totalItems || 0),
        Number(billingTotals.totalWeight || 0),
        Number(ratePerGram || 0),
        Number(companyRatePerGram || 0),
        Number(sellingRatePerGram || ratePerGram || 0),
        Number(marginPerGram || 0),
        Number(mcRate || 0),
        Number(roundOff || 0),
        Number(billingTotals.subtotal || 0),
        Number(billingTotals.customerSubtotal || 0),
        Number(billingTotals.customerTotal || 0),
        Number(billingTotals.companySubtotal || 0),
        Number(billingTotals.companyTotal || 0),
        Number(billingTotals.employeeMargin || 0),
        String(employeeName || "").trim(),
        Number(billingTotals.totalAmount || 0),
        finalCompanyId
      ]
    );

    const saleId = saleInsert.insertId;

    for (const [index, item] of items.entries()) {
      const barcode = String(item.barcode || "").trim();
      const line = billingLines[index] || {};

      await connection.query(
        `
        INSERT INTO sales_items
        (
          sale_id,
          invoice_number,
          barcode,
          product_name,
          sku,
          purity,
          size,
          weight,
          lot_number,
          customer_name,
          pure_weight,
          company_rate_per_gram,
          selling_rate_per_gram,
          customer_line_amount,
          company_line_amount,
          employee_margin_amount,
          employee_name,
          company_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          saleId,
          cleanInvoiceNumber,
          barcode,
          String(item.itemName || item.productName || item.product_name || "").trim(),
          String(item.sku || "").trim(),
          String(item.purity || "").trim(),
          String(item.size || "").trim(),
          Number(item.weight || 0),
          String(item.lot || item.lot_number || "").trim(),
          String(customerName || "").trim(),
          Number(line.pureWeight || 0),
          Number(line.companyRatePerGram || 0),
          Number(line.sellingRatePerGram || 0),
          Number(line.customerLineAmount || 0),
          Number(line.companyLineAmount || 0),
          Number(line.employeeMarginAmount || 0),
          String(item.employeeName || employeeName || "").trim(),
          finalCompanyId
        ]
      );

      if (barcode) {
        const [stockUpdateResult] = await connection.query(
          `
          UPDATE stock
          SET status = 'SOLD',
              invoice_number = ?,
              sold_at = NOW(),
              deleted_at = NULL
          WHERE barcode = ?
            AND company_id = ?
            ${getSellableStockFilterSql()}
            AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
            AND UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
            ${branchScope.isBranchFiltered ? "AND current_branch_id = ?" : ""}
          `,
          branchScope.isBranchFiltered
            ? [cleanInvoiceNumber, barcode, finalCompanyId, branchScope.branchId]
            : [cleanInvoiceNumber, barcode, finalCompanyId]
        );

        const affectedRows = assertSingleStockRowAffected(stockUpdateResult);
        if (affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Barcode ${barcode} could not be marked as SOLD in this company's stock`
          });
        }
      }
    }

    await postBillingToTransactionFoundation(connection, {
      companyId: finalCompanyId,
      createdBy: access.actingUserId ?? getRequestedUserId(req),
      invoiceNumber: cleanInvoiceNumber,
      customerName: String(customerName || "").trim(),
      mobile: String(mobile || "").trim(),
      gstNo: String(gstNo || "").trim(),
      billDate: String(billDate || "").trim(),
      paymentMode: String(paymentMode || "").trim(),
      paymentStatus: String(paymentStatus || "").trim(),
      paidAmount: Number(paidAmount || 0),
      dueAmount: Number(dueAmount || 0),
      totalAmount: Number(billingTotals.totalAmount || 0),
      totalWeight: Number(billingTotals.totalWeight || 0),
      ratePerGram: Number(ratePerGram || 0),
      mcRate: Number(mcRate || 0),
      roundOff: Number(roundOff || 0),
      subtotal: Number(billingTotals.subtotal || 0),
      metalPercent: Number(metalPercent || 0),
      metalPayable: Number(metalPayable || 0),
      metalNote: String(metalNote || "").trim(),
      items: ledgerItems
    });

    const cleanDraftId = Number(invoiceDraftId || 0);
    if (cleanDraftId > 0) {
      await connection.query(
        `
        UPDATE invoice_drafts
        SET status = 'CONVERTED',
            converted_invoice_no = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
          AND company_id = ?
        `,
        [
          cleanInvoiceNumber,
          access.actingUserId ?? getRequestedUserId(req),
          cleanDraftId,
          finalCompanyId
        ]
      );

      await connection.query(
        `
        UPDATE invoice_draft_items
        SET item_stage = 'CONVERTED',
            updated_at = NOW()
        WHERE draft_id = ?
        `,
        [cleanDraftId]
      );
    }

    await writeAuditLogSafe(connection, req, {
      companyId: finalCompanyId,
      userId: access.actingUserId ?? getRequestedUserId(req) ?? null,
      actionType: "CREATE",
      entityType: "SALE",
      entityId: cleanInvoiceNumber,
      beforeData: null,
      afterData: {
        saleId,
        invoiceNumber: cleanInvoiceNumber,
        customerName: String(customerName || "").trim(),
        mobile: String(mobile || "").trim(),
        paymentMode: String(paymentMode || "").trim(),
        paymentStatus: String(paymentStatus || "").trim(),
        paidAmount: Number(paidAmount || 0),
        dueAmount: Number(dueAmount || 0),
        totalAmount: Number(billingTotals.totalAmount || 0),
        totalItems: Number(billingTotals.totalItems || 0),
        totalWeight: Number(billingTotals.totalWeight || 0)
      }
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Billing saved successfully",
      invoiceNumber: cleanInvoiceNumber
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Save billing error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Server error"),
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   SALES HISTORY
========================= */
app.get("/getSalesHistory", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;

    const [sales] = await pool.query(
      `
      SELECT 
        sh.*,
        (SELECT COUNT(*) FROM sales_items si WHERE si.sale_id = sh.id) AS total_items
      FROM sales_history sh
      ${companyId !== null ? "WHERE sh.company_id = ? AND COALESCE(sh.is_deleted, 0) = 0" : "WHERE COALESCE(sh.is_deleted, 0) = 0"}
      ORDER BY sh.id DESC
      `,
      companyId !== null ? [companyId] : []
    );

    return res.json({
      success: true,
      sales
    });
  } catch (error) {
    console.error("Sales history error:", error);
    return res.status(500).json({
      success: false,
      message: "Sales history fetch failed"
    });
  }
});

app.get("/sales-history", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const showDeleted = String(req.query.deleted || "").trim() === "1";
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 1000 });

    const [sales] = await pool.query(
      `
      SELECT 
        sh.*,
        (SELECT COUNT(*) FROM sales_items si WHERE si.sale_id = sh.id) AS total_items
      FROM sales_history sh
      ${companyId !== null
        ? `WHERE sh.company_id = ? AND COALESCE(sh.is_deleted, 0) = ${showDeleted ? 1 : 0}`
        : `WHERE COALESCE(sh.is_deleted, 0) = ${showDeleted ? 1 : 0}`}
      ORDER BY sh.id DESC
      ${pagination.sql}
      `,
      companyId !== null ? [companyId] : []
    );

    setPaginationHeaders(res, pagination);
    return res.json(sales);
  } catch (error) {
    console.error("Sales history error:", error);
    return res.status(500).json([]);
  }
});

/* =========================
   INVOICE ITEMS
========================= */
app.get("/getInvoiceItems/:invoiceNumber", authMiddleware, async (req, res) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;

    const [items] = await pool.query(
      `
      SELECT *
      FROM sales_items
      WHERE invoice_number = ?
      AND COALESCE(is_deleted, 0) = 0
      ${companyId !== null ? "AND company_id = ?" : ""}
      ORDER BY id DESC
      `,
      companyId !== null ? [invoiceNumber, companyId] : [invoiceNumber]
    );

    return res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error("Invoice items error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice items fetch failed"
    });
  }
});

app.put("/process/lots/:lotNo/complete", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const lotNo = normalizeProcessLotNo(req.params.lotNo || req.body.lotNo || req.body.lot_no);
    const workCategory = normalizeWorkCategory(req.query.workCategory || req.query.work_category || req.body.workCategory || req.body.work_category || "REGULAR_SANKHA");
    if (!lotNo) {
      return res.status(400).json({
        success: false,
        message: "lotNo is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const processLot = await getProcessLotForSteps(connection, access.companyScope, lotNo, workCategory);
    if (!processLot) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Process lot not found"
      });
    }

    if (isManualProcessLot(processLot)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Manual lots are not available in the process workflow yet"
      });
    }

    const destination = getWorkCategoryDestination(workCategory);
    const openStep = await getOpenProcessStep(connection, access.companyScope, processLot.id);
    if (openStep) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Complete all OPEN process steps before completing the lot"
      });
    }

    const finalStep = await getLastCompletedProcessStep(connection, access.companyScope, processLot.id);
    if (!finalStep) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "At least one completed process step is required before completing the lot"
      });
    }

    if (toNumber(finalStep.output_weight) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Latest completed process step must have output weight greater than zero before completing the lot"
      });
    }

    const [negativeLossRows] = await connection.query(
      `
      SELECT id, step_no, process_name, loss_weight
      FROM process_steps
      WHERE company_id = ?
        AND process_lot_id = ?
        AND status = 'COMPLETED'
        AND COALESCE(loss_weight, 0) < 0
      LIMIT 1
      `,
      [access.companyScope, processLot.id]
    );

    if (negativeLossRows.length) {
      const badStep = negativeLossRows[0];
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Process step ${badStep.step_no || badStep.id} has negative loss. Correct the process loss before completing the lot.`
      });
    }

    if (isOutsideKarigarCategory(workCategory)) {
      const [pendingOutsideRows] = await connection.query(
        `
        SELECT COALESCE(SUM(pending_weight), 0) AS pending_weight
        FROM outside_karigar_ledger
        WHERE company_id = ?
          AND process_lot_id = ?
          AND work_category = ?
          AND COALESCE(pending_weight, 0) > 0
          AND UPPER(COALESCE(status, 'ISSUED')) IN ('ISSUED', 'PARTIAL_RECEIVED')
        `,
        [access.companyScope, processLot.id, workCategory]
      );
      const pendingOutsideWeight = toNumber(pendingOutsideRows[0]?.pending_weight);

      if (pendingOutsideWeight > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot complete this lot. Outside karigar pending weight is ${pendingOutsideWeight.toFixed(3)}g. Receive pending work first.`
        });
      }
    }

    const templateContext = await getProcessTemplateStepsForLot(connection, access.companyScope, processLot);
    const templateSteps = templateContext.steps || [];

    if (templateSteps.length) {
      const [completedStepRows] = await connection.query(
        `
        SELECT process_name
        FROM process_steps
        WHERE company_id = ?
          AND process_lot_id = ?
          AND status = 'COMPLETED'
        ORDER BY step_no ASC, id ASC
        `,
        [access.companyScope, processLot.id]
      );
      const completedNameSet = new Set(
        completedStepRows
          .map((row) => normalizeTemplateStepName(row.process_name))
          .filter(Boolean)
      );
      const missingTemplateStep = templateSteps.find((step) => {
        return !completedNameSet.has(normalizeTemplateStepName(step.stepName));
      });
      const finalTemplateStep = templateSteps[templateSteps.length - 1];
      const finalStepReached = completedNameSet.has(normalizeTemplateStepName(finalTemplateStep?.stepName));

      if (missingTemplateStep || !finalStepReached) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Process template is not complete. Complete final step "${finalTemplateStep?.stepName || "Final Step"}" before completing the lot.`
        });
      }
    }

    await connection.query(
      `
      UPDATE process_lots
      SET status = 'COMPLETED',
          completed_at = NOW(),
          completed_by = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [access.actingUserId || null, processLot.id]
    );

    const directStockItem = destination === "STOCK"
      ? await moveCompletedProcessLotToStock(
        connection,
        access.companyScope,
        processLot,
        finalStep,
        access.actingUserId || null
      )
      : null;

    const [savedRows] = await connection.query(
      `
      SELECT *
      FROM process_lots
      WHERE id = ?
      LIMIT 1
      `,
      [processLot.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: destination === "STOCK"
        ? "Lot completed. Added to Stock."
        : "Lot completed. Ready for Sticker.",
      destination,
      directStockItem,
      lot: savedRows.length ? normalizeProcessLotRow(savedRows[0]) : null
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Complete process lot error:", error);
    return res.status(500).json({
      success: false,
      message: "Process lot completion failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/sales-history/payment-history/:invoiceNumber", authMiddleware, async (req, res) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required"
      });
    }

    const companyId = access.companyScope;

    const [rows] = await pool.query(
      `
      SELECT
        tm.id,
        tm.voucher_no,
        tm.voucher_date,
        tm.payment_mode,
        COALESCE(ts.cash_amount, 0) AS amount,
        COALESCE(tm.note, tm.remarks, '') AS note
      FROM invoice_transaction_link itl
      INNER JOIN transaction_master tm ON tm.id = itl.transaction_id
      LEFT JOIN transaction_settlements ts ON ts.transaction_id = tm.id
      WHERE itl.company_id = ?
        AND itl.invoice_no = ?
        AND tm.transaction_type = 'PAYMENT_RECEIVED'
      ORDER BY tm.id DESC
      `,
      [companyId, invoiceNumber]
    );

    return res.json({
      success: true,
      history: rows.map((row) => ({
        id: row.id,
        voucherNo: row.voucher_no || "",
        paymentDate: row.voucher_date || "",
        paymentMode: row.payment_mode || "",
        amount: toNumber(row.amount),
        note: String(row.note || "").trim()
      }))
    });
  } catch (error) {
    console.error("Sales history payment history error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment history fetch failed"
    });
  }
});

app.post("/sales-history/update-payment", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const createdBy = access.actingUserId ?? getRequestedUserId(req);
    const invoiceNumber = String(req.body.invoiceNo || req.body.invoice_number || "").trim();
    const paymentMode = String(req.body.paymentMode || req.body.payment_mode || "").trim();
    const note = String(req.body.note || "").trim();
    const paymentAmount = toNumber(req.body.amount);
    const paymentDate = getTodayDateOnly();

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required"
      });
    }

    if (!(paymentAmount > 0)) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [salesRows] = await connection.query(
      `
      SELECT *
      FROM sales_history
      WHERE invoice_number = ? AND company_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [invoiceNumber, companyId]
    );

    const saleRow = salesRows[0];
    if (!saleRow) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Sale record not found"
      });
    }

    if (Number(saleRow.is_deleted || 0) === 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot update payment for deleted sale"
      });
    }

    const currentPaid = toNumber(saleRow.paid_amount);
    const currentDue = toNumber(saleRow.due_amount);
    if (currentDue <= 0.009) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This invoice is already fully paid"
      });
    }

    if (paymentAmount - currentDue > 0.009) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed due amount"
      });
    }

    const saleTxn = await findExistingSaleInvoiceTransaction(connection, companyId, invoiceNumber);
    if (!saleTxn?.id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Original sale transaction not found"
      });
    }

    const [saleTxnRows] = await connection.query(
      `
      SELECT id, voucher_no, party_id, party_type
      FROM transaction_master
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [saleTxn.id, companyId]
    );

    const saleTxnRow = saleTxnRows[0];
    if (!saleTxnRow?.party_id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Customer transaction party not found"
      });
    }

    const party = await getPartyByIdForCompany(connection, companyId, saleTxnRow.party_id);
    if (!party) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Customer party record not found"
      });
    }

    const [paymentCountRows] = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM invoice_transaction_link itl
      INNER JOIN transaction_master tm ON tm.id = itl.transaction_id
      WHERE itl.company_id = ?
        AND itl.invoice_no = ?
        AND tm.transaction_type = 'PAYMENT_RECEIVED'
      `,
      [companyId, invoiceNumber]
    );
    const paymentCount = Number(paymentCountRows[0]?.total || 0);
    const paymentVoucherNo = `PAY-${invoiceNumber}-${paymentCount + 1}`;

    const newDue = Math.max(currentDue - paymentAmount, 0);
    const newPaid = currentPaid + paymentAmount;
    const newStatus = newDue <= 0.009 ? "PAID" : "PARTIAL";

    const [paymentTxnInsert] = await connection.query(
      `
      INSERT INTO transaction_master
      (
        company_id, voucher_no, voucher_date, transaction_type, party_id, party_type,
        status, reference_no, invoice_no, source_module, payment_mode, payment_status,
        remarks, note, created_by
      )
      VALUES (?, ?, ?, 'PAYMENT_RECEIVED', ?, ?, 'POSTED', ?, ?, 'sales-history', ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        paymentVoucherNo,
        paymentDate,
        party.id,
        saleTxnRow.party_type || party.party_type || "CUSTOMER",
        invoiceNumber,
        invoiceNumber,
        paymentMode || "Cash",
        newStatus,
        "Due payment received from sales history",
        note || `Additional receipt ${paymentAmount.toFixed(2)}`,
        createdBy
      ]
    );

    const paymentTransactionId = paymentTxnInsert.insertId;

    await connection.query(
      `
      INSERT INTO transaction_settlements
      (
        company_id, transaction_id, settlement_type, against_transaction_id,
        against_invoice_no, against_voucher_no, cash_amount, settlement_date,
        remarks, created_by
      )
      VALUES (?, ?, 'CASH', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        paymentTransactionId,
        saleTxn.id,
        invoiceNumber,
        saleTxn.voucher_no || invoiceNumber,
        paymentAmount,
        paymentDate,
        note || "Sales history due settlement",
        createdBy
      ]
    );

    await connection.query(
      `
      INSERT INTO invoice_transaction_link
      (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
      VALUES (?, ?, ?, 'PAYMENT_RECEIVED', ?, ?)
      `,
      [companyId, invoiceNumber, paymentTransactionId, "Sales history payment posting", createdBy]
    );

    await createCashLedgerEntry(connection, {
      companyId,
      partyId: party.id,
      transactionId: paymentTransactionId,
      entryDate: paymentDate,
      entryType: "CREDIT",
      debitAmount: 0,
      creditAmount: paymentAmount,
      referenceType: "PAYMENT_RECEIVED",
      referenceNo: paymentVoucherNo,
      remarks: note || "Sales history payment received",
      createdBy
    });

    await connection.query(
      `
      UPDATE sales_history
      SET paid_amount = ?, due_amount = ?, payment_status = ?, payment_mode = ?
      WHERE id = ?
      `,
      [newPaid, newDue, newStatus, paymentMode || saleRow.payment_mode || "Cash", saleRow.id]
    );

    await writeAuditLogSafe(connection, req, {
      companyId,
      userId: createdBy ?? null,
      actionType: "PAYMENT_UPDATE",
      entityType: "PAYMENT",
      entityId: invoiceNumber,
      beforeData: {
        id: saleRow.id,
        invoice_number: saleRow.invoice_number,
        payment_mode: saleRow.payment_mode,
        payment_status: saleRow.payment_status,
        paid_amount: toNumber(saleRow.paid_amount),
        due_amount: toNumber(saleRow.due_amount),
        total_amount: toNumber(saleRow.total_amount)
      },
      afterData: {
        id: saleRow.id,
        invoice_number: invoiceNumber,
        payment_mode: paymentMode || saleRow.payment_mode || "Cash",
        payment_status: newStatus,
        paid_amount: newPaid,
        due_amount: newDue,
        total_amount: toNumber(saleRow.total_amount),
        payment_received: paymentAmount,
        transaction_id: paymentTransactionId,
        note
      }
    });

    await recalcPartyBalanceSummary(connection, companyId, party.id, paymentTransactionId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Payment updated successfully",
      paidAmount: newPaid,
      dueAmount: newDue,
      paymentStatus: newStatus,
      transactionId: paymentTransactionId,
      settlementCreated: true
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("Sales history payment update error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment update failed"
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/sales-history/:invoiceNumber", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  let connection;

  try {
    const invoiceNumber = String(req.params.invoiceNumber || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required"
      });
    }

    const companyId = access.companyScope;
    const deletedBy = access.actingUserId ?? getRequestedUserId(req) ?? null;
    const deleteReason = String(req.body?.reason || req.query?.reason || "").trim().slice(0, 255);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [saleRows] = await connection.query(
      `
      SELECT *
      FROM sales_history
      WHERE invoice_number = ? AND company_id = ? AND COALESCE(is_deleted, 0) = 0
      ORDER BY id DESC
      LIMIT 1
      `,
      [invoiceNumber, companyId]
    );

    if (!saleRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Sale record not found"
      });
    }

    await writeAuditLogSafe(connection, req, {
      companyId,
      userId: deletedBy,
      actionType: "DELETE",
      entityType: "SALE",
      entityId: invoiceNumber,
      beforeData: {
        sale: saleRows[0]
      },
      afterData: {
        deleted: true,
        invoiceNumber,
        deletedBy,
        deleteReason
      }
    });

    await connection.query(
      `
      UPDATE sales_items
      SET is_deleted = 1,
          deleted_at = NOW(),
          deleted_by = ?,
          delete_reason = ?
      WHERE invoice_number = ? AND company_id = ?
      `,
      [deletedBy, deleteReason, invoiceNumber, companyId]
    );

    await connection.query(
      `
      UPDATE sales_history
      SET is_deleted = 1,
          deleted_at = NOW(),
          deleted_by = ?,
          delete_reason = ?
      WHERE invoice_number = ? AND company_id = ?
      `,
      [deletedBy, deleteReason, invoiceNumber, companyId]
    );

    await connection.commit();
    return res.json({
      success: true,
      message: "Sale deleted successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("Permanent sales delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Permanent delete failed"
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/sales-history/:invoiceNumber/restore", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  let connection;

  try {
    const invoiceNumber = String(req.params.invoiceNumber || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required"
      });
    }

    const companyId = access.companyScope;
    const restoredBy = access.actingUserId ?? getRequestedUserId(req) ?? null;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [saleRows] = await connection.query(
      `
      SELECT *
      FROM sales_history
      WHERE invoice_number = ? AND company_id = ? AND COALESCE(is_deleted, 0) = 1
      ORDER BY id DESC
      LIMIT 1
      `,
      [invoiceNumber, companyId]
    );

    if (!saleRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Deleted sale record not found"
      });
    }

    await connection.query(
      `
      UPDATE sales_items
      SET is_deleted = 0,
          deleted_at = NULL,
          deleted_by = NULL,
          delete_reason = ''
      WHERE invoice_number = ? AND company_id = ?
      `,
      [invoiceNumber, companyId]
    );

    await connection.query(
      `
      UPDATE sales_history
      SET is_deleted = 0,
          deleted_at = NULL,
          deleted_by = NULL,
          delete_reason = ''
      WHERE invoice_number = ? AND company_id = ?
      `,
      [invoiceNumber, companyId]
    );

    await writeAuditLogSafe(connection, req, {
      companyId,
      userId: restoredBy,
      actionType: "RESTORE",
      entityType: "SALE",
      entityId: invoiceNumber,
      beforeData: {
        sale: saleRows[0]
      },
      afterData: {
        restored: true,
        invoiceNumber,
        restoredBy
      }
    });

    await connection.commit();
    return res.json({
      success: true,
      message: "Sale restored successfully"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error("Restore sale error:", error);
    return res.status(500).json({
      success: false,
      message: "Restore failed"
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   RETURN ITEM
========================= */
app.put("/returnItem/:barcode", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "STAFF"]), async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    await ensureSingleStockBarcode(companyId, barcode);

    const [result] = await pool.query(
      `
      UPDATE stock
      SET status = 'IN_STOCK',
          invoice_number = '',
          sold_at = NULL
      WHERE barcode = ? AND company_id = ?
        ${getSellableStockFilterSql()}
      `,
      [barcode, companyId]
    );
    const affectedRows = assertSingleStockRowAffected(result);

    if (affectedRows === 0) {
      return res.json({
        success: false,
        message: "Item not found"
      });
    }

    return res.json({
      success: true,
      message: "Item returned successfully"
    });
  } catch (error) {
    console.error("Return item error:", error);
    return res.status(getBarcodeSafetyStatus(error)).json({
      success: false,
      message: getBarcodeSafetyMessage(error, "Return failed"),
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   COMPANY SIGNUP REQUEST
========================= */
app.post("/requestCompanySignup", async (req, res) => {
  try {
    const {
      companyName = "",
      ownerName = "",
      mobile = "",
      email = "",
      password = ""
    } = req.body;

    const cleanCompanyName = String(companyName).trim();
    const cleanOwnerName = String(ownerName).trim();
    const cleanMobile = String(mobile).trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password).trim();

    if (!cleanCompanyName || !cleanOwnerName || !cleanEmail || !cleanPassword) {
      return res.json({
        success: false,
        message: "Company name, owner name, email, and password are required"
      });
    }

    const [existingRequest] = await pool.query(
      `
      SELECT id
      FROM company_signup_requests
      WHERE LOWER(owner_email) = LOWER(?)
        AND LOWER(COALESCE(status, '')) = 'pending'
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (existingRequest.length > 0) {
      return res.json({
        success: false,
        message: "This signup request is already pending"
      });
    }

    const [existingUser] = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [cleanEmail]
    );

    if (existingUser.length > 0) {
      return res.json({
        success: false,
        message: "This email already exists in the system"
      });
    }

    const passwordHash = await hashPassword(cleanPassword);

    await pool.query(
      `
      INSERT INTO company_signup_requests
      (company_name, owner_name, mobile, owner_email, password, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [cleanCompanyName, cleanOwnerName, cleanMobile, cleanEmail, passwordHash, "pending"]
    );

    return res.json({
      success: true,
      message: "The signup request has been submitted for admin approval"
    });
  } catch (error) {
    console.error("Company signup request error:", error);
    return res.status(500).json({
      success: false,
      message: "Company signup request failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/pendingCompanyRequests", authMiddleware, async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const [rows] = await pool.query(`
      SELECT *
      FROM company_signup_requests
      WHERE LOWER(COALESCE(status, '')) = 'pending'
      ORDER BY id DESC
    `);

    return res.json({
      success: true,
      requests: rows
    });
  } catch (error) {
    console.error("Pending company requests error:", error);
    return res.status(500).json({
      success: false,
      message: "Pending company requests fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/approveCompanyRequest/:id", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  let connection;

  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const requestId = Number(req.params.id);

    if (!requestId) {
      return res.json({
        success: false,
        message: "Request id is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [requestRows] = await connection.query(
      `
      SELECT *
      FROM company_signup_requests
      WHERE id = ?
        AND LOWER(COALESCE(status, '')) = 'pending'
      LIMIT 1
      `,
      [requestId]
    );

    if (!requestRows.length) {
      await connection.rollback();
      return res.json({
        success: false,
        message: "Pending request not found"
      });
    }

    const requestData = requestRows[0];

    const [existingCompany] = await connection.query(
      `SELECT id FROM companies WHERE LOWER(owner_email) = LOWER(?) LIMIT 1`,
      [requestData.owner_email]
    );

    if (existingCompany.length > 0) {
      await connection.rollback();
      return res.json({
        success: false,
        message: "A company already exists for this email"
      });
    }

    const [existingUser] = await connection.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [requestData.owner_email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.json({
        success: false,
        message: "A user already exists for this email"
      });
    }

    const [companyInsert] = await connection.query(
      `
      INSERT INTO companies (company_name, owner_name, owner_email, status, created_at)
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        requestData.company_name,
        requestData.owner_name,
        requestData.owner_email,
        "active"
      ]
    );

    const companyId = companyInsert.insertId;
    const approvedPasswordHash = looksLikeBcryptHash(requestData.password)
      ? String(requestData.password)
      : await hashPassword(requestData.password);

    await connection.query(
      `
      INSERT INTO users (name, mobile, email, password, role, status, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        requestData.owner_name,
        requestData.mobile || "",
        requestData.owner_email,
        approvedPasswordHash,
        "Admin",
        "approved",
        companyId
      ]
    );

    await connection.query(
      `
      UPDATE company_signup_requests
      SET status = 'approved', approved_at = NOW(), company_id = ?
      WHERE id = ?
      `,
      [companyId, requestId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "The company and admin user have been created successfully",
      companyId
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Approve company request error:", error);
    return res.status(500).json({
      success: false,
      message: "Approve company request failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/rejectCompanyRequest/:id", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const requestId = Number(req.params.id);

    if (!requestId) {
      return res.json({
        success: false,
        message: "Request id is required"
      });
    }

    const [requestRows] = await pool.query(
      `
      SELECT id
      FROM company_signup_requests
      WHERE id = ?
        AND LOWER(COALESCE(status, '')) = 'pending'
      LIMIT 1
      `,
      [requestId]
    );

    if (!requestRows.length) {
      return res.json({
        success: false,
        message: "Pending request not found"
      });
    }

    await pool.query(
      `
      UPDATE company_signup_requests
      SET status = 'rejected', rejected_at = NOW()
      WHERE id = ?
      `,
      [requestId]
    );

    return res.json({
      success: true,
      message: "Company request rejected successfully"
    });
  } catch (error) {
    console.error("Reject company request error:", error);
    return res.status(500).json({
      success: false,
      message: "Reject company request failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/approvedCompanies", authMiddleware, async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const [rows] = await pool.query(`
      SELECT *
      FROM companies
      WHERE deleted_at IS NULL
        AND UPPER(COALESCE(access_status, 'ACTIVE')) <> 'SOFT_DELETED'
      ORDER BY id DESC
    `);

    return res.json({
      success: true,
      companies: rows
    });
  } catch (error) {
    console.error("Approved companies error:", error);
    return res.status(500).json({
      success: false,
      message: "Approved companies fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/deleted-companies", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const [rows] = await pool.query(`
      SELECT *
      FROM companies
      WHERE deleted_at IS NOT NULL
         OR UPPER(COALESCE(access_status, '')) = 'SOFT_DELETED'
      ORDER BY COALESCE(deleted_at, updated_at, created_at) DESC, id DESC
    `);

    return res.json({
      success: true,
      companies: rows
    });
  } catch (error) {
    console.error("Deleted companies error:", error);
    return res.status(500).json({
      success: false,
      message: "Deleted companies fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/company-module-context", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) return sendAccessError(res, access);

    const companyId = Number(access.companyScope || 0);
    const planContext = await getCompanyPlanContext(companyId);
    const moduleContext = await getCompanyEnabledModules(companyId);

    return res.json({
      success: true,
      company_id: companyId,
      plan: planContext.plan,
      modules: moduleContext.modules,
      module_list: moduleContext.module_list,
      is_fallback: Boolean(planContext.is_fallback || moduleContext.is_fallback)
    });
  } catch (error) {
    console.error("Company module context error:", error);
    return res.status(500).json({
      success: false,
      message: "Company module context fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/erp-modules", authMiddleware, async (_req, res) => {
  try {
    const modules = await getSaasModuleCatalogRows();

    return res.json({
      success: true,
      modules
    });
  } catch (error) {
    console.error("ERP modules fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "ERP modules fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/erp-plans", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) return sendAccessError(res, access);

    const role = normalizeRoleValue(access.actingUser?.role || "");
    if (!access.isSuperAdmin && role !== "OWNER") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to view ERP plans"
      });
    }

    const [plans] = await pool.query(
      `
      SELECT
        plan_key,
        plan_name,
        description,
        is_custom,
        status
      FROM erp_plans
      ORDER BY is_custom ASC, id ASC
      `
    );

    return res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error("ERP plans fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "ERP plans fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/company-plan", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) return sendAccessError(res, access);

    const companyId = Number(access.companyScope || 0);
    const planContext = await getCompanyPlanContext(companyId);

    return res.json({
      success: true,
      company_id: companyId,
      plan: planContext.plan,
      effective_from: planContext.effective_from,
      effective_until: planContext.effective_until,
      status: planContext.status,
      assigned_at: planContext.assigned_at ?? null,
      is_fallback: Boolean(planContext.is_fallback)
    });
  } catch (error) {
    console.error("Company plan fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Company plan fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/company-module-access", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) return sendAccessError(res, access);

    const role = normalizeRoleValue(access.actingUser?.role || "");
    if (!access.isSuperAdmin && !isSaasPlanReaderRole(role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to view company module access"
      });
    }

    const companyId = Number(access.companyScope || 0);
    const moduleContext = await getCompanyEnabledModules(companyId);

    return res.json({
      success: true,
      company_id: companyId,
      rows: moduleContext.raw_rows,
      is_fallback: Boolean(moduleContext.is_fallback)
    });
  } catch (error) {
    console.error("Company module access fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Company module access fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/company-plans", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const fullErpModuleCount = ERP_PLAN_MODULES.FULL_ERP.length;

    const [rows] = await pool.query(
      `
      SELECT
        c.id AS company_id,
        c.company_name,
        c.status,
        c.access_status,
        cpa.assigned_at,
        cpa.status AS assignment_status,
        p.plan_key,
        p.plan_name,
        COUNT(cma.id) AS module_row_count,
        COALESCE(SUM(CASE WHEN COALESCE(cma.enabled, 0) = 1 THEN 1 ELSE 0 END), 0) AS enabled_module_count
      FROM companies c
      LEFT JOIN company_plan_assignments cpa ON cpa.company_id = c.id
      LEFT JOIN erp_plans p ON p.id = cpa.plan_id
      LEFT JOIN company_module_access cma ON cma.company_id = c.id
      WHERE c.deleted_at IS NULL
        AND UPPER(COALESCE(c.access_status, 'ACTIVE')) <> 'SOFT_DELETED'
      GROUP BY
        c.id,
        c.company_name,
        c.status,
        c.access_status,
        cpa.assigned_at,
        cpa.status,
        p.plan_key,
        p.plan_name
      ORDER BY c.id DESC
      ${pagination.sql}
      `
    );

    setPaginationHeaders(res, pagination);

    return res.json({
      success: true,
      companies: rows.map((row) => ({
        company_id: row.company_id,
        company_name: row.company_name || "",
        current_plan: row.plan_key
          ? {
              plan_key: normalizePlanKey(row.plan_key),
              plan_name: row.plan_name || row.plan_key
            }
          : {
              plan_key: "FULL_ERP",
              plan_name: "Full ERP"
            },
        enabled_module_count: Number(row.module_row_count || 0) ? Number(row.enabled_module_count || 0) : fullErpModuleCount,
        status: row.access_status || row.status || "",
        assigned_at: row.assigned_at ?? null,
        assignment_status: row.assignment_status || (row.plan_key ? "ACTIVE" : "FALLBACK"),
        is_fallback: !row.plan_key || !Number(row.module_row_count || 0)
      })),
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("SuperAdmin company plans fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "SuperAdmin company plans fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/company-plans/:companyId", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company id is required"
      });
    }

    const [companyRows] = await pool.query(
      `
      SELECT
        id AS company_id,
        company_name,
        owner_name,
        owner_email,
        status,
        access_status,
        login_status,
        created_at
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId]
    );

    if (!companyRows.length) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    const planContext = await getCompanyPlanContext(companyId);
    const moduleContext = await getCompanyEnabledModules(companyId);
    const planKey = normalizePlanKey(planContext.plan?.plan_key || "FULL_ERP");

    const [planModuleRows] = await pool.query(
      `
      SELECT
        epm.module_key,
        m.module_name,
        m.category,
        epm.enabled
      FROM erp_plans p
      JOIN erp_plan_modules epm ON epm.plan_id = p.id
      LEFT JOIN erp_modules m ON m.module_key = epm.module_key
      WHERE p.plan_key = ?
      ORDER BY m.sort_order ASC, epm.module_key ASC
      `,
      [planKey]
    );

    const moduleAccessRows = moduleContext.raw_rows;
    const overrideRows = moduleAccessRows.filter((row) => String(row.source || "").trim().toUpperCase() === "OVERRIDE");
    const enabledModuleCount = moduleContext.module_list.filter((row) => row.enabled).length;

    return res.json({
      success: true,
      company: companyRows[0],
      assigned_plan: {
        ...planContext,
        is_fallback: Boolean(planContext.is_fallback)
      },
      module_rows: moduleContext.module_list,
      plan_modules: planModuleRows.map((row) => ({
        module_key: normalizeModuleKey(row.module_key),
        module_name: row.module_name || row.module_key,
        category: row.category || "",
        enabled: Number(row.enabled || 0) === 1
      })),
      module_access_rows: moduleAccessRows,
      override_rows: overrideRows,
      summary: {
        total_modules: moduleContext.module_list.length,
        enabled_module_count: enabledModuleCount,
        disabled_module_count: Math.max(0, moduleContext.module_list.length - enabledModuleCount),
        plan_module_count: planModuleRows.length,
        override_row_count: overrideRows.length,
        is_fallback: Boolean(planContext.is_fallback || moduleContext.is_fallback)
      }
    });
  } catch (error) {
    console.error("SuperAdmin company plan detail fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "SuperAdmin company plan detail fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/superadmin/company-plans/:companyId/assign", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  let connection;

  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    const planKey = normalizePlanKey(req.body?.plan_key ?? req.body?.planKey);
    const reason = String(req.body?.reason || "").trim();
    const effectiveFrom = String(req.body?.effective_from || req.body?.effectiveFrom || "").trim() || null;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company id is required" });
    }

    if (!planKey) {
      return res.status(400).json({ success: false, message: "plan_key is required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const company = await getCompanyForPlanManagement(connection, companyId);
    if (!company) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const plan = await getPlanForAssignment(connection, planKey);
    if (!plan) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Plan was not found or is inactive" });
    }

    const [currentAssignmentRows] = await connection.query(
      `
      SELECT cpa.*, p.plan_key AS current_plan_key
      FROM company_plan_assignments cpa
      LEFT JOIN erp_plans p ON p.id = cpa.plan_id
      WHERE cpa.company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [companyId]
    );
    const currentAssignment = currentAssignmentRows[0] || null;
    const oldPlanKey = normalizePlanKey(currentAssignment?.current_plan_key || currentAssignment?.plan_key_snapshot || "FULL_ERP");
    const oldAccessMap = await getCompanyModuleAccessMap(connection, companyId);

    await connection.query(
      `
      INSERT INTO company_plan_assignments
      (
        company_id,
        plan_id,
        plan_key_snapshot,
        effective_from,
        effective_until,
        status,
        assigned_by,
        assigned_at,
        updated_by,
        updated_at
      )
      VALUES (?, ?, ?, COALESCE(?, CURDATE()), NULL, 'ACTIVE', ?, NOW(), ?, NOW())
      ON DUPLICATE KEY UPDATE
        plan_id = VALUES(plan_id),
        plan_key_snapshot = VALUES(plan_key_snapshot),
        effective_from = VALUES(effective_from),
        effective_until = VALUES(effective_until),
        status = VALUES(status),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
      `,
      [companyId, plan.id, plan.plan_key, effectiveFrom, access.actingUserId ?? null, access.actingUserId ?? null]
    );

    const [moduleRows] = await connection.query(
      `
      SELECT module_key
      FROM erp_modules
      ORDER BY sort_order ASC, module_key ASC
      `
    );

    let updatedModuleCount = 0;
    let auditRowCount = 0;

    if (Number(plan.is_custom || 0) === 1) {
      if (!oldAccessMap.size) {
        const fallbackKeys = new Set(ERP_PLAN_MODULES.FULL_ERP.map((moduleKey) => normalizeModuleKey(moduleKey)));

        for (const moduleRow of moduleRows) {
          const moduleKey = normalizeModuleKey(moduleRow.module_key);
          const enabled = fallbackKeys.has(moduleKey);
          await connection.query(
            `
            INSERT INTO company_module_access
            (company_id, module_key, enabled, source, reason, updated_by, updated_at)
            VALUES (?, ?, ?, 'OVERRIDE', ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              enabled = VALUES(enabled),
              source = VALUES(source),
              reason = VALUES(reason),
              updated_by = VALUES(updated_by),
              updated_at = NOW()
            `,
            [companyId, moduleKey, Number(enabled), reason || "CUSTOM plan initial FULL_ERP compatibility defaults", access.actingUserId ?? null]
          );
          updatedModuleCount += 1;
          await writeCompanyModuleAccessAudit(connection, {
            companyId,
            moduleKey,
            oldEnabled: null,
            newEnabled: enabled,
            oldPlanKey,
            newPlanKey: plan.plan_key,
            changedBy: access.actingUserId,
            reason: reason || "CUSTOM plan assigned"
          });
          auditRowCount += 1;
        }
      }
    } else {
      const planModuleKeys = await getPlanModuleKeySet(connection, plan.id);

      for (const moduleRow of moduleRows) {
        const moduleKey = normalizeModuleKey(moduleRow.module_key);
        const oldAccess = oldAccessMap.get(moduleKey);
        const nextEnabled = planModuleKeys.has(moduleKey);
        await connection.query(
          `
          INSERT INTO company_module_access
          (company_id, module_key, enabled, source, reason, updated_by, updated_at)
          VALUES (?, ?, ?, 'PLAN', ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            enabled = VALUES(enabled),
            source = VALUES(source),
            reason = VALUES(reason),
            updated_by = VALUES(updated_by),
            updated_at = NOW()
          `,
          [companyId, moduleKey, Number(nextEnabled), reason || `Plan changed to ${plan.plan_key}`, access.actingUserId ?? null]
        );
        updatedModuleCount += 1;

        const shouldAudit = !oldAccess || oldAccess.enabled !== nextEnabled || String(oldAccess.source || "").toUpperCase() !== "PLAN" || oldPlanKey !== plan.plan_key;
        if (shouldAudit) {
          await writeCompanyModuleAccessAudit(connection, {
            companyId,
            moduleKey,
            oldEnabled: oldAccess ? oldAccess.enabled : null,
            newEnabled: nextEnabled,
            oldPlanKey,
            newPlanKey: plan.plan_key,
            changedBy: access.actingUserId,
            reason: reason || `Plan changed to ${plan.plan_key}`
          });
          auditRowCount += 1;
        }
      }
    }

    if (oldPlanKey !== plan.plan_key) {
      await writeCompanyModuleAccessAudit(connection, {
        companyId,
        moduleKey: "PLAN_ASSIGNMENT",
        oldEnabled: null,
        newEnabled: null,
        oldPlanKey,
        newPlanKey: plan.plan_key,
        changedBy: access.actingUserId,
        reason: reason || `Plan changed to ${plan.plan_key}`
      });
      auditRowCount += 1;
    }

    await logActivitySafe(connection, req, access, {
      companyId,
      actionType: "ASSIGN_PLAN",
      entityType: "COMPANY_PLAN",
      entityId: String(companyId),
      moduleName: "company-plans",
      status: "success",
      message: "Company plan assigned",
      beforeData: { plan_key: oldPlanKey },
      afterData: { plan_key: plan.plan_key, updatedModuleCount, auditRowCount }
    });

    await connection.commit();

    const planContext = await getCompanyPlanContext(companyId);
    const moduleContext = await getCompanyEnabledModules(companyId);

    return res.json({
      success: true,
      message: "Company plan assigned successfully",
      company_id: companyId,
      plan: planContext.plan,
      updated_module_count: updatedModuleCount,
      audit_row_count: auditRowCount,
      enabled_module_count: moduleContext.module_list.filter((row) => row.enabled).length
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("SuperAdmin company plan assign error:", error);
    return res.status(500).json({
      success: false,
      message: "Company plan assignment failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/superadmin/company-plans/:companyId/modules", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    if (!companyId) return res.status(400).json({ success: false, message: "Company id is required" });

    const [companyRows] = await pool.query("SELECT id, company_name FROM companies WHERE id = ? LIMIT 1", [companyId]);
    if (!companyRows.length) return res.status(404).json({ success: false, message: "Company not found" });

    const planContext = await getCompanyPlanContext(companyId);
    const moduleContext = await getCompanyEnabledModules(companyId);
    const planKey = normalizePlanKey(planContext.plan?.plan_key || "FULL_ERP");
    const [planModuleRows] = await pool.query(
      `
      SELECT epm.module_key, epm.enabled
      FROM erp_plans p
      JOIN erp_plan_modules epm ON epm.plan_id = p.id
      WHERE p.plan_key = ?
      `,
      [planKey]
    );
    const planEnabledSet = new Set(planModuleRows.filter((row) => Number(row.enabled || 0) === 1).map((row) => normalizeModuleKey(row.module_key)));

    return res.json({
      success: true,
      company: companyRows[0],
      assigned_plan: planContext,
      modules: moduleContext.module_list.map((moduleRow) => ({
        ...moduleRow,
        plan_enabled: planEnabledSet.has(normalizeModuleKey(moduleRow.module_key)),
        is_override: String(moduleRow.source || "").toUpperCase() === "OVERRIDE"
      })),
      summary: {
        total_modules: moduleContext.module_list.length,
        enabled_module_count: moduleContext.module_list.filter((row) => row.enabled).length,
        override_count: moduleContext.module_list.filter((row) => String(row.source || "").toUpperCase() === "OVERRIDE").length
      }
    });
  } catch (error) {
    console.error("SuperAdmin company modules fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Company module details fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/superadmin/company-plans/:companyId/modules/:moduleKey", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  let connection;

  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    const moduleKey = normalizeModuleKey(req.params.moduleKey);
    const enabled = Boolean(req.body?.enabled);
    const reason = String(req.body?.reason || "").trim();

    if (!companyId) return res.status(400).json({ success: false, message: "Company id is required" });
    if (!moduleKey) return res.status(400).json({ success: false, message: "Module key is required" });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const company = await getCompanyForPlanManagement(connection, companyId);
    if (!company) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const [moduleRows] = await connection.query("SELECT module_key FROM erp_modules WHERE module_key = ? LIMIT 1", [moduleKey]);
    if (!moduleRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Module not found" });
    }

    const oldAccessMap = await getCompanyModuleAccessMap(connection, companyId);
    const oldAccess = oldAccessMap.get(moduleKey);
    const [planRows] = await connection.query(
      `
      SELECT COALESCE(p.plan_key, cpa.plan_key_snapshot, 'FULL_ERP') AS plan_key
      FROM company_plan_assignments cpa
      LEFT JOIN erp_plans p ON p.id = cpa.plan_id
      WHERE cpa.company_id = ?
      LIMIT 1
      `,
      [companyId]
    );
    const planKey = normalizePlanKey(planRows[0]?.plan_key || "FULL_ERP");

    let oldEnabled = oldAccess?.enabled;
    if (oldEnabled === undefined) {
      const fallback = await getCompanyEnabledModules(companyId);
      oldEnabled = Boolean(fallback.modules[moduleKey]);
    }

    await connection.query(
      `
      INSERT INTO company_module_access
      (company_id, module_key, enabled, source, reason, updated_by, updated_at)
      VALUES (?, ?, ?, 'OVERRIDE', ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        source = VALUES(source),
        reason = VALUES(reason),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
      `,
      [companyId, moduleKey, Number(enabled), reason || "SuperAdmin module override", access.actingUserId ?? null]
    );

    await writeCompanyModuleAccessAudit(connection, {
      companyId,
      moduleKey,
      oldEnabled,
      newEnabled: enabled,
      oldPlanKey: planKey,
      newPlanKey: planKey,
      changedBy: access.actingUserId,
      reason: reason || "SuperAdmin module override"
    });

    await logActivitySafe(connection, req, access, {
      companyId,
      actionType: "MODULE_OVERRIDE",
      entityType: "COMPANY_MODULE",
      entityId: `${companyId}:${moduleKey}`,
      moduleName: "company-plans",
      status: "success",
      message: "Company module override updated",
      beforeData: { module_key: moduleKey, enabled: oldEnabled },
      afterData: { module_key: moduleKey, enabled, source: "OVERRIDE" }
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Module override saved",
      company_id: companyId,
      module_key: moduleKey,
      enabled,
      source: "OVERRIDE"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("SuperAdmin module override error:", error);
    return res.status(500).json({
      success: false,
      message: "Module override failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/superadmin/company-plans/:companyId/audit", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    if (!companyId) return res.status(400).json({ success: false, message: "Company id is required" });

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.company_id,
        a.module_key,
        a.old_enabled,
        a.new_enabled,
        a.old_plan_key,
        a.new_plan_key,
        a.changed_by,
        u.name AS changed_by_name,
        u.email AS changed_by_email,
        a.change_reason,
        a.created_at
      FROM company_module_access_audit a
      LEFT JOIN users u ON u.id = a.changed_by
      WHERE a.company_id = ?
      ORDER BY a.created_at DESC, a.id DESC
      ${pagination.sql}
      `,
      [companyId]
    );

    setPaginationHeaders(res, pagination);

    return res.json({
      success: true,
      company_id: companyId,
      audit: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("SuperAdmin company plan audit fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Company plan audit fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-preview-violations", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const companyId = parsePositiveInteger(req.query.companyId ?? req.query.company_id);
    const moduleKey = normalizeModuleKey(req.query.moduleKey ?? req.query.module_key);
    const fromDate = String(req.query.fromDate ?? req.query.from_date ?? "").trim();
    const toDate = String(req.query.toDate ?? req.query.to_date ?? "").trim();
    const whereParts = ["1 = 1"];
    const params = [];

    if (companyId) {
      whereParts.push("v.company_id = ?");
      params.push(companyId);
    }

    if (moduleKey) {
      whereParts.push("v.module_key = ?");
      params.push(moduleKey);
    }

    if (fromDate) {
      whereParts.push("v.created_at >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      whereParts.push("v.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(toDate);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const [rows] = await pool.query(
      `
      SELECT
        v.id,
        v.company_id,
        c.company_name,
        v.user_id,
        u.name AS user_name,
        u.email AS user_email,
        v.role,
        v.module_key,
        v.request_method,
        v.request_path,
        v.page_key,
        v.would_block,
        v.request_ip,
        v.user_agent,
        v.created_at
      FROM module_access_violation_logs v
      LEFT JOIN companies c ON c.id = v.company_id
      LEFT JOIN users u ON u.id = v.user_id
      ${whereSql}
      ORDER BY v.created_at DESC, v.id DESC
      ${pagination.sql}
      `,
      params
    );

    const [moduleSummaryRows] = await pool.query(
      `
      SELECT v.module_key, COUNT(*) AS total
      FROM module_access_violation_logs v
      ${whereSql}
      GROUP BY v.module_key
      ORDER BY total DESC, v.module_key ASC
      `,
      params
    );

    const [companySummaryRows] = await pool.query(
      `
      SELECT v.company_id, c.company_name, COUNT(*) AS total
      FROM module_access_violation_logs v
      LEFT JOIN companies c ON c.id = v.company_id
      ${whereSql}
      GROUP BY v.company_id, c.company_name
      ORDER BY total DESC, v.company_id ASC
      `,
      params
    );

    const [totalRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM module_access_violation_logs v
      ${whereSql}
      `,
      params
    );

    setPaginationHeaders(res, pagination);

    return res.json({
      success: true,
      violations: rows,
      summary: {
        total: Number(totalRows[0]?.total || 0),
        by_module: moduleSummaryRows.map((row) => ({
          module_key: row.module_key,
          total: Number(row.total || 0)
        })),
        by_company: companySummaryRows.map((row) => ({
          company_id: row.company_id,
          company_name: row.company_name || "",
          total: Number(row.total || 0)
        }))
      },
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("SuperAdmin module preview violations fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Module preview violations fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-enforcement", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const globalMode = await getGlobalEnforcementMode();
    const [overrideRows] = await pool.query(
      `
      SELECT
        mes.company_id,
        c.company_name,
        mes.enforcement_mode,
        mes.reason,
        mes.updated_by,
        u.name AS updated_by_name,
        u.email AS updated_by_email,
        mes.updated_at
      FROM module_enforcement_settings mes
      LEFT JOIN companies c ON c.id = mes.company_id
      LEFT JOIN users u ON u.id = mes.updated_by
      WHERE mes.scope_type = 'COMPANY'
      ORDER BY mes.updated_at DESC, mes.company_id ASC
      `
    );

    const [countRows] = await pool.query(
      `
      SELECT enforcement_mode, COUNT(*) AS total
      FROM module_enforcement_settings
      WHERE scope_type = 'COMPANY'
      GROUP BY enforcement_mode
      `
    );

    return res.json({
      success: true,
      global: globalMode,
      company_overrides: overrideRows.map((row) => ({
        company_id: row.company_id,
        company_name: row.company_name || "",
        enforcement_mode: normalizeEnforcementMode(row.enforcement_mode),
        reason: row.reason || "",
        updated_by: row.updated_by ?? null,
        updated_by_name: row.updated_by_name || "",
        updated_by_email: row.updated_by_email || "",
        updated_at: row.updated_at ?? null
      })),
      counts: {
        company_override_count: overrideRows.length,
        by_mode: countRows.reduce((acc, row) => {
          acc[normalizeEnforcementMode(row.enforcement_mode)] = Number(row.total || 0);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error("SuperAdmin module enforcement fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Module enforcement settings fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/superadmin/module-enforcement/global", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const mode = normalizeEnforcementMode(req.body?.mode ?? req.body?.enforcement_mode);
    const reason = String(req.body?.reason || "").trim();

    await pool.query(
      `
      INSERT INTO module_enforcement_settings
      (scope_type, company_id, enforcement_mode, reason, updated_by, updated_at)
      VALUES ('GLOBAL', 0, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        enforcement_mode = VALUES(enforcement_mode),
        reason = VALUES(reason),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
      `,
      [mode, reason || null, access.actingUserId ?? null]
    );

    await logActivitySafe(pool, req, access, {
      actionType: "UPDATE_ENFORCEMENT",
      entityType: "MODULE_ENFORCEMENT",
      entityId: "GLOBAL",
      moduleName: "company-plans",
      status: "success",
      message: "Global module enforcement updated",
      afterData: { enforcement_mode: mode, reason }
    });

    return res.json({
      success: true,
      message: "Global enforcement mode updated",
      global: await getGlobalEnforcementMode()
    });
  } catch (error) {
    console.error("SuperAdmin global enforcement update error:", error);
    return res.status(500).json({
      success: false,
      message: "Global enforcement update failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/superadmin/module-enforcement/company/:companyId", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    const mode = normalizeEnforcementMode(req.body?.mode ?? req.body?.enforcement_mode);
    const reason = String(req.body?.reason || "").trim();

    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company id is required" });
    }

    const [companyRows] = await pool.query("SELECT id FROM companies WHERE id = ? LIMIT 1", [companyId]);
    if (!companyRows.length) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    await pool.query(
      `
      INSERT INTO module_enforcement_settings
      (scope_type, company_id, enforcement_mode, reason, updated_by, updated_at)
      VALUES ('COMPANY', ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        enforcement_mode = VALUES(enforcement_mode),
        reason = VALUES(reason),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
      `,
      [companyId, mode, reason || null, access.actingUserId ?? null]
    );

    await logActivitySafe(pool, req, access, {
      companyId,
      actionType: "UPDATE_ENFORCEMENT",
      entityType: "MODULE_ENFORCEMENT",
      entityId: String(companyId),
      moduleName: "company-plans",
      status: "success",
      message: "Company module enforcement override updated",
      afterData: { company_id: companyId, enforcement_mode: mode, reason }
    });

    return res.json({
      success: true,
      message: "Company enforcement override updated",
      company_override: await getCompanyEnforcementMode(companyId),
      effective: await getEffectiveEnforcementMode(companyId)
    });
  } catch (error) {
    console.error("SuperAdmin company enforcement update error:", error);
    return res.status(500).json({
      success: false,
      message: "Company enforcement update failed",
      error: getErrorDetail(error)
    });
  }
});

app.delete("/superadmin/module-enforcement/company/:companyId", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const companyId = parsePositiveInteger(req.params.companyId);
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company id is required" });
    }

    await pool.query(
      `
      DELETE FROM module_enforcement_settings
      WHERE scope_type = 'COMPANY'
        AND company_id = ?
      `,
      [companyId]
    );

    await logActivitySafe(pool, req, access, {
      companyId,
      actionType: "DELETE_ENFORCEMENT_OVERRIDE",
      entityType: "MODULE_ENFORCEMENT",
      entityId: String(companyId),
      moduleName: "company-plans",
      status: "success",
      message: "Company module enforcement override removed"
    });

    return res.json({
      success: true,
      message: "Company enforcement override removed",
      effective: await getEffectiveEnforcementMode(companyId)
    });
  } catch (error) {
    console.error("SuperAdmin company enforcement delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Company enforcement override removal failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-route-map", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const mappings = getRegisteredModuleRouteMappings();
    const countsByModule = mappings.reduce((acc, mapping) => {
      acc[mapping.module_key] = (acc[mapping.module_key] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      mappings,
      summary: {
        total_mappings: mappings.length,
        counts_by_module: countsByModule
      }
    });
  } catch (error) {
    console.error("SuperAdmin module route map fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Module route map fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-enforcement-events", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const companyId = parsePositiveInteger(req.query.companyId ?? req.query.company_id);
    const moduleKey = normalizeModuleKey(req.query.moduleKey ?? req.query.module_key);
    const eventType = String(req.query.eventType ?? req.query.event_type ?? "").trim().toUpperCase();
    const fromDate = String(req.query.fromDate ?? req.query.from_date ?? "").trim();
    const toDate = String(req.query.toDate ?? req.query.to_date ?? "").trim();
    const whereParts = ["1 = 1"];
    const params = [];

    if (companyId) {
      whereParts.push("e.company_id = ?");
      params.push(companyId);
    }
    if (moduleKey) {
      whereParts.push("e.module_key = ?");
      params.push(moduleKey);
    }
    if (["WOULD_BLOCK", "HARD_BLOCK"].includes(eventType)) {
      whereParts.push("e.event_type = ?");
      params.push(eventType);
    }
    if (fromDate) {
      whereParts.push("e.created_at >= ?");
      params.push(fromDate);
    }
    if (toDate) {
      whereParts.push("e.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(toDate);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;
    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.company_id,
        c.company_name,
        e.user_id,
        u.name AS user_name,
        u.email AS user_email,
        e.role,
        e.module_key,
        e.request_method,
        e.request_path,
        e.enforcement_mode,
        e.event_type,
        e.request_ip,
        e.created_at
      FROM module_access_enforcement_events e
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN users u ON u.id = e.user_id
      ${whereSql}
      ORDER BY e.created_at DESC, e.id DESC
      ${pagination.sql}
      `,
      params
    );

    const [summaryRows] = await pool.query(
      `
      SELECT event_type, COUNT(*) AS total
      FROM module_access_enforcement_events e
      ${whereSql}
      GROUP BY event_type
      `,
      params
    );
    const [moduleRows] = await pool.query(
      `
      SELECT module_key, COUNT(*) AS total
      FROM module_access_enforcement_events e
      ${whereSql}
      GROUP BY module_key
      ORDER BY total DESC, module_key ASC
      LIMIT 20
      `,
      params
    );
    const [routeRows] = await pool.query(
      `
      SELECT request_path, COUNT(*) AS total
      FROM module_access_enforcement_events e
      ${whereSql}
      GROUP BY request_path
      ORDER BY total DESC, request_path ASC
      LIMIT 20
      `,
      params
    );

    setPaginationHeaders(res, pagination);

    return res.json({
      success: true,
      events: rows,
      summary: {
        by_event_type: summaryRows.reduce((acc, row) => {
          acc[row.event_type] = Number(row.total || 0);
          return acc;
        }, {}),
        top_modules: moduleRows.map((row) => ({ module_key: row.module_key, total: Number(row.total || 0) })),
        top_routes: routeRows.map((row) => ({ request_path: row.request_path, total: Number(row.total || 0) }))
      },
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("SuperAdmin module enforcement events fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Module enforcement events fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-enforcement-readiness", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const requestedCompanyId = parsePositiveInteger(req.query.companyId ?? req.query.company_id);
    const companyWhere = requestedCompanyId ? "WHERE c.id = ?" : "WHERE c.deleted_at IS NULL";
    const companyParams = requestedCompanyId ? [requestedCompanyId] : [];
    const [companyRows] = await pool.query(
      `
      SELECT
        c.id AS company_id,
        c.company_name,
        COALESCE(p.plan_key, cpa.plan_key_snapshot, 'FULL_ERP') AS plan_key
      FROM companies c
      LEFT JOIN company_plan_assignments cpa ON cpa.company_id = c.id
      LEFT JOIN erp_plans p ON p.id = cpa.plan_id
      ${companyWhere}
      ORDER BY c.id DESC
      LIMIT 500
      `,
      companyParams
    );

    const unmappedRoutes = MODULE_ROUTE_AUDIT_CANDIDATES.filter((candidate) => !isRoutePathMapped(candidate.path));
    const results = [];

    for (const company of companyRows) {
      const companyId = Number(company.company_id || 0);
      const effectiveMode = await getEffectiveEnforcementMode(companyId);
      const [eventRows] = await pool.query(
        `
        SELECT
          SUM(CASE WHEN event_type = 'WOULD_BLOCK' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS would_7,
          SUM(CASE WHEN event_type = 'WOULD_BLOCK' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS would_30,
          SUM(CASE WHEN event_type = 'HARD_BLOCK' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS hard_7,
          SUM(CASE WHEN event_type = 'HARD_BLOCK' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS hard_30
        FROM module_access_enforcement_events
        WHERE company_id = ?
        `,
        [companyId]
      );
      const [moduleRows] = await pool.query(
        `
        SELECT module_key, COUNT(*) AS total
        FROM module_access_enforcement_events
        WHERE company_id = ?
          AND event_type = 'WOULD_BLOCK'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY module_key
        ORDER BY total DESC, module_key ASC
        LIMIT 10
        `,
        [companyId]
      );

      const would7 = Number(eventRows[0]?.would_7 || 0);
      const would30 = Number(eventRows[0]?.would_30 || 0);
      const hard7 = Number(eventRows[0]?.hard_7 || 0);
      const hard30 = Number(eventRows[0]?.hard_30 || 0);
      const unmappedRouteRisk = unmappedRoutes.length > 8 ? "MEDIUM" : "LOW";
      const riskScore = Math.min(100, (would7 * 8) + (would30 * 2) + (hard7 * 15) + (unmappedRouteRisk === "MEDIUM" ? 10 : 0));

      results.push({
        company_id: companyId,
        company_name: company.company_name || "",
        plan: normalizePlanKey(company.plan_key || "FULL_ERP"),
        effective_mode: effectiveMode.enforcement_mode,
        enforcement_source: effectiveMode.source,
        would_block_last_7_days: would7,
        would_block_last_30_days: would30,
        hard_block_last_7_days: hard7,
        hard_block_last_30_days: hard30,
        risky_modules: moduleRows.map((row) => ({ module_key: row.module_key, total: Number(row.total || 0) })),
        unmapped_route_risk: unmappedRouteRisk,
        recommended_ready: riskScore <= 20 && would7 === 0,
        risk_score: riskScore
      });
    }

    return res.json({
      success: true,
      readiness: results,
      company: requestedCompanyId ? results[0] || null : undefined,
      summary: {
        company_count: results.length,
        recommended_ready_count: results.filter((row) => row.recommended_ready).length,
        hard_enforcement_count: results.filter((row) => row.effective_mode === "HARD_ENFORCEMENT").length
      }
    });
  } catch (error) {
    console.error("SuperAdmin enforcement readiness fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Module enforcement readiness fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/module-unmapped-routes", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const unmapped = MODULE_ROUTE_AUDIT_CANDIDATES
      .filter((candidate) => !isRoutePathMapped(candidate.path))
      .map((candidate) => ({
        ...candidate,
        recommendation: candidate.risk === "MEDIUM" ? "Review before broad HARD_ENFORCEMENT rollout" : "Low priority mapping review"
      }));

    return res.json({
      success: true,
      unmapped_routes: unmapped,
      summary: {
        total: unmapped.length,
        medium_risk: unmapped.filter((route) => route.risk === "MEDIUM").length,
        low_risk: unmapped.filter((route) => route.risk === "LOW").length
      }
    });
  } catch (error) {
    console.error("SuperAdmin unmapped route fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Unmapped route audit fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-context", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    return res.json({
      success: true,
      context: {
        company_id: access.companyScope,
        companyId: access.companyScope,
        role: access.role,
        branch_id: access.userBranchId,
        branchId: access.userBranchId,
        branchScope: access.branchScope,
        canViewAllBranches: access.canViewAllBranches,
        canManageBranches: access.canManageBranches,
        isBranchLocked: access.isBranchLocked,
        isSuperAdmin: access.isSuperAdmin
      }
    });
  } catch (error) {
    console.error("Branch context error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch context fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-stock", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const requestedBranchId = getRequestedBranchId(req);
    const branchScope = await validateReadableBranchScope(access, requestedBranchId);
    if (!branchScope.ok) {
      return sendAccessError(res, branchScope);
    }

    const pagination = getPagination(req, { defaultLimit: 500, maxLimit: 1000 });
    const { whereSql, params } = buildBranchStockWhere(access, {
      branchId: branchScope.branchId,
      status: req.query.status,
      stockState: req.query.stockState ?? req.query.stock_state,
      search: req.query.search
    });

    const [rows] = await pool.query(
      `
      SELECT
        s.*,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS effective_stock_state,
        b.branch_code,
        b.branch_name,
        b.branch_type,
        b.status AS branch_status
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      ${whereSql}
      ORDER BY
        s.company_id ASC,
        b.branch_name ASC,
        CAST(COALESCE(s.lot_number, '0') AS UNSIGNED) ASC,
        CAST(COALESCE(s.serial, '0') AS UNSIGNED) ASC,
        s.id ASC
      ${pagination.sql}
      `,
      params
    );

    setPaginationHeaders(res, pagination);
    return res.json({
      success: true,
      branchScope: branchScope.branchId,
      limit: pagination.limit,
      offset: pagination.offset,
      stock: rows
    });
  } catch (error) {
    console.error("Branch stock fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch stock fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-stock/summary", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const requestedBranchId = getRequestedBranchId(req);
    const branchScope = await validateReadableBranchScope(access, requestedBranchId);
    if (!branchScope.ok) {
      return sendAccessError(res, branchScope);
    }

    const { whereSql, params } = buildBranchStockWhere(access, {
      branchId: branchScope.branchId,
      status: req.query.status,
      stockState: req.query.stockState ?? req.query.stock_state,
      search: req.query.search
    });

    const [summaryRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_items,
        COALESCE(SUM(COALESCE(s.weight, 0)), 0) AS total_weight,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_STOCK' THEN 1 ELSE 0 END) AS in_stock_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'SOLD' THEN 1 ELSE 0 END) AS sold_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) IN ('DAMAGED', 'DAMAGED_RETURN') THEN 1 ELSE 0 END) AS damaged_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'DELETED' THEN 1 ELSE 0 END) AS deleted_items
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      ${whereSql}
      `,
      params
    );

    const [branchRows] = await pool.query(
      `
      SELECT
        s.current_branch_id AS branch_id,
        COALESCE(b.branch_code, '') AS branch_code,
        COALESCE(b.branch_name, 'Unassigned Branch') AS branch_name,
        COALESCE(b.branch_type, '') AS branch_type,
        COUNT(*) AS total_items,
        COALESCE(SUM(COALESCE(s.weight, 0)), 0) AS total_weight,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_STOCK' THEN 1 ELSE 0 END) AS in_stock_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'SOLD' THEN 1 ELSE 0 END) AS sold_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) IN ('DAMAGED', 'DAMAGED_RETURN') THEN 1 ELSE 0 END) AS damaged_items,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'DELETED' THEN 1 ELSE 0 END) AS deleted_items
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      ${whereSql}
      GROUP BY s.current_branch_id, b.branch_code, b.branch_name, b.branch_type
      ORDER BY b.branch_name ASC, s.current_branch_id ASC
      `,
      params
    );

    const summary = summaryRows[0] || {};
    return res.json({
      success: true,
      branchScope: branchScope.branchId,
      summary: {
        total_items: Number(summary.total_items || 0),
        total_weight: Number(summary.total_weight || 0),
        in_stock_items: Number(summary.in_stock_items || 0),
        sold_items: Number(summary.sold_items || 0),
        in_transit_items: Number(summary.in_transit_items || 0),
        damaged_items: Number(summary.damaged_items || 0),
        deleted_items: Number(summary.deleted_items || 0)
      },
      branches: branchRows.map((row) => ({
        branch_id: row.branch_id === null || row.branch_id === undefined ? null : Number(row.branch_id),
        branch_code: row.branch_code || "",
        branch_name: row.branch_name || "",
        branch_type: row.branch_type || "",
        total_items: Number(row.total_items || 0),
        total_weight: Number(row.total_weight || 0),
        in_stock_items: Number(row.in_stock_items || 0),
        sold_items: Number(row.sold_items || 0),
        in_transit_items: Number(row.in_transit_items || 0),
        damaged_items: Number(row.damaged_items || 0),
        deleted_items: Number(row.deleted_items || 0)
      }))
    });
  } catch (error) {
    console.error("Branch stock summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch stock summary failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-stock/by-barcode/:barcode", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const barcode = String(req.params.barcode || "").trim();
    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    const whereParts = ["UPPER(TRIM(s.barcode)) = ?"];
    const params = [normalizeBarcodeForComparison(barcode)];

    if (access.companyScope !== null) {
      whereParts.push("s.company_id = ?");
      params.push(access.companyScope);
    }

    if (access.isBranchLocked) {
      whereParts.push("s.current_branch_id = ?");
      params.push(access.userBranchId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        s.*,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS effective_stock_state,
        b.branch_code,
        b.branch_name,
        b.branch_type,
        b.status AS branch_status
      FROM stock s
      LEFT JOIN branches b
        ON b.id = s.current_branch_id
       AND b.company_id = s.company_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY s.id DESC
      LIMIT 20
      `,
      params
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Barcode was not found in accessible branch stock"
      });
    }

    return res.json({
      success: true,
      item: rows[0],
      items: rows
    });
  } catch (error) {
    console.error("Branch stock barcode fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch stock barcode fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-analytics/overview", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);

    const stockScope = buildAnalyticsStockScope(access, branchScope, { alias: "s" });
    const branchScopeParams = [];
    const branchWhereParts = ["1 = 1"];
    if (access.companyScope !== null) {
      branchWhereParts.push("b.company_id = ?");
      branchScopeParams.push(access.companyScope);
    }
    if (branchScope.isBranchFiltered) {
      branchWhereParts.push("b.id = ?");
      branchScopeParams.push(branchScope.branchId);
    }

    const [branchRows] = await pool.query(
      `
      SELECT id, company_id, branch_code, branch_name, branch_type, status
      FROM branches b
      WHERE ${branchWhereParts.join(" AND ")}
      ORDER BY branch_name ASC, id ASC
      `,
      branchScopeParams
    );

    const [stockRows] = await pool.query(
      `
      SELECT
        s.current_branch_id,
        b.branch_code,
        b.branch_name,
        COUNT(*) AS stock_qty,
        COALESCE(SUM(s.weight), 0) AS stock_weight,
        0 AS stock_value,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_qty,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT' THEN s.weight ELSE 0 END), 0) AS in_transit_weight,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'TRANSFER_SHORTAGE' THEN 1 ELSE 0 END) AS shortage_qty
      FROM stock s
      LEFT JOIN branches b ON b.id = s.current_branch_id AND b.company_id = s.company_id
      WHERE ${stockScope.whereSql}
        AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      GROUP BY s.current_branch_id, b.branch_code, b.branch_name
      ORDER BY b.branch_name ASC, s.current_branch_id ASC
      `,
      stockScope.params
    );

    const [salesRows] = await pool.query(
      `
      SELECT
        s.current_branch_id,
        COUNT(si.id) AS sold_qty,
        COALESCE(SUM(COALESCE(NULLIF(si.customer_line_amount, 0), NULLIF(si.company_line_amount, 0), sh.total_amount, 0)), 0) AS sales_amount
      FROM sales_items si
      LEFT JOIN sales_history sh ON sh.id = si.sale_id AND sh.company_id = si.company_id
      LEFT JOIN stock s ON s.company_id = si.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
      WHERE ${stockScope.whereSql}
        AND COALESCE(si.is_deleted, 0) = 0
      GROUP BY s.current_branch_id
      `,
      stockScope.params
    );

    const salesByBranch = new Map(salesRows.map((row) => [Number(row.current_branch_id || 0), row]));
    const summariesByBranch = new Map(stockRows.map((row) => [Number(row.current_branch_id || 0), row]));
    const branchSummaries = branchRows.map((branch) => {
      const stock = summariesByBranch.get(Number(branch.id)) || {};
      const sales = salesByBranch.get(Number(branch.id)) || {};
      return {
        branch_id: branch.id,
        branch_code: branch.branch_code,
        branch_name: branch.branch_name,
        branch_type: branch.branch_type,
        status: branch.status,
        stock_qty: Number(stock.stock_qty || 0),
        stock_weight: Number(stock.stock_weight || 0),
        stock_value: Number(stock.stock_value || 0),
        in_transit_qty: Number(stock.in_transit_qty || 0),
        in_transit_weight: Number(stock.in_transit_weight || 0),
        shortage_qty: Number(stock.shortage_qty || 0),
        sold_qty: Number(sales.sold_qty || 0),
        sales_amount: Number(sales.sales_amount || 0)
      };
    });

    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      total_branches: branchRows.length,
      total_stock_qty: branchSummaries.reduce((sum, row) => sum + row.stock_qty, 0),
      total_stock_weight: branchSummaries.reduce((sum, row) => sum + row.stock_weight, 0),
      total_stock_value: branchSummaries.reduce((sum, row) => sum + row.stock_value, 0),
      total_in_transit_qty: branchSummaries.reduce((sum, row) => sum + row.in_transit_qty, 0),
      total_in_transit_weight: branchSummaries.reduce((sum, row) => sum + row.in_transit_weight, 0),
      total_shortage_qty: branchSummaries.reduce((sum, row) => sum + row.shortage_qty, 0),
      total_branch_sales: branchSummaries.reduce((sum, row) => sum + row.sales_amount, 0),
      branch_summaries: branchSummaries
    });
  } catch (error) {
    console.error("Branch analytics overview error:", error);
    return res.status(500).json({ success: false, message: "Branch analytics overview failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/branch-summary", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const dateRange = getAnalyticsDateRange(req);
    const stockScope = buildAnalyticsStockScope(access, branchScope, { alias: "s" });

    const [stockSummary] = await pool.query(
      `
      SELECT
        COUNT(*) AS stock_qty,
        COALESCE(SUM(weight), 0) AS stock_weight,
        SUM(CASE WHEN UPPER(COALESCE(status, 'IN_STOCK')) = 'SOLD' THEN 1 ELSE 0 END) AS sold_qty,
        SUM(CASE WHEN UPPER(COALESCE(status, '')) IN ('DAMAGED_RETURN', 'DAMAGED') THEN 1 ELSE 0 END) AS damaged_count,
        SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_count
      FROM stock s
      WHERE ${stockScope.whereSql}
        AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'
      `,
      stockScope.params
    );

    const salesWhere = [stockScope.whereSql, "COALESCE(si.is_deleted, 0) = 0"];
    const salesParams = [...stockScope.params];
    appendDateRangeFilter(salesWhere, salesParams, "si.created_at", dateRange);
    const [salesSummary] = await pool.query(
      `
      SELECT COUNT(si.id) AS sold_qty, COALESCE(SUM(COALESCE(NULLIF(si.customer_line_amount, 0), NULLIF(si.company_line_amount, 0), sh.total_amount, 0)), 0) AS sales_amount
      FROM sales_items si
      LEFT JOIN sales_history sh ON sh.id = si.sale_id AND sh.company_id = si.company_id
      LEFT JOIN stock s ON s.company_id = si.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
      WHERE ${salesWhere.join(" AND ")}
      `,
      salesParams
    );

    const transferBase = [];
    const transferParams = [];
    if (access.companyScope !== null) {
      transferBase.push("bt.company_id = ?");
      transferParams.push(access.companyScope);
    } else {
      transferBase.push("1 = 1");
    }
    if (branchScope.isBranchFiltered) {
      transferBase.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      transferParams.push(branchScope.branchId, branchScope.branchId);
    }
    appendDateRangeFilter(transferBase, transferParams, "bt.created_at", dateRange);
    const [transferSummary] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN ${branchScope.isBranchFiltered ? "bt.to_branch_id = ?" : "1 = 1"} THEN 1 ELSE 0 END) AS transfer_in,
        SUM(CASE WHEN ${branchScope.isBranchFiltered ? "bt.from_branch_id = ?" : "1 = 1"} THEN 1 ELSE 0 END) AS transfer_out,
        SUM(CASE WHEN UPPER(COALESCE(bt.status, '')) = 'SHORTAGE' THEN 1 ELSE 0 END) AS shortage_count
      FROM branch_transfers bt
      WHERE ${transferBase.join(" AND ")}
      `,
      branchScope.isBranchFiltered
        ? [branchScope.branchId, branchScope.branchId, ...transferParams]
        : transferParams
    );

    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      fromDate: dateRange.fromDate || null,
      toDate: dateRange.toDate || null,
      stock_qty: Number(stockSummary[0]?.stock_qty || 0),
      stock_weight: Number(stockSummary[0]?.stock_weight || 0),
      sold_qty: Number(salesSummary[0]?.sold_qty || 0),
      sales_amount: Number(salesSummary[0]?.sales_amount || 0),
      transfer_in: Number(transferSummary[0]?.transfer_in || 0),
      transfer_out: Number(transferSummary[0]?.transfer_out || 0),
      shortage_count: Number(transferSummary[0]?.shortage_count || 0),
      damaged_count: Number(stockSummary[0]?.damaged_count || 0),
      in_transit_count: Number(stockSummary[0]?.in_transit_count || 0)
    });
  } catch (error) {
    console.error("Branch analytics summary error:", error);
    return res.status(500).json({ success: false, message: "Branch analytics summary failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/transfer-ageing", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const whereParts = ["UPPER(COALESCE(bt.status, '')) IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED')"];
    const params = [];
    if (access.companyScope !== null) {
      whereParts.push("bt.company_id = ?");
      params.push(access.companyScope);
    }
    if (branchScope.isBranchFiltered) {
      whereParts.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      params.push(branchScope.branchId, branchScope.branchId);
    }
    const [rows] = await pool.query(
      `
      SELECT
        bt.*,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()) AS age_hours,
        COUNT(bti.id) AS total_items,
        SUM(CASE WHEN UPPER(COALESCE(bti.item_status, '')) = 'RECEIVED' THEN 1 ELSE 0 END) AS received_items,
        SUM(CASE WHEN UPPER(COALESCE(bti.item_status, '')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS pending_items
      FROM branch_transfers bt
      LEFT JOIN branch_transfer_items bti ON bti.transfer_id = bt.id AND bti.company_id = bt.company_id AND UPPER(COALESCE(bti.item_status, '')) <> 'CANCELLED'
      LEFT JOIN branches fb ON fb.id = bt.from_branch_id AND fb.company_id = bt.company_id
      LEFT JOIN branches tb ON tb.id = bt.to_branch_id AND tb.company_id = bt.company_id
      WHERE ${whereParts.join(" AND ")}
      GROUP BY bt.id, fb.branch_name, tb.branch_name
      ORDER BY age_hours DESC, bt.id DESC
      `,
      params
    );
    const transfers = rows.map((row) => ({
      ...row,
      age_hours: Number(row.age_hours || 0),
      age_days: Number(row.age_hours || 0) / 24,
      ageing_level: getAgeingLevel(row.age_hours),
      is_overdue: Number(row.age_hours || 0) >= 24
    }));
    const groupedByBranch = transfers.reduce((summary, transfer) => {
      const key = String(transfer.to_branch_id || "unassigned");
      if (!summary[key]) {
        summary[key] = {
          branch_id: transfer.to_branch_id || null,
          branch_name: transfer.to_branch_name || "Unassigned Branch",
          transfers: [],
          total_transfers: 0,
          pending_items: 0,
          critical_count: 0,
          warning_count: 0
        };
      }
      summary[key].transfers.push(transfer);
      summary[key].total_transfers += 1;
      summary[key].pending_items += Number(transfer.pending_items || 0);
      if (transfer.ageing_level === "CRITICAL") summary[key].critical_count += 1;
      if (transfer.ageing_level === "WARNING") summary[key].warning_count += 1;
      return summary;
    }, {});
    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      transfers,
      grouped_by_branch: Object.values(groupedByBranch)
    });
  } catch (error) {
    console.error("Transfer ageing error:", error);
    return res.status(500).json({ success: false, message: "Transfer ageing fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/shortages", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const whereParts = ["(UPPER(COALESCE(bt.status, '')) = 'SHORTAGE' OR UPPER(COALESCE(bti.item_status, '')) = 'SHORTAGE')"];
    const params = [];
    if (access.companyScope !== null) {
      whereParts.push("bt.company_id = ?");
      params.push(access.companyScope);
    }
    if (branchScope.isBranchFiltered) {
      whereParts.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      params.push(branchScope.branchId, branchScope.branchId);
    }
    const [rows] = await pool.query(
      `
      SELECT
        bt.id AS transfer_id,
        bt.transfer_no,
        bt.status,
        bt.created_at,
        bt.updated_at,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        TIMESTAMPDIFF(HOUR, COALESCE(bt.received_at, bt.updated_at, bt.created_at), NOW()) AS shortage_age_hours,
        COUNT(bti.id) AS missing_count,
        GROUP_CONCAT(bti.barcode ORDER BY bti.id SEPARATOR ', ') AS missing_barcodes
      FROM branch_transfers bt
      LEFT JOIN branch_transfer_items bti ON bti.transfer_id = bt.id AND bti.company_id = bt.company_id AND UPPER(COALESCE(bti.item_status, '')) = 'SHORTAGE'
      LEFT JOIN branches fb ON fb.id = bt.from_branch_id AND fb.company_id = bt.company_id
      LEFT JOIN branches tb ON tb.id = bt.to_branch_id AND tb.company_id = bt.company_id
      WHERE ${whereParts.join(" AND ")}
      GROUP BY bt.id, fb.branch_name, tb.branch_name
      ORDER BY shortage_age_hours DESC, bt.id DESC
      `,
      params
    );
    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      shortages: rows.map((row) => ({
        ...row,
        missing_count: Number(row.missing_count || 0),
        shortage_age_hours: Number(row.shortage_age_hours || 0),
        shortage_age_days: Number(row.shortage_age_hours || 0) / 24,
        missing_barcodes: String(row.missing_barcodes || "").split(", ").filter(Boolean),
        pending_mismatch_details: String(row.missing_barcodes || "")
          .split(", ")
          .filter(Boolean)
          .map((barcode) => ({
            barcode,
            status: "SHORTAGE",
            transfer_id: row.transfer_id,
            transfer_no: row.transfer_no,
            source_branch: row.from_branch_name || "",
            destination_branch: row.to_branch_name || ""
          }))
      }))
    });
  } catch (error) {
    console.error("Shortage analytics error:", error);
    return res.status(500).json({ success: false, message: "Shortage analytics fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/in-transit", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const whereParts = ["UPPER(COALESCE(bti.item_status, '')) = 'IN_TRANSIT'"];
    const params = [];
    if (access.companyScope !== null) {
      whereParts.push("bt.company_id = ?");
      params.push(access.companyScope);
    }
    if (branchScope.isBranchFiltered) {
      whereParts.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      params.push(branchScope.branchId, branchScope.branchId);
    }
    const [rows] = await pool.query(
      `
      SELECT
        bt.id AS transfer_id,
        bt.transfer_no,
        bt.from_branch_id,
        bt.to_branch_id,
        bt.status AS transfer_status,
        bt.dispatched_at,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        COUNT(bti.id) AS qty,
        COALESCE(SUM(s.weight), 0) AS weight,
        TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()) AS age_hours,
        GROUP_CONCAT(bti.barcode ORDER BY bti.id SEPARATOR ', ') AS barcodes
      FROM branch_transfer_items bti
      INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
      LEFT JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
      LEFT JOIN branches fb ON fb.id = bt.from_branch_id AND fb.company_id = bt.company_id
      LEFT JOIN branches tb ON tb.id = bt.to_branch_id AND tb.company_id = bt.company_id
      WHERE ${whereParts.join(" AND ")}
      GROUP BY bt.id, fb.branch_name, tb.branch_name
      ORDER BY age_hours DESC, bt.id DESC
      `,
      params
    );
    const transfers = rows.map((row) => ({
      ...row,
      qty: Number(row.qty || 0),
      weight: Number(row.weight || 0),
      age_hours: Number(row.age_hours || 0),
      age_days: Number(row.age_hours || 0) / 24,
      ageing_level: getAgeingLevel(row.age_hours),
      barcodes: String(row.barcodes || "").split(", ").filter(Boolean)
    }));
    const groupedByBranch = transfers.reduce((summary, transfer) => {
      const key = String(transfer.to_branch_id || "unassigned");
      if (!summary[key]) {
        summary[key] = {
          branch_id: transfer.to_branch_id || null,
          branch_name: transfer.to_branch_name || "Unassigned Branch",
          qty: 0,
          weight: 0,
          transfers: []
        };
      }
      summary[key].qty += Number(transfer.qty || 0);
      summary[key].weight += Number(transfer.weight || 0);
      summary[key].transfers.push(transfer);
      return summary;
    }, {});
    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      transfers,
      grouped_by_branch: Object.values(groupedByBranch)
    });
  } catch (error) {
    console.error("In-transit analytics error:", error);
    return res.status(500).json({ success: false, message: "In-transit analytics fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/movement-ledger", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const barcode = normalizeBarcodeForComparison(req.query.barcode || "");
    const movementType = normalizeMovementType(req.query.movementType || req.query.movement_type || "");
    const dateRange = getAnalyticsDateRange(req);
    const scopeSql = access.companyScope !== null ? "company_id = ?" : "1 = 1";
    const scopeParams = access.companyScope !== null ? [access.companyScope] : [];
    const branchFilterStock = branchScope.isBranchFiltered ? "AND current_branch_id = ?" : "";
    const branchFilterTransfer = branchScope.isBranchFiltered ? "AND (from_branch_id = ? OR to_branch_id = ?)" : "";
    const branchStockParams = branchScope.isBranchFiltered ? [branchScope.branchId] : [];
    const branchTransferParams = branchScope.isBranchFiltered ? [branchScope.branchId, branchScope.branchId] : [];
    const rows = [];
    const ledgerFetchLimit = Math.min(3000, Math.max(500, pagination.limit + pagination.offset + 250));

    const addFilteredRows = (items) => {
      for (const item of items) {
        if (barcode && normalizeBarcodeForComparison(item.barcode) !== barcode) continue;
        if (movementType && normalizeMovementType(item.movement_type) !== movementType) continue;
        const dateValue = String(item.movement_at || "").slice(0, 10);
        if (dateRange.fromDate && dateValue < dateRange.fromDate) continue;
        if (dateRange.toDate && dateValue > dateRange.toDate) continue;
        rows.push(item);
      }
    };

    const appendLedgerQueryFilters = (whereParts, params, {
      barcodeColumn = "barcode",
      dateColumn = "created_at",
      movementName = ""
    } = {}) => {
      if (barcode) {
        whereParts.push(`UPPER(TRIM(${barcodeColumn})) = ?`);
        params.push(barcode);
      }
      if (dateRange.fromDate) {
        whereParts.push(`${dateColumn} >= ?`);
        params.push(`${dateRange.fromDate} 00:00:00`);
      }
      if (dateRange.toDate) {
        whereParts.push(`${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`);
        params.push(dateRange.toDate);
      }
      if (movementType && movementName && movementType !== movementName) {
        whereParts.push("1 = 0");
      }
    };

    const createdWhereParts = [scopeSql, "barcode IS NOT NULL", "TRIM(barcode) <> ''"];
    const createdParams = [...scopeParams, ...branchStockParams];
    if (branchScope.isBranchFiltered) createdWhereParts.push("current_branch_id = ?");
    appendLedgerQueryFilters(createdWhereParts, createdParams, {
      barcodeColumn: "barcode",
      dateColumn: "created_at",
      movementName: "CREATED"
    });

    const [createdRows] = await pool.query(
      `
      SELECT id AS source_id, company_id, barcode, current_branch_id AS branch_id, 'CREATED' AS movement_type, created_at AS movement_at, product_name, weight, status, stock_state, 'stock' AS source_table
      FROM stock
      WHERE ${createdWhereParts.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [...createdParams, ledgerFetchLimit]
    );
    addFilteredRows(createdRows);

    const transferWhereParts = [scopeSql.replace("company_id", "bti.company_id")];
    const transferParams = [...scopeParams, ...branchTransferParams];
    if (branchScope.isBranchFiltered) {
      transferWhereParts.push("(bti.from_branch_id = ? OR bti.to_branch_id = ?)");
    }
    if (barcode) {
      transferWhereParts.push("UPPER(TRIM(bti.barcode)) = ?");
      transferParams.push(barcode);
    }
    if (dateRange.fromDate) {
      transferWhereParts.push("COALESCE(bt.dispatched_at, bti.created_at) >= ?");
      transferParams.push(`${dateRange.fromDate} 00:00:00`);
    }
    if (dateRange.toDate) {
      transferWhereParts.push("COALESCE(bt.dispatched_at, bti.created_at) < DATE_ADD(?, INTERVAL 1 DAY)");
      transferParams.push(dateRange.toDate);
    }
    if (movementType && !["TRANSFER_CREATED", "DISPATCHED", "RECEIVED", "SHORTAGE"].includes(movementType)) {
      transferWhereParts.push("1 = 0");
    }

    const [transferRows] = await pool.query(
      `
      SELECT bti.id AS source_id, bti.company_id, bti.barcode, bti.from_branch_id, bti.to_branch_id, bti.item_status, bti.created_at, bti.received_at, s.weight, s.product_name, bt.transfer_no, bt.dispatched_at
      FROM branch_transfer_items bti
      INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
      LEFT JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
      WHERE ${transferWhereParts.join(" AND ")}
      ORDER BY bti.id DESC
      LIMIT ?
      `,
      [...transferParams, ledgerFetchLimit]
    );
    addFilteredRows(transferRows.map((row) => ({ ...row, branch_id: row.from_branch_id, movement_type: "TRANSFER_CREATED", movement_at: row.created_at, source_table: "branch_transfer_items" })));
    addFilteredRows(transferRows.filter((row) => ["IN_TRANSIT", "RECEIVED", "SHORTAGE"].includes(normalizeMovementType(row.item_status))).map((row) => ({ ...row, branch_id: row.from_branch_id, movement_type: "DISPATCHED", movement_at: row.dispatched_at || row.created_at, source_table: "branch_transfer_items" })));
    addFilteredRows(transferRows.filter((row) => normalizeMovementType(row.item_status) === "RECEIVED").map((row) => ({ ...row, branch_id: row.to_branch_id, movement_type: "RECEIVED", movement_at: row.received_at || row.created_at, source_table: "branch_transfer_items" })));
    addFilteredRows(transferRows.filter((row) => normalizeMovementType(row.item_status) === "SHORTAGE").map((row) => ({ ...row, branch_id: row.from_branch_id, movement_type: "SHORTAGE", movement_at: row.received_at || row.created_at, source_table: "branch_transfer_items" })));

    const soldWhereParts = [scopeSql.replace("company_id", "si.company_id"), "COALESCE(si.is_deleted, 0) = 0"];
    const soldParams = [...scopeParams, ...branchStockParams];
    if (branchScope.isBranchFiltered) soldWhereParts.push("s.current_branch_id = ?");
    appendLedgerQueryFilters(soldWhereParts, soldParams, {
      barcodeColumn: "si.barcode",
      dateColumn: "si.created_at",
      movementName: "SOLD"
    });

    const [soldRows] = await pool.query(
      `
      SELECT si.id AS source_id, si.company_id, si.barcode, s.current_branch_id AS branch_id, 'SOLD' AS movement_type, si.created_at AS movement_at, si.product_name, si.weight, si.invoice_number, 'sales_items' AS source_table
      FROM sales_items si
      LEFT JOIN stock s ON s.company_id = si.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
      WHERE ${soldWhereParts.join(" AND ")}
      ORDER BY si.id DESC
      LIMIT ?
      `,
      [...soldParams, ledgerFetchLimit]
    );
    addFilteredRows(soldRows);

    const returnWhereParts = [scopeSql.replace("company_id", "rh.company_id")];
    const returnParams = [...scopeParams, ...branchStockParams];
    if (branchScope.isBranchFiltered) returnWhereParts.push("s.current_branch_id = ?");
    appendLedgerQueryFilters(returnWhereParts, returnParams, {
      barcodeColumn: "rh.barcode",
      dateColumn: "COALESCE(rh.return_date, rh.created_at)"
    });
    if (movementType && !["RETURNED", "DAMAGED"].includes(movementType)) {
      returnWhereParts.push("1 = 0");
    }

    const [returnRows] = await pool.query(
      `
      SELECT rh.id AS source_id, rh.company_id, rh.barcode, s.current_branch_id AS branch_id, CASE WHEN UPPER(COALESCE(rh.return_type, '')) = 'DAMAGED_RETURN' THEN 'DAMAGED' ELSE 'RETURNED' END AS movement_type, COALESCE(rh.return_date, rh.created_at) AS movement_at, rh.product_name, rh.weight, rh.invoice_number, 'return_history' AS source_table
      FROM return_history rh
      LEFT JOIN stock s ON s.company_id = rh.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(rh.barcode))
      WHERE ${returnWhereParts.join(" AND ")}
      ORDER BY rh.id DESC
      LIMIT ?
      `,
      [...returnParams, ledgerFetchLimit]
    );
    addFilteredRows(returnRows);

    rows.sort((a, b) => new Date(b.movement_at || 0) - new Date(a.movement_at || 0));
    const pagedRows = rows.slice(pagination.offset, pagination.offset + pagination.limit);
    setPaginationHeaders(res, pagination);
    return res.json({ success: true, branchScope: getBranchScopeResponse(branchScope), total: rows.length, movements: pagedRows, limit: pagination.limit, offset: pagination.offset });
  } catch (error) {
    console.error("Movement ledger error:", error);
    return res.status(500).json({ success: false, message: "Movement ledger fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-analytics/reconciliation", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveAnalyticsAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const dateRange = getAnalyticsDateRange(req);
    const stockScope = buildAnalyticsStockScope(access, branchScope, { alias: "s" });
    const [closingRows] = await pool.query(
      `
      SELECT COUNT(*) AS closing_stock, COALESCE(SUM(weight), 0) AS closing_weight
      FROM stock s
      WHERE ${stockScope.whereSql}
        AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
        AND UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
      `,
      stockScope.params
    );
    const transferWhere = [];
    const transferParams = [];
    if (access.companyScope !== null) {
      transferWhere.push("bt.company_id = ?");
      transferParams.push(access.companyScope);
    } else {
      transferWhere.push("1 = 1");
    }
    if (branchScope.isBranchFiltered) {
      transferWhere.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      transferParams.push(branchScope.branchId, branchScope.branchId);
    }
    appendDateRangeFilter(transferWhere, transferParams, "bt.created_at", dateRange);
    const [transferRows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN ${branchScope.isBranchFiltered ? "bt.to_branch_id = ?" : "1 = 1"} THEN 1 ELSE 0 END) AS inward_transfer,
        SUM(CASE WHEN ${branchScope.isBranchFiltered ? "bt.from_branch_id = ?" : "1 = 1"} THEN 1 ELSE 0 END) AS outward_transfer
      FROM branch_transfer_items bti
      INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
      WHERE ${transferWhere.join(" AND ")}
        AND UPPER(COALESCE(bti.item_status, '')) <> 'CANCELLED'
      `,
      branchScope.isBranchFiltered
        ? [branchScope.branchId, branchScope.branchId, ...transferParams]
        : transferParams
    );
    const salesWhere = [stockScope.whereSql, "COALESCE(si.is_deleted, 0) = 0"];
    const salesParams = [...stockScope.params];
    appendDateRangeFilter(salesWhere, salesParams, "si.created_at", dateRange);
    const [salesRows] = await pool.query(
      `
      SELECT COUNT(si.id) AS sold, COALESCE(SUM(si.weight), 0) AS sold_weight
      FROM sales_items si
      LEFT JOIN stock s ON s.company_id = si.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
      WHERE ${salesWhere.join(" AND ")}
      `,
      salesParams
    );
    const [damagedRows] = await pool.query(
      `
      SELECT COUNT(*) AS damaged
      FROM stock s
      WHERE ${stockScope.whereSql}
        AND UPPER(COALESCE(status, '')) IN ('DAMAGED_RETURN', 'DAMAGED')
      `,
      stockScope.params
    );
    const [returnRows] = await pool.query(
      `
      SELECT COUNT(rh.id) AS returned
      FROM return_history rh
      LEFT JOIN stock s ON s.company_id = rh.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(rh.barcode))
      WHERE ${stockScope.whereSql.replaceAll("s.", "s.")}
      `,
      stockScope.params
    );
    const closingStock = Number(closingRows[0]?.closing_stock || 0);
    const inward = Number(transferRows[0]?.inward_transfer || 0);
    const outward = Number(transferRows[0]?.outward_transfer || 0);
    const sold = Number(salesRows[0]?.sold || 0);
    const damaged = Number(damagedRows[0]?.damaged || 0);
    const returned = Number(returnRows[0]?.returned || 0);
    const openingStock = Math.max(0, closingStock - inward + outward + sold + damaged - returned);
    const expectedClosing = openingStock + inward - outward - sold - damaged + returned;
    return res.json({
      success: true,
      branchScope: getBranchScopeResponse(branchScope),
      fromDate: dateRange.fromDate || null,
      toDate: dateRange.toDate || null,
      opening_stock: openingStock,
      inward_transfer: inward,
      outward_transfer: outward,
      sold,
      damaged,
      returned,
      closing_stock: closingStock,
      closing_weight: Number(closingRows[0]?.closing_weight || 0),
      mismatch: expectedClosing - closingStock,
      note: "Opening stock is derived from current stock and recorded movements because legacy stock movement history is partial."
    });
  } catch (error) {
    console.error("Branch reconciliation error:", error);
    return res.status(500).json({ success: false, message: "Branch reconciliation fetch failed", error: getErrorDetail(error) });
  }
});

function normalizeAuditStatus(value = "", fallback = "") {
  const clean = String(value || fallback).trim().toUpperCase().slice(0, 40);
  return clean;
}

function normalizeAuditSeverity(value = "", fallback = "") {
  const clean = String(value || fallback).trim().toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(clean) ? clean : "";
}

function normalizeAuditExceptionType(value = "") {
  const clean = String(value || "").trim().toUpperCase();
  const allowed = new Set([
    "MISSING_FROM_BRANCH",
    "WRONG_BRANCH",
    "IN_TRANSIT_TOO_LONG",
    "SHORTAGE_UNRESOLVED",
    "SOLD_BUT_IN_STOCK",
    "STOCK_STATE_MISMATCH",
    "DUPLICATE_BARCODE",
    "UNKNOWN"
  ]);
  return allowed.has(clean) ? clean : "";
}

function getAuditDateValue(value = "", fallback = "") {
  const clean = String(value || fallback || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function canApproveBranchAudit(access = {}) {
  if (!access?.ok || access.isSuperAdmin) return false;
  return ["OWNER", "ACCOUNTS"].includes(normalizeRoleValue(access.role || access.actingUser?.role || ""));
}

async function resolveBranchAuditAccess(req, { requireCompanyScope = false } = {}) {
  const access = await resolveBranchAccessContext(req, { requireCompanyScope });
  if (!access.ok) return { access };
  const requestedBranchId = getRequestedBranchScopeValue(req);
  const branchScope = await resolveOperationalBranchScope(pool, access, requestedBranchId);
  return { access, branchScope };
}

async function getAuditBranchesForScope(connection, access, branchScope) {
  const whereParts = ["b.company_id = ?"];
  const params = [access.companyScope];
  if (branchScope?.isBranchFiltered) {
    whereParts.push("b.id = ?");
    params.push(branchScope.branchId);
  }
  const [rows] = await connection.query(
    `
    SELECT b.id, b.branch_code, b.branch_name
    FROM branches b
    WHERE ${whereParts.join(" AND ")}
      AND UPPER(COALESCE(b.status, 'ACTIVE')) = 'ACTIVE'
    ORDER BY b.branch_name ASC, b.id ASC
    `,
    params
  );
  return rows;
}

async function createOrRefreshBranchSnapshot(connection, access, branch, snapshotDate) {
  const branchId = Number(branch.id);
  const [summaryRows] = await connection.query(
    `
    SELECT
      COUNT(*) AS total_items,
      COALESCE(SUM(COALESCE(weight, 0)), 0) AS total_weight,
      SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
        AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'SOLD' THEN 1 ELSE 0 END) AS in_stock_items,
      COALESCE(SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
        AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'SOLD' THEN COALESCE(weight, 0) ELSE 0 END), 0) AS in_stock_weight,
      SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_items,
      COALESCE(SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_TRANSIT' THEN COALESCE(weight, 0) ELSE 0 END), 0) AS in_transit_weight,
      SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'TRANSFER_SHORTAGE' THEN 1 ELSE 0 END) AS shortage_items,
      COALESCE(SUM(CASE WHEN UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'TRANSFER_SHORTAGE' THEN COALESCE(weight, 0) ELSE 0 END), 0) AS shortage_weight,
      SUM(CASE WHEN UPPER(COALESCE(status, '')) = 'SOLD' THEN 1 ELSE 0 END) AS sold_items,
      SUM(CASE WHEN UPPER(COALESCE(status, '')) IN ('DAMAGED', 'DAMAGED_RETURN') THEN 1 ELSE 0 END) AS damaged_items
    FROM stock
    WHERE company_id = ?
      AND current_branch_id = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'
    `,
    [access.companyScope, branchId]
  );
  const summary = summaryRows[0] || {};

  await connection.query(
    `
    INSERT INTO branch_stock_snapshots
    (
      company_id, branch_id, snapshot_date, total_items, total_weight,
      in_stock_items, in_stock_weight, in_transit_items, in_transit_weight,
      shortage_items, shortage_weight, sold_items, damaged_items, created_by, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      total_items = VALUES(total_items),
      total_weight = VALUES(total_weight),
      in_stock_items = VALUES(in_stock_items),
      in_stock_weight = VALUES(in_stock_weight),
      in_transit_items = VALUES(in_transit_items),
      in_transit_weight = VALUES(in_transit_weight),
      shortage_items = VALUES(shortage_items),
      shortage_weight = VALUES(shortage_weight),
      sold_items = VALUES(sold_items),
      damaged_items = VALUES(damaged_items),
      created_by = VALUES(created_by),
      updated_at = NOW()
    `,
    [
      access.companyScope,
      branchId,
      snapshotDate,
      Number(summary.total_items || 0),
      Number(summary.total_weight || 0),
      Number(summary.in_stock_items || 0),
      Number(summary.in_stock_weight || 0),
      Number(summary.in_transit_items || 0),
      Number(summary.in_transit_weight || 0),
      Number(summary.shortage_items || 0),
      Number(summary.shortage_weight || 0),
      Number(summary.sold_items || 0),
      Number(summary.damaged_items || 0),
      access.actingUserId ?? null
    ]
  );

  const [snapshotRows] = await connection.query(
    `
    SELECT *
    FROM branch_stock_snapshots
    WHERE company_id = ? AND branch_id = ? AND snapshot_date = ?
    LIMIT 1
    `,
    [access.companyScope, branchId, snapshotDate]
  );
  const snapshot = snapshotRows[0];

  await connection.query(
    `
    DELETE FROM branch_stock_snapshot_items
    WHERE company_id = ? AND snapshot_id = ?
    `,
    [access.companyScope, snapshot.id]
  );

  await connection.query(
    `
    INSERT INTO branch_stock_snapshot_items
    (
      company_id, snapshot_id, branch_id, stock_id, barcode, product_name,
      lot_number, weight, status, stock_state, created_at
    )
    SELECT
      company_id, ?, current_branch_id, id, COALESCE(barcode, ''), COALESCE(product_name, ''),
      COALESCE(lot_number, ''), COALESCE(weight, 0), COALESCE(status, ''),
      COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK'), NOW()
    FROM stock
    WHERE company_id = ?
      AND current_branch_id = ?
      AND UPPER(COALESCE(status, 'IN_STOCK')) <> 'DELETED'
    ORDER BY id ASC
    `,
    [snapshot.id, access.companyScope, branchId]
  );

  return {
    ...snapshot,
    total_items: Number(summary.total_items || 0),
    total_weight: Number(summary.total_weight || 0),
    in_stock_items: Number(summary.in_stock_items || 0),
    in_stock_weight: Number(summary.in_stock_weight || 0),
    in_transit_items: Number(summary.in_transit_items || 0),
    in_transit_weight: Number(summary.in_transit_weight || 0),
    shortage_items: Number(summary.shortage_items || 0),
    shortage_weight: Number(summary.shortage_weight || 0),
    sold_items: Number(summary.sold_items || 0),
    damaged_items: Number(summary.damaged_items || 0),
    branch_code: branch.branch_code,
    branch_name: branch.branch_name
  };
}

async function generateBranchAuditRunNo(connection, companyId) {
  const dateKey = getTodayDateOnly().replace(/-/g, "");
  const prefix = `AUD-${dateKey}-`;
  const [rows] = await connection.query(
    `
    SELECT run_no
    FROM branch_reconciliation_runs
    WHERE company_id = ? AND run_no LIKE ?
    ORDER BY run_no DESC
    LIMIT 1
    FOR UPDATE
    `,
    [companyId, `${prefix}%`]
  );
  const last = String(rows[0]?.run_no || "");
  const next = (Number(last.slice(prefix.length)) || 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function buildBranchAuditException(row = {}) {
  return {
    branch_id: row.branch_id ?? row.actual_branch_id ?? row.expected_branch_id ?? null,
    stock_id: row.stock_id ?? null,
    barcode: String(row.barcode || "").trim().slice(0, 255),
    exception_type: normalizeAuditExceptionType(row.exception_type) || "UNKNOWN",
    severity: normalizeAuditSeverity(row.severity) || "MEDIUM",
    expected_branch_id: row.expected_branch_id ?? null,
    actual_branch_id: row.actual_branch_id ?? null,
    expected_state: String(row.expected_state || "").trim().slice(0, 50),
    actual_state: String(row.actual_state || "").trim().slice(0, 50),
    description: String(row.description || "").trim()
  };
}

function getAuditBranchFilter(branchScope, column = "s.current_branch_id") {
  if (!branchScope?.isBranchFiltered) return { sql: "", params: [] };
  return { sql: ` AND ${column} = ?`, params: [branchScope.branchId] };
}

async function collectBranchAuditExceptions(connection, access, branchScope) {
  const exceptions = [];
  let totalChecked = 0;
  const stockBranchFilter = getAuditBranchFilter(branchScope, "s.current_branch_id");

  const [stockCountRows] = await connection.query(
    `
    SELECT COUNT(*) AS total_checked
    FROM stock s
    WHERE s.company_id = ?
      AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      ${stockBranchFilter.sql}
    `,
    [access.companyScope, ...stockBranchFilter.params]
  );
  totalChecked += Number(stockCountRows[0]?.total_checked || 0);

  const [duplicateRows] = await connection.query(
    `
    SELECT
      MIN(s.current_branch_id) AS branch_id,
      NULL AS stock_id,
      MIN(s.barcode) AS barcode,
      'DUPLICATE_BARCODE' AS exception_type,
      CASE WHEN SUM(CASE WHEN UPPER(COALESCE(s.status, '')) = 'IN_STOCK' THEN 1 ELSE 0 END) > 1 THEN 'CRITICAL' ELSE 'HIGH' END AS severity,
      NULL AS expected_branch_id,
      MIN(s.current_branch_id) AS actual_branch_id,
      'UNIQUE_BARCODE' AS expected_state,
      CONCAT(COUNT(*), '_DUPLICATES') AS actual_state,
      CONCAT('Barcode appears ', COUNT(*), ' times inside the company stock table') AS description
    FROM stock s
    WHERE s.company_id = ?
      AND s.barcode IS NOT NULL
      AND TRIM(s.barcode) <> ''
      AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      ${stockBranchFilter.sql}
    GROUP BY s.company_id, UPPER(TRIM(s.barcode))
    HAVING COUNT(*) > 1
    LIMIT 1000
    `,
    [access.companyScope, ...stockBranchFilter.params]
  );
  exceptions.push(...duplicateRows.map(buildBranchAuditException));

  if (!branchScope?.isBranchFiltered) {
    const [missingBranchRows] = await connection.query(
      `
      SELECT
        NULL AS branch_id,
        s.id AS stock_id,
        s.barcode,
        'MISSING_FROM_BRANCH' AS exception_type,
        'HIGH' AS severity,
        NULL AS expected_branch_id,
        s.current_branch_id AS actual_branch_id,
        'ASSIGNED_BRANCH' AS expected_state,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS actual_state,
        'Stock row has no current branch assignment' AS description
      FROM stock s
      WHERE s.company_id = ?
        AND s.current_branch_id IS NULL
        AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      LIMIT 1000
      `,
      [access.companyScope]
    );
    exceptions.push(...missingBranchRows.map(buildBranchAuditException));
  }

  const [stateNullRows] = await connection.query(
    `
    SELECT
      s.current_branch_id AS branch_id,
      s.id AS stock_id,
      s.barcode,
      'STOCK_STATE_MISMATCH' AS exception_type,
      'MEDIUM' AS severity,
      s.current_branch_id AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      COALESCE(s.status, 'IN_STOCK') AS expected_state,
      COALESCE(s.stock_state, '') AS actual_state,
      'stock_state is blank while status exists' AS description
    FROM stock s
    WHERE s.company_id = ?
      AND (s.stock_state IS NULL OR TRIM(s.stock_state) = '')
      AND TRIM(COALESCE(s.status, '')) <> ''
      AND UPPER(COALESCE(s.status, 'IN_STOCK')) <> 'DELETED'
      ${stockBranchFilter.sql}
    LIMIT 1000
    `,
    [access.companyScope, ...stockBranchFilter.params]
  );
  exceptions.push(...stateNullRows.map(buildBranchAuditException));

  const transferBranchSql = branchScope?.isBranchFiltered ? "AND (bt.from_branch_id = ? OR bt.to_branch_id = ?)" : "";
  const transferBranchParams = branchScope?.isBranchFiltered ? [branchScope.branchId, branchScope.branchId] : [];
  const [staleTransitRows] = await connection.query(
    `
    SELECT
      bt.to_branch_id AS branch_id,
      bti.stock_id,
      bti.barcode,
      'IN_TRANSIT_TOO_LONG' AS exception_type,
      CASE WHEN TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()) >= 120 THEN 'CRITICAL' ELSE 'HIGH' END AS severity,
      bt.to_branch_id AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      'RECEIVED_OR_SHORTAGE' AS expected_state,
      COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, bti.item_status, '') AS actual_state,
      CONCAT('Transfer ', bt.transfer_no, ' is in transit for ', TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()), ' hours') AS description
    FROM branch_transfer_items bti
    INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
    LEFT JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
    WHERE bti.company_id = ?
      AND UPPER(COALESCE(bti.item_status, '')) = 'IN_TRANSIT'
      AND TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()) >= 72
      ${transferBranchSql}
    LIMIT 1000
    `,
    [access.companyScope, ...transferBranchParams]
  );
  exceptions.push(...staleTransitRows.map(buildBranchAuditException));

  const [shortageRows] = await connection.query(
    `
    SELECT
      bti.to_branch_id AS branch_id,
      bti.stock_id,
      bti.barcode,
      'SHORTAGE_UNRESOLVED' AS exception_type,
      'HIGH' AS severity,
      bti.to_branch_id AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      'SHORTAGE_RESOLVED' AS expected_state,
      COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, bti.item_status, '') AS actual_state,
      CONCAT('Shortage remains unresolved for transfer ', bt.transfer_no) AS description
    FROM branch_transfer_items bti
    INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
    LEFT JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
    WHERE bti.company_id = ?
      AND (UPPER(COALESCE(bti.item_status, '')) = 'SHORTAGE'
        OR UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, '')) = 'TRANSFER_SHORTAGE')
      ${transferBranchSql}
    LIMIT 1000
    `,
    [access.companyScope, ...transferBranchParams]
  );
  exceptions.push(...shortageRows.map(buildBranchAuditException));

  const [receivedMismatchRows] = await connection.query(
    `
    SELECT
      bti.to_branch_id AS branch_id,
      bti.stock_id,
      bti.barcode,
      'WRONG_BRANCH' AS exception_type,
      'CRITICAL' AS severity,
      bti.to_branch_id AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      'DESTINATION_BRANCH' AS expected_state,
      COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, '') AS actual_state,
      CONCAT('Received transfer item is not currently at destination branch for transfer ', bt.transfer_no) AS description
    FROM branch_transfer_items bti
    INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
    INNER JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
    WHERE bti.company_id = ?
      AND UPPER(COALESCE(bti.item_status, '')) = 'RECEIVED'
      AND COALESCE(s.current_branch_id, 0) <> COALESCE(bti.to_branch_id, 0)
      ${transferBranchSql}
    LIMIT 1000
    `,
    [access.companyScope, ...transferBranchParams]
  );
  exceptions.push(...receivedMismatchRows.map(buildBranchAuditException));

  const [inTransitMismatchRows] = await connection.query(
    `
    SELECT
      bti.from_branch_id AS branch_id,
      bti.stock_id,
      bti.barcode,
      'STOCK_STATE_MISMATCH' AS exception_type,
      'HIGH' AS severity,
      bti.from_branch_id AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      'IN_TRANSIT' AS expected_state,
      COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, '') AS actual_state,
      CONCAT('Transfer item is IN_TRANSIT but stock row is not marked IN_TRANSIT for transfer ', bt.transfer_no) AS description
    FROM branch_transfer_items bti
    INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
    INNER JOIN stock s ON s.id = bti.stock_id AND s.company_id = bti.company_id
    WHERE bti.company_id = ?
      AND UPPER(COALESCE(bti.item_status, '')) = 'IN_TRANSIT'
      AND UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) <> 'IN_TRANSIT'
      ${transferBranchSql}
    LIMIT 1000
    `,
    [access.companyScope, ...transferBranchParams]
  );
  exceptions.push(...inTransitMismatchRows.map(buildBranchAuditException));

  const [soldMismatchRows] = await connection.query(
    `
    SELECT
      s.current_branch_id AS branch_id,
      s.id AS stock_id,
      s.barcode,
      'SOLD_BUT_IN_STOCK' AS exception_type,
      'CRITICAL' AS severity,
      NULL AS expected_branch_id,
      s.current_branch_id AS actual_branch_id,
      'SOLD_OR_REMOVED_FROM_STOCK' AS expected_state,
      COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, '') AS actual_state,
      CONCAT('Barcode appears in sales items but stock still appears available: ', si.invoice_number) AS description
    FROM sales_items si
    INNER JOIN stock s ON s.company_id = si.company_id AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(si.barcode))
    WHERE si.company_id = ?
      AND COALESCE(si.is_deleted, 0) = 0
      AND UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_STOCK'
      ${stockBranchFilter.sql}
    LIMIT 1000
    `,
    [access.companyScope, ...stockBranchFilter.params]
  );
  exceptions.push(...soldMismatchRows.map(buildBranchAuditException));

  return { exceptions, totalChecked };
}

async function insertBranchAuditExceptions(connection, companyId, runId, exceptions) {
  if (!exceptions.length) return;
  const values = exceptions.map((item) => [
    companyId,
    runId,
    item.branch_id ?? null,
    item.stock_id ?? null,
    item.barcode || "",
    item.exception_type || "UNKNOWN",
    item.severity || "MEDIUM",
    item.expected_branch_id ?? null,
    item.actual_branch_id ?? null,
    item.expected_state || "",
    item.actual_state || "",
    item.description || "",
    "OPEN"
  ]);
  await connection.query(
    `
    INSERT INTO branch_reconciliation_exceptions
    (
      company_id, run_id, branch_id, stock_id, barcode, exception_type, severity,
      expected_branch_id, actual_branch_id, expected_state, actual_state, description, status
    )
    VALUES ?
    `,
    [values]
  );
}

async function createBranchAuditAlerts(connection, companyId, runId, exceptions) {
  const alertExceptions = exceptions.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity));
  if (!alertExceptions.length) return;
  const values = alertExceptions.slice(0, 500).map((item) => [
    companyId,
    item.branch_id ?? item.actual_branch_id ?? item.expected_branch_id ?? null,
    item.exception_type,
    `${item.severity} ${item.exception_type.replace(/_/g, " ")}`,
    item.description || `Audit exception for barcode ${item.barcode || "-"}`,
    item.severity,
    "OPEN",
    "BRANCH_RECONCILIATION_RUN",
    runId
  ]);
  await connection.query(
    `
    INSERT INTO branch_audit_alerts
    (
      company_id, branch_id, alert_type, title, message, severity,
      status, reference_type, reference_id
    )
    VALUES ?
    `,
    [values]
  );
}

app.post("/branch-audit/snapshot", authMiddleware, async (req, res) => {
  let connection;
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: true });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    if (access.isSuperAdmin) return sendSuperAdminReadOnlyError(res);

    const snapshotDate = getAuditDateValue(req.body?.snapshotDate || req.body?.snapshot_date, getTodayDateOnly());
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const branches = await getAuditBranchesForScope(connection, access, branchScope);
    if (!branches.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "No accessible active branch found for snapshot" });
    }
    const snapshots = [];
    for (const branch of branches) {
      snapshots.push(await createOrRefreshBranchSnapshot(connection, access, branch, snapshotDate));
    }
    await connection.commit();
    return res.json({
      success: true,
      message: "Branch stock snapshot refreshed",
      snapshot_date: snapshotDate,
      refreshed: true,
      snapshots
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error("Branch audit snapshot error:", error);
    return res.status(500).json({ success: false, message: "Branch snapshot failed", error: getErrorDetail(error) });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/branch-audit/snapshots", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const dateRange = getAnalyticsDateRange(req);
    const whereParts = ["bs.company_id = ?"];
    const params = [access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("bs.branch_id = ?");
      params.push(branchScope.branchId);
    }
    appendDateRangeFilter(whereParts, params, "bs.snapshot_date", dateRange);
    const [rows] = await pool.query(
      `
      SELECT bs.*, b.branch_code, b.branch_name
      FROM branch_stock_snapshots bs
      LEFT JOIN branches b ON b.id = bs.branch_id AND b.company_id = bs.company_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY bs.snapshot_date DESC, bs.id DESC
      ${pagination.sql}
      `,
      params
    );
    setPaginationHeaders(res, pagination);
    return res.json({ success: true, snapshots: rows, limit: pagination.limit, offset: pagination.offset });
  } catch (error) {
    console.error("Branch audit snapshots fetch error:", error);
    return res.status(500).json({ success: false, message: "Snapshots fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-audit/snapshots/:id", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const snapshotId = parsePositiveInteger(req.params.id);
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const whereParts = ["bs.id = ?", "bs.company_id = ?"];
    const params = [snapshotId, access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("bs.branch_id = ?");
      params.push(branchScope.branchId);
    }
    const [snapshotRows] = await pool.query(
      `
      SELECT bs.*, b.branch_code, b.branch_name
      FROM branch_stock_snapshots bs
      LEFT JOIN branches b ON b.id = bs.branch_id AND b.company_id = bs.company_id
      WHERE ${whereParts.join(" AND ")}
      LIMIT 1
      `,
      params
    );
    if (!snapshotRows.length) return res.status(404).json({ success: false, message: "Snapshot not found" });
    const [items] = await pool.query(
      `
      SELECT *
      FROM branch_stock_snapshot_items
      WHERE company_id = ? AND snapshot_id = ?
      ORDER BY id ASC
      ${pagination.sql}
      `,
      [access.companyScope, snapshotId]
    );
    setPaginationHeaders(res, pagination);
    return res.json({ success: true, snapshot: snapshotRows[0], items, limit: pagination.limit, offset: pagination.offset });
  } catch (error) {
    console.error("Branch audit snapshot detail error:", error);
    return res.status(500).json({ success: false, message: "Snapshot detail fetch failed", error: getErrorDetail(error) });
  }
});

app.post("/branch-audit/reconcile", authMiddleware, async (req, res) => {
  let connection;
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: true });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    if (access.isSuperAdmin) return sendSuperAdminReadOnlyError(res);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const runNo = await generateBranchAuditRunNo(connection, access.companyScope);
    const fromDate = getAuditDateValue(req.body?.fromDate || req.body?.from_date);
    const toDate = getAuditDateValue(req.body?.toDate || req.body?.to_date);
    const notes = String(req.body?.notes || "").trim();
    const [runInsert] = await connection.query(
      `
      INSERT INTO branch_reconciliation_runs
      (company_id, branch_id, run_no, run_type, from_date, to_date, status, created_by, created_at, notes)
      VALUES (?, ?, ?, 'MANUAL', ?, ?, 'RUNNING', ?, NOW(), ?)
      `,
      [access.companyScope, branchScope.isBranchFiltered ? branchScope.branchId : null, runNo, fromDate || null, toDate || null, access.actingUserId ?? null, notes || null]
    );
    const runId = runInsert.insertId;
    const { exceptions, totalChecked } = await collectBranchAuditExceptions(connection, access, branchScope);
    await insertBranchAuditExceptions(connection, access.companyScope, runId, exceptions);
    await createBranchAuditAlerts(connection, access.companyScope, runId, exceptions);
    await connection.query(
      `
      UPDATE branch_reconciliation_runs
      SET status = 'COMPLETED',
          total_checked = ?,
          exception_count = ?,
          completed_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [totalChecked, exceptions.length, runId, access.companyScope]
    );
    await connection.commit();
    return res.json({
      success: true,
      message: "Reconciliation audit completed",
      run: {
        id: runId,
        run_no: runNo,
        branch_id: branchScope.isBranchFiltered ? branchScope.branchId : null,
        total_checked: totalChecked,
        exception_count: exceptions.length,
        status: "COMPLETED"
      },
      counts: exceptions.reduce((summary, item) => {
        summary.by_type[item.exception_type] = (summary.by_type[item.exception_type] || 0) + 1;
        summary.by_severity[item.severity] = (summary.by_severity[item.severity] || 0) + 1;
        return summary;
      }, { by_type: {}, by_severity: {} })
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error("Branch audit reconcile error:", error);
    return res.status(500).json({ success: false, message: "Reconciliation audit failed", error: getErrorDetail(error) });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/branch-audit/runs", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const dateRange = getAnalyticsDateRange(req);
    const status = normalizeAuditStatus(req.query.status || "");
    const whereParts = ["br.company_id = ?"];
    const params = [access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("(br.branch_id = ? OR br.branch_id IS NULL)");
      params.push(branchScope.branchId);
    }
    if (status) {
      whereParts.push("UPPER(COALESCE(br.status, '')) = ?");
      params.push(status);
    }
    appendDateRangeFilter(whereParts, params, "br.created_at", dateRange);
    const [rows] = await pool.query(
      `
      SELECT br.*, b.branch_code, b.branch_name
      FROM branch_reconciliation_runs br
      LEFT JOIN branches b ON b.id = br.branch_id AND b.company_id = br.company_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY br.id DESC
      ${pagination.sql}
      `,
      params
    );
    setPaginationHeaders(res, pagination);
    return res.json({ success: true, runs: rows, limit: pagination.limit, offset: pagination.offset });
  } catch (error) {
    console.error("Branch audit runs fetch error:", error);
    return res.status(500).json({ success: false, message: "Audit runs fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-audit/runs/:id", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const runId = parsePositiveInteger(req.params.id);
    const exceptionPagination = getPagination(req, { defaultLimit: 200, maxLimit: 500 });
    const runWhere = ["br.id = ?", "br.company_id = ?"];
    const runParams = [runId, access.companyScope];
    if (branchScope.isBranchFiltered) {
      runWhere.push("(br.branch_id = ? OR br.branch_id IS NULL)");
      runParams.push(branchScope.branchId);
    }
    const [runRows] = await pool.query(
      `
      SELECT br.*, b.branch_code, b.branch_name
      FROM branch_reconciliation_runs br
      LEFT JOIN branches b ON b.id = br.branch_id AND b.company_id = br.company_id
      WHERE ${runWhere.join(" AND ")}
      LIMIT 1
      `,
      runParams
    );
    if (!runRows.length) return res.status(404).json({ success: false, message: "Audit run not found" });
    const exceptionWhere = ["company_id = ?", "run_id = ?"];
    const exceptionParams = [access.companyScope, runId];
    if (branchScope.isBranchFiltered) {
      exceptionWhere.push("(branch_id = ? OR branch_id IS NULL)");
      exceptionParams.push(branchScope.branchId);
    }
    const [exceptions] = await pool.query(
      `
      SELECT *
      FROM branch_reconciliation_exceptions
      WHERE ${exceptionWhere.join(" AND ")}
      ORDER BY FIELD(severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), id DESC
      ${exceptionPagination.sql}
      `,
      exceptionParams
    );
    const [countRows] = await pool.query(
      `
      SELECT exception_type, severity, status, COUNT(*) AS count
      FROM branch_reconciliation_exceptions
      WHERE ${exceptionWhere.join(" AND ")}
      GROUP BY exception_type, severity, status
      `,
      exceptionParams
    );
    const counts = { by_type: {}, by_severity: {}, by_status: {} };
    countRows.forEach((row) => {
      counts.by_type[row.exception_type] = (counts.by_type[row.exception_type] || 0) + Number(row.count || 0);
      counts.by_severity[row.severity] = (counts.by_severity[row.severity] || 0) + Number(row.count || 0);
      counts.by_status[row.status] = (counts.by_status[row.status] || 0) + Number(row.count || 0);
    });
    setPaginationHeaders(res, exceptionPagination);
    return res.json({ success: true, run: runRows[0], exceptions, counts, limit: exceptionPagination.limit, offset: exceptionPagination.offset });
  } catch (error) {
    console.error("Branch audit run detail error:", error);
    return res.status(500).json({ success: false, message: "Audit run detail fetch failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-audit/exceptions", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const status = normalizeAuditStatus(req.query.status || "");
    const severity = normalizeAuditSeverity(req.query.severity || "");
    const exceptionType = normalizeAuditExceptionType(req.query.exceptionType || req.query.exception_type || "");
    const barcode = String(req.query.barcode || "").trim();
    const whereParts = ["e.company_id = ?"];
    const params = [access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("(e.branch_id = ? OR e.branch_id IS NULL)");
      params.push(branchScope.branchId);
    }
    if (status) {
      whereParts.push("UPPER(COALESCE(e.status, '')) = ?");
      params.push(status);
    }
    if (severity) {
      whereParts.push("UPPER(COALESCE(e.severity, '')) = ?");
      params.push(severity);
    }
    if (exceptionType) {
      whereParts.push("UPPER(COALESCE(e.exception_type, '')) = ?");
      params.push(exceptionType);
    }
    if (barcode) {
      whereParts.push("e.barcode LIKE ?");
      params.push(`%${barcode}%`);
    }
    const [rows] = await pool.query(
      `
      SELECT e.*, b.branch_code, b.branch_name, r.run_no
      FROM branch_reconciliation_exceptions e
      LEFT JOIN branches b ON b.id = e.branch_id AND b.company_id = e.company_id
      LEFT JOIN branch_reconciliation_runs r ON r.id = e.run_id AND r.company_id = e.company_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY FIELD(e.severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), e.id DESC
      ${pagination.sql}
      `,
      params
    );
    setPaginationHeaders(res, pagination);
    return res.json({ success: true, exceptions: rows, canApprove: canApproveBranchAudit(access), limit: pagination.limit, offset: pagination.offset });
  } catch (error) {
    console.error("Branch audit exceptions fetch error:", error);
    return res.status(500).json({ success: false, message: "Exceptions fetch failed", error: getErrorDetail(error) });
  }
});

app.post("/branch-audit/exceptions/:id/approve", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: true });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    if (access.isSuperAdmin) return sendSuperAdminReadOnlyError(res);
    if (!canApproveBranchAudit(access)) {
      return res.status(403).json({ success: false, message: "Only Owner/Admin/Accounts can approve audit exceptions" });
    }
    const exceptionId = parsePositiveInteger(req.params.id);
    const resolutionNote = String(req.body?.resolution_note || req.body?.resolutionNote || "").trim();
    if (!resolutionNote) return res.status(400).json({ success: false, message: "resolution_note is required" });
    const whereParts = ["id = ?", "company_id = ?"];
    const params = [exceptionId, access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("(branch_id = ? OR branch_id IS NULL)");
      params.push(branchScope.branchId);
    }
    const [result] = await pool.query(
      `
      UPDATE branch_reconciliation_exceptions
      SET status = 'APPROVED',
          approved_by = ?,
          approved_at = NOW(),
          resolution_note = ?,
          updated_at = NOW()
      WHERE ${whereParts.join(" AND ")}
        AND UPPER(COALESCE(status, 'OPEN')) = 'OPEN'
      `,
      [access.actingUserId ?? null, resolutionNote, ...params]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Open exception not found" });
    return res.json({ success: true, message: "Audit exception approved and closed" });
  } catch (error) {
    console.error("Branch audit exception approve error:", error);
    return res.status(500).json({ success: false, message: "Exception approval failed", error: getErrorDetail(error) });
  }
});

app.post("/branch-audit/alerts/:id/resolve", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: true });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    if (access.isSuperAdmin) return sendSuperAdminReadOnlyError(res);
    if (!canApproveBranchAudit(access)) {
      return res.status(403).json({ success: false, message: "Only Owner/Admin/Accounts can resolve audit alerts" });
    }
    const alertId = parsePositiveInteger(req.params.id);
    const resolutionNote = String(req.body?.resolution_note || req.body?.resolutionNote || "").trim();
    const whereParts = ["id = ?", "company_id = ?"];
    const params = [alertId, access.companyScope];
    if (branchScope.isBranchFiltered) {
      whereParts.push("(branch_id = ? OR branch_id IS NULL)");
      params.push(branchScope.branchId);
    }
    const [result] = await pool.query(
      `
      UPDATE branch_audit_alerts
      SET status = 'RESOLVED',
          resolved_by = ?,
          resolved_at = NOW(),
          resolution_note = ? 
      WHERE ${whereParts.join(" AND ")}
        AND UPPER(COALESCE(status, 'OPEN')) = 'OPEN'
      `,
      [access.actingUserId ?? null, resolutionNote || null, ...params]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Open alert not found" });
    return res.json({ success: true, message: "Audit alert resolved" });
  } catch (error) {
    console.error("Branch audit alert resolve error:", error);
    return res.status(500).json({ success: false, message: "Alert resolve failed", error: getErrorDetail(error) });
  }
});

app.get("/branch-audit/dashboard", authMiddleware, async (req, res) => {
  try {
    const { access, branchScope } = await resolveBranchAuditAccess(req, { requireCompanyScope: false });
    if (!access.ok) return sendAccessError(res, access);
    if (!branchScope.ok) return sendAccessError(res, branchScope);
    const branchSql = branchScope.isBranchFiltered ? "AND (branch_id = ? OR branch_id IS NULL)" : "";
    const branchParams = branchScope.isBranchFiltered ? [branchScope.branchId] : [];
    const [summaryRows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN UPPER(status) = 'OPEN' THEN 1 ELSE 0 END) AS open_exceptions,
        SUM(CASE WHEN UPPER(status) = 'OPEN' AND severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_exceptions,
        SUM(CASE WHEN UPPER(status) = 'OPEN' AND severity = 'HIGH' THEN 1 ELSE 0 END) AS high_exceptions
      FROM branch_reconciliation_exceptions
      WHERE company_id = ?
        ${branchSql}
      `,
      [access.companyScope, ...branchParams]
    );
    const transferBranchSql = branchScope.isBranchFiltered ? "AND (bt.from_branch_id = ? OR bt.to_branch_id = ?)" : "";
    const transferBranchParams = branchScope.isBranchFiltered ? [branchScope.branchId, branchScope.branchId] : [];
    const [staleRows] = await pool.query(
      `
      SELECT COUNT(*) AS stale_transfers
      FROM branch_transfers bt
      WHERE bt.company_id = ?
        AND UPPER(COALESCE(bt.status, '')) IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED')
        AND TIMESTAMPDIFF(HOUR, COALESCE(bt.dispatched_at, bt.created_at), NOW()) >= 72
        ${transferBranchSql}
      `,
      [access.companyScope, ...transferBranchParams]
    );
    const [shortageRows] = await pool.query(
      `
      SELECT COUNT(*) AS unresolved_shortages
      FROM branch_transfer_items bti
      INNER JOIN branch_transfers bt ON bt.id = bti.transfer_id AND bt.company_id = bti.company_id
      WHERE bti.company_id = ?
        AND UPPER(COALESCE(bti.item_status, '')) = 'SHORTAGE'
        ${transferBranchSql}
      `,
      [access.companyScope, ...transferBranchParams]
    );
    const [alertRows] = await pool.query(
      `
      SELECT *
      FROM branch_audit_alerts
      WHERE company_id = ?
        AND UPPER(COALESCE(status, 'OPEN')) = 'OPEN'
        ${branchSql}
      ORDER BY FIELD(severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), id DESC
      LIMIT 50
      `,
      [access.companyScope, ...branchParams]
    );
    const [snapshotRows] = await pool.query(
      `
      SELECT bs.*, b.branch_code, b.branch_name
      FROM branch_stock_snapshots bs
      LEFT JOIN branches b ON b.id = bs.branch_id AND b.company_id = bs.company_id
      WHERE bs.company_id = ?
        ${branchScope.isBranchFiltered ? "AND bs.branch_id = ?" : ""}
      ORDER BY bs.snapshot_date DESC, bs.id DESC
      LIMIT 10
      `,
      branchScope.isBranchFiltered ? [access.companyScope, branchScope.branchId] : [access.companyScope]
    );
    const [runRows] = await pool.query(
      `
      SELECT br.*, b.branch_code, b.branch_name
      FROM branch_reconciliation_runs br
      LEFT JOIN branches b ON b.id = br.branch_id AND b.company_id = br.company_id
      WHERE br.company_id = ?
        ${branchSql.replaceAll("branch_id", "br.branch_id")}
      ORDER BY br.id DESC
      LIMIT 10
      `,
      [access.companyScope, ...branchParams]
    );
    const [riskRows] = await pool.query(
      `
      SELECT
        b.id AS branch_id,
        b.branch_code,
        b.branch_name,
        COALESCE(SUM(CASE WHEN e.severity = 'CRITICAL' AND e.status = 'OPEN' THEN 5 ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN e.severity = 'HIGH' AND e.status = 'OPEN' THEN 3 ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN e.severity = 'MEDIUM' AND e.status = 'OPEN' THEN 1 ELSE 0 END), 0) AS risk_score,
        COUNT(e.id) AS open_exception_count
      FROM branches b
      LEFT JOIN branch_reconciliation_exceptions e
        ON e.branch_id = b.id
       AND e.company_id = b.company_id
       AND UPPER(COALESCE(e.status, 'OPEN')) = 'OPEN'
      WHERE b.company_id = ?
        ${branchScope.isBranchFiltered ? "AND b.id = ?" : ""}
      GROUP BY b.id, b.branch_code, b.branch_name
      ORDER BY risk_score DESC, b.branch_name ASC
      LIMIT 50
      `,
      branchScope.isBranchFiltered ? [access.companyScope, branchScope.branchId] : [access.companyScope]
    );
    const summary = summaryRows[0] || {};
    return res.json({
      success: true,
      open_exceptions: Number(summary.open_exceptions || 0),
      critical_exceptions: Number(summary.critical_exceptions || 0),
      high_exceptions: Number(summary.high_exceptions || 0),
      stale_transfers: Number(staleRows[0]?.stale_transfers || 0),
      unresolved_shortages: Number(shortageRows[0]?.unresolved_shortages || 0),
      open_alerts: alertRows,
      latest_snapshots: snapshotRows,
      latest_reconciliation_runs: runRows,
      branch_risk: riskRows.map((row) => ({
        ...row,
        risk_score: Number(row.risk_score || 0),
        open_exception_count: Number(row.open_exception_count || 0)
      })),
      canApprove: canApproveBranchAudit(access)
    });
  } catch (error) {
    console.error("Branch audit dashboard error:", error);
    return res.status(500).json({ success: false, message: "Audit dashboard fetch failed", error: getErrorDetail(error) });
  }
});

app.post("/branch-transfers", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const fromBranchId = parsePositiveInteger(req.body?.from_branch_id ?? req.body?.fromBranchId);
    const toBranchId = parsePositiveInteger(req.body?.to_branch_id ?? req.body?.toBranchId);
    const challanNo = String(req.body?.challan_no ?? req.body?.challanNo ?? "").trim().slice(0, 80);
    const notes = String(req.body?.notes ?? "").trim();

    if (!fromBranchId || !toBranchId) {
      return res.status(400).json({
        success: false,
        message: "from_branch_id and to_branch_id are required"
      });
    }

    if (fromBranchId === toBranchId) {
      return res.status(400).json({
        success: false,
        message: "from_branch_id and to_branch_id cannot be same"
      });
    }

    if (!canCreateTransferFromBranch(access, fromBranchId)) {
      return res.status(403).json({
        success: false,
        message: "You can create transfers only from your assigned branch"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const fromBranch = await getBranchForCompany(connection, access.companyScope, fromBranchId);
    const toBranch = await getBranchForCompany(connection, access.companyScope, toBranchId);

    if (!fromBranch || !toBranch) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Both branches must belong to this company"
      });
    }

    const transferNo = await generateTransferNumberForCompany(connection, access.companyScope);
    const [insertResult] = await connection.query(
      `
      INSERT INTO branch_transfers
      (
        company_id,
        transfer_no,
        from_branch_id,
        to_branch_id,
        status,
        challan_no,
        notes,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 'CREATED', ?, ?, ?, NOW(), NOW())
      `,
      [
        access.companyScope,
        transferNo,
        fromBranchId,
        toBranchId,
        challanNo || null,
        notes || null,
        access.actingUserId ?? null
      ]
    );

    const transfer = await getTransferForAccess(connection, access, insertResult.insertId);
    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId: insertResult.insertId,
      actionType: "CREATE",
      afterData: transfer,
      reason: "Transfer draft created"
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Transfer draft created successfully",
      transfer
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer create error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer draft create failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/branch-transfers", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const status = normalizeTransferStatus(req.query.status);
    const fromBranchId = parsePositiveInteger(req.query.fromBranchId ?? req.query.from_branch_id);
    const toBranchId = parsePositiveInteger(req.query.toBranchId ?? req.query.to_branch_id);
    const whereParts = [];
    const params = [];

    if (access.companyScope !== null) {
      whereParts.push("bt.company_id = ?");
      params.push(access.companyScope);
    }

    if (access.isBranchLocked) {
      whereParts.push("(bt.from_branch_id = ? OR bt.to_branch_id = ?)");
      params.push(access.userBranchId, access.userBranchId);
    }

    if (status) {
      whereParts.push("UPPER(COALESCE(bt.status, '')) = ?");
      params.push(status);
    }

    if (fromBranchId) {
      if (!canAccessTransferBranch(access, fromBranchId)) {
        return res.status(403).json({
          success: false,
          message: "You cannot access another branch"
        });
      }
      whereParts.push("bt.from_branch_id = ?");
      params.push(fromBranchId);
    }

    if (toBranchId) {
      if (!canAccessTransferBranch(access, toBranchId)) {
        return res.status(403).json({
          success: false,
          message: "You cannot access another branch"
        });
      }
      whereParts.push("bt.to_branch_id = ?");
      params.push(toBranchId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        bt.*,
        fb.branch_code AS from_branch_code,
        fb.branch_name AS from_branch_name,
        tb.branch_code AS to_branch_code,
        tb.branch_name AS to_branch_name,
        COALESCE(item_counts.total_items, 0) AS total_items,
        COALESCE(item_counts.active_items, 0) AS active_items
      FROM branch_transfers bt
      LEFT JOIN branches fb
        ON fb.id = bt.from_branch_id
       AND fb.company_id = bt.company_id
      LEFT JOIN branches tb
        ON tb.id = bt.to_branch_id
       AND tb.company_id = bt.company_id
      LEFT JOIN (
        SELECT
          transfer_id,
          company_id,
          COUNT(*) AS total_items,
          SUM(CASE WHEN UPPER(COALESCE(item_status, '')) <> 'CANCELLED' THEN 1 ELSE 0 END) AS active_items
        FROM branch_transfer_items
        GROUP BY transfer_id, company_id
      ) item_counts
        ON item_counts.transfer_id = bt.id
       AND item_counts.company_id = bt.company_id
      ${whereSql}
      ORDER BY bt.id DESC
      ${pagination.sql}
      `,
      params
    );

    setPaginationHeaders(res, pagination);
    return res.json({
      success: true,
      transfers: rows,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (error) {
    console.error("Branch transfers fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch transfers fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-transfers/incoming", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
    const requestedStatus = normalizeTransferStatus(req.query.status);
    const branchId = parsePositiveInteger(req.query.branchId ?? req.query.branch_id);
    const whereParts = [];
    const params = [];

    if (access.companyScope !== null) {
      whereParts.push("bt.company_id = ?");
      params.push(access.companyScope);
    }

    if (access.isBranchLocked) {
      whereParts.push("bt.to_branch_id = ?");
      params.push(access.userBranchId);
    }

    if (branchId) {
      if (!canAccessTransferBranch(access, branchId)) {
        return res.status(403).json({
          success: false,
          message: "You cannot access another branch"
        });
      }

      whereParts.push("bt.to_branch_id = ?");
      params.push(branchId);
    }

    if (requestedStatus) {
      whereParts.push("UPPER(COALESCE(bt.status, '')) = ?");
      params.push(requestedStatus);
    } else {
      whereParts.push("UPPER(COALESCE(bt.status, '')) IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED')");
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        bt.*,
        fb.branch_code AS from_branch_code,
        fb.branch_name AS from_branch_name,
        tb.branch_code AS to_branch_code,
        tb.branch_name AS to_branch_name,
        COALESCE(item_counts.total_items, 0) AS total_items,
        COALESCE(item_counts.in_transit_items, 0) AS pending_items,
        COALESCE(item_counts.received_items, 0) AS received_items,
        COALESCE(item_counts.shortage_items, 0) AS shortage_items
      FROM branch_transfers bt
      LEFT JOIN branches fb
        ON fb.id = bt.from_branch_id
       AND fb.company_id = bt.company_id
      LEFT JOIN branches tb
        ON tb.id = bt.to_branch_id
       AND tb.company_id = bt.company_id
      LEFT JOIN (
        SELECT
          transfer_id,
          company_id,
          SUM(CASE WHEN UPPER(COALESCE(item_status, '')) <> 'CANCELLED' THEN 1 ELSE 0 END) AS total_items,
          SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_items,
          SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'RECEIVED' THEN 1 ELSE 0 END) AS received_items,
          SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'SHORTAGE' THEN 1 ELSE 0 END) AS shortage_items
        FROM branch_transfer_items
        GROUP BY transfer_id, company_id
      ) item_counts
        ON item_counts.transfer_id = bt.id
       AND item_counts.company_id = bt.company_id
      ${whereSql}
      ORDER BY bt.id DESC
      ${pagination.sql}
      `,
      params
    );

    setPaginationHeaders(res, pagination);
    return res.json({
      success: true,
      transfers: rows,
      limit: pagination.limit,
      offset: pagination.offset
    });
  } catch (error) {
    console.error("Incoming branch transfers fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Incoming branch transfers fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branch-transfers/:id", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const transferId = parsePositiveInteger(req.params.id);
    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    connection = await pool.getConnection();
    const transfer = await getTransferForAccess(connection, access, transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    const [items] = await connection.query(
      `
      SELECT
        bti.*,
        s.product_name,
        s.sku,
        s.lot_number,
        s.weight,
        s.status AS stock_status,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS effective_stock_state
      FROM branch_transfer_items bti
      LEFT JOIN stock s
        ON s.id = bti.stock_id
       AND s.company_id = bti.company_id
      WHERE bti.transfer_id = ?
        AND bti.company_id = ?
      ORDER BY bti.id ASC
      `,
      [transferId, transfer.company_id]
    );

    const counts = items.reduce(
      (summary, item) => {
        const itemStatus = String(item.item_status || "").trim().toUpperCase();
        summary.total_items += 1;
        if (itemStatus === "PENDING_DISPATCH") summary.pending_dispatch_items += 1;
        if (itemStatus === "IN_TRANSIT") summary.in_transit_items += 1;
        if (itemStatus === "RECEIVED") summary.received_items += 1;
        if (itemStatus === "CANCELLED") summary.cancelled_items += 1;
        return summary;
      },
      {
        total_items: 0,
        pending_dispatch_items: 0,
        in_transit_items: 0,
        received_items: 0,
        cancelled_items: 0
      }
    );

    return res.json({
      success: true,
      transfer,
      items,
      counts
    });
  } catch (error) {
    console.error("Branch transfer detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch transfer detail failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branch-transfers/:id/dispatch", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    if (String(transfer.status || "").trim().toUpperCase() !== "CREATED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only CREATED transfers can be dispatched"
      });
    }

    if (!canCreateTransferFromBranch(access, transfer.from_branch_id)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can dispatch transfers only from your assigned branch"
      });
    }

    if (Number(transfer.from_branch_id || 0) === Number(transfer.to_branch_id || 0)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Transfer source and destination branch cannot be same"
      });
    }

    const fromBranch = await getBranchForCompany(connection, access.companyScope, transfer.from_branch_id);
    const toBranch = await getBranchForCompany(connection, access.companyScope, transfer.to_branch_id);
    if (!fromBranch || !toBranch) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer branches must belong to this company"
      });
    }

    const [activeItems] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(item_status, 'PENDING_DISPATCH')) = 'PENDING_DISPATCH'
      ORDER BY id ASC
      FOR UPDATE
      `,
      [transferId, access.companyScope]
    );

    if (!activeItems.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Transfer must have at least one pending item before dispatch"
      });
    }

    const lockedItems = [];

    for (const item of activeItems) {
      const normalizedBarcode = normalizeBarcodeForComparison(item.barcode);
      if (!normalizedBarcode) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Transfer item has an empty barcode"
        });
      }

      const [stockRows] = await connection.query(
        `
        SELECT
          id,
          company_id,
          barcode,
          product_name,
          sku,
          lot_number,
          weight,
          status,
          stock_state,
          current_branch_id
        FROM stock
        WHERE company_id = ?
          AND UPPER(TRIM(barcode)) = ?
        ORDER BY id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [access.companyScope, normalizedBarcode]
      );

      if (!stockRows.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Barcode ${item.barcode} was not found in this company stock`
        });
      }

      if (stockRows.length > 1) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: DUPLICATE_BARCODE_MESSAGE
        });
      }

      const stockItem = stockRows[0];
      const stockStatus = String(stockItem.status || "IN_STOCK").trim().toUpperCase();
      const effectiveStockState = getEffectiveStockState(stockItem);

      if (Number(stockItem.company_id || 0) !== Number(access.companyScope || 0)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Barcode ${item.barcode} does not belong to this company`
        });
      }

      if (Number(stockItem.current_branch_id || 0) !== Number(transfer.from_branch_id || 0)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Barcode ${item.barcode} does not belong to the transfer source branch`
        });
      }

      if (stockStatus !== "IN_STOCK" || effectiveStockState !== "IN_STOCK") {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Barcode ${item.barcode} is not available in stock for dispatch`
        });
      }

      if (["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED", "IN_TRANSIT"].includes(stockStatus) ||
        ["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED", "IN_TRANSIT"].includes(effectiveStockState)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Barcode ${item.barcode} cannot be dispatched because it is sold, damaged, deleted, or already in transit`
        });
      }

      const [otherTransferRows] = await connection.query(
        `
        SELECT bti.id, bti.transfer_id
        FROM branch_transfer_items bti
        INNER JOIN branch_transfers bt
          ON bt.id = bti.transfer_id
         AND bt.company_id = bti.company_id
        WHERE bti.company_id = ?
          AND UPPER(TRIM(bti.barcode)) = ?
          AND bti.transfer_id <> ?
          AND UPPER(COALESCE(bti.item_status, 'PENDING_DISPATCH')) IN ('PENDING_DISPATCH', 'IN_TRANSIT')
          AND UPPER(COALESCE(bt.status, 'CREATED')) NOT IN ('CANCELLED', 'RECEIVED', 'SHORTAGE')
        LIMIT 1
        `,
        [access.companyScope, normalizedBarcode, transferId]
      );

      if (otherTransferRows.length) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Barcode ${item.barcode} is already in another open transfer`
        });
      }

      const [stockUpdateResult] = await connection.query(
        `
        UPDATE stock
        SET stock_state = 'IN_TRANSIT',
            updated_at = NOW()
        WHERE id = ?
          AND company_id = ?
          AND current_branch_id = ?
          AND UPPER(COALESCE(status, 'IN_STOCK')) = 'IN_STOCK'
          AND UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_STOCK'
        `,
        [stockItem.id, access.companyScope, transfer.from_branch_id]
      );

      if (Number(stockUpdateResult?.affectedRows || 0) !== 1) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Barcode ${item.barcode} could not be locked for dispatch`
        });
      }

      await connection.query(
        `
        UPDATE branch_transfer_items
        SET item_status = 'IN_TRANSIT',
            stock_id = ?,
            updated_at = NOW()
        WHERE id = ?
          AND transfer_id = ?
          AND company_id = ?
          AND UPPER(COALESCE(item_status, 'PENDING_DISPATCH')) = 'PENDING_DISPATCH'
        `,
        [stockItem.id, item.id, transferId, access.companyScope]
      );

      lockedItems.push({
        item_id: item.id,
        stock_id: stockItem.id,
        barcode: stockItem.barcode || item.barcode
      });
    }

    await connection.query(
      `
      UPDATE branch_transfers
      SET status = 'IN_TRANSIT',
          dispatched_by = ?,
          dispatched_at = NOW(),
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [access.actingUserId ?? null, transferId, access.companyScope]
    );

    const dispatchedTransfer = await getTransferForAccess(connection, access, transferId);
    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "DISPATCH",
      beforeData: transfer,
      afterData: {
        transfer: dispatchedTransfer,
        lockedItems
      },
      reason: "Transfer dispatched"
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Transfer dispatched successfully",
      transfer: dispatchedTransfer,
      dispatchedItems: lockedItems
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer dispatch error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer dispatch failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branch-transfers/:id/receive-scan", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    const barcode = String(req.body?.barcode || "").trim();
    const deviceInfo = req.body?.device_info ?? req.body?.deviceInfo ?? null;

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    const failWithReceiveLog = async (statusCode, message, {
      transfer = null,
      item = null,
      stock = null,
      scanStatus = "FAILED",
      reason = message
    } = {}) => {
      if (connection) {
        try {
          await connection.rollback();
        } catch (_) {}
      }

      await writeBranchReceiveLogSafe(pool, access, {
        transferId,
        barcode,
        stockId: stock?.id ?? item?.stock_id ?? null,
        branchId: transfer?.to_branch_id ?? null,
        scanStatus,
        reason,
        deviceInfo
      });

      return res.status(statusCode).json({
        success: false,
        message
      });
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      return failWithReceiveLog(404, "Transfer not found", {
        scanStatus: "TRANSFER_NOT_FOUND"
      });
    }

    const transferStatus = String(transfer.status || "").trim().toUpperCase();
    if (!["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(transferStatus)) {
      return failWithReceiveLog(400, "Only IN_TRANSIT or PARTIALLY_RECEIVED transfers can be received", {
        transfer,
        scanStatus: "INVALID_TRANSFER_STATUS"
      });
    }

    if (!canReceiveTransferToBranch(access, transfer.to_branch_id)) {
      return failWithReceiveLog(403, "You can receive transfers only for your assigned destination branch", {
        transfer,
        scanStatus: "WRONG_BRANCH"
      });
    }

    const toBranch = await getBranchForCompany(connection, access.companyScope, transfer.to_branch_id);
    if (!toBranch) {
      return failWithReceiveLog(404, "Destination branch was not found for this company", {
        transfer,
        scanStatus: "BRANCH_NOT_FOUND"
      });
    }

    const normalizedBarcode = normalizeBarcodeForComparison(barcode);
    const [itemRows] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(TRIM(barcode)) = ?
      ORDER BY id DESC
      LIMIT 2
      FOR UPDATE
      `,
      [transferId, access.companyScope, normalizedBarcode]
    );

    if (!itemRows.length) {
      return failWithReceiveLog(404, "Barcode does not belong to this transfer", {
        transfer,
        scanStatus: "WRONG_BARCODE",
        reason: "Barcode was scanned against the wrong transfer or branch"
      });
    }

    if (itemRows.length > 1) {
      return failWithReceiveLog(409, "Duplicate transfer item barcode found", {
        transfer,
        item: itemRows[0],
        scanStatus: "DUPLICATE_TRANSFER_ITEM"
      });
    }

    const transferItem = itemRows[0];
    const itemStatus = String(transferItem.item_status || "").trim().toUpperCase();

    if (itemStatus === "RECEIVED") {
      return failWithReceiveLog(409, "Barcode is already received in this transfer", {
        transfer,
        item: transferItem,
        scanStatus: "DUPLICATE_RECEIVE"
      });
    }

    if (itemStatus !== "IN_TRANSIT") {
      return failWithReceiveLog(400, "Only IN_TRANSIT transfer items can be received", {
        transfer,
        item: transferItem,
        scanStatus: "INVALID_ITEM_STATUS"
      });
    }

    const [stockRows] = await connection.query(
      `
      SELECT
        id,
        company_id,
        barcode,
        product_name,
        sku,
        lot_number,
        weight,
        status,
        stock_state,
        current_branch_id
      FROM stock
      WHERE company_id = ?
        AND UPPER(TRIM(barcode)) = ?
      ORDER BY id DESC
      LIMIT 2
      FOR UPDATE
      `,
      [access.companyScope, normalizedBarcode]
    );

    if (!stockRows.length) {
      return failWithReceiveLog(404, "Stock row was not found for this barcode", {
        transfer,
        item: transferItem,
        scanStatus: "UNKNOWN_BARCODE"
      });
    }

    if (stockRows.length > 1) {
      return failWithReceiveLog(409, DUPLICATE_BARCODE_MESSAGE, {
        transfer,
        item: transferItem,
        stock: stockRows[0],
        scanStatus: "DUPLICATE_STOCK_BARCODE"
      });
    }

    const stockItem = stockRows[0];
    const stockStatus = String(stockItem.status || "IN_STOCK").trim().toUpperCase();
    const effectiveStockState = getEffectiveStockState(stockItem);

    if (Number(stockItem.company_id || 0) !== Number(access.companyScope || 0)) {
      return failWithReceiveLog(400, "Barcode does not belong to this company", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "WRONG_COMPANY"
      });
    }

    if (transferItem.stock_id && Number(transferItem.stock_id || 0) !== Number(stockItem.id || 0)) {
      return failWithReceiveLog(409, "Transfer item does not match the stock barcode record", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "STOCK_MISMATCH"
      });
    }

    if (["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED"].includes(stockStatus) ||
      ["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED"].includes(effectiveStockState)) {
      return failWithReceiveLog(400, "Sold, damaged, or deleted barcode cannot be received", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "INVALID_STOCK_STATUS"
      });
    }

    if (effectiveStockState !== "IN_TRANSIT") {
      return failWithReceiveLog(400, "Barcode is not currently in transit", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "NOT_IN_TRANSIT"
      });
    }

    if (Number(stockItem.current_branch_id || 0) !== Number(transfer.from_branch_id || 0)) {
      return failWithReceiveLog(400, "Barcode is no longer at the transfer source branch", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "SOURCE_BRANCH_MISMATCH"
      });
    }

    const [stockUpdateResult] = await connection.query(
      `
      UPDATE stock
      SET current_branch_id = ?,
          stock_state = 'IN_STOCK',
          updated_at = NOW()
      WHERE id = ?
        AND company_id = ?
        AND current_branch_id = ?
        AND UPPER(COALESCE(NULLIF(TRIM(stock_state), ''), status, 'IN_STOCK')) = 'IN_TRANSIT'
      `,
      [transfer.to_branch_id, stockItem.id, access.companyScope, transfer.from_branch_id]
    );

    if (Number(stockUpdateResult?.affectedRows || 0) !== 1) {
      return failWithReceiveLog(409, "Barcode could not be moved into destination branch stock", {
        transfer,
        item: transferItem,
        stock: stockItem,
        scanStatus: "STOCK_MOVE_FAILED"
      });
    }

    await connection.query(
      `
      UPDATE branch_transfer_items
      SET item_status = 'RECEIVED',
          received_by = ?,
          received_at = NOW(),
          stock_id = ?,
          updated_at = NOW()
      WHERE id = ?
        AND transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(item_status, '')) = 'IN_TRANSIT'
      `,
      [access.actingUserId ?? null, stockItem.id, transferItem.id, transferId, access.companyScope]
    );

    await writeBranchReceiveLogSafe(connection, access, {
      transferId,
      barcode: stockItem.barcode || barcode,
      stockId: stockItem.id,
      branchId: transfer.to_branch_id,
      scanStatus: "RECEIVED",
      reason: "Barcode received successfully",
      deviceInfo
    });

    const [countRows] = await connection.query(
      `
      SELECT
        SUM(CASE WHEN UPPER(COALESCE(item_status, '')) <> 'CANCELLED' THEN 1 ELSE 0 END) AS active_items,
        SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS pending_items,
        SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'RECEIVED' THEN 1 ELSE 0 END) AS received_items,
        SUM(CASE WHEN UPPER(COALESCE(item_status, '')) = 'SHORTAGE' THEN 1 ELSE 0 END) AS shortage_items
      FROM branch_transfer_items
      WHERE transfer_id = ?
        AND company_id = ?
      `,
      [transferId, access.companyScope]
    );
    const counts = countRows[0] || {};
    const pendingItems = Number(counts.pending_items || 0);
    const shortageItems = Number(counts.shortage_items || 0);
    const nextStatus = pendingItems === 0 && shortageItems === 0 ? "RECEIVED" : "PARTIALLY_RECEIVED";

    await connection.query(
      `
      UPDATE branch_transfers
      SET status = ?,
          received_by = CASE WHEN ? = 'RECEIVED' THEN ? ELSE received_by END,
          received_at = CASE WHEN ? = 'RECEIVED' THEN NOW() ELSE received_at END,
          updated_at = NOW()
      WHERE id = ?
        AND company_id = ?
      `,
      [
        nextStatus,
        nextStatus,
        access.actingUserId ?? null,
        nextStatus,
        transferId,
        access.companyScope
      ]
    );

    const updatedTransfer = await getTransferForAccess(connection, access, transferId);
    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "RECEIVE_SCAN",
      beforeData: {
        transfer,
        item: transferItem,
        stock: stockItem
      },
      afterData: {
        transfer: updatedTransfer,
        barcode: stockItem.barcode || barcode,
        counts
      },
      reason: "Transfer barcode received"
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Barcode received successfully",
      transfer: updatedTransfer,
      barcode: stockItem.barcode || barcode,
      stock_id: stockItem.id,
      counts: {
        active_items: Number(counts.active_items || 0),
        received_items: Number(counts.received_items || 0),
        pending_items: pendingItems,
        shortage_items: shortageItems
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer receive scan error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer receive scan failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branch-transfers/:id/confirm-shortage", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    const notes = String(req.body?.notes || "").trim();

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    const transferStatus = String(transfer.status || "").trim().toUpperCase();
    if (!["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(transferStatus)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Shortage can be confirmed only for IN_TRANSIT or PARTIALLY_RECEIVED transfers"
      });
    }

    if (!canReceiveTransferToBranch(access, transfer.to_branch_id)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can confirm shortage only for your assigned destination branch"
      });
    }

    const [shortageItems] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(item_status, '')) = 'IN_TRANSIT'
      ORDER BY id ASC
      FOR UPDATE
      `,
      [transferId, access.companyScope]
    );

    if (!shortageItems.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "There are no pending in-transit items to mark as shortage"
      });
    }

    await connection.query(
      `
      UPDATE stock s
      INNER JOIN branch_transfer_items bti
        ON bti.stock_id = s.id
       AND bti.company_id = s.company_id
      SET s.stock_state = 'TRANSFER_SHORTAGE',
          s.updated_at = NOW()
      WHERE bti.transfer_id = ?
        AND bti.company_id = ?
        AND UPPER(COALESCE(bti.item_status, '')) = 'IN_TRANSIT'
        AND s.current_branch_id = ?
        AND UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_TRANSIT'
      `,
      [transferId, access.companyScope, transfer.from_branch_id]
    );

    await connection.query(
      `
      UPDATE branch_transfer_items
      SET item_status = 'SHORTAGE',
          mismatch_reason = ?,
          updated_at = NOW()
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(item_status, '')) = 'IN_TRANSIT'
      `,
      [notes || "Shortage confirmed at destination branch", transferId, access.companyScope]
    );

    await connection.query(
      `
      UPDATE branch_transfers
      SET status = 'SHORTAGE',
          updated_at = NOW()
      WHERE id = ?
        AND company_id = ?
      `,
      [transferId, access.companyScope]
    );

    const shortageTransfer = await getTransferForAccess(connection, access, transferId);
    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "CONFIRM_SHORTAGE",
      beforeData: {
        transfer,
        shortageItems
      },
      afterData: shortageTransfer,
      reason: notes || "Transfer shortage confirmed"
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Transfer shortage confirmed",
      transfer: shortageTransfer,
      shortage_items: shortageItems.length,
      stock_state: "TRANSFER_SHORTAGE"
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer shortage confirm error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer shortage confirmation failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/branch-transfers/:id/receive-summary", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const transferId = parsePositiveInteger(req.params.id);
    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    connection = await pool.getConnection();
    const transfer = await getTransferForAccess(connection, access, transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    if (access.isBranchLocked && Number(transfer.to_branch_id || 0) !== Number(access.userBranchId || 0)) {
      return res.status(403).json({
        success: false,
        message: "You cannot access another branch receive summary"
      });
    }

    const [items] = await connection.query(
      `
      SELECT
        bti.*,
        s.product_name,
        s.sku,
        s.lot_number,
        s.weight,
        s.status AS stock_status,
        COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK') AS effective_stock_state
      FROM branch_transfer_items bti
      LEFT JOIN stock s
        ON s.id = bti.stock_id
       AND s.company_id = bti.company_id
      WHERE bti.transfer_id = ?
        AND bti.company_id = ?
        AND UPPER(COALESCE(bti.item_status, '')) <> 'CANCELLED'
      ORDER BY bti.id ASC
      `,
      [transferId, transfer.company_id]
    );

    const [wrongScanRows] = await connection.query(
      `
      SELECT COUNT(*) AS wrong_scan_count
      FROM branch_receive_logs
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(scan_status, '')) NOT IN ('RECEIVED', 'SUCCESS')
      `,
      [transferId, transfer.company_id]
    );

    const receivedItems = [];
    const pendingItems = [];
    let shortageCount = 0;

    for (const item of items) {
      const status = String(item.item_status || "").trim().toUpperCase();
      if (status === "RECEIVED") receivedItems.push(item);
      if (status === "IN_TRANSIT") pendingItems.push(item);
      if (status === "SHORTAGE") shortageCount += 1;
    }

    return res.json({
      success: true,
      transfer,
      total_items: items.length,
      received_count: receivedItems.length,
      pending_count: pendingItems.length,
      shortage_count: shortageCount,
      wrong_scan_count: Number(wrongScanRows[0]?.wrong_scan_count || 0),
      received_items: receivedItems,
      pending_items: pendingItems
    });
  } catch (error) {
    console.error("Branch transfer receive summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer receive summary failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branch-transfers/:id/items/scan", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    const barcode = String(req.body?.barcode || "").trim();

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    if (String(transfer.status || "").trim().toUpperCase() !== "CREATED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Items can be added only to CREATED transfers"
      });
    }

    if (!canCreateTransferFromBranch(access, transfer.from_branch_id)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can add items only from your assigned branch"
      });
    }

    const normalizedBarcode = normalizeBarcodeForComparison(barcode);
    const [stockRows] = await connection.query(
      `
      SELECT
        id,
        company_id,
        barcode,
        product_name,
        sku,
        lot_number,
        weight,
        status,
        stock_state,
        current_branch_id
      FROM stock
      WHERE company_id = ?
        AND UPPER(TRIM(barcode)) = ?
      ORDER BY id DESC
      LIMIT 2
      FOR UPDATE
      `,
      [access.companyScope, normalizedBarcode]
    );

    if (!stockRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Barcode was not found in this company stock"
      });
    }

    if (stockRows.length > 1) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: DUPLICATE_BARCODE_MESSAGE
      });
    }

    const stockItem = stockRows[0];
    const stockStatus = String(stockItem.status || "IN_STOCK").trim().toUpperCase();
    const effectiveStockState = String(stockItem.stock_state || stockItem.status || "IN_STOCK").trim().toUpperCase();

    if (Number(stockItem.current_branch_id || 0) !== Number(transfer.from_branch_id || 0)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Barcode does not belong to the transfer source branch"
      });
    }

    if (stockStatus !== "IN_STOCK" || effectiveStockState !== "IN_STOCK") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Barcode is not available in stock for transfer"
      });
    }

    if (["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED"].includes(stockStatus) ||
      ["SOLD", "DAMAGED_RETURN", "DAMAGED", "DELETED"].includes(effectiveStockState)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Sold, damaged, or deleted barcode cannot be transferred"
      });
    }

    const [duplicateItemRows] = await connection.query(
      `
      SELECT id
      FROM branch_transfer_items
      WHERE company_id = ?
        AND transfer_id = ?
        AND UPPER(TRIM(barcode)) = ?
        AND UPPER(COALESCE(item_status, 'PENDING_DISPATCH')) <> 'CANCELLED'
      LIMIT 1
      `,
      [access.companyScope, transferId, normalizedBarcode]
    );

    if (duplicateItemRows.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Barcode is already added to this transfer"
      });
    }

    const [openTransferRows] = await connection.query(
      `
      SELECT bti.id, bti.transfer_id
      FROM branch_transfer_items bti
      INNER JOIN branch_transfers bt
        ON bt.id = bti.transfer_id
       AND bt.company_id = bti.company_id
      WHERE bti.company_id = ?
        AND UPPER(TRIM(bti.barcode)) = ?
        AND UPPER(COALESCE(bti.item_status, 'PENDING_DISPATCH')) IN ('PENDING_DISPATCH', 'IN_TRANSIT')
        AND UPPER(COALESCE(bt.status, 'CREATED')) NOT IN ('CANCELLED', 'RECEIVED', 'SHORTAGE')
      LIMIT 1
      `,
      [access.companyScope, normalizedBarcode]
    );

    if (openTransferRows.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Barcode is already in another open transfer"
      });
    }

    const [insertResult] = await connection.query(
      `
      INSERT INTO branch_transfer_items
      (
        company_id,
        transfer_id,
        stock_id,
        barcode,
        from_branch_id,
        to_branch_id,
        item_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_DISPATCH', NOW(), NOW())
      `,
      [
        access.companyScope,
        transferId,
        stockItem.id,
        String(stockItem.barcode || barcode).trim(),
        transfer.from_branch_id,
        transfer.to_branch_id
      ]
    );

    const [itemRows] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [insertResult.insertId, access.companyScope]
    );
    const transferItem = itemRows[0] || null;

    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "ADD_ITEM",
      afterData: {
        item: transferItem,
        stock: stockItem
      },
      reason: "Transfer item added"
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Barcode added to transfer",
      item: transferItem
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer item scan error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer item add failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/branch-transfers/:id/items/:itemId", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    const itemId = parsePositiveInteger(req.params.itemId);
    if (!transferId || !itemId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id and item id are required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    if (String(transfer.status || "").trim().toUpperCase() !== "CREATED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Items can be removed only from CREATED transfers"
      });
    }

    if (!canCreateTransferFromBranch(access, transfer.from_branch_id)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can remove items only from your assigned branch"
      });
    }

    const [itemRows] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE id = ?
        AND transfer_id = ?
        AND company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [itemId, transferId, access.companyScope]
    );

    if (!itemRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer item not found"
      });
    }

    const beforeItem = itemRows[0];
    await connection.query(
      `
      UPDATE branch_transfer_items
      SET item_status = 'CANCELLED',
          updated_at = NOW()
      WHERE id = ?
        AND transfer_id = ?
        AND company_id = ?
      `,
      [itemId, transferId, access.companyScope]
    );

    const [updatedRows] = await connection.query(
      `
      SELECT *
      FROM branch_transfer_items
      WHERE id = ?
      LIMIT 1
      `,
      [itemId]
    );

    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "REMOVE_ITEM",
      beforeData: beforeItem,
      afterData: updatedRows[0] || null,
      reason: "Transfer item cancelled"
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Transfer item removed",
      item: updatedRows[0] || null
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer item remove error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer item remove failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/branch-transfers/:id", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    const transferId = parsePositiveInteger(req.params.id);
    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: "Transfer id is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const transfer = await getTransferForAccess(connection, access, transferId, { forUpdate: true });
    if (!transfer) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    if (String(transfer.status || "").trim().toUpperCase() !== "CREATED") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only CREATED transfers can be cancelled"
      });
    }

    if (!canCreateTransferFromBranch(access, transfer.from_branch_id)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can cancel transfers only from your assigned branch"
      });
    }

    await connection.query(
      `
      UPDATE branch_transfer_items
      SET item_status = 'CANCELLED',
          updated_at = NOW()
      WHERE transfer_id = ?
        AND company_id = ?
        AND UPPER(COALESCE(item_status, 'PENDING_DISPATCH')) IN ('PENDING_DISPATCH', 'IN_TRANSIT')
      `,
      [transferId, access.companyScope]
    );

    await connection.query(
      `
      UPDATE branch_transfers
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [transferId, access.companyScope]
    );

    const cancelledTransfer = await getTransferForAccess(connection, access, transferId);
    await writeBranchTransferAuditSafe(connection, req, access, {
      transferId,
      actionType: "CANCEL",
      beforeData: transfer,
      afterData: cancelledTransfer,
      reason: "Transfer draft cancelled"
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Transfer cancelled successfully",
      transfer: cancelledTransfer
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch transfer cancel error:", error);
    return res.status(500).json({
      success: false,
      message: "Transfer cancel failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/branches", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const whereParts = [];
    const params = [];

    if (access.companyScope !== null) {
      whereParts.push("b.company_id = ?");
      params.push(access.companyScope);
    }

    if (access.isBranchLocked) {
      whereParts.push("b.id = ?");
      params.push(access.userBranchId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        b.*,
        c.company_name
      FROM branches b
      LEFT JOIN companies c ON c.id = b.company_id
      ${whereSql}
      ORDER BY b.company_id ASC, b.branch_type ASC, b.branch_name ASC, b.id ASC
      `,
      params
    );

    return res.json({
      success: true,
      branches: rows
    });
  } catch (error) {
    console.error("Branches fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branches fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/branches/:id", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const branchId = Number(req.params.id || 0);
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch id is required"
      });
    }

    const whereParts = ["b.id = ?"];
    const params = [branchId];

    if (access.companyScope !== null) {
      whereParts.push("b.company_id = ?");
      params.push(access.companyScope);
    }

    if (access.isBranchLocked) {
      whereParts.push("b.id = ?");
      params.push(access.userBranchId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        b.*,
        c.company_name
      FROM branches b
      LEFT JOIN companies c ON c.id = b.company_id
      WHERE ${whereParts.join(" AND ")}
      LIMIT 1
      `,
      params
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    return res.json({
      success: true,
      branch: rows[0]
    });
  } catch (error) {
    console.error("Branch fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/branches", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    if (!access.canManageBranches) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to manage branches"
      });
    }

    const validation = validateBranchPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const branch = validation.branch;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM branches
      WHERE company_id = ?
        AND UPPER(TRIM(branch_code)) = ?
      LIMIT 1
      `,
      [access.companyScope, branch.branchCode]
    );

    if (duplicateRows.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "branch_code already exists in this company"
      });
    }

    const [insertResult] = await connection.query(
      `
      INSERT INTO branches
      (
        company_id,
        branch_code,
        branch_name,
        branch_type,
        address,
        contact_name,
        contact_phone,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        access.companyScope,
        branch.branchCode,
        branch.branchName,
        branch.branchType,
        branch.address || null,
        branch.contactName || null,
        branch.contactPhone || null,
        branch.status,
        access.actingUserId ?? null
      ]
    );

    const [createdRows] = await connection.query(
      `
      SELECT *
      FROM branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [insertResult.insertId, access.companyScope]
    );
    const createdBranch = createdRows[0] || null;

    await logActivitySafe(connection, req, access, {
      actionType: "CREATE",
      entityType: "BRANCH",
      entityId: String(insertResult.insertId),
      moduleName: "branch-management",
      status: "success",
      message: "Branch created",
      afterData: createdBranch
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch: createdBranch
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch create error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch create failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branches/create-with-login", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    if (!access.canManageBranches) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to manage branches"
      });
    }

    const validation = validateBranchPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const loginInput = req.body?.login && typeof req.body.login === "object" ? req.body.login : req.body;
    const cleanName = String(loginInput.staff_name ?? loginInput.staffName ?? loginInput.name ?? "").trim();
    const cleanEmail = normalizeEmail(loginInput.email);
    const cleanPassword = String(loginInput.password || "").trim();
    const cleanRole = normalizeQuickBranchLoginRole(loginInput.role);

    if (!cleanName || !cleanEmail || !cleanPassword || !cleanRole) {
      return res.status(400).json({
        success: false,
        message: "Staff name, email, password, and a valid role are required"
      });
    }

    const branch = validation.branch;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [duplicateBranchRows] = await connection.query(
      `
      SELECT id
      FROM branches
      WHERE company_id = ?
        AND UPPER(TRIM(branch_code)) = ?
      LIMIT 1
      `,
      [access.companyScope, branch.branchCode]
    );

    if (duplicateBranchRows.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "branch_code already exists in this company"
      });
    }

    const [duplicateUserRows] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (duplicateUserRows.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "This email is already registered"
      });
    }

    const [branchInsert] = await connection.query(
      `
      INSERT INTO branches
      (
        company_id,
        branch_code,
        branch_name,
        branch_type,
        address,
        contact_name,
        contact_phone,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        access.companyScope,
        branch.branchCode,
        branch.branchName,
        branch.branchType,
        branch.address || null,
        branch.contactName || null,
        branch.contactPhone || null,
        branch.status,
        access.actingUserId ?? null
      ]
    );

    const branchId = branchInsert.insertId;
    const passwordHash = await hashPassword(cleanPassword);

    const [userInsert] = await connection.query(
      `
      INSERT INTO users
      (
        name,
        mobile,
        email,
        password,
        role,
        status,
        company_id,
        branch_id,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, NOW(), NOW())
      `,
      [
        cleanName,
        "",
        cleanEmail,
        passwordHash,
        cleanRole,
        access.companyScope,
        branchId,
        access.actingUserId ?? null
      ]
    );

    const [createdBranchRows] = await connection.query(
      `
      SELECT *
      FROM branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [branchId, access.companyScope]
    );
    const createdBranch = createdBranchRows[0] || null;

    const [createdUserRows] = await connection.query(
      `
      SELECT id, name, mobile, email, role, status, company_id, branch_id, created_at
      FROM users
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [userInsert.insertId, access.companyScope]
    );
    const createdUser = createdUserRows[0] || null;

    await logActivitySafe(connection, req, access, {
      actionType: "CREATE_WITH_LOGIN",
      entityType: "BRANCH",
      entityId: String(branchId),
      moduleName: "branch-management",
      status: "success",
      message: "Branch and login created",
      afterData: {
        branch: createdBranch,
        user: createdUser
      }
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Branch and login created successfully",
      branch: createdBranch,
      user: createdUser
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch create with login error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch create with login failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/branches/:id", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    if (!access.canManageBranches) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to manage branches"
      });
    }

    const branchId = Number(req.params.id || 0);
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch id is required"
      });
    }

    const validation = validateBranchPayload(req.body, { partial: true });
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentRows] = await connection.query(
      `
      SELECT *
      FROM branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [branchId, access.companyScope]
    );

    if (!currentRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    const beforeBranch = currentRows[0];
    const branch = validation.branch;
    const nextBranchCode = branch.hasBranchCode ? branch.branchCode : String(beforeBranch.branch_code || "").trim();
    const nextBranchName = branch.hasBranchName ? branch.branchName : String(beforeBranch.branch_name || "").trim();
    const nextBranchType = branch.hasBranchType ? branch.branchType : String(beforeBranch.branch_type || "STORE").trim().toUpperCase();
    const nextStatus = branch.hasStatus ? branch.status : String(beforeBranch.status || "ACTIVE").trim().toUpperCase();
    const nextAddress = branch.hasAddress ? branch.address || null : beforeBranch.address;
    const nextContactName = branch.hasContactName ? branch.contactName || null : beforeBranch.contact_name;
    const nextContactPhone = branch.hasContactPhone ? branch.contactPhone || null : beforeBranch.contact_phone;

    if (!normalizeBranchCode(nextBranchCode)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "branch_code cannot be empty"
      });
    }

    if (!nextBranchName) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "branch_name cannot be empty"
      });
    }

    if (!normalizeBranchType(nextBranchType)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "branch_type must be MAIN, STORE, WAREHOUSE, or OFFICE"
      });
    }

    if (!normalizeBranchStatus(nextStatus)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "status must be ACTIVE or INACTIVE"
      });
    }

    if (normalizeBranchCode(nextBranchCode) !== normalizeBranchCode(beforeBranch.branch_code)) {
      const [duplicateRows] = await connection.query(
        `
        SELECT id
        FROM branches
        WHERE company_id = ?
          AND UPPER(TRIM(branch_code)) = ?
          AND id <> ?
        LIMIT 1
        `,
        [access.companyScope, normalizeBranchCode(nextBranchCode), branchId]
      );

      if (duplicateRows.length) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "branch_code already exists in this company"
        });
      }
    }

    await connection.query(
      `
      UPDATE branches
      SET branch_code = ?,
          branch_name = ?,
          branch_type = ?,
          address = ?,
          contact_name = ?,
          contact_phone = ?,
          status = ?,
          updated_at = NOW()
      WHERE id = ? AND company_id = ?
      `,
      [
        normalizeBranchCode(nextBranchCode),
        nextBranchName,
        normalizeBranchType(nextBranchType),
        nextAddress,
        nextContactName,
        nextContactPhone,
        normalizeBranchStatus(nextStatus),
        branchId,
        access.companyScope
      ]
    );

    const [updatedRows] = await connection.query(
      `
      SELECT *
      FROM branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [branchId, access.companyScope]
    );
    const updatedBranch = updatedRows[0] || null;

    await logActivitySafe(connection, req, access, {
      actionType: "UPDATE",
      entityType: "BRANCH",
      entityId: String(branchId),
      moduleName: "branch-management",
      status: "success",
      message: "Branch updated",
      beforeData: beforeBranch,
      afterData: updatedBranch
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Branch updated successfully",
      branch: updatedBranch
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch update error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch update failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/branches/:id/users", authMiddleware, async (req, res) => {
  let connection;

  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (access.isSuperAdmin) {
      return sendSuperAdminReadOnlyError(res);
    }

    if (!access.canManageBranches) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to assign branch users"
      });
    }

    const branchId = Number(req.params.id || 0);
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch id is required"
      });
    }

    const rawUserIds = Array.isArray(req.body?.userIds)
      ? req.body.userIds
      : Array.isArray(req.body?.users)
        ? req.body.users
        : [req.body?.userId ?? req.body?.user_id];
    const userIds = [...new Set(rawUserIds.map((value) => Number(value || 0)).filter(Boolean))];

    if (!userIds.length) {
      return res.status(400).json({
        success: false,
        message: "At least one user id is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [branchRows] = await connection.query(
      `
      SELECT *
      FROM branches
      WHERE id = ? AND company_id = ?
      LIMIT 1
      `,
      [branchId, access.companyScope]
    );

    if (!branchRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    const assignedUsers = [];
    const skippedUsers = [];

    for (const userId of userIds) {
      const [userRows] = await connection.query(
        `
        SELECT id, name, email, role, company_id, branch_id
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
      );

      const userRow = userRows[0] || null;
      if (!userRow || Number(userRow.company_id || 0) !== Number(access.companyScope)) {
        skippedUsers.push({
          user_id: userId,
          reason: "User not found in this company"
        });
        continue;
      }

      await connection.query(
        `
        UPDATE users
        SET branch_id = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ? AND company_id = ?
        `,
        [branchId, access.actingUserId ?? null, userId, access.companyScope]
      );

      assignedUsers.push({
        user_id: userRow.id,
        name: userRow.name || "",
        email: userRow.email || "",
        role: userRow.role || "",
        previous_branch_id: userRow.branch_id ?? null,
        branch_id: branchId
      });
    }

    await logActivitySafe(connection, req, access, {
      actionType: "ASSIGN_USERS",
      entityType: "BRANCH",
      entityId: String(branchId),
      moduleName: "branch-management",
      status: "success",
      message: "Branch users assigned",
      afterData: {
        branch_id: branchId,
        assignedUsers,
        skippedUsers
      }
    });

    await connection.commit();

    return res.json({
      success: true,
      message: "Branch user assignment completed",
      branch_id: branchId,
      assignedUsers,
      skippedUsers
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error("Branch user assignment error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch user assignment failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

/* =========================
   USERS / STAFF
========================= */
app.get("/branch-users", authMiddleware, async (req, res) => {
  try {
    const access = await resolveBranchAccessContext(req, {
      requireCompanyScope: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    if (!access.isSuperAdmin && !isBranchManagerRole(access.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to view branch users"
      });
    }

    if (access.companyScope === null) {
      return res.status(400).json({
        success: false,
        message: "Please select a company to view branch users"
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.branch_id,
        b.branch_name,
        b.branch_code
      FROM users u
      LEFT JOIN branches b
        ON b.id = u.branch_id
       AND b.company_id = u.company_id
      WHERE u.company_id = ?
        AND UPPER(COALESCE(u.role, '')) <> 'SUPERADMIN'
        AND u.deleted_at IS NULL
      ORDER BY
        FIELD(UPPER(COALESCE(u.role, '')), 'OWNER', 'ADMIN', 'ACCOUNTS', 'STAFF'),
        u.name ASC,
        u.email ASC,
        u.id ASC
      `,
      [access.companyScope]
    );

    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Branch users fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Branch users fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/companyUsers", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const whereClause = companyId !== null ? "WHERE company_id = ?" : "";
    const params = companyId !== null ? [companyId] : [];

    const [rows] = await pool.query(
      `
      SELECT 
        id,
        name,
        mobile,
        email,
        role,
        status,
        company_id,
        created_at
      FROM users
      ${whereClause}
      ORDER BY id DESC
      `,
      params
    );

    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Company users error:", error);
    return res.status(500).json({
      success: false,
      message: "Company users fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/registerUser", async (req, res) => {
  try {
    const {
      name = "",
      mobile = "",
      email = "",
      password = "",
      companyId = null
    } = req.body;

    const cleanName = String(name).trim();
    const cleanMobile = String(mobile).trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password).trim();

    const finalCompanyId =
      companyId === null || companyId === undefined || companyId === ""
        ? null
        : Number(companyId);

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return res.json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    if (finalCompanyId === null || Number.isNaN(finalCompanyId)) {
      return res.json({
        success: false,
        message: "companyId is required"
      });
    }

    const [existingUsers] = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.json({
        success: false,
        message: "This email is already registered"
      });
    }

    const passwordHash = await hashPassword(cleanPassword);

    await pool.query(
      `
      INSERT INTO users (name, mobile, email, password, role, status, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [cleanName, cleanMobile, cleanEmail, passwordHash, "", "pending", finalCompanyId]
    );

    return res.json({
      success: true,
      message: "The request has been submitted for admin approval"
    });
  } catch (error) {
    console.error("Register user error:", error);
    return res.status(500).json({
      success: false,
      message: "Register failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/requestStaffJoin", async (req, res) => {
  try {
    const {
      companyName = "",
      adminEmail = "",
      requestedRole = "",
      name = "",
      mobile = "",
      email = "",
      password = ""
    } = req.body;

    const cleanCompanyName = String(companyName).trim();
    const cleanAdminEmail = normalizeEmail(adminEmail);
    const cleanRequestedRole = String(requestedRole).trim();
    const cleanName = String(name).trim();
    const cleanMobile = String(mobile).trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password).trim();

    if (
      !cleanCompanyName ||
      !cleanAdminEmail ||
      !cleanRequestedRole ||
      !cleanName ||
      !cleanEmail ||
      !cleanPassword
    ) {
      return res.json({
        success: false,
        message: "Please fill in all required fields"
      });
    }

    const [companyRows] = await pool.query(
      `
      SELECT c.id, c.company_name
      FROM companies c
      WHERE LOWER(c.company_name) = LOWER(?)
        AND LOWER(c.owner_email) = LOWER(?)
        AND LOWER(COALESCE(c.status,'')) = 'active'
      LIMIT 1
      `,
      [cleanCompanyName, cleanAdminEmail]
    );

    if (!companyRows.length) {
      return res.json({
        success: false,
        message: "The company or admin email did not match"
      });
    }

    const companyId = Number(companyRows[0].id);

    const [existingUsers] = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.json({
        success: false,
        message: "This email is already registered"
      });
    }

    const passwordHash = await hashPassword(cleanPassword);

    await pool.query(
      `
      INSERT INTO users (name, mobile, email, password, role, status, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [cleanName, cleanMobile, cleanEmail, passwordHash, cleanRequestedRole, "pending", companyId]
    );

    return res.json({
      success: true,
      message: "The staff request has been submitted for admin approval"
    });
  } catch (error) {
    console.error("Request staff join error:", error);
    return res.status(500).json({
      success: false,
      message: "Staff request failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/pendingUsers", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;

    const [rows] = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.role,
        u.status,
        u.created_at,
        u.company_id,
        c.company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE LOWER(COALESCE(u.status, '')) = 'pending'
      ${companyId !== null ? "AND u.company_id = ?" : ""}
      ORDER BY u.id DESC
      `,
      companyId !== null ? [companyId] : []
    );

    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Pending users error:", error);
    return res.status(500).json({
      success: false,
      message: "Pending users fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/pendingStaffRequests", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;

    const [rows] = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.role,
        u.status,
        u.created_at,
        u.company_id,
        c.company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE LOWER(COALESCE(u.status, '')) = 'pending'
      ${companyId !== null ? "AND u.company_id = ?" : ""}
      ORDER BY u.id DESC
      `,
      companyId !== null ? [companyId] : []
    );

    return res.json({
      success: true,
      requests: rows
    });
  } catch (error) {
    console.error("Pending staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Pending staff fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/approvedUsers", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;

    const [rows] = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.role,
        u.status,
        u.login_status,
        u.blocked_until,
        u.deleted_at,
        u.deactivated_at,
        u.force_logout_after,
        u.access_reason,
        u.created_at,
        u.company_id,
        c.company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE LOWER(COALESCE(u.status, '')) = 'approved'
      AND u.deleted_at IS NULL
      AND UPPER(COALESCE(u.role, '')) <> 'SUPERADMIN'
      ${companyId !== null ? "AND u.company_id = ?" : ""}
      ORDER BY u.id DESC
      `,
      companyId !== null ? [companyId] : []
    );

    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Approved users error:", error);
    return res.status(500).json({
      success: false,
      message: "Approved users fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/deleted-users", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const [rows] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.role,
        u.status,
        u.login_status,
        u.blocked_until,
        u.deleted_at,
        u.deactivated_at,
        u.force_logout_after,
        u.access_reason,
        u.created_at,
        u.company_id,
        c.company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE u.deleted_at IS NOT NULL
        AND UPPER(COALESCE(u.role, '')) <> 'SUPERADMIN'
      ORDER BY u.deleted_at DESC, u.id DESC
    `);

    return res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Deleted users error:", error);
    return res.status(500).json({
      success: false,
      message: "Deleted users fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/approveUser/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    return await handleUserApprovalAction(req, res, {
      action: "approve",
      label: "User"
    });
  } catch (error) {
    console.error("Approve user error:", error);
    return res.status(500).json({
      success: false,
      message: "Approve failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/approveStaffRequest/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    return await handleUserApprovalAction(req, res, {
      action: "approve",
      label: "Staff"
    });
  } catch (error) {
    console.error("Approve staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Approve failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/rejectUser/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    return await handleUserApprovalAction(req, res, {
      action: "reject",
      label: "User"
    });
  } catch (error) {
    console.error("Reject user error:", error);
    return res.status(500).json({
      success: false,
      message: "Reject failed",
      error: getErrorDetail(error)
    });
  }
});

app.put("/rejectStaffRequest/:id", authMiddleware, checkRole(["SUPERADMIN", "OWNER"]), async (req, res) => {
  try {
    return await handleUserApprovalAction(req, res, {
      action: "reject",
      label: "Staff"
    });
  } catch (error) {
    console.error("Reject staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Reject failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   SUPERADMIN ACCESS CONTROL
========================= */
app.put("/superadmin/companies/:id/suspend", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "COMPANY",
    entityLabel: "Company",
    actionType: "COMPANY_SUSPEND",
    successMessage: "Company access has been suspended",
    selectSnapshot: getCompanyAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      const dateResult = getRequiredFutureDate(req, "suspendedUntil");
      if (!dateResult.ok) return dateResult;

      await connection.query(
        `
        UPDATE companies
        SET access_status = 'SUSPENDED',
            suspended_until = ?,
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [dateResult.value, reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/companies/:id/disable-login", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "COMPANY",
    entityLabel: "Company",
    actionType: "COMPANY_DISABLE_LOGIN",
    successMessage: "Company login has been disabled",
    selectSnapshot: getCompanyAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE companies
        SET login_status = 'DISABLED',
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/companies/:id/deactivate", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "COMPANY",
    entityLabel: "Company",
    actionType: "COMPANY_DEACTIVATE",
    successMessage: "Company access has been deactivated",
    selectSnapshot: getCompanyAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE companies
        SET access_status = 'DEACTIVATED',
            deactivated_at = NOW(),
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/companies/:id/restore", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "COMPANY",
    entityLabel: "Company",
    actionType: "COMPANY_RESTORE",
    successMessage: "Company access has been restored",
    selectSnapshot: getCompanyAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE companies
        SET access_status = 'ACTIVE',
            login_status = 'ENABLED',
            suspended_until = NULL,
            deactivated_at = NULL,
            deleted_at = NULL,
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.delete("/superadmin/companies/:id/soft-delete", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "COMPANY",
    entityLabel: "Company",
    actionType: "COMPANY_SOFT_DELETE",
    successMessage: "Company has been soft deleted",
    selectSnapshot: getCompanyAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE companies
        SET deleted_at = NOW(),
            access_status = 'SOFT_DELETED',
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/users/:id/block-login", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_BLOCK_LOGIN",
    successMessage: "User login has been blocked temporarily",
    selectSnapshot: getUserAccessSnapshot,
    preventSelfTarget: true,
    mutate: async (connection, { targetId, reason, access }) => {
      const dateResult = getRequiredFutureDate(req, "blockedUntil");
      if (!dateResult.ok) return dateResult;

      await connection.query(
        `
        UPDATE users
        SET login_status = 'BLOCKED',
            blocked_until = ?,
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [dateResult.value, reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/users/:id/disable-login", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_DISABLE_LOGIN",
    successMessage: "User login has been disabled",
    selectSnapshot: getUserAccessSnapshot,
    preventSelfTarget: true,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE users
        SET login_status = 'DISABLED',
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/users/:id/deactivate", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_DEACTIVATE",
    successMessage: "User access has been deactivated",
    selectSnapshot: getUserAccessSnapshot,
    preventSelfTarget: true,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE users
        SET deactivated_at = NOW(),
            login_status = 'DISABLED',
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.put("/superadmin/users/:id/restore", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_RESTORE",
    successMessage: "User access has been restored",
    selectSnapshot: getUserAccessSnapshot,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE users
        SET login_status = 'ENABLED',
            blocked_until = NULL,
            deactivated_at = NULL,
            deleted_at = NULL,
            force_logout_after = NULL,
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.post("/superadmin/users/:id/force-logout", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_FORCE_LOGOUT",
    successMessage: "User sessions have been forced to logout",
    selectSnapshot: getUserAccessSnapshot,
    preventSelfTarget: true,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE users
        SET force_logout_after = NOW(),
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.delete("/superadmin/users/:id/soft-delete", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  return runSuperAdminAccessMutation(req, res, {
    entityType: "USER",
    entityLabel: "User",
    actionType: "USER_SOFT_DELETE",
    successMessage: "User has been soft deleted",
    selectSnapshot: getUserAccessSnapshot,
    preventSelfTarget: true,
    mutate: async (connection, { targetId, reason, access }) => {
      await connection.query(
        `
        UPDATE users
        SET deleted_at = NOW(),
            login_status = 'DISABLED',
            access_reason = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [reason, access.actingUserId, targetId]
      );
      return { ok: true };
    }
  });
});

app.get("/superadmin/barcode-duplicates", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const [rows] = await pool.query(
      `
      SELECT
        d.company_id,
        d.normalized_barcode,
        d.duplicate_count,
        s.id,
        s.barcode,
        s.status,
        s.source,
        s.category,
        s.product_name,
        s.lot_number,
        s.created_at,
        s.updated_at,
        s.invoice_number AS stock_invoice_number,
        s.sold_at,
        s.deleted_at,
        COALESCE(si.sales_item_count, 0) AS sales_item_count,
        si.invoice_numbers AS sales_invoice_numbers,
        si.sale_ids,
        si.latest_sale_item_at,
        COALESCE(rh.return_count, 0) AS return_count,
        rh.return_ids,
        rh.return_invoice_numbers,
        rh.return_types,
        rh.latest_return_at
      FROM (
        SELECT
          company_id,
          UPPER(TRIM(barcode)) AS normalized_barcode,
          COUNT(*) AS duplicate_count
        FROM stock
        WHERE company_id IS NOT NULL
          ${getSellableStockFilterSql()}
        GROUP BY company_id, UPPER(TRIM(barcode))
        HAVING COUNT(*) > 1
      ) d
      INNER JOIN stock s
        ON s.company_id = d.company_id
       AND UPPER(TRIM(s.barcode)) = d.normalized_barcode
       ${getSellableStockFilterSql("s")}
      LEFT JOIN (
        SELECT
          company_id,
          UPPER(TRIM(barcode)) AS normalized_barcode,
          COUNT(*) AS sales_item_count,
          GROUP_CONCAT(DISTINCT invoice_number ORDER BY invoice_number SEPARATOR ', ') AS invoice_numbers,
          GROUP_CONCAT(DISTINCT sale_id ORDER BY sale_id SEPARATOR ', ') AS sale_ids,
          MAX(created_at) AS latest_sale_item_at
        FROM sales_items
        WHERE barcode IS NOT NULL
          AND TRIM(COALESCE(barcode, '')) <> ''
        GROUP BY company_id, UPPER(TRIM(barcode))
      ) si
        ON si.company_id = s.company_id
       AND si.normalized_barcode = d.normalized_barcode
      LEFT JOIN (
        SELECT
          company_id,
          UPPER(TRIM(barcode)) AS normalized_barcode,
          COUNT(*) AS return_count,
          GROUP_CONCAT(DISTINCT id ORDER BY id SEPARATOR ', ') AS return_ids,
          GROUP_CONCAT(DISTINCT invoice_number ORDER BY invoice_number SEPARATOR ', ') AS return_invoice_numbers,
          GROUP_CONCAT(DISTINCT return_type ORDER BY return_type SEPARATOR ', ') AS return_types,
          MAX(COALESCE(return_date, created_at)) AS latest_return_at
        FROM return_history
        WHERE barcode IS NOT NULL
          AND TRIM(COALESCE(barcode, '')) <> ''
        GROUP BY company_id, UPPER(TRIM(barcode))
      ) rh
        ON rh.company_id = s.company_id
       AND rh.normalized_barcode = d.normalized_barcode
      ORDER BY d.duplicate_count DESC, d.company_id ASC, d.normalized_barcode ASC, s.id ASC
      LIMIT 2500
      `
    );

    const groupsByKey = new Map();
    for (const row of rows) {
      const key = `${row.company_id}:${row.normalized_barcode}`;
      if (!groupsByKey.has(key)) {
        groupsByKey.set(key, {
          company_id: row.company_id,
          normalized_barcode: row.normalized_barcode,
          duplicate_count: Number(row.duplicate_count || 0),
          affected_rows: []
        });
      }

      groupsByKey.get(key).affected_rows.push({
        id: row.id,
        barcode: row.barcode || "",
        status: row.status || "",
        source: row.source || "",
        category: row.category || "",
        product_name: row.product_name || "",
        lot_number: row.lot_number || "",
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        invoice_linkage: {
          stock_invoice_number: row.stock_invoice_number || "",
          sold_at: row.sold_at || null,
          sales_item_count: Number(row.sales_item_count || 0),
          invoice_numbers: row.sales_invoice_numbers || "",
          sale_ids: row.sale_ids || "",
          latest_sale_item_at: row.latest_sale_item_at || null
        },
        return_linkage: {
          return_count: Number(row.return_count || 0),
          return_ids: row.return_ids || "",
          invoice_numbers: row.return_invoice_numbers || "",
          return_types: row.return_types || "",
          latest_return_at: row.latest_return_at || null
        },
        deleted_at: row.deleted_at || null
      });
    }

    const classifyDuplicateGroup = (group) => {
      const rowStatuses = group.affected_rows.map((item) =>
        String(item.status || "").trim().toUpperCase()
      );
      const inStockCount = rowStatuses.filter((status) => status === "IN_STOCK").length;
      const soldCount = rowStatuses.filter((status) => status === "SOLD").length;
      const deletedCount = group.affected_rows.filter((item, index) =>
        rowStatuses[index] === "DELETED" || item.deleted_at
      ).length;
      const otherCount = group.affected_rows.length - inStockCount - soldCount - deletedCount;

      if (inStockCount > 1) {
        return {
          severity: "CRITICAL",
          recommendation: "manual review required",
          reason: "Multiple active IN_STOCK rows share the same sellable barcode."
        };
      }

      if (inStockCount > 0 && soldCount > 0) {
        return {
          severity: "HIGH",
          recommendation: "manual review required",
          reason: "An active row and sold history share the same sellable barcode."
        };
      }

      if (soldCount > 0 && deletedCount > 0 && otherCount === 0) {
        return {
          severity: "MEDIUM",
          recommendation: "historical duplicate",
          reason: "Only SOLD and DELETED rows share this barcode; verify invoice and return history before cleanup."
        };
      }

      if (deletedCount === group.affected_rows.length) {
        return {
          severity: "LOW",
          recommendation: "safe candidate for barcode regeneration",
          reason: "All duplicate rows are deleted historical rows."
        };
      }

      return {
        severity: "MEDIUM",
        recommendation: "manual review required",
        reason: "Duplicate rows are historical or mixed non-active states and need review before cleanup."
      };
    };

    const duplicates = Array.from(groupsByKey.values()).map((group) => ({
      ...group,
      ...classifyDuplicateGroup(group)
    }));

    const severityCounts = duplicates.reduce((summary, group) => {
      summary[group.severity.toLowerCase()] += 1;
      return summary;
    }, {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    });

    const affectedCompanies = new Set(duplicates.map((group) => group.company_id));
    const affectedStockRows = duplicates.reduce(
      (total, group) => total + group.affected_rows.length,
      0
    );

    return res.json({
      success: true,
      summary: {
        total_duplicate_groups: duplicates.length,
        critical_count: severityCounts.critical,
        high_count: severityCounts.high,
        medium_count: severityCounts.medium,
        low_count: severityCounts.low,
        affected_companies: affectedCompanies.size,
        affected_stock_rows: affectedStockRows
      },
      duplicates
    });
  } catch (error) {
    console.error("SuperAdmin barcode duplicate audit error:", error);
    return res.status(500).json({
      success: false,
      message: "Barcode duplicate audit failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/superadmin/audit-log", authMiddleware, checkRole(["SUPERADMIN"]), async (req, res) => {
  try {
    const access = await requireSuperAdminAccess(req, res);
    if (!access) return;

    const filters = [];
    const params = [];
    const companyId = Number(req.query.companyId || 0);
    const userId = Number(req.query.userId || 0);
    const actionType = String(req.query.actionType || "").trim();
    const fromDate = parseAccessDate(req.query.from);
    const toDate = parseAccessDate(req.query.to);

    if (companyId) {
      filters.push("company_id = ?");
      params.push(companyId);
    }

    if (userId) {
      filters.push("user_id = ?");
      params.push(userId);
    }

    if (actionType) {
      filters.push("action_type = ?");
      params.push(actionType);
    }

    if (fromDate) {
      filters.push("created_at >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      filters.push("created_at <= ?");
      params.push(toDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        id,
        company_id,
        user_id,
        actor_role,
        action_type,
        entity_type,
        entity_id,
        module_name,
        route,
        method,
        status,
        message,
        before_data,
        after_data,
        metadata,
        request_id,
        ip_address,
        user_agent,
        created_at
      FROM audit_log
      ${whereClause}
      ORDER BY id DESC
      LIMIT 300
      `,
      params
    );

    return res.json({
      success: true,
      logs: rows
    });
  } catch (error) {
    console.error("SuperAdmin audit log error:", error);
    return res.status(500).json({
      success: false,
      message: "Audit log fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   LOGIN
========================= */
app.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      await logActivitySafe(pool, req, null, {
        actionType: "LOGIN",
        entityType: "AUTH",
        moduleName: "auth",
        status: "failed",
        message: "Login validation failed",
        metadata: {
          email: maskDebugIdentifier(email),
          reason: "MISSING_EMAIL_OR_PASSWORD"
        }
      });
      return res.status(200).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      await logActivitySafe(pool, req, null, {
        actionType: "LOGIN",
        entityType: "AUTH",
        moduleName: "auth",
        status: "denied",
        message: "Invalid login",
        metadata: {
          email: maskDebugIdentifier(email),
          reason: "USER_NOT_FOUND"
        }
      });
      return res.status(200).json({ success: false, message: "Invalid login" });
    }

    const passwordMatches = await verifyPasswordForUser(user, password);
    if (!passwordMatches) {
      await logActivitySafe(pool, req, null, {
        companyId: user.company_id ?? null,
        userId: user.id ?? null,
        actorRole: user.role || "",
        actionType: "LOGIN",
        entityType: "AUTH",
        entityId: String(user.id || ""),
        moduleName: "auth",
        status: "denied",
        message: "Invalid login",
        metadata: {
          email: maskDebugIdentifier(email),
          reason: "PASSWORD_MISMATCH"
        }
      });
      return res.status(200).json({ success: false, message: "Invalid login" });
    }

    if (isSuperAdminUser(user)) {
      user.role = "SuperAdmin";
      user.status = "approved";
      user.company_id = null;
      user.company_name = "";
      user.company_status = "";
    }

    if (String(user.status || "").toLowerCase() !== "approved") {
      await logActivitySafe(pool, req, null, {
        companyId: user.company_id ?? null,
        userId: user.id ?? null,
        actorRole: user.role || "",
        actionType: "LOGIN",
        entityType: "AUTH",
        entityId: String(user.id || ""),
        moduleName: "auth",
        status: "denied",
        message: "Pending approval",
        metadata: {
          email: maskDebugIdentifier(email),
          userStatus: user.status || ""
        }
      });
      return res.status(200).json({ success: false, message: "Pending approval" });
    }

    await repairApprovedAdminCompanyLink(user);

    const loginAccess = validateAccessStateForUser(user);
    if (!loginAccess.ok) {
      await logActivitySafe(pool, req, null, {
        companyId: user.company_id ?? null,
        userId: user.id ?? null,
        actorRole: user.role || "",
        actionType: "LOGIN",
        entityType: "AUTH",
        entityId: String(user.id || ""),
        moduleName: "auth",
        status: "denied",
        message: loginAccess.message || "Login blocked by access control",
        metadata: {
          email: maskDebugIdentifier(email),
          reason: "ACCESS_CONTROL_BLOCK"
        }
      });
      return res.status(loginAccess.status || 403).json({
        success: false,
        message: loginAccess.message || "Access denied"
      });
    }

    if (!String(user.role || "").trim()) {
      await logActivitySafe(pool, req, null, {
        companyId: user.company_id ?? null,
        userId: user.id ?? null,
        actionType: "LOGIN",
        entityType: "AUTH",
        entityId: String(user.id || ""),
        moduleName: "auth",
        status: "denied",
        message: "Role not assigned",
        metadata: {
          email: maskDebugIdentifier(email)
        }
      });
      return res.status(200).json({ success: false, message: "Role not assigned yet" });
    }

    const token = signAuthToken(user);

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    await logActivitySafe(pool, req, null, {
      companyId: user.company_id ?? null,
      userId: user.id ?? null,
      actorRole: user.role || "",
      actionType: "LOGIN",
      entityType: "AUTH",
      entityId: String(user.id || ""),
      moduleName: "auth",
      status: "success",
      message: "Login successful",
      metadata: {
        email: maskDebugIdentifier(email)
      }
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        status: user.status,
        company_id: user.company_id,
        companyId: user.company_id,
        company_name: user.company_name || "",
        companyName: user.company_name || "",
        company_status: user.company_status || ""
      }
    });
  } catch (error) {
    await logActivitySafe(pool, req, null, {
      actionType: "LOGIN",
      entityType: "AUTH",
      moduleName: "auth",
      status: "failed",
      message: "Login failed",
      metadata: {
        email: maskDebugIdentifier(req.body?.email),
        error: error?.message || "Unknown error"
      }
    });
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: getErrorDetail(error)
    });
  }
});

app.post("/auth/logout", async (req, res) => {
  await logActivitySafe(pool, req, null, {
    userId: getRequestedUserId(req),
    actorRole: req.user?.role || "",
    actionType: "LOGOUT",
    entityType: "AUTH",
    entityId: String(getRequestedUserId(req) || ""),
    moduleName: "auth",
    status: "success",
    message: "Logout successful"
  });

  res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());

  return res.json({
    success: true
  });
});

app.get("/userByEmail", authMiddleware, async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.name, u.mobile, u.email, u.role, u.status, u.company_id, u.created_at,
        c.company_name
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE LOWER(u.email) = LOWER(?)
      LIMIT 1
      `,
      [email]
    );

    if (!rows.length) {
      return res.json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("User by email error:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   TRANSACTION FOUNDATION
========================= */
app.post("/transaction/parties", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const partyName = String(req.body.party_name || req.body.partyName || "").trim();
    const displayName = String(req.body.display_name || req.body.displayName || "").trim();
    const partyType = normalizePartyType(req.body.party_type || req.body.partyType);
    const partyCode = String(req.body.party_code || req.body.partyCode || `PTY-${Date.now()}`).trim();
    const mobile = String(req.body.mobile || "").trim();
    const alternateMobile = String(req.body.alternate_mobile || req.body.alternateMobile || "").trim();
    const gstNo = String(req.body.gst_no || req.body.gstNo || "").trim();
    const panNo = String(req.body.pan_no || req.body.panNo || "").trim();
    const addressLine1 = String(req.body.address_line1 || req.body.addressLine1 || "").trim();
    const addressLine2 = String(req.body.address_line2 || req.body.addressLine2 || "").trim();
    const city = String(req.body.city || "").trim();
    const state = String(req.body.state || "").trim();
    const pinCode = String(req.body.pin_code || req.body.pinCode || "").trim();
    const contactPerson = String(req.body.contact_person || req.body.contactPerson || "").trim();
    const defaultMetalType = normalizeMetalType(req.body.default_metal_type || req.body.defaultMetalType);
    const defaultPurity = toNumber(req.body.default_purity ?? req.body.defaultPurity ?? 0);
    const remarks = String(req.body.remarks || "").trim();
    const finalCompanyId = access.companyScope;
    const finalUserId = access.actingUserId ?? getRequestedUserId(req);

    if (!partyName || !partyType) {
      return res.status(400).json({
        success: false,
        message: "party_name and party_type are required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [duplicateRows] = await connection.query(
      `
      SELECT id
      FROM party_master
      WHERE company_id = ?
        AND LOWER(TRIM(party_name)) = LOWER(TRIM(?))
        AND party_type = ?
      LIMIT 1
      `,
      [finalCompanyId, partyName, partyType]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "The same party name and type already exist"
      });
    }

    const [insertResult] = await connection.query(
      `
      INSERT INTO party_master
      (
        company_id, party_code, party_name, display_name, party_type, status,
        mobile, alternate_mobile, gst_no, pan_no,
        address_line1, address_line2, city, state, pin_code,
        contact_person, default_metal_type, default_purity, remarks, created_by
      )
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalCompanyId,
        partyCode,
        partyName,
        displayName,
        partyType,
        mobile,
        alternateMobile,
        gstNo,
        panNo,
        addressLine1,
        addressLine2,
        city,
        state,
        pinCode,
        contactPerson,
        defaultMetalType,
        defaultPurity,
        remarks,
        finalUserId
      ]
    );

    await ensurePartyBalanceSummaryRow(connection, finalCompanyId, insertResult.insertId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Party created successfully",
      partyId: insertResult.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create party error:", error);
    return res.status(500).json({
      success: false,
      message: "Party create failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/transaction/parties", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const search = String(req.query.search || "").trim().toLowerCase();
    const filterPartyType = normalizePartyType(req.query.partyType || req.query.party_type);
    const params = [];
    const whereParts = [];

    if (companyId !== null) {
      whereParts.push("pm.company_id = ?");
      params.push(companyId);
    }

    if (filterPartyType) {
      whereParts.push("pm.party_type = ?");
      params.push(filterPartyType);
    }

    if (search) {
      whereParts.push("(LOWER(pm.party_name) LIKE ? OR LOWER(pm.party_code) LIKE ? OR LOWER(pm.mobile) LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        pm.*,
        pbs.cash_balance,
        pbs.gold_gross_balance,
        pbs.gold_fine_balance,
        pbs.silver_gross_balance,
        pbs.silver_fine_balance
      FROM party_master pm
      LEFT JOIN party_balance_summary pbs
        ON pbs.party_id = pm.id AND pbs.company_id = pm.company_id
      ${whereClause}
      ORDER BY pm.party_name ASC, pm.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      parties: rows
    });
  } catch (error) {
    console.error("Get parties error:", error);
    return res.status(500).json({
      success: false,
      message: "Party fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.post("/transaction/transactions", authMiddleware, checkRole(["SUPERADMIN", "OWNER", "ACCOUNTS"]), async (req, res) => {
  let connection;

  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: false
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const finalCompanyId = access.companyScope;
    const finalUserId = access.actingUserId ?? getRequestedUserId(req);
    const partyId = Number(req.body.party_id ?? req.body.partyId ?? 0);
    const transactionType = normalizeTransactionType(req.body.transaction_type || req.body.transactionType);
    const voucherNo = String(req.body.voucher_no || req.body.voucherNo || buildVoucherNo(transactionType)).trim();
    const voucherDate = String(req.body.voucher_date || req.body.voucherDate || getTodayDateOnly()).trim();
    const voucherTime = String(req.body.voucher_time || req.body.voucherTime || "").trim();
    const status = normalizeTransactionStatus(req.body.status);
    const referenceNo = String(req.body.reference_no || req.body.referenceNo || "").trim();
    const invoiceNo = String(req.body.invoice_no || req.body.invoiceNo || "").trim();
    const purchaseNo = String(req.body.purchase_no || req.body.purchaseNo || "").trim();
    const lotNo = String(req.body.lot_no || req.body.lotNo || "").trim();
    const processLotNo = String(req.body.process_lot_no || req.body.processLotNo || "").trim();
    const karigarId = req.body.karigar_id ?? req.body.karigarId ?? null;
    const sourceModule = String(req.body.source_module || req.body.sourceModule || "transaction_phase1").trim();
    const paymentMode = String(req.body.payment_mode || req.body.paymentMode || "").trim();
    const paymentStatus = String(req.body.payment_status || req.body.paymentStatus || "").trim();
    const remarks = String(req.body.remarks || "").trim();
    const note = String(req.body.note || "").trim();

    const cashAmount = toNumber(req.body.cash_amount ?? req.body.cashAmount ?? 0);
    const cashEntryType =
      normalizeCashEntryType(req.body.cash_entry_type || req.body.cashEntryType) ||
      getDefaultCashEntryType(transactionType);

    const metalType = normalizeMetalType(req.body.metal_type || req.body.metalType);
    const metalEntryType =
      normalizeMetalEntryType(req.body.metal_entry_type || req.body.metalEntryType) ||
      getDefaultMetalEntryType(transactionType);
    const purity = toNumber(req.body.purity ?? 0);
    const grossWeight = toNumber(req.body.gross_weight ?? req.body.grossWeight ?? 0);
    const fineWeight = toNumber(req.body.fine_weight ?? req.body.fineWeight ?? 0);

    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const settlements = Array.isArray(req.body.settlements) ? req.body.settlements : [];

    if (!partyId || !transactionType) {
      return res.status(400).json({
        success: false,
        message: "party_id and transaction_type are required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const party = await getPartyByIdForCompany(connection, finalCompanyId, partyId);

    if (!party) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Party not found"
      });
    }

    const finalPartyType = normalizePartyType(req.body.party_type || req.body.partyType || party.party_type);

    const [insertResult] = await connection.query(
      `
      INSERT INTO transaction_master
      (
        company_id, voucher_no, voucher_date, voucher_time, transaction_type,
        party_id, party_type, status, reference_no, invoice_no,
        purchase_no, lot_no, process_lot_no, karigar_id, source_module,
        payment_mode, payment_status, remarks, note, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalCompanyId,
        voucherNo,
        voucherDate || null,
        voucherTime || null,
        transactionType,
        partyId,
        finalPartyType,
        status,
        referenceNo,
        invoiceNo,
        purchaseNo,
        lotNo,
        processLotNo,
        karigarId || null,
        sourceModule,
        paymentMode,
        paymentStatus,
        remarks,
        note,
        finalUserId
      ]
    );

    const transactionId = insertResult.insertId;
    const finalLines = lines.length
      ? lines
      : [{
          line_no: 1,
          item_name: String(req.body.item_name || req.body.itemName || "").trim(),
          barcode: String(req.body.barcode || "").trim(),
          lot_no: lotNo,
          metal_type: metalType,
          purity,
          gross_weight: grossWeight,
          fine_weight: fineWeight,
          qty: toNumber(req.body.qty ?? 0),
          rate_per_gram: toNumber(req.body.rate_per_gram ?? req.body.ratePerGram ?? 0),
          metal_value: toNumber(req.body.metal_value ?? req.body.metalValue ?? 0),
          making_charge: toNumber(req.body.making_charge ?? req.body.makingCharge ?? 0),
          hallmark_charge: toNumber(req.body.hallmark_charge ?? req.body.hallmarkCharge ?? 0),
          labour_charge: toNumber(req.body.labour_charge ?? req.body.labourCharge ?? 0),
          other_charge: toNumber(req.body.other_charge ?? req.body.otherCharge ?? 0),
          discount_amount: toNumber(req.body.discount_amount ?? req.body.discountAmount ?? 0),
          gst_amount: toNumber(req.body.gst_amount ?? req.body.gstAmount ?? 0),
          line_amount: toNumber(req.body.line_amount ?? req.body.lineAmount ?? cashAmount ?? 0),
          remarks
        }];

    for (let index = 0; index < finalLines.length; index += 1) {
      const line = finalLines[index] || {};
      await connection.query(
        `
        INSERT INTO transaction_lines
        (
          transaction_id, line_no, item_name, item_id, barcode, lot_no,
          metal_type, purity, gross_weight, net_weight, fine_weight, qty,
          rate_per_gram, metal_value, making_charge, hallmark_charge,
          labour_charge, other_charge, discount_amount, gst_amount,
          line_amount, remarks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          transactionId,
          Number(line.line_no || index + 1),
          String(line.item_name || line.itemName || "").trim(),
          line.item_id ?? line.itemId ?? null,
          String(line.barcode || "").trim(),
          String(line.lot_no || line.lotNo || lotNo || "").trim(),
          normalizeMetalType(line.metal_type || line.metalType || metalType),
          toNumber(line.purity),
          toNumber(line.gross_weight ?? line.grossWeight),
          toNumber(line.net_weight ?? line.netWeight),
          toNumber(line.fine_weight ?? line.fineWeight),
          toNumber(line.qty),
          toNumber(line.rate_per_gram ?? line.ratePerGram),
          toNumber(line.metal_value ?? line.metalValue),
          toNumber(line.making_charge ?? line.makingCharge),
          toNumber(line.hallmark_charge ?? line.hallmarkCharge),
          toNumber(line.labour_charge ?? line.labourCharge),
          toNumber(line.other_charge ?? line.otherCharge),
          toNumber(line.discount_amount ?? line.discountAmount),
          toNumber(line.gst_amount ?? line.gstAmount),
          toNumber(line.line_amount ?? line.lineAmount),
          String(line.remarks || "").trim()
        ]
      );
    }

    for (const settlement of settlements) {
      const settlementType = normalizeSettlementType(settlement.settlement_type || settlement.settlementType);
      if (!settlementType) continue;

      await connection.query(
        `
        INSERT INTO transaction_settlements
        (
          company_id, transaction_id, settlement_type, against_transaction_id,
          against_invoice_no, against_voucher_no, cash_amount, metal_type,
          gross_weight, fine_weight, purity, rate_basis, settlement_date,
          remarks, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          finalCompanyId,
          transactionId,
          settlementType,
          settlement.against_transaction_id ?? settlement.againstTransactionId ?? null,
          String(settlement.against_invoice_no || settlement.againstInvoiceNo || "").trim(),
          String(settlement.against_voucher_no || settlement.againstVoucherNo || "").trim(),
          toNumber(settlement.cash_amount ?? settlement.cashAmount),
          normalizeMetalType(settlement.metal_type || settlement.metalType),
          toNumber(settlement.gross_weight ?? settlement.grossWeight),
          toNumber(settlement.fine_weight ?? settlement.fineWeight),
          toNumber(settlement.purity),
          toNumber(settlement.rate_basis ?? settlement.rateBasis),
          String(settlement.settlement_date || settlement.settlementDate || voucherDate || "").trim() || null,
          String(settlement.remarks || "").trim(),
          finalUserId
        ]
      );
    }

    if (cashAmount > 0 && cashEntryType) {
      await createCashLedgerEntry(connection, {
        companyId: finalCompanyId,
        partyId,
        transactionId,
        entryDate: voucherDate,
        entryType: cashEntryType,
        debitAmount: cashEntryType === "DEBIT" ? cashAmount : 0,
        creditAmount: cashEntryType === "CREDIT" ? cashAmount : 0,
        referenceType: transactionType,
        referenceNo: voucherNo,
        remarks,
        createdBy: finalUserId
      });
    }

    if (metalType && metalEntryType && (grossWeight > 0 || fineWeight > 0)) {
      await createMetalLedgerEntry(connection, {
        companyId: finalCompanyId,
        partyId,
        transactionId,
        entryDate: voucherDate,
        metalType,
        entryType: metalEntryType,
        purity,
        grossIn: metalEntryType === "IN" ? grossWeight : 0,
        grossOut: metalEntryType === "OUT" ? grossWeight : 0,
        fineIn: metalEntryType === "IN" ? fineWeight : 0,
        fineOut: metalEntryType === "OUT" ? fineWeight : 0,
        referenceType: transactionType,
        referenceNo: voucherNo,
        lotNo,
        remarks,
        createdBy: finalUserId
      });
    }

    if (invoiceNo) {
      await connection.query(
        `
        INSERT INTO invoice_transaction_link
        (company_id, invoice_no, transaction_id, link_type, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [finalCompanyId, invoiceNo, transactionId, transactionType, remarks, finalUserId]
      );
    }

    if (purchaseNo) {
      await connection.query(
        `
        INSERT INTO purchase_transaction_link
        (company_id, purchase_no, transaction_id, link_type, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [finalCompanyId, purchaseNo, transactionId, transactionType, remarks, finalUserId]
      );
    }

    if (lotNo || processLotNo) {
      await connection.query(
        `
        INSERT INTO lot_transaction_link
        (company_id, lot_no, process_lot_no, transaction_id, link_type, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [finalCompanyId, lotNo, processLotNo, transactionId, transactionType, remarks, finalUserId]
      );
    }

    if (karigarId) {
      await connection.query(
        `
        INSERT INTO karigar_transaction_link
        (
          company_id, karigar_id, transaction_id, lot_no, process_lot_no,
          issue_weight, receive_weight, loss_weight, labour_amount, remarks, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          finalCompanyId,
          Number(karigarId),
          transactionId,
          lotNo,
          processLotNo,
          transactionType === "KARIGAR_ISSUE" ? grossWeight : 0,
          transactionType === "KARIGAR_RECEIVE" ? grossWeight : 0,
          transactionType === "KARIGAR_LOSS_ADJUSTMENT" ? grossWeight : 0,
          transactionType === "KARIGAR_LABOUR" ? cashAmount : 0,
          remarks,
          finalUserId
        ]
      );
    }

    await recalcPartyBalanceSummary(connection, finalCompanyId, partyId, transactionId);
    await connection.commit();

    return res.json({
      success: true,
      message: "Transaction created successfully",
      transactionId,
      voucherNo
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Create transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Transaction create failed",
      error: getErrorDetail(error)
    });
  } finally {
    if (connection) connection.release();
  }
});

app.get("/transaction/transactions", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const partyId = Number(req.query.partyId || req.query.party_id || 0);
    const transactionType = normalizeTransactionType(req.query.transactionType || req.query.transaction_type);
    const params = [];
    const whereParts = [];
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 1000 });

    if (companyId !== null) {
      whereParts.push("tm.company_id = ?");
      params.push(companyId);
    }

    if (partyId) {
      whereParts.push("tm.party_id = ?");
      params.push(partyId);
    }

    if (transactionType) {
      whereParts.push("tm.transaction_type = ?");
      params.push(transactionType);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        tm.*,
        pm.party_name,
        pm.party_code,
        COUNT(DISTINCT tl.id) AS total_lines,
        COALESCE(SUM(tl.line_amount), 0) AS total_line_amount,
        COALESCE(SUM(tl.qty), 0) AS total_qty,
        COALESCE(SUM(tl.gross_weight), 0) AS total_gross_weight,
        COALESCE(SUM(tl.fine_weight), 0) AS total_fine_weight,
        MAX(COALESCE(tl.metal_type, '')) AS metal_type,
        GROUP_CONCAT(DISTINCT NULLIF(TRIM(COALESCE(tl.item_name, '')), '') SEPARATOR ', ') AS item_names
      FROM transaction_master tm
      LEFT JOIN party_master pm ON pm.id = tm.party_id
      LEFT JOIN transaction_lines tl ON tl.transaction_id = tm.id
      ${whereClause}
      GROUP BY tm.id
      ORDER BY tm.id DESC
      ${pagination.sql}
      `,
      params
    );

    return res.json({
      success: true,
      transactions: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({
      success: false,
      message: "Transaction fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/open-context", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const partyId = Number(req.query.partyId || req.query.party_id || 0);

    if (!partyId) {
      return res.json({
        success: true,
        openInvoices: [],
        recentReferences: []
      });
    }

    const openInvoiceParams = [];
    const recentReferenceParams = [];
    const openInvoiceCompanyFilter = companyId !== null ? "tm.company_id = ? AND " : "";
    const recentReferenceCompanyFilter = companyId !== null ? "tm.company_id = ? AND " : "";
    const settlementCompanyFilter = companyId !== null ? "AND ts.company_id = ?" : "";

    if (companyId !== null) {
      openInvoiceParams.push(companyId);
      recentReferenceParams.push(companyId);
    }

    openInvoiceParams.push(partyId);
    if (companyId !== null) {
      openInvoiceParams.push(companyId);
    }

    recentReferenceParams.push(partyId);

    const [invoiceRows] = await pool.query(
      `
      SELECT
        tm.id AS transaction_id,
        tm.voucher_no,
        tm.voucher_date,
        tm.reference_no,
        tm.invoice_no,
        tm.lot_no,
        tm.process_lot_no,
        COALESCE(SUM(tl.line_amount), 0) AS total_amount,
        COALESCE((
          SELECT SUM(COALESCE(ts.cash_amount, 0))
          FROM transaction_settlements ts
          WHERE ts.against_transaction_id = tm.id
          ${settlementCompanyFilter}
        ), 0) AS settled_amount
      FROM transaction_master tm
      LEFT JOIN transaction_lines tl ON tl.transaction_id = tm.id
      WHERE ${openInvoiceCompanyFilter} tm.party_id = ? AND tm.transaction_type = 'SALE_INVOICE'
      GROUP BY tm.id
      ORDER BY tm.id DESC
      LIMIT 25
      `,
      openInvoiceParams
    );

    const [referenceRows] = await pool.query(
      `
      SELECT
        tm.id AS transaction_id,
        tm.voucher_no,
        tm.voucher_date,
        tm.transaction_type,
        tm.reference_no,
        tm.invoice_no,
        tm.lot_no,
        tm.process_lot_no,
        tm.note,
        tm.remarks
      FROM transaction_master tm
      WHERE ${recentReferenceCompanyFilter} tm.party_id = ?
        AND (
          NULLIF(TRIM(COALESCE(tm.reference_no, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(tm.invoice_no, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(tm.lot_no, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(tm.process_lot_no, '')), '') IS NOT NULL
        )
      ORDER BY tm.id DESC
      LIMIT 12
      `,
      recentReferenceParams
    );

    const openInvoices = invoiceRows
      .map((row) => {
        const totalAmount = toNumber(row.total_amount);
        const settledAmount = toNumber(row.settled_amount);
        const openAmount = Math.max(totalAmount - settledAmount, 0);
        return {
          ...row,
          total_amount: totalAmount,
          settled_amount: settledAmount,
          open_amount: openAmount
        };
      })
      .filter((row) => row.open_amount > 0.009);

    return res.json({
      success: true,
      openInvoices,
      recentReferences: referenceRows
    });
  } catch (error) {
    console.error("Get transaction open context error:", error);
    return res.status(500).json({
      success: false,
      message: "Transaction open context fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/cash-ledger", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const partyId = Number(req.query.partyId || req.query.party_id || 0);
    const params = [];
    const whereParts = [];
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 1000 });

    if (companyId !== null) {
      whereParts.push("cl.company_id = ?");
      params.push(companyId);
    }

    if (partyId) {
      whereParts.push("cl.party_id = ?");
      params.push(partyId);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        cl.*,
        pm.party_name,
        pm.party_type,
        tm.voucher_no,
        tm.transaction_type
      FROM cash_ledger cl
      LEFT JOIN party_master pm ON pm.id = cl.party_id
      LEFT JOIN transaction_master tm ON tm.id = cl.transaction_id
      ${whereClause}
      ORDER BY cl.id DESC
      ${pagination.sql}
      `,
      params
    );

    return res.json({
      success: true,
      ledger: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("Get cash ledger error:", error);
    return res.status(500).json({
      success: false,
      message: "Cash ledger fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/metal-ledger", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const partyId = Number(req.query.partyId || req.query.party_id || 0);
    const metalType = normalizeMetalType(req.query.metalType || req.query.metal_type);
    const params = [];
    const whereParts = [];
    const pagination = getPagination(req, { defaultLimit: 100, maxLimit: 1000 });

    if (companyId !== null) {
      whereParts.push("ml.company_id = ?");
      params.push(companyId);
    }

    if (partyId) {
      whereParts.push("ml.party_id = ?");
      params.push(partyId);
    }

    if (metalType) {
      whereParts.push("ml.metal_type = ?");
      params.push(metalType);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        ml.*,
        pm.party_name,
        pm.party_type,
        tm.voucher_no,
        tm.transaction_type
      FROM metal_ledger ml
      LEFT JOIN party_master pm ON pm.id = ml.party_id
      LEFT JOIN transaction_master tm ON tm.id = ml.transaction_id
      ${whereClause}
      ORDER BY ml.id DESC
      ${pagination.sql}
      `,
      params
    );

    return res.json({
      success: true,
      ledger: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset
      }
    });
  } catch (error) {
    console.error("Get metal ledger error:", error);
    return res.status(500).json({
      success: false,
      message: "Metal ledger fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/api/reports/profit", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: true,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const fromDate = String(req.query.from || "").trim();
    const toDate = String(req.query.to || "").trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (fromDate && !datePattern.test(fromDate)) {
      return res.status(400).json({
        success: false,
        message: "from must be in YYYY-MM-DD format"
      });
    }

    if (toDate && !datePattern.test(toDate)) {
      return res.status(400).json({
        success: false,
        message: "to must be in YYYY-MM-DD format"
      });
    }

    const whereParts = [
      "company_id = ?",
      "COALESCE(is_deleted, 0) = 0",
      "UPPER(COALESCE(status, 'ACTIVE')) <> 'DELETED'"
    ];
    const params = [access.companyScope];

    if (fromDate) {
      whereParts.push("COALESCE(invoice_date, DATE(created_at)) >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      whereParts.push("COALESCE(invoice_date, DATE(created_at)) <= ?");
      params.push(toDate);
    }

    const [rows] = await pool.query(
      `
      SELECT
        COALESCE(SUM(COALESCE(total_amount, 0)), 0) AS total_sales,
        COALESCE(SUM(COALESCE(company_total_amount, 0)), 0) AS total_cost,
        COALESCE(SUM(COALESCE(total_amount, 0) - COALESCE(company_total_amount, 0)), 0) AS total_profit,
        COUNT(*) AS total_invoices
      FROM sales_history
      WHERE ${whereParts.join(" AND ")}
      `,
      params
    );

    const summary = rows[0] || {};
    return res.json({
      success: true,
      totalSales: toNumber(summary.total_sales),
      totalCost: toNumber(summary.total_cost),
      totalProfit: toNumber(summary.total_profit),
      totalInvoices: Number(summary.total_invoices || 0)
    });
  } catch (error) {
    console.error("Get profit report error:", error);
    return res.status(500).json({
      success: false,
      message: "Profit report fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/reports/party-ledger", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const fromDate = String(req.query.fromDate || req.query.from_date || "").trim();
    const toDate = String(req.query.toDate || req.query.to_date || "").trim();
    const partyId = Number(req.query.partyId || req.query.party_id || 0);
    const partyType = normalizePartyType(req.query.partyType || req.query.party_type);
    const transactionType = normalizeTransactionType(req.query.transactionType || req.query.transaction_type);
    const metalType = normalizeMetalType(req.query.metalType || req.query.metal_type);
    const invoiceNo = String(req.query.invoiceNo || req.query.invoice_no || "").trim();
    const lotNo = String(req.query.lotNo || req.query.lot_no || "").trim();
    const processLotNo = String(req.query.processLotNo || req.query.process_lot_no || "").trim();

    const baseParams = [];
    const baseWhere = [];

    if (companyId !== null) {
      baseWhere.push("tm.company_id = ?");
      baseParams.push(companyId);
    }

    if (partyId) {
      baseWhere.push("tm.party_id = ?");
      baseParams.push(partyId);
    }

    if (partyType) {
      baseWhere.push("tm.party_type = ?");
      baseParams.push(partyType);
    }

    if (transactionType) {
      baseWhere.push("tm.transaction_type = ?");
      baseParams.push(transactionType);
    }

    if (invoiceNo) {
      baseWhere.push("tm.invoice_no LIKE ?");
      baseParams.push(`%${invoiceNo}%`);
    }

    if (lotNo) {
      baseWhere.push("tm.lot_no LIKE ?");
      baseParams.push(`%${lotNo}%`);
    }

    if (processLotNo) {
      baseWhere.push("tm.process_lot_no LIKE ?");
      baseParams.push(`%${processLotNo}%`);
    }

    if (metalType) {
      baseWhere.push(`
        EXISTS (
          SELECT 1
          FROM transaction_lines tl_filter
          WHERE tl_filter.transaction_id = tm.id
            AND tl_filter.metal_type = ?
        )
      `);
      baseParams.push(metalType);
    }

    const rangeWhere = [...baseWhere];
    const rangeParams = [...baseParams];
    if (fromDate) {
      rangeWhere.push("tm.voucher_date >= ?");
      rangeParams.push(fromDate);
    }
    if (toDate) {
      rangeWhere.push("tm.voucher_date <= ?");
      rangeParams.push(toDate);
    }

    const rangeWhereClause = rangeWhere.length ? `WHERE ${rangeWhere.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `
      SELECT
        tm.id,
        tm.voucher_date,
        tm.voucher_no,
        tm.transaction_type,
        tm.reference_no,
        tm.invoice_no,
        tm.lot_no,
        tm.process_lot_no,
        tm.remarks,
        tm.note,
        pm.party_name,
        COALESCE(cash.debit_amount, 0) AS cash_debit,
        COALESCE(cash.credit_amount, 0) AS cash_credit,
        COALESCE(gold.gross_in, 0) AS gold_in,
        COALESCE(gold.gross_out, 0) AS gold_out,
        COALESCE(silver.gross_in, 0) AS silver_in,
        COALESCE(silver.gross_out, 0) AS silver_out
      FROM transaction_master tm
      LEFT JOIN party_master pm ON pm.id = tm.party_id
      LEFT JOIN (
        SELECT transaction_id, SUM(debit_amount) AS debit_amount, SUM(credit_amount) AS credit_amount
        FROM cash_ledger
        GROUP BY transaction_id
      ) cash ON cash.transaction_id = tm.id
      LEFT JOIN (
        SELECT transaction_id, SUM(gross_in) AS gross_in, SUM(gross_out) AS gross_out
        FROM metal_ledger
        WHERE metal_type = 'GOLD'
        GROUP BY transaction_id
      ) gold ON gold.transaction_id = tm.id
      LEFT JOIN (
        SELECT transaction_id, SUM(gross_in) AS gross_in, SUM(gross_out) AS gross_out
        FROM metal_ledger
        WHERE metal_type = 'SILVER'
        GROUP BY transaction_id
      ) silver ON silver.transaction_id = tm.id
      ${rangeWhereClause}
      ORDER BY tm.voucher_date ASC, tm.id ASC
      `,
      rangeParams
    );

    let openingCashBalance = 0;
    if (fromDate) {
      const openingWhere = [...baseWhere, "tm.voucher_date < ?"];
      const openingParams = [...baseParams, fromDate];
      const openingWhereClause = openingWhere.length ? `WHERE ${openingWhere.join(" AND ")}` : "";
      const [openingRows] = await pool.query(
        `
        SELECT
          COALESCE(SUM(cl.debit_amount), 0) - COALESCE(SUM(cl.credit_amount), 0) AS opening_cash_balance
        FROM cash_ledger cl
        INNER JOIN transaction_master tm ON tm.id = cl.transaction_id
        ${openingWhereClause}
        `,
        openingParams
      );
      openingCashBalance = toNumber(openingRows[0]?.opening_cash_balance);
    }

    let runningCashBalance = openingCashBalance;
    let goldBalance = 0;
    let silverBalance = 0;

    const ledgerRows = rows.map((row) => {
      const cashDebit = toNumber(row.cash_debit);
      const cashCredit = toNumber(row.cash_credit);
      const goldIn = toNumber(row.gold_in);
      const goldOut = toNumber(row.gold_out);
      const silverIn = toNumber(row.silver_in);
      const silverOut = toNumber(row.silver_out);

      runningCashBalance += cashDebit - cashCredit;
      goldBalance += goldIn - goldOut;
      silverBalance += silverIn - silverOut;

      return {
        ...row,
        cash_debit: cashDebit,
        cash_credit: cashCredit,
        running_cash_balance: runningCashBalance,
        gold_in: goldIn,
        gold_out: goldOut,
        silver_in: silverIn,
        silver_out: silverOut
      };
    });

    return res.json({
      success: true,
      rows: ledgerRows,
      summary: {
        openingCashBalance,
        currentCashBalance: runningCashBalance,
        goldBalance,
        silverBalance
      }
    });
  } catch (error) {
    console.error("Get party ledger report error:", error);
    return res.status(500).json({
      success: false,
      message: "Party ledger report fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/reports/customer-due", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const asOnDate = String(req.query.asOnDate || req.query.as_on_date || getTodayDateOnly()).trim();
    const customerId = Number(req.query.customerId || req.query.customer_id || req.query.partyId || req.query.party_id || 0);
    const invoiceNo = String(req.query.invoiceNo || req.query.invoice_no || "").trim();
    const overdueOnly = parseBooleanLike(req.query.overdueOnly || req.query.overdue_only);
    const openOnly = parseBooleanLike(req.query.openOnly || req.query.open_only);

    const params = [];
    const whereParts = ["tm.transaction_type = 'SALE_INVOICE'"];

    if (companyId !== null) {
      whereParts.push("tm.company_id = ?");
      params.push(companyId);
    }

    whereParts.push("tm.voucher_date <= ?");
    params.push(asOnDate);

    if (customerId) {
      whereParts.push("tm.party_id = ?");
      params.push(customerId);
    }

    if (invoiceNo) {
      whereParts.push("tm.invoice_no LIKE ?");
      params.push(`%${invoiceNo}%`);
    }

    const settlementParams = [];
    const settlementCompanyFilter = companyId !== null ? "ts.company_id = ? AND" : "";
    if (companyId !== null) {
      settlementParams.push(companyId);
    }
    settlementParams.push(asOnDate);

    const [rows] = await pool.query(
      `
      SELECT
        tm.id AS transaction_id,
        pm.party_name AS customer_name,
        tm.invoice_no,
        tm.voucher_date AS invoice_date,
        tm.payment_status,
        tm.reference_no,
        COALESCE(lines.bill_amount, 0) AS bill_amount,
        COALESCE(settle.settled_amount, 0) AS settled_amount,
        settle.last_settlement_date
      FROM transaction_master tm
      LEFT JOIN party_master pm ON pm.id = tm.party_id
      LEFT JOIN (
        SELECT transaction_id, SUM(line_amount) AS bill_amount
        FROM transaction_lines
        GROUP BY transaction_id
      ) lines ON lines.transaction_id = tm.id
      LEFT JOIN (
        SELECT
          against_transaction_id,
          SUM(COALESCE(cash_amount, 0)) AS settled_amount,
          MAX(settlement_date) AS last_settlement_date
        FROM transaction_settlements ts
        WHERE ${settlementCompanyFilter} settlement_date <= ?
        GROUP BY against_transaction_id
      ) settle ON settle.against_transaction_id = tm.id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY tm.voucher_date DESC, tm.id DESC
      `,
      [...settlementParams, ...params]
    );

    const filteredRows = rows
      .map((row) => {
        const billAmount = toNumber(row.bill_amount);
        const settledAmount = toNumber(row.settled_amount);
        const openDue = Math.max(billAmount - settledAmount, 0);
        const isOverdue = openDue > 0.009 && !!asOnDate && String(row.invoice_date || "") < asOnDate;

        return {
          ...row,
          bill_amount: billAmount,
          settled_amount: settledAmount,
          open_due: openDue,
          is_overdue: isOverdue
        };
      })
      .filter((row) => (openOnly ? row.open_due > 0.009 : true))
      .filter((row) => (overdueOnly ? row.is_overdue : true));

    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.totalBilledAmount += row.bill_amount;
        acc.totalSettledAmount += row.settled_amount;
        acc.totalOpenDue += row.open_due;
        if (row.open_due > 0.009) {
          acc.customerSet.add(String(row.customer_name || ""));
        }
        return acc;
      },
      {
        totalBilledAmount: 0,
        totalSettledAmount: 0,
        totalOpenDue: 0,
        customerSet: new Set()
      }
    );

    return res.json({
      success: true,
      rows: filteredRows,
      summary: {
        totalCustomersWithDue: summary.customerSet.size,
        totalOpenDue: summary.totalOpenDue,
        totalBilledAmount: summary.totalBilledAmount,
        totalSettledAmount: summary.totalSettledAmount
      }
    });
  } catch (error) {
    console.error("Get customer due report error:", error);
    return res.status(500).json({
      success: false,
      message: "Customer due report fetch failed",
      error: getErrorDetail(error)
    });
  }
});

app.get("/transaction/reports/metal-ledger", authMiddleware, async (req, res) => {
  try {
    const access = await resolveAccessContext(req, {
      requireActingUser: true,
      requireCompanyScope: false,
      allowSuperAdminAll: true
    });

    if (!access.ok) {
      return sendAccessError(res, access);
    }

    const companyId = access.companyScope;
    const metalType = normalizeMetalType(req.query.metalType || req.query.metal_type);
    const fromDate = String(req.query.fromDate || req.query.from_date || "").trim();
    const toDate = String(req.query.toDate || req.query.to_date || "").trim();
    const partyId = Number(req.query.partyId || req.query.party_id || 0);
    const partyType = normalizePartyType(req.query.partyType || req.query.party_type);
    const transactionType = normalizeTransactionType(req.query.transactionType || req.query.transaction_type);
    const purity = String(req.query.purity || "").trim();
    const lotNo = String(req.query.lotNo || req.query.lot_no || "").trim();
    const processLotNo = String(req.query.processLotNo || req.query.process_lot_no || "").trim();

    if (!metalType) {
      return res.status(400).json({
        success: false,
        message: "metal_type is required"
      });
    }

    const params = [];
    const whereParts = ["ml.metal_type = ?"];
    params.push(metalType);

    if (companyId !== null) {
      whereParts.push("ml.company_id = ?");
      params.push(companyId);
    }

    if (fromDate) {
      whereParts.push("ml.entry_date >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      whereParts.push("ml.entry_date <= ?");
      params.push(toDate);
    }

    if (partyId) {
      whereParts.push("ml.party_id = ?");
      params.push(partyId);
    }

    if (partyType) {
      whereParts.push("pm.party_type = ?");
      params.push(partyType);
    }

    if (transactionType) {
      whereParts.push("tm.transaction_type = ?");
      params.push(transactionType);
    }

    if (purity) {
      whereParts.push("CAST(ml.purity AS CHAR) LIKE ?");
      params.push(`${purity}%`);
    }

    if (lotNo) {
      whereParts.push("tm.lot_no LIKE ?");
      params.push(`%${lotNo}%`);
    }

    if (processLotNo) {
      whereParts.push("tm.process_lot_no LIKE ?");
      params.push(`%${processLotNo}%`);
    }

    const [rows] = await pool.query(
      `
      SELECT
        ml.id,
        ml.entry_date,
        ml.purity,
        ml.gross_in,
        ml.gross_out,
        ml.fine_in,
        ml.fine_out,
        ml.remarks,
        pm.party_name,
        pm.party_type,
        tm.voucher_no,
        tm.transaction_type,
        tm.reference_no,
        tm.invoice_no,
        tm.lot_no,
        tm.process_lot_no
      FROM metal_ledger ml
      LEFT JOIN party_master pm ON pm.id = ml.party_id
      LEFT JOIN transaction_master tm ON tm.id = ml.transaction_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY ml.entry_date DESC, ml.id DESC
      `,
      params
    );

    const normalizedRows = rows.map((row) => ({
      ...row,
      gross_in: toNumber(row.gross_in),
      gross_out: toNumber(row.gross_out),
      fine_in: toNumber(row.fine_in),
      fine_out: toNumber(row.fine_out),
      purity: toNumber(row.purity)
    }));

    const activePartySet = new Set();
    const summary = normalizedRows.reduce(
      (acc, row) => {
        acc.totalIn += row.gross_in;
        acc.totalOut += row.gross_out;
        if (row.party_name) {
          activePartySet.add(String(row.party_name));
        }
        return acc;
      },
      {
        totalIn: 0,
        totalOut: 0
      }
    );

    return res.json({
      success: true,
      rows: normalizedRows,
      summary: {
        metalType,
        totalIn: summary.totalIn,
        totalOut: summary.totalOut,
        netBalance: summary.totalIn - summary.totalOut,
        activePartiesCount: activePartySet.size
      }
    });
  } catch (error) {
    console.error("Get metal ledger report error:", error);
    return res.status(500).json({
      success: false,
      message: "Metal ledger report fetch failed",
      error: getErrorDetail(error)
    });
  }
});

/* =========================
   404
========================= */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: getSafeErrorMessage(err),
    error: getErrorDetail(err)
  });
});

/* =========================
   START SERVER
========================= */
let server = null;

async function runBackgroundStartupTasks() {
  try {
    validateDbStartupEnv();
    validateSuperAdminStartupEnv();
    validateJwtStartupEnv();
    console.log("[STARTUP] Verifying MySQL connection...");
    await testDbConnection();
    startupStatus.db = "connected";
    console.log("[STARTUP] DB connection successful");

    console.log("[STARTUP] Ensuring schema...");
    await ensureSchema();
    console.log(
      "[STARTUP] Schema ready: users, companies, stock, sales_history, sales_items"
    );

    console.log("[STARTUP] Ensuring SuperAdmin account...");
    await ensureSuperAdminExists();
    console.log("[STARTUP] SuperAdmin startup sync completed");
  } catch (error) {
    startupStatus.db = "failed";
    console.error("[STARTUP] Fatal DB/schema startup failure:", error);
    console.error("[STARTUP] Fatal DB/schema error message:", error?.message || error);
    return;
  }

  try {
    await testSmtpConnection();
    if (startupStatus.smtp === "pending") {
      startupStatus.smtp = "connected";
      console.log("[STARTUP] SMTP connected");
    }
  } catch (error) {
    startupStatus.smtp = "failed";
    markSmtpUnavailable(getSafeSmtpDiagnostic(error));
    console.warn("[STARTUP] SMTP connection failed. Email features are disabled until SMTP settings are fixed.");
    console.warn(`[STARTUP] SMTP warning: ${smtpFailureMessage}`);
  }
}

async function bootstrapServer() {
  logPortStartupConfig();
  logDbStartupConfig();
  logSmtpStartupConfig();
  logEnvStatus();

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[STARTUP] Server running on port ${PORT}`);
    runBackgroundStartupTasks().catch((error) => {
      startupStatus.db = "failed";
      console.error("[STARTUP] Unhandled background startup failure:", error);
    });
  });

  server.on("error", (error) => {
    console.error("[STARTUP] Server failed to start:", error);
    process.exit(1);
  });
}

bootstrapServer().catch((error) => {
  startupStatus.db = "failed";
  console.error("[STARTUP] Unhandled bootstrap failure:", error);
  process.exit(1);
});


