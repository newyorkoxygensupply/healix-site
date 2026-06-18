/* Healix — Frontend App v6 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  q: '', category: '', subcategory: '', brand: '',
  availability: '', latexFree: false, sterile: false,
  minPrice: '', maxPrice: '',
  sort: 'default', page: 1, perPage: 24,
  viewMode: 'grid',
  total: 0, totalPages: 1,
  meta: null,
  aiMode: false,
};

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const productGrid   = $('productGrid');
const pagination    = $('pagination');
const resultsLabel  = $('resultsLabel');
const activeChips   = $('activeChips');
const totalCount    = $('totalCount');
const catNavInner   = document.querySelector('.cat-nav-inner');
const subFilter     = $('subFilter');
const brandFilter   = $('brandFilter');
const brandSearch   = $('brandSearch');
const modalOverlay  = $('modalOverlay');
const modal         = $('modal');
const modalBody     = $('modalBody');
const toast         = $('toast');

// ── Category emoji map ────────────────────────────────────────────────────────
const CAT_EMOJI = {
  'Gloves': '🧤', 'Wound Care': '🩹', 'Incontinence': '🛡️',
  'Diagnostic Equipment': '🩺', 'OR & Surgery': '🔬',
  'Respiratory': '💨', 'IV & Vascular Access': '💉',
  'Orthopedic & Rehab': '🦾', 'Skin Care': '🌿',
  'PPE': '🦺', 'Patient Care': '🏥', 'Urology & Ostomy': '🫀',
  'Lab Supplies': '🧪', 'Nutrition': '🥛', 'Textiles': '🧺',
  'First Aid': '❤️‍🩹', 'Pharmacy': '💊', 'Mobility & DME': '♿',
  'Dental': '🦷', 'Pediatric': '👶', 'Medical Supplies': '⚕️',
};

// ── Category styles + SVG icon paths ─────────────────────────────────────────
const CAT_STYLE = {
  'Gloves':               { bg:'#dbeafe', fg:'#1e40af', icon:'M150 80 C120 80 100 100 100 130 L100 190 C100 210 115 220 130 220 L170 220 C185 220 200 210 200 190 L200 130 C200 100 180 80 150 80Z M120 130 L120 220 M140 125 L140 220 M160 125 L160 220 M180 130 L180 220' },
  'Wound Care':           { bg:'#fce7f3', fg:'#9d174d', icon:'M150 90 L150 210 M90 150 L210 150' },
  'Incontinence':         { bg:'#e0f2fe', fg:'#0369a1', icon:'M150 90 C120 90 100 115 100 145 C100 175 120 200 150 210 C180 200 200 175 200 145 C200 115 180 90 150 90Z' },
  'Diagnostic Equipment': { bg:'#ede9fe', fg:'#5b21b6', icon:'M130 100 C110 100 100 115 100 130 L100 180 C100 195 110 200 130 200 L170 200 C190 200 200 195 200 180 L200 130 C200 115 190 100 170 100 Z M150 125 C138 125 128 135 128 147 C128 159 138 169 150 169 C162 169 172 159 172 147 C172 135 162 125 150 125Z M150 137 C145 137 141 141 141 147 C141 153 145 157 150 157 C155 157 159 153 159 147 C159 141 155 137 150 137Z' },
  'OR & Surgery':         { bg:'#dcfce7', fg:'#166534', icon:'M120 100 L180 100 L190 120 L190 190 L110 190 L110 120 Z M135 130 L165 130 M135 150 L165 150 M135 170 L155 170' },
  'Respiratory':          { bg:'#cffafe', fg:'#0e7490', icon:'M150 95 L150 135 M150 135 C130 135 110 145 110 165 C110 185 130 195 150 195 M150 135 C170 135 190 145 190 165 C190 185 170 195 150 195 M150 195 L150 195' },
  'IV & Vascular Access': { bg:'#fef3c7', fg:'#92400e', icon:'M150 85 L150 145 M150 145 L180 185 M150 145 L120 185 M140 145 L160 145 M148 85 L152 85 L154 100 L146 100 Z' },
  'Orthopedic & Rehab':   { bg:'#ffedd5', fg:'#c2410c', icon:'M130 90 C120 90 115 100 115 115 L115 185 C115 200 120 210 130 210 L170 210 C180 210 185 200 185 185 L185 115 C185 100 180 90 170 90 Z M115 140 L185 140' },
  'Skin Care':            { bg:'#f0fdf4', fg:'#15803d', icon:'M150 90 C125 90 105 108 105 130 C105 155 125 175 150 185 C175 175 195 155 195 130 C195 108 175 90 150 90Z M135 130 C135 121 142 115 150 115 C158 115 165 121 165 130' },
  'PPE':                  { bg:'#fef9c3', fg:'#854d0e', icon:'M115 95 L150 85 L185 95 L185 145 C185 170 170 188 150 195 C130 188 115 170 115 145 Z M135 140 L148 153 L168 128' },
  'Patient Care':         { bg:'#fce7f3', fg:'#be185d', icon:'M150 90 C138 90 128 100 128 112 C128 124 138 134 150 134 C162 134 172 124 172 112 C172 100 162 90 150 90Z M110 210 C110 185 128 170 150 170 C172 170 190 185 190 210' },
  'Urology & Ostomy':     { bg:'#ede9fe', fg:'#6d28d9', icon:'M150 95 C130 95 115 110 115 128 C115 148 130 162 150 168 C170 162 185 148 185 128 C185 110 170 95 150 95Z M150 168 L140 210 M150 168 L160 210 M140 210 L160 210' },
  'Lab Supplies':         { bg:'#ecfdf5', fg:'#065f46', icon:'M130 90 L130 155 C130 178 140 195 150 200 C160 195 170 178 170 155 L170 90 M125 115 L175 115 M130 90 L170 90' },
  'Nutrition':            { bg:'#fef3c7', fg:'#92400e', icon:'M125 120 C125 100 175 100 175 120 L175 180 C175 200 125 200 125 180 Z M125 145 L175 145' },
  'Textiles':             { bg:'#f0f9ff', fg:'#0c4a6e', icon:'M105 120 L145 100 L195 120 L195 190 L105 190 Z M105 120 L105 190 M145 100 L145 190 M105 155 L195 155' },
  'First Aid':            { bg:'#fff1f2', fg:'#be123c', icon:'M150 90 L150 210 M90 150 L210 150', box: true },
  'Pharmacy':             { bg:'#f0fdf4', fg:'#14532d', icon:'M135 90 L165 90 L165 115 L190 115 L190 145 L165 145 L165 170 L135 170 L135 145 L110 145 L110 115 L135 115 Z' },
  'Mobility & DME':       { bg:'#eff6ff', fg:'#1e40af', icon:'M120 140 C120 120 135 105 150 105 C165 105 180 120 180 140 M110 160 L190 160 M130 160 L120 200 M170 160 L180 200 M150 105 L150 90 M150 90 C150 90 160 82 160 75 C160 68 154 65 150 65 C146 65 140 68 140 75 C140 82 150 90 150 90' },
  'Dental':               { bg:'#f8fafc', fg:'#334155', icon:'M135 90 C120 90 110 105 112 120 L120 175 C122 188 130 195 138 195 C146 195 150 188 150 188 C150 188 154 195 162 195 C170 195 178 188 180 175 L188 120 C190 105 180 90 165 90 C155 90 150 100 150 100 C150 100 145 90 135 90Z' },
  'Pediatric':            { bg:'#fdf4ff', fg:'#86198f', icon:'M150 90 C135 90 123 102 123 117 C123 132 135 144 150 144 C165 144 177 132 177 117 C177 102 165 90 150 90Z M120 210 C120 185 134 172 150 172 C166 172 180 185 180 210' },
};

// ── Product images — server-generated SVG via /api/catimg (same-origin) ────────
// Flask generates clean SVG images per category — no external requests ever.
const CAT_SLUG = {
  'Gloves':               'gloves',
  'Wound Care':           'wound-care',
  'Incontinence':         'incontinence',
  'Diagnostic Equipment': 'diagnostic',
  'OR & Surgery':         'or-surgery',
  'Respiratory':          'respiratory',
  'IV & Vascular Access': 'iv',
  'Orthopedic & Rehab':   'orthopedic',
  'Skin Care':            'skin-care',
  'PPE':                  'ppe',
  'Patient Care':         'patient-care',
  'Urology & Ostomy':     'ostomy',
  'Lab Supplies':         'lab',
  'Nutrition':            'nutrition',
  'Textiles':             'textiles',
  'First Aid':            'first-aid',
  'Pharmacy':             'pharmacy',
  'Mobility & DME':       'mobility',
  'Dental':               'dental',
  'Pediatric':            'pediatric',
};

// Stable hash → integer
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Returns a same-origin photo URL — uses Pexels if API key is set, else SVG icon
function getProductImageUrl(category, productId) {
  const slug = CAT_SLUG[category] || 'patient-care';
  const n    = hashCode(productId || '') % 8;
  return `/api/photo/${slug}/${n}`;
}

function getCatImgUrl(category, productId) {
  const slug = CAT_SLUG[category] || 'patient-care';
  const n    = hashCode(productId || '') % 8;
  return `/api/catimg/${slug}/${n}`;
}

function getPicsumUrl(productId) { return ''; }  // unused — server handles fallback

// SVG fallback — shown only if LoremFlickr fails to load
function getPlaceholderSVG(category, brand) {
  const style = CAT_STYLE[category] || { bg:'#f1f5f9', fg:'#64748b', icon:'M150 95 L150 205 M95 150 L205 150' };
  const { bg, fg, icon } = style;
  const brandLabel = (brand || '').slice(0, 14);
  const catLabel   = (category || 'Medical').slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="${bg}"/>
    <g transform="translate(100,80) scale(1.33)" stroke="${fg}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${icon}"/></g>
    <rect x="0" y="340" width="400" height="60" fill="${fg}" opacity="0.08"/>
    <text x="200" y="362" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="${fg}" text-anchor="middle">${brandLabel.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
    <text x="200" y="382" font-family="system-ui,sans-serif" font-size="11" fill="${fg}" text-anchor="middle" opacity="0.6">${catLabel.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function getPlaceholder(category) {
  return CAT_EMOJI[category] || '⚕️';
}

// 3-tier image fallback: img-proxy → Pexels → inline SVG
// Uses a step counter so there's no URL-comparison bug.
function imgFallback(el) {
  var step = parseInt(el.dataset.fbStep || '0', 10);
  if (step === 0) {
    el.dataset.fbStep = '1';
    el.src = el.dataset.px;   // try Pexels category photo
  } else if (step === 1) {
    el.dataset.fbStep = '2';
    el.src = el.dataset.sv;   // try server SVG
  } else {
    el.onerror = null;
    el.src = getPlaceholderSVG(el.dataset.cat || '', el.dataset.br || '');  // inline SVG — always works
  }
}

// ── SEO: History API URL + dynamic title ──────────────────────────────────────
const SITE_NAME = window.SITE_NAME || document.title.split('|').pop().trim();

function updateUrl() {
  const params = new URLSearchParams();
  if (state.q)           params.set('q',           state.q);
  if (state.category)    params.set('category',    state.category);
  if (state.subcategory) params.set('subcategory', state.subcategory);
  if (state.brand)       params.set('brand',       state.brand);
  if (state.availability)params.set('availability',state.availability);
  if (state.sort && state.sort !== 'default') params.set('sort', state.sort);
  if (state.page > 1)    params.set('page',        state.page);
  const qs = params.toString();
  history.replaceState(null, '', qs ? '?' + qs : '/');
}

function updateTitle() {
  let parts = [];
  if (state.q)            parts.push(`"${state.q}"`);
  if (state.subcategory)  parts.push(state.subcategory);
  else if (state.category)parts.push(state.category);
  if (state.page > 1)     parts.push(`Page ${state.page}`);
  const prefix = parts.length ? parts.join(' · ') + ' | ' : '';
  document.title = `${prefix}${SITE_NAME} — Medical Supplies`;
  // Update meta description dynamically
  const desc = document.querySelector('meta[name="description"]');
  if (desc) {
    desc.content = parts.length
      ? `Shop ${state.total?.toLocaleString() || ''} ${parts[0]} products — clinical-grade quality from trusted brands. ${SITE_NAME}.`
      : `Shop 298,000 clinical-grade medical supplies. Gloves, wound care, PPE, diagnostic equipment and more. ${SITE_NAME}.`;
  }
}

function readUrlState() {
  const p = new URLSearchParams(location.search);
  if (p.get('q'))           state.q            = p.get('q');
  if (p.get('category'))    state.category     = p.get('category');
  if (p.get('subcategory')) state.subcategory  = p.get('subcategory');
  if (p.get('brand'))       state.brand        = p.get('brand');
  if (p.get('availability'))state.availability = p.get('availability');
  if (p.get('sort'))        state.sort         = p.get('sort');
  if (p.get('page'))        state.page         = parseInt(p.get('page')) || 1;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Restore state from URL (for back/forward, shared links)
  readUrlState();

  // Load meta
  const res = await fetch('/api/meta');
  state.meta = await res.json();

  // Update hero stats
  $('statProducts').textContent  = Number(state.meta.total).toLocaleString();
  $('statCategories').textContent = Object.keys(state.meta.categories).length;
  $('statBrands').textContent    = state.meta.brands.length + '+';
  totalCount.textContent         = Number(state.meta.total).toLocaleString() + ' products';

  // Build category pills
  Object.keys(state.meta.categories).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill';
    btn.dataset.cat = cat;
    btn.textContent = (CAT_EMOJI[cat] || '⚕️') + ' ' + cat;
    btn.addEventListener('click', () => selectCategory(cat));
    catNavInner.appendChild(btn);
  });

  // Build brand filter
  renderBrandFilter('');

  // Events
  bindEvents();
  initAutocomplete();
  initAiToggle();

  // Initial load
  loadProducts();
}

// ── Event bindings ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Search
  $('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('searchBtn').addEventListener('click', doSearch);

  // Sort
  $('sortSelect').addEventListener('change', e => {
    state.sort = e.target.value; state.page = 1; loadProducts();
  });

  // Sidebar toggle
  function closeMobileSidebar() {
    $('sidebar').classList.remove('mobile-open');
    const bd = $('sidebarBackdrop');
    if (bd) bd.classList.remove('visible');
    document.body.style.overflow = '';
  }
  $('sidebarToggle').addEventListener('click', () => {
    const sidebar = $('sidebar');
    const bd      = $('sidebarBackdrop');
    if (window.innerWidth <= 900) {
      const isOpen = sidebar.classList.toggle('mobile-open');
      if (bd) bd.classList.toggle('visible', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });
  const _bd = $('sidebarBackdrop');
  if (_bd) _bd.addEventListener('click', closeMobileSidebar);

  // View toggle
  $('gridView').addEventListener('click', () => setView('grid'));
  $('listView').addEventListener('click', () => setView('list'));

  // Filters
  $('applyFilters').addEventListener('click', applyFilters);
  $('clearFilters').addEventListener('click', clearFilters);

  // Availability radios
  document.querySelectorAll('input[name="avail"]').forEach(r => {
    r.addEventListener('change', () => { state.availability = r.value; });
  });

  // Brand search
  brandSearch.addEventListener('input', e => renderBrandFilter(e.target.value));

  // Price inputs — apply on Enter
  $('minPrice').addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });
  $('maxPrice').addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });

  // Modal close
  $('modalClose').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeInquiry();
    }
  });
  // Inquiry overlay background click
  $('inquiryOverlay').addEventListener('click', e => { if (e.target === $('inquiryOverlay')) closeInquiry(); });
}

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch() {
  const q = $('searchInput').value.trim();
  if (state.aiMode && q) {
    doAiSearch(q);
  } else {
    state.q = q;
    state.page = 1;
    loadProducts();
  }
}

async function doAiSearch(q) {
  showSkeleton();
  const btn = $('searchBtn');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<svg class="ai-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> Thinking…';
  btn.disabled = true;

  try {
    const res  = await fetch('/api/ai-search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({q}),
    });
    const data = await res.json();

    // Apply AI-extracted params to state
    state.q           = data.params.q           || '';
    state.category    = data.params.category    || '';
    state.brand       = data.params.brand       || '';
    state.minPrice    = data.params.min_price   ? String(data.params.min_price) : '';
    state.maxPrice    = data.params.max_price   ? String(data.params.max_price) : '';
    state.latexFree   = !!data.params.latex_free;
    state.sterile     = !!data.params.sterile;
    state.page        = 1;
    state.total       = data.total;
    state.totalPages  = data.total_pages;

    renderProducts(data.products);
    renderPagination();
    renderAiBanner(data.interpretation, data.params);
    resultsLabel.textContent = Number(data.total).toLocaleString() + ' results';
    totalCount.textContent   = Number(data.total).toLocaleString() + ' products';
    updateUrl();
    updateTitle();
    hideAutocomplete();
  } catch(e) {
    state.q = q; state.page = 1;
    loadProducts();
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled  = false;
  }
}

function renderAiBanner(interpretation, params) {
  const banner = $('aiBanner');
  if (!banner || !interpretation) return;
  const chips = [];
  if (params.category)  chips.push(`<span class="ai-chip ai-chip-cat">📂 ${escHtml(params.category)}</span>`);
  if (params.brand)     chips.push(`<span class="ai-chip">🏷 ${escHtml(params.brand)}</span>`);
  if (params.sterile)   chips.push(`<span class="ai-chip">🧪 Sterile</span>`);
  if (params.latex_free)chips.push(`<span class="ai-chip">✅ Latex-Free</span>`);
  if (params.max_price) chips.push(`<span class="ai-chip">💰 Under $${params.max_price}</span>`);
  banner.innerHTML = `<span class="ai-spark">✨</span><span class="ai-banner-text"><strong>Smart Search:</strong> ${escHtml(interpretation)}</span>${chips.join('')}<button class="ai-banner-clear" onclick="clearAiBanner()" aria-label="Clear AI search">✕</button>`;
  banner.style.display = 'flex';
}

function clearAiBanner() {
  const banner = $('aiBanner');
  if (banner) banner.style.display = 'none';
}

// ── Category select ───────────────────────────────────────────────────────────
function selectCategory(cat) {
  state.category = cat;
  state.subcategory = '';
  state.page = 1;

  // Update pill active states
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  // Render subcategory filters
  renderSubFilter(cat);
  loadProducts();
}

function renderSubFilter(cat) {
  subFilter.innerHTML = '';
  if (!cat || !state.meta.categories[cat]) return;
  state.meta.categories[cat].forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'filter-item' + (state.subcategory === sub ? ' active' : '');
    btn.textContent = sub;
    btn.addEventListener('click', () => {
      state.subcategory = state.subcategory === sub ? '' : sub;
      state.page = 1;
      renderSubFilter(cat);
      loadProducts();
    });
    subFilter.appendChild(btn);
  });
}

function renderBrandFilter(query) {
  if (!state.meta) return;
  const q = query.toLowerCase();
  const filtered = state.meta.brands.filter(b => b.toLowerCase().includes(q)).slice(0, 60);
  brandFilter.innerHTML = '';
  filtered.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'filter-item' + (state.brand === b ? ' active' : '');
    btn.textContent = b;
    btn.addEventListener('click', () => {
      state.brand = state.brand === b ? '' : b;
      state.page = 1;
      renderBrandFilter(query);
      loadProducts();
    });
    brandFilter.appendChild(btn);
  });
}

// ── Filters ───────────────────────────────────────────────────────────────────
function applyFilters() {
  state.latexFree = $('latexFree').checked;
  state.sterile   = $('sterileOnly').checked;
  state.minPrice  = $('minPrice').value;
  state.maxPrice  = $('maxPrice').value;
  state.page = 1;
  loadProducts();
  // Close mobile sidebar
  $('sidebar').classList.remove('mobile-open');
}

function clearFilters() {
  state.q = ''; state.category = ''; state.subcategory = '';
  state.brand = ''; state.availability = '';
  state.latexFree = false; state.sterile = false;
  state.minPrice = ''; state.maxPrice = '';
  state.sort = 'default'; state.page = 1;

  $('searchInput').value = '';
  $('sortSelect').value = 'default';
  document.querySelectorAll('input[name="avail"]')[0].checked = true;
  $('latexFree').checked = false;
  $('sterileOnly').checked = false;
  $('minPrice').value = '';
  $('maxPrice').value = '';
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  subFilter.innerHTML = '';
  renderBrandFilter('');
  loadProducts();
}

function setView(mode) {
  state.viewMode = mode;
  productGrid.classList.toggle('list-mode', mode === 'list');
  $('gridView').classList.toggle('active', mode === 'grid');
  $('listView').classList.toggle('active', mode === 'list');
}

// ── Load Products ─────────────────────────────────────────────────────────────
async function loadProducts() {
  showSkeleton();
  updateActiveChips();

  const params = new URLSearchParams({
    q:            state.q,
    category:     state.category,
    subcategory:  state.subcategory,
    brand:        state.brand,
    availability: state.availability,
    sort:         state.sort,
    page:         state.page,
    per_page:     state.perPage,
  });
  if (state.latexFree) params.set('latex_free', 'Yes');
  if (state.sterile)   params.set('sterile', 'Yes');
  if (state.minPrice)  params.set('min_price', state.minPrice);
  if (state.maxPrice)  params.set('max_price', state.maxPrice);

  try {
    const res  = await fetch('/api/products?' + params);
    const data = await res.json();
    state.total = data.total;
    state.totalPages = data.total_pages;
    state.page = data.page;

    renderProducts(data.products);
    renderPagination();
    resultsLabel.textContent = Number(data.total).toLocaleString() + ' results';
    totalCount.textContent   = Number(data.total).toLocaleString() + ' products';
    updateUrl();
    updateTitle();
  } catch(e) {
    productGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading products</h3><p>Please try again.</p></div>';
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function showSkeleton() {
  productGrid.innerHTML = Array.from({length: 12}, () => `
    <div class="product-card" style="pointer-events:none;">
      <div class="card-img" style="background:var(--surface2)"><div class="skeleton" style="width:100%;height:100%"></div></div>
      <div class="card-body">
        <div class="skeleton" style="height:11px;width:60%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:13px;width:90%;margin-bottom:4px"></div>
        <div class="skeleton" style="height:13px;width:70%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:22px;width:40%"></div>
      </div>
    </div>
  `).join('');
}

// ── Render Products ───────────────────────────────────────────────────────────
function renderProducts(products) {
  if (!products.length) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No products found</h3>
        <p>Try different search terms or clear your filters.</p>
      </div>`;
    return;
  }

  productGrid.innerHTML = products.map((p, i) => {
    const avail    = p.availability || '';
    const badgeCls = avail === 'In Stock' ? 'badge-stock'
                   : avail.includes('Limited') ? 'badge-low'
                   : avail.includes('Backorder') ? 'badge-out' : 'badge-login';
    const badgeTxt = avail === 'In Stock' ? 'In Stock'
                   : avail.includes('Limited') ? 'Limited'
                   : avail.includes('Backorder') ? 'Backorder'
                   : avail.includes('Login') ? 'Login for price' : avail;

    const tags = [p.size, p.color, p.unit_of_measure].filter(t => t && t !== 'N/A').slice(0,3);
    const emoji = getPlaceholder(p.category);
    const delay = (i % 24) * 20;

    const productSlug = slugify(p.product_name);
    const productHref = `/p/${p.product_id}/${productSlug}`;
    const _slug = CAT_SLUG[p.category] || 'patient-care';
    const _n    = hashCode(p.product_id || '') % 8;
    const _pxUrl  = `/api/photo/${_slug}/${_n}`;
    const _svgUrl = getCatImgUrl(p.category, p.product_id);
    const _imgSrc = p.image_url_1
      ? `/api/img-proxy?url=${encodeURIComponent(p.image_url_1)}`
      : _pxUrl;
    return `
      <div class="product-card" style="animation-delay:${delay}ms" onclick="openProduct('${p.product_id}')">
      <a href="${productHref}" class="card-seo-link" aria-label="${escHtml(p.product_name)}" tabindex="-1"></a>
        <div class="card-img">
          <img src="${_imgSrc}"
               data-px="${_pxUrl}" data-sv="${_svgUrl}"
               data-cat="${escHtml(p.category)}" data-br="${escHtml(p.brand)}"
               alt="" role="presentation" loading="lazy"
               onerror="imgFallback(this)">
          <div class="img-placeholder" style="display:none">${emoji}</div>
          <span class="card-badge ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="card-body">
          <div class="card-brand">${escHtml(p.brand)}</div>
          <div class="card-name">${escHtml(p.product_name)}</div>
          <div class="card-meta">${tags.map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('')}</div>
          <div class="card-footer">
            <div class="card-price">
              ${escHtml(p.price_each)}
              <small>${escHtml(p.quantity_per_unit)} / ${escHtml(p.unit_of_measure)}</small>
            </div>
            <button class="card-bulk-btn" onclick="openInquiry(event,'${p.product_id}','${escHtml(p.product_name)}','${escHtml(p.brand)}')">Get Bulk Pricing</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination() {
  const { page, totalPages } = state;
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  const pages = paginationRange(page, totalPages);
  pagination.innerHTML = [
    `<button class="page-btn" onclick="goPage(${page-1})" ${page<=1?'disabled':''}>‹ Prev</button>`,
    ...pages.map(p => p === '…'
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-btn ${p===page?'active':''}" onclick="goPage(${p})">${p}</button>`),
    `<button class="page-btn" onclick="goPage(${page+1})" ${page>=totalPages?'disabled':''}>Next ›</button>`,
  ].join('');
}

function paginationRange(current, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  const r = [];
  r.push(1);
  if (current > 3) r.push('…');
  for (let p = Math.max(2, current-1); p <= Math.min(total-1, current+1); p++) r.push(p);
  if (current < total-2) r.push('…');
  r.push(total);
  return r;
}

function goPage(p) {
  if (p < 1 || p > state.totalPages) return;
  state.page = p;
  loadProducts();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// ── Active Chips ──────────────────────────────────────────────────────────────
function updateActiveChips() {
  const chips = [];
  if (state.q)            chips.push(['Search: ' + state.q, () => { state.q=''; $('searchInput').value=''; state.page=1; loadProducts(); }]);
  if (state.category)     chips.push([state.category, () => { selectCategory(''); state.page=1; loadProducts(); }]);
  if (state.subcategory)  chips.push([state.subcategory, () => { state.subcategory=''; state.page=1; loadProducts(); }]);
  if (state.brand)        chips.push([state.brand, () => { state.brand=''; renderBrandFilter(''); state.page=1; loadProducts(); }]);
  if (state.availability) chips.push([state.availability, () => { state.availability=''; document.querySelectorAll('input[name="avail"]')[0].checked=true; state.page=1; loadProducts(); }]);
  if (state.latexFree)    chips.push(['Latex Free', () => { state.latexFree=false; $('latexFree').checked=false; state.page=1; loadProducts(); }]);
  if (state.sterile)      chips.push(['Sterile Only', () => { state.sterile=false; $('sterileOnly').checked=false; state.page=1; loadProducts(); }]);
  if (state.minPrice)     chips.push(['Min $' + state.minPrice, () => { state.minPrice=''; $('minPrice').value=''; state.page=1; loadProducts(); }]);
  if (state.maxPrice)     chips.push(['Max $' + state.maxPrice, () => { state.maxPrice=''; $('maxPrice').value=''; state.page=1; loadProducts(); }]);

  activeChips.innerHTML = chips.map(([label], i) => `
    <span class="chip">${escHtml(label)}<button class="chip-remove" onclick="chipRemove(${i})">×</button></span>
  `).join('');
  activeChips._handlers = chips.map(([,fn]) => fn);
}

function chipRemove(i) {
  activeChips._handlers[i]();
}

// ── Product Modal ─────────────────────────────────────────────────────────────
async function openProduct(productId) {
  modalBody.innerHTML = `<div style="padding:80px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const [prodRes, simRes] = await Promise.all([
    fetch('/api/product/' + productId),
    fetch('/api/similar/' + productId),
  ]);
  const p  = await prodRes.json();
  const sim = await simRes.json();

  const avail = p.availability || '';
  const availCls = avail === 'In Stock' ? 'avail-in'
                 : avail.includes('Limited') ? 'avail-limit' : 'avail-out';

  const features = (p.features || '').split('|').map(f=>f.trim()).filter(Boolean);
  const specs = [
    ['SKU',            p.sku],
    ['UPC',            p.upc],
    ['Material',       p.material],
    ['Size',           p.size],
    ['Color',          p.color],
    ['Pack',           `${p.quantity_per_unit} / ${p.unit_of_measure}`],
    ['Pack Options',   p.pack_options],
    ['Latex Free',     p.latex_free],
    ['Sterile',        p.sterile],
    ['FDA Class',      p.fda_class],
    ['Certifications', p.certifications],
    ['Age Group',      p.age_group],
    ['Country',        p.country_of_origin],
    ['Shelf Life',     p.shelf_life_years ? p.shelf_life_years + ' years' : ''],
    ['Storage',        p.storage_temp],
    ['Weight',         p.weight_lbs ? p.weight_lbs + ' lbs' : ''],
    ['Dimensions',     p.dimensions_in ? p.dimensions_in + ' in' : ''],
  ].filter(([,v]) => v && v !== 'N/A' && v !== '');

  const imgs = [p.image_url_1, p.image_url_2, p.image_url_3, p.image_url_4].filter(Boolean);
  const emoji = getPlaceholder(p.category);

  modalBody.innerHTML = `
    <div class="modal-product">
      <!-- Gallery -->
      <div class="modal-gallery">
        <div class="modal-main-img" id="mainImgWrap">
          <img id="mainImg" src="${getProductImageUrl(p.category, p.product_id)}" alt="${escHtml(p.product_name)}"
               onerror="this.onerror=null;this.src='/api/catimg/patient-care/0'">
          <div id="mainImgPlaceholder" style="display:none"></div>
        </div>
        <div class="modal-thumbs">
          ${[0,1,2,3].map(i => {
            const src = getProductImageUrl(p.category, p.product_id + '_' + i);
            return `<div class="modal-thumb ${i===0?'active':''}" onclick="switchImg(this,'${src}')">
              <img src="${src}" alt="Product view ${i+1}" onerror="this.parentElement.style.display='none'">
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Info -->
      <div class="modal-info">
        <div>
          <div class="modal-cat">${escHtml(p.category)} → ${escHtml(p.subcategory)}</div>
          <h2 class="modal-title">${escHtml(p.product_name)}</h2>
          <div class="modal-brand">by ${escHtml(p.brand)} · SKU: ${escHtml(p.sku)}</div>
        </div>

        <div class="modal-price-block">
          <div class="modal-price-each">${escHtml(p.price_each)}</div>
          <div class="modal-price-case">Case: ${escHtml(p.price_case)}</div>
        </div>

        <div class="modal-avail ${availCls}">
          <span>${avail === 'In Stock' ? '● ' : '○ '}</span>${escHtml(avail)}
        </div>

        <p class="modal-desc">${escHtml(p.description || '')}</p>

        ${features.length ? `
        <div class="modal-features">
          <ul>${features.slice(0,8).map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="modal-specs">
          ${specs.map(([l,v]) => `
            <div class="spec-row">
              <span class="spec-label">${escHtml(l)}</span>
              <span class="spec-value">${escHtml(String(v))}</span>
            </div>
          `).join('')}
        </div>

        <div class="modal-actions">
          <button class="btn-primary" onclick="openInquiry(event,'${p.product_id}','${escHtml(p.product_name)}','${escHtml(p.brand)}')">
            Get Bulk Pricing
          </button>
          <button class="btn-secondary" onclick="copyLink('${p.product_id}')">
            Share
          </button>
        </div>
      </div>
    </div>

    ${sim.length ? `
    <div class="similar-section">
      <h3 class="similar-title">Similar Products</h3>
      <div class="similar-grid">
        ${sim.slice(0,6).map(sp => `
          <div class="product-card" onclick="openProduct('${sp.product_id}')" style="cursor:pointer">
            <div class="card-img">
              <img src="${getProductImageUrl(sp.category, sp.product_id)}" alt="${escHtml(sp.product_name)}"
                   onerror="this.onerror=null;this.src='/api/catimg/patient-care/0'">
              <div class="img-placeholder" style="display:none"></div>
            </div>
            <div class="card-body">
              <div class="card-brand">${escHtml(sp.brand)}</div>
              <div class="card-name">${escHtml(sp.product_name)}</div>
              <div class="card-footer">
                <div class="card-price">${escHtml(sp.price_each)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  `;
}

function switchImg(thumb, url) {
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  const mainImg = document.getElementById('mainImg');
  mainImg.style.display = '';
  document.getElementById('mainImgPlaceholder').style.display = 'none';
  mainImg.src = url;
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Inquiry System ────────────────────────────────────────────────────────────
let _inquiryProductId   = '';
let _inquiryProductName = '';
let _inquiryBrand       = '';

function openInquiry(evt, productId, productName, brand) {
  if (evt) evt.stopPropagation();
  _inquiryProductId   = productId;
  _inquiryProductName = productName;
  _inquiryBrand       = brand;

  const overlay = $('inquiryOverlay');
  $('inquiryProductName').textContent = productName;
  $('inquiryBrand').textContent       = brand;
  $('inquiryForm').style.display      = '';
  $('inquirySuccess').style.display   = 'none';
  $('inquirySubmitBtn').disabled      = false;
  $('inquirySubmitBtn').textContent   = 'Send Inquiry';

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('inquiryName').focus();
}

function closeInquiry() {
  const overlay = $('inquiryOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  $('inquiryForm').reset();
}

async function submitInquiry(evt) {
  evt.preventDefault();
  const btn = $('inquirySubmitBtn');
  btn.disabled    = true;
  btn.textContent = 'Sending…';

  const payload = {
    product_id:    _inquiryProductId,
    product_name:  _inquiryProductName,
    brand:         _inquiryBrand,
    customer_name: $('inquiryName').value.trim(),
    phone:         $('inquiryPhone').value.trim(),
    email:         $('inquiryEmail').value.trim(),
    message:       $('inquiryMessage').value.trim(),
  };

  try {
    const res  = await fetch('/api/inquiry', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      $('inquiryForm').style.display    = 'none';
      $('inquirySuccess').style.display = '';
    } else {
      btn.disabled    = false;
      btn.textContent = 'Send Inquiry';
      showToast('Error submitting inquiry. Please try again.');
    }
  } catch(e) {
    btn.disabled    = false;
    btn.textContent = 'Send Inquiry';
    showToast('Network error. Please try again.');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function copyLink(productId, slug) {
  const url = window.location.origin + '/p/' + productId + (slug ? '/' + slug : '');
  navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
let _acTimer = null;

function initAutocomplete() {
  const inp  = $('searchInput');
  const drop = $('acDrop');
  if (!inp || !drop) return;

  inp.addEventListener('input', () => {
    clearTimeout(_acTimer);
    const q = inp.value.trim();
    if (q.length < 2) { hideAutocomplete(); return; }
    _acTimer = setTimeout(() => fetchSuggestions(q), 200);
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideAutocomplete();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const items = drop.querySelectorAll('.ac-item');
      if (items.length) items[0].focus();
    }
  });

  drop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideAutocomplete(); inp.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); (e.target.nextElementSibling || drop.firstElementChild)?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); (e.target.previousElementSibling || drop.lastElementChild)?.focus(); }
  });

  document.addEventListener('click', e => {
    if (!inp.contains(e.target) && !drop.contains(e.target)) hideAutocomplete();
  });
}

async function fetchSuggestions(q) {
  const drop = $('acDrop');
  if (!drop) return;
  try {
    const res  = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    renderAutocomplete(data, q);
  } catch(e) { hideAutocomplete(); }
}

function renderAutocomplete(data, q) {
  const drop = $('acDrop');
  if (!drop) return;
  const rows = [];

  if (data.categories?.length) {
    rows.push(`<div class="ac-section">Categories</div>`);
    data.categories.forEach(cat => {
      rows.push(`<button class="ac-item ac-cat" tabindex="0" onclick="acSelectCat(${JSON.stringify(cat)})">`
        + `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`
        + ` ${escHtml(cat)}</button>`);
    });
  }
  if (data.brands?.length) {
    rows.push(`<div class="ac-section">Brands</div>`);
    data.brands.forEach(b => {
      rows.push(`<button class="ac-item ac-brand" tabindex="0" onclick="acSelectBrand(${JSON.stringify(b)})">`
        + `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
        + ` ${escHtml(b)}</button>`);
    });
  }
  if (data.products?.length) {
    rows.push(`<div class="ac-section">Products</div>`);
    data.products.forEach(p => {
      rows.push(`<button class="ac-item ac-product" tabindex="0" onclick="acSelectProduct(${JSON.stringify(p.id)},${JSON.stringify(p.name)})">`
        + `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><polyline points="16 3 12 7 8 3"/></svg>`
        + ` <span class="ac-prod-name">${escHtml(p.name.slice(0,60))}</span><span class="ac-prod-brand">${escHtml(p.brand)}</span></button>`);
    });
  }

  if (!rows.length) { hideAutocomplete(); return; }
  drop.innerHTML = rows.join('');
  drop.style.display = 'block';
}

function hideAutocomplete() {
  const drop = $('acDrop');
  if (drop) drop.style.display = 'none';
}

function acSelectCat(cat) {
  state.category = cat; state.q = ''; state.page = 1;
  $('searchInput').value = '';
  hideAutocomplete();
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderSubFilter(cat);
  loadProducts();
}

function acSelectBrand(brand) {
  state.brand = brand; state.q = ''; state.page = 1;
  $('searchInput').value = brand;
  hideAutocomplete();
  loadProducts();
}

function acSelectProduct(id, name) {
  $('searchInput').value = name;
  hideAutocomplete();
  openProduct(id);
}

// ── AI Toggle ─────────────────────────────────────────────────────────────────
function initAiToggle() {
  const btn = $('aiToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.aiMode = !state.aiMode;
    btn.classList.toggle('active', state.aiMode);
    btn.title = state.aiMode ? 'AI Search ON — click to disable' : 'Enable AI Search';
    $('searchInput').placeholder = state.aiMode
      ? 'Describe what you need (e.g. "sterile latex-free gloves under $50")…'
      : 'Search 500,000+ medical supplies…';
    if (!state.aiMode) {
      const banner = $('aiBanner');
      if (banner) banner.style.display = 'none';
    }
  });
}

// ── Expose globals ────────────────────────────────────────────────────────────
window.openProduct     = openProduct;
window.openInquiry     = openInquiry;
window.closeInquiry    = closeInquiry;
window.submitInquiry   = submitInquiry;
window.goPage          = goPage;
window.chipRemove      = chipRemove;
window.switchImg       = switchImg;
window.acSelectCat     = acSelectCat;
window.acSelectBrand   = acSelectBrand;
window.acSelectProduct = acSelectProduct;
window.clearAiBanner   = clearAiBanner;

// ── Start ─────────────────────────────────────────────────────────────────────
init();
