# System Data Ownership

```mermaid
flowchart LR
  B2C["B2C storefront / mobile"] --> CAPI["Commerce API (future)"]
  B2B["Dealer portal / mobile"] --> CAPI
  CAPI --> CDB[("Commerce database")]
  CAPI --> IA["ERP Integration API (future)"]
  IA --> EDB[("ERP database")]
  EDB -->|"approved projections"| IA
  IA -->|"idempotent approved commands only"| EDB
  CDB -->|"opaque references only"| CAPI
  ERP["ERP employees"] --> EAPP["Existing ERP application"] --> EDB
```

Commerce owns customer/dealer identities, merchandising, carts, quotes and staged orders. ERP owns operational product facts, physical inventory, billing, GST, invoices, returns and staff identity. There is no direct Commerce-to-ERP database path.

