const Jimp = require('jimp');

const TILE_SIZE = 16;

const LOGIC_COLORS = {
  spawn: { r: 255, g: 0, b: 0 },
  collision: { r: 0, g: 0, b: 255 },
  damage: { r: 255, g: 255, b: 0 },
};

function isExactLogicColor(r, g, b, logicColor) {
  return r === logicColor.r && g === logicColor.g && b === logicColor.b;
}

function isGrassPixel(r, g, b) {
  if (g > r + 10 && g > b + 8 && g >= 95 && b < 130) {
    return true;
  }

  if (g >= 95 && g > r - 20 && g > b + 10 && r >= 80 && r <= 200 && b <= 110) {
    return true;
  }

  return false;
}

function isPathPixel(r, g, b) {
  return (
    r > 120
    && r < 190
    && g > 115
    && g < 185
    && b > 110
    && b < 180
    && Math.abs(r - g) < 15
    && Math.abs(g - b) < 15
  );
}

function isDirtPixel(r, g, b) {
  return (
    r >= 120
    && g >= 80
    && g <= 135
    && b >= 45
    && b <= 95
    && r > g
    && g > b
    && r - b > 35
  );
}

function isFloorPixel(r, g, b) {
  return isGrassPixel(r, g, b) || isPathPixel(r, g, b) || isDirtPixel(r, g, b);
}

function isWaterPixel(r, g, b) {
  return b > 95 && b > r + 20 && b > g + 5 && r < 120 && g < 140;
}

function isTreePixel(r, g, b) {
  return (
    (r > 140 && g > 70 && g < 190 && b < 100 && r > g)
    || (r > 70 && r < 150 && g > 30 && g < 100 && b < 70 && r > g + 10)
  );
}

function isWoodPixel(r, g, b) {
  return r > 90 && r < 200 && g > 50 && g < 140 && b < 90 && r >= g - 10;
}

function isStoneWallPixel(r, g, b) {
  return (
    r > 55
    && r < 125
    && g > 55
    && g < 125
    && b > 55
    && b < 125
    && Math.max(r, g, b) - Math.min(r, g, b) < 25
  );
}

function isRoofPixel(r, g, b) {
  return (
    r > 75
    && r < 140
    && g > 75
    && g < 140
    && b > 75
    && b < 140
    && Math.abs(r - g) < 18
    && Math.abs(g - b) < 18
  );
}

function isCharacterPixel(r, g, b) {
  if (isFloorPixel(r, g, b)) {
    return false;
  }

  return (
    (b > 120 && b > r + 20 && g < 190)
    || (r > 185 && g > 145 && b > 105 && r >= g)
    || (r > 210 && g > 180 && b > 90)
  );
}

function analyzeTile(mockup, logic, col, row, offsetX, offsetY) {
  const counts = {
    grass: 0,
    path: 0,
    dirt: 0,
    water: 0,
    tree: 0,
    wood: 0,
    wall: 0,
    roof: 0,
    character: 0,
    other: 0,
    logicBlue: 0,
    logicRed: 0,
    logicDamage: 0,
  };

  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      const x = offsetX + col * TILE_SIZE + dx;
      const y = offsetY + row * TILE_SIZE + dy;
      const { r, g, b } = Jimp.intToRGBA(mockup.getPixelColor(x, y));
      const logicPixel = Jimp.intToRGBA(logic.getPixelColor(x, y));

      if (isExactLogicColor(logicPixel.r, logicPixel.g, logicPixel.b, LOGIC_COLORS.collision)) {
        counts.logicBlue += 1;
      }
      if (isExactLogicColor(logicPixel.r, logicPixel.g, logicPixel.b, LOGIC_COLORS.spawn)) {
        counts.logicRed += 1;
      }
      if (isExactLogicColor(logicPixel.r, logicPixel.g, logicPixel.b, LOGIC_COLORS.damage)) {
        counts.logicDamage += 1;
      }

      if (isGrassPixel(r, g, b)) {
        counts.grass += 1;
      } else if (isPathPixel(r, g, b)) {
        counts.path += 1;
      } else if (isDirtPixel(r, g, b)) {
        counts.dirt += 1;
      } else if (isWaterPixel(r, g, b)) {
        counts.water += 1;
      } else if (isCharacterPixel(r, g, b)) {
        counts.character += 1;
      } else if (isTreePixel(r, g, b)) {
        counts.tree += 1;
      } else if (isWoodPixel(r, g, b)) {
        counts.wood += 1;
      } else if (isRoofPixel(r, g, b)) {
        counts.roof += 1;
      } else if (isStoneWallPixel(r, g, b)) {
        counts.wall += 1;
      } else {
        counts.other += 1;
      }
    }
  }

  return counts;
}

function isEnvironmentBlocked(counts) {
  if (counts.logicRed > 0) {
    return false;
  }

  if (counts.logicBlue > 0) {
    return true;
  }

  if (counts.character >= 95) {
    return true;
  }

  const floor = counts.grass + counts.path + counts.dirt;
  const blocking = counts.water + counts.tree + counts.wood + counts.wall + counts.roof + counts.other;

  if (counts.water >= 20) {
    return true;
  }

  if (floor >= 130) {
    return false;
  }

  if (floor >= 85 && counts.roof < 30 && counts.wall < 30 && counts.wood < 35) {
    return false;
  }

  if (counts.roof >= 50) {
    return true;
  }

  if (counts.wall >= 50) {
    return true;
  }

  if (counts.wood >= 45) {
    return true;
  }

  if (counts.tree >= 45 && floor < 70) {
    return true;
  }

  if (blocking >= 110 && blocking > floor + 40) {
    return true;
  }

  if (floor < 50 && blocking >= 60) {
    return true;
  }

  return false;
}

function isNpcBlocked(counts, environmentBlocked) {
  if (!environmentBlocked || counts.logicRed > 0 || counts.character < 95) {
    return false;
  }

  const floor = counts.grass + counts.path + counts.dirt;
  return floor < 90;
}

function buildBlockedGrid(mockup, logic, mapWidth, mapHeight, offsetX = 0, offsetY = 0) {
  const blocked = [];
  const npcCells = [];

  for (let row = 0; row < mapHeight; row += 1) {
    const rowValues = [];

    for (let col = 0; col < mapWidth; col += 1) {
      const counts = analyzeTile(mockup, logic, col, row, offsetX, offsetY);
      const environmentBlocked = isEnvironmentBlocked(counts);
      const cellBlocked = environmentBlocked;

      rowValues.push(cellBlocked ? 1 : 0);

      if (isNpcBlocked(counts, environmentBlocked)) {
        npcCells.push({ x: col, y: row, characterPixels: counts.character });
      }
    }

    blocked.push(rowValues);
  }

  return {
    blocked,
    npcCells,
  };
}

function clusterNpcCells(npcCells) {
  if (npcCells.length === 0) {
    return [];
  }

  const remaining = new Set(npcCells.map((cell) => `${cell.x},${cell.y}`));
  const lookup = new Map(npcCells.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const clusters = [];

  remaining.forEach((key) => {
    if (!remaining.has(key)) {
      return;
    }

    const [startX, startY] = key.split(',').map(Number);
    const queue = [[startX, startY]];
    const cluster = [];

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const currentKey = `${x},${y}`;

      if (!remaining.has(currentKey)) {
        continue;
      }

      remaining.delete(currentKey);
      cluster.push(lookup.get(currentKey));

      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].forEach(([nextX, nextY]) => {
        const nextKey = `${nextX},${nextY}`;
        if (remaining.has(nextKey)) {
          queue.push([nextX, nextY]);
        }
      });
    }

    clusters.push(cluster);
  });

  return clusters
    .filter((cluster) => cluster.length <= 8)
    .map((cluster, index) => {
    const avgX = cluster.reduce((sum, cell) => sum + cell.x, 0) / cluster.length;
    const avgY = cluster.reduce((sum, cell) => sum + cell.y, 0) / cluster.length;

    return {
      id: `npc_${String(index + 1).padStart(3, '0')}`,
      x: Math.round(avgX),
      y: Math.round(avgY),
      direction: 0,
      tiles: cluster.map((cell) => ({ x: cell.x, y: cell.y })),
    };
  });
}

async function detectMapCollision(options) {
  const mockup = await Jimp.read(options.mockupPath);
  const logic = await Jimp.read(options.logicPath);
  const offsetX = Number.isInteger(options.offsetX) ? options.offsetX : 0;
  const offsetY = Number.isInteger(options.offsetY) ? options.offsetY : 0;
  const mapWidth = options.mapWidth;
  const mapHeight = options.mapHeight;

  const { blocked, npcCells } = buildBlockedGrid(
    mockup,
    logic,
    mapWidth,
    mapHeight,
    offsetX,
    offsetY
  );

  const blockedCount = blocked.reduce(
    (sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0),
    0
  );
  const npcs = clusterNpcCells(npcCells);

  return {
    blocked,
    npcs,
    blockedCount,
    walkableCount: mapWidth * mapHeight - blockedCount,
    npcCellCount: npcCells.length,
  };
}

module.exports = {
  TILE_SIZE,
  analyzeTile,
  isEnvironmentBlocked,
  isNpcBlocked,
  buildBlockedGrid,
  clusterNpcCells,
  detectMapCollision,
};
