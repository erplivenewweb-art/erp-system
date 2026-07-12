# Animation Guidelines

Hero enters once with opacity/short translate; no forced video or parallax. Cards use small image/underline response, not zoom that clips detail. Gallery transitions follow user action and preserve position. Navigation opens under 240ms with focus movement after visibility. Loading uses static skeleton/pulse; shimmer is disabled for reduced motion.

Success confirms hierarchy; errors do not shake/flash. Page transitions never delay navigation or scroll-jack. Reduced-motion removes translation, carousel auto-advance and decorative loops.

Budget: control feedback ≤160ms, standard transition ≤240ms, editorial reveal ≤420ms; maximum two simultaneous properties; transform/opacity only for frequent animation; no continuous animation in primary commerce views; animation script adds no dedicated large dependency. INP remains ≤200ms.

