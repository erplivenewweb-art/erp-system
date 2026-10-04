const crypto = require("crypto");

const FUTURE_EXECUTE_OPERATION = "CREATE_WEBSITE_SALE_EXECUTE";
const MONEY_SCALE = 100;

class ReferenceAuthorityError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function roundMoney(value) {
  if (!Number.isFinite(Number(value)))
    throw new ReferenceAuthorityError(
      "MONEY_INVALID",
      "Monetary value is invalid",
      422,
    );
  return (
    Math.round((Number(value) + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE
  );
}

function calculateGstAllocation({
  taxableValue,
  gstRatePercent,
  sellerState,
  customerState,
}) {
  const taxable = roundMoney(taxableValue);
  const rate = Number(gstRatePercent);
  if (
    taxable < 0 ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    !String(sellerState || "").trim() ||
    !String(customerState || "").trim()
  ) {
    throw new ReferenceAuthorityError(
      "GST_ALLOCATION_INVALID",
      "GST allocation inputs are invalid",
      422,
    );
  }
  const gst = roundMoney((taxable * rate) / 100);
  const sameState =
    String(sellerState).trim().toUpperCase() ===
    String(customerState).trim().toUpperCase();
  const cgst = sameState ? roundMoney(gst / 2) : 0;
  const sgst = sameState ? roundMoney(gst - cgst) : 0;
  const igst = sameState ? 0 : gst;
  return Object.freeze({
    taxableValue: taxable,
    gstRatePercent: rate,
    cgst,
    sgst,
    igst,
    tax: gst,
    lineTotal: roundMoney(taxable + gst),
    taxType: sameState ? "CGST_SGST" : "IGST",
  });
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function executionPayloadDigest(payload) {
  return crypto.createHash("sha256").update(canonical(payload)).digest("hex");
}

function assertQuantityOne(quantity) {
  if (Number(quantity) !== 1) {
    throw new ReferenceAuthorityError(
      "MULTI_UNIT_ALLOCATION_POLICY_REQUIRED",
      "Only quantity=1 exact stock bindings are supported",
      422,
    );
  }
}

function requiredString(value, name) {
  if (!String(value || "").trim()) {
    throw new ReferenceAuthorityError(
      "EXECUTION_EVIDENCE_INCOMPLETE",
      `${name} is required for a website-sale execution payload`,
      422,
    );
  }
  return String(value).trim();
}

function buildQuantityOneExecutionPayload({
  evidence,
  resolution,
  line,
  totals,
}) {
  if (!evidence || !resolution || !line || !totals) {
    throw new ReferenceAuthorityError(
      "EXECUTION_PAYLOAD_INVALID",
      "Authoritative evidence, resolution, line, and totals are required",
      422,
    );
  }
  assertQuantityOne(line.quantity);
  for (const prohibited of [
    "invoiceNumber",
    "paymentAllocation",
    "paymentReceipt",
    "settlement",
    "erpWritePermission",
  ]) {
    if (Object.prototype.hasOwnProperty.call(line, prohibited)) {
      throw new ReferenceAuthorityError(
        "PROHIBITED_EXECUTION_INPUT",
        `${prohibited} cannot be supplied to CreateWebsiteSale`,
        422,
      );
    }
  }
  const companyId = Number(evidence.companyId);
  const branchId = Number(evidence.branchId);
  if (!Number.isInteger(companyId) || !Number.isInteger(branchId)) {
    throw new ReferenceAuthorityError(
      "EXECUTION_SCOPE_INVALID",
      "Company and branch must be authoritative integer bindings",
      422,
    );
  }
  const refs = {
    executionId: requiredString(evidence.executionId, "executionId"),
    websiteOrderId: requiredString(evidence.websiteOrderId, "websiteOrderId"),
    billingCommandId: requiredString(
      evidence.billingCommandId,
      "billingCommandId",
    ),
    preparationId: requiredString(evidence.preparationId, "preparationId"),
    authorizationId: requiredString(
      evidence.authorizationId,
      "authorizationId",
    ),
    readinessId: requiredString(evidence.readinessId, "readinessId"),
    preflightId: requiredString(evidence.preflightId, "preflightId"),
    stagingGateId: requiredString(evidence.stagingGateId, "stagingGateId"),
  };
  const shipping = roundMoney(totals.shipping || 0);
  if (shipping !== 0) {
    throw new ReferenceAuthorityError(
      "SHIPPING_ALLOCATION_POLICY_REQUIRED",
      "Shipping cannot be included before its ERP tax allocation is defined",
      409,
    );
  }
  const allocation = calculateGstAllocation({
    taxableValue: line.taxableValue,
    gstRatePercent: resolution.tax.gstRatePercent,
    sellerState: resolution.sellerState,
    customerState: resolution.customerState,
  });
  if (
    roundMoney(totals.subtotal) !== allocation.taxableValue ||
    roundMoney(totals.tax) !== allocation.tax ||
    roundMoney(totals.total) !== allocation.lineTotal
  ) {
    throw new ReferenceAuthorityError(
      "AUTHORITATIVE_TOTALS_MISMATCH",
      "Line tax allocation does not reconcile with the authoritative snapshot",
      409,
    );
  }
  const payloadWithoutDigest = {
    source: "WEBSITE",
    companyId,
    branchId,
    evidence: refs,
    party: { partyId: Number(resolution.party.partyId) },
    saleHeader: {
      companyId,
      branchId,
      websiteOrderId: refs.websiteOrderId,
      externalExecutionId: refs.executionId,
      supplyState: resolution.sellerState,
      customerSupplyState: resolution.customerState,
      subtotal: allocation.taxableValue,
      cgst: allocation.cgst,
      sgst: allocation.sgst,
      igst: allocation.igst,
      tax: allocation.tax,
      shipping,
      grandTotal: allocation.lineTotal,
      currency: requiredString(totals.currency || "INR", "currency"),
    },
    saleItems: [
      {
        integrationProductId: Number(resolution.product.integrationProductId),
        stockId: Number(resolution.stock.stockId),
        barcode: requiredString(resolution.stock.barcode, "barcode"),
        quantity: 1,
        unitRate: roundMoney(line.unitRate),
        ...allocation,
      },
    ],
    receivable: {
      companyId,
      branchId,
      partyId: Number(resolution.party.partyId),
      websiteOrderId: refs.websiteOrderId,
      externalExecutionId: refs.executionId,
      amount: allocation.lineTotal,
      currency: requiredString(totals.currency || "INR", "currency"),
    },
    executionEnabled: false,
  };
  return Object.freeze({
    ...payloadWithoutDigest,
    canonicalPayloadDigest: executionPayloadDigest(payloadWithoutDigest),
  });
}

function loadV1DurableSnapshot(source, binding) {
  if (!source || typeof source.load !== "function")
    throw new Error("A private durable snapshot source is required");
  const record = source.load(structuredClone(binding));
  const order = record?.websiteOrder;
  const snapshot = order?.snapshot;
  const conversion = record?.conversion;
  if (
    !record ||
    !snapshot ||
    order.websiteOrderId !== binding.websiteOrderId ||
    record.billingCommand?.publicId !== binding.billingCommandId ||
    conversion?.commandId !== binding.billingCommandId ||
    !["DRY_RUN", "SHADOW_COMPLETE", "COMPLETED_SIMULATION"].includes(
      conversion.state,
    ) ||
    order.state !== "APPROVED" ||
    record.reservation?.request?.websiteOrderId !== order.websiteOrderId ||
    record.fulfilment?.request?.websiteOrderId !== order.websiteOrderId ||
    record.fulfilment?.state !== "READY_FOR_BILLING"
  )
    throw new ReferenceAuthorityError(
      "DURABLE_SNAPSHOT_BINDING_INVALID",
      "Durable billing snapshot binding is invalid",
      409,
    );
  const price = snapshot.priceSnapshot;
  if (
    !Array.isArray(snapshot.items) ||
    snapshot.items.length !== 1 ||
    Number(snapshot.items[0].quantity) !== 1
  )
    throw new ReferenceAuthorityError(
      "MULTI_UNIT_ALLOCATION_POLICY_REQUIRED",
      "V1 requires exactly one quantity=1 line",
      409,
    );
  if (roundMoney(price.discount) !== 0)
    throw new ReferenceAuthorityError(
      "DISCOUNT_ALLOCATION_POLICY_REQUIRED",
      "V1 requires zero discount",
      409,
    );
  if (roundMoney(price.shipping) !== 0)
    throw new ReferenceAuthorityError(
      "SHIPPING_ALLOCATION_POLICY_REQUIRED",
      "V1 requires zero shipping",
      409,
    );
  const item = structuredClone(snapshot.items[0]);
  if (roundMoney(item.lineTotal) !== roundMoney(price.subtotal))
    throw new ReferenceAuthorityError(
      "AUTHORITATIVE_TOTALS_MISMATCH",
      "V1 line amount does not match subtotal",
      409,
    );
  return Object.freeze({
    item: Object.freeze(item),
    totals: Object.freeze({
      subtotal: roundMoney(price.subtotal),
      tax: roundMoney(price.tax),
      shipping: 0,
      total: roundMoney(price.total),
      currency: price.currency,
    }),
    immutableSnapshotDigest: executionPayloadDigest(snapshot),
    customerPublicRef: snapshot.customer?.publicRef,
  });
}

function createV1EvidenceBridge({ snapshotSource, referenceAuthority }) {
  if (
    !referenceAuthority ||
    typeof referenceAuthority.resolveQuantityOne !== "function"
  )
    throw new Error("A private reference authority is required");
  return Object.freeze({
    async assemble({ binding, evidence, externalLineRef }) {
      const loaded = loadV1DurableSnapshot(snapshotSource, binding);
      const resolution = await referenceAuthority.resolveQuantityOne({
        companyId: evidence.companyId,
        branchId: evidence.branchId,
        externalPartyRef: loaded.customerPublicRef,
        externalProductRef: loaded.item.productRef,
        externalVariantRef: loaded.item.variantRef,
        externalLineRef,
        quantity: loaded.item.quantity,
      });
      let payload;
      try {
        payload = buildQuantityOneExecutionPayload({
          evidence: {
            ...evidence,
            websiteOrderId: binding.websiteOrderId,
            billingCommandId: binding.billingCommandId,
          },
          resolution,
          line: {
            quantity: 1,
            unitRate: loaded.item.unitPrice,
            taxableValue: loaded.item.lineTotal,
          },
          totals: loaded.totals,
        });
      } catch (error) {
        if (error?.code === "AUTHORITATIVE_TOTALS_MISMATCH")
          throw new ReferenceAuthorityError(
            "TAX_SNAPSHOT_MISMATCH",
            "ERP GST calculation differs from the durable snapshot",
            409,
          );
        throw error;
      }
      return Object.freeze({
        ...payload,
        immutableSourceSnapshotDigest: loaded.immutableSnapshotDigest,
        canonicalPayloadDigest: executionPayloadDigest({
          ...payload,
          immutableSourceSnapshotDigest: loaded.immutableSnapshotDigest,
        }),
      });
    },
  });
}

function createWebsiteSaleReferenceAuthority(source) {
  if (!source || typeof source !== "object")
    throw new Error("Reference authority source is required");
  return Object.freeze({
    async resolveQuantityOne({
      companyId,
      branchId,
      externalPartyRef,
      externalProductRef,
      externalVariantRef,
      externalLineRef,
      quantity,
    }) {
      assertQuantityOne(quantity);
      const party = await source.party({ companyId, externalPartyRef });
      if (
        !party ||
        Number(party.companyId) !== Number(companyId) ||
        !["CUSTOMER", "CUSTOMER_SUPPLIER"].includes(String(party.partyType))
      ) {
        throw new ReferenceAuthorityError(
          "PARTY_MAPPING_BLOCKED",
          "Mapped ERP party is unavailable",
          409,
        );
      }
      const product = await source.product({
        companyId,
        externalProductRef,
        externalVariantRef,
      });
      if (
        !product ||
        Number(product.companyId) !== Number(companyId) ||
        !product.active
      ) {
        throw new ReferenceAuthorityError(
          "PRODUCT_MAPPING_BLOCKED",
          "Mapped ERP product is unavailable",
          409,
        );
      }
      const stock = await source.stock({
        companyId,
        branchId,
        externalLineRef,
        integrationProductId: product.integrationProductId,
      });
      if (
        !stock ||
        Number(stock.companyId) !== Number(companyId) ||
        Number(stock.branchId) !== Number(branchId) ||
        Number(stock.integrationProductId) !==
          Number(product.integrationProductId) ||
        !stock.sellable
      ) {
        throw new ReferenceAuthorityError(
          "STOCK_BINDING_BLOCKED",
          "Mapped ERP stock is unavailable",
          409,
        );
      }
      const tax = await source.tax({
        companyId,
        integrationProductId: product.integrationProductId,
      });
      if (!tax || !tax.active || Number(tax.gstRatePercent) < 0) {
        throw new ReferenceAuthorityError(
          "GST_RATE_SOURCE_MISSING",
          "Mapped ERP GST profile is unavailable",
          409,
        );
      }
      const sellerState = await source.sellerState({ companyId, branchId });
      if (
        !String(sellerState || "").trim() ||
        !String(party.supplyState || "").trim()
      ) {
        throw new ReferenceAuthorityError(
          "SUPPLY_STATE_BLOCKED",
          "Authoritative supply state is unavailable",
          409,
        );
      }
      return Object.freeze({
        party,
        product,
        stock,
        tax,
        sellerState: String(sellerState).trim(),
        customerState: String(party.supplyState).trim(),
      });
    },
  });
}

function createMysqlReferenceAuthority(connection) {
  if (!connection || typeof connection.query !== "function")
    throw new Error("A private ERP connection is required");
  return createWebsiteSaleReferenceAuthority({
    async party({ companyId, externalPartyRef }) {
      const [rows] = await connection.query(
        `SELECT p.id, p.company_id, p.party_type, p.status, p.state, ptp.supply_state
         FROM erp_integration_party_mappings m
         INNER JOIN party_master p ON p.id = m.party_id AND p.company_id = m.company_id
         INNER JOIN erp_party_tax_profiles ptp ON ptp.party_id = p.id AND ptp.company_id = p.company_id
         WHERE m.company_id = ? AND m.external_party_ref = ? AND m.active = 1 AND ptp.active = 1
           AND p.status = 'ACTIVE' AND p.party_type IN ('CUSTOMER', 'CUSTOMER_SUPPLIER')
           AND UPPER(TRIM(p.state)) = UPPER(TRIM(ptp.supply_state))`,
        [Number(companyId), String(externalPartyRef)],
      );
      if (rows.length !== 1) return null;
      const row = rows[0];
      return {
        partyId: Number(row.id),
        companyId: Number(row.company_id),
        partyType: row.party_type,
        supplyState: row.supply_state,
      };
    },
    async product({ companyId, externalProductRef, externalVariantRef }) {
      const [rows] = await connection.query(
        `SELECT p.id, p.company_id, p.active, p.tax_profile_id
         FROM erp_integration_product_mappings m
         INNER JOIN erp_integration_products p ON p.id = m.integration_product_id AND p.company_id = m.company_id
         WHERE m.company_id = ? AND m.external_product_ref = ? AND m.external_variant_ref = ? AND m.active = 1`,
        [
          Number(companyId),
          String(externalProductRef),
          String(externalVariantRef),
        ],
      );
      if (rows.length !== 1) return null;
      const row = rows[0];
      return {
        integrationProductId: Number(row.id),
        companyId: Number(row.company_id),
        active: Boolean(row.active),
        taxProfileId:
          row.tax_profile_id == null ? null : Number(row.tax_profile_id),
      };
    },
    async stock({
      companyId,
      branchId,
      externalLineRef,
      integrationProductId,
    }) {
      const [rows] = await connection.query(
        `SELECT b.integration_product_id, b.stock_id, b.company_id, b.branch_id, b.barcode,
                s.status, s.stock_state, s.deleted_at, s.invoice_number, s.current_branch_id
         FROM erp_integration_stock_bindings b
         INNER JOIN stock s ON s.id = b.stock_id AND s.company_id = b.company_id
         WHERE b.company_id = ? AND b.branch_id = ? AND b.external_line_ref = ? AND b.integration_product_id = ?
           AND b.active = 1 AND UPPER(TRIM(s.barcode)) = UPPER(TRIM(b.barcode))
           AND s.current_branch_id = ? AND s.deleted_at IS NULL
           AND UPPER(COALESCE(s.status, 'IN_STOCK')) = 'IN_STOCK'
           AND UPPER(COALESCE(NULLIF(TRIM(s.stock_state), ''), s.status, 'IN_STOCK')) = 'IN_STOCK'
           AND TRIM(COALESCE(s.invoice_number, '')) = ''`,
        [
          Number(companyId),
          Number(branchId),
          String(externalLineRef),
          Number(integrationProductId),
          Number(branchId),
        ],
      );
      if (rows.length !== 1) return null;
      const row = rows[0];
      return {
        stockId: Number(row.stock_id),
        barcode: row.barcode,
        integrationProductId: Number(row.integration_product_id),
        companyId: Number(row.company_id),
        branchId: Number(row.branch_id),
        sellable: true,
      };
    },
    async tax({ companyId, integrationProductId }) {
      const [rows] = await connection.query(
        `SELECT t.gst_rate_percent, t.active
         FROM erp_integration_products p
         INNER JOIN erp_gst_tax_profiles t ON t.id = p.tax_profile_id AND t.company_id = p.company_id
         WHERE p.company_id = ? AND p.id = ? AND p.active = 1 AND t.active = 1
           AND (t.effective_from IS NULL OR t.effective_from <= CURRENT_DATE())
           AND (t.effective_to IS NULL OR t.effective_to >= CURRENT_DATE())`,
        [Number(companyId), Number(integrationProductId)],
      );
      if (rows.length !== 1) return null;
      return {
        gstRatePercent: Number(rows[0].gst_rate_percent),
        active: Boolean(rows[0].active),
      };
    },
    async sellerState({ companyId }) {
      const [rows] = await connection.query(
        "SELECT business_state FROM company_settings WHERE company_id = ? LIMIT 1",
        [Number(companyId)],
      );
      return String(rows[0]?.business_state || "").trim() || null;
    },
  });
}

module.exports = {
  FUTURE_EXECUTE_OPERATION,
  ReferenceAuthorityError,
  roundMoney,
  calculateGstAllocation,
  buildQuantityOneExecutionPayload,
  loadV1DurableSnapshot,
  createV1EvidenceBridge,
  executionPayloadDigest,
  createWebsiteSaleReferenceAuthority,
  createMysqlReferenceAuthority,
};
