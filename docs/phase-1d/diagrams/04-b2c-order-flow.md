# B2C Order Flow

```mermaid
stateDiagram-v2
  [*] --> CART
  CART --> PREVIEW: revalidate price/availability
  PREVIEW --> STAGED: Idempotency-Key
  STAGED --> VALIDATING
  VALIDATING --> AWAITING_PAYMENT
  AWAITING_PAYMENT --> READY_FOR_CONVERSION: payment confirmed
  READY_FOR_CONVERSION --> CONVERTING
  CONVERTING --> ACCEPTED_BY_ERP: future adapter
  CONVERTING --> FAILED: safe recoverable failure
  ACCEPTED_BY_ERP --> COMPLETED
```

