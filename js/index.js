/**
 * index.js — Bootstrap: carga datos → inicia mapa → conecta UI
 */
import { AppState } from './state.js';
import { loadSites, loadTrenMayaData, loadDTCData, loadMichoacanData } from './data.js';
import * as MapModule from './map.js';
import * as UI from './ui.js';

async function boot() {
  try {
    // 1) Cargar datos
    const [sites, trenData, dtcData, michData] = await Promise.all([
      loadSites(),
      loadTrenMayaData(),
      loadDTCData(),
      loadMichoacanData()
    ]);
    AppState.set({ sites });

    // 2) Iniciar mapa
    MapModule.initMap();
    MapModule.renderTrenMaya(trenData.trazo, trenData.estaciones);
    MapModule.toggleTrenMayaLayers(AppState.get('year') >= 2024);
    MapModule.renderDTC(dtcData);
    MapModule.toggleDTCLayers(AppState.get('year') >= 2026 && (AppState.get('filter') === 'all' || AppState.get('filter') === 'dtc'));
    MapModule.renderMichoacan(michData);
    MapModule.toggleMichoacanLayers(AppState.get('year') >= 2026 && (AppState.get('filter') === 'all' || AppState.get('filter') === 'dtc'));
    // Asegurar que Leaflet mide el contenedor correctamente tras el layout flex-column
    setTimeout(() => MapModule.getMap()?.invalidateSize(), 100);

    // 3) Bindear eventos UI
    UI.bindEvents();

    // 4) Render inicial
    const filtered = AppState.getFilteredSites();
    MapModule.renderMarkers(filtered, AppState.getAll());
    MapModule.renderPolygons(filtered);
    UI.renderSidebar(filtered, AppState.getAll());
    UI.renderLegend(filtered);

    // Variable local para saber si cambió la lista a renderizar
    let lastRenderedIds = '';

    // 5) Suscribir a cambios de estado
    AppState.subscribe(state => {
      const visible = AppState.getFilteredSites();
      const currentIds = visible.map(s => s.id).join(',');

      // Solo reconstruir los markers y el sidebar si cambió la colección visible (filtros/año/búsqueda)
      if (currentIds !== lastRenderedIds) {
        MapModule.renderMarkers(visible, state);
        UI.renderSidebar(visible, state);
        UI.renderLegend(visible);
        lastRenderedIds = currentIds;
      } else {
        // Si no cambiaron los datos, solo actualizar el estado visual (hover/selected) de los ya existentes
        MapModule.updateMarkersState(state);
        UI.updateSidebarState(state);
      }
      
      // Control de visibilidad del Tren Maya por año
      MapModule.toggleTrenMayaLayers(state.year >= 2024);
      MapModule.toggleDTCLayers(state.year >= 2026 && (state.filter === 'all' || state.filter === 'dtc'));
      MapModule.toggleMichoacanLayers(state.year >= 2026 && (state.filter === 'all' || state.filter === 'dtc'));
    });

    console.log(`✅ Geoportal FONATUR cargado — ${sites.length} desarrollos`);
  } catch (err) {
    console.error('Error al iniciar geoportal:', err);
    document.getElementById('sitesList').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar datos</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', boot);
