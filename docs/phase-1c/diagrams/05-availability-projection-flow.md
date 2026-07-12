# Availability Projection Flow

```mermaid
sequenceDiagram
  participant ERP as ERP inventory
  participant IA as Integration adapter
  participant C as Commerce projection worker
  participant DB as Commerce availability cache
  participant U as Channel
  ERP-->>IA: Customer-safe status fact
  IA-->>C: Versioned projection event/response
  C->>DB: Upsert status, last_synced_at, expiry
  U->>DB: Read scoped availability
  alt fresh
    DB-->>U: IN_STOCK / LOW_STOCK / MADE_TO_ORDER / OUT_OF_STOCK
  else stale or sync failed
    DB-->>U: UNKNOWN or UNAVAILABLE; checkout/order validation blocked
  end
```

