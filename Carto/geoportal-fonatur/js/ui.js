/**
 * ui.js — Panel lateral, tarjetas, leyenda viva, modal, eventos
 */
import { AppState } from './state.js';
import * as MapModule from './map.js';

// --- Leyenda Viva ---
export function renderLegend(sites) {
  const cipCount = sites.filter(s => s.type === 'cip').length;
  const marinaCount = sites.filter(s => s.type === 'marina').length;
  const ptiCount = sites.filter(s => s.type === 'pti').length;

  const el = document.getElementById('legendCipCount');
  const el2 = document.getElementById('legendMarinaCount');
  const el3 = document.getElementById('legendPtiCount');
  if (el) animateCounter(el, cipCount);
  if (el2) animateCounter(el2, marinaCount);
  if (el3) animateCounter(el3, ptiCount);

  document.getElementById('legendTotal').textContent = `${sites.length} visibles`;
}

// --- Contador animado ---
export function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const dur = 400;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = target; el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 400); }
  }
  requestAnimationFrame(tick);
}

// --- Sidebar: lista de tarjetas ---
export function renderSidebar(sites, state) {
  const list = document.getElementById('sitesList');
  if (!sites.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>No se encontraron desarrollos</p></div>`;
    return;
  }

  list.innerHTML = sites.map(site => {
    const cls = state.selectedSiteId === site.id ? 'active' : '';
    const tag = site.type === 'cip' ? 'CIP' : site.type === 'marina' ? 'Marina' : site.type === 'pti' ? 'PTI' : '';
    const badgeCls = site.type === 'cip' ? 'site-badge--cip' : site.type === 'marina' ? 'site-badge--marina' : site.type === 'pti' ? 'site-badge--pti' : '';
    const img = site.images?.[0];
    return `
      <div class="site-card ${cls}" data-id="${site.id}">
        ${img ? `<div class="card-img-wrap">
          <img src="${img}" alt="${site.name}" class="card-img" loading="lazy">
          <button class="view-more-btn card-img-btn" data-id="${site.id}">Ver detalles</button>
        </div>` : ''}
        <div class="site-header">
          <div>
            <h3 class="site-name">${site.name}</h3>
            <div class="site-state">${site.state}</div>
            <div class="site-year">Fundado en ${site.year}</div>
          </div>
          <span class="site-badge ${badgeCls}">${tag}</span>
        </div>
        ${!img ? `<button class="view-more-btn" data-id="${site.id}">Ver detalles</button>` : ''}
      </div>`;
  }).join('');

  // Bind card events
  list.querySelectorAll('.site-card').forEach(card => {
    const id = card.dataset.id;
    const site = state.sites.find(s => s.id === id);
    if (!site) return;

    card.addEventListener('click', () => {
      AppState.set({ selectedSiteId: id });
      MapModule.flyToSite(site);
    });

    card.addEventListener('mouseenter', () => {
      AppState.set({ hoveredSiteId: id });
      MapModule.highlightMarker(id);
    });

    card.addEventListener('mouseleave', () => {
      AppState.set({ hoveredSiteId: null });
      MapModule.clearHighlight(id);
    });
  });

  list.querySelectorAll('.view-more-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const site = state.sites.find(s => s.id === btn.dataset.id);
      if (site) showModal(site);
    });
  });

  // Stats
  document.getElementById('totalSites').textContent = `${state.sites.length} desarrollos`;
}

export function updateSidebarState(state) {
  const cards = document.querySelectorAll('#sitesList .site-card');
  cards.forEach(card => {
    if (state.selectedSiteId === card.dataset.id) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

// --- Modal ---
let _carouselIdx = 0;

// Galerías locales por sitio (en orden)
const SITE_GALLERIES = {
  'cozumel': [
    'img/Cozumel/1CO.webp',
    'img/Cozumel/2 Información geográfica.webp',
    'img/Cozumel/3CO.webp',
    'img/Cozumel/4CO.webp',
    'img/Cozumel/5CO.webp',
    'img/Cozumel/6CO.webp'
  ],
  'acapulco-coyuca': [
    'img/Aca/ACA 1 Introduccion.webp',
    'img/Aca/ACA 2.webp',
    'img/Aca/ACA 3 Mapa Plan.webp',
    'img/Aca/ACA 4.webp',
    'img/Aca/ACA 5.webp',
    'img/Aca/ACA 6.webp',
    'img/Aca/ACA 7.webp',
    'img/Aca/ACA 8.webp',
    'img/Aca/ACA 9.webp',
    'img/Aca/ACA 10.webp',
    'img/Aca/ACA 11.webp',
    'img/Aca/ACA 12.webp'
  ],
  'los-cabos': [
    'img/Cabos/CA1.webp',
    'img/Cabos/CA2.webp',
    'img/Cabos/CA3.webp',
    'img/Cabos/CA4.webp',
    'img/Cabos/CA5.webp',
    'img/Cabos/CA6.webp'
  ],
  'marina-los-cabos': [
    'img/Cabos/CA1.webp',
    'img/Cabos/CA2.webp',
    'img/Cabos/CA3.webp',
    'img/Cabos/CA4.webp',
    'img/Cabos/CA5.webp',
    'img/Cabos/CA6.webp'
  ],
  'cancun': [
    'img/Cancun/C1.webp',
    'img/Cancun/c2.webp',
    'img/Cancun/c3.webp',
    'img/Cancun/C4.webp',
    'img/Cancun/C5.webp',
    'img/Cancun/C6.webp'
  ],
  'huatulco': [
    'img/Huatulco/Huatulco 1.webp',
    'img/Huatulco/Huatulco 2.webp',
    'img/Huatulco/Huatulco 3.webp',
    'img/Huatulco/Huatulco 4.webp',
    'img/Huatulco/Huatulco 5.webp',
    'img/Huatulco/Huatulco 6.webp'
  ],
  'ixtapa': [
    'img/Ixtapa/Ixtapa 1.webp',
    'img/Ixtapa/Ixtapa 2.webp',
    'img/Ixtapa/Ixtapa 3.webp',
    'img/Ixtapa/Ixtapa 4.webp',
    'img/Ixtapa/Ixtapa 5.webp',
    'img/Ixtapa/Ixtapa 6.webp'
  ],
  'litibu': [
    'img/Lit/Lit_1.webp',
    'img/Lit/Lit_2.webp',
    'img/Lit/Lit_3.webp',
    'img/Lit/Lit_4.webp',
    'img/Lit/Lit_5.webp',
    'img/Lit/Lit_6.webp',
    'img/Lit/Lit_7.webp',
    'img/Lit/Lit_8.webp',
    'img/Lit/Lit_9.webp'
  ],
  'loreto': [
    'img/Lor_Nop/Lor_Nop1.webp',
    'img/Lor_Nop/Lor_Nop2.webp',
    'img/Lor_Nop/Lor_Nop3.webp',
    'img/Lor_Nop/Lor_Nop4.webp',
    'img/Lor_Nop/Lor_Nop5.webp',
    'img/Lor_Nop/Lor_Nop6.webp'
  ],
  'nopoló': [
    'img/Lor_Nop/Lor_Nop1.webp',
    'img/Lor_Nop/Lor_Nop2.webp',
    'img/Lor_Nop/Lor_Nop3.webp',
    'img/Lor_Nop/Lor_Nop4.webp',
    'img/Lor_Nop/Lor_Nop5.webp',
    'img/Lor_Nop/Lor_Nop6.webp'
  ],
  'puerto_escondido': [
    'img/Lor_Nop/Lor_Nop1.webp',
    'img/Lor_Nop/Lor_Nop2.webp',
    'img/Lor_Nop/Lor_Nop3.webp',
    'img/Lor_Nop/Lor_Nop4.webp',
    'img/Lor_Nop/Lor_Nop5.webp',
    'img/Lor_Nop/Lor_Nop6.webp'
  ]
};

export function showModal(site) {
  const overlay = document.getElementById('modalOverlay');
  const modal = overlay.querySelector('.modal');
  document.getElementById('modalTitle').textContent = site.name;
  _carouselIdx = 0;

  const carousel = document.getElementById('modalCarousel');
  const dots = document.getElementById('modalDots');
  const body = document.getElementById('modalBody');

  // --- Sitios con galería local: modal especial — solo imágenes, controles overlay ---
  const galleryImgs = SITE_GALLERIES[site.id];
  if (galleryImgs) {
    modal.classList.add('modal--gallery');
    const imgs = galleryImgs;
    carousel.innerHTML = `
      <button class="gallery-close-btn" id="galClose" aria-label="Cerrar">×</button>
      <span class="gallery-counter" id="galCounter">1 / ${imgs.length}</span>
      <button class="carousel-nav prev" id="cPrev">‹</button>
      ${imgs.map((src, i) =>
        `<img src="${encodeURI(src)}" alt="${site.name} – ${i + 1}" class="${i === 0 ? 'active' : ''}">`
      ).join('')}
      <button class="carousel-nav next" id="cNext">›</button>
      <div class="gallery-dots-overlay">
        ${imgs.map((_, i) =>
          `<span class="dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`
        ).join('')}
      </div>`;
    dots.innerHTML = '';
    body.innerHTML = '';

    // Carousel bindings con counter
    const cImgs = carousel.querySelectorAll('img');
    const cDots = carousel.querySelectorAll('.gallery-dots-overlay .dot');
    const cCounter = document.getElementById('galCounter');
    const goTo = (i) => {
      cImgs[_carouselIdx]?.classList.remove('active');
      cDots[_carouselIdx]?.classList.remove('active');
      _carouselIdx = ((i % imgs.length) + imgs.length) % imgs.length;
      cImgs[_carouselIdx]?.classList.add('active');
      cDots[_carouselIdx]?.classList.add('active');
      cCounter.textContent = `${_carouselIdx + 1} / ${imgs.length}`;
    };
    document.getElementById('cPrev')?.addEventListener('click', () => goTo(_carouselIdx - 1));
    document.getElementById('cNext')?.addEventListener('click', () => goTo(_carouselIdx + 1));
    cDots.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.i)));
    document.getElementById('galClose')?.addEventListener('click', () => overlay.classList.remove('active'));

    overlay.classList.add('active');
    return;
  }


  // --- Modal genérico para el resto de sitios ---
  modal.classList.remove('modal--gallery');

  if (site.images?.length) {
    carousel.innerHTML = `
      <button class="carousel-nav prev" id="cPrev">‹</button>
      ${site.images.map((img, i) =>
        `<img src="${img}" alt="${site.name}" class="${i === 0 ? 'active' : ''}">`
      ).join('')}
      <button class="carousel-nav next" id="cNext">›</button>`;
    dots.innerHTML = site.images.map((_, i) =>
      `<span class="dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`
    ).join('');
    bindCarousel(site.images.length);
  } else {
    carousel.innerHTML = '';
    dots.innerHTML = '';
  }

  // Body
  const tag = site.type === 'cip' ? 'Centro Integralmente Planeado' : site.type === 'marina' ? 'Marina Turística' : site.type === 'pti' ? 'Proyecto Turístico de Internación' : '';
  let detailsHTML = '';
  if (site.details && Object.keys(site.details).length) {
    detailsHTML = `<div class="modal-section"><h3>Datos Clave</h3><div class="modal-grid">
      ${Object.entries(site.details).map(([k, v]) =>
        `<div class="modal-item"><div class="modal-label">${k}</div><div class="modal-value">${v}</div></div>`
      ).join('')}
    </div></div>`;
  }

  body.innerHTML = `
    <div class="modal-section"><h3>Información General</h3>
      <div class="modal-grid">
        <div class="modal-item"><div class="modal-label">Tipo</div><div class="modal-value">${tag}</div></div>
        <div class="modal-item"><div class="modal-label">Estado</div><div class="modal-value">${site.state}</div></div>
        <div class="modal-item"><div class="modal-label">Año</div><div class="modal-value">${site.year}</div></div>
        <div class="modal-item"><div class="modal-label">Coordenadas</div><div class="modal-value">${site.lat.toFixed(4)}°, ${site.lng.toFixed(4)}°</div></div>
      </div>
    </div>
    <div class="modal-section"><h3>Descripción</h3><p style="line-height:1.7">${site.description}</p></div>
    ${detailsHTML}`;

  overlay.classList.add('active');
}

function bindCarousel(total) {
  const imgs = document.querySelectorAll('#modalCarousel img');
  const dots = document.querySelectorAll('#modalDots .dot');
  const go = (i) => {
    imgs[_carouselIdx]?.classList.remove('active');
    dots[_carouselIdx]?.classList.remove('active');
    _carouselIdx = (i + total) % total;
    imgs[_carouselIdx]?.classList.add('active');
    dots[_carouselIdx]?.classList.add('active');
  };
  document.getElementById('cPrev')?.addEventListener('click', () => go(_carouselIdx - 1));
  document.getElementById('cNext')?.addEventListener('click', () => go(_carouselIdx + 1));
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
}

// --- Bind all events ---
export function bindEvents() {
  // Timeline
  const slider = document.getElementById('timelineSlider');
  const yearDisp = document.getElementById('currentYear');
  slider.addEventListener('input', e => {
    const y = parseInt(e.target.value);
    yearDisp.textContent = y;
    AppState.set({ year: y });
  });

  // Filters
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.set({ filter: chip.dataset.filter });
    });
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    AppState.set({ searchTerm: e.target.value });
  });

  // Toggle sidebar
  const sidebar = document.getElementById('sidebar');
  const togBtn = document.getElementById('toggleSidebar');
  const togIcon = document.getElementById('toggleIcon');
  togBtn.addEventListener('click', () => {
    const open = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed');
    togBtn.classList.toggle('collapsed');
    togIcon.textContent = open ? '▶' : '◀';
    setTimeout(() => MapModule.getMap()?.invalidateSize(), 350);
  });

  // Reset view
  document.getElementById('resetView').addEventListener('click', () => {
    AppState.set({ selectedSiteId: null });
    MapModule.resetView();
  });

  // Toggle Basemap (Satellite)
  const toggleSatBtn = document.getElementById('toggleSatBtn');
  if (toggleSatBtn) {
    toggleSatBtn.addEventListener('click', () => {
      const mode = MapModule.toggleBasemap();
      toggleSatBtn.innerHTML = mode === 'satellite' ? '🗺️ Mapa Base' : '🛰️ Satélite';
    });
  }

  // Modal close
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalClose').addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });

  // Map marker callbacks
  MapModule.onMarkerClick(site => {
    AppState.set({ selectedSiteId: site.id });
    MapModule.flyToSite(site);
    
    // Auto-scroll en la barra lateral
    const card = document.querySelector(`.site-card[data-id="${site.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  
  MapModule.onMarkerDetailsClick(site => {
    showModal(site);
  });
  
  MapModule.onMarkerHover(id => AppState.set({ hoveredSiteId: id }));
  MapModule.onMarkerHoverEnd(() => AppState.set({ hoveredSiteId: null }));
}
