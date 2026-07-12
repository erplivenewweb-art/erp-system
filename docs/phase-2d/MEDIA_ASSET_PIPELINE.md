# Media and Asset Pipeline

Masters live in object storage with CDN delivery; MySQL stores metadata/references only. CMS upload validates MIME/magic bytes, size/dimensions/duration, malware, EXIF/privacy, checksum, rights, ownership and duplicate hash.

Product 4:5, hero 16:9 plus mobile 4:5, collection/lifestyle/workshop/packaging/macro art-direction sources generate AVIF, WebP and JPEG fallbacks at approved widths. LCP media is explicitly preloaded/high priority; below-fold lazy loads; dimensions/aspect prevent CLS; blur/color placeholders contain no sensitive source.

Video/reels/360 use poster, adaptive delivery where chosen, captions/transcripts and static fallback. Icons/logos use approved vector/raster exports; fonts self-host WOFF2 with licenses/glyph tests. File keys are content-addressed/opaque, not user filenames. CDN cache is immutable by version; CMS publish swaps references and purges tags, not overwrites binaries.

