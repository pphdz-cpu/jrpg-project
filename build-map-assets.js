const fs = require('fs');
const path = require('path');
const { generateTiledMap } = require('./generate-tiled-map');

const ASSETS_DIR = path.join(__dirname, 'assets');
const MOCKUP_PATH = path.join(ASSETS_DIR, 'mockup.png');
const LOGIC_PATH = path.join(ASSETS_DIR, 'logic.png');
const ROOT_LOGIC_PATH = path.join(__dirname, 'logic.png');
const TILESET_PATH = path.join(ASSETS_DIR, 'map-tileset.png');
const TMX_PATH = path.join(ASSETS_DIR, 'level.tmx');
const LEVEL_JS_PATH = path.join(ASSETS_DIR, 'level.js');

function resolveLogicPath() {
  if (fs.existsSync(LOGIC_PATH)) {
    return LOGIC_PATH;
  }

  if (fs.existsSync(ROOT_LOGIC_PATH)) {
    return ROOT_LOGIC_PATH;
  }

  throw new Error(
    `Missing logic overlay image. Add ${LOGIC_PATH} or ${ROOT_LOGIC_PATH}.`
  );
}

async function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  if (!fs.existsSync(MOCKUP_PATH)) {
    throw new Error(
      `Missing ${MOCKUP_PATH}. Place your official mockup.png in assets/ without modifying it.`
    );
  }

  const logicPath = resolveLogicPath();

  await generateTiledMap({
    inputImage: MOCKUP_PATH,
    logicImage: logicPath,
    tilesetImage: TILESET_PATH,
    outputMap: TMX_PATH,
    outputJs: LEVEL_JS_PATH,
    tilesetSourceInTmx: 'map-tileset.png',
    tilesetPublicPath: 'assets/map-tileset.png',
    displayTileSize: 32,
    offsetX: 0,
    offsetY: 0,
    mapId: 'town',
    zoneType: 'town',
    isSafeZone: true,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
