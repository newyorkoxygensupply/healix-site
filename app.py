"""
Healix — Production Flask backend (Exhaustive SEO Edition) — SQLite build
"""
import os, re, math, hashlib, logging, json, threading, urllib.parse, urllib.request, urllib.error
import sqlite3
from datetime import date
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, request, render_template, Response, redirect
from flask_compress import Compress

# ── Config ─────────────────────────────────────────────────────────────────────
load_dotenv()

BASE_DIR       = Path(__file__).parent
DB_PATH        = Path(os.getenv("DB_PATH", BASE_DIR / "medical_supplies.db"))
IMG_CACHE      = BASE_DIR / ".img_cache"
IMG_CACHE.mkdir(exist_ok=True)
SITE_URL       = os.getenv("SITE_URL", "http://localhost:8080").rstrip("/")
SITE_NAME      = os.getenv("SITE_NAME", "Healix")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
TODAY          = date.today().isoformat()

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
app.config.update(
    JSON_SORT_KEYS=False,
    COMPRESS_MIMETYPES=[
        "application/json", "text/html", "text/css",
        "application/javascript", "application/xml", "text/xml", "text/plain",
    ],
    COMPRESS_LEVEL=6,
    COMPRESS_MIN_SIZE=512,
)
Compress(app)

@app.template_filter("format_thousands")
def format_thousands(n):
    try: return f"{int(n):,}"
    except: return str(n)

# ── Security headers ───────────────────────────────────────────────────────────
@app.after_request
def add_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options",        "SAMEORIGIN")
    resp.headers.setdefault("X-XSS-Protection",       "1; mode=block")
    resp.headers.setdefault("Referrer-Policy",        "strict-origin-when-cross-origin")
    if request.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp

# ── Database ───────────────────────────────────────────────────────────────────
_db_local = threading.local()

def get_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection (opened lazily per worker/thread)."""
    if not hasattr(_db_local, "conn"):
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA cache_size=-32000")    # 32 MB page cache per connection
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.execute("PRAGMA mmap_size=268435456")  # 256 MB memory-mapped I/O
        _db_local.conn = conn
    return _db_local.conn

# ── Startup — load navigation data (tiny) ─────────────────────────────────────
log.info("Connecting to %s …", DB_PATH)
_boot = sqlite3.connect(str(DB_PATH))
_boot.row_factory = sqlite3.Row

TOTAL = _boot.execute("SELECT COUNT(*) FROM products").fetchone()[0]

# Create inquiries table if not exists
_boot.execute("""CREATE TABLE IF NOT EXISTS inquiries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    TEXT,
    product_name  TEXT,
    brand         TEXT,
    customer_name TEXT,
    phone         TEXT,
    email         TEXT,
    message       TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)""")
_boot.commit()

CATEGORIES: dict[str, list[str]] = {}
for _r in _boot.execute(
    "SELECT DISTINCT category, subcategory FROM products "
    "WHERE category != '' ORDER BY category, subcategory"
):
    _cat, _sub = _r["category"], _r["subcategory"] or ""
    if _cat not in CATEGORIES:
        CATEGORIES[_cat] = []
    if _sub and _sub not in CATEGORIES[_cat]:
        CATEGORIES[_cat].append(_sub)

BRANDS: list[str] = [
    _r["brand"] for _r in _boot.execute(
        "SELECT DISTINCT brand FROM products WHERE brand != '' ORDER BY brand"
    )
]
_boot.close()
log.info("Ready: %s products, %s categories, %s brands.",
         f"{TOTAL:,}", len(CATEGORIES), len(BRANDS))

# ── Query helper ───────────────────────────────────────────────────────────────
def _query(category="", subcategory="", brand="", avail="", latex_free="",
           sterile="", min_price="", max_price="", q="",
           sort="default", limit=24, offset=0):
    """
    Filtered, paginated SQLite query.
    Returns (total_count: int, rows: list[dict]).
    """
    db = get_db()

    from_sql    = "FROM products p"
    where_parts: list[str] = []
    params:      list      = []

    # Full-text search via FTS5 prefix matching
    if q:
        tokens = [t for t in q.lower().split() if len(t) >= 2]
        if tokens:
            fts_match = " ".join(f"{t}*" for t in tokens)
            from_sql  = ("FROM products p "
                         "JOIN products_fts fts ON fts.product_id = p.product_id")
            where_parts.append("fts.search_text MATCH ?")
            params.append(fts_match)

    if category:    where_parts.append("p.category = ?");             params.append(category)
    if subcategory: where_parts.append("p.subcategory = ?");          params.append(subcategory)
    if brand:       where_parts.append("p.brand = ?");                params.append(brand)
    if avail:       where_parts.append("p.availability = ?");         params.append(avail)
    if latex_free:  where_parts.append("LOWER(p.latex_free) = ?");    params.append(latex_free.lower())
    if sterile:     where_parts.append("LOWER(p.sterile) = ?");       params.append(sterile.lower())
    if min_price:
        where_parts.append(
            "CAST(REPLACE(REPLACE(p.price_each,'$',''),',','') AS REAL) >= ?"
        )
        params.append(float(min_price))
    if max_price:
        where_parts.append(
            "CAST(REPLACE(REPLACE(p.price_each,'$',''),',','') AS REAL) <= ?"
        )
        params.append(float(max_price))

    where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    total = db.execute(
        f"SELECT COUNT(*) {from_sql} {where_sql}", params
    ).fetchone()[0]

    order_sql = {
        "price_asc":  "ORDER BY CAST(REPLACE(REPLACE(p.price_each,'$',''),',','') AS REAL) ASC",
        "price_desc": "ORDER BY CAST(REPLACE(REPLACE(p.price_each,'$',''),',','') AS REAL) DESC",
        "name":       "ORDER BY p.product_name ASC COLLATE NOCASE",
        "brand":      "ORDER BY p.brand ASC COLLATE NOCASE",
    }.get(sort, "ORDER BY p.rowid ASC")

    rows = db.execute(
        f"SELECT p.* {from_sql} {where_sql} {order_sql} LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()

    return total, [dict(r) for r in rows]

# ── SEO content library ────────────────────────────────────────────────────────
CAT_SEO = {
    "Gloves": {
        "headline": "Medical Gloves — Exam, Surgical & Specialty Gloves",
        "intro": ("Healix stocks over 28,000 medical gloves from the world's leading manufacturers including "
                  "Ansell, Cardinal Health, Dynarex, Kimberly-Clark, McKesson, and Medline. Whether you need "
                  "nitrile exam gloves, latex surgical gloves, or chemotherapy-rated protection, our catalog "
                  "covers every clinical application, size, and thickness."),
        "keywords": ["nitrile gloves", "exam gloves", "surgical gloves", "latex gloves", "powder-free gloves",
                     "medical gloves bulk", "disposable gloves clinical"],
        "faq": [
            ("What is the difference between exam gloves and surgical gloves?",
             "Exam gloves are designed for non-sterile general examinations and procedures. Surgical gloves are sterile, "
             "manufactured to tighter tolerances, and required for invasive surgical procedures. Surgical gloves have a "
             "higher AQL (Acceptable Quality Level) standard."),
            ("Are nitrile gloves better than latex for medical use?",
             "Nitrile gloves are preferred for most clinical settings because they are latex-free (eliminating allergy risk), "
             "offer excellent chemical resistance, and are comparable in tactile sensitivity to latex. Many facilities have "
             "transitioned entirely to nitrile."),
            ("What thickness should I choose for exam gloves?",
             "For standard examinations, 3.0–4.5 mil thickness provides adequate protection. For chemotherapy drug handling "
             "or heavy chemical exposure, choose 5.0 mil or higher. Surgical gloves are typically 6.0–8.5 mil."),
            ("Can I buy medical gloves in bulk?",
             "Yes. Healix offers gloves by the box (50–300 count) and by the case (4–10 boxes). Bulk pricing is available "
             "for facilities purchasing 10+ cases."),
        ],
    },
    "Wound Care": {
        "headline": "Wound Care Supplies — Dressings, Bandages & Advanced Wound Management",
        "intro": ("Healix offers a comprehensive wound care catalog covering everything from basic adhesive bandages to "
                  "advanced antimicrobial dressings for complex chronic wounds. Our 30,000+ wound care products include "
                  "alginate dressings, foam dressings, hydrogel, compression bandages, negative pressure therapy, and "
                  "wound cleansers from top brands like 3M, Coloplast, ConvaTec, Medline, and Smith+Nephew."),
        "keywords": ["wound dressings", "wound care supplies", "compression bandages", "hydrogel dressings",
                     "alginate dressings", "wound cleansers", "foam dressings", "wound management"],
        "faq": [
            ("What type of dressing is best for a chronic wound?",
             "Chronic wounds such as diabetic ulcers, pressure injuries, and venous leg ulcers benefit from advanced "
             "moisture-retentive dressings. Alginate dressings absorb heavy exudate; foam dressings manage moderate exudate; "
             "hydrogel dressings rehydrate dry wounds. Consult your clinician for a wound-specific protocol."),
            ("How often should wound dressings be changed?",
             "Dressing change frequency depends on wound type and exudate level. Lightly exuding wounds may require changes "
             "every 3–7 days; heavily exuding wounds may require daily changes. Follow manufacturer guidance and clinical protocols."),
            ("What is the difference between sterile and non-sterile wound dressings?",
             "Sterile dressings are individually packaged and required for open wounds, surgical sites, and burns. "
             "Non-sterile dressings are suitable for intact skin or heavily colonized wounds where sterility is not critical."),
        ],
    },
    "Respiratory": {
        "headline": "Respiratory Supplies — Oxygen Concentrators, CPAP, Ventilators & More",
        "intro": ("Healix is your source for professional respiratory care equipment and disposables. Our catalog includes "
                  "home and portable oxygen concentrators, CPAP and BiPAP machines, ICU and portable ventilators, "
                  "nebulizers, suction catheters, tracheostomy supplies, nasal cannulas, and oxygen masks from brands "
                  "including ResMed, Philips Respironics, Inogen, DeVilbiss, CAIRE, Dräger, Medtronic, and Hamilton Medical."),
        "keywords": ["oxygen concentrator", "CPAP machine", "BiPAP machine", "ventilator", "portable oxygen concentrator",
                     "home oxygen therapy", "respiratory supplies", "nasal cannula", "nebulizer"],
        "faq": [
            ("What is the difference between a CPAP and a BiPAP machine?",
             "A CPAP (Continuous Positive Airway Pressure) delivers one constant pressure throughout the breathing cycle. "
             "A BiPAP (Bilevel Positive Airway Pressure) delivers two pressures — a higher IPAP during inhalation and a "
             "lower EPAP during exhalation — making it easier to breathe out and better suited for patients with COPD, "
             "central sleep apnea, or respiratory insufficiency."),
            ("What is the best portable oxygen concentrator for travel?",
             "FAA-approved portable oxygen concentrators (POCs) such as the Inogen One G5, Philips SimplyGo Mini, and "
             "CAIRE FreeStyle Comfort are popular travel choices. Key factors include battery life, weight, flow settings "
             "(pulse vs continuous), and FAA approval status."),
            ("How do home oxygen concentrators work?",
             "Home oxygen concentrators draw in room air, pass it through a molecular sieve (zeolite), and separate oxygen "
             "from nitrogen to deliver 90–96% pure oxygen. They run continuously on household current and eliminate the need "
             "for oxygen cylinders."),
            ("Do I need a prescription for a home oxygen concentrator?",
             "Yes. Oxygen concentrators are Class II medical devices that require a prescription from a licensed physician. "
             "They are typically covered by Medicare Part B and most private insurance when medically necessary."),
        ],
    },
    "Incontinence": {
        "headline": "Incontinence Supplies — Adult Briefs, Pads, Underwear & Underpads",
        "intro": ("Healix carries a full range of incontinence products for clinical facilities, home care, and personal use. "
                  "Our 22,000+ products include adult briefs (tab style), protective underwear, bladder control pads, "
                  "underpads, male guards, and fecal incontinence pouches from brands like Prevail, Tranquility, Tena, "
                  "Attends, Medline, and Depend."),
        "keywords": ["adult diapers", "incontinence briefs", "protective underwear", "bladder control pads",
                     "underpads", "incontinence supplies", "adult briefs tab style"],
        "faq": [
            ("What is the difference between incontinence briefs and protective underwear?",
             "Briefs (also called tab-style or adult diapers) fasten with adhesive tabs and can be changed without removing "
             "clothing — ideal for patients with limited mobility. Protective underwear pulls on like regular underwear and "
             "is better suited for ambulatory individuals with moderate incontinence."),
            ("How do I choose the right absorbency level?",
             "Light absorbency is designed for drips and light leaks. Moderate handles small to moderate voids. "
             "Heavy and maximum absorbency products manage full voids and are appropriate for overnight use or bedridden "
             "patients. Bariatric options are available for larger body sizes."),
        ],
    },
    "OR & Surgery": {
        "headline": "OR & Surgery Supplies — Surgical Instruments, Drapes, Gowns & Sutures",
        "intro": ("Healix supplies operating rooms and surgical suites with the full spectrum of sterile surgical supplies. "
                  "Our 22,000+ OR products include sutures, surgical gowns, procedure drapes, electrosurgical devices, "
                  "sponges, instrument trays, skin closure products, and hemostatic agents from Kimberly-Clark, Halyard, "
                  "Cardinal Health, Medline, Ethicon, and Mölnlycke."),
        "keywords": ["surgical supplies", "OR supplies", "sutures", "surgical drapes", "surgical gowns",
                     "electrosurgical", "hemostatic agents", "surgical instruments"],
        "faq": [
            ("What suture types are available for surgical use?",
             "Sutures are classified as absorbable (polyglycolic acid, chromic gut, Vicryl) or non-absorbable (nylon, "
             "polypropylene, silk). Absorbable sutures are used for internal tissues; non-absorbable for skin closure "
             "or situations requiring permanent strength. Size ranges from 0 (heavy) to 11-0 (ophthalmic/micro)."),
            ("What AAMI level should surgical gowns be?",
             "AAMI Level 1 is for minimal risk procedures; Level 2 for low risk with some fluid exposure; "
             "Level 3 for moderate risk with splash potential; Level 4 for high risk with prolonged fluid exposure. "
             "Most surgical procedures require Level 3 or Level 4 gowns."),
        ],
    },
    "IV & Vascular Access": {
        "headline": "IV & Vascular Access Supplies — Catheters, Lines & Infusion Sets",
        "intro": ("Healix provides healthcare facilities with a complete IV and vascular access supply chain covering "
                  "peripheral IV catheters, central line supplies, infusion sets, IV bags, extension sets, needleless "
                  "connectors, and blood collection products from BD, B.Braun, Baxter, ICU Medical, and Teleflex."),
        "keywords": ["IV catheter", "vascular access", "infusion sets", "central line", "IV supplies",
                     "peripheral catheter", "needleless connector"],
        "faq": [
            ("What sizes of IV catheters are available?",
             "Peripheral IV catheters range from 14G (large bore, trauma) to 26G (pediatric/fragile veins). "
             "The most common adult sizes are 18G and 20G. 22G is standard for pediatric patients. Gauge number "
             "increases as catheter size decreases."),
        ],
    },
    "PPE": {
        "headline": "Personal Protective Equipment — N95 Respirators, Gowns, Face Shields & Gloves",
        "intro": ("Healix maintains deep PPE inventory for hospitals, clinics, long-term care facilities, and emergency "
                  "preparedness programs. Our PPE catalog includes NIOSH-approved N95 respirators, isolation gowns, "
                  "face shields, surgical masks, goggles, and boot covers from 3M, Medline, Halyard, Cardinal Health, "
                  "and Alpha Pro Tech."),
        "keywords": ["N95 respirator", "PPE supplies", "isolation gowns", "face shields", "surgical masks",
                     "personal protective equipment", "NIOSH N95"],
        "faq": [
            ("What is the difference between an N95 and a surgical mask?",
             "N95 respirators are NIOSH-certified to filter at least 95% of airborne particles when properly fitted. "
             "Surgical masks are fluid-resistant barriers that protect against droplets but do not provide the same "
             "level of airborne particle filtration. N95s require a fit test for proper protection."),
            ("Are KN95 masks equivalent to N95?",
             "KN95 masks meet Chinese GB2626 standards and are designed to filter ≥95% of particles, but they are not "
             "NIOSH-certified. For healthcare settings, NIOSH-approved N95 respirators are the required standard."),
        ],
    },
    "Diagnostic Equipment": {
        "headline": "Diagnostic Equipment — Stethoscopes, Otoscopes, Blood Pressure & Monitoring",
        "intro": ("Healix stocks professional diagnostic equipment for clinical, exam room, and point-of-care use. "
                  "Our diagnostic catalog includes stethoscopes, blood pressure monitors, otoscopes, ophthalmoscopes, "
                  "thermometers, pulse oximeters, glucose meters, and rapid diagnostic tests from 3M Littmann, "
                  "Welch Allyn, Omron, MDF, ADC, and Medline."),
        "keywords": ["stethoscope", "otoscope", "blood pressure monitor", "pulse oximeter", "thermometer",
                     "diagnostic equipment medical", "point of care testing"],
        "faq": [
            ("What stethoscope is best for clinical use?",
             "The 3M Littmann Classic III and Cardiology IV are among the most widely used stethoscopes in clinical "
             "settings. For cardiology, the Cardiology IV offers superior acoustics. For general medicine and nursing, "
             "the Classic III provides excellent value and performance."),
        ],
    },
    "Orthopedic & Rehab": {
        "headline": "Orthopedic & Rehab Supplies — Braces, Supports, Splints & Therapy Equipment",
        "intro": ("Healix provides orthopedic and rehabilitation products for hospitals, physical therapy clinics, "
                  "sports medicine facilities, and home care. Our 16,000+ products include knee braces, ankle supports, "
                  "cervical collars, compression stockings, walking boots, crutches, and resistance bands from "
                  "Bauerfeind, DJO Global, Donjoy, Ossur, and 3M."),
        "keywords": ["knee brace", "ankle support", "orthopedic supplies", "compression stockings",
                     "walking boot", "rehabilitation supplies", "cervical collar"],
        "faq": [
            ("What compression level is recommended for DVT prevention?",
             "For DVT prophylaxis, graduated compression stockings of 15–20 mmHg or 20–30 mmHg are commonly used. "
             "Anti-embolism stockings (8–18 mmHg) are used for non-ambulatory patients. Always confirm with physician "
             "guidance for specific patient populations."),
        ],
    },
    "Skin Care": {
        "headline": "Medical Skin Care — Barrier Creams, Moisturizers & Wound Prevention",
        "intro": ("Healix carries medical-grade skin care products for pressure injury prevention, incontinence-associated "
                  "dermatitis, skin protection, and post-procedure care. Our range includes barrier creams, skin cleansers, "
                  "moisturizers, skin prep wipes, and antifungal treatments from 3M Cavilon, Medline, Coloplast Brava, "
                  "Dermarite, and Smith+Nephew Allevyn."),
        "keywords": ["barrier cream", "skin care medical", "pressure ulcer prevention", "incontinence skin care",
                     "moisture barrier", "wound prevention skin care"],
        "faq": [],
    },
    "Lab Supplies": {
        "headline": "Lab Supplies — Collection Tubes, Specimen Containers & Lab Equipment",
        "intro": ("Healix supplies clinical laboratories with specimen collection products, culture media, reagents, "
                  "pipettes, centrifuge tubes, and personal protective equipment. Our lab supplies catalog covers "
                  "blood collection, urinalysis, microbiology, and point-of-care testing from BD Vacutainer, "
                  "Greiner Bio-One, Sarstedt, and Fisher Scientific."),
        "keywords": ["lab supplies", "specimen collection", "blood collection tubes", "urinalysis supplies",
                     "pipettes", "centrifuge tubes", "clinical laboratory"],
        "faq": [],
    },
    "Patient Care": {
        "headline": "Patient Care Supplies — Bedpans, Basins, Feeding Tubes & ADL Aids",
        "intro": ("Healix provides the full range of patient care and activities of daily living (ADL) supplies for "
                  "hospitals, nursing homes, and home health agencies. Our 20,000+ products include bedpans, emesis basins, "
                  "urinals, feeding tubes, enteral nutrition sets, positioning aids, and bed protection products from "
                  "Medline, Dynarex, Drive Medical, and Cardinal Health."),
        "keywords": ["patient care supplies", "bedpan", "feeding tube", "enteral nutrition", "ADL aids",
                     "hospital patient care", "urinals medical"],
        "faq": [],
    },
    "Nutrition": {
        "headline": "Medical Nutrition — Enteral Formulas, Oral Supplements & Feeding Supplies",
        "intro": ("Healix stocks clinical nutrition products for patients requiring supplemental or complete nutritional "
                  "support. Our catalog includes tube feeding formulas, oral nutritional supplements, enteral feeding "
                  "pumps and sets, and thickening agents from Abbott (Ensure, Jevity), Nestlé Health Science "
                  "(Peptamen), Kate Farms, and Nestle Nutren."),
        "keywords": ["enteral nutrition", "tube feeding", "oral supplements", "Ensure", "Jevity",
                     "enteral formula", "medical nutrition"],
        "faq": [],
    },
    "Textiles": {
        "headline": "Medical Textiles — Gowns, Bed Linens, Towels & Reusable Apparel",
        "intro": ("Healix supplies healthcare facilities with high-quality medical textiles including patient gowns, "
                  "bed sheets, pillow cases, towels, wash cloths, staff apparel, and reusable drapes. Our textiles "
                  "meet AAMI and ASTM standards and are sourced from American Dawn, Medline, Standard Textile, "
                  "and Encompass Group."),
        "keywords": ["medical textiles", "patient gowns", "hospital linens", "bed sheets medical",
                     "reusable gowns", "healthcare apparel"],
        "faq": [],
    },
    "First Aid": {
        "headline": "First Aid Supplies — Kits, Bandages, Antiseptics & Emergency Supplies",
        "intro": ("Healix carries comprehensive first aid supplies for workplaces, schools, sports facilities, "
                  "and home use. Our first aid catalog includes OSHA-compliant first aid kits, adhesive bandages, "
                  "antiseptic wipes, cold packs, splints, tourniquets, and CPR supplies from 3M, McKesson, "
                  "Medline, and Bound Tree Medical."),
        "keywords": ["first aid kit", "bandages", "antiseptic wipes", "first aid supplies", "OSHA first aid",
                     "emergency supplies", "wound care first aid"],
        "faq": [],
    },
    "Pharmacy": {
        "headline": "Pharmacy Supplies — Pill Organizers, Syringes, Sharps & Dispensing",
        "intro": ("Healix supplies pharmacies and medication management programs with syringes, needles, sharps containers, "
                  "pill organizers, medication cups, and pharmaceutical packaging. Our pharmacy supplies come from "
                  "BD, Medline, Dynarex, Covidien, and Cardinal Health."),
        "keywords": ["pharmacy supplies", "syringes", "needles", "sharps containers", "pill organizers",
                     "medication cups", "pharmaceutical supplies"],
        "faq": [],
    },
    "Mobility & DME": {
        "headline": "Mobility & DME — Wheelchairs, Walkers, Crutches & Durable Medical Equipment",
        "intro": ("Healix provides durable medical equipment (DME) for patients requiring mobility assistance and "
                  "daily living support. Our DME catalog includes manual and transport wheelchairs, rollators, "
                  "standard and bariatric walkers, crutches, canes, bed rails, and bath safety products from "
                  "Drive Medical, Invacare, Medline, Graham Field, and Nova Medical."),
        "keywords": ["wheelchair", "walker", "crutches", "durable medical equipment", "DME",
                     "rollator", "mobility aids", "bath safety"],
        "faq": [
            ("Does Medicare cover durable medical equipment?",
             "Medicare Part B covers DME when prescribed by a physician and deemed medically necessary. Covered items "
             "include wheelchairs, walkers, hospital beds, oxygen equipment, CPAP machines, and certain other devices. "
             "Patients typically pay 20% of the Medicare-approved amount after the Part B deductible."),
        ],
    },
    "Dental": {
        "headline": "Dental Supplies — Disposables, Instruments & Infection Control",
        "intro": ("Healix supports dental offices and oral surgery centers with a complete line of dental disposables "
                  "and infection control products. Our dental catalog includes saliva ejectors, cotton rolls, "
                  "impression materials, prophy cups, dental masks, patient bibs, and sterilization supplies "
                  "from Crosstex, Palmero Healthcare, and Patterson Dental."),
        "keywords": ["dental supplies", "dental disposables", "dental infection control", "saliva ejectors",
                     "prophy cups", "dental masks", "dental office supplies"],
        "faq": [],
    },
    "Pediatric": {
        "headline": "Pediatric Supplies — Neonatal, Infant & Child Medical Equipment",
        "intro": ("Healix provides specialized medical supplies for neonatal ICUs, pediatric units, and children's "
                  "healthcare facilities. Our pediatric catalog includes neonatal skin care, pediatric catheters, "
                  "infant feeding supplies, child-sized blood pressure cuffs, pediatric nebulizers, and "
                  "developmental positioning products from Medline, BD, Covidien, and Natus Medical."),
        "keywords": ["pediatric supplies", "neonatal supplies", "infant medical supplies", "pediatric catheters",
                     "NICU supplies", "children medical supplies"],
        "faq": [],
    },
    "Urology & Ostomy": {
        "headline": "Urology & Ostomy Supplies — Catheters, Pouches & Ostomy Accessories",
        "intro": ("Healix is a comprehensive source for urological and ostomy supplies. Our catalog covers Foley catheters, "
                  "intermittent catheters, urinary drainage bags, ileostomy pouches, colostomy pouches, ostomy barriers, "
                  "skin care accessories, and irrigation sets from Coloplast, ConvaTec, Hollister, Bard, Rochester Medical, "
                  "and Nu-Hope Laboratories."),
        "keywords": ["ileostomy bags", "ostomy supplies", "Foley catheter", "urinary catheter",
                     "colostomy pouch", "ostomy wafer", "urostomy supplies", "ostomy accessories"],
        "faq": [
            ("What is the difference between a one-piece and two-piece ostomy system?",
             "A one-piece system has the adhesive skin barrier and pouch permanently attached as a single unit. "
             "It is simpler to apply and lower profile. A two-piece system separates the skin barrier (wafer/flange) "
             "from the pouch, allowing pouch changes without removing the barrier — beneficial for skin integrity "
             "and convenience for active patients."),
            ("How often should an ileostomy pouch be changed?",
             "One-piece pouches are typically changed every 1–3 days. Two-piece system barriers can last 3–5 days "
             "with pouch changes as needed (usually every 1–2 days). Change frequency depends on the seal integrity, "
             "skin condition, and output characteristics."),
            ("What brands of ileostomy supplies does Healix carry?",
             "Healix carries products from all major ostomy manufacturers including Coloplast (SenSura Mio, Assura, Brava), "
             "ConvaTec (ActiveLife, Sur-Fit Natura, Esteem+), Hollister (CenterPoint Lock, New Image, Premier), "
             "Marlen, Nu-Hope Laboratories, Cymed MicroSkin, Salts Healthcare, Dansac, and Welland Medical."),
            ("Are ostomy supplies covered by insurance?",
             "Medicare Part B covers ostomy supplies when prescribed by a physician. Most private insurance plans "
             "also provide coverage. Typically 1 month's supply is covered. Contact your insurance provider for "
             "specific benefit and reimbursement details."),
        ],
    },
}

BRAND_SEO = {
    "3M": "3M Health Care is a global leader in medical supplies, infection prevention, skin care, and wound management. Known for the 3M Littmann stethoscope line and 3M Cavilon skin care products.",
    "Coloplast": "Coloplast develops products and services that make life easier for people with intimate healthcare needs — ostomy, urology, continence, and wound care.",
    "ConvaTec": "ConvaTec is a global medical products company specializing in advanced wound care, ostomy care, continence and critical care. Known for ActiveLife, Sur-Fit Natura, and Durahesive products.",
    "Hollister": "Hollister Incorporated develops, manufactures, and markets healthcare products for ostomy care, continence care, and critical care worldwide.",
    "ResMed": "ResMed is a global leader in cloud-connected medical devices for sleep apnea, COPD, and other chronic diseases. Known for AirSense CPAP and AirCurve BiPAP machines.",
    "Philips Respironics": "Philips Respironics produces respiratory care devices including CPAP machines, BiPAP systems, ventilators, and oxygen therapy equipment for sleep and respiratory disorders.",
    "Inogen": "Inogen manufactures lightweight, portable oxygen concentrators for patients requiring supplemental oxygen therapy, enabling greater freedom and mobility.",
    "Medline": "Medline Industries is one of the largest privately held manufacturers and distributors of healthcare supplies in the United States, serving hospitals, long-term care facilities, and home health.",
    "BD": "Becton, Dickinson and Company (BD) is a global medical technology company that manufactures and sells medical devices, instrument systems, and reagents for healthcare professionals.",
    "Ansell": "Ansell is a global leader in protection solutions for healthcare, specializing in surgical gloves, exam gloves, and specialty protective products.",
    "Cardinal Health": "Cardinal Health is a global healthcare services company providing pharmaceutical and medical supply distribution, manufacturing, and consulting services.",
    "Medtronic": "Medtronic is the world's largest medical device company, manufacturing products across cardiac, neurological, diabetes, and surgical care specialties.",
    "Dräger": "Dräger is a leading international company in the fields of medical and safety technology, known for anesthesia workstations, ventilators, and patient monitoring.",
    "Hamilton Medical": "Hamilton Medical is a Swiss medical device company specializing in intelligent ventilation solutions for ICU and transport settings.",
    "Dynarex": "Dynarex Corporation is a leading manufacturer of disposable medical products serving hospitals, nursing homes, physicians, and consumers.",
    "McKesson": "McKesson Corporation is a healthcare distribution company providing pharmaceutical, medical supply distribution, and health information technology.",
    "Kimberly-Clark": "Kimberly-Clark Professional provides protective apparel, sterile procedure products, and infection prevention solutions for healthcare facilities.",
    "Halyard": "Halyard Health provides clinicians with medical devices for pain management and digestive health, as well as surgical and infection prevention products.",
    "Drive Medical": "Drive Medical manufactures durable medical equipment including wheelchairs, walkers, beds, and respiratory products for home care and clinical use.",
    "Invacare": "Invacare Corporation is a leading manufacturer of home and long-term care medical products including wheelchairs, mobility scooters, and oxygen concentrators.",
    "Prevail": "Prevail is a leading brand in incontinence care products, offering briefs, underwear, pads, and underpads for adults requiring bladder and bowel management.",
    "Welch Allyn": "Welch Allyn (a Hill-Rom brand) manufactures diagnostic equipment including otoscopes, ophthalmoscopes, blood pressure monitors, and vital signs monitors.",
    "DeVilbiss Healthcare": "DeVilbiss Healthcare manufactures respiratory therapy and sleep therapy products including oxygen concentrators, CPAP machines, and portable nebulizers.",
    "CAIRE": "CAIRE Inc. manufactures home and portable oxygen therapy systems and respiratory products, including the FreeStyle Comfort and Eclipse portable concentrators.",
}

CAT_RELATED = {
    "Gloves":              ["PPE", "OR & Surgery", "Wound Care", "Lab Supplies"],
    "Wound Care":          ["Skin Care", "OR & Surgery", "First Aid", "Patient Care"],
    "Incontinence":        ["Skin Care", "Patient Care", "Urology & Ostomy", "Textiles"],
    "OR & Surgery":        ["Gloves", "PPE", "IV & Vascular Access", "Patient Care"],
    "Respiratory":         ["Diagnostic Equipment", "Patient Care", "Mobility & DME", "Pharmacy"],
    "IV & Vascular Access":["OR & Surgery", "Pharmacy", "Patient Care", "Lab Supplies"],
    "PPE":                 ["Gloves", "OR & Surgery", "Lab Supplies", "Dental"],
    "Diagnostic Equipment":["Pharmacy", "Patient Care", "Respiratory", "Lab Supplies"],
    "Orthopedic & Rehab":  ["First Aid", "Patient Care", "Mobility & DME", "Skin Care"],
    "Skin Care":           ["Wound Care", "Incontinence", "Patient Care", "First Aid"],
    "Lab Supplies":        ["Diagnostic Equipment", "Pharmacy", "PPE", "Gloves"],
    "Patient Care":        ["Incontinence", "Skin Care", "Nutrition", "Textiles"],
    "Nutrition":           ["Patient Care", "Pharmacy", "Pediatric", "Mobility & DME"],
    "Textiles":            ["Patient Care", "OR & Surgery", "Incontinence", "PPE"],
    "First Aid":           ["Wound Care", "Gloves", "PPE", "Pharmacy"],
    "Pharmacy":            ["Diagnostic Equipment", "Lab Supplies", "Patient Care", "First Aid"],
    "Mobility & DME":      ["Orthopedic & Rehab", "Respiratory", "Patient Care", "Skin Care"],
    "Dental":              ["Gloves", "PPE", "Lab Supplies", "OR & Surgery"],
    "Pediatric":           ["Patient Care", "Respiratory", "Nutrition", "Diagnostic Equipment"],
    "Urology & Ostomy":    ["Skin Care", "Patient Care", "Incontinence", "Lab Supplies"],
}

# ── Helpers ────────────────────────────────────────────────────────────────────
_SLUG_RE = re.compile(r"[^a-z0-9]+")

@app.template_filter('slugify')
def slugify(text: str) -> str:
    return _SLUG_RE.sub("-", (text or "").lower()).strip("-")

def _price_val(s):
    try: return float(str(s).replace("$","").replace(",","").strip())
    except: return 0.0

def _proxy_img(url):
    return url or ""

def _summary(p: dict) -> dict:
    return {
        "product_id":        p.get("product_id",""),
        "product_name":      p.get("product_name",""),
        "brand":             p.get("brand",""),
        "category":          p.get("category",""),
        "subcategory":       p.get("subcategory",""),
        "sku":               p.get("sku",""),
        "price_each":        p.get("price_each",""),
        "price_case":        p.get("price_case",""),
        "availability":      p.get("availability",""),
        "image_url_1":       _proxy_img(p.get("image_url_1","")),
        "size":              p.get("size",""),
        "color":             p.get("color",""),
        "unit_of_measure":   p.get("unit_of_measure",""),
        "quantity_per_unit": p.get("quantity_per_unit",""),
        "latex_free":        p.get("latex_free",""),
        "sterile":           p.get("sterile",""),
        "url":               f"/p/{p.get('product_id','')}/{slugify(p.get('product_name',''))}",
    }

def _seo_product_title(p: dict) -> str:
    return (f"{p['product_name']} — {p['brand']} | "
            f"{p.get('subcategory') or p['category']} | {SITE_NAME}")

def _seo_product_desc(p: dict) -> str:
    desc  = (p.get("description") or "").strip()
    price = p.get("price_each","")
    avail = p.get("availability","")
    brand = p.get("brand","")
    base  = f"Buy {p['product_name']} by {brand}. {price}"
    if avail: base += f" — {avail}."
    if desc:
        remaining = 155 - len(base) - 1
        if remaining > 30:
            base += " " + desc[:remaining]
    return base[:155]

def _seo_cat_title(cat, sub=None, total=0):
    if sub:
        return f"Buy {sub} Online | {cat} Supplies | {SITE_NAME} — {total:,} Products"
    return f"Buy {cat} Medical Supplies Online | {SITE_NAME} — {total:,} Products"

def _seo_cat_desc(cat, sub=None, total=0):
    kws    = CAT_SEO.get(cat, {}).get("keywords", [])
    kw_str = ", ".join(kws[:3]) if kws else f"{cat.lower()} supplies"
    if sub:
        return (f"Shop {total:,} {sub} products online. {kw_str}. "
                f"Clinical-grade quality from trusted brands. Fast shipping. — {SITE_NAME}")
    return (f"Shop {total:,} {cat} medical supplies online. {kw_str}. "
            f"Trusted brands, competitive pricing, fast shipping. — {SITE_NAME}")

# ── Main page ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    top_cats = list(CATEGORIES.keys())[:8]
    return render_template("index.html",
        site_name=SITE_NAME, site_url=SITE_URL,
        title=f"Medical Supplies Online | Buy {SITE_NAME} — {TOTAL:,}+ Clinical-Grade Products",
        description=(
            f"Shop {TOTAL:,}+ clinical-grade medical supplies at {SITE_NAME}. "
            "Gloves, wound care, oxygen concentrators, CPAP machines, ostomy supplies, PPE, "
            "IV supplies & more. Trusted brands, fast shipping."
        ),
        canonical=SITE_URL + "/",
        og_image=SITE_URL + "/static/img/og-default.jpg",
        top_cats=top_cats,
        total=TOTAL,
        brand_count=len(BRANDS),
    )

# ── Product page ───────────────────────────────────────────────────────────────
@app.route("/p/<product_id>")
@app.route("/p/<product_id>/<slug>")
def product_page(product_id, slug=None):
    row = get_db().execute(
        "SELECT * FROM products WHERE product_id = ?", [product_id]
    ).fetchone()
    if row is None:
        return render_template("404.html", site_name=SITE_NAME, site_url=SITE_URL,
                               title="Product Not Found"), 404
    p = dict(row)

    canonical_slug = slugify(p["product_name"])
    if slug != canonical_slug:
        return redirect(f"/p/{product_id}/{canonical_slug}", 301)

    for key in ("image_url_1","image_url_2","image_url_3","image_url_4"):
        if p.get(key): p[key] = _proxy_img(p[key])

    _, sim_rows  = _query(subcategory=p.get("subcategory",""), limit=9)
    similar      = [_summary(r) for r in sim_rows if r["product_id"] != product_id][:8]

    _, brand_rows = _query(brand=p.get("brand",""), limit=7)
    brand_products = [_summary(r) for r in brand_rows if r["product_id"] != product_id][:6]

    features = [f.strip() for f in (p.get("features","") or "").split("|") if f.strip()]
    specs = [
        ("SKU",          p.get("sku","")),
        ("UPC",          p.get("upc","")),
        ("Material",     p.get("material","")),
        ("Size",         p.get("size","")),
        ("Color",        p.get("color","")),
        ("Pack",         f"{p.get('quantity_per_unit','')} / {p.get('unit_of_measure','')}"),
        ("Pack Options", p.get("pack_options","")),
        ("Latex Free",   p.get("latex_free","")),
        ("Sterile",      p.get("sterile","")),
        ("FDA Class",    p.get("fda_class","")),
        ("Certifications",p.get("certifications","")),
        ("Country",      p.get("country_of_origin","")),
        ("Shelf Life",   f"{p.get('shelf_life_years','')} years" if p.get("shelf_life_years") else ""),
        ("Storage",      p.get("storage_temp","")),
    ]
    specs = [(l,v) for (l,v) in specs if v and str(v).strip() not in ("","N/A","/ ","")]

    faq = [
        (f"What is the SKU for {p['product_name'][:50]}?",
         f"The SKU is {p.get('sku','')}. {p.get('upc','') and 'UPC: ' + p['upc'] + '.' or ''}"),
        (f"Is {p['product_name'][:50]} available?",
         f"Current availability status is: {p.get('availability','In Stock')}. "
         f"Contact Healix for bulk orders and expedited fulfillment."),
        (f"What category is {p['product_name'][:40]} in?",
         f"This product is classified under {p['category']} > {p.get('subcategory','')}."),
    ]

    title       = _seo_product_title(p)
    description = _seo_product_desc(p)

    breadcrumbs = [{"name":"Home","url":SITE_URL+"/"}]
    if p.get("category"):
        breadcrumbs.append({"name":p["category"],"url":f"{SITE_URL}/c/{slugify(p['category'])}"})
    if p.get("subcategory"):
        breadcrumbs.append({"name":p["subcategory"],
                            "url":f"{SITE_URL}/c/{slugify(p['category'])}/{slugify(p['subcategory'])}"})
    breadcrumbs.append({"name":p["product_name"],
                        "url":f"{SITE_URL}/p/{product_id}/{canonical_slug}"})

    avail_schema = ("http://schema.org/InStock"
                    if p.get("availability") == "In Stock"
                    else "http://schema.org/LimitedAvailability"
                    if "Limited" in p.get("availability","")
                    else "http://schema.org/OutOfStock")

    brand_desc = BRAND_SEO.get(p.get("brand",""), "")
    brand_slug = slugify(p.get("brand",""))

    return render_template("product.html",
        site_name=SITE_NAME, site_url=SITE_URL,
        title=title, description=description,
        canonical=f"{SITE_URL}/p/{product_id}/{canonical_slug}",
        og_image=_proxy_img(p.get("image_url_1","")),
        p=p, features=features, specs=specs,
        similar=similar, brand_products=brand_products,
        breadcrumbs=breadcrumbs, faq=faq,
        price_val=_price_val(p.get("price_each","")),
        avail_schema=avail_schema,
        brand_desc=brand_desc, brand_slug=brand_slug,
        today=TODAY,
    )

# ── Category page ──────────────────────────────────────────────────────────────
@app.route("/c/<cat_slug>")
@app.route("/c/<cat_slug>/<sub_slug>")
def category_page(cat_slug, sub_slug=None):
    cat = next((c for c in CATEGORIES if slugify(c) == cat_slug), None)
    if not cat:
        return render_template("404.html", site_name=SITE_NAME, site_url=SITE_URL,
                               title="Category Not Found"), 404
    sub = None
    if sub_slug:
        sub = next((s for s in CATEGORIES[cat] if slugify(s) == sub_slug), None)
        if not sub:
            return redirect(f"/c/{cat_slug}", 301)

    total, preview_rows = _query(category=cat, subcategory=sub or "", limit=24)
    preview = [_summary(r) for r in preview_rows]

    # Top brands in this category (SQL GROUP BY — no full scan needed)
    top_brand_rows = get_db().execute(
        "SELECT brand, COUNT(*) as cnt FROM products "
        "WHERE category = ? AND brand != '' GROUP BY brand ORDER BY cnt DESC LIMIT 8",
        [cat]
    ).fetchall()
    top_brands = [r["brand"] for r in top_brand_rows]

    seo  = CAT_SEO.get(cat, {})
    faq  = seo.get("faq", [])
    rel  = CAT_RELATED.get(cat, [])

    title       = _seo_cat_title(cat, sub, total)
    description = _seo_cat_desc(cat, sub, total)

    breadcrumbs = [{"name":"Home","url":SITE_URL+"/"},
                   {"name":cat,"url":f"{SITE_URL}/c/{cat_slug}"}]
    if sub:
        breadcrumbs.append({"name":sub,"url":f"{SITE_URL}/c/{cat_slug}/{sub_slug}"})

    subcats = CATEGORIES.get(cat,[])

    return render_template("category.html",
        site_name=SITE_NAME, site_url=SITE_URL,
        title=title, description=description,
        canonical=SITE_URL + request.path,
        og_image=SITE_URL + "/static/img/og-default.jpg",
        cat=cat, sub=sub, cat_slug=cat_slug, sub_slug=sub_slug,
        subcats=subcats, total=total, products=preview,
        breadcrumbs=breadcrumbs,
        all_categories=CATEGORIES,
        cat_headline=seo.get("headline", f"{cat} Medical Supplies"),
        cat_intro=seo.get("intro",""),
        cat_keywords=seo.get("keywords",[]),
        faq=faq, related_cats=rel,
        top_brands=top_brands,
    )

# ── Brand page ─────────────────────────────────────────────────────────────────
@app.route("/brand/<brand_slug>")
def brand_page(brand_slug):
    brand = next((b for b in BRANDS if slugify(b) == brand_slug), None)
    if not brand:
        return render_template("404.html", site_name=SITE_NAME, site_url=SITE_URL,
                               title="Brand Not Found"), 404

    total, preview_rows = _query(brand=brand, limit=24)
    preview = [_summary(r) for r in preview_rows]

    brand_cats = [r["category"] for r in get_db().execute(
        "SELECT DISTINCT category FROM products WHERE brand = ? AND category != '' ORDER BY category",
        [brand]
    ).fetchall()]

    title = (f"Buy {brand} Medical Supplies Online | {SITE_NAME} — "
             f"{total:,} {brand} Products")
    description = (BRAND_SEO.get(brand, f"{brand} medical supplies.") + " " +
                   f"Shop {total:,} {brand} products at {SITE_NAME}. "
                   f"Clinical-grade quality, fast shipping, competitive pricing.")

    breadcrumbs = [
        {"name":"Home","url":SITE_URL+"/"},
        {"name":brand,"url":f"{SITE_URL}/brand/{brand_slug}"},
    ]

    return render_template("brand.html",
        site_name=SITE_NAME, site_url=SITE_URL,
        title=title, description=description,
        canonical=f"{SITE_URL}/brand/{brand_slug}",
        og_image=SITE_URL + "/static/img/og-default.jpg",
        brand=brand, brand_slug=brand_slug,
        brand_desc=BRAND_SEO.get(brand,""),
        total=total, products=preview,
        brand_cats=brand_cats, breadcrumbs=breadcrumbs,
        all_brands=BRANDS,
    )

# ── Brands index ───────────────────────────────────────────────────────────────
@app.route("/brands")
def brands_page():
    rows = get_db().execute(
        "SELECT brand, COUNT(*) as cnt FROM products "
        "WHERE brand != '' GROUP BY brand ORDER BY brand"
    ).fetchall()
    brand_data = [
        {"name":r["brand"], "slug":slugify(r["brand"]),
         "count":r["cnt"],  "desc":BRAND_SEO.get(r["brand"],"")}
        for r in rows
    ]
    return render_template("brands.html",
        site_name=SITE_NAME, site_url=SITE_URL,
        title=f"All Medical Supply Brands | {SITE_NAME} — Shop by Brand",
        description=(f"Browse all {len(brand_data)} medical supply brands at {SITE_NAME}. "
                     f"Shop Coloplast, ConvaTec, Hollister, ResMed, 3M, Medline, Ansell and more."),
        canonical=f"{SITE_URL}/brands",
        og_image=SITE_URL + "/static/img/og-default.jpg",
        brands=brand_data,
    )

# ── API ────────────────────────────────────────────────────────────────────────
@app.route("/api/meta")
def meta():
    resp = jsonify({"total":TOTAL,"categories":CATEGORIES,"brands":BRANDS[:200]})
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp

@app.route("/api/products")
def products():
    q           = request.args.get("q","").strip()
    category    = request.args.get("category","").strip()
    subcategory = request.args.get("subcategory","").strip()
    brand       = request.args.get("brand","").strip()
    avail       = request.args.get("availability","").strip()
    latex_free  = request.args.get("latex_free","").strip()
    sterile     = request.args.get("sterile","").strip()
    sort_by     = request.args.get("sort","default")
    min_price   = request.args.get("min_price","")
    max_price   = request.args.get("max_price","")
    try:
        page     = max(1, int(request.args.get("page",1)))
        per_page = min(48, max(12, int(request.args.get("per_page",24))))
    except ValueError:
        return jsonify({"error":"Invalid page/per_page"}), 400

    total, rows = _query(
        category, subcategory, brand, avail, latex_free, sterile,
        min_price, max_price, q, sort_by,
        limit=per_page, offset=(page-1)*per_page,
    )

    total_pages = max(1, -(-total // per_page))
    page        = min(page, total_pages)

    return jsonify({
        "total":total, "page":page, "per_page":per_page,
        "total_pages":total_pages,
        "products":[_summary(r) for r in rows],
    })

@app.route("/api/product/<product_id>")
def product_detail(product_id):
    row = get_db().execute(
        "SELECT * FROM products WHERE product_id = ?", [product_id]
    ).fetchone()
    if row is None:
        return jsonify({"error":"Not found"}), 404
    detail = dict(row)
    for key in ("image_url_1","image_url_2","image_url_3","image_url_4"):
        if detail.get(key): detail[key] = _proxy_img(detail[key])
    return jsonify(detail)

@app.route("/api/similar/<product_id>")
def similar(product_id):
    row = get_db().execute(
        "SELECT subcategory FROM products WHERE product_id = ?", [product_id]
    ).fetchone()
    if row is None:
        return jsonify([])
    _, rows = _query(subcategory=row["subcategory"], limit=9)
    return jsonify([_summary(r) for r in rows if r["product_id"] != product_id][:8])

# ── Category image helpers ─────────────────────────────────────────────────────
CAT_IMG_DATA = {
    "gloves":           {"bg":"#dbeafe","fg":"#1e40af","label":"Medical Gloves",    "icons":["M160 100 C140 100 125 112 125 130 L125 200 C125 215 135 222 145 222 L175 222 C185 222 195 215 195 200 L195 130 C195 112 180 100 160 100Z M140 130 L140 222 M155 127 L155 222 M170 127 L170 222 M185 130 L185 222","M150 95 C130 95 115 108 115 125 L115 195 C115 210 125 220 140 220 L180 220 C195 220 205 210 205 195 L205 125 C205 108 190 95 170 95Z M130 125 L130 220","M155 90 C132 90 115 105 115 125 L115 200 C115 215 128 222 145 222 L175 222 C192 222 205 215 205 200 L205 125 C205 105 188 90 165 90Z"]},
    "wound-care":       {"bg":"#fce7f3","fg":"#9d174d","label":"Wound Care",        "icons":["M160 88 L160 232 M88 160 L232 160","M125 100 L195 100 L205 120 L205 210 L115 210 L115 120Z M140 145 L180 145 M140 165 L180 165"]},
    "incontinence":     {"bg":"#e0f2fe","fg":"#0369a1","label":"Incontinence",      "icons":["M160 80 C128 80 98 115 98 150 C98 185 126 215 160 222 C194 215 222 185 222 150 C222 115 192 80 160 80Z"]},
    "diagnostic":       {"bg":"#ede9fe","fg":"#5b21b6","label":"Diagnostic Equip.", "icons":["M128 110 C108 110 98 122 98 136 L98 188 C98 200 108 208 128 208 L192 208 C212 208 222 200 222 188 L222 136 C222 122 212 110 192 110Z M160 132 C146 132 135 143 135 157 C135 171 146 182 160 182 C174 182 185 171 185 157 C185 143 174 132 160 132Z M160 148 C155 148 150 152 150 157 C150 162 155 166 160 166 C165 166 170 162 170 157 C170 152 165 148 160 148Z","M125 95 C112 95 105 104 105 115 L105 205 C105 215 112 222 125 222 L195 222 C208 222 215 215 215 205 L215 115 C215 104 208 95 195 95Z M160 118 C148 118 138 128 138 140 C138 152 148 162 160 162 C172 162 182 152 182 140 C182 128 172 118 160 118Z"]},
    "or-surgery":       {"bg":"#dcfce7","fg":"#166534","label":"OR & Surgery",      "icons":["M120 98 L200 98 L210 120 L210 210 L110 210 L110 120Z M138 145 L182 145 M138 165 L182 165 M138 185 L168 185","M115 108 L200 175 M115 108 L128 122 M200 175 L188 188 M128 122 L200 175 M115 108 L105 112 L105 122 L115 108"]},
    "respiratory":      {"bg":"#cffafe","fg":"#0e7490","label":"Respiratory",       "icons":["M160 92 L160 130 M160 130 C138 130 116 143 116 168 C116 192 138 202 160 202 M160 130 C182 130 204 143 204 168 C204 192 182 202 160 202","M138 88 L182 88 L192 108 L192 222 L128 222 L128 108Z M138 88 L182 88 M148 130 L172 130 M148 150 L172 150"]},
    "iv":               {"bg":"#fef3c7","fg":"#92400e","label":"IV & Vascular",     "icons":["M160 78 L160 148 M160 148 L188 185 M160 148 L132 185 M148 148 L172 148 M157 78 L163 78 L165 95 L155 95Z","M148 80 L172 80 L180 105 L180 230 L140 230 L140 105Z M148 80 L172 80 M153 128 L167 128 M153 150 L167 150"]},
    "orthopedic":       {"bg":"#ffedd5","fg":"#c2410c","label":"Orthopedic & Rehab","icons":["M118 148 C118 124 136 106 160 106 C184 106 202 124 202 148 M106 168 L214 168 M128 168 L118 208 M192 168 L202 208","M128 92 C118 92 112 102 112 116 L112 190 C112 205 118 215 128 215 L192 215 C202 215 208 205 208 190 L208 116 C208 102 202 92 192 92Z M112 152 L208 152"]},
    "skin-care":        {"bg":"#f0fdf4","fg":"#15803d","label":"Skin Care",         "icons":["M160 82 C123 82 99 110 99 140 C99 170 123 192 160 200 C197 192 221 170 221 140 C221 110 197 82 160 82Z M141 140 C141 130 150 122 160 122 C170 122 179 130 179 140"]},
    "ppe":              {"bg":"#fef9c3","fg":"#854d0e","label":"PPE",               "icons":["M160 84 L120 96 L120 155 C120 178 138 196 160 204 C182 196 200 178 200 155 L200 96Z M142 152 L155 165 L180 135","M118 118 L202 118 C202 118 205 105 202 95 L118 95 C115 105 118 118 118 118Z M118 118 L118 195 C118 210 138 220 160 220 C182 220 202 210 202 195 L202 118"]},
    "patient-care":     {"bg":"#fce7f3","fg":"#be185d","label":"Patient Care",      "icons":["M160 88 C147 88 136 99 136 112 C136 125 147 136 160 136 C173 136 184 125 184 112 C184 99 173 88 160 88Z M116 220 C116 193 136 178 160 178 C184 178 204 193 204 220"]},
    "ostomy":           {"bg":"#ede9fe","fg":"#6d28d9","label":"Urology & Ostomy",  "icons":["M160 92 C136 92 118 110 118 132 C118 155 136 170 160 178 C184 170 202 155 202 132 C202 110 184 92 160 92Z M160 178 L147 218 M160 178 L173 218 M147 218 L173 218"]},
    "lab":              {"bg":"#ecfdf5","fg":"#065f46","label":"Lab Supplies",       "icons":["M140 88 L140 152 C116 178 108 196 108 210 C108 228 126 238 160 238 C194 238 212 228 212 210 C212 196 204 178 180 152 L180 88 M134 116 L186 116 M140 88 L180 88","M155 88 L155 88 M145 88 L175 88 L178 110 L182 145 C182 165 172 178 160 178 C148 178 138 165 138 145 L142 110Z"]},
    "nutrition":        {"bg":"#fef3c7","fg":"#92400e","label":"Nutrition",         "icons":["M138 108 C138 90 182 90 182 108 L192 180 C192 218 128 218 128 180Z M138 130 L182 130"]},
    "textiles":         {"bg":"#f0f9ff","fg":"#0c4a6e","label":"Medical Textiles",  "icons":["M120 100 L136 90 L160 106 L184 90 L200 100 L190 128 L178 115 L178 212 L142 212 L142 115 L130 128Z"]},
    "first-aid":        {"bg":"#fff1f2","fg":"#be123c","label":"First Aid",         "icons":["M138 88 L182 88 L182 138 L232 138 L232 182 L182 182 L182 232 L138 232 L138 182 L88 182 L88 138 L138 138Z"]},
    "pharmacy":         {"bg":"#f0fdf4","fg":"#14532d","label":"Pharmacy",          "icons":["M128 90 L192 90 L192 120 L222 120 L222 165 L192 165 L192 195 L128 195 L128 165 L98 165 L98 120 L128 120Z","M130 102 L190 102 L190 130 L215 130 L215 158 L190 158 L190 185 L130 185 L130 158 L105 158 L105 130 L130 130Z"]},
    "mobility":         {"bg":"#eff6ff","fg":"#1e40af","label":"Mobility & DME",    "icons":["M118 148 C118 124 136 106 160 106 C184 106 202 124 202 148 M106 168 L214 168 M128 168 L118 208 M192 168 L202 208 M160 106 L160 90 M148 80 C148 72 154 68 160 68 C166 68 172 72 172 80 C172 88 160 90 160 90"]},
    "dental":           {"bg":"#f8fafc","fg":"#334155","label":"Dental",            "icons":["M130 80 C114 80 104 96 107 112 L116 178 C118 192 126 200 135 200 C144 200 148 192 148 192 C148 192 153 200 162 200 C171 200 179 192 182 178 L191 112 C194 96 184 80 170 80 C158 80 150 92 150 92 C150 92 142 80 130 80Z","M128 82 C112 82 102 98 106 114 L116 180 C118 194 126 200 135 200 C144 200 148 190 148 190 C148 190 153 200 162 200 C171 200 178 194 181 180 L192 114 C196 98 185 82 172 82 C160 82 150 94 150 94 C150 94 140 82 128 82Z"]},
    "pediatric":        {"bg":"#fdf4ff","fg":"#86198f","label":"Pediatric",         "icons":["M160 86 L170 116 L202 116 L178 135 L188 165 L160 148 L132 165 L142 135 L118 116 L150 116Z"]},
}

PEXELS_QUERIES = {
    "gloves":"medical disposable gloves","wound-care":"wound care medical dressing",
    "incontinence":"adult care medical supplies","diagnostic":"medical stethoscope equipment",
    "or-surgery":"surgical operating room","respiratory":"oxygen concentrator medical",
    "iv":"hospital IV intravenous drip","orthopedic":"physical therapy rehabilitation",
    "skin-care":"medical skin care cream","ppe":"medical protective mask PPE",
    "patient-care":"hospital patient care nursing","ostomy":"medical supply ostomy",
    "lab":"medical laboratory test tube","nutrition":"medical nutrition enteral",
    "textiles":"medical scrubs hospital uniform","first-aid":"first aid kit medical",
    "pharmacy":"pharmacy medicine pills capsules","mobility":"wheelchair disability mobility",
    "dental":"dental teeth equipment","pediatric":"pediatric children hospital medical",
}

_PEXELS_CACHE: dict[str, list[str]] = {}

def _fetch_pexels_photos(query: str, count: int = 8) -> list[str]:
    if not PEXELS_API_KEY:
        return []
    cache_key  = hashlib.sha1(f"pexels-{query}".encode()).hexdigest()
    cache_file = IMG_CACHE / f"{cache_key}.json"
    if cache_file.exists():
        try: return json.loads(cache_file.read_text())
        except Exception: pass
    try:
        url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page={count}&orientation=square"
        req = urllib.request.Request(url, headers={"Authorization": PEXELS_API_KEY})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        photos = [p["src"]["medium"] for p in data.get("photos",[])]
        if photos: cache_file.write_text(json.dumps(photos))
        return photos
    except Exception as e:
        log.warning("Pexels API error: %s", e)
        return []

@app.route("/api/photo/<cat_slug>/<int:n>")
def category_photo(cat_slug, n):
    if cat_slug not in _PEXELS_CACHE:
        query = PEXELS_QUERIES.get(cat_slug, "medical supplies")
        _PEXELS_CACHE[cat_slug] = _fetch_pexels_photos(query)
    photos = _PEXELS_CACHE.get(cat_slug, [])
    if photos:
        photo_url  = photos[n % len(photos)]
        cache_key  = hashlib.sha1(photo_url.encode()).hexdigest()
        cache_file = IMG_CACHE / cache_key
        if cache_file.exists():
            resp = Response(cache_file.read_bytes(), content_type="image/jpeg")
            resp.headers["Cache-Control"] = "public, max-age=604800"
            return resp
        try:
            req = urllib.request.Request(photo_url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer":    "https://www.pexels.com/",
            })
            with urllib.request.urlopen(req, timeout=10) as r:
                img_data = r.read()
            cache_file.write_bytes(img_data)
            resp = Response(img_data, content_type="image/jpeg")
            resp.headers["Cache-Control"] = "public, max-age=604800"
            return resp
        except Exception as e:
            log.debug("Pexels photo fetch failed: %s", e)
    return redirect(f"/api/catimg/{cat_slug}/{n % 2}")

@app.route("/api/has-photos")
def has_photos():
    return jsonify({"pexels": bool(PEXELS_API_KEY)})

@app.route("/api/catimg/<cat_slug>/<int:n>")
def category_image(cat_slug, n):
    data = CAT_IMG_DATA.get(cat_slug, CAT_IMG_DATA["patient-care"])
    bg, fg, label = data["bg"], data["fg"], data["label"]
    icons = data["icons"]
    icon  = icons[n % len(icons)]

    def darken(h, f):
        h = h.lstrip("#")
        r,g,b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        return f"#{min(255,int(r*f)):02x}{min(255,int(g*f)):02x}{min(255,int(b*f)):02x}"

    bg2    = darken(bg, 0.94)
    icon_c = darken(fg, 0.88 if n % 2 else 1.0)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <rect width="320" height="320" fill="{bg}"/>
  <rect x="10" y="10" width="300" height="300" rx="20" fill="{bg2}"/>
  <g stroke="{icon_c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="{icon}"/>
  </g>
  <rect x="0" y="266" width="320" height="54" fill="{fg}" opacity="0.09"/>
  <line x1="0" y1="267" x2="320" y2="267" stroke="{fg}" stroke-width="1.5" opacity="0.15"/>
  <text x="160" y="289" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="13" font-weight="700" fill="{fg}" text-anchor="middle">{label}</text>
  <text x="160" y="308" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="10" fill="{fg}" opacity="0.45" text-anchor="middle">Healix Medical Supply</text>
</svg>'''

    resp = Response(svg, mimetype="image/svg+xml")
    resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp

@app.route("/api/img")
def proxy_image():
    """Legacy image proxy — kept for URL compatibility."""
    return Response("", status=404)

@app.route("/api/inquiry", methods=["POST"])
def submit_inquiry():
    data  = request.get_json(silent=True) or {}
    name  = (data.get("customer_name") or "").strip()
    phone = (data.get("phone")         or "").strip()
    email = (data.get("email")         or "").strip()
    if not name or not phone or not email:
        return jsonify({"error": "Name, phone, and email are required"}), 400
    db = get_db()
    db.execute(
        """INSERT INTO inquiries
           (product_id, product_name, brand, customer_name, phone, email, message)
           VALUES (?,?,?,?,?,?,?)""",
        [data.get("product_id",""), data.get("product_name",""), data.get("brand",""),
         name, phone, email, (data.get("message") or "").strip()]
    )
    db.commit()
    try:
        _notify_inquiry(data)
    except Exception as e:
        log.warning("Inquiry notification failed: %s", e)
    return jsonify({"success": True})

def _notify_inquiry(data):
    """Send email notification for a new bulk pricing inquiry."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    to_email  = os.getenv("CONTACT_EMAIL", "newyorkoxygensupply@gmail.com")
    if not smtp_host or not smtp_user or not smtp_pass:
        log.info("SMTP not configured — inquiry saved to DB only.")
        return
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    subject = f"New Bulk Pricing Inquiry — {data.get('product_name','(unknown)')}"
    body = (
        f"New bulk pricing inquiry received:\n\n"
        f"Product:  {data.get('product_name','')}\n"
        f"Brand:    {data.get('brand','')}\n"
        f"SKU/ID:   {data.get('product_id','')}\n\n"
        f"Customer: {data.get('customer_name','')}\n"
        f"Phone:    {data.get('phone','')}\n"
        f"Email:    {data.get('email','')}\n\n"
        f"Notes:\n{data.get('message','(none)')}\n"
    )
    msg = MIMEMultipart()
    msg["From"]    = smtp_user
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    with smtplib.SMTP(smtp_host, smtp_port) as s:
        s.ehlo()
        s.starttls()
        s.login(smtp_user, smtp_pass)
        s.sendmail(smtp_user, to_email, msg.as_string())
    log.info("Inquiry notification sent to %s", to_email)

# ── robots.txt ─────────────────────────────────────────────────────────────────
@app.route("/robots.txt")
def robots():
    n_batches   = math.ceil(TOTAL / 50_000)
    sitemap_list = "\n".join(
        [f"Sitemap: {SITE_URL}/sitemap.xml",
         f"Sitemap: {SITE_URL}/sitemap-categories.xml",
         f"Sitemap: {SITE_URL}/sitemap-brands.xml"]
        + [f"Sitemap: {SITE_URL}/sitemap-products-{b}.xml" for b in range(1, n_batches+1)]
    )
    body = f"""User-agent: *
Allow: /
Allow: /c/
Allow: /p/
Allow: /brand/
Allow: /brands
Disallow: /api/
Disallow: /health
Disallow: /*?sort=
Disallow: /*?avail=
Disallow: /*?latex_free=
Disallow: /*?sterile=
Crawl-delay: 1

{sitemap_list}
"""
    return Response(body, mimetype="text/plain",
                    headers={"Cache-Control":"public, max-age=86400"})

# ── Sitemaps ───────────────────────────────────────────────────────────────────
SITEMAP_BATCH = 50_000

@app.route("/sitemap.xml")
def sitemap_index():
    n_batches = math.ceil(TOTAL / SITEMAP_BATCH)
    sitemaps  = (
        [(f"{SITE_URL}/sitemap-categories.xml", TODAY),
         (f"{SITE_URL}/sitemap-brands.xml",     TODAY)]
        + [(f"{SITE_URL}/sitemap-products-{b}.xml", TODAY) for b in range(1, n_batches+1)]
    )
    body  = '<?xml version="1.0" encoding="UTF-8"?>\n'
    body += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for loc, lastmod in sitemaps:
        body += f"  <sitemap><loc>{loc}</loc><lastmod>{lastmod}</lastmod></sitemap>\n"
    body += "</sitemapindex>"
    resp = Response(body, mimetype="application/xml")
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp

@app.route("/sitemap-categories.xml")
def sitemap_categories():
    entries = [("/", 1.0, "daily"), ("/brands", 0.8, "weekly")]
    for cat, subs in CATEGORIES.items():
        cs = slugify(cat)
        entries.append((f"/c/{cs}", 0.9, "weekly"))
        for sub in subs:
            entries.append((f"/c/{cs}/{slugify(sub)}", 0.8, "weekly"))
    body  = '<?xml version="1.0" encoding="UTF-8"?>\n'
    body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for path, pri, freq in entries:
        body += (f"  <url>"
                 f"<loc>{SITE_URL}{path}</loc>"
                 f"<lastmod>{TODAY}</lastmod>"
                 f"<changefreq>{freq}</changefreq>"
                 f"<priority>{pri}</priority>"
                 f"</url>\n")
    body += "</urlset>"
    resp = Response(body, mimetype="application/xml")
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp

@app.route("/sitemap-brands.xml")
def sitemap_brands():
    body  = '<?xml version="1.0" encoding="UTF-8"?>\n'
    body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for brand in BRANDS:
        loc = f"{SITE_URL}/brand/{slugify(brand)}"
        body += (f"  <url><loc>{loc}</loc>"
                 f"<lastmod>{TODAY}</lastmod>"
                 f"<changefreq>weekly</changefreq>"
                 f"<priority>0.7</priority></url>\n")
    body += "</urlset>"
    resp = Response(body, mimetype="application/xml")
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp

@app.route("/sitemap-products-<int:batch>.xml")
def sitemap_products(batch):
    start = (batch - 1) * SITEMAP_BATCH
    if start >= TOTAL:
        return Response("", status=404)
    rows = get_db().execute(
        "SELECT product_id, product_name, date_added FROM products LIMIT ? OFFSET ?",
        [SITEMAP_BATCH, start]
    ).fetchall()
    body  = '<?xml version="1.0" encoding="UTF-8"?>\n'
    body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for r in rows:
        loc   = f"{SITE_URL}/p/{r['product_id']}/{slugify(r['product_name'])}"
        added = r["date_added"] or TODAY
        body += (f"  <url><loc>{loc}</loc>"
                 f"<lastmod>{added}</lastmod>"
                 f"<changefreq>monthly</changefreq>"
                 f"<priority>0.6</priority></url>\n")
    body += "</urlset>"
    resp = Response(body, mimetype="application/xml")
    resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp

# ── Health ─────────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"status":"ok","products":TOTAL,"brands":len(BRANDS)})

# ── Error handlers ─────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error":"Not found"}), 404
    return render_template("404.html", site_name=SITE_NAME, site_url=SITE_URL,
                           title="Page Not Found"), 404

@app.errorhandler(500)
def server_error(e):
    log.exception("Internal error")
    if request.path.startswith("/api/"):
        return jsonify({"error":"Internal server error"}), 500
    return render_template("404.html", site_name=SITE_NAME, site_url=SITE_URL,
                           title="Server Error"), 500

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=8080, threaded=True)
