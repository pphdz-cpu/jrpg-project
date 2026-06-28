# Character assets for the map game

Place your player and NPC sprite files in this folder using these names:

## Player (required)

| File | Purpose |
|------|---------|
| `player_idle.png` | Directional idle sheet. One column, four rows: up, left, down, right |
| `player_walk.gif` | Walk animation GIF (plays while moving) |
| `player.json` | Optional size metadata (see below) |

## NPCs (optional)

| File | Purpose |
|------|---------|
| `npc_<id>.png` | Idle directional sheet for NPC `<id>` |
| `npc_<id>_walk.gif` | Walk GIF for that NPC |

Register NPCs in `assets/level.js`:

```json
"npcs": [
  { "id": "guard", "x": 10, "y": 12, "direction": 0 }
]
```

## Custom dimensions (player.json)

If your idle sheet uses different frame sizes (example: 72x52):

```json
{
  "frameWidth": 72,
  "frameHeight": 52,
  "footprintWidth": 32,
  "footprintHeight": 16,
  "visualHeight": 50,
  "directionRows": { "0": 2, "1": 1, "2": 3, "3": 0 }
}
```

Direction keys: `0=down`, `1=left`, `2=right`, `3=up`.  
Each value is the **row index** in your idle PNG (0 = top row).

## Black backgrounds

If your PNG uses `#000000` as a solid background, convert it to transparency before use, or replace the file with a transparent export.

## Current defaults

This project ships with LPC chain-mail placeholders copied from `assets/Characters/chain_armor.gif` until you drop in your own art.
