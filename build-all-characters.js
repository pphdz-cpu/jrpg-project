const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { parseGIF, decompressFrames } = require('gifuct-js');

const CHARACTERS_DIR = path.join(__dirname, 'assets', 'Characters');
const OUTPUT_ROOT = path.join(__dirname, 'assets', 'images', 'characters');

const PLAYABLE_CHARACTERS = [
  { id: 'chain_armor', label: 'Chain Knight', source: 'chain_armor.gif' },
  { id: 'leather_armor', label: 'Leather Scout', source: 'leather_armor.gif' },
  { id: 'plate_armor', label: 'Plate Guardian', source: 'plate_armor.gif' },
  { id: 'robe', label: 'Robe Mage', source: 'robe.gif' },
  { id: 'simple_clothes', label: 'Villager', source: 'simple_clothes.gif' },
  { id: 'mixed_metal', label: 'Mixed Metal', source: 'mixed_metal.gif' },
  { id: 'dark_skinned_knight', label: 'Dark Knight', source: 'dark_skinned_knight.gif' },
  { id: 'robin_hoodlike', label: 'Robin Hood', source: 'robin_hoodlike.gif' },
  { id: 'orange_recolor_monk', label: 'Orange Monk', source: 'orange_recolor_monk.gif' },
  { id: 'chain_armor_bandit', label: 'Bandit', source: 'chain_armor_bandit.gif' },
  { id: 'skeleton', label: 'Hooded Skeleton', source: 'skeleton.gif' },
];

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

async function buildCharacter(character) {
  const sourcePath = path.join(CHARACTERS_DIR, character.source);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipping ${character.id}: missing ${sourcePath}`);
    return null;
  }

  const outputDir = path.join(OUTPUT_ROOT, character.id);
  fs.mkdirSync(outputDir, { recursive: true });

  const gifBuffer = fs.readFileSync(sourcePath);
  const frames = decompressFrames(parseGIF(gifBuffer), true);

  if (frames.length === 0) {
    throw new Error(`No frames found in ${sourcePath}`);
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

  const idle = await new Jimp(frameWidth, frameHeight);
  idle.blit(walkSheet, 0, 0, 0, 0, frameWidth, frameHeight);

  const preview = await new Jimp(rowHeight, rowHeight);
  preview.blit(idle, 0, 0, 0, rowHeight * 2, rowHeight, rowHeight);

  const idlePath = path.join(outputDir, 'player_idle.png');
  const walkPath = path.join(outputDir, 'player_walk.png');
  const previewPath = path.join(outputDir, 'preview.png');
  const metaPath = path.join(outputDir, 'player.json');

  await walkSheet.writeAsync(walkPath);
  await idle.writeAsync(idlePath);
  await preview.writeAsync(previewPath);

  const meta = {
    id: character.id,
    label: character.label,
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

  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return {
    id: character.id,
    label: character.label,
    preview: `assets/images/characters/${character.id}/preview.png`,
    idle: `assets/images/characters/${character.id}/player_idle.png`,
    walk: `assets/images/characters/${character.id}/player_walk.png`,
    meta: `assets/images/characters/${character.id}/player.json`,
  };
}

async function main() {
  const roster = [];

  for (const character of PLAYABLE_CHARACTERS) {
    const built = await buildCharacter(character);
    if (built) {
      roster.push(built);
      console.log(`Built ${character.id}`);
    }
  }

  const rosterPath = path.join(OUTPUT_ROOT, 'roster.json');
  fs.writeFileSync(rosterPath, `${JSON.stringify(roster, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${rosterPath} (${roster.length} characters)`);

  const rosterJsPath = path.join(__dirname, 'characterRoster.js');
  const rosterJs = `const CHARACTER_IMAGE_ROOT = 'assets/images/characters';

const DEFAULT_PLAYER_CHARACTER_ID = '${roster[0] ? roster[0].id : 'chain_armor'}';

const EMBEDDED_ROSTER = ${JSON.stringify(roster, null, 2)};

const CharacterRoster = {
  characters: [...EMBEDDED_ROSTER],
  loaded: false,

  getById(id) {
    return this.characters.find((entry) => entry.id === id) || this.characters[0];
  },

  getDefaultId() {
    return this.characters[0] ? this.characters[0].id : DEFAULT_PLAYER_CHARACTER_ID;
  },
};

async function loadCharacterRoster() {
  if (CharacterRoster.loaded) {
    return CharacterRoster.characters;
  }

  CharacterRoster.characters = [...EMBEDDED_ROSTER];

  try {
    const response = await fetch(\`\${CHARACTER_IMAGE_ROOT}/roster.json\`);
    if (response.ok) {
      const fetchedRoster = await response.json();
      if (Array.isArray(fetchedRoster) && fetchedRoster.length > 0) {
        CharacterRoster.characters = fetchedRoster;
      }
    }
  } catch (error) {
    // Embedded roster works without a server (file:// or offline).
  }

  CharacterRoster.loaded = true;
  return CharacterRoster.characters;
}

window.CHARACTER_IMAGE_ROOT = CHARACTER_IMAGE_ROOT;
window.DEFAULT_PLAYER_CHARACTER_ID = DEFAULT_PLAYER_CHARACTER_ID;
window.CharacterRoster = CharacterRoster;
window.loadCharacterRoster = loadCharacterRoster;
`;

  fs.writeFileSync(rosterJsPath, rosterJs, 'utf8');
  console.log(`Wrote ${rosterJsPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
