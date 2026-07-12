# ADR-027: Deployment Boundaries

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

ERP uptime must not depend on storefront releases or traffic.

## Problem

Co-deployment shares failures, secrets and scaling limits.

## Decision

ERP, ERP Integration API, Commerce API, storefronts, workers, search, CMS/media and identity are independently deployable with separate credentials and health checks. Networks allow Commerce-to-Integration only through authenticated policy. No commerce artifact changes ERP Railway/Nixpacks.

## Alternatives

Single Railway service; shared process; shared database credentials.

## Consequences

Operational overhead rises; independent scaling, rollback and incident containment improve.

## Future impact

Regional storefront/API edges and specialized workers can be added safely.

