"""AETHER intro scene — built procedurally in Blender, exported as glTF for the website.

Run (Blender 4.2+ / 5.x):
  blender -b --factory-startup --python scripts/blender/aether_intro.py -- public/models/intro [--poster] [--blend path]

Outputs:
  aether-city.glb   city inspired by Gurugram (not a surveyed model), director camera, FX anchors,
                    vehicle prototypes and traffic lanes (glTF extras)
  aether-drone.glb  Quad-X observation drone with flight, propeller and gimbal animation
  intro-poster.webp optional EEVEE still of the closing composition (fallback / loading backdrop)

The timeline is shared with the web overlay and the soundtrack: src/lib/intro-timeline.json.
Everything is deterministic (fixed seed) so the assets can be regenerated identically.
"""

import bisect
import json
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS and not ARGS[0].startswith("--") else ".")
POSTER = "--poster" in ARGS
BLEND = ARGS[ARGS.index("--blend") + 1] if "--blend" in ARGS else None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(ROOT, "src", "lib", "intro-timeline.json"), encoding="utf-8") as fh:
    TIMELINE = json.load(fh)
FPS = TIMELINE["fps"]
DURATION = TIMELINE["duration"]
CUE = TIMELINE["cues"]
FRAMES = int(round(DURATION * FPS))
rng = random.Random(20261028)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 0
scene.frame_end = FRAMES
scene.unit_settings.system = "METRIC"


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * t * (t * (t * 6 - 15) + 10)


def lerp(a, b, t):
    return a + (b - a) * t


# ───────────────────────── textures (numpy → packed images) ─────────────────────────


def image(name, rgba, alpha=False):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.pack()
    return img


def noise(size, scale, seed):
    r = np.random.default_rng(seed)
    out = np.zeros((size, size))
    for octave in range(4):
        n = max(2, size // (scale >> octave if scale >> octave else 1))
        g = r.random((n + 1, n + 1))
        idx = np.linspace(0, n, size, endpoint=False)
        i0 = idx.astype(int)
        f = idx - i0
        f = f * f * (3 - 2 * f)
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i0 + 1] * f[None, :]
        b = g[i0 + 1][:, i0] * (1 - f)[None, :] + g[i0 + 1][:, i0 + 1] * f[None, :]
        out += (a * (1 - f)[:, None] + b * f[:, None]) / (2**octave)
    return out / out.max()


def facade(size, bays, floors, kind, seed):
    """Returns (base, emissive) RGBA arrays for a repeating facade tile."""
    r = np.random.default_rng(seed)
    base = np.zeros((size, size, 4))
    emit = np.zeros((size, size, 4))
    base[..., 3] = emit[..., 3] = 1
    bw, fh = size // bays, size // floors
    grain = noise(size, 64, seed)[..., None] * 0.06
    yy, xx = np.mgrid[0:size, 0:size]
    for f in range(floors):
        # occupancy clusters by floor: offices light whole floors, homes scatter
        busy = r.random() > (0.7 if kind in ("glass", "office") else 0.85)
        for b in range(bays):
            y0, x0 = f * fh, b * bw
            lit = r.random() < (0.07 + (0.55 if busy else 0.0) + (0.1 if kind in ("resi", "lowrise") else 0.0))
            warm = r.random() < (0.55 if kind in ("glass", "office") else 0.8)
            level = 0.25 + r.random() * 0.6
            colour = np.array([1.0, 0.72, 0.42]) if warm else np.array([0.78, 0.88, 1.0])
            cell = (slice(y0, y0 + fh), slice(x0, x0 + bw))
            if kind == "glass":
                tint = np.array([0.06, 0.1, 0.13]) * (0.8 + r.random() * 0.5)
                base[cell][..., :3] = tint
                base[y0 : y0 + 5, x0 : x0 + bw, :3] = 0.16  # slab edge
                base[y0 : y0 + fh, x0 : x0 + 2, :3] = 0.34  # mullion
                if lit:
                    ramp = np.linspace(0.75, 1.0, fh - 6)[:, None, None]
                    emit[y0 + 6 : y0 + fh, x0 + 2 : x0 + bw, :3] = colour * level * ramp
            elif kind == "office":
                base[cell][..., :3] = np.array([0.5, 0.5, 0.48])
                g0, g1 = y0 + int(fh * 0.38), y0 + int(fh * 0.92)
                base[g0:g1, x0 : x0 + bw, :3] = np.array([0.07, 0.11, 0.12])
                base[g0:g1, x0 : x0 + 2, :3] = 0.3
                if lit:
                    emit[g0:g1, x0 + 2 : x0 + bw, :3] = colour * level
            else:  # residential plaster with recessed windows / balcony slabs
                base[cell][..., :3] = np.array([0.82, 0.78, 0.7])
                wx0, wx1 = x0 + int(bw * 0.22), x0 + int(bw * 0.78)
                wy0, wy1 = y0 + int(fh * 0.25), y0 + int(fh * 0.82)
                base[wy0:wy1, wx0:wx1, :3] = np.array([0.08, 0.09, 0.1])
                if kind == "resi" and b % 4 in (1, 2):
                    base[y0 : y0 + int(fh * 0.12), x0 : x0 + bw, :3] = 0.55  # balcony slab
                    base[y0 + int(fh * 0.12) : y0 + int(fh * 0.3), x0 : x0 + bw, :3] = 0.3
                if lit:
                    emit[wy0:wy1, wx0:wx1, :3] = colour * level * 0.9
    base[..., :3] = base[..., :3] * (1 - grain) + grain * 0.5
    return base, emit


def build_textures():
    tex = {}
    for kind, bays, floors, seed in (
        ("glass", 16, 8, 1),
        ("office", 16, 7, 2),
        ("resi", 8, 8, 3),
        ("lowrise", 4, 4, 4),
    ):
        b, e = facade(512 if kind != "lowrise" else 256, bays, floors, kind, seed)
        tex[kind] = (image(f"tx_{kind}", b), image(f"tx_{kind}_emit", e))
    n = noise(256, 32, 9)
    asphalt = np.zeros((256, 256, 4))
    asphalt[..., :3] = (0.11 + n * 0.06)[..., None]
    asphalt[..., 3] = 1
    tex["asphalt"] = image("tx_asphalt", asphalt)
    roof = np.zeros((256, 256, 4))
    roof[..., :3] = (0.36 + noise(256, 64, 11) * 0.14)[..., None]
    roof[::32, :, :3] *= 0.7
    roof[:, ::32, :3] *= 0.7
    roof[..., 3] = 1
    tex["roof"] = image("tx_roof", roof)
    pave = np.zeros((256, 256, 4))
    pave[..., :3] = (0.42 + noise(256, 16, 13) * 0.12)[..., None]
    pave[::16, :, :3] *= 0.75
    pave[:, ::16, :3] *= 0.75
    pave[..., 3] = 1
    tex["pave"] = image("tx_pave", pave)
    return tex


# ───────────────────────── materials ─────────────────────────


def material(name, colour=(1, 1, 1), rough=0.8, metal=0.0, tex=None, emit_tex=None, emit=None, strength=1.0, vcol=True):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    if tex:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = tex
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if emit_tex:
        e = nt.nodes.new("ShaderNodeTexImage")
        e.image = emit_tex
        nt.links.new(e.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = strength
    elif emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    m["vcol"] = vcol
    return m


# ───────────────────────── mesh buckets ─────────────────────────


class Bucket:
    """Accumulates faces with explicit UVs and corner colours; becomes one mesh per material."""

    def __init__(self, name):
        self.name, self.verts, self.faces, self.uvs, self.cols = name, [], [], [], []

    def face(self, pts, uvs=None, col=(1, 1, 1)):
        base = len(self.verts)
        self.verts.extend(tuple(p) for p in pts)
        self.faces.append(list(range(base, base + len(pts))))
        self.uvs.extend(uvs or [(0, 0)] * len(pts))
        c = col if len(col) == 4 else (*col, 1)
        self.cols.extend([c] * len(pts))

    def quad(self, a, b, c, d, col=(1, 1, 1), uv=((0, 0), (1, 0), (1, 1), (0, 1))):
        self.face([a, b, c, d], list(uv), col)

    def box(self, x0, y0, z0, x1, y1, z1, col=(1, 1, 1), uvscale=None, bottom=False):
        s = uvscale

        def uv(u0, v0, u1, v1):
            if not s:
                return ((0, 0), (1, 0), (1, 1), (0, 1))
            return ((u0 / s, v0 / s), (u1 / s, v0 / s), (u1 / s, v1 / s), (u0 / s, v1 / s))

        self.quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), col, uv(x0, z0, x1, z1))
        self.quad((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1), col, uv(y0, z0, y1, z1))
        self.quad((x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1), col, uv(x1, z0, x0, z1))
        self.quad((x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1), col, uv(y1, z0, y0, z1))
        self.quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), col, uv(x0, y0, x1, y1))
        if bottom:
            self.quad((x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0), col)

    def prism(self, poly, z0, z1, col=(1, 1, 1), tile=None, uoff=0.0, voff=0.0, cap=None, cap_col=None):
        """Extrudes a CCW footprint. Facade UVs are world-scaled so window grids stay consistent."""
        per = uoff
        n = len(poly)
        for i in range(n):
            (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
            length = math.hypot(bx - ax, by - ay)
            if length < 1e-4:
                continue
            if tile:
                u0, u1 = per / tile[0], (per + length) / tile[0]
                v0, v1 = (z0 + voff) / tile[1], (z1 + voff) / tile[1]
                uv = ((u0, v0), (u1, v0), (u1, v1), (u0, v1))
            else:
                uv = ((0, 0), (1, 0), (1, 1), (0, 1))
            per += length
            self.quad((ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1), col, uv)
        if cap is not None:
            cap.face([(x, y, z1) for x, y in poly], [(x / 16, y / 16) for x, y in poly], cap_col or col)

    def tube(self, p0, p1, r, seg=6, col=(1, 1, 1), caps=True):
        p0, p1 = Vector(p0), Vector(p1)
        axis = (p1 - p0).normalized()
        ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
        u = axis.cross(ref).normalized()
        v = axis.cross(u)
        ring0 = [p0 + (u * math.cos(a) + v * math.sin(a)) * r for a in [i * 2 * math.pi / seg for i in range(seg)]]
        ring1 = [p + (p1 - p0) for p in ring0]
        for i in range(seg):
            j = (i + 1) % seg
            self.quad(ring0[j], ring0[i], ring1[i], ring1[j], col)
        if caps:
            self.face(list(reversed(ring0)), None, col)
            self.face(ring1, None, col)

    def cylinder(self, cx, cy, z0, z1, r, seg=8, col=(1, 1, 1)):
        self.tube((cx, cy, z0), (cx, cy, z1), r, seg, col)

    def blob(self, c, r, col=(1, 1, 1), squash=1.0, seed=0):
        """Low-poly icosahedral canopy."""
        t = (1 + 5**0.5) / 2
        vs = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
        fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
        jr = random.Random(seed)
        pts = []
        for x, y, z in vs:
            k = r * (0.85 + jr.random() * 0.3) / math.sqrt(1 + t * t)
            pts.append((c[0] + x * k, c[1] + y * k, c[2] + z * k * squash))
        for f in fs:
            self.face([pts[i] for i in f], None, col)


OBJECTS = {}


def realise(bucket, mat, collection, smooth_shade=False):
    if not bucket.faces:
        return None
    me = bpy.data.meshes.new(bucket.name)
    me.from_pydata(bucket.verts, [], bucket.faces)
    me.validate()
    assert len(me.loops) == len(bucket.uvs), f"{bucket.name}: degenerate faces removed"
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", [c for p in bucket.uvs for c in p])
    if mat.get("vcol", True):
        ca = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
        ca.data.foreach_set("color_srgb", [c for p in bucket.cols for c in p])
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth_shade
    me.update()
    ob = bpy.data.objects.new(bucket.name, me)
    collection.objects.link(ob)
    OBJECTS[bucket.name] = ob
    return ob


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def chamfer_rect(cx, cy, w, d, c):
    x0, y0, x1, y1 = cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2
    return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]


def ellipse(cx, cy, rx, ry, seg=20, rot=0.0):
    out = []
    for i in range(seg):
        a = i * 2 * math.pi / seg
        x, y = math.cos(a) * rx, math.sin(a) * ry
        out.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    return out


def plus(cx, cy, size, wing):
    a, b = size / 2, wing / 2
    return [(cx - b, cy - a), (cx + b, cy - a), (cx + b, cy - b), (cx + a, cy - b), (cx + a, cy + b), (cx + b, cy + b), (cx + b, cy + a), (cx - b, cy + a), (cx - b, cy + b), (cx - a, cy + b), (cx - a, cy - b), (cx - b, cy - b)]


def scale_poly(poly, k):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in poly]


# ───────────────────────── city layout ─────────────────────────
# Inspired by Gurugram's Golf Course Road / Cyber City character: a wide arterial with an
# elevated metro on its median, glass office towers, gated group-housing towers and plotted
# low-rise sectors with rooftop water tanks. Left-hand traffic. Not a geographic model.

ART_HALF = 21.0  # arterial (along X): 6 m median, 2×14 m carriageways, 4 m sidewalks
CROSS_HALF = 14.0  # cross road (along Y)
SEC_HALF = 8.5  # secondary roads
SEC_X = [-280, -140, 140, 280]
SEC_Y = [-260, -130, 130, 260]
EXTENT = 420
BASE = (-62.0, -66.0)  # AETHER base rooftop (drone pad)
BASE_ROOF = 32.0
INCIDENT = (80.0, 10.0)
HOVER = (52.0, 13.2, 52.6)
CORRIDOR = [(BASE[0], BASE[1]), (-14.0, -18.0)]


def road_spans(axis_coords, half_main, main=0.0):
    spans = [(main - half_main, main + half_main)]
    spans += [(c - SEC_HALF, c + SEC_HALF) for c in axis_coords]
    return sorted(spans)


def blocks():
    xs = road_spans(SEC_X, CROSS_HALF)
    ys = road_spans(SEC_Y, ART_HALF)

    def gaps(spans):
        edges = [-EXTENT] + [v for s in spans for v in s] + [EXTENT]
        return [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]

    for x0, x1 in gaps(xs):
        for y0, y1 in gaps(ys):
            yield x0, y0, x1, y1


def dist_to_segment(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def split_parcels(x0, y0, x1, y1, min_size, gap, depth=0):
    w, d = x1 - x0, y1 - y0
    if depth > 3 or (w < min_size * 2 and d < min_size * 2) or (depth > 0 and rng.random() < 0.2):
        return [(x0, y0, x1, y1)]
    if w >= d:
        cut = lerp(x0 + min_size, x1 - min_size, rng.random()) if w > min_size * 2 else None
        if cut is None:
            return [(x0, y0, x1, y1)]
        return split_parcels(x0, y0, cut - gap / 2, y1, min_size, gap, depth + 1) + split_parcels(cut + gap / 2, y0, x1, y1, min_size, gap, depth + 1)
    cut = lerp(y0 + min_size, y1 - min_size, rng.random()) if d > min_size * 2 else None
    if cut is None:
        return [(x0, y0, x1, y1)]
    return split_parcels(x0, y0, x1, cut - gap / 2, min_size, gap, depth + 1) + split_parcels(x0, cut + gap / 2, x1, y1, min_size, gap, depth + 1)


def build_city(tex):
    col = bpy.data.collections.new("AETHER_City")
    scene.collection.children.link(col)
    M = {
        "glass": material("city_glass", rough=0.12, metal=0.55, tex=tex["glass"][0], emit_tex=tex["glass"][1], strength=1.0),
        "office": material("city_office", rough=0.55, metal=0.15, tex=tex["office"][0], emit_tex=tex["office"][1], strength=1.0),
        "resi": material("city_residential", rough=0.85, tex=tex["resi"][0], emit_tex=tex["resi"][1], strength=0.9),
        "lowrise": material("city_lowrise", rough=0.9, tex=tex["lowrise"][0], emit_tex=tex["lowrise"][1], strength=0.9),
        "roof": material("city_roof", rough=0.9, tex=tex["roof"]),
        "ground": material("city_ground", rough=0.95, tex=tex["pave"]),
        "asphalt": material("city_asphalt", rough=0.75, tex=tex["asphalt"]),
        "paint": material("city_paint", (0.86, 0.86, 0.82), rough=0.6),
        "concrete": material("city_concrete", (0.62, 0.61, 0.58), rough=0.85),
        "foliage": material("city_foliage", (0.16, 0.3, 0.14), rough=0.95),
        "metal": material("city_metal", (0.32, 0.33, 0.35), rough=0.45, metal=0.7),
        "lamp": material("emit_lamp", emit=(1.0, 0.72, 0.4), strength=6, vcol=False),
        "beacon": material("emit_beacon", emit=(1.0, 0.08, 0.05), strength=8, vcol=False),
        "crown": material("emit_crown", emit=(0.85, 0.92, 1.0), strength=3, vcol=False),
        "padlight": material("emit_pad", emit=(0.27, 0.91, 1.0), strength=5, vcol=False),
        "route": material("fx_route", emit=(0.27, 0.91, 1.0), strength=4, vcol=False),
        "disruption": material("fx_disruption", emit=(1.0, 0.42, 0.25), strength=4, vcol=False),
        "pool": material("fx_lightpool", emit=(1.0, 0.7, 0.4), strength=1, vcol=False),
        "far": material("city_far", rough=0.9, tex=tex["resi"][0], emit_tex=tex["resi"][1], strength=0.6),
        "hills": material("city_hills", (0.05, 0.06, 0.07), rough=1.0),
    }
    B = {k: Bucket(f"city_{k}" if not k.startswith(("emit", "fx")) else k) for k in M}
    B["lamp"].name, B["beacon"].name, B["crown"].name, B["padlight"].name = "emit_lamp", "emit_beacon", "emit_crown", "emit_pad"
    B["route"].name, B["disruption"].name, B["pool"].name = "fx_route", "fx_disruption", "fx_lightpool"

    ground_tile = 12.0

    # ── ground & roads ──
    B["ground"].face([(-1800, -1800, -0.06), (1800, -1800, -0.06), (1800, 1800, -0.06), (-1800, 1800, -0.06)], [(-150, -150), (150, -150), (150, 150), (-150, 150)], (0.32, 0.3, 0.27))

    def asphalt_strip(x0, y0, x1, y1):
        B["asphalt"].quad((x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0), uv=((x0 / 16, y0 / 16), (x1 / 16, y0 / 16), (x1 / 16, y1 / 16), (x0 / 16, y1 / 16)))

    def sidewalk(x0, y0, x1, y1):
        B["ground"].box(x0, y0, -0.05, x1, y1, 0.16, (0.7, 0.68, 0.64), uvscale=ground_tile / 3)

    E = EXTENT + 60
    asphalt_strip(-E, -ART_HALF + 4, E, ART_HALF - 4)
    asphalt_strip(-CROSS_HALF + 2.5, -E, CROSS_HALF - 2.5, E)
    for c in SEC_Y:
        asphalt_strip(-E, c - SEC_HALF + 2.5, E, c + SEC_HALF - 2.5)
    for c in SEC_X:
        asphalt_strip(c - SEC_HALF + 2.5, -E, c + SEC_HALF - 2.5, E)

    # sidewalks along each block edge are produced with the blocks (below); medians here
    for x0, x1 in ((-E, -CROSS_HALF), (CROSS_HALF, E)):
        B["concrete"].box(x0, -3, 0, x1, 3, 0.22, (0.75, 0.72, 0.66))
        B["foliage"].box(x0 + 0.5, -2.4, 0.22, x1 - 0.5, 2.4, 0.3, (0.6, 0.75, 0.55))
    for y0, y1 in ((-E, -ART_HALF), (ART_HALF, E)):
        B["concrete"].box(-1.5, y0, 0, 1.5, y1, 0.22, (0.75, 0.72, 0.66))

    paint = B["paint"]

    def dashes(axis, fixed, a0, a1, dash=3.0, gap=6.0, w=0.15, colr=(1, 1, 1)):
        a = a0
        while a < a1:
            b = min(a + dash, a1)
            if axis == "x":
                paint.quad((a, fixed - w, 0.02), (b, fixed - w, 0.02), (b, fixed + w, 0.02), (a, fixed + w, 0.02), colr)
            else:
                paint.quad((fixed - w, a, 0.02), (fixed + w, a, 0.02), (fixed + w, b, 0.02), (fixed - w, b, 0.02), colr)
            a += dash + gap

    def skip_x(a0, a1, fn):
        ranges = [(-E, SEC_X[0] - SEC_HALF - 2), (SEC_X[0] + SEC_HALF + 2, SEC_X[1] - SEC_HALF - 2), (SEC_X[1] + SEC_HALF + 2, -CROSS_HALF - 4), (CROSS_HALF + 4, SEC_X[2] - SEC_HALF - 2), (SEC_X[2] + SEC_HALF + 2, SEC_X[3] - SEC_HALF - 2), (SEC_X[3] + SEC_HALF + 2, E)]
        for r0, r1 in ranges:
            fn(max(a0, r0), min(a1, r1))

    for sign in (-1, 1):
        for lane_edge in (6.5, 10.0, 13.5):
            skip_x(-E, E, lambda a, b, y=sign * lane_edge: dashes("x", y, a, b))
        skip_x(-E, E, lambda a, b, y=sign * 3.3: dashes("x", y, a, b, dash=1e4, gap=0, w=0.1, colr=(0.95, 0.75, 0.2)))
        skip_x(-E, E, lambda a, b, y=sign * 16.7: dashes("x", y, a, b, dash=1e4, gap=0, w=0.1))
        dashes("y", sign * 5.75, -E, -ART_HALF - 4)
        dashes("y", sign * 5.75, ART_HALF + 4, E)
    for c in SEC_Y:
        skip_x(-E, E, lambda a, b, y=c: dashes("x", y, a, b, dash=3, gap=5, w=0.1))
    for c in SEC_X:
        dashes("y", c, -E, E, dash=3, gap=5, w=0.1)
    # zebra crossings + stop lines at the main intersection
    for i in range(14):
        y = -16 + i * 2.4
        for x in (-CROSS_HALF - 3.2, CROSS_HALF + 0.4):
            paint.quad((x, y, 0.025), (x + 2.8, y, 0.025), (x + 2.8, y + 1.2, 0.025), (x, y + 1.2, 0.025))
    for i in range(10):
        x = -11 + i * 2.4
        for y in (-ART_HALF - 3.2, ART_HALF + 0.4):
            paint.quad((x, y, 0.025), (x + 1.2, y, 0.025), (x + 1.2, y + 2.8, 0.025), (x, y + 2.8, 0.025))

    # ── elevated metro on the arterial median (Rapid-Metro-like guideway) ──
    conc = B["concrete"]
    x = -E
    while x < E:
        if abs(x) > CROSS_HALF + 4 and all(abs(x - s) > SEC_HALF + 3 for s in SEC_X):
            conc.box(x - 0.9, -1.2, 0, x + 0.9, 1.2, 11.0, (0.7, 0.69, 0.66))
            conc.box(x - 1.2, -3.6, 11.0, x + 1.2, 3.6, 12.4, (0.7, 0.69, 0.66))
        x += 32
    conc.box(-E, -4.1, 12.4, E, 4.1, 14.0, (0.78, 0.77, 0.74), bottom=True)
    conc.box(-E, -4.1, 14.0, E, -3.8, 15.0, (0.8, 0.8, 0.78))
    conc.box(-E, 3.8, 14.0, E, 4.1, 15.0, (0.8, 0.8, 0.78))
    # station over the median
    B["office"].prism(rect(-182, -9, -112, 9), 9.0, 20.0, (0.92, 0.95, 1.0), tile=(24, 28))
    B["roof"].box(-186, -11, 20.0, -108, 11, 21.0, (0.8, 0.8, 0.8))

    # ── blocks ──
    sw_base_done = False
    trees = []
    for bx0, by0, bx1, by1 in blocks():
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        # sidewalk ring
        sidewalk(bx0, by0, bx1, by0 + 4)
        sidewalk(bx0, by1 - 4, bx1, by1)
        sidewalk(bx0, by0 + 4, bx0 + 4, by1 - 4)
        sidewalk(bx1 - 4, by0 + 4, bx1, by1 - 4)
        for t in np.arange(bx0 + 6, bx1 - 4, 11.0):
            if rng.random() < 0.8:
                trees += [(t, by0 + 2, 0.16), (t, by1 - 2, 0.16)]
        ix0, iy0, ix1, iy1 = bx0 + 4, by0 + 4, bx1 - 4, by1 - 4
        near_core = abs(cy) < 140 and abs(cx) < 300
        outer = abs(cy) > 250 or abs(cx) > 300
        park = (bx0 > 140 and by1 < -130 and by0 > -260) or (bx1 < -280 and cy > 140 and cy < 260)
        plot_col = (0.45, 0.43, 0.4)

        if park:
            B["foliage"].box(ix0, iy0, 0, ix1, iy1, 0.12, (0.42, 0.62, 0.36))
            B["ground"].box(cx - 2, iy0, 0, cx + 2, iy1, 0.14, (0.8, 0.74, 0.62), uvscale=4)
            B["ground"].box(ix0, cy - 2, 0, ix1, cy + 2, 0.14, (0.8, 0.74, 0.62), uvscale=4)
            for _ in range(int((ix1 - ix0) * (iy1 - iy0) / 140)):
                trees.append((rng.uniform(ix0 + 3, ix1 - 3), rng.uniform(iy0 + 3, iy1 - 3), 0.12))
            continue

        B["ground"].box(ix0, iy0, -0.05, ix1, iy1, 0.1, plot_col, uvscale=ground_tile / 3)

        if bx1 <= -CROSS_HALF and by1 <= -ART_HALF and bx0 >= -140 and not sw_base_done:
            sw_base_done = True
            build_base(B)
            # low commercial frontage along the arterial and cross road, away from the flight corridor
            for px0, py0, px1, py1 in ((ix0 + 4, iy1 - 22, ix0 + 40, iy1 - 4), (ix1 - 24, iy0 + 6, ix1 - 6, iy0 + 46)):
                commercial(B, px0, py0, px1, py1, max_h=22)
            continue

        if near_core:
            for p in split_parcels(ix0 + 3, iy0 + 3, ix1 - 3, iy1 - 3, 30, 10):
                pc = ((p[0] + p[2]) / 2, (p[1] + p[3]) / 2)
                if min(p[2] - p[0], p[3] - p[1]) < 18:
                    trees.append((pc[0], pc[1], 0.1))
                    continue
                max_h = 26 if dist_to_segment(pc, *CORRIDOR) < 40 else 130
                if bx0 >= 14 and by0 >= 14 and bx1 <= 134 and not OBJECTS.get("landmark_done"):
                    OBJECTS["landmark_done"] = True
                    landmark(B, 72, 72)
                    continue
                commercial(B, *p, max_h=max_h)
        elif not outer:
            residential_cluster(B, ix0, iy0, ix1, iy1, trees)
        else:
            lowrise_sector(B, ix0, iy0, ix1, iy1)

    # ── streetlights (every 30 m along the arterial and cross road) ──
    lamps = []
    for x in np.arange(-E + 10, E, 30.0):
        if abs(x) < CROSS_HALF + 6:
            continue
        for y, arm in ((-18.6, 1), (18.6, -1)):
            lamps.append(((x, y), (0, arm)))
    for y in np.arange(-E + 10, E, 30.0):
        if abs(y) < ART_HALF + 6:
            continue
        for x, arm in ((-12.0, 1), (12.0, -1)):
            lamps.append(((x, y), (arm, 0)))
    for c in SEC_Y:
        for x in np.arange(-E + 20, E, 40.0):
            lamps.append(((x, c - 7.2), (0, 1)))
    for (x, y), (ax, ay) in lamps:
        B["metal"].tube((x, y, 0), (x, y, 10), 0.12, 6, (0.5, 0.5, 0.52), caps=False)
        B["metal"].tube((x, y, 9.8), (x + ax * 2.4, y + ay * 2.4, 10.2), 0.06, 4, (0.5, 0.5, 0.52), caps=False)
        hx, hy = x + ax * 2.6, y + ay * 2.6
        B["lamp"].box(hx - 0.35, hy - 0.35, 9.95, hx + 0.35, hy + 0.35, 10.1)
        r = 7.5
        B["pool"].quad((hx - r, hy - r, 0.05), (hx + r, hy - r, 0.05), (hx + r, hy + r, 0.05), (hx - r, hy + r, 0.05))

    for x, y, z in trees:
        if rng.random() < 0.08:
            continue
        h = rng.uniform(3.5, 6.5)
        g = rng.uniform(0.75, 1.15)
        B["metal"].tube((x, y, z), (x, y, z + h * 0.55), 0.18, 4, (0.32, 0.24, 0.18), caps=False)
        B["foliage"].blob((x, y, z + h * 0.7), rng.uniform(1.8, 3.0), (0.55 * g, 0.85 * g, 0.5 * g), squash=0.8, seed=int(x * 7 + y * 13))

    far_city(B)
    hills(B)
    route_and_disruption(B)

    for k, b in B.items():
        realise(b, M[k], col)
    return col


def roof_details(B, poly, z, tall):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    w, d = (max(xs) - min(xs)), (max(ys) - min(ys))
    B["roof"].prism(scale_poly(poly, 0.97), z, z + 1.1, (0.62, 0.62, 0.62), cap=None)
    B["roof"].box(cx - w * 0.18, cy - d * 0.16, z, cx + w * 0.18, cy + d * 0.16, z + 3.2, (0.55, 0.55, 0.55))
    for _ in range(rng.randint(1, 4)):
        ax, ay = cx + rng.uniform(-w, w) * 0.3, cy + rng.uniform(-d, d) * 0.3
        B["metal"].box(ax - 1.2, ay - 0.8, z, ax + 1.2, ay + 0.8, z + 1.4, (0.55, 0.56, 0.58))
    if tall:
        for px, py in (poly[0], poly[len(poly) // 2]):
            B["beacon"].box(px - 0.3, py - 0.3, z + 1.1, px + 0.3, py + 0.3, z + 1.7)


def commercial(B, x0, y0, x1, y1, max_h=130):
    w, d = x1 - x0, y1 - y0
    podium_h = rng.choice((6.0, 9.0, 12.0))
    tint = rng.choice(((0.85, 0.95, 1.0), (0.75, 0.9, 0.95), (0.95, 0.95, 0.95), (0.7, 0.85, 1.0), (0.9, 0.85, 0.8)))
    kind = "glass" if rng.random() < 0.62 else "office"
    tile = (24, 32) if kind == "glass" else (24, 28)
    B["office"].prism(rect(x0, y0, x1, y1), 0, podium_h, (0.95, 0.93, 0.9), tile=(24, 28), voff=rng.choice((0, 4, 8)))
    B["roof"].face([(x0, y0, podium_h), (x1, y0, podium_h), (x1, y1, podium_h), (x0, y1, podium_h)], [(x0 / 16, y0 / 16), (x1 / 16, y0 / 16), (x1 / 16, y1 / 16), (x0 / 16, y1 / 16)], (0.6, 0.6, 0.6))
    if max_h < 30:
        roof_details(B, rect(x0, y0, x1, y1), podium_h, False)
        return
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tw, td = w * rng.uniform(0.55, 0.78), d * rng.uniform(0.55, 0.78)
    h = min(max_h, (rng.uniform(95, 124) if rng.random() < 0.14 else rng.uniform(30, 82)) * (1.0 if abs(cy) < 70 else 0.8))
    shape = rng.random()
    if shape < 0.3:
        poly = chamfer_rect(cx, cy, tw, td, min(tw, td) * 0.18)
    elif shape < 0.45:
        poly = ellipse(cx, cy, tw / 2, td / 2, 20, rng.uniform(0, 0.4))
    else:
        poly = rect(cx - tw / 2, cy - td / 2, cx + tw / 2, cy + td / 2)
    voff = rng.choice((0, 8, 16, 24))
    uoff = rng.choice((0, 6, 12, 18))
    if rng.random() < 0.4 and h > 60:
        # stepped tower: setbacks read as a composed office building, not an extrusion
        h1 = h * rng.uniform(0.55, 0.7)
        B[kind].prism(poly, podium_h, h1, tint, tile=tile, uoff=uoff, voff=voff, cap=B["roof"], cap_col=(0.55, 0.55, 0.55))
        poly2 = scale_poly(poly, 0.78)
        B[kind].prism(poly2, h1, h, tint, tile=tile, uoff=uoff, voff=voff, cap=B["roof"], cap_col=(0.55, 0.55, 0.55))
        top = poly2
    else:
        B[kind].prism(poly, podium_h, h, tint, tile=tile, uoff=uoff, voff=voff, cap=B["roof"], cap_col=(0.55, 0.55, 0.55))
        top = poly
    if rng.random() < 0.35:
        B["crown"].prism(scale_poly(top, 1.005), h - 1.2, h - 0.6)
    roof_details(B, top, h, h > 60)


def landmark(B, cx, cy):
    """Hero tower near the intersection: tapering tiers with a lit crown."""
    tiers = [(30, 26, 0, 58), (25, 22, 58, 102), (20, 17, 102, 132), (13, 11, 132, 146)]
    B["office"].prism(rect(cx - 26, cy - 24, cx + 26, cy + 24), 0, 12, (0.95, 0.95, 0.95), tile=(24, 28))
    B["roof"].face([(cx - 26, cy - 24, 12), (cx + 26, cy - 24, 12), (cx + 26, cy + 24, 12), (cx - 26, cy + 24, 12)], None, (0.6, 0.6, 0.6))
    for w, d, z0, z1 in tiers:
        poly = chamfer_rect(cx, cy, w, d, 3.5)
        B["glass"].prism(poly, max(z0, 12), z1, (0.75, 0.9, 1.0), tile=(24, 32), cap=B["roof"], cap_col=(0.5, 0.5, 0.5))
        B["crown"].prism(scale_poly(poly, 1.01), z1 - 1.0, z1 - 0.4)
    B["metal"].tube((cx, cy, 146), (cx, cy, 162), 0.35, 6, (0.6, 0.6, 0.62))
    B["beacon"].box(cx - 0.4, cy - 0.4, 162, cx + 0.4, cy + 0.4, 163)


def build_base(B):
    """AETHER base: a mid-rise office block with a rooftop drone pad."""
    bx, by = BASE
    B["office"].prism(rect(bx - 17, by - 15, bx + 17, by + 15), 0, BASE_ROOF, (0.9, 0.93, 0.95), tile=(24, 28), cap=B["roof"], cap_col=(0.5, 0.5, 0.52))
    B["roof"].prism(rect(bx - 17, by - 15, bx + 17, by + 15), BASE_ROOF, BASE_ROOF + 1.1, (0.6, 0.6, 0.6))
    B["metal"].box(bx + 8, by - 12, BASE_ROOF, bx + 14, by - 6, BASE_ROOF + 2.4, (0.5, 0.52, 0.55))
    B["roof"].box(bx - 14, by + 6, BASE_ROOF, bx - 6, by + 12, BASE_ROOF + 3.6, (0.55, 0.55, 0.55))
    # pad: dark landing surface, light ring and cyan perimeter markers
    pad = ellipse(bx, by, 5.5, 5.5, 24)
    B["roof"].prism(pad, BASE_ROOF, BASE_ROOF + 0.12, (0.18, 0.19, 0.2), cap=B["roof"], cap_col=(0.16, 0.17, 0.18))
    for i in range(24):
        a = i * 2 * math.pi / 24
        px, py = bx + math.cos(a) * 5.0, by + math.sin(a) * 5.0
        B["padlight"].box(px - 0.12, py - 0.12, BASE_ROOF + 0.12, px + 0.12, py + 0.12, BASE_ROOF + 0.17)
    for i in range(48):
        a0, a1 = i * 2 * math.pi / 48, (i + 1) * 2 * math.pi / 48
        for r0, r1 in ((3.7, 3.85),):
            B["paint"].quad(
                (bx + math.cos(a0) * r0, by + math.sin(a0) * r0, BASE_ROOF + 0.13),
                (bx + math.cos(a1) * r0, by + math.sin(a1) * r0, BASE_ROOF + 0.13),
                (bx + math.cos(a1) * r1, by + math.sin(a1) * r1, BASE_ROOF + 0.13),
                (bx + math.cos(a0) * r1, by + math.sin(a0) * r1, BASE_ROOF + 0.13),
            )


def residential_cluster(B, x0, y0, x1, y1, trees):
    B["concrete"].prism(rect(x0, y0, x1, y1), 0, 2.2, (0.85, 0.82, 0.76))
    B["foliage"].box(x0 + 2, y0 + 2, 0.1, x1 - 2, y1 - 2, 0.16, (0.5, 0.65, 0.42))
    plaster = rng.choice(((1.0, 0.96, 0.88), (0.98, 0.9, 0.82), (0.92, 0.92, 0.9), (1.0, 0.92, 0.78)))
    nx = max(1, int((x1 - x0) // 38))
    ny = max(1, int((y1 - y0) // 38))
    floors = rng.randint(13, 24)
    for i in range(nx):
        for j in range(ny):
            cx = x0 + (i + 0.5) * (x1 - x0) / nx
            cy = y0 + (j + 0.5) * (y1 - y0) / ny
            size = min(26, (x1 - x0) / nx - 10, (y1 - y0) / ny - 10)
            if size < 12:
                continue
            h = (floors + rng.randint(-3, 3)) * 3.1
            poly = plus(cx, cy, size, size * 0.42) if rng.random() < 0.7 else rect(cx - size / 2, cy - size / 3, cx + size / 2, cy + size / 3)
            B["resi"].prism(poly, 0, h, plaster, tile=(24, 24.8), uoff=rng.choice((0, 3, 6, 9)), voff=rng.choice((0, 3.1, 6.2)), cap=B["roof"], cap_col=(0.6, 0.58, 0.55))
            B["roof"].box(cx - 3, cy - 3, h, cx + 3, cy + 3, h + 4.5, plaster)
            for k in range(4):
                B["metal"].cylinder(cx - 2.2 + k * 1.5, cy + 4.5, h, h + 1.6, 0.6, 6, (0.12, 0.12, 0.12))
            if h > 70:
                B["beacon"].box(cx - 0.3, cy - 0.3, h + 4.5, cx + 0.3, cy + 0.3, h + 5.0)
    for _ in range(int((x1 - x0) * (y1 - y0) / 500)):
        trees.append((rng.uniform(x0 + 3, x1 - 3), rng.uniform(y0 + 3, y1 - 3), 0.16))


def lowrise_sector(B, x0, y0, x1, y1):
    """Plotted housing: narrow 3–4 storey houses with rooftop water tanks."""
    pastel = ((0.98, 0.92, 0.8), (0.95, 0.8, 0.7), (0.92, 0.92, 0.88), (1.0, 0.88, 0.62), (0.85, 0.9, 0.92), (0.9, 0.75, 0.68))
    y = y0 + 2
    while y < y1 - 18:
        x = x0 + 2
        while x < x1 - 10:
            w = rng.choice((10, 12, 14))
            if x + w > x1 - 2:
                break
            h = rng.choice((3, 3, 4, 4, 4)) * 3.1 + rng.choice((0, 0, 1.2))
            c = rng.choice(pastel)
            poly = rect(x, y, x + w - 0.6, y + 17)
            B["lowrise"].prism(poly, 0, h, c, tile=(12, 12.4), uoff=rng.choice((0, 3, 6)), cap=B["roof"], cap_col=(0.6, 0.57, 0.52))
            B["roof"].prism(scale_poly(poly, 0.97), h, h + 1.0, c)
            if rng.random() < 0.85:
                B["metal"].cylinder(x + w * 0.3, y + 13, h + 2.4, h + 3.8, 0.75, 6, (0.1, 0.1, 0.1))
                B["roof"].box(x + w * 0.3 - 1.2, y + 12, h, x + w * 0.3 + 1.2, y + 14, h + 2.4, c)
            x += w
        y += 19


def far_city(B):
    """Low-detail skyline beyond the modelled district so the horizon is never empty."""
    r = random.Random(77)
    step = 46
    for gx in range(-1500, 1501, step):
        for gy in range(-1500, 1501, step):
            dist = max(abs(gx), abs(gy))
            if dist < EXTENT + 60 or r.random() < 0.45:
                continue
            h = r.uniform(12, 70) * (1.2 - dist / 2000)
            w, d = r.uniform(16, 32), r.uniform(16, 32)
            x, y = gx + r.uniform(-8, 8), gy + r.uniform(-8, 8)
            B["far"].prism(rect(x - w / 2, y - d / 2, x + w / 2, y + d / 2), 0, h, (0.75, 0.75, 0.75), tile=(24, 24.8), uoff=r.choice((0, 6, 12)), cap=B["roof"], cap_col=(0.4, 0.4, 0.4))


def hills(B):
    """Aravalli-like ridge silhouette to the south."""
    pts = []
    r = random.Random(5)
    for i in range(41):
        x = -2400 + i * 120
        pts.append((x, -2000 + r.uniform(-80, 80), 60 + 70 * math.sin(i * 0.37) ** 2 + r.uniform(0, 50)))
    for i in range(len(pts) - 1):
        (ax, ay, ah), (bx, by, bh) = pts[i], pts[i + 1]
        B["hills"].quad((ax, ay + 300, 0), (bx, by + 300, 0), (bx, by, bh), (ax, ay, ah))


def path_polyline(points, radius=12.0, step=2.0):
    """Polyline with filleted corners, resampled every `step` metres."""
    out = [Vector(points[0])]
    for i in range(1, len(points) - 1):
        p0, p1, p2 = Vector(points[i - 1]), Vector(points[i]), Vector(points[i + 1])
        a = p1 + (p0 - p1).normalized() * radius
        b = p1 + (p2 - p1).normalized() * radius
        out.append(a)
        for k in range(1, 8):
            s = k / 8
            out.append((1 - s) ** 2 * a + 2 * (1 - s) * s * p1 + s * s * b)
        out.append(b)
    out.append(Vector(points[-1]))
    # arc-length resample
    res, carry = [out[0]], 0.0
    for i in range(1, len(out)):
        a, b = out[i - 1], out[i]
        seg = (b - a).length
        t = step - carry
        while t <= seg:
            res.append(a + (b - a) * (t / seg))
            t += step
        carry = seg - (t - step)
    res.append(out[-1])
    return res


def ribbon(bucket, pts, width, z):
    total = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    acc = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = (b - a).normalized()
        n = Vector((-d.y, d.x, 0)) * (width / 2)
        seg = (b - a).length
        u0, u1 = acc / total, (acc + seg) / total
        acc += seg
        bucket.quad((a.x - n.x, a.y - n.y, z), (b.x - n.x, b.y - n.y, z), (b.x + n.x, b.y + n.y, z), (a.x + n.x, a.y + n.y, z), uv=((u0, 0), (u1, 0), (u1, 1), (u0, 1)))


ROUTE = [(-260, 11.75), (-17, 11.75), (-6.25, 24), (-6.25, 127.5), (6, 133), (137.5, 133), (143, 124), (143, 22), (155, 11.75), (320, 11.75)]


def route_and_disruption(B):
    # UV.x runs 0→1 along the route so the web shader can draw it progressively.
    ribbon(B["route"], path_polyline([(*p, 0) for p in ROUTE], 10.0, 2.0), 1.6, 0.14)
    ribbon(B["disruption"], [Vector((INCIDENT[0] - 26, 10.0, 0)), Vector((INCIDENT[0] + 8, 10.0, 0))], 7.0, 0.13)


def vehicles(collection):
    """Prototype vehicles; the web layer instances them along the lanes in `meta_traffic`."""
    body = material("veh_body", (1, 1, 1), rough=0.35, metal=0.3)
    lights = material("veh_lights", emit=(1, 1, 1), strength=4)
    glass = (0.05, 0.06, 0.07)
    protos = {}

    def proto(name, build):
        b, l = Bucket(f"{name}_body"), Bucket(f"{name}_lights")
        build(b, l)
        root = bpy.data.objects.new(name, None)
        collection.objects.link(root)
        root.location = (0, 0, -200)  # parked out of sight; web code instances geometry only
        for bucket, mat in ((b, body), (l, lights)):
            ob = realise(bucket, mat, collection, False)
            ob.parent = root
        protos[name] = root

    def car(b, l, length=4.2, width=1.75, height=1.45):
        hl, hw = length / 2, width / 2
        b.box(-hl, -hw, 0.25, hl, hw, 0.85)
        b.box(-hl * 0.5, -hw * 0.9, 0.85, hl * 0.35, hw * 0.9, height, glass)
        b.box(-hl * 0.45, -hw * 0.85, height, hl * 0.3, hw * 0.85, height + 0.03)
        for sx in (-hl * 0.62, hl * 0.62):
            for sy in (-hw, hw - 0.18):
                b.box(sx - 0.33, sy, 0, sx + 0.33, sy + 0.18, 0.62, (0.05, 0.05, 0.05))
        l.box(hl, -hw + 0.1, 0.6, hl + 0.03, -hw + 0.45, 0.75, (1, 0.95, 0.85))
        l.box(hl, hw - 0.45, 0.6, hl + 0.03, hw - 0.1, 0.75, (1, 0.95, 0.85))
        l.box(-hl - 0.03, -hw + 0.1, 0.62, -hl, -hw + 0.4, 0.78, (1, 0.05, 0.03))
        l.box(-hl - 0.03, hw - 0.4, 0.62, -hl, hw - 0.1, 0.78, (1, 0.05, 0.03))

    def suv(b, l):
        car(b, l, 4.6, 1.9, 1.75)

    def auto(b, l):
        green, yellow = (0.12, 0.45, 0.18), (0.95, 0.8, 0.15)
        b.box(-1.3, -0.65, 0.2, 1.1, 0.65, 0.9, green)
        b.box(-1.25, -0.65, 0.9, 0.55, 0.65, 1.0, green)
        b.box(-1.3, -0.68, 1.6, 0.75, 0.68, 1.75, yellow)
        b.box(0.55, -0.6, 0.9, 0.7, 0.6, 1.6, glass)
        for x, y in ((0.95, 0), (-0.9, -0.55), (-0.9, 0.55)):
            b.box(x - 0.22, y - 0.08, 0, x + 0.22, y + 0.08, 0.42, (0.05, 0.05, 0.05))
        l.box(1.1, -0.12, 0.7, 1.13, 0.12, 0.85, (1, 0.95, 0.8))
        l.box(-1.33, -0.5, 0.5, -1.3, 0.5, 0.6, (1, 0.05, 0.03))

    def bus(b, l):
        b.box(-6, -1.28, 0.35, 6, 1.28, 1.3)
        b.box(-6, -1.3, 1.3, 6, 1.3, 2.4, glass)
        b.box(-6, -1.28, 2.4, 6, 1.28, 3.1)
        for x in (-3.8, 3.8):
            for y in (-1.3, 1.1):
                b.box(x - 0.5, y, 0, x + 0.5, y + 0.2, 0.9, (0.05, 0.05, 0.05))
        l.box(6, -1.1, 0.7, 6.03, -0.7, 0.9, (1, 0.95, 0.85))
        l.box(6, 0.7, 0.7, 6.03, 1.1, 0.9, (1, 0.95, 0.85))
        l.box(-6.03, -1.1, 0.8, -6, -0.8, 1.1, (1, 0.05, 0.03))
        l.box(-6.03, 0.8, 0.8, -6, 1.1, 1.1, (1, 0.05, 0.03))

    def truck(b, l):
        b.box(2.0, -1.2, 0.5, 3.8, 1.2, 2.8, (0.9, 0.55, 0.15))
        b.box(3.0, -1.15, 1.7, 3.82, 1.15, 2.6, glass)
        b.box(-4.2, -1.25, 0.9, 1.9, 1.25, 3.4, (0.85, 0.85, 0.82))
        b.box(-4.2, -1.0, 0.4, 3.8, 1.0, 0.9, (0.2, 0.2, 0.2))
        for x in (-3.2, -1.9, 2.9):
            for y in (-1.25, 1.05):
                b.box(x - 0.5, y, 0, x + 0.5, y + 0.2, 1.0, (0.05, 0.05, 0.05))
        l.box(3.8, -1.0, 0.8, 3.83, -0.6, 1.0, (1, 0.6, 0.1))
        l.box(3.8, 0.6, 0.8, 3.83, 1.0, 1.0, (1, 0.6, 0.1))
        l.box(-4.23, -1.1, 1.0, -4.2, -0.7, 1.3, (1, 0.6, 0.1))
        l.box(-4.23, 0.7, 1.0, -4.2, 1.1, 1.3, (1, 0.6, 0.1))

    def metro(b, l):
        for k in range(3):
            x0 = -33 + k * 22
            b.box(x0 + 0.2, -1.45, 0.4, x0 + 21.8, 1.45, 1.4, (0.82, 0.84, 0.86))
            b.box(x0 + 0.2, -1.46, 1.4, x0 + 21.8, 1.46, 2.6, glass)
            b.box(x0 + 0.2, -1.45, 2.6, x0 + 21.8, 1.45, 3.6, (0.82, 0.84, 0.86))
            l.box(x0 + 1, -1.48, 1.55, x0 + 21, -1.47, 2.45, (0.85, 0.92, 1.0))
            l.box(x0 + 1, 1.47, 1.55, x0 + 21, 1.48, 2.45, (0.85, 0.92, 1.0))
            b.box(x0 + 0.2, -1.47, 1.0, x0 + 21.8, -1.46, 1.25, (0.1, 0.45, 0.75))
            b.box(x0 + 0.2, 1.46, 1.0, x0 + 21.8, 1.47, 1.25, (0.1, 0.45, 0.75))
        l.box(33, -1.2, 1.0, 33.03, -0.8, 1.3, (1, 0.95, 0.85))
        l.box(33, 0.8, 1.0, 33.03, 1.2, 1.3, (1, 0.95, 0.85))

    proto("veh_car", lambda b, l: car(b, l))
    proto("veh_suv", suv)
    proto("veh_auto", auto)
    proto("veh_bus", bus)
    proto("veh_truck", truck)
    proto("veh_metro", metro)
    return protos


def traffic_meta(collection):
    """Lane definitions in Blender coordinates (x, y, z); left-hand traffic."""
    E = EXTENT + 60
    lanes = []
    for y, jam in ((4.75, "slow"), (8.25, "queue"), (11.75, "queue"), (15.25, "slow")):
        lanes.append({"from": [-E, y, 0], "to": [E, y, 0], "speed": 11, "count": 26, "mode": jam, "stop": INCIDENT[0] - 9})
    for y in (-4.75, -8.25, -11.75, -15.25):
        lanes.append({"from": [E, y, 0], "to": [-E, y, 0], "speed": 12, "count": 18, "mode": "flow"})
    for x in (-3.6, -7.9):
        lanes.append({"from": [x, -E, 0], "to": [x, -ART_HALF - 4, 0], "speed": 0, "count": 9, "mode": "queue_end"})
        lanes.append({"from": [x, ART_HALF + 3, 0], "to": [x, E, 0], "speed": 10, "count": 10, "mode": "flow"})
    for x in (3.6, 7.9):
        lanes.append({"from": [x, E, 0], "to": [x, ART_HALF + 4, 0], "speed": 0, "count": 9, "mode": "queue_end"})
        lanes.append({"from": [x, -ART_HALF - 3, 0], "to": [x, -E, 0], "speed": 10, "count": 10, "mode": "flow"})
    for c in SEC_Y:
        lanes.append({"from": [-E, c + 2.6, 0], "to": [E, c + 2.6, 0], "speed": 9, "count": 10, "mode": "flow"})
        lanes.append({"from": [E, c - 2.6, 0], "to": [-E, c - 2.6, 0], "speed": 9, "count": 10, "mode": "flow"})
    for c in SEC_X:
        lanes.append({"from": [c - 2.6, -E, 0], "to": [c - 2.6, E, 0], "speed": 9, "count": 10, "mode": "flow"})
        lanes.append({"from": [c + 2.6, E, 0], "to": [c + 2.6, -E, 0], "speed": 9, "count": 10, "mode": "flow"})
    lanes.append({"from": [-E, 1.9, 14.0], "to": [E, 1.9, 14.0], "speed": 17, "count": 1, "mode": "metro"})
    lanes.append({"from": [E, -1.9, 14.0], "to": [-E, -1.9, 14.0], "speed": 17, "count": 1, "mode": "metro"})
    meta = bpy.data.objects.new("meta_traffic", None)
    collection.objects.link(meta)
    meta["lanes"] = json.dumps(lanes)
    meta["incident"] = json.dumps({"truck": [INCIDENT[0] + 2, 11.75, 0, 0.0], "car": [INCIDENT[0] - 1, 8.0, 0, 0.5]})
    anchors = {
        "anchor_incident": (INCIDENT[0], INCIDENT[1], 0.2),
        "anchor_intersection": (0, 0, 0.2),
        "anchor_base": (BASE[0], BASE[1], BASE_ROOF + 0.2),
        "anchor_route_end": (ROUTE[-1][0], ROUTE[-1][1], 0.2),
        "anchor_route_start": (ROUTE[0][0], ROUTE[0][1], 0.2),
    }
    for name, loc in anchors.items():
        e = bpy.data.objects.new(name, None)
        e.location = loc
        collection.objects.link(e)


# ───────────────────────── drone ─────────────────────────


def build_drone():
    col = bpy.data.collections.new("AETHER_Drone")
    scene.collection.children.link(col)
    shell = material("drone_shell", (0.46, 0.48, 0.5), rough=0.36, metal=0.25, vcol=False)
    shell_light = material("drone_shell_light", (0.8, 0.82, 0.84), rough=0.4, metal=0.15, vcol=False)
    carbon = material("drone_carbon", (0.05, 0.05, 0.055), rough=0.5, metal=0.1, vcol=False)
    metal = material("drone_metal", (0.62, 0.63, 0.66), rough=0.28, metal=0.9, vcol=False)
    lens = material("drone_lens", (0.01, 0.015, 0.02), rough=0.05, metal=0.6, vcol=False)
    cyan = material("drone_led_cyan", emit=(0.27, 0.91, 1.0), strength=6, vcol=False)
    red = material("drone_led_red", emit=(1.0, 0.1, 0.06), strength=6, vcol=False)
    green = material("drone_led_green", emit=(0.15, 1.0, 0.35), strength=6, vcol=False)
    white = material("drone_led_strobe", emit=(1, 1, 1), strength=6, vcol=False)
    prop_mat = material("drone_prop", (1, 1, 1), rough=0.45, metal=0.05)
    disc_mat = material("drone_propdisc", (0.5, 0.5, 0.5), rough=1, vcol=False)

    root = bpy.data.objects.new("AETHER_Drone", None)
    col.objects.link(root)
    root.rotation_mode = "QUATERNION"

    parts = {k: Bucket(f"drone_{k}") for k in ("shell", "shell_light", "carbon", "metal", "lens", "cyan", "red", "green", "strobe")}
    mats = {"shell": shell, "shell_light": shell_light, "carbon": carbon, "metal": metal, "lens": lens, "cyan": cyan, "red": red, "green": green, "strobe": white}

    def rounded_hull(b, length, width, height, z0, nose=0.32, seg=14, rows=7):
        """Lofted hull: rounded-rectangle sections tapering toward nose and tail."""
        rings = []
        for i in range(rows + 1):
            u = i / rows
            x = -length / 2 + u * length
            taper = 1 - (abs(u - 0.45) / 0.55) ** 2.6 * nose
            w, h = width / 2 * taper, height / 2 * (1 - (abs(u - 0.5) / 0.5) ** 3 * 0.45)
            ring = []
            for k in range(seg):
                a = k * 2 * math.pi / seg
                cy, cz = math.cos(a), math.sin(a)
                # superellipse section: flat sides, rounded edges
                py = math.copysign(abs(cy) ** 0.45, cy) * w
                pz = math.copysign(abs(cz) ** 0.6, cz) * h
                ring.append(Vector((x, py, z0 + pz)))
            rings.append(ring)
        for i in range(rows):
            for k in range(seg):
                j = (k + 1) % seg
                b.quad(rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k])
        b.face(list(reversed(rings[0])))
        b.face(rings[-1])

    rounded_hull(parts["shell"], 0.44, 0.22, 0.11, 0.0)
    rounded_hull(parts["shell_light"], 0.3, 0.17, 0.05, 0.062, nose=0.4, rows=6)
    # battery bay seam and rear vents
    parts["carbon"].box(-0.2, -0.085, -0.05, -0.04, 0.085, -0.045)
    for k in range(4):
        parts["carbon"].box(-0.225, -0.06 + k * 0.035, 0.0, -0.215, -0.04 + k * 0.035, 0.03)
    # cyan identification strip on the nose and sides (restrained)
    parts["cyan"].box(0.205, -0.045, 0.012, 0.212, 0.045, 0.02)
    parts["cyan"].box(-0.06, 0.102, 0.018, 0.08, 0.106, 0.024)
    parts["cyan"].box(-0.06, -0.106, 0.018, 0.08, -0.102, 0.024)
    # GPS puck and antennas
    parts["shell_light"].tube((-0.08, 0, 0.088), (-0.08, 0, 0.1), 0.03, 12)
    parts["carbon"].box(-0.2, -0.075, 0.04, -0.19, -0.07, 0.11)
    parts["carbon"].box(-0.2, 0.07, 0.04, -0.19, 0.075, 0.11)

    motors = []
    for name, ang, spin in (("FL", 45, 1), ("FR", -45, -1), ("RL", 135, -1), ("RR", -135, 1)):
        a = math.radians(ang)
        d = Vector((math.cos(a), math.sin(a), 0))
        root_pt = d * 0.07 + Vector((0, 0, 0.012))
        tip = d * 0.45 + Vector((0, 0, 0.02))
        parts["carbon"].tube(root_pt, tip, 0.016, 10)
        parts["shell"].tube(d * 0.06, d * 0.15 + Vector((0, 0, 0.008)), 0.03, 10)  # arm fairing
        parts["shell"].tube(tip + Vector((0, 0, -0.03)), tip + Vector((0, 0, 0.012)), 0.034, 16)  # motor mount
        parts["metal"].tube(tip + Vector((0, 0, 0.012)), tip + Vector((0, 0, 0.042)), 0.03, 16)  # motor bell
        parts["shell"].tube(tip + Vector((0, 0, 0.042)), tip + Vector((0, 0, 0.048)), 0.012, 10)
        # navigation lights under each motor: red port, green starboard, white strobes aft
        led = {"FL": "red", "FR": "green"}.get(name, "strobe")
        parts[led].tube(tip + Vector((0, 0, -0.04)), tip + Vector((0, 0, -0.03)), 0.012, 8)
        motors.append((name, tip + Vector((0, 0, 0.05)), spin))

    # landing gear: two legs per side into skids
    for side in (-1, 1):
        for x in (-0.07, 0.07):
            parts["carbon"].tube((x, side * 0.07, -0.045), (x * 1.5, side * 0.15, -0.19), 0.009, 8)
        parts["carbon"].tube((-0.16, side * 0.15, -0.195), (0.16, side * 0.15, -0.195), 0.011, 8)
        for x in (-0.16, 0.16):
            parts["shell"].tube((x, side * 0.15, -0.195), (x + math.copysign(0.012, x), side * 0.15, -0.195), 0.013, 8)

    # "AETHER" lettering on the top shell
    bpy.ops.object.text_add(location=(0.0, 0.0, 0.0905))
    txt = bpy.context.object
    txt.data.body = "AETHER"
    txt.data.size = 0.03
    txt.data.extrude = 0.0006
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.rotation_euler = (0, 0, -math.pi / 2)
    txt.location = (0.01, 0, 0.0905)
    bpy.ops.object.convert(target="MESH")
    txt.name = "drone_logo"
    txt.data.materials.clear()
    txt.data.materials.append(material("drone_logo", (0.1, 0.11, 0.12), rough=0.5, vcol=False))
    for c in txt.users_collection:
        c.objects.unlink(txt)
    col.objects.link(txt)
    txt.parent = root

    for k, b in parts.items():
        ob = realise(b, mats[k], col, smooth_shade=k in ("shell", "shell_light", "metal"))
        if ob:
            ob.parent = root

    # gimbal: yoke + observation module (conceptual, not a claim about installed hardware)
    gimbal = bpy.data.objects.new("drone_gimbal", None)
    col.objects.link(gimbal)
    gimbal.parent = root
    gimbal.location = (0.17, 0, -0.065)
    gimbal.rotation_mode = "XYZ"
    gb = {"shell": Bucket("gimbal_shell"), "lens": Bucket("gimbal_lens"), "metal": Bucket("gimbal_metal")}
    gb["metal"].box(-0.012, -0.04, 0.0, 0.012, 0.04, 0.03)
    gb["metal"].box(-0.012, -0.045, -0.035, 0.012, -0.038, 0.0)
    gb["metal"].box(-0.012, 0.038, -0.035, 0.012, 0.045, 0.0)
    pod = gb["shell"]
    seg = 16
    for i in range(seg):
        a0, a1 = i * 2 * math.pi / seg, (i + 1) * 2 * math.pi / seg
        for j in range(8):
            b0, b1 = -math.pi / 2 + j * math.pi / 8, -math.pi / 2 + (j + 1) * math.pi / 8
            r = 0.036

            def sp(a, bb):
                return (math.cos(bb) * math.cos(a) * r, math.cos(bb) * math.sin(a) * r * 1.05, math.sin(bb) * r - 0.035)

            pod.quad(sp(a0, b0), sp(a1, b0), sp(a1, b1), sp(a0, b1))
    gb["lens"].tube((0.03, 0.0, -0.035), (0.04, 0.0, -0.035), 0.018, 20)
    gb["lens"].tube((0.028, 0.022, -0.022), (0.036, 0.022, -0.022), 0.007, 12)
    for k, b in gb.items():
        ob = realise(b, {"shell": shell_light, "lens": lens, "metal": metal}[k], col, smooth_shade=True)
        ob.parent = gimbal

    # propellers: twisted two-blade rotors with light tips (visible when spinning)
    props = []
    for name, pos, spin in motors:
        b = Bucket(f"prop_{name}")
        stations = 9
        for blade in (0, 1):
            rot = math.pi * blade
            rings = []
            for i in range(stations):
                s = i / (stations - 1)
                r = 0.02 + s * 0.17
                chord = 0.034 * (1 - s * 0.45) * (1 - max(0, s - 0.85) * 3)
                twist = math.radians(24 - 16 * s) * spin
                t = 0.0035 * (1 - s * 0.5)
                ring = []
                for cx, cz in ((chord / 2, t), (-chord / 2, t * 0.4), (-chord / 2, -t * 0.4), (chord / 2, -t * 0.2)):
                    y = cx * math.cos(twist) * spin
                    z = cx * math.sin(twist) + cz
                    x = r
                    ring.append(Vector((x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot), z)))
                rings.append((ring, s))
            for i in range(stations - 1):
                ra, sa = rings[i]
                rb, _ = rings[i + 1]
                colr = (0.85, 0.86, 0.88) if sa > 0.82 else (0.07, 0.07, 0.075)
                for k in range(4):
                    j = (k + 1) % 4
                    b.quad(ra[k], ra[j], rb[j], rb[k], colr)
            b.face(list(reversed(rings[0][0])), None, (0.07, 0.07, 0.075))
            b.face(rings[-1][0], None, (0.85, 0.86, 0.88))
        b.tube((0, 0, -0.008), (0, 0, 0.01), 0.018, 12, (0.6, 0.6, 0.62))
        ob = realise(b, prop_mat, col, smooth_shade=False)
        ob.parent = root
        ob.location = pos
        ob.rotation_mode = "XYZ"
        props.append((ob, spin))
        d = Bucket(f"propdisc_{name}")
        n = 40
        for i in range(n):
            a0, a1 = i * 2 * math.pi / n, (i + 1) * 2 * math.pi / n
            d.face([(0, 0, 0), (math.cos(a0) * 0.19, math.sin(a0) * 0.19, 0), (math.cos(a1) * 0.19, math.sin(a1) * 0.19, 0)], [(0.5, 0.5), (0.5 + math.cos(a0) / 2, 0.5 + math.sin(a0) / 2), (0.5 + math.cos(a1) / 2, 0.5 + math.sin(a1) / 2)])
        disc = realise(d, disc_mat, col)
        disc.parent = root
        disc.location = pos + Vector((0, 0, 0.002))
    return root, gimbal, props


# ───────────────────────── motion: drone flight + director camera ─────────────────────────


class Hermite:
    def __init__(self, keys):
        self.t = [k[0] for k in keys]
        self.p = [np.array(k[1], float) for k in keys]
        self.m = []
        for i, k in enumerate(keys):
            if len(k) > 2 and k[2] is not None:
                self.m.append(np.array(k[2], float))
            elif i in (0, len(keys) - 1):
                self.m.append(np.zeros(3))
            else:
                self.m.append((self.p[i + 1] - self.p[i - 1]) / (self.t[i + 1] - self.t[i - 1]))

    def __call__(self, t):
        if t <= self.t[0]:
            return self.p[0].copy()
        if t >= self.t[-1]:
            return self.p[-1].copy()
        i = bisect.bisect_right(self.t, t) - 1
        h = self.t[i + 1] - self.t[i]
        s = (t - self.t[i]) / h
        h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
        return h00 * self.p[i] + h10 * h * self.m[i] + h01 * self.p[i + 1] + h11 * h * self.m[i + 1]


Z0 = (0, 0, 0)
PAD = (BASE[0], BASE[1], BASE_ROOF + 0.12 + 0.208)
lift = CUE["liftoff"]
DRONE_PATH = Hermite(
    [
        (0.0, PAD, Z0),
        (lift, PAD, Z0),
        (lift + 1.0, (PAD[0], PAD[1], PAD[2] + 6.5), (0, 0, 8.5)),
        (CUE["chase"], (-60.0, -64.2, 50.5), (5, 5, 3.5)),
        (9.35, (-45.0, -49.0, 53.6), None),
        (10.05, (-22.0, -25.0, 56.0), None),
        (CUE["intersection"], (0.0, -3.0, 57.2), None),
        (11.5, (25.0, 7.5, 56.0), None),
        (12.4, (42.0, 12.0, 54.0), None),
        (13.4, (HOVER[0], HOVER[1], HOVER[2]), Z0),
        (DURATION, (HOVER[0] + 0.4, HOVER[1] + 0.2, HOVER[2] + 0.2), Z0),
    ]
)


def sample_drone():
    """Position from the spline; attitude from the physics of a multirotor (thrust vector tilt)."""
    dt = 1.0 / (FPS * 4)
    n = int(DURATION / dt) + 1
    ts = np.arange(n) * dt
    pos = np.array([DRONE_PATH(t) for t in ts])
    hover = ts > 13.4
    pos[hover, 2] += 0.07 * np.sin((ts[hover] - 13.4) * 2.3)
    pos[hover, 0] += 0.05 * np.sin((ts[hover] - 13.4) * 1.4)
    vel = np.gradient(pos, dt, axis=0)
    acc = np.gradient(vel, dt, axis=0)
    yaw = np.zeros(n)
    y = math.radians(45)
    pitch = np.zeros(n)
    roll = np.zeros(n)
    p = r = 0.0
    for i in range(n):
        vx, vy = vel[i, 0], vel[i, 1]
        speed = math.hypot(vx, vy)
        if speed > 3.0:
            target = math.atan2(vy, vx)
            delta = (target - y + math.pi) % (2 * math.pi) - math.pi
            y += delta * min(1, dt / 0.35)
        if ts[i] > 13.4:
            # hold heading toward the illustrative disruption while observing
            target = math.atan2(INCIDENT[1] - pos[i, 1], INCIDENT[0] - pos[i, 0])
            delta = (target - y + math.pi) % (2 * math.pi) - math.pi
            y += delta * min(1, dt / 0.8)
        yaw[i] = y
        fwd = np.array([math.cos(y), math.sin(y)])
        left = np.array([-math.sin(y), math.cos(y)])
        v_f = vel[i, :2] @ fwd
        a_f = acc[i, :2] @ fwd
        a_l = acc[i, :2] @ left
        g = 9.81 + acc[i, 2]
        tp = math.atan((a_f + 0.0046 * v_f * abs(v_f)) / g)
        tr = math.atan(-a_l / g)
        tp = max(-0.5, min(0.5, tp))
        tr = max(-0.55, min(0.55, tr))
        p += (tp - p) * min(1, dt / 0.12)
        r += (tr - r) * min(1, dt / 0.12)
        pitch[i], roll[i] = p, r
    return ts, pos, yaw, pitch, roll


def keyframe_drone(root, gimbal, props, ts, pos, yaw, pitch, roll):
    step = 4
    prev = None
    for f in range(FRAMES + 1):
        i = min(len(ts) - 1, f * step)
        root.location = Vector(pos[i])
        q = Euler((roll[i], pitch[i], yaw[i]), "XYZ").to_quaternion()
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        prev = q
        root.rotation_quaternion = q
        root.keyframe_insert("location", frame=f)
        root.keyframe_insert("rotation_quaternion", frame=f)
        t = f / FPS
        # gimbal looks down at the intersection, then the disruption
        gimbal.rotation_euler = (0, math.radians(8 + 34 * smooth(CUE["scan"] - 0.4, CUE["incident"] + 0.6, t)) - pitch[i] * 0.85, 0)
        gimbal.keyframe_insert("rotation_euler", frame=f)
    # propellers: spool up before lift-off; ≤110°/frame keeps glTF slerp unambiguous
    angle = {ob.name: 0.0 for ob, _ in props}
    for f in range(FRAMES + 1):
        t = f / FPS
        rate = math.radians(110) * smooth(CUE["spinup"], CUE["spinup"] + 1.1, t)
        for ob, spin in props:
            angle[ob.name] += rate * spin
            ob.rotation_euler = (0, 0, angle[ob.name])
            ob.keyframe_insert("rotation_euler", frame=f)
    for ob in [root, gimbal] + [p for p, _ in props]:
        ad = ob.animation_data
        if ad and ad.action:
            for fc in iter_fcurves(ad.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"


def iter_fcurves(action):
    if hasattr(action, "fcurves") and action.fcurves is not None:
        try:
            yield from action.fcurves
            return
        except TypeError:
            pass
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


def build_camera(ts, pos, yaw, roll):
    cam_data = bpy.data.cameras.new("AETHER_Cam")
    cam_data.lens = 30
    cam_data.sensor_width = 36
    cam_data.clip_start = 0.05
    cam_data.clip_end = 4000
    cam = bpy.data.objects.new("AETHER_Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_mode = "QUATERNION"

    def drone_at(t):
        i = min(len(ts) - 1, int(round(t * FPS * 4)))
        return np.array(pos[i]), yaw[i], roll[i]

    D0 = np.array(PAD)
    city_focus = np.array([12.0, 14.0, 24.0])

    def rig_orbit(t):
        s = smooth(0, 3.8, t)
        th = math.radians(lerp(14, -30, s))
        r = lerp(2.4, 3.4, s)
        return D0 + np.array([math.cos(th) * r, math.sin(th) * r, lerp(0.32, 1.3, s)]), D0 + np.array([0, 0, 0.03 + 0.1 * s])

    orbit_end = rig_orbit(3.8)[0]
    crane_end = D0 + np.array([-11.0, -13.0, 9.5])

    def rig_crane(t):
        s = smooth(CUE["crane"] - 0.2, CUE["liftoff"] + 0.4, t)
        p0, p3 = orbit_end, crane_end
        p1, p2 = p0 + np.array([0, -7, 3.5]), p3 + np.array([5, 3, -4])
        p = (1 - s) ** 3 * p0 + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s * s * p2 + s**3 * p3
        tgt = D0 * (1 - s**0.8) + city_focus * s**0.8
        return p, tgt

    chase_keys = Hermite(
        [
            (CUE["liftoff"] - 0.8, (-8.5, -2.5, 4.2), Z0),
            (CUE["liftoff"] + 1.0, (-6.0, -3.0, 1.0), None),
            (CUE["chase"] - 0.2, (-6.0, -2.6, 1.4), None),
            (10.2, (-4.8, -2.4, 1.2), None),
            (11.6, (-4.5, -4.0, 2.0), None),
            (12.9, (-6.0, -3.0, 4.6), Z0),
        ]
    )

    def rig_chase(t):
        d, y, _ = drone_at(t)
        off = chase_keys(t)
        fwd = np.array([math.cos(y), math.sin(y), 0])
        left = np.array([-math.sin(y), math.cos(y), 0])
        p = d + fwd * off[0] + left * off[1] + np.array([0, 0, off[2]])
        # keep the drone upper-centre with the street ahead visible beneath it
        look = lerp(0.0, 2.5, smooth(CUE["chase"] - 1, CUE["chase"] + 0.8, t))
        drop = lerp(0.1, -1.3, smooth(CUE["scan"] - 0.5, CUE["incident"] + 0.8, t))
        tgt = d + fwd * look + np.array([0, 0, drop])
        # while hovering, tilt toward the disruption so drone and incident share the frame
        w = 0.5 * smooth(CUE["incident"] - 0.3, CUE["pullback"] + 0.1, t)
        return p, tgt * (1 - w) + np.array([INCIDENT[0], INCIDENT[1], 0.0]) * w

    aerial_end = np.array([-55.0, -245.0, 235.0])
    aerial_focus = np.array([45.0, 18.0, 0.0])

    def rig_aerial(t):
        start, start_tgt = rig_chase(CUE["pullback"])
        s = smooth(CUE["pullback"], DURATION - 0.3, t)
        s = 1 - (1 - s) ** 1.6
        p1, p2 = start + np.array([-4, -16, 12]), aerial_end + np.array([25, 70, -45])
        p = (1 - s) ** 3 * start + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s * s * p2 + s**3 * aerial_end
        tgt = start_tgt * (1 - s) + aerial_focus * s
        return p, tgt

    lo, hi = CUE["liftoff"] - 1.3, CUE["liftoff"] + 0.2
    raw_p, raw_t, raw_r = [], [], []
    for f in range(FRAMES + 1):
        t = f / FPS
        w = [
            1 - smooth(CUE["crane"], CUE["crane"] + 0.8, t),
            smooth(CUE["crane"], CUE["crane"] + 0.8, t) * (1 - smooth(lo, hi, t)),
            smooth(lo, hi, t) * (1 - smooth(CUE["pullback"], CUE["pullback"] + 1.0, t)),
            smooth(CUE["pullback"], CUE["pullback"] + 1.0, t),
        ]
        rigs = [rig_orbit(t), rig_crane(t), rig_chase(t), rig_aerial(t)]
        p = sum(wi * r[0] for wi, r in zip(w, rigs)) / sum(w)
        tg = sum(wi * r[1] for wi, r in zip(w, rigs)) / sum(w)
        raw_p.append(p)
        raw_t.append(tg)
        raw_r.append(drone_at(t)[2] * 0.3 * w[2])
    # zero-phase smoothing removes blend kinks without shifting timing
    def filt(arr, a):
        arr = np.array(arr, float)
        out = arr.copy()
        for i in range(1, len(out)):
            out[i] = out[i - 1] + (out[i] - out[i - 1]) * a
        for i in range(len(out) - 2, -1, -1):
            out[i] = out[i + 1] + (out[i] - out[i + 1]) * a
        return out

    P, T, R = filt(raw_p, 0.35), filt(raw_t, 0.3), filt(raw_r, 0.25)
    prev = None
    for f in range(FRAMES + 1):
        cam.location = Vector(P[f])
        d = Vector(T[f]) - Vector(P[f])
        q = d.to_track_quat("-Z", "Y") @ Quaternion((0, 0, 1), float(R[f]))
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        prev = q
        cam.rotation_quaternion = q
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
    return cam


# ───────────────────────── export ─────────────────────────


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)


def export(path, objs, cameras):
    select_only(objs)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_cameras=cameras,
        export_extras=True,
        export_yup=True,
        export_apply=False,
        export_image_format="WEBP",
        export_image_quality=82,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_animations=True,
        export_animation_mode="SCENE",
        export_anim_scene_split_object=False,
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_frame_range=True,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
    )
    print("EXPORTED", path, os.path.getsize(path))


def setup_render():
    world = bpy.data.worlds.new("dusk")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    # dusk gradient by view elevation: warm horizon band → deep blue zenith
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.09, 0.05, 0.05, 1)
    els[1].position, els[1].color = 0.45, (0.004, 0.008, 0.025, 1)
    mid = els.new(0.08)
    mid.color = (0.05, 0.035, 0.06, 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    sun = bpy.data.lights.new("dusk_sun", "SUN")
    sun.energy = 0.6
    sun.color = (1.0, 0.62, 0.42)
    so = bpy.data.objects.new("dusk_sun", sun)
    so.rotation_euler = (math.radians(80), 0, math.radians(-120))
    scene.collection.objects.link(so)
    moon = bpy.data.lights.new("sky_fill", "SUN")
    moon.energy = 0.15
    moon.color = (0.5, 0.65, 1.0)
    mo = bpy.data.objects.new("sky_fill", moon)
    mo.rotation_euler = (math.radians(35), 0, math.radians(40))
    scene.collection.objects.link(mo)
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 32
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy" if "AgX - Punchy" in [i.identifier for i in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 80
    for m in bpy.data.materials:
        if m.name.startswith("fx_lightpool") or m.name == "drone_propdisc":
            for o in bpy.data.objects:
                if o.type == "MESH" and o.data.materials and o.data.materials[0] == m:
                    o.hide_render = True


def main():
    os.makedirs(OUT, exist_ok=True)
    tex = build_textures()
    city = build_city(tex)
    protos = vehicles(city)
    traffic_meta(city)
    root, gimbal, props = build_drone()
    ts, pos, yaw, pitch, roll = sample_drone()
    keyframe_drone(root, gimbal, props, ts, pos, yaw, pitch, roll)
    cam = build_camera(ts, pos, yaw, roll)
    scene.frame_set(0)

    city_objs = [o for o in city.all_objects]
    drone_objs = [o for o in bpy.data.collections["AETHER_Drone"].all_objects]
    export(os.path.join(OUT, "aether-city.glb"), city_objs + [cam], True)
    export(os.path.join(OUT, "aether-drone.glb"), drone_objs, False)

    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print("TRIANGLES", tris)
    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND), compress=True)
    shots = []
    if POSTER:
        shots.append((int(15.6 * FPS), "intro-poster.webp"))
    if "--previews" in ARGS:
        shots += [(int(t * FPS), f"preview-{t:05.2f}.webp") for t in (0.8, 2.6, 4.6, 6.4, 7.6, 9.2, 10.8, 12.2, 13.6, 16.5)]
    if shots:
        setup_render()
        if "--previews" in ARGS:
            scene.render.resolution_percentage = 50
            scene.eevee.taa_render_samples = 8
        for frame, name in shots:
            scene.frame_set(frame)
            scene.render.filepath = os.path.join(OUT, name)
            bpy.ops.render.render(write_still=True)
            print("RENDERED", name)


if __name__ == "__main__":  # importable by aether_hero_kit.py for its mesh helpers
    main()
