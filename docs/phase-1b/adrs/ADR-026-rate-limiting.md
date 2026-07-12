# ADR-026: Rate Limiting

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Public search, login, quotes and integrations have different abuse profiles.

## Problem

A single limit either harms legitimate bulk use or leaves sensitive endpoints exposed.

## Decision

Layer limits by IP, anonymous token, customer, dealer organization, service client and endpoint risk. Use burst plus sustained quotas, Retry-After, safe 429 errors, bot defenses and stricter auth/quote controls. Never reveal account existence.

## Alternatives

One global limit; client-side throttling; unlimited approved dealers.

## Consequences

Distributed counters and exception governance are needed; abuse blast radius shrinks.

## Future impact

Marketplace and AI clients receive scoped quotas and asynchronous bulk patterns.

