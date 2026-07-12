# ADR-002: Storefront Isolation

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Public traffic, SEO rendering, and customer sessions have different threats from ERP employee workflows.

## Problem

A same-origin storefront could inherit ERP cookies, service-worker scope, routes, or static assets.

## Decision

Deploy storefronts on commerce-owned origins with separate builds, cookies, CSP, cache, service worker, and authentication. They call only the Commerce API.

## Alternatives

Serve from ERP root; extend the ERP service worker; embed storefront pages in existing HTML.

## Consequences

Extra DNS and cross-origin configuration; complete protection from ERP UI/cache coupling.

## Future impact

B2C, dealer portal, localized export sites, and mobile web can be isolated channels.

