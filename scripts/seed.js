import pg from 'pg';
import fs from 'fs';
import readline from 'readline';
import { config } from 'dotenv';
config({ path: '../.env' });

// ── Configuration ──────────────────────────────────────────────────
// Put clues.tsv anywhere and point this path at it.
// Easiest: drop it in the scripts/ folder alongside seed.js.
const TSV_PATH   = process.env.TSV_PATH || './clues.tsv';
const BATCH_SIZE = 500;   // rows per INSERT — larger = faster, uses more memory

function getDifficulty(answer) {
  const len = answer.length;
  if (len <= 3)  return 1;
  if (len <= 5)  return 2;
  if (len <= 7)  return 3;
  if (len <= 10) return 4;
  return 5;
}

// Only keep answers that are purely alphabetic (A-Z).
// The TSV has some entries with numbers, punctuation, etc.
function isValidAnswer(answer) {
  return /^[A-Z]+$/.test(answer) && answer.length >= 2 && answer.length <= 15;
}

async function seed() {
  if (!fs.existsSync(TSV_PATH)) {
    console.error(`TSV file not found: ${TSV_PATH}`);
    console.error('Place clues.tsv in the scripts/ folder or set TSV_PATH env variable.');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

  const rl = readline.createInterface({
    input:     fs.createReadStream(TSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum   = 0;
  let inserted  = 0;
  let skipped   = 0;
  let batch     = [];

  async function flushBatch() {
    if (batch.length === 0) return;

    // Build one multi-row INSERT for the whole batch.
    // $1=pubid $2=year $3=answer $4=clue $5=difficulty, repeated per row.
    const params  = [];
    const clauses = batch.map(({ pubid, year, answer, clue }, i) => {
      const b = i * 5;
      params.push(pubid, year, answer, clue, getDifficulty(answer));
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`;
    });

    try {
      const result = await pool.query(
        `INSERT INTO clues (pubid, year, answer, clue, difficulty)
         VALUES ${clauses.join(',')}
         ON CONFLICT (pubid, year, answer, clue) DO NOTHING`,
        params
      );
      inserted += result.rowCount;
      skipped  += batch.length - result.rowCount;
    } catch (err) {
      console.error(`DB error at line ~${lineNum}:`, err.message);
    }

    batch = [];
  }

  console.log(`Reading ${TSV_PATH} …`);

  for await (const line of rl) {
    lineNum++;

    // Skip the header row
    if (lineNum === 1) continue;

    // TSV columns: pubid \t year \t answer \t clue
    // We split on the first 3 tabs only — the clue itself may contain tabs
    const parts = line.split('\t');
    if (parts.length < 4) continue;

    const pubid  = parts[0]?.trim();
    const year   = parseInt(parts[1]);
    const answer = parts[2]?.trim().toUpperCase();
    // Join remaining parts in case the clue contained literal tabs
    const clue   = parts.slice(3).join('\t').trim();

    // Skip malformed rows
    if (!pubid || isNaN(year) || !answer || !clue) continue;
    if (!isValidAnswer(answer)) continue;

    batch.push({ pubid, year, answer, clue });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
      if (lineNum % 50000 === 0) {
        console.log(`Line ${lineNum.toLocaleString()}: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`);
      }
    }
  }

  // Flush whatever is left
  await flushBatch();
  await pool.end();

  console.log(`\nDone.`);
  console.log(`  Lines read:  ${lineNum.toLocaleString()}`);
  console.log(`  Inserted:    ${inserted.toLocaleString()}`);
  console.log(`  Skipped:     ${skipped.toLocaleString()} (duplicates or invalid)`);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });