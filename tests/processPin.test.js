"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
const processSource = fs.readFileSync(path.join(__dirname, "../process.html"), "utf8");

function sourceSection(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startText}`);
  return source.slice(start, end);
}

test("literal PIN and legacy Fitting both resolve to PIN component material", () => {
  const backend = sourceSection(serverSource, "function getAdditiveMaterialForStep", "function getAdditiveStockSource");
  const frontend = sourceSection(processSource, "function isFittingLikeStepName", "function getActiveAdditiveStepName");
  assert.match(backend, /\["fitting", "pin"\]\.includes/);
  assert.match(frontend, /\["fitting", "pin"\]\.includes/);
});

test("next process input inherits the previous completed output and rejects zero", () => {
  const helper = sourceSection(serverSource, "async function getNextProcessStepContext", 'app.get("/process/steps"');
  assert.match(helper, /lastCompletedStep\s*\?\s*toNumber\(lastCompletedStep\.output_weight\)/);
  assert.match(helper, /inheritedInputWeight <= 0/);
  assert.match(helper, /Previous completed process step must have output weight greater than zero/);
  assert.match(helper, /inputWeight:\s*inheritedInputWeight/);
});

test("process save enforces the next configured step and rejects duplicate final PIN", () => {
  const route = sourceSection(serverSource, 'app.post("/process/steps"', 'app.put("/process/steps/:id/complete"');
  assert.match(route, /expectedTemplateStep/);
  assert.match(route, /All configured process steps are already completed for this lot/);
  assert.match(route, /Complete process step.*next/);
});

test("PIN form fails closed instead of silently converting missing input to zero", () => {
  const loader = sourceSection(processSource, "async function loadNextProcessInput", "async function loadProcessStepContext");
  assert.match(loader, /Number\(data\?\.inputWeight\)/);
  assert.match(loader, /resolvedInputWeight <= 0/);
  assert.match(loader, /Math\.abs\(resolvedInputWeight - previousOutputWeight\) > 0\.0005/);
  assert.doesNotMatch(loader, /setBaseProcessInputWeight\(data\?\.inputWeight \|\| 0\)/);
});

test("regular Sankha completion remains Sticker-bound and stock creation stays category-gated", () => {
  const destination = sourceSection(serverSource, "function getWorkCategoryDestination", "function normalizeMaterialType");
  assert.match(destination, /directStockCategories = new Set\(\["KDM", "PIN"\]\)/);
  assert.match(destination, /return "STICKER"/);

  const completion = sourceSection(serverSource, 'app.put("/process/lots/:lotNo/complete"', 'app.get("/sales-history/payment-history/:invoiceNumber"');
  assert.match(completion, /if \(destination === "STOCK"\)/);
  assert.doesNotMatch(completion, /addSticker|addStickersBulk|STICKER_CREATED/);
});

test("branch-locked PIN component lookup is scoped to the assigned branch", () => {
  const finder = sourceSection(serverSource, "async function findAdditiveStockItemForCompany", "async function getAdditiveStockItemById");
  assert.match(finder, /current_branch_id = \?/);

  const issueRoute = sourceSection(serverSource, 'app.post("/process/steps/:id/additive-issue"', 'app.put("/process/additive-issues/:id/return"');
  assert.match(issueRoute, /branchId:\s*access\.isBranchLocked \? access\.userBranchId : null/);
});
