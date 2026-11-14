# Restored concept globe

Globe has three views: Radar observations (`satellite`), Land through time (`concept`, preserved for existing links), and Concept globe (`illustrative`). For example: `#globe?mode=illustrative&site=angat`. Radar dates and vegetation months remain independent when switching modes. Concept progression is illustrative and has no observation date.

## Historical source

- `babe2a0` / `85a7427`: standalone prototype in `index.html.html`, renamed to `index.html`; includes phase-responsive towers and rings.
- `eca7d64`: extracted globe, styles, loader, canvas renderer and satellite window.
- `ad79b36`: React page integration.
- `1b0b67c`: radar and concept mode switcher.
- `5c3198f`: last complete concept implementation, used as the restoration baseline.
- `8fcf9de`: replaced that concept view with monthly vegetation and climate context.

The restored code lives in `src/illustrative-globe.js`, `src/components/IllustrativeGlobe.tsx` and `src/illustrative-globe.css`. `world.js` continues to own the shared renderer, camera, visibility and graphics recovery. Existing country geometry, place index, study sites and news data are reused. No historical observation files or current renderer fixes are rolled back.

## Animation and lifecycle

The concept view includes automatic rotation, moving dashed Pacific links, expanding/fading rings, changing country colors and elevations, phase-responsive towers and ring radii, and animated camera/zoom/tour movement. The canvas fallback animates links, rings and rotation and displays the conceptual layers without WebGL. Its polygons are projected flat rather than extruded in 3D.

Progression runs from 0 to 100 in about 15 seconds and stops at the end; pressing Play at the end restarts it. Switching view, navigating away, hiding the document or scrolling the globe out of view pauses playback. Reduced motion disables automatic rotation, rings, moving dashes and camera transitions; manual phase selection and explicit Play remain available. The mobile globe stays visible while scrolling its controls.

The optional MODIS image is explicitly dated, abortable and isolated from the radar and vegetation textures. Failures leave the concept view available. The standalone HTML includes the concept view and its animations; online imagery remains unavailable offline.

## Validation

With the frontend running on port 5174:

```sh
npm run test:illustrative-globe
npm run test:globe-display
npm run test:globe-performance
```

The concept browser check covers visible animation, layers, overlays, phase playback, search, satellite window, tour, all three modes, history, optional imagery, reduced motion, WebGL recovery, animated canvas fallback and mobile controls. Set `CHECK_OFFLINE=1` after `npm run demo` to include the generated standalone edition. Screenshots are saved in `.artifacts/`.
