# ADR-001: Repository Boundaries

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

The production ERP and commerce capabilities have different change cadences and risk profiles.

## Problem

A shared runtime or source tree could let commerce changes regress protected ERP behavior.

## Decision

Keep the ERP repository boundary immutable. Phase 1B lives only in docs/phase-1b. Future storefront, commerce API, and ERP Integration API are independently owned deployables and repositories or top-level projects after approval.

## Alternatives

A monorepo with shared runtime; adding commerce to js/backend/server.js; direct database integration.

## Consequences

More deployments and contract governance are required, but blast radius, credentials, and ownership are clear.

## Future impact

Mobile, marketplaces, AI, and export adapters consume versioned commerce contracts without importing ERP code.

