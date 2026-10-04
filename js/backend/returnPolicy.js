"use strict";

function toAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateReturnRefundAllocation({
  returnAmount,
  invoiceTotal,
  dueAmount,
  cashSettledAmount,
  metalSettledValue,
  metalGrossIn,
  hasCashSettlement,
  hasMetalSettlement
} = {}) {
  const cleanReturnAmount = Math.max(toAmount(returnAmount), 0);
  const cleanInvoiceTotal = Math.max(toAmount(invoiceTotal), 0);
  const cleanDueAmount = Math.max(toAmount(dueAmount), 0);
  const cleanCashSettledAmount = Math.max(toAmount(cashSettledAmount), 0);
  const cleanMetalSettledValue = Math.max(toAmount(metalSettledValue), 0);
  const cleanMetalGrossIn = Math.max(toAmount(metalGrossIn), 0);
  const cashSettlementExists = Boolean(hasCashSettlement) || cleanCashSettledAmount > 0;
  const metalSettlementExists = Boolean(hasMetalSettlement) || cleanMetalGrossIn > 0;
  const refundModeHint = cashSettlementExists && metalSettlementExists
    ? "MIXED"
    : metalSettlementExists
      ? "METAL"
      : cashSettlementExists
        ? "CASH"
        : "UNKNOWN";
  const returnRatio = cleanInvoiceTotal > 0
    ? Math.min(Math.max(cleanReturnAmount / cleanInvoiceTotal, 0), 1)
    : 0;

  return {
    estimatedRefundCashAmount: refundModeHint === "METAL"
      ? 0
      : Math.max(cleanReturnAmount - cleanDueAmount, 0),
    estimatedRefundMetalWeight: metalSettlementExists ? cleanMetalGrossIn * returnRatio : 0,
    refundModeHint,
    estimatedReturnAmount: cleanReturnAmount,
    settlementAllocation: {
      cashSettledAmount: cleanCashSettledAmount,
      metalSettledValue: cleanMetalSettledValue,
      metalGrossIn: cleanMetalGrossIn,
      dueAmount: cleanDueAmount,
      invoiceTotal: cleanInvoiceTotal,
      returnRatio
    }
  };
}

function getInitialRefundPayableStatus(refundCashAmount, refundMetalWeight) {
  return toAmount(refundCashAmount) <= 0.009 && toAmount(refundMetalWeight) <= 0.0005
    ? "SETTLED"
    : "OPEN";
}

module.exports = {
  calculateReturnRefundAllocation,
  getInitialRefundPayableStatus
};
