"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PAGE_SIZE, buildPagination, parsePaginatedResponse } = require("../js/stock-pagination");

const serverSource = fs.readFileSync(path.join(__dirname, "../js/backend/server.js"), "utf8");
const stockSource = fs.readFileSync(path.join(__dirname, "../stock.html"), "utf8");

function sourceSection(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing source section ${startText}`);
  return source.slice(start, end);
}

function collectPages(totalItems) {
  const rows = Array.from({ length: totalItems }, (_, index) => ({
    id: index + 1,
    barcode: `BC-${String(index + 1).padStart(4, "0")}`,
    weight: 1
  }));
  const totalPages = buildPagination(totalItems, 1).totalPages;
  const pages = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const metadata = buildPagination(totalItems, page);
    pages.push({ metadata, rows: rows.slice(metadata.from ? metadata.from - 1 : 0, metadata.to) });
  }
  return { rows, pages };
}

test("fixed stock page size is 100 for every lot size", () => {
  assert.equal(PAGE_SIZE, 100);
  for (const totalItems of [0, 42, 100, 101, 556, 560]) {
    assert.equal(buildPagination(totalItems, 1).pageSize, 100);
  }
});

test("560-item lot produces five 100-row pages and a 60-row last page", () => {
  const { pages } = collectPages(560);
  assert.deepEqual(pages.map((page) => page.rows.length), [100, 100, 100, 100, 100, 60]);
  assert.deepEqual(pages.map((page) => [page.metadata.from, page.metadata.to]), [
    [1, 100], [101, 200], [201, 300], [301, 400], [401, 500], [501, 560]
  ]);
});

test("556-item lot has six pages, correct ranges, and no duplicate or missing barcode", () => {
  const { rows, pages } = collectPages(556);
  assert.deepEqual(pages.map((page) => page.rows.length), [100, 100, 100, 100, 100, 56]);
  assert.deepEqual([pages[0].metadata.from, pages[0].metadata.to], [1, 100]);
  assert.deepEqual([pages[1].metadata.from, pages[1].metadata.to], [101, 200]);
  assert.deepEqual([pages[5].metadata.from, pages[5].metadata.to], [501, 556]);
  const returned = pages.flatMap((page) => page.rows);
  assert.equal(new Set(returned.map((row) => row.barcode)).size, 556);
  assert.deepEqual(returned.map((row) => row.barcode), rows.map((row) => row.barcode));
});

test("pagination handles fewer than 100, exactly 100, 101, and empty results", () => {
  assert.deepEqual(collectPages(42).pages.map((page) => page.rows.length), [42]);
  assert.deepEqual(collectPages(100).pages.map((page) => page.rows.length), [100]);
  assert.deepEqual(collectPages(101).pages.map((page) => page.rows.length), [100, 1]);
  assert.deepEqual(buildPagination(0, 1), {
    page: 1, pageSize: 100, totalItems: 0, totalPages: 1, from: 0, to: 0
  });
});

test("full-result summary remains authoritative and unchanged on every page", () => {
  const { pages } = collectPages(556);
  const summary = { totalItems: 556, totalWeight: "556.000", inStock: 556, sold: 0, returned: 0, other: 0 };
  for (const page of pages) {
    const parsed = parsePaginatedResponse({ rows: page.rows, pagination: page.metadata, summary });
    assert.deepEqual(parsed.summary, {
      totalItems: 556, totalWeight: 556, inStock: 556, sold: 0, returned: 0, other: 0
    });
  }
});

test("enhanced response rejects legacy arrays and incomplete metadata instead of using rows length", () => {
  assert.throws(() => parsePaginatedResponse(Array.from({ length: 50 })), /metadata is unavailable/);
  assert.throws(
    () => parsePaginatedResponse({ rows: Array.from({ length: 50 }), pagination: {}, summary: {} }),
    /invalid pagination metadata/
  );
  assert.doesNotMatch(stockSource, /X-ERP-Total-Count[^\n]*\|\|\s*data\.length/);
});

test("backend opt-in contract preserves the legacy array response", () => {
  const route = sourceSection(serverSource, 'app.get("/getStock"', 'app.use("/process"');
  assert.match(route, /wantsPaginatedResponse/);
  assert.match(route, /format[^\n]*paginated/);
  assert.match(route, /return res\.json\(\{[\s\S]*rows,[\s\S]*pagination: pageMetadata,[\s\S]*summary:/);
  assert.match(route, /return res\.json\(rows\);/);
});

test("count, summary, and rows share scoped filters and deterministic ordering", () => {
  const route = sourceSection(serverSource, 'app.get("/getStock"', 'app.use("/process"');
  assert.match(route, /s\.company_id = \?/);
  assert.match(route, /appendBranchScopeFilter\(whereParts, params, branchScope/);
  assert.equal((route.match(/\$\{whereClause\}/g) || []).length, 2);
  assert.match(route, /ORDER BY[\s\S]*s\.lot_number[\s\S]*s\.serial[\s\S]*s\.id ASC/);
  assert.match(route, /COUNT\(\*\) AS total_count/);
});

test("lot, barcode, serial, product, and status searches are server-side and reset page one", () => {
  const route = sourceSection(serverSource, 'app.get("/getStock"', 'app.use("/process"');
  for (const queryName of ["lot", "barcode", "serial", "product", "status"]) {
    assert.match(route, new RegExp(`req\\.query\\.${queryName}`));
  }
  assert.match(stockSource, /format", "paginated"/);
  assert.match(stockSource, /page", String\(stockCurrentPage\)/);
  assert.match(stockSource, /serial: document\.getElementById\("searchSerial"\)/);
  assert.match(stockSource, /function handleStockSearchInput\(\)[\s\S]*stockCurrentPage = 1/);
  assert.match(stockSource, /function handleStockFilterChange\(\)[\s\S]*stockCurrentPage = 1/);
  const { rows } = collectPages(556);
  assert.equal(rows.filter((row) => row.barcode === "BC-0556").length, 1);
});

test("frontend renders ranges, full summary, and first/previous/next/last controls", () => {
  assert.match(stockSource, /Showing \$\{stockRangeFrom\}–\$\{stockRangeTo\} of \$\{stockTotalCount\} items/);
  assert.match(stockSource, /Page \$\{stockCurrentPage\} of \$\{stockTotalPages\}/);
  assert.match(stockSource, /id="stockFirstBtn"[\s\S]*id="stockPrevBtn"[\s\S]*id="stockNextBtn"[\s\S]*id="stockLastBtn"/);
  assert.doesNotMatch(stockSource, /id="stockPageSize"/);
  assert.match(stockSource, /parsed\.summary\.totalItems/);
  assert.match(stockSource, /parsed\.summary\.totalWeight/);
});

test("bulk Sticker Save never silently truncates a batch at 100", () => {
  const route = sourceSection(serverSource, 'app.post("/addStickersBulk"', 'app.post("/addSticker"');
  assert.match(route, /items\.length > 500/);
  assert.match(route, /maximum of 500 sticker items can be saved at once/);
  assert.match(route, /for \(const item of normalizedItems\)/);
  assert.match(route, /savedCount: normalizedItems\.length/);
  assert.doesNotMatch(route, /slice\(\s*0\s*,\s*100\s*\)/);
});
