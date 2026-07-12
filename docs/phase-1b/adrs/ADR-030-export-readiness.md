# ADR-030: Export Readiness

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

International trade adds locale, currency, units and regulatory data.

## Problem

Assuming India-only formats in public contracts would require breaking changes.

## Decision

V1 uses ISO 4217 currency, BCP 47 locale, ISO 3166 country, UTC RFC 3339 timestamps, decimal strings, explicit units, localized content arrays and extensible tax/duty summaries. GST remains ERP-owned; export compliance decisions remain a future approved service.

## Alternatives

Hard-code INR/en-IN; duplicate export API; numeric floating money.

## Consequences

More explicit fields and validation; no claim of current export capability.

## Future impact

Duties, Incoterms, HS classifications and regional policies can be additive governed extensions.

