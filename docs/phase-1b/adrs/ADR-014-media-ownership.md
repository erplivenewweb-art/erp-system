# ADR-014: Media Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Commerce needs optimized images and video while ERP should not serve public assets.

## Problem

Binary media in ERP or public access to internal images creates performance and confidentiality risks.

## Decision

Commerce owns asset metadata, rights, alt text, ordering, transformations and CDN delivery. Objects use opaque IDs and signed upload workflows; public delivery occurs only for published assets.

## Alternatives

Store binaries in ERP DB; third-party URLs without governance; embed base64.

## Consequences

Requires storage/CDN and rights lifecycle; enables safe optimization.

## Future impact

AR assets, 3D, marketplace renditions and AI provenance can be added by media type.

