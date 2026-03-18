/**
 * data.js — Carga, normalización y cache de datos
 */

const BASE = './data';
const _polyCache = new Map();

/** Carga el dataset principal de sitios */
export async function loadSites() {
  const res = await fetch(`${BASE}/sites.json`);
  if (!res.ok) throw new Error(`Error cargando datos: ${res.status}`);
  const raw = await res.json();
  return raw.map(s => ({
    ...s,
    id: s.id || s.name.toLowerCase().replace(/\s+/g, '-'),
    lat: Number(s.lat),
    lng: Number(s.lng),
    year: Number(s.year),
    images: s.images || [],
    details: s.details || {}
  }));
}

/** Carga de datos de Tren Maya */
export async function loadTrenMayaData() {
  try {
    const [lineRes, pointsRes] = await Promise.all([
      fetch(`${BASE}/lines/Trazo_tren.geojson`),
      fetch(`${BASE}/points/Estaciones.geojson`)
    ]);
    const trazo = lineRes.ok ? await lineRes.json() : null;
    const estaciones = pointsRes.ok ? await pointsRes.json() : null;
    return { trazo, estaciones };
  } catch (err) {
    console.error('Error cargando Tren Maya:', err);
    return { trazo: null, estaciones: null };
  }
}

/** Carga lazy de un polígono GeoJSON con cache */
export async function loadPolygon(filename) {
  if (_polyCache.has(filename)) return _polyCache.get(filename);
  try {
    const res = await fetch(`${BASE}/polygons/${filename}`);
    if (!res.ok) return null;
    const geo = await res.json();
    _polyCache.set(filename, geo);
    return geo;
  } catch {
    console.warn(`Polígono no disponible: ${filename}`);
    return null;
  }
}
