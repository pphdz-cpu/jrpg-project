/**
 * Multi-map world registry and door/warp definitions.
 * Each entry wraps a Tiled level object plus cols/rows aliases.
 */
function buildWorldMapEntry(levelData) {
  const rows = levelData.height || (levelData.layer ? levelData.layer.length : 0);
  const cols = levelData.width || (levelData.layer && levelData.layer[0] ? levelData.layer[0].length : 0);

  return {
    level: levelData,
    data: levelData.layer,
    cols,
    rows,
    mapId: levelData.mapId,
    mapName: levelData.mapName || levelData.mapId,
  };
}

const worldMaps = {
  city: buildWorldMapEntry(window.TILED_LEVEL),
  inn_interior: buildWorldMapEntry(window.TILED_LEVEL_INN),
};

const warpZones = [
  {
    fromMap: 'city',
    fromX: 10,
    fromY: 15,
    toMap: 'inn_interior',
    toX: 3,
    toY: 3,
  },
  {
    fromMap: 'inn_interior',
    fromX: 3,
    fromY: 4,
    toMap: 'city',
    toX: 10,
    toY: 16,
  },
];

function findWarpZone(mapKey, x, y) {
  return warpZones.find((warp) => (
    warp.fromMap === mapKey
    && warp.fromX === x
    && warp.fromY === y
  )) || null;
}

window.worldMaps = worldMaps;
window.warpZones = warpZones;
window.findWarpZone = findWarpZone;
window.buildWorldMapEntry = buildWorldMapEntry;
