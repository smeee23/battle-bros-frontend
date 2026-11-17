# Endless celestial scale

The Endless backdrop preserves the shared Ethereum crystal and existing ring palette. Its logo dimensions and distance are multiplied by four together, retaining approximately the same ground-level framing while reducing altitude parallax. The decorative ring continuation shares that scale. Gameplay islands, generated terrain, streaming radius, drift, collisions and player movement are unchanged.

A single instanced mesh supplies seven bands of deterministic faceted fragments, extending in front of and around both sides of the observer. The bands sit 26 units lower than the original placement and avoid a 140-unit gap around the player. They have no terrain cells, colliders or simulated motion. The flat lanes meet the same average top plane. Matching the solid material’s color-space handling to the dim flat-ring palette, plus distance-based color dimming soften the transition from intact solid fragments to the translucent lanes while retaining opaque depth testing. Surface pixels are never discarded for fading, and only small intentional breaks separate neighboring fragments. Geometry and instance transforms are built once and reused on re-entry; altitude only updates the parent transform.


Vertical compensation starts smoothly above 12 world units. For excess height h, the backdrop offset is `0.35*h*h/(h+40)`. This keeps mountain-scale movement natural and reduces the effect of extreme builds while retaining at least 65% of vertical motion relative to the backdrop. `CELESTIAL` near the start of the exploration terrain implementation centralizes these presentation settings.

The existing PerspectiveCamera far plane expands to at least 5000 only while in Endless World, then restores its previous value. Near clipping, FOV and the render pipeline remain unchanged. Stars retain their angular pattern and pixel size, at radius 4300, behind the celestial geometry.

`node tools/endless-backdrop.test.js` checks ground-level framing, view angles, actual ray intersections against the lower logo, the open upper silhouette, heights through 800 units, smooth partial compensation, bounded/cached instances, clipping and camera restoration. These are geometry checks; final artistic tuning should also be reviewed at ground level, a mountain peak and a tall build in the browser.
