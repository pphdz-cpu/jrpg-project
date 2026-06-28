function createGrid(width, height, fillValue) {
  return Array.from({ length: height }, () => Array(width).fill(fillValue));
}

const INN_FLOOR_GID = 687;
const INN_WALL_GID = 1;
const INN_DOOR_GID = 830;

window.TILED_LEVEL_INN = {
  mapId: 'inn_interior',
  mapName: "Traveler's Inn",
  zoneType: 'town',
  isSafeZone: true,
  isStarterTown: false,
  tileWidth: 16,
  displayTileSize: 32,
  width: 6,
  height: 5,
  offsetX: 0,
  offsetY: 0,
  tileset: 'assets/map-tileset.png',
  tilesetColumns: 54,
  firstGid: 1,
  layer: [
    [INN_WALL_GID, INN_WALL_GID, INN_WALL_GID, INN_WALL_GID, INN_WALL_GID, INN_WALL_GID],
    [INN_WALL_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_WALL_GID],
    [INN_WALL_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_WALL_GID],
    [INN_WALL_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_FLOOR_GID, INN_WALL_GID],
    [INN_WALL_GID, INN_WALL_GID, INN_WALL_GID, INN_DOOR_GID, INN_WALL_GID, INN_WALL_GID],
  ],
  collisionTileIds: [],
  damageTileIds: [],
  blocked: [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 1],
  ],
  overhead: createGrid(6, 5, 0),
  spawns: [
    {
      name: 'PlayerSpawn',
      x: 48,
      y: 48,
    },
  ],
  entityWidth: 16,
  entityHeight: 16,
  entityVisualHeight: 38,
};
