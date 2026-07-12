# ADR-018: Dealer Approval Workflow

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Dealer access depends on verified business evidence and controlled entitlements.

## Problem

Automatic activation could expose wholesale catalogue, pricing, or credit.

## Decision

State machine: DRAFT, SUBMITTED, UNDER_REVIEW, INFORMATION_REQUIRED, APPROVED, REJECTED, SUSPENDED, REVOKED. GST/business evidence is encrypted and minimized; human decisions require reason, actor and audit event. Approval grants explicit catalogue/pricing/credit scopes, not blanket access.

## Alternatives

Immediate approval; boolean approved flag; ERP employee account creation.

## Consequences

Manual workload and retention obligations; defensible, reversible access.

## Future impact

Automated verification may recommend but cannot silently broaden entitlements.

