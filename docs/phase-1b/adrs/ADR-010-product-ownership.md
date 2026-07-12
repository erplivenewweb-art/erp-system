# ADR-010: Product Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

ERP operational item data and commerce merchandising differ.

## Problem

A single mutable product record would blur authoritative operational facts and customer storytelling.

## Decision

ERP owns operational product facts including weight, purity, size, manufacturing and physical barcode association. Commerce owns customer-safe product design projections, stories, taxonomy links, slugs, SEO, media links, visibility and publication. Opaque source references are mapping-only.

## Alternatives

Commerce masters all products; ERP record exposed directly; duplicate unconstrained masters.

## Consequences

Reconciliation and projection freshness are required; ownership is unambiguous.

## Future impact

New channel-specific merchandising can grow without changing ERP stock records.

