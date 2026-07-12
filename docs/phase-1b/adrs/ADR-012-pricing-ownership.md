# ADR-012: Pricing Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Retail, wholesale, taxes, and negotiated prices have different authority and sensitivity.

## Problem

Persisting operational prices in clients or mixing cost with sell price risks leakage and inconsistency.

## Decision

ERP owns GST, billing calculations and authoritative operational inputs. Commerce pricing service produces expiring customer-safe PriceQuote results for actor, channel, quantity and currency; commerce owns display/marketing price presentation only. Never expose cost or formula inputs.

## Alternatives

Static prices in catalogue; client-side calculation; direct ERP price fields.

## Consequences

Quotes require refresh and server validation; personalized pricing remains protected.

## Future impact

Supports export currencies, marketplace fees, promotions and negotiated dealer prices by extension.

