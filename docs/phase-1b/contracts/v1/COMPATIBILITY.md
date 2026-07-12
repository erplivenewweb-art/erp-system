# V1 Compatibility Policy

## Classification

| Change | V1 compatible? | Rule |
|---|---:|---|
| Add optional response field | Yes | Tolerant readers must ignore it |
| Add capability or error code | Yes | Unknown values fail safely |
| Add enum member | Conditional | Consumers must map unknown to a safe fallback |
| Add optional request field | Yes | Servers ignore unsupported optional fields only when documented |
| Make optional field required | No | Requires v2 |
| Remove/rename/change meaning | No | Requires v2 |
| Change money, timestamp, unit, ID, or visibility semantics | No | Requires v2 |
| Expose ERP/internal data | Never | Prohibited in every version |

Schema version follows semantic versioning inside major contract v1. Patch changes clarify without changing validation; minor changes are additive. The canonical API major remains `/commerce/v1`. Compatibility validation compares schemas and rejects removed definitions/properties, new required fields, narrowed types/ranges, or changed constants.

## Consumer rules

Clients use opaque IDs, decimal strings, UTC timestamps, capability checks, and unknown-enum fallbacks. They must not infer availability quantity, parse ID prefixes for authorization, cache a quote past expiry, or equate commerce order state with ERP operational state.

