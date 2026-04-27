import { Router } from 'express';
import pool from '../db.js';
import { UPGRADE_COSTS } from '../config/levelConfig.js';
 
const router = Router();
 
// POST /api/run/start
router.post('/start', async (req, res, next) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    await pool.query(
      'INSERT INTO players (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
      [playerId]
    );
    const { rows } = await pool.query(
      `INSERT INTO runs (player_id, score, level, coins, status, hearts)
       VALUES ($1, 0, 1, 0, 'active', 1)
       RETURNING *`,
      [playerId]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});
 
// PATCH /api/run/:id/level-complete
router.patch('/:id/level-complete', async (req, res, next) => {
  try {
    const { score, coins } = req.body;
    const { rows } = await pool.query(
      `UPDATE runs SET score=$1, coins=$2, level=level+1
       WHERE id=$3 AND status='active' RETURNING *`,
      [score, coins, parseInt(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});
 
// PATCH /api/run/:id/end
router.patch('/:id/end', async (req, res, next) => {
  try {
    const { status, score } = req.body;
    if (!['won','lost'].includes(status))
      return res.status(400).json({ error: "status must be 'won' or 'lost'" });
    const { rows } = await pool.query(
      'UPDATE runs SET status=$1, score=$2, ended_at=NOW() WHERE id=$3 RETURNING *',
      [status, score, parseInt(req.params.id)]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});
 
// POST /api/run/:id/upgrade
router.post('/:id/upgrade', async (req, res, next) => {
  try {
    const { upgrade, currentCoins } = req.body;
    const cost = UPGRADE_COSTS[upgrade];
    if (cost === undefined) return res.status(400).json({ error: 'Unknown upgrade' });
    if (currentCoins < cost) return res.status(400).json({ error: 'Not enough coins' });
    const newCoins = currentCoins - cost;
    await pool.query('UPDATE runs SET coins=$1 WHERE id=$2', [newCoins, parseInt(req.params.id)]);
    await pool.query('INSERT INTO run_upgrades (run_id, upgrade) VALUES ($1,$2)', [parseInt(req.params.id), upgrade]);
    res.json({ ok: true, newCoins });
  } catch (err) { next(err); }
});
 
export default router;
