import express from 'express';
import pool from '../db.js';

const router = express.Router();

const PERMANENT_COSTS = {
  extra_time:      30,
  extra_heart:     100, // Updated to 100 as per your latest snippet
  bonus_time_long: 50,
};

// Per-type rules: which DB column to check, cost, and ceiling
const PERMANENT_RULES = {
  extra_heart: {
    cost:    PERMANENT_COSTS.extra_heart,
    column:  'extra_hearts_count',
    max:     4,            // 1 base heart + 4 extra = 5 total
    apply:   (run) => ({
      extra_hearts_count: run.extra_hearts_count + 1,
      hearts:             run.hearts + 1,   // immediately give the heart
    }),
    limitMsg: 'Maximum 5 hearts reached.',
  },
  extra_time: {
    cost:    PERMANENT_COSTS.extra_time,
    column:  'extra_time_seconds',
    max:     600,          // 10 minutes extra
    apply:   (run) => ({
      extra_time_seconds: run.extra_time_seconds + 30,
    }),
    limitMsg: 'Maximum +10 minutes of extra time reached.',
  },
  bonus_time_long: {
    cost:    PERMANENT_COSTS.bonus_time_long,
    column:  'bonus_time_long_purchased',
    max:     1,            // boolean — 0 or 1
    apply:   (_run) => ({
      bonus_time_long_purchased: true,
    }),
    limitMsg: 'Already purchased.',
  },
};

// POST /api/run/:id/permanent
// Body: { type: 'extra_heart' | 'extra_time' | 'bonus_time_long' }
// Returns: updated run row
router.post('/:id/permanent', async (req, res) => {
  // FIXED: No parseInt here. UUIDs must remain strings to match the DB.
  const runId = req.params.id;
  const { type } = req.body;

  const rule = PERMANENT_RULES[type];
  if (!rule) return res.status(400).json({ error: 'Unknown upgrade type.' });

  try {
    // Fetch current run
    const { rows } = await pool.query(
      `SELECT * FROM runs WHERE id = $1`,
      [runId]
    );
    
    const run = rows[0];
    if (!run)                   return res.status(404).json({ error: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ error: 'Run is not active.' });

    // Check coins
    if (run.coins < rule.cost) {
      return res.status(400).json({ error: 'Not enough coins.' });
    }

    // Check limit — boolean columns are stored as true/false, coerce to 0/1 for comparison
    const currentValue = typeof run[rule.column] === 'boolean'
      ? (run[rule.column] ? 1 : 0)
      : (run[rule.column] ?? 0);

    if (currentValue >= rule.max) {
      return res.status(400).json({ error: rule.limitMsg });
    }

    // Build the SET clause dynamically from the rule's apply() diff
    const updates = {
      coins: run.coins - rule.cost,
      ...rule.apply(run),
    };

    const keys    = Object.keys(updates);
    const values  = Object.values(updates);
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

// FIXED: Added the default export so index.js can import 'runRoutes'
export default router;