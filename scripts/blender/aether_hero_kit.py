"""AETHER hero building kit: Blender-built architecture for the homepage flight hero.

Run (Blender 4.2+ / 5.x):
  blender -b --factory-startup --python scripts/blender/aether_hero_kit.py -- public/models/hero [--previews]

Output: aether-hero-kit.glb. Each building is a `<name>_body` mesh (vertex-coloured, tinted per
world in the browser) plus a `<name>_glow` mesh (lit bands, edges and crowns, given each
world's emissive colour), all with their origin at the base centre so the web lanes can
instance and scale them. Units are the hero scene's units (the drone flies at y ≈ 1.2).

  World 01 (Sky)   mirage_spire_a/b/c  faceted, twisting glass spires with crystal crowns
                   mirage_terrace      stepped low-rise block with planted terraces
  World 02 (Flow)  grid_tower_a/b/c    dark setback skyscrapers with neon fins and edges
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from aether_intro import Bucket, chamfer_rect, ellipse, material, realise, rect, scale_poly  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS and not ARGS[0].startswith("--") else ".")
rng = random.Random(2910)
scene = bpy.context.scene

GLASS = (0.42, 0.46, 0.55)
PALE = (0.96, 0.95, 0.97)
SLAB = (0.82, 0.8, 0.84)
DARK = (0.06, 0.07, 0.11)
STEEL = (0.18, 0.2, 0.26)
GREEN = (0.45, 0.72, 0.42)


def rotate(poly, angle):
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - y * s, x * s + y * c) for x, y in poly]


def banded(body, glow, poly, z0, z1, floor, glass, spandrel, lit=0.3, inset=0.97):
    """Facade as alternating spandrel / recessed glass bands; some floors lit."""
    body.prism(poly, z0, z1, spandrel)
    z = z0 + floor * 0.25
    while z + floor * 0.55 < z1:
        band = scale_poly(poly, 1.012)
        body.prism(band, z, z + floor * 0.55, glass)
        if rng.random() < lit:
            glow.prism(scale_poly(poly, 1.016), z + floor * 0.12, z + floor * 0.42)
        z += floor


def fins(body, poly, z0, z1, spacing, depth, colour):
    """Vertical mullion fins standing proud of each facade."""
    n = len(poly)
    for i in range(n):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
        length = math.hypot(bx - ax, by - ay)
        if length < spacing:
            continue
        nx, ny = (by - ay) / length, -(bx - ax) / length  # outward for CCW polygons
        count = int(length // spacing)
        for k in range(1, count):
            t = k / count
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            w = 0.035
            tx, ty = (bx - ax) / length * w, (by - ay) / length * w
            fin = [
                (px - tx, py - ty),
                (px + tx, py + ty),
                (px + tx + nx * depth, py + ty + ny * depth),
                (px - tx + nx * depth, py - ty + ny * depth),
            ]
            body.prism(fin[::-1], z0, z1, colour, cap=body, cap_col=colour)  # CCW winding


def edges(glow, poly, z0, z1, width=0.05):
    """Glowing vertical strips on each corner."""
    for x, y in poly:
        glow.box(x - width, y - width, z0, x + width, y + width, z1)


def crown_cap(body, glow, poly, z, height, colour):
    """Faceted crystal crown: each footprint edge rises to an apex, with glowing ridges."""
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    apex = (cx, cy, z + height)
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        body.face([(a[0], a[1], z), (b[0], b[1], z), apex], None, colour)
        glow.tube((a[0], a[1], z), apex, 0.03, 4, caps=False)


def spire(name, sides, width, tiers, twist, crown, seed):
    """World 01: tapering, twisting faceted tower; reads crystalline but is clearly architecture."""
    global rng
    rng = random.Random(seed)
    body, glow = Bucket(f"{name}_body"), Bucket(f"{name}_glow")
    base = ellipse(0, 0, width / 2, width / 2, sides, math.pi / sides)
    # podium
    podium = scale_poly(base, 1.35)
    body.prism(podium, 0, 0.9, SLAB, cap=body, cap_col=SLAB)
    glow.prism(scale_poly(podium, 1.004), 0.55, 0.62)
    z = 0.9
    poly = base
    angle = 0.0
    for i, h in enumerate(tiers):
        banded(body, glow, poly, z, z + h, 0.62, GLASS, PALE, lit=0.22)
        edges(glow, poly, z, z + h, 0.03)
        nxt = rotate(scale_poly(poly, 0.82), twist)
        body.prism(poly, z + h, z + h + 0.12, SLAB, cap=body, cap_col=SLAB)  # setback terrace
        glow.prism(scale_poly(poly, 1.01), z + h + 0.12, z + h + 0.18)
        z += h + 0.12
        poly = nxt
        angle += twist
    crown_cap(body, glow, poly, z, crown, PALE)
    glow.tube((0, 0, z + crown), (0, 0, z + crown + 1.4), 0.025, 4)
    return body, glow


def terrace(name, w, d, steps, seed):
    """World 01 low-rise: stepped block with planted terraces (replaces the plain mesas)."""
    global rng
    rng = random.Random(seed)
    body, glow = Bucket(f"{name}_body"), Bucket(f"{name}_glow")
    z = 0.0
    for i in range(steps):
        sw, sd = w * (1 - i * 0.16), d * (1 - i * 0.16)
        poly = chamfer_rect(0, 0, sw, sd, min(sw, sd) * 0.08)
        h = 1.25
        banded(body, glow, poly, z, z + h, 0.62, GLASS, PALE, lit=0.35)
        top = z + h + 0.08
        body.prism(poly, z + h, top, SLAB, cap=body, cap_col=SLAB)
        if i < steps - 1:
            # planters on the front and back strips the next, smaller step leaves exposed
            nw, nd = w * (1 - (i + 1) * 0.16), d * (1 - (i + 1) * 0.16)
            for sign in (-1, 1):
                y0, y1 = sorted((sign * (sd / 2 - 0.15), sign * (nd / 2 + 0.12)))
                body.box(-nw / 2, y0, top, nw / 2, y1, top + 0.22, GREEN)
                glow.box(-nw / 2, sign * (sd / 2 - 0.1) - 0.02, top, nw / 2, sign * (sd / 2 - 0.1) + 0.02, top + 0.3)
        z = top
    return body, glow


def grid_tower(name, w, d, tiers, seed):
    """World 02: dark glass skyscraper with neon mullion fins, edge lights and an antenna."""
    global rng
    rng = random.Random(seed)
    body, glow = Bucket(f"{name}_body"), Bucket(f"{name}_glow")
    z = 0.0
    sw, sd = w, d
    for i, h in enumerate(tiers):
        poly = chamfer_rect(0, 0, sw, sd, min(sw, sd) * 0.12)
        body.prism(poly, z, z + h, DARK, cap=body, cap_col=STEEL)
        # recessed window grid reads as dark glass; neon floor lines every few storeys
        f = z + 0.8
        while f < z + h - 0.3:
            glow.prism(scale_poly(poly, 1.008), f, f + 0.035)
            f += 0.8 * rng.choice((2, 3))
        fins(body, poly, z + 0.2, z + h - 0.15, 0.45, 0.07, STEEL)
        edges(glow, poly, z, z + h, 0.04)
        glow.prism(scale_poly(poly, 1.01), z + h - 0.12, z + h)
        z += h
        sw, sd = sw * 0.78, sd * 0.78
    body.box(-sw * 0.3, -sd * 0.3, z, sw * 0.3, sd * 0.3, z + 0.6, STEEL)
    body.tube((0, 0, z + 0.6), (0, 0, z + 3.2), 0.05, 6, STEEL)
    glow.box(-0.08, -0.08, z + 3.2, 0.08, 0.08, z + 3.4)
    return body, glow


def build():
    col = bpy.data.collections.new("AETHER_HeroKit")
    scene.collection.children.link(col)
    body_mat = material("kit_body", (1, 1, 1), rough=0.32, metal=0.25)
    # Show the vertex colours in Blender renders too (the web reads them from COLOR_0).
    nt = body_mat.node_tree
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    nt.links.new(attr.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    glow_mat = material("kit_glow", emit=(1, 1, 1), strength=2, vcol=False)
    parts = [
        spire("mirage_spire_a", 8, 2.6, [5.0, 3.6, 2.4], math.radians(11), 2.4, 1),
        spire("mirage_spire_b", 6, 3.0, [3.8, 3.0, 2.2, 1.4], math.radians(-15), 1.8, 2),
        spire("mirage_spire_c", 12, 2.2, [7.0, 4.0], math.radians(8), 3.2, 3),
        terrace("mirage_terrace", 11.0, 7.5, 4, 4),
        grid_tower("grid_tower_a", 2.6, 2.6, [9.0, 5.0, 3.0], 5),
        grid_tower("grid_tower_b", 3.4, 2.4, [6.0, 4.0], 6),
        grid_tower("grid_tower_c", 2.2, 2.2, [13.0, 4.5], 7),
    ]
    objs = []
    for body, glow in parts:
        objs.append(realise(body, body_mat, col))
        objs.append(realise(glow, glow_mat, col))
    return objs


def export(objs):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT, "aether-hero-kit.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_color_quantization=8,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
    print("EXPORTED", path, os.path.getsize(path), "TRIANGLES", tris)


def previews(objs):
    """Contact render of the kit lined up, for checking the models in Blender itself."""
    x = 0.0
    bodies = [o for o in objs if o.name.endswith("_body")]
    for body in bodies:
        glow = bpy.data.objects[body.name.replace("_body", "_glow")]
        width = max(v.co.x for v in body.data.vertices) - min(v.co.x for v in body.data.vertices)
        x += width / 2 + 1.5
        body.location.x = glow.location.x = x
        x += width / 2
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.location = (x / 2, -70, 11)
    cam.rotation_euler = (math.radians(86), 0, 0)
    cam.data.lens = 35
    scene.camera = cam
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.3, 0.55, 1)
    scene.world = world
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in scene.render.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 1600, 700
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(OUT, "kit-preview.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", scene.render.filepath)


objs = build()
export(objs)
if "--previews" in ARGS:
    previews(objs)
