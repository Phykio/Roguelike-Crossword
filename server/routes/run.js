import { Router } from 'express';
import pool from '../db.js';
import { UPGRADE_COSTS } from '../config/levelConfig.js';

const router = Router();

// ── These MUST match PERMANENT_COSTS and ACTIVE_COSTS in gameStore.js ──
const PERMANENT_COSTS = {
  extra_time:      50,
  extra_heart:     100,
  bonus_time_long: 80,
};

const ACTIVE_COSTS = {
  hint:            10,
  skip_word:       40,
  reveal_vowels:   25,
  hint_pos:        15,
  hint_synonym:    25,
  hint_definition: 35,
  hint_example:    20,
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
    max:      600,
    apply:    (run) => ({
      extra_time_seconds: run.extra_time_seconds + 30,
    }),
    limitMsg: 'Maximum +10 minutes of extra time reached.',
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
// Called at end of each level — commits locally-accumulated score and coins to DB
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
    if (!['won', 'lost'].includes(status))
      return res.status(400).json({ error: "status must be 'won' or 'lost'" });
    const { rows } = await pool.query(
      'UPDATE runs SET status=$1, score=$2, ended_at=NOW() WHERE id=$3 RETURNING *',
      [status, score, parseInt(req.params.id)]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/run/:id/upgrade (legacy — kept for backwards compat)
router.post('/:id/upgrade', async (req, res, next) => {
  try {
    const { upgrade, currentCoins } = req.body;
    const cost = UPGRADE_COSTS[upgrade];
    if (cost === undefined) return res.status(400).json({ error: 'Unknown upgrade' });
    if (currentCoins < cost) return res.status(400).json({ error: 'Not enough coins' });
    const runId = parseInt(req.params.id);
    const newCoins = currentCoins - cost;
    await pool.query('UPDATE runs SET coins=$1 WHERE id=$2', [newCoins, runId]);
    await pool.query('INSERT INTO run_upgrades (run_id, upgrade) VALUES ($1,$2)', [runId, upgrade]);
    res.json({ ok: true, newCoins });
  } catch (err) { next(err); }
});

// POST /api/run/:id/permanent
// Deducts coins and applies a persistent upgrade for the rest of the run.
router.post('/:id/permanent', async (req, res) => {
  const runId = parseInt(req.params.id, 10);
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
// Validates cost server-side against ACTIVE_COSTS, deducts from DB, returns updated run.
// This keeps coins consistent — the frontend never deducts locally for active purchases.
router.post('/:id/active', async (req, res) => {
  const runId      = parseInt(req.params.id, 10);
  const { type, cost } = req.body;

  // Validate that the cost sent by the client matches our server-side record
  const expectedCost = ACTIVE_COSTS[type];
  if (expectedCost === undefined) {
    return res.status(400).json({ error: 'Unknown upgrade type.' });
  }
  if (cost !== expectedCost) {
    return res.status(400).json({ error: 'Cost mismatch.' });
  }

  try {
    const { rows } = await pool.query(`SELECT * FROM runs WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run)                    return res.status(404).json({ error: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ error: 'Run is not active.' });
    if (run.coins < expectedCost) return res.status(400).json({ error: 'Not enough coins.' });

    const { rows: updated } = await pool.query(
      `UPDATE runs SET coins = coins - $2 WHERE id = $1 RETURNING *`,
      [runId, expectedCost]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('[active upgrade]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;