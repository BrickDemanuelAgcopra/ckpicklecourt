"""Generates the placeholder court illustrations in public/images/.

Run:  python scripts/gen-court-images.py   (needs Pillow)
Replace the output with real photos whenever they are available.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "images"
SS = 2  # supersampling factor for smooth edges

THEMES = {
    "night": dict(sky=(14, 30, 22), sky2=(20, 44, 30), hill=(20, 46, 30), trees=[(14, 42, 28), (18, 52, 34), (22, 60, 30), (16, 40, 34)],
                  fence=(58, 72, 62), surround=(26, 72, 40), court=(150, 64, 46), kitchen=(60, 88, 72), lights=True),
    "day": dict(sky=(214, 230, 222), sky2=(236, 240, 232), hill=(54, 98, 64), trees=[(48, 100, 66), (60, 112, 70), (44, 92, 60), (70, 118, 76)],
                fence=(120, 134, 124), surround=(30, 92, 50), court=(204, 90, 62), kitchen=(92, 122, 104), lights=False),
    "dusk": dict(sky=(64, 56, 72), sky2=(206, 150, 102), hill=(34, 62, 44), trees=[(28, 56, 38), (36, 66, 42), (30, 50, 40), (42, 72, 46)],
                 fence=(84, 92, 86), surround=(28, 80, 44), court=(176, 76, 54), kitchen=(72, 100, 84), lights=True),
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def court_quad(x0, x1, y0, y1, top_l, top_r, bot_l, bot_r):
    """Point on a perspective quad: u across (0..1), v from far (0) to near (1)."""
    def p(u, v):
        lx = top_l + (bot_l - top_l) * v
        rx = top_r + (bot_r - top_r) * v
        return (lx + (rx - lx) * u, y0 + (y1 - y0) * v)
    return p


def draw_scene(w, h, theme, rng):
    t = THEMES[theme]
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    horizon = int(h * 0.30)
    fence_top, fence_bot = int(h * 0.44), int(h * 0.50)
    # sky gradient
    for y in range(horizon + 40):
        d.line([(0, y), (w, y)], fill=lerp(t["sky"], t["sky2"], y / (horizon + 40)))
    # hill + tree line
    d.rectangle([0, horizon, w, fence_bot], fill=t["hill"])
    for _ in range(int(w / 22)):
        r = rng.randint(int(h * 0.025), int(h * 0.045))
        cx = rng.randint(-r, w + r)
        cy = horizon + rng.randint(-r // 2, r // 3)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rng.choice(t["trees"]))
    # fence
    d.rectangle([0, fence_top, w, fence_bot], fill=t["fence"])
    for x in range(0, w, 14 * SS):
        d.line([(x, fence_top), (x, fence_bot)], fill=lerp(t["fence"], (0, 0, 0), 0.18), width=SS)
    # ground beyond the apron, then the surround (playing area apron)
    d.rectangle([0, fence_bot, w, h], fill=lerp(t["hill"], (0, 0, 0), 0.25))
    d.polygon([(0, h), (0, int(h * 0.62)), (int(w * 0.2), fence_bot), (int(w * 0.8), fence_bot), (w, int(h * 0.62)), (w, h)], fill=t["surround"])

    # two courts side by side in perspective
    y0, y1 = int(h * 0.525), int(h * 0.99)
    for left in (True, False):
        if left:
            p = court_quad(0, 0, y0, y1, w * 0.33, w * 0.49, w * 0.065, w * 0.48)
        else:
            p = court_quad(0, 0, y0, y1, w * 0.51, w * 0.67, w * 0.52, w * 0.935)
        quad = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)]
        d.polygon(quad, fill=t["court"])
        # kitchen (non-volley zone) either side of the net, net at v=0.6 (perspective-ish)
        d.polygon([p(0, 0.5), p(1, 0.5), p(1, 0.7), p(0, 0.7)], fill=t["kitchen"])
        lw = 3 * SS
        d.line(quad + [quad[0]], fill="white", width=lw)
        for v in (0.5, 0.7):
            d.line([p(0, v), p(1, v)], fill="white", width=lw)
        d.line([p(0.5, 0), p(0.5, 0.5)], fill="white", width=lw)
        d.line([p(0.5, 0.7), p(0.5, 1)], fill="white", width=lw)
        # net
        nl, nr = p(-0.05, 0.6), p(1.05, 0.6)
        net_h = h * 0.045
        for i in range(1, 12):
            x = nl[0] + (nr[0] - nl[0]) * i / 12
            d.line([(x, nl[1] - net_h), (x, nl[1])], fill=(70, 74, 72), width=SS)
        for j in range(1, 4):
            yy = nl[1] - net_h * j / 4
            d.line([(nl[0], yy), (nr[0], yy)], fill=(70, 74, 72), width=SS)
        d.line([(nl[0], nl[1] - net_h), (nr[0], nr[1] - net_h)], fill="white", width=4 * SS)
        for px in (nl[0], nr[0]):
            d.line([(px, nl[1] + 4 * SS), (px, nl[1] - net_h - 2 * SS)], fill=(30, 30, 30), width=5 * SS)

    if t["lights"]:
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        g = ImageDraw.Draw(glow)
        for fx in (0.15, 0.5, 0.85):
            cx, cy, r = int(w * fx), int(h * 0.40), int(w * 0.09)
            g.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 246, 214, 110))
        glow = glow.filter(ImageFilter.GaussianBlur(w * 0.03))
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
        d = ImageDraw.Draw(img)
        for fx in (0.15, 0.5, 0.85):
            cx, cy = int(w * fx), int(h * 0.40)
            d.rounded_rectangle([cx - 18 * SS, cy - 6 * SS, cx + 18 * SS, cy + 6 * SS], radius=4 * SS, fill=(255, 250, 232))
    return img


def paddle(length, face, edge, grip, angle, dots=True):
    """A pickleball paddle as an RGBA layer, rotated by angle (degrees)."""
    fw, fh = int(length * 0.46), int(length * 0.66)
    hw, hh = int(length * 0.12), int(length * 0.36)
    W, H = fw + 40, fh + hh + 40
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    fx0, fy0 = 20, 20
    r = int(fw * 0.32)
    # handle (throat + wrapped grip + butt cap)
    hx0 = fx0 + (fw - hw) // 2
    d.rounded_rectangle([hx0, fy0 + fh - r // 2, hx0 + hw, fy0 + fh + hh], radius=hw // 3, fill=grip)
    for k in range(9):
        yy = fy0 + fh + int(hh * 0.12) + k * int(hh * 0.095)
        d.line([(hx0, yy), (hx0 + hw, yy - int(hw * 0.5))], fill=lerp(grip, (255, 255, 255), 0.18), width=max(2, hw // 10))
    d.rounded_rectangle([hx0 - 3, fy0 + fh + hh - hw // 3, hx0 + hw + 3, fy0 + fh + hh], radius=hw // 4, fill=edge)
    # face with edge guard
    d.rounded_rectangle([fx0, fy0, fx0 + fw, fy0 + fh], radius=r, fill=edge)
    g = max(4, fw // 28)
    d.rounded_rectangle([fx0 + g, fy0 + g, fx0 + fw - g, fy0 + fh - g], radius=r - g, fill=face)
    # subtle sheen + logo band
    d.rounded_rectangle([fx0 + fw * 0.18, fy0 + fh * 0.12, fx0 + fw * 0.3, fy0 + fh * 0.7], radius=fw // 16, fill=lerp(face, (255, 255, 255), 0.22))
    d.line([(fx0 + g, fy0 + fh * 0.78), (fx0 + fw - g, fy0 + fh * 0.78)], fill=edge, width=max(3, fw // 30))
    if dots:
        d.ellipse([fx0 + fw * 0.42, fy0 + fh * 0.38, fx0 + fw * 0.62, fy0 + fh * 0.38 + fw * 0.2], outline=edge, width=max(3, fw // 40))
    return lay.rotate(angle, resample=Image.BICUBIC, expand=True)


def ball(diam, color=(232, 214, 62)):
    """A perforated pickleball with simple shading."""
    pad = 10
    lay = Image.new("RGBA", (diam + 2 * pad, diam + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    c = pad + diam / 2
    R = diam / 2
    steps = 24
    for i in range(steps, 0, -1):  # radial shading, light from upper-left
        rr = R * i / steps
        off = (R - rr) * 0.35
        d.ellipse([c - rr - off, c - rr - off, c + rr - off, c + rr - off], fill=lerp(lerp(color, (90, 80, 10), 0.35), lerp(color, (255, 255, 230), 0.45), 1 - i / steps))
    mask = Image.new("L", lay.size, 0)
    ImageDraw.Draw(mask).ellipse([c - R, c - R, c + R, c + R], fill=255)
    holes = ImageDraw.Draw(lay)
    hole_r = R * 0.11
    for ring, n in ((0.0, 1), (0.42, 6), (0.78, 10)):
        for k in range(n):
            a = 2 * math.pi * k / n + ring
            hx, hy = c + R * ring * math.cos(a), c + R * ring * math.sin(a)
            squash = 1 - ring * 0.45  # holes foreshorten toward the rim
            holes.ellipse([hx - hole_r * squash, hy - hole_r, hx + hole_r * squash, hy + hole_r], fill=lerp(color, (60, 50, 0), 0.6))
    out = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    out.paste(lay, (0, 0), mask)
    return out


def with_shadow(layer, blur, offset, alpha=110):
    pad = 3 * blur + max(abs(offset[0]), abs(offset[1]))
    size = (layer.width + 2 * pad, layer.height + 2 * pad)
    a = Image.new("L", size, 0)
    a.paste(layer.split()[3].point(lambda v: alpha if v > 8 else 0), (pad + offset[0], pad + offset[1]))
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.putalpha(a.filter(ImageFilter.GaussianBlur(blur)))
    out.alpha_composite(layer, (pad, pad))
    return out


def place(img, layer, cx, cy):
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


GREEN, GOLD, CREAM, GRIP = (22, 70, 40), (201, 163, 90), (236, 224, 196), (24, 26, 24)
EQUIP = {
    # name: list of (kind, x_frac, y_frac, size_frac_of_width, extra)
    "crossed": [("paddle", 0.40, 0.80, 0.42, (GREEN, GOLD, 28)), ("paddle", 0.62, 0.80, 0.42, (GOLD, GREEN, -30)),
                ("ball", 0.79, 0.93, 0.085, None), ("ball", 0.24, 0.95, 0.065, None)],
    "single": [("paddle", 0.70, 0.82, 0.44, (GREEN, GOLD, -24)), ("ball", 0.36, 0.92, 0.08, None), ("ball", 0.48, 0.96, 0.06, None)],
    "pair": [("paddle", 0.30, 0.83, 0.40, (GOLD, GREEN, 22)), ("ball", 0.66, 0.90, 0.075, None)],
}

IMAGES = [
    ("hero.jpg", 1200, 1600, "night", "crossed", 7),
    ("court-2.jpg", 1200, 1600, "day", "single", 11),
    ("court-3.jpg", 1200, 1600, "dusk", "pair", 23),
    ("court-4.jpg", 1600, 1146, "night", "single", 31),
    ("court-5.jpg", 1600, 1146, "day", "crossed", 47),
]


def render(name, w, h, theme, layout, seed):
    rng = random.Random(seed)
    W, H = w * SS, h * SS
    img = draw_scene(W, H, theme, rng).convert("RGBA")
    base = min(W, H * 0.9)
    for kind, xf, yf, sf, extra in EQUIP[layout]:
        if kind == "paddle":
            face, edge, ang = extra
            lay = paddle(int(base * sf), face, edge, GRIP, ang)
        else:
            lay = ball(int(base * sf))
        place(img, with_shadow(lay, int(base * 0.012), (int(base * 0.012), int(base * 0.02))), W * xf, H * yf - (0 if kind == "ball" else H * 0.08))
    img = img.convert("RGB").resize((w, h), Image.LANCZOS)
    img.save(OUT / name, quality=86, optimize=True, progressive=True)
    print("wrote", name)


if __name__ == "__main__":
    for spec in IMAGES:
        render(*spec)
