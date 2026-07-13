/**
 * map.js — Inicialización de Leaflet, marcadores, polígonos, flyTo
 */
import { loadPolygon } from './data.js';
import { AppState } from './state.js';

/* eslint-disable no-undef */ // L is global from Leaflet CDN

let map = null;
let markersLayer = null;
let polygonsLayer = null;
let trenMayaLineLayer = null;
let trenMayaStationsLayer = null;
let dtcLayerGroup = null;
let baseLayerLight = null;
let baseLayerSat = null;
let currentBasemap = 'light';
const markerRefs = new Map();

// Zoom mínimo para mostrar etiquetas de puntos
const LABEL_MIN_ZOOM = 10;

// Etiquetas DTC (se limpian cuando se re-renderiza la capa DTC)
const _dtcLabelMarkers = [];
// Etiquetas Tren Maya (permanentes mientras exista la capa)
const _tmLabelMarkers = [];
// Bounds por capa DTC
const dtcLayerBounds = new Map();

const MX_BOUNDS = [
  [14.5, -118.0], // Suroeste de México
  [32.5, -86.0]   // Noreste de México
];

const COLORS = {
  cip:    { bg: '#235C4E', icon: '🏗️' },
  marina: { bg: '#45BB64', icon: '⚓' },
  pti:    { bg: '#3B3B3B', icon: '🏨​' }
};
const SELECTED_BG = '#EFE7DA';

// --- Callbacks ---
let _onClickCb = null;
let _onHoverCb = null;
let _onHoverEndCb = null;
let _onDetailsClickCb = null;
let _onDTCDetailsClickCb = null;

export function onMarkerClick(fn)    { _onClickCb = fn; }
export function onMarkerHover(fn)    { _onHoverCb = fn; }
export function onMarkerHoverEnd(fn) { _onHoverEndCb = fn; }
export function onMarkerDetailsClick(fn) { _onDetailsClickCb = fn; }
export function onDTCDetailsClick(fn)    { _onDTCDetailsClickCb = fn; }

// --- Init ---
export function initMap() {
  map = L.map('map', {
    zoomControl: false
  });
  
  // Auto-ajusta el zoom/centro según el viewport disponible
  map.fitBounds(MX_BOUNDS, { padding: [20, 20] });

  baseLayerLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | FONATUR 2026',
    subdomains: 'abcd',
    maxZoom: 19
  });
  
  baseLayerSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri &mdash; Portions &copy; FONATUR 2026',
    maxZoom: 19
  });

  baseLayerLight.addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  polygonsLayer = L.layerGroup().addTo(map);
  trenMayaLineLayer = L.layerGroup().addTo(map);
  dtcLayerGroup = L.layerGroup().addTo(map);
  
  trenMayaStationsLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="background-color:#235C4E; color:#EFE7DA; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border: 2px solid #45BB64; font-weight:bold; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${count}</div>`,
        className: 'fonatur-cluster',
        iconSize: L.point(30, 30)
      });
    }
  }).addTo(map);
  
  // Mostrar/ocultar etiquetas según zoom
  map.on('zoomend', _updateZoomLabels);

  return map;
}

export function toggleBasemap() {
  if (!map) return 'light';
  if (currentBasemap === 'light') {
    map.removeLayer(baseLayerLight);
    baseLayerSat.addTo(map);
    currentBasemap = 'satellite';
  } else {
    map.removeLayer(baseLayerSat);
    baseLayerLight.addTo(map);
    currentBasemap = 'light';
  }
  return currentBasemap;
}

export function getMap() { return map; }

// Muestra u oculta todos los tooltips registrados según el zoom actual
function _updateZoomLabels() {
  if (!map) return;
  const z = map.getZoom();
  [..._dtcLabelMarkers, ..._tmLabelMarkers].forEach(({ marker, minZoom }) => {
    const show = z >= (minZoom ?? LABEL_MIN_ZOOM);
    if (show) marker.openTooltip();
    else marker.closeTooltip();
  });
}

// Registra un marker para control de tooltip por zoom
function _registerZoomLabel(marker, minZoom, isTM) {
  const entry = { marker, minZoom: minZoom ?? LABEL_MIN_ZOOM };
  if (isTM) _tmLabelMarkers.push(entry);
  else _dtcLabelMarkers.push(entry);
}

// --- Markers ---
function buildIcon(type, selected, hovered) {
  const bg = selected ? SELECTED_BG : COLORS[type]?.bg || '#9d2449';
  
  // Determinar el tamaño dinámicamente según el tamaño y orientación de pantalla
  let sz = 26; // por defecto (desktop normal)
  const isTotem = window.matchMedia('(orientation: portrait) and (min-width: 769px)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (isTotem) {
    sz = selected ? 48 : hovered ? 42 : 38;
  } else if (isMobile) {
    sz = selected ? 38 : hovered ? 34 : 30;
  } else {
    sz = selected ? 34 : hovered ? 30 : 26;
  }

  const glow = selected
    ? '0 0 18px rgba(188,149,92,.6)'
    : hovered
      ? '0 0 14px rgba(157,36,73,.5)'
      : '0 3px 10px rgba(0,0,0,.3)';
  const emoji = COLORS[type]?.icon || '📍';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pin" style="
      background:${bg};width:${sz}px;height:${sz}px;
      border-radius:50% 50% 50% 0;border:3px solid #fff;
      box-shadow:${glow};display:flex;align-items:center;justify-content:center;
      transform:rotate(-45deg);transition:all .3s cubic-bezier(.4,0,.2,1);
    "><span style="transform:rotate(45deg);font-size:${sz * 0.4}px;line-height:1">${emoji}</span></div>`,
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz],
    popupAnchor: [0, -sz]
  });
}

// Mapa de siteId → imagen principal para popup tipo galería
const GALLERY_COVER = {
  'cozumel':        'img/Cozumel/1CO.webp',
  'acapulco-coyuca':'img/Aca/ACA 1 Introduccion.webp',
  'los-cabos':      'img/Cabos/CA1.webp',
  'marina-los-cabos':'img/Cabos/CA1.webp',
  'cancun':         'img/Cancun/C1.webp',
  'huatulco':       'img/Huatulco/Huatulco 1.webp',
  'ixtapa':         'img/Ixtapa/Ixtapa 1.webp',
  'litibu':         'img/Lit/Lit_1.webp',
  'loreto':         'img/Lor_Nop/Lor_Nop1.webp',
  'nopoló':         'img/Lor_Nop/Lor_Nop1.webp',
  'puerto_escondido':'img/Lor_Nop/Lor_Nop1.webp'
};

function popupHTML(site) {
  // --- Sitios con galería local: popup = imagen con botón superpuesto ---
  if (GALLERY_COVER[site.id]) {
    return `<div class="gallery-popup">
      <img src="${encodeURI(GALLERY_COVER[site.id])}" alt="${site.name}" class="gallery-popup-img">
      <button class="view-more-btn gallery-popup-btn" data-id="${site.id}">Ver detalles</button>
    </div>`;
  }

  // --- Popup genérico ---
  const tag = site.type === 'cip' ? 'CIP' : site.type === 'marina' ? 'Marina' : site.type === 'pti' ? 'PTI' : '';
  const bg = COLORS[site.type]?.bg || '#235C4E';
  const icon = COLORS[site.type]?.icon || '📍';
  const imgUrl = site.images?.[0] || 'img/default-bg.jpg';
  
  return `<div class="station-popup-card">
    <div class="spc-cover" style="background-image: url('${imgUrl}'); border-bottom-color: ${bg};">
      <div class="spc-overlay" style="background: linear-gradient(to bottom, transparent, ${bg}dd);">
        <span class="spc-badge" style="background: ${bg};">${tag}</span>
      </div>
    </div>
    <div class="spc-body">
      <h3 class="spc-title" style="color: ${bg}; font-size: 16px;">${site.name}</h3>
      <div class="spc-subtitle">AÑO DE INICIO: ${site.year}</div>
      
      <div class="spc-info-grid">
        <div class="spc-info-item">
          <span class="spc-icon">${icon}</span>
          <span class="spc-text"><strong>Tipo:</strong> ${tag}</span>
        </div>
        <div class="spc-info-item">
          <span class="spc-icon">📍</span>
          <span class="spc-text"><strong>Ubicación:</strong> ${site.state}</span>
        </div>
      </div>
      <p style="margin-top: 12px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
        ${site.description}
      </p>
      <button class="view-more-btn spc-action-btn" style="width: 100%; margin-top: 10px;" data-id="${site.id}">Ver detalles</button>
    </div>
  </div>`;
}

export function renderMarkers(sites, state) {
  markersLayer.clearLayers();
  markerRefs.clear();

  sites.forEach(site => {
    const sel = state.selectedSiteId === site.id;
    const hov = state.hoveredSiteId === site.id;
    const icon = buildIcon(site.type, sel, hov);

    const isTotem = window.matchMedia('(orientation: portrait) and (min-width: 769px)').matches;
    const isGallery = !!GALLERY_COVER[site.id];
    
    let popupOpts;
    if (isTotem) {
      popupOpts = isGallery
        ? { maxWidth: 600, minWidth: 460, className: 'fonatur-station-popup gallery-station-popup' }
        : { maxWidth: 400, minWidth: 320, className: 'fonatur-station-popup' };
    } else {
      popupOpts = isGallery
        ? { maxWidth: 500, minWidth: 360, className: 'fonatur-station-popup gallery-station-popup' }
        : { maxWidth: 300, minWidth: 260, className: 'fonatur-station-popup' };
    }

    const marker = L.marker([site.lat, site.lng], { icon })
      .bindPopup(popupHTML(site), popupOpts);

    marker.on('click', () => _onClickCb?.(site));
    marker.on('mouseover', () => _onHoverCb?.(site.id));
    marker.on('mouseout', () => _onHoverEndCb?.());
    
    // Bind button inside popup (once: true evita acumulación si el popup se abre varias veces)
    marker.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('.spc-action-btn, .gallery-popup-btn');
      if (btn) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          _onDetailsClickCb?.(site);
        }, { once: true });
      }
    });

    markerRefs.set(site.id, marker);
    markersLayer.addLayer(marker);
  });
}

export function updateMarkersState(state) {
  markerRefs.forEach((marker, id) => {
    const site = AppState.get('sites').find(s => s.id === id);
    if (!site) return;
    const sel = state.selectedSiteId === id;
    const hov = state.hoveredSiteId === id;
    marker.setIcon(buildIcon(site.type, sel, hov));
  });
}

// --- Polygons ---
export async function renderPolygons(sites) {
  polygonsLayer.clearLayers();
  for (const site of sites) {
    if (!site.polygon) continue;
    const geo = await loadPolygon(site.polygon);
    if (!geo) continue;
    const color = COLORS[site.type]?.bg || '#9d2449';
    L.geoJSON(geo, {
      style: { color, weight: 2, opacity: .7, fillColor: color, fillOpacity: .12 }
    }).addTo(polygonsLayer);
  }
}

// --- Capas de Tren Maya ---
export function renderTrenMaya(trazo, estaciones) {
  trenMayaLineLayer.clearLayers();
  trenMayaStationsLayer.clearLayers();

  if (trazo) {
    L.geoJSON(trazo, {
      style: { color: '#3B3B3B', weight: 4, opacity: 0.8 }
    }).addTo(trenMayaLineLayer);
    
    L.geoJSON(trazo, {
      style: { color: '#45BB64', weight: 2, dashArray: '5, 8', opacity: 1 }
    }).addTo(trenMayaLineLayer);
  }

  if (estaciones) {
    // Mapa exacto de IDs a nombres de archivo basado en la carpeta provista por el usuario
    const fileMap = {
      "1": "1_Palenque.png", "2": "2_BocaDelCerro.png", "3": "3_Tenosique.png", "4": "4_El_Triunfo.png",
      "5": "5_Candelaria.png", "6": "6_Escarcega.png", "7": "7_Carrillo_Puerto.png", "8": "8_Edzna.png",
      "9": "9_SFCampeche.png", "10": "10_Tenabo.png", "11": "11_Hecelchakan.png", "12": "12_Calkini.png",
      "13": "13_Maxcanu.png", "14": "14_Uman.png", "15": "15_Teya.png", "16": "16_Tixkokob.png",
      "17": "17_Izamal.png", "18": "18_Chichen.png", "19": "19_Valladolid.png", "20": "20_Xcan.png",
      "21": "21_Leona.png", "22": "22_Cancun.png", "23": "23_Morelos.png", "24": "24_Carmen.png",
      "25": "25_Tulum.png", "26": "26_Tulumpuerto.png", "27": "27_Felipe.png", "28": "28_Limones.png",
      "29": "29_Bacalar.png", "30": "30_Chetumal.png", "31": "31_Nicolas.png", "32": "32_Xpujil.png",
      "33": "33_kalakmul.png", "34": "34_Centenario.png"
    };

    const geoLayer = L.geoJSON(estaciones, {
      pointToLayer: (feature, latlng) => {
        const id = String(feature.properties.id);
        const fileName = fileMap[id] || "1_Palenque.png"; // Fallback por si falta algún ID
        const iconUrl = `img/estaciones/${fileName}`;
        
        const icon = L.divIcon({
          className: 'custom-station-icon',
          html: `<img src="${iconUrl}" width="40" height="40" style="border-radius:50%; border:2px solid #45BB64; box-shadow:0 2px 4px rgba(0,0,0,0.3); background:#235C4E; object-fit:cover;" alt="Estación">`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
        
        const marker = L.marker(latlng, { icon });
        const tag = feature.properties.TIPO; // Estación o Paradero
        const nomOf = feature.properties.NOM_OF || '';
        
        marker.bindPopup(`<div class="station-popup-card">
          <div class="spc-cover" style="background-image: url('${iconUrl}');">
            <div class="spc-overlay">
              <span class="spc-badge">${tag}</span>
            </div>
          </div>
          <div class="spc-body">
            <h3 class="spc-title">${nomOf}</h3>
            <div class="spc-subtitle">TRAMO ${feature.properties.TRAMO}</div>
            
            <div class="spc-info-grid">
              <div class="spc-info-item">
                <span class="spc-icon">👥</span>
                <span class="spc-text"><strong>Demanda:</strong> ${feature.properties.DEMANDA}</span>
              </div>
              <div class="spc-info-item">
                <span class="spc-icon">🛤️</span>
                <span class="spc-text"><strong>Vía:</strong> ${feature.properties.ESQ_DE_VIA}</span>
              </div>
              <div class="spc-info-item">
                <span class="spc-icon">📍</span>
                <span class="spc-text">${feature.properties.MUNICIPIO}, ${feature.properties.ESTADO}</span>
              </div>
            </div>
          </div>
        </div>`, { className: 'fonatur-station-popup', maxWidth: 300, minWidth: 260 });
        
        // Tooltip con nombre visible solo a zoom alto
        if (nomOf) {
          marker.bindTooltip(nomOf, {
            permanent: true,
            direction: 'top',
            offset: [0, -22],
            className: 'dtc-label dtc-label--tm'
          });
          _registerZoomLabel(marker, LABEL_MIN_ZOOM, true); // isTM = true
        }

        marker.on('click', () => {
           if (map) map.flyTo(latlng, 13, { duration: 1.5, easeLinearity: .25 });
        });
        
        return marker;
      }
    });

    trenMayaStationsLayer.addLayer(geoLayer);
    // Aplicar visibilidad inicial al añadir la capa
    setTimeout(_updateZoomLabels, 0);
  }
}

export function toggleTrenMayaLayers(show) {
  if (!map) return;
  if (show) {
    if (!map.hasLayer(trenMayaLineLayer)) map.addLayer(trenMayaLineLayer);
    if (!map.hasLayer(trenMayaStationsLayer)) map.addLayer(trenMayaStationsLayer);
  } else {
    if (map.hasLayer(trenMayaLineLayer)) map.removeLayer(trenMayaLineLayer);
    if (map.hasLayer(trenMayaStationsLayer)) map.removeLayer(trenMayaStationsLayer);
  }
}

// --- Capas de DTC ---

// Imágenes y configuración por capa DTC
const DTC_CONFIG = {
  pm: {
    color: '#e07a5f',
    label: 'P. Mancomunados',
    nameField: 'NOMGEO',
    municipioField: 'NOM_MUN',
    images: [
      'img/Mancomunados/DTC PM 1 Intro (1).webp',
      'img/Mancomunados/DTC PM 2 Aportaciones.webp',
      'img/Mancomunados/DTC PM 3 Fotos.webp'
    ]
  },
  mm: {
    color: '#81b29a',
    label: 'Camino del Mayab',
    nameField: 'NOMGEO',
    municipioField: 'NOM_MUN',
    images: [
      'img/Mayab/Mayab1.webp',
      'img/Mayab/Mayab2.webp',
      'img/Mayab/Mayab3.webp'
    ]
  },
  mk: {
    color: '#f2cc8f',
    label: 'Maya Kaan',
    nameField: 'nombre_estimado',
    municipioField: null,
    images: [
      'img/Maya_Kaan/Maya Kaan 1.webp',
      'img/Maya_Kaan/Maya Kaan 2.webp',
      'img/Maya_Kaan/Maya Kaan 3.webp'
    ]
  }
};

function buildDTCPopupHTML(feature, cfg) {
  const name = feature.properties[cfg.nameField] || 'Sin nombre';
  const mun  = cfg.municipioField ? (feature.properties[cfg.municipioField] || '') : '';
  const [img1, img2, img3] = cfg.images;

  return `<div class="dtc-popup-card">
    <div class="dtc-carousel" id="dtcCar_${Math.random().toString(36).slice(2)}">
      <div class="dtc-slides">
        <img class="dtc-slide active" src="${encodeURI(img1)}" alt="${cfg.label} - imagen 1">
        <img class="dtc-slide" src="${encodeURI(img2)}" alt="${cfg.label} - imagen 2">
        <img class="dtc-slide" src="${encodeURI(img3)}" alt="${cfg.label} - imagen 3">
      </div>
      <button class="dtc-nav dtc-nav-prev" aria-label="Anterior">&#8249;</button>
      <button class="dtc-nav dtc-nav-next" aria-label="Siguiente">&#8250;</button>
      <div class="dtc-dots">
        <span class="dtc-dot active"></span>
        <span class="dtc-dot"></span>
        <span class="dtc-dot"></span>
      </div>
      <span class="spc-badge dtc-badge" style="background:${cfg.color};">${cfg.label}</span>
    </div>
    <div class="spc-body">
      <h3 class="spc-title" style="color:${cfg.color}; font-size:15px;">${name}</h3>
      ${mun ? `<div class="spc-subtitle">${mun}</div>` : ''}
      <button class="view-more-btn dtc-details-btn" style="width:100%; margin-top:10px;">Ver detalles</button>
    </div>
  </div>`;
}

export function renderDTC(dtcData) {
  dtcLayerGroup.clearLayers();
  // Limpiar SOLO las etiquetas DTC (no las del Tren Maya)
  _dtcLabelMarkers.length = 0;
  dtcLayerBounds.clear();
  if (!dtcData) return;

  Object.entries(DTC_CONFIG).forEach(([key, cfg]) => {
    const data = dtcData[key];
    if (!data) return;

    // Acumular bounds de esta capa
    const bounds = L.latLngBounds([]);

    if (data.poly) {
      const polyLayer = L.geoJSON(data.poly, {
        style: { color: cfg.color, weight: 2, fillColor: cfg.color, fillOpacity: 0.3 }
      });
      polyLayer.on('click', () => _flyToDTCBounds(key));
      polyLayer.addTo(dtcLayerGroup);
      try { bounds.extend(polyLayer.getBounds()); } catch(_) {}
    }

    if (data.points) {
      const pointsLayer = L.geoJSON(data.points, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties[cfg.nameField] || '';
          const marker = L.circleMarker(latlng, {
            radius: 6,
            fillColor: cfg.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          });

          // Tooltip controlado por zoom (no permanente hasta que el zoom sea suficiente)
          if (name) {
            marker.bindTooltip(name, {
              permanent: true,
              direction: 'top',
              offset: [0, -8],
              className: `dtc-label dtc-label--${key}`
            });
            _registerZoomLabel(marker, LABEL_MIN_ZOOM, false); // isTM = false
          }

          // Popup tipo card con carrusel
          const popupHTML = buildDTCPopupHTML(feature, cfg);
          marker.bindPopup(popupHTML, {
            className: 'fonatur-station-popup dtc-station-popup',
            maxWidth: 300,
            minWidth: 260
          });

          // Fly to al hacer clic en el punto
          marker.on('click', () => _flyToDTCBounds(key));

          // Inicializar carrusel al abrir el popup
          marker.on('popupopen', (e) => {
            const el = e.popup.getElement();
            if (!el) return;
            const slides = el.querySelectorAll('.dtc-slide');
            const dots   = el.querySelectorAll('.dtc-dot');
            const prev   = el.querySelector('.dtc-nav-prev');
            const next   = el.querySelector('.dtc-nav-next');
            const detBtn = el.querySelector('.dtc-details-btn');
            let current  = 0;

            const goTo = (idx) => {
              slides[current].classList.remove('active');
              dots[current].classList.remove('active');
              current = (idx + slides.length) % slides.length;
              slides[current].classList.add('active');
              dots[current].classList.add('active');
            };

            prev?.addEventListener('click', (ev) => { ev.stopPropagation(); goTo(current - 1); });
            next?.addEventListener('click', (ev) => { ev.stopPropagation(); goTo(current + 1); });
            dots.forEach((dot, i) => dot.addEventListener('click', (ev) => { ev.stopPropagation(); goTo(i); }));

            // Botón "Ver detalles" → abre modal con galería completa
            if (detBtn) {
              detBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const pointName = feature.properties[cfg.nameField] || cfg.label;
                _onDTCDetailsClickCb?.({ key, name: pointName, cfg });
              }, { once: true });
            }
          });

          bounds.extend(latlng);
          return marker;
        }
      });
      pointsLayer.addTo(dtcLayerGroup);
    }

    if (bounds.isValid()) dtcLayerBounds.set(key, bounds);
  });

  // Aplicar visibilidad inicial de etiquetas
  setTimeout(_updateZoomLabels, 0);
}

// Vuela al bounds de una capa DTC por su key
function _flyToDTCBounds(key) {
  if (!map) return;
  const b = dtcLayerBounds.get(key);
  if (!b || !b.isValid()) return;
  map.flyToBounds(b, { padding: [40, 40], duration: 1.5, easeLinearity: 0.25 });
}

// API pública: flyToDTC('pm' | 'mm' | 'mk')
export function flyToDTC(key) { _flyToDTCBounds(key); }

export function toggleDTCLayers(show) {
  if (!map) return;
  if (show) {
    if (!map.hasLayer(dtcLayerGroup)) map.addLayer(dtcLayerGroup);
  } else {
    if (map.hasLayer(dtcLayerGroup)) map.removeLayer(dtcLayerGroup);
  }
}

// --- Navigation ---
export function flyToSite(site) {
  if (!map) return;
  map.flyTo([site.lat, site.lng], 12, { duration: 1.5, easeLinearity: .25 });
}

export function resetView() {
  if (!map) return;
  map.fitBounds(MX_BOUNDS, { padding: [20, 20], duration: 1 });
}

// --- Highlight (para hover desde UI) ---
export function highlightMarker(siteId) {
  const m = markerRefs.get(siteId);
  if (m) { const el = m.getElement(); if (el) el.classList.add('marker-highlight'); }
}

export function clearHighlight(siteId) {
  const m = markerRefs.get(siteId);
  if (m) { const el = m.getElement(); if (el) el.classList.remove('marker-highlight'); }
}
