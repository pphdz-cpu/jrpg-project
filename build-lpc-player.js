const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { parseGIF, decompressFrames } = require('gifuct-js');

const CHARACTERS_DIR = path.join(__dirname, 'assets', 'Characters');
const SOURCE_GIF = path.join(CHARACTERS_DIR, 'chain_armor.gif');
const IDLE_PNG = path.join(CHARACTERS_DIR, 'player_idle.png');
const WALK_PNG = path.join(CHARACTERS_DIR, 'player_walk.png');
const META_JSON = path.join(CHARACTERS_DIR, 'player.json');

async function patchToJimp(frame) {
  const { width, height } = frame.dims;
  const { patch } = frame;
  const image = await new Jimp(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const color = Jimp.rgbaToInt(
        patch[index],
        patch[index + 1],
        patch[index + 2],
        patch[index + 3]
      );
      image.setPixelColor(color, x, y);
    }
  }

  return image;
}

async function main() {
  if (!fs.existsSync(SOURCE_GIF)) {
    throw new Error(`Missing ${SOURCE_GIF}`);
  }

  const gifBuffer = fs.readFileSync(SOURCE_GIF);
  const frames = decompressFrames(parseGIF(gifBuffer), true);

  if (frames.length === 0) {
    throw new Error(`No frames found in ${SOURCE_GIF}`);
  }

  const frameWidth = frames[0].dims.width;
  const frameHeight = frames[0].dims.height;
  const directionRows = 4;
  const rowHeight = Math.floor(frameHeight / directionRows);
  const walkSheet = await new Jimp(frameWidth * frames.length, frameHeight);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frameImage = await patchToJimp(frames[frameIndex]);
    walkSheet.blit(frameImage, frameIndex * frameWidth, 0);
  }

  await walkSheet.writeAsync(WALK_PNG);

  const idle = await new Jimp(frameWidth, frameHeight);
  idle.blit(walkSheet, 0, 0, 0, 0, frameWidth, frameHeight);
  await idle.writeAsync(IDLE_PNG);

  const meta = {
    frameWidth,
    frameHeight: rowHeight,
    footprintWidth: 32,
    footprintHeight: 16,
    visualHeight: 52,
    walkFrameCount: frames.length,
    walkFrameDelay: frames[0].delay || 120,
    directionRows: {
      0: 2,
      1: 1,
      2: 3,
      3: 0,
    },
  };

  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${WALK_PNG} (${frames.length} frames)`);
  console.log(`Wrote ${IDLE_PNG}`);
  console.log(`Wrote ${META_JSON}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
