const CHARACTER_ROOT = 'assets/Characters';

const DIRECTION = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
};

const DEFAULT_PLAYER_META = {
  frameWidth: 64,
  frameHeight: 64,
  footprintWidth: 32,
  footprintHeight: 16,
  visualHeight: 52,
  walkFrameCount: 9,
  walkFrameDelay: 120,
  directionRows: {
    0: 2,
    1: 1,
    2: 3,
    3: 0,
  },
};

const DEFAULT_NPC_META = {
  frameWidth: 64,
  frameHeight: 64,
  footprintWidth: 32,
  footprintHeight: 16,
  visualHeight: 52,
  walkFrameCount: 9,
  walkFrameDelay: 120,
  directionRows: DEFAULT_PLAYER_META.directionRows,
};

const CharacterAssets = {
  playerMeta: { ...DEFAULT_PLAYER_META },
  images: {
    playerIdle: null,
    playerWalk: null,
    npcs: {},
  },
  ready: false,

  paths: {
    playerIdle: `${CHARACTER_ROOT}/player_idle.png`,
    playerWalk: `${CHARACTER_ROOT}/player_walk.png`,
    playerMeta: `${CHARACTER_ROOT}/player.json`,
    npc: (id) => `${CHARACTER_ROOT}/npc_${id}.png`,
    npcWalk: (id) => `${CHARACTER_ROOT}/npc_${id}_walk.png`,
  },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    image.src = src;
  });
}

async function loadPlayerMeta() {
  try {
    const response = await fetch(CharacterAssets.paths.playerMeta);
    if (!response.ok) {
      throw new Error(`Failed to load ${CharacterAssets.paths.playerMeta}`);
    }
    const meta = await response.json();
    CharacterAssets.playerMeta = { ...DEFAULT_PLAYER_META, ...meta };
  } catch (error) {
    CharacterAssets.playerMeta = { ...DEFAULT_PLAYER_META };
  }
}

function getDirectionRow(direction, meta) {
  return meta.directionRows[direction] ?? meta.directionRows[DIRECTION.DOWN];
}

function getWalkFrameIndex(meta, walkStartedAt) {
  if (!walkStartedAt) {
    return 0;
  }

  const elapsed = performance.now() - walkStartedAt;
  const frame = Math.floor(elapsed / meta.walkFrameDelay);
  return frame % meta.walkFrameCount;
}

function getSpriteFrameRect(direction, meta, options = {}) {
  const row = getDirectionRow(direction, meta);
  const moving = Boolean(options.isMoving && options.useWalkSheet);
  const frameIndex = moving ? getWalkFrameIndex(meta, options.walkStartedAt) : 0;

  return {
    sx: frameIndex * meta.frameWidth,
    sy: row * meta.frameHeight,
    sw: meta.frameWidth,
    sh: meta.frameHeight,
  };
}

function getDrawDimensions(rect, meta, tileSize, sourceTileSize) {
  const pixelScale = tileSize / sourceTileSize;
  const targetHeight = Math.round(meta.visualHeight * pixelScale);
  const targetWidth = Math.round(targetHeight * (rect.sw / rect.sh));

  return {
    targetWidth,
    targetHeight,
    footprintWidth: Math.round(meta.footprintWidth * pixelScale),
    footprintHeight: Math.round(meta.footprintHeight * pixelScale),
  };
}

function drawCharacterSprite(ctx, options) {
  const {
    image,
    walkImage,
    direction,
    isMoving,
    walkStartedAt,
    x,
    y,
    tileSize,
    sourceTileSize,
    meta,
  } = options;

  const useWalkSheet = Boolean(walkImage);
  const spriteImage = useWalkSheet ? walkImage : image;
  if (!spriteImage) {
    return;
  }

  const frameRect = getSpriteFrameRect(direction, meta, {
    isMoving: isMoving && useWalkSheet,
    useWalkSheet,
    walkStartedAt,
  });
  const dimensions = getDrawDimensions(frameRect, meta, tileSize, sourceTileSize);
  const feetX = x * tileSize + tileSize / 2;
  const feetY = y * tileSize + tileSize;
  const drawX = Math.round(feetX - dimensions.targetWidth / 2);
  const drawY = Math.round(feetY - dimensions.targetHeight);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    spriteImage,
    frameRect.sx,
    frameRect.sy,
    frameRect.sw,
    frameRect.sh,
    drawX,
    drawY,
    dimensions.targetWidth,
    dimensions.targetHeight
  );
}

async function preloadCharacterAssets(levelData) {
  await loadPlayerMeta();

  const loads = [
    loadImage(CharacterAssets.paths.playerIdle)
      .then((image) => {
        CharacterAssets.images.playerIdle = image;
      })
      .catch(() => {
        CharacterAssets.images.playerIdle = null;
      }),
    loadImage(CharacterAssets.paths.playerWalk)
      .then((image) => {
        CharacterAssets.images.playerWalk = image;
      })
      .catch(() => {
        CharacterAssets.images.playerWalk = null;
      }),
  ];

  const npcs = (levelData && levelData.npcs) || [];
  npcs.forEach((npc) => {
    loads.push(
      loadImage(CharacterAssets.paths.npc(npc.id))
        .then((image) => {
          CharacterAssets.images.npcs[npc.id] = {
            idle: image,
            walk: null,
            meta: { ...DEFAULT_NPC_META, ...npc.meta },
          };
        })
        .catch(() => {
          CharacterAssets.images.npcs[npc.id] = {
            idle: null,
            walk: null,
            meta: { ...DEFAULT_NPC_META, ...npc.meta },
          };
        })
    );

    loads.push(
      loadImage(CharacterAssets.paths.npcWalk(npc.id))
        .then((image) => {
          if (!CharacterAssets.images.npcs[npc.id]) {
            CharacterAssets.images.npcs[npc.id] = {
              idle: null,
              walk: image,
              meta: { ...DEFAULT_NPC_META, ...npc.meta },
            };
          } else {
            CharacterAssets.images.npcs[npc.id].walk = image;
          }
        })
        .catch(() => {})
    );
  });

  await Promise.all(loads);
  CharacterAssets.ready = true;
}

function drawPlayerCharacter(ctx, player, tileSize, sourceTileSize) {
  drawCharacterSprite(ctx, {
    image: CharacterAssets.images.playerIdle,
    walkImage: CharacterAssets.images.playerWalk,
    direction: player.direction,
    isMoving: player.isMoving,
    walkStartedAt: player.walkStartedAt,
    x: player.x,
    y: player.y,
    tileSize,
    sourceTileSize,
    meta: CharacterAssets.playerMeta,
  });
}

function drawNpcs(ctx, npcs, tileSize, sourceTileSize) {
  if (!npcs) {
    return;
  }

  npcs.forEach((npc) => {
    const asset = CharacterAssets.images.npcs[npc.id];
    if (!asset) {
      return;
    }

    drawCharacterSprite(ctx, {
      image: asset.idle,
      walkImage: asset.walk,
      direction: npc.direction || DIRECTION.DOWN,
      isMoving: Boolean(npc.isMoving),
      walkStartedAt: npc.walkStartedAt,
      x: npc.x,
      y: npc.y,
      tileSize,
      sourceTileSize,
      meta: asset.meta,
    });
  });
}

window.DIRECTION = DIRECTION;
window.CharacterAssets = CharacterAssets;
window.preloadCharacterAssets = preloadCharacterAssets;
window.drawPlayerCharacter = drawPlayerCharacter;
window.drawNpcs = drawNpcs;
