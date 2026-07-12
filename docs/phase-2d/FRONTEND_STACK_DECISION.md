# Final Frontend Stack Decision

## Decision

Use **Next.js App Router + React + TypeScript** for the separately deployed storefront. Use Server Components by default and Client Components only for interaction. No dependency is installed in Phase 2D.

| Option | Strength | Concern | Outcome |
|---|---|---|---|
| Next.js | SSR/static rendering, streaming, route layouts, metadata, caching/revalidation, React ecosystem | Cache complexity and platform discipline | Selected |
| React + Vite | Simple tooling and client apps | SSR/SSG/caching/routing require framework assembly; Vite calls SSR a low-level API | Rejected |
| Astro | Excellent content/islands and low JS | Unified authenticated B2C/B2B application requires more mixed-framework policy | Rejected |
| Nuxt | Strong universal/hybrid rendering and route rules | Vue stack switch and smaller team/ecosystem alignment assumption | Rejected |
| Separate content + app frameworks | Specialized optimization | Duplicated design/auth/routing/deployment | Rejected initially |

Official basis: Next.js documents server-rendered App Router navigation with prefetching/streaming, static/dynamic rendering and self-hosted streaming/caching. Vite describes its SSR API as low-level for framework authors. Nuxt documents capable hybrid route rules. Sources: https://nextjs.org/docs/app/getting-started/linking-and-navigating, https://nextjs.org/docs/app/guides/production-checklist, https://nextjs.org/docs/app/guides/self-hosting, https://vite.dev/guide/ssr, https://nuxt.com/docs/3.x/guide/concepts/rendering.

## Version policy

At Phase 3A approval, select the latest stable supported Next.js major after reviewing its upgrade/security notices, pin exact framework/React/TypeScript versions in the isolated storefront lockfile, and record a compatibility matrix. Do not use canary/experimental features for core commerce. Patch security updates are expedited; minor updates monthly after tests; major updates separately planned with dual-environment validation. Framework versions never share the ERP root package.

