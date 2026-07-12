# ADR-023: Analytics Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

ERP analytics and digital behavior have different data sensitivity.

## Problem

Sending operational or personal data into commerce analytics can leak protected facts.

## Decision

Commerce owns consent-aware channel events, funnels, search, catalogue and dealer-dashboard projections. ERP owns operational, accounting, manufacturing and branch analytics. Cross-domain metrics use approved aggregated exports with minimization and retention controls.

## Alternatives

One shared analytics warehouse immediately; expose ERP reports; unrestricted third-party trackers.

## Consequences

Some metrics are delayed or coarser; governance and consent improve.

## Future impact

A governed semantic layer can later support AI without raw ERP leakage.

