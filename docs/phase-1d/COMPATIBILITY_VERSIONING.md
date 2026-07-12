# Compatibility and Versioning

Paths carry immutable major version `v1`; contract metadata uses semantic `1.x.y`. Compatible changes add optional fields/endpoints/capabilities or safe enum members. Breaking changes include removal/rename, new required fields, narrowed validation, changed meaning/unit/ownership, changed auth or broader data exposure and require v2.

Major versions run in parallel through an approved migration window. Deprecation publishes release notes, `Deprecation`, `Sunset`, successor Link, telemetry and a manually approved minimum support period. Capability discovery is available publicly and internally.

Consumers use tolerant readers, ignore unknown optional fields and map unknown enums to a safe UNKNOWN/unsupported state without granting access. Providers preserve old semantics. Compatibility tests diff endpoint method/path/auth/schema/required fields/enums, replay approved examples and run negative sensitive-field/authorization cases.

