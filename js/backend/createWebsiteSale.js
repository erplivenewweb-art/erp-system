const crypto = require("crypto");

const forbidden = new Set([
  "invoiceNumber", "invoiceSequence", "erpWritePermission", "executionPermit",
  "paymentAllocation", "cashSettlement", "metalSettlement", "gstPosting", "ledgerPosting", "stockState"
]);

function canonicalizeCreateWebsiteSale(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) throw new Error("Website sale command is invalid");
  for (const key of Object.keys(command)) if (forbidden.has(key)) throw new Error(`Website sale command field is prohibited: ${key}`);
  const required = ["externalExecutionId", "websiteOrderId", "companyId", "branchId", "partyReference", "items", "currency", "authoritativeDigest"];
  for (const key of required) if (!command[key]) throw new Error(`Website sale command ${key} is required`);
  if (!Array.isArray(command.items) || command.items.length === 0) throw new Error("Website sale command items are required");
  const result = {
    source: "WEBSITE",
    externalExecutionId: String(command.externalExecutionId), websiteOrderId: String(command.websiteOrderId),
    companyId: Number(command.companyId), branchId: Number(command.branchId), partyReference: String(command.partyReference),
    currency: String(command.currency), authoritativeDigest: String(command.authoritativeDigest),
    items: command.items.map((item) => ({ mappingReference: String(item.mappingReference), quantity: Number(item.quantity), snapshotDigest: String(item.snapshotDigest) }))
  };
  if (!Number.isInteger(result.companyId) || result.companyId < 1 || !Number.isInteger(result.branchId) || result.branchId < 1 || result.currency !== "INR" || !/^[a-f0-9]{64}$/i.test(result.authoritativeDigest) || result.items.some((item) => !item.mappingReference || !Number.isInteger(item.quantity) || item.quantity < 1 || !/^[a-f0-9]{64}$/i.test(item.snapshotDigest))) throw new Error("Website sale command is invalid");
  return Object.freeze(result);
}

function createWebsiteSaleDigest(command) { return crypto.createHash("sha256").update(JSON.stringify(canonicalizeCreateWebsiteSale(command))).digest("hex"); }

function classifyWebsiteSaleIdentity(existing, command) {
  const canonical = canonicalizeCreateWebsiteSale(command), digest = createWebsiteSaleDigest(canonical);
  if (!existing) return { action: "CLAIM", digest, command: canonical };
  if (existing.canonical_digest !== digest) return { action: "CONFLICT", digest, command: canonical };
  return { action: "REPLAY", digest, command: canonical };
}

module.exports = { canonicalizeCreateWebsiteSale, createWebsiteSaleDigest, classifyWebsiteSaleIdentity };
