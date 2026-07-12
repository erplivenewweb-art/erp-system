# Image and Media Strategy

Hero: 16:9 desktop art direction, 4:5 or 3:4 mobile crop with protected text-safe area. Collection/lifestyle/workshop/packaging: editorial 4:5 and 3:2 masters. Product primary: consistent 4:5 neutral field; details 1:1/4:5; optional scale/context image clearly labeled. Never composite misleading scale, color, purity or included packaging.

Product set: front/three-quarter, side, detail, clasp/fit where relevant, scale/context, packaging and approved material mark. Workshop/artisan imagery requires consent, truthful captions and safety/privacy review.

Assets live in object storage/CDN, not MySQL. Keep original archival master; generate AVIF, WebP and JPEG fallback with responsive widths roughly 320/480/768/1024/1440/1920 as needed. Use quality by visual inspection, strip unnecessary metadata, preserve correct color profile and avoid sharpening halos.

Reserve intrinsic width/height/aspect ratio. Hero/LCP image is prioritized and not lazy-loaded; below-fold media uses native lazy loading and responsive `srcset/sizes`. Posters precede video; video never autoplays with sound. Alt text describes decision-relevant visual information; decorative images use empty alt. CDN URLs are content-addressed/versioned with rights/usage metadata.

