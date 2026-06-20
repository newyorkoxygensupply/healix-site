"""
Product image generator — creates professional product card PNGs using Pillow.
Images are cached to disk after first generation.
"""
from PIL import Image, ImageDraw, ImageFont
import hashlib, os, textwrap
from pathlib import Path

# ── Font paths ─────────────────────────────────────────────────────────────────
_FONT_DIR  = "/usr/share/fonts/truetype/dejavu"
FONT_REG   = f"{_FONT_DIR}/DejaVuSans.ttf"
FONT_BOLD  = f"{_FONT_DIR}/DejaVuSans-Bold.ttf"
FONT_COND  = f"{_FONT_DIR}/DejaVuSansCondensed.ttf"
FONT_COND_B= f"{_FONT_DIR}/DejaVuSansCondensed-Bold.ttf"

def _font(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

# ── Category palette ────────────────────────────────────────────────────────────
PALETTE = {
    "Gloves":               ("#EBF2FF", "#1E40AF", "#BFDBFE"),
    "Wound Care":           ("#FFF0F5", "#9D174D", "#FBCFE8"),
    "Incontinence":         ("#EFF6FF", "#1D4ED8", "#BFDBFE"),
    "Diagnostic Equipment": ("#F5F3FF", "#6D28D9", "#DDD6FE"),
    "OR & Surgery":         ("#F0FDF4", "#166534", "#BBF7D0"),
    "Respiratory":          ("#ECFEFF", "#0E7490", "#A5F3FC"),
    "IV & Vascular Access": ("#FFFBEB", "#92400E", "#FDE68A"),
    "Orthopedic & Rehab":   ("#FFF7ED", "#C2410C", "#FED7AA"),
    "Skin Care":            ("#F0FDF4", "#15803D", "#BBF7D0"),
    "PPE":                  ("#FEFCE8", "#854D0E", "#FEF08A"),
    "Patient Care":         ("#FDF2F8", "#9D174D", "#F9A8D4"),
    "Urology & Ostomy":     ("#F5F3FF", "#5B21B6", "#DDD6FE"),
    "Lab Supplies":         ("#ECFDF5", "#065F46", "#A7F3D0"),
    "Nutrition":            ("#FFFBEB", "#92400E", "#FDE68A"),
    "Textiles":             ("#EFF6FF", "#1E3A8A", "#BFDBFE"),
    "First Aid":            ("#FFF1F2", "#BE123C", "#FECDD3"),
    "Pharmacy":             ("#F0FDF4", "#14532D", "#BBF7D0"),
    "Mobility & DME":       ("#EFF6FF", "#1E40AF", "#BFDBFE"),
    "Dental":               ("#F8FAFC", "#334155", "#CBD5E1"),
    "Pediatric":            ("#FDF4FF", "#86198F", "#F0ABFC"),
}

CAT_ICONS = {
    # (x, y) scaled to 400x400 canvas
    "Gloves": [
        # Glove outline
        ("poly", [(160,120),(160,280),(180,300),(200,300),(220,300),(240,280),(240,200),(230,190),
                  (230,150),(220,145),(220,130),(210,128),(210,145),(200,143),(200,128),(190,126),
                  (190,145),(180,143),(180,128),(170,125),(170,200),(160,195),(160,120)]),
    ],
    "Wound Care": [
        ("rect", (170, 155, 230, 245), 8),   # box
        ("rect", (193,  95, 207, 305), 4),   # vertical bar of cross
        ("rect", (100, 193, 300, 207), 4),   # horizontal bar of cross
    ],
    "Respiratory": [
        ("arc",  (130, 140, 200, 260), 0, 360),  # left lung
        ("arc",  (200, 140, 270, 260), 0, 360),  # right lung
        ("line", [(200, 150), (200, 260)]),       # trachea divider
        ("line", [(200, 130), (200, 150)]),       # trachea
    ],
    "Diagnostic Equipment": [
        ("arc",  (140, 140, 260, 260), 0, 360),  # stethoscope circle
        ("arc",  (155, 155, 245, 245), 0, 360),
        ("line", [(200, 260), (200, 310)]),
        ("arc",  (175, 300, 225, 320), 180, 360),
    ],
    "OR & Surgery": [
        ("line", [(160, 200), (240, 200)]),   # scalpel
        ("line", [(200, 160), (200, 240)]),
        ("arc",  (155, 155, 245, 245), 0, 360),
    ],
    "PPE": [
        ("poly", [(200,120),(145,155),(145,220),(200,265),(255,220),(255,155),(200,120)]),  # shield
        ("poly", [(185,180),(195,205),(215,175),(220,195),(200,215),(180,195),(185,180)]),  # check
    ],
    "IV & Vascular Access": [
        ("line", [(200, 110), (200, 200)]),
        ("line", [(200, 200), (155, 270)]),
        ("line", [(200, 200), (245, 270)]),
        ("rect", (185, 105, 215, 130), 4),
    ],
    "Orthopedic & Rehab": [
        ("rect", (170, 130, 230, 270), 12),
        ("line", [(170, 200), (230, 200)]),
    ],
    "Skin Care": [
        ("arc",  (140, 120, 260, 280), 0, 360),
        ("arc",  (165, 145, 235, 255), 0, 360),
    ],
    "Lab Supplies": [
        ("poly", [(185, 110), (185, 190), (155, 270), (245, 270), (215, 190), (215, 110), (185, 110)]),
        ("line", [(180, 170), (220, 170)]),
    ],
    "Patient Care": [
        ("arc",  (160, 110, 240, 190), 0, 360),   # head
        ("arc",  (140, 200, 260, 310), 180, 360),  # body
    ],
    "Urology & Ostomy": [
        ("arc",  (150, 120, 250, 260), 0, 360),
        ("line", [(185, 260), (170, 310)]),
        ("line", [(215, 260), (230, 310)]),
        ("line", [(170, 310), (230, 310)]),
    ],
    "First Aid": [
        ("rect", (150, 150, 250, 250), 8),
        ("rect", (188, 140, 212, 260), 0),  # cross vertical
        ("rect", (140, 188, 260, 212), 0),  # cross horizontal
    ],
    "Pharmacy": [
        ("rect", (163, 130, 237, 270), 10),
        ("rect", (175, 160, 225, 240), 4),
        ("rect", (185, 188, 215, 212), 0),
        ("rect", (188, 175), None),  # skip
    ],
    "Mobility & DME": [
        ("arc",  (165, 230, 205, 270), 0, 360),  # wheel
        ("arc",  (195, 230, 235, 270), 0, 360),  # wheel
        ("line", [(185, 230), (160, 180)]),
        ("line", [(215, 230), (200, 180)]),
        ("line", [(160, 180), (230, 180)]),
        ("arc",  (190, 130, 210, 160), 0, 360),  # head
    ],
    "Dental": [
        ("poly", [(175,120),(155,170),(160,220),(180,260),(195,250),(200,240),(205,250),(220,260),
                  (240,220),(245,170),(225,120),(210,130),(200,150),(190,130),(175,120)]),
    ],
    "Pediatric": [
        ("arc",  (160, 120, 240, 200), 0, 360),  # head
        ("arc",  (155, 195, 245, 285), 180, 360), # body
        ("line", [(155, 240), (130, 290)]),
        ("line", [(245, 240), (270, 290)]),
    ],
    "Nutrition": [
        ("arc",  (160, 130, 240, 280), 0, 360),   # bottle
        ("rect", (183,  95, 217, 135), 6),          # bottle neck
        ("line", [(175, 200), (225, 200)]),
    ],
    "Textiles": [
        ("rect", (140, 140, 260, 260), 6),
        ("line", [(140, 180), (260, 180)]),
        ("line", [(140, 220), (260, 220)]),
        ("line", [(180, 140), (180, 260)]),
        ("line", [(220, 140), (220, 260)]),
    ],
}

def _draw_icon(draw, category, color, stroke=6):
    """Draw a simple medical icon for the given category."""
    icons = CAT_ICONS.get(category, [])
    for shape in icons:
        kind = shape[0]
        try:
            if kind == "line":
                pts = shape[1]
                for i in range(len(pts)-1):
                    draw.line([pts[i], pts[i+1]], fill=color, width=stroke)
            elif kind == "rect":
                x0,y0,x1,y1 = shape[1],shape[2],shape[3],shape[4]
                r = shape[5] if len(shape)>5 else 0
                draw.rounded_rectangle([(x0,y0),(x1,y1)], radius=r, outline=color, width=stroke)
            elif kind == "arc":
                draw.arc([shape[1],shape[2],shape[3],shape[4]], shape[5], shape[6],
                         fill=color, width=stroke)
            elif kind == "poly":
                pts = shape[1]
                for i in range(len(pts)):
                    draw.line([pts[i], pts[(i+1)%len(pts)]], fill=color, width=stroke)
        except Exception:
            pass

def generate_product_image(product_id, product_name, brand, category, size=(400,400)):
    """Generate a professional product card PNG. Returns bytes."""
    bg, fg, accent = PALETTE.get(category, ("#F8FAFC", "#334155", "#CBD5E1"))

    W, H = size
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # ── Background elements ─────────────────────────────────────────────────────
    # Subtle top accent stripe
    draw.rectangle([(0,0),(W,8)], fill=accent)

    # Icon background circle
    circle_r = 90
    cx, cy = W//2, H//2 - 20
    draw.ellipse([(cx-circle_r, cy-circle_r), (cx+circle_r, cy+circle_r)],
                 fill=accent)

    # ── Category icon ───────────────────────────────────────────────────────────
    _draw_icon(draw, category, fg, stroke=7)

    # ── Bottom label band ───────────────────────────────────────────────────────
    band_h = 110
    draw.rectangle([(0, H-band_h), (W, H)], fill="#FFFFFF")
    draw.rectangle([(0, H-band_h), (W, H-band_h+1)], fill=accent)

    # ── Brand name ──────────────────────────────────────────────────────────────
    brand_text = (brand or "").upper()[:20]
    f_brand = _font(FONT_COND_B, 22)
    draw.text((W//2, H-band_h+18), brand_text, fill=fg, font=f_brand, anchor="mm")

    # ── Product name (wrapped) ──────────────────────────────────────────────────
    name_clean = (product_name or "")
    # Shorten: remove brand name from beginning if present
    if name_clean.lower().startswith(brand.lower()):
        name_clean = name_clean[len(brand):].strip(" -—")
    name_clean = name_clean[:60]
    # Wrap to ~2 lines
    words = name_clean.split()
    lines = []
    current = ""
    for w in words:
        if len(current) + len(w) + 1 <= 28:
            current = (current + " " + w).strip()
        else:
            if current: lines.append(current)
            current = w
    if current: lines.append(current)
    lines = lines[:2]

    f_name = _font(FONT_COND, 15)
    y_name = H - band_h + 44
    for line in lines:
        draw.text((W//2, y_name), line, fill="#64748B", font=f_name, anchor="mm")
        y_name += 18

    # ── Category badge ──────────────────────────────────────────────────────────
    cat_short = (category or "")[:22]
    f_cat = _font(FONT_COND, 12)
    draw.text((W//2, H - 12), cat_short, fill="#94A3B8", font=f_cat, anchor="mm")

    # ── Convert to bytes ─────────────────────────────────────────────────────────
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


if __name__ == "__main__":
    # Quick test
    data = generate_product_image(
        "TEST001",
        "Dynarex Nitrile Powder-Free Gloves S 100ct",
        "Dynarex",
        "Gloves"
    )
    with open("/tmp/test_product.png", "wb") as f:
        f.write(data)
    print(f"Generated test image: {len(data):,} bytes → /tmp/test_product.png")
