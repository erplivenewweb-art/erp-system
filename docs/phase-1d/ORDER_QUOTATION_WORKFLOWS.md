# Order and Quotation Workflows

B2C/B2B direct order: STAGED → VALIDATING → AWAITING_PAYMENT or READY_FOR_CONVERSION → CONVERTING → ACCEPTED_BY_ERP → COMPLETED. Failure is recoverable only through reconciled idempotent retry; cancellation is policy-gated. Payment has independent pending/authorized/captured/failed/refunded states. Fulfilment has unallocated/packing/dispatched/delivered/failure/RTO/returned states.

Quotation: DRAFT/REQUESTED → UNDER_REVIEW → OFFERED → REVISION_REQUESTED → OFFERED → ACCEPTED or REJECTED/EXPIRED/CANCELLED → CONVERTED. Each revision is immutable. Accept requires current dealer approval, version, quote validity and idempotency. Custom size/design enquiries follow review/quoted/approved/rejected/cancelled/conversion states without implying manufacture.

Orders and quotations snapshot descriptions, options, prices, discounts, taxes, addresses, currency, quantity, terms and revision. Catalogue edits never rewrite history. Return/refund requests are commerce workflow intents; ERP/provider authority determines eligibility and financial/stock action.

