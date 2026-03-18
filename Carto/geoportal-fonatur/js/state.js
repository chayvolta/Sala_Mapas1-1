/**
 * state.js — Estado reactivo global (Observer pattern)
 * Sincroniza UI ↔ Mapa ante cualquier cambio de filtros, año, selección, etc.
 */

const _state = {
  sites: [],
  filter: "all", // 'all' | 'cip' | 'marina' | 'pti'
  year: 2025,
  selectedSiteId: null,
  searchTerm: "",
  sidebarOpen: true,
  hoveredSiteId: null,
};

const _listeners = new Set();

export const AppState = {
  get(key) {
    return _state[key];
  },

  getAll() {
    return { ..._state };
  },

  set(updates) {
    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (_state.hasOwnProperty(key) && _state[key] !== value) {
        _state[key] = value;
        changed = true;
      }
    }
    if (changed) {
      _listeners.forEach((fn) => fn({ ..._state }));
    }
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /** Devuelve sitios filtrados por tipo, año y búsqueda */
  getFilteredSites() {
    const term = (_state.searchTerm || "").toLowerCase();
    return _state.sites.filter((s) => {
      if (_state.filter !== "all" && s.type !== _state.filter) return false;
      if (s.year > _state.year) return false;
      if (
        term &&
        !s.name.toLowerCase().includes(term) &&
        !s.state.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  },
};
