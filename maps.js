/**
 * Map registry for map-to-map transitions.
 *
 * Every town map: zoneType "town"  -> no random encounters
 * Overworld map:  zoneType "overworld" -> encounters enabled
 *
 * Add new maps here after running npm run build:map for each area.
 */
const MAP_STORAGE_KEY = 'activeMapId';

window.MAP_REGISTRY = {
  town: window.TILED_LEVEL,
  // Placeholder until the overworld map is built with npm run build:map
  overworld: window.TILED_LEVEL_OVERWORLD || null,
};

function getRegisteredMap(mapId) {
  return window.MAP_REGISTRY[mapId] || null;
}

function getSavedMapId() {
  return sessionStorage.getItem(MAP_STORAGE_KEY) || 'town';
}

function resolveActiveMap() {
  const mapId = getSavedMapId();
  const mapData = getRegisteredMap(mapId);

  if (mapData) {
    return mapData;
  }

  console.warn(`Map "${mapId}" not found. Falling back to town.`);
  return window.MAP_REGISTRY.town;
}

window.TILED_LEVEL = resolveActiveMap();

window.getRegisteredMap = getRegisteredMap;

window.transitionToMapById = function transitionToMapById(mapId) {
  const mapData = getRegisteredMap(mapId);

  if (!mapData) {
    throw new Error(`Unknown map id "${mapId}". Add it to MAP_REGISTRY in maps.js.`);
  }

  sessionStorage.setItem(MAP_STORAGE_KEY, mapId);
  window.transitionToMap(mapData);
};

window.enterTown = function enterTown(mapId) {
  window.transitionToMapById(mapId || 'town');
};

window.exitToOverworld = function exitToOverworld(mapId) {
  window.transitionToMapById(mapId || 'overworld');
};
