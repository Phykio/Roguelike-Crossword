import { Router } from 'express';
import pool from '../db.js';
import { buildPuzzle }    from '../services/puzzleBuilder.js';
import { getLevelConfig } from '../config/levelConfig.js';

const router = Router();

// GET /api/puzzle?level=1&size=9&playerId=xxx
router.get('/', async (req, res, next) => {
  try {
    const { playerId } = req.query;
    const level        = parseInt(req.query.level) || 1;
    const config       = getLevelConfig(level);
    const size         = parseInt(req.query.size) || config.size;
    const difficulty   = config.difficulty;

    let usedClueIds = [];

    // If we have a playerId, fetch their history from the DB
    if (playerId) {
      const { rows } = await pool.query(
        'SELECT clue_id FROM player_used_clues WHERE player_id = $1',
        [playerId]
      );
      usedClueIds = rows.map(r => r.clue_id);
    }

    // Now buildPuzzle handles the exclusion logic using the array from our DB
    const puzzle = await buildPuzzle(size, difficulty, usedClueIds);
    res.json(puzzle);
  } catch (err) {
    next(err);
  }
});

// POST /api/puzzle/complete  body: { playerId, clueIds }
router.post('/complete', async (req, res, next) => {
  try {
    const { playerId, clueIds } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    if (!Array.isArray(clueIds) || clueIds.length === 0) return res.json({ ok: true });

    // Ensure player exists
    await pool.query(
      'INSERT INTO players (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [playerId]
    );

    const params  = [playerId];
    const clauses = clueIds.map((id, i) => {
      params.push(id);
      return `($1,$${i + 2})`;
    });

    // Save progress to the DB
    await pool.query(
      `INSERT INTO player_used_clues (player_id, clue_id)
       VALUES ${clauses.join(',')}
       ON CONFLICT DO NOTHING`,
      params
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;