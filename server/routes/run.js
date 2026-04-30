import express from 'express';
import pool from '../db.js';

const router = express.Router();

const PERMANENT_COSTS = {
  extra_time:      50,
  extra_heart:     100,
  bonus_time_long: 80,
};

const PERMANENT_RULES = {
  extra_heart: {
    cost:     PERMANENT_COSTS.extra_heart,
    column:   'extra_hearts_count',
    max:      4,
    apply:    (run) => ({
      extra_hearts_count: run.extra_hearts_count + 1,
      hearts:             run.hearts + 1,
    }),
    limitMsg: 'Maximum 5 hearts reached.',
  },
  extra_time: {
    cost:     PERMANENT_COSTS.extra_time,
    column:   'extra_time_seconds',
    max:      300,
    apply:    (run) => ({
      extra_time_seconds: run.extra_time_seconds + 30,
    }),
    limitMsg: 'Maximum +5 minutes of extra time reached.',
  },
  bonus_time_long: {
    cost:     PERMANENT_COSTS.bonus_time_long,
    column:   'bonus_time_long_purchased',
    max:      1,
    apply:    (_run) => ({
      bonus_time_long_purchased: true,
    }),
    limitMsg: 'Already purchased.',
  },
};

// POST /api/run/:id/permanent
router.post('/:id/permanent', async (req, res) => {
  const runId = req.params.id;
  const { type } = req.body;

  const rule = PERMANENT_RULES[type];
  if (!rule) return res.status(400).json({ error: 'Unknown upgrade type.' });

  try {
    const { rows } = await pool.query(`SELECT * FROM runs WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run)                    return res.status(404).json({ error: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ error: 'Run is not active.' });
    if (run.coins < rule.cost)   return res.status(400).json({ error: 'Not enough coins.' });

    const currentValue = typeof run[rule.column] === 'boolean'
      ? (run[rule.column] ? 1 : 0)
      : (run[rule.column] ?? 0);

    if (currentValue >= rule.max) {
      return res.status(400).json({ error: rule.limitMsg });
    }

    const updates    = { coins: run.coins - rule.cost, ...rule.apply(run) };
    const keys       = Object.keys(updates);
    const values     = Object.values(updates);
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');

    const { rows: updated } = await pool.query(
      `UPDATE runs SET ${setClauses} WHERE id = $1 RETURNING *`,
      [runId, ...values]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('[permanent upgrade]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/run/:id/active
// Body: { type: string, cost: number }
// Deducts coins from the DB and returns the updated run row.
router.post('/:id/active', async (req, res) => {
  const runId      = req.params.id;
  const { type, cost } = req.body;

  if (typeof cost !== 'number' || cost < 0) {
    return res.status(400).json({ error: 'Invalid cost.' });
  }

  try {
    const { rows } = await pool.query(`SELECT * FROM runs WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run)                    return res.status(404).json({ error: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ error: 'Run is not active.' });
    if (run.coins < cost)        return res.status(400).json({ error: 'Not enough coins.' });

    const { rows: updated } = await pool.query(
      `UPDATE runs SET coins = coins - $2 WHERE id = $1 RETURNING *`,
      [runId, cost]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('[active upgrade]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;