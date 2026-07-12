# ADR-017: B2B Architecture

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Dealers require approval, MOQ, negotiated pricing, quotes and credit terms from day one.

## Problem

Adding dealer fields later would break product, pricing and identity models.

## Decision

B2B is a first-class channel in v1 with dealer organization identity, approval, category/level, entitlements, wholesale visibility, MOQ, price breaks, dealer-special prices, quotations, credit terms, bulk/repeat orders and dealer analytics scopes.

## Alternatives

Future B2B retrofit; separate incompatible API; customer role flag.

## Consequences

More v1 contract breadth and policy testing; no later foundational redesign.

## Future impact

Multi-user dealers, territory policies and distributors extend existing organization concepts.

