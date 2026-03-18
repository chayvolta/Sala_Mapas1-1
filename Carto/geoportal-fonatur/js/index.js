/**
 * index.js — Bootstrap: carga datos → inicia mapa → conecta UI
 */
import { AppState } from './state.js';
import { loadSites, loadTrenMayaData } from './data.js';
import * as MapModule from './map.js';
import * as UI from './ui.js';

async function boot() {
  try {
    // 1) Cargar datos
    const [sites, trenData] = await Promise.all([
      loadSites(),
      loadTrenMayaData()
    ]);
    AppState.set({ sites });

    // 2) Iniciar mapa
    MapModule.initMap();
    MapModule.renderTrenMaya(trenData.trazo, trenData.estaciones);
    MapModule.toggleTrenMayaLayers(AppState.get('year') >= 2024);

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
    });

    console.log(`✅ Geoportal FONATUR cargado — ${sites.length} desarrollos`);
  } catch (err) {
    console.error('Error al iniciar geoportal:', err);
    document.getElementById('sitesList').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar datos</p></div>`;
  }
}

document.addEventListener('DOMContentLoaded', boot);
