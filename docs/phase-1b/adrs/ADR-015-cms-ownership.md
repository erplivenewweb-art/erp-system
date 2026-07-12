# ADR-015: CMS Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Homepage and product stories change independently from operations.

## Problem

Editing marketing content through ERP couples releases and permissions.

## Decision

Commerce CMS owns homepage composition, campaigns, stories, navigation and localized marketing content; references catalogue entities by opaque commerce ID and respects publication gates.

## Alternatives

Hard-code storefront; add CMS tables to ERP; external CMS as sole system without contract.

## Consequences

Preview, moderation and cache invalidation are needed; marketing can operate independently.

## Future impact

Headless delivery supports mobile, marketplaces and regional sites.

