const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const CHARACTERS_DIR = path.join(__dirname, 'assets', 'Characters');
const SOURCE_GIF = path.join(CHARACTERS_DIR, 'chain_armor.gif');
const IDLE_PNG = path.join(CHARACTERS_DIR, 'player_idle.png');

async function main() {
  if (!fs.existsSync(SOURCE_GIF)) {
    throw new Error(`Missing ${SOURCE_GIF}`);
  }

  const gif = await Jimp.read(SOURCE_GIF);
  const frameWidth = gif.bitmap.width;
  const frameHeight = Math.floor(gif.bitmap.height / 4);
  const idle = new Jimp(frameWidth, frameHeight * 4);

  for (let row = 0; row < 4; row += 1) {
    idle.blit(gif, 0, row * frameHeight, 0, row * frameHeight, frameWidth, frameHeight);
  }

  await idle.writeAsync(IDLE_PNG);
  console.log(`Wrote ${IDLE_PNG} from ${SOURCE_GIF}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
