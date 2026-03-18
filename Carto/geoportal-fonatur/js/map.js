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
let baseLayerLight = null;
let baseLayerSat = null;
let currentBasemap = 'light';
const markerRefs = new Map();

const MX_CENTER = [23.6345, -102.5528];
const MX_ZOOM = 6;

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

export function onMarkerClick(fn)    { _onClickCb = fn; }
export function onMarkerHover(fn)    { _onHoverCb = fn; }
export function onMarkerHoverEnd(fn) { _onHoverEndCb = fn; }
export function onMarkerDetailsClick(fn) { _onDetailsClickCb = fn; }

// --- Init ---
export function initMap() {
  map = L.map('map', {
    center: MX_CENTER,
    zoom: MX_ZOOM,
    zoomControl: false
  });

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

// --- Markers ---
function buildIcon(type, selected, hovered) {
  const bg = selected ? SELECTED_BG : COLORS[type]?.bg || '#9d2449';
  const sz = selected ? 34 : hovered ? 30 : 26;
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

function popupHTML(site) {
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

    const marker = L.marker([site.lat, site.lng], { icon })
      .bindPopup(popupHTML(site), { maxWidth: 300, minWidth: 260, className: 'fonatur-station-popup' });

    marker.on('click', () => _onClickCb?.(site));
    marker.on('mouseover', () => _onHoverCb?.(site.id));
    marker.on('mouseout', () => _onHoverEndCb?.());
    
    // Bind button inside popup
    marker.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('.spc-action-btn');
      if (btn) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          _onDetailsClickCb?.(site);
        });
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
        
        marker.bindPopup(`<div class="station-popup-card">
          <div class="spc-cover" style="background-image: url('${iconUrl}');">
            <div class="spc-overlay">
              <span class="spc-badge">${tag}</span>
            </div>
          </div>
          <div class="spc-body">
            <h3 class="spc-title">${feature.properties.NOM_OF}</h3>
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
        
        marker.on('click', () => {
           if (map) map.flyTo(latlng, 13, { duration: 1.5, easeLinearity: .25 });
        });
        
        return marker;
      }
    });

    trenMayaStationsLayer.addLayer(geoLayer);
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

// --- Navigation ---
export function flyToSite(site) {
  if (!map) return;
  map.flyTo([site.lat, site.lng], 12, { duration: 1.5, easeLinearity: .25 });
}

export function resetView() {
  if (!map) return;
  map.flyTo(MX_CENTER, MX_ZOOM, { duration: 1 });
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
