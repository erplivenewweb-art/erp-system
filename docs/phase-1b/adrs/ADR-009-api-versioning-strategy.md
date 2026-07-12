# ADR-009: API Versioning Strategy

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Many clients and integrations evolve independently.

## Problem

Breaking changes could strand storefront, dealer, mobile, and partner clients.

## Decision

Use immutable major versions in media type and canonical path /commerce/v1; additive optional fields and enum values are compatible. Deprecations use Sunset/Deprecation headers and a published window. Breaking semantic or required-field changes require v2.

## Alternatives

Unversioned API; date-only versions; query parameter versions.

## Consequences

Some duplicated handlers/contracts; predictable compatibility and rollback.

## Future impact

Capabilities metadata and tolerant readers permit gradual channel upgrades.

