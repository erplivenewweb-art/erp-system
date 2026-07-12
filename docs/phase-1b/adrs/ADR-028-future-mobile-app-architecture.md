# ADR-028: Future Mobile App Architecture

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Mobile clients have long upgrade cycles and untrusted storage.

## Problem

Web-only contracts or cookies would force redesign and weaken auth.

## Decision

Native apps consume the same /commerce/v1 resources using OIDC authorization code with PKCE, short-lived tokens, secure OS storage, universal links and capability discovery. Push uses opaque notification references and fetch-on-open.

## Alternatives

Embed website only; mobile-specific backend; ERP token in app.

## Consequences

Contract compatibility windows must be longer; channel parity improves.

## Future impact

Offline catalogue caches and device attestation can be added without changing domain ownership.

