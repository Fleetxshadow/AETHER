The city and drone in the site's scroll scenes are original procedural Three.js geometry, generated locally in src/components/scenes.

`intro/` holds the opening film's assets, built procedurally in Blender by `scripts/blender/aether_intro.py` (Blender 4.2+ / 5.x, deterministic seed) and exported as Draco-compressed glTF with WebP textures:

- `aether-city.glb`: a city inspired by Gurugram (arterial with an elevated metro, office towers, group housing, plotted low-rise), the director camera, illustrative incident/route meshes and traffic lane data.
- `aether-drone.glb`: a conceptual Quad-X observation drone with its flight, propeller and gimbal animation.
- `intro-poster.webp`: an EEVEE still of the closing shot (loading backdrop, reduced-motion and no-WebGL fallback).

No downloaded models, textures, proprietary engineering files or asset licenses are involved. The geometry is illustrative: it is not a surveyed model of Gurugram and not a hardware-validated model of the AETHER prototype.
