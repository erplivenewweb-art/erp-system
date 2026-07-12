# CMS, SEO and Media Model

Commerce owns pages, sections, immutable versions, navigation, blog, FAQ, announcements, campaign landing pages, redirects and SEO metadata. Publication and visibility are evaluated by company/storefront, locale, channel, audience and schedule.

MediaAsset stores object-storage key, MIME type, dimensions/duration, checksum, rights/provenance, uploader actor, moderation and lifecycle—not binary content. MediaVariant stores responsive transformations. MediaUsage links an asset to a product/CMS/review placement with alt text, crop, locale and ordering. Public delivery uses CDN URLs generated from approved published assets.

Large image/video binaries and raw dealer documents never live in MySQL. Upload ownership, malware scanning, EXIF stripping, rights expiry, AI provenance, retention and deletion propagation require provider/security approval.

