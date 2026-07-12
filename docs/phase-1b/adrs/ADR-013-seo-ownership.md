# ADR-013: SEO Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Search discovery requires channel content not present in ERP.

## Problem

ERP fields cannot safely or effectively drive canonical pages.

## Decision

Commerce owns canonical URLs, slugs, titles, descriptions, structured-data projections, redirects, locale alternates, sitemap inclusion and indexability. Publication and visibility gates SEO emission.

## Alternatives

ERP owns SEO; client-generated metadata only; external CMS owns all URLs.

## Consequences

SEO governance and redirect history are needed; ERP remains unaffected.

## Future impact

Localized/export sites and app links can share canonical entity metadata.

