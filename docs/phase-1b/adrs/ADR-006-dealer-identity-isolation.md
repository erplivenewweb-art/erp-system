# ADR-006: Dealer Identity Isolation

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Dealers require business verification and commercial entitlements.

## Problem

Treating dealers as customers or employees confuses approval, GST, pricing, and credit access.

## Decision

Commerce owns dealer organization identities and dealer-user memberships separately from customer and ERP identities. Approval and entitlements are explicit, revocable, audited, and server-evaluated.

## Alternatives

Customer role flag; ERP employee users; one credential per dealer company.

## Consequences

More identity objects; correct organization-level access and delegated users.

## Future impact

Supports multiple buyers, approvers, territories, and marketplace partners.

