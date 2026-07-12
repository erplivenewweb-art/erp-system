# Design Token Implementation

Canonical source will be one reviewed commerce token package derived from Phase 2A/2C JSON—not duplicated files. Layers: primitive → semantic → component → responsive/motion/typography. Semantic roles map light, dark, festival and seasonal modes. Component code consumes semantic/component tokens only.

A future build tool validates unique names/types/references, contrast pair policy, forbidden festival overrides and theme completeness; then generates typed TypeScript names, CSS custom properties, design-tool export and documentation. Generated outputs are immutable and marked generated. CI fails on hand edits or drift.

Build time supplies base/light values and critical CSS. Runtime switches only an approved theme attribute/cookie; server reads it to avoid flash. Festival themes override an allowlist and automatically expire. No token value is hard-coded in component modules except documented exceptional media art direction.

