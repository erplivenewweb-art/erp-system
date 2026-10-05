(function stockPaginationModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StockPagination = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStockPagination() {
  "use strict";

  const PAGE_SIZE = 100;

  function toNonNegativeInteger(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
  }

  function buildPagination(totalItemsValue, requestedPageValue) {
    const totalItems = toNonNegativeInteger(totalItemsValue, 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const requestedPage = Math.max(1, toNonNegativeInteger(requestedPageValue, 1));
    const page = Math.min(requestedPage, totalPages);
    const from = totalItems ? ((page - 1) * PAGE_SIZE) + 1 : 0;
    const to = totalItems ? Math.min(page * PAGE_SIZE, totalItems) : 0;

    return { page, pageSize: PAGE_SIZE, totalItems, totalPages, from, to };
  }

  function parsePaginatedResponse(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Stock server pagination metadata is unavailable. Restart the updated ERP server.");
    }
    if (!Array.isArray(payload.rows) || !payload.pagination || !payload.summary) {
      throw new Error("Stock server returned an incomplete paginated response.");
    }

    const pagination = payload.pagination;
    const summary = payload.summary;
    const requiredPaginationValues = [
      pagination.page,
      pagination.pageSize,
      pagination.totalItems,
      pagination.totalPages,
      pagination.from,
      pagination.to
    ];
    if (requiredPaginationValues.some((value) => !Number.isFinite(Number(value)))) {
      throw new Error("Stock server returned invalid pagination metadata.");
    }
    if (Number(pagination.pageSize) !== PAGE_SIZE) {
      throw new Error(`Stock lot pages must contain ${PAGE_SIZE} rows.`);
    }
    if (!Number.isFinite(Number(summary.totalItems)) || Number(summary.totalItems) !== Number(pagination.totalItems)) {
      throw new Error("Stock summary total does not match the paginated total.");
    }

    return {
      rows: payload.rows,
      pagination: {
        page: Number(pagination.page),
        pageSize: PAGE_SIZE,
        totalItems: Number(pagination.totalItems),
        totalPages: Number(pagination.totalPages),
        from: Number(pagination.from),
        to: Number(pagination.to)
      },
      summary: {
        totalItems: Number(summary.totalItems),
        totalWeight: Number(summary.totalWeight || 0),
        inStock: Number(summary.inStock || 0),
        sold: Number(summary.sold || 0),
        returned: Number(summary.returned || 0),
        other: Number(summary.other || 0)
      }
    };
  }

  return { PAGE_SIZE, buildPagination, parsePaginatedResponse };
});
