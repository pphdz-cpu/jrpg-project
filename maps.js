/**
 * Map registry for map-to-map transitions.
 *
 * starter_town: the mockup.png starter village (safe zone, no encounters)
 * overworld: outside world (encounters enabled)
 */
const MAP_STORAGE_KEY = 'activeMapId';
const DEFAULT_MAP_ID = 'starter_town';

window.MAP_REGISTRY = {
  starter_town: window.TILED_LEVEL,
  // Backward-compatible alias
  town: window.TILED_LEVEL,
  overworld: window.TILED_LEVEL_OVERWORLD || null,
};

function getRegisteredMap(mapId) {
  return window.MAP_REGISTRY[mapId] || null;
}

function getSavedMapId() {
  const savedMapId = sessionStorage.getItem(MAP_STORAGE_KEY);

  if (savedMapId === 'town') {
    return 'starter_town';
  }

  return savedMapId || DEFAULT_MAP_ID;
}

function resolveActiveMap() {
  const mapId = getSavedMapId();
  const mapData = getRegisteredMap(mapId);

  if (mapData) {
    return mapData;
  }

  console.warn(`Map "${mapId}" not found. Falling back to starter town.`);
  return window.MAP_REGISTRY.starter_town;
}

window.TILED_LEVEL = resolveActiveMap();

window.getRegisteredMap = getRegisteredMap;

window.transitionToMapById = function transitionToMapById(mapId) {
  const resolvedMapId = mapId === 'town' ? 'starter_town' : mapId;
  const mapData = getRegisteredMap(resolvedMapId);

  if (!mapData) {
    throw new Error(`Unknown map id "${mapId}". Add it to MAP_REGISTRY in maps.js.`);
  }

  sessionStorage.setItem(MAP_STORAGE_KEY, resolvedMapId);
  window.transitionToMap(mapData);
};

window.enterTown = function enterTown(mapId) {
  window.transitionToMapById(mapId || 'starter_town');
};

window.exitToOverworld = function exitToOverworld(mapId) {
  window.transitionToMapById(mapId || 'overworld');
};
