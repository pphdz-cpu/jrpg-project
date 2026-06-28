const ZONE_TYPES = {
  TOWN: 'town',
  OVERWORLD: 'overworld',
};

const SAFE_ZONE_TYPES = new Set([ZONE_TYPES.TOWN]);

const GameState = {
  mapId: 'starter_town',
  mapName: 'Starter Town',
  zoneType: ZONE_TYPES.TOWN,
  isSafeZone: true,
  isStarterTown: true,

  applyMap(levelData) {
    if (!levelData) {
      return;
    }

    this.mapId = levelData.mapId || 'unknown';
    this.mapName = levelData.mapName || this.mapId;
    this.zoneType = levelData.zoneType || ZONE_TYPES.OVERWORLD;
    this.isStarterTown = Boolean(levelData.isStarterTown);

    if (typeof levelData.isSafeZone === 'boolean') {
      this.isSafeZone = levelData.isSafeZone;
    } else {
      this.isSafeZone = SAFE_ZONE_TYPES.has(this.zoneType);
    }
  },

  canTriggerEncounters() {
    return !this.isSafeZone;
  },

  isTown() {
    return this.zoneType === ZONE_TYPES.TOWN;
  },

  isOverworld() {
    return this.zoneType === ZONE_TYPES.OVERWORLD;
  },

  setZone(zoneType, options = {}) {
    this.zoneType = zoneType;
    this.isSafeZone = typeof options.isSafeZone === 'boolean'
      ? options.isSafeZone
      : SAFE_ZONE_TYPES.has(zoneType);

    if (options.mapId) {
      this.mapId = options.mapId;
    }
  },
};

if (window.TILED_LEVEL) {
  GameState.applyMap(window.TILED_LEVEL);
}

window.ZONE_TYPES = ZONE_TYPES;
window.GameState = GameState;

/**
 * Switch to another map and update zone rules.
 * Prefer transitionToMapById('town') / exitToOverworld() from maps.js.
 */
window.transitionToMap = function transitionToMap(levelData) {
  GameState.applyMap(levelData);
  window.TILED_LEVEL = levelData;
  window.location.reload();
};
