# Checkout Flow

```mermaid
stateDiagram-v2
  [*] --> CART
  CART --> VALIDATING
  VALIDATING --> ADDRESS
  ADDRESS --> DELIVERY
  DELIVERY --> PAYMENT_INTENT
  PAYMENT_INTENT --> REVIEW
  REVIEW --> SUBMITTING
  SUBMITTING --> SUCCESS
  SUBMITTING --> PENDING
  SUBMITTING --> ERROR
  PENDING --> SUCCESS: reconciled
  PENDING --> ERROR: confirmed failure
  ERROR --> REVIEW: preserved state
```

