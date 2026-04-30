import pg from 'pg';
import fs from 'fs';
import readline from 'readline';
import { config } from 'dotenv';
config({ path: '../.env' });

const TSV_PATH   = process.env.TSV_PATH || './clues.tsv';
const BATCH_SIZE = 500;
const MAX_CLUES_PER_ANSWER = 5;

function isValidAnswer(answer) {
  return /^[A-Z]+$/.test(answer) && answer.length >= 3 && answer.length <= 15;
}

async function seed() {
  if (!fs.existsSync(TSV_PATH)) {
    console.error(`TSV file not found: ${TSV_PATH}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL2, max: 3 });

  const rl = readline.createInterface({
    input:     fs.createReadStream(TSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum  = 0;
  let inserted = 0;
  let skipped  = 0;
  let batch    = [];

  async function flushBatch() {
    if (batch.length === 0) return;

    // Ensure all answers exist in words table first
    const answers = [...new Set(batch.map(r => r.answer))];
    await pool.query(
      `INSERT INTO words (answer)
       SELECT unnest($1::text[])
       ON CONFLICT (answer) DO NOTHING`,
      [answers]
    );

    // Build VALUES list
    const params   = [];
    const valueRows = batch.map(({ answer, clue }, i) => {
      const b = i * 2;
      params.push(answer, clue);
      return `($${b + 1}::text, $${b + 2}::text)`;
    });

    try {
      const result = await pool.query(
        `INSERT INTO clues (word_id, clue)
         SELECT w.id, v.clue
         FROM (VALUES ${valueRows.join(',')}) AS v(answer, clue)
         JOIN words w ON w.answer = v.answer
         WHERE (
           SELECT COUNT(*)
           FROM clues c
           WHERE c.word_id = w.id
         ) < ${MAX_CLUES_PER_ANSWER}
         ON CONFLICT (word_id, clue) DO NOTHING`,
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
    if (lineNum === 1) continue;

    const parts  = line.split('\t');
    if (parts.length < 4) continue;

    const answer = parts[2]?.trim().toUpperCase();
    const clue   = parts.slice(3).join('\t').trim();

    if (!answer || !clue) continue;
    if (!isValidAnswer(answer)) continue;

    batch.push({ answer, clue });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
      if (lineNum % 50_000 === 0) {
        console.log(`Line ${lineNum.toLocaleString()}: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`);
      }
    }
  }

  await flushBatch();
  await pool.end();

  console.log(`\nDone.`);
  console.log(`  Lines read: ${lineNum.toLocaleString()}`);
  console.log(`  Inserted:   ${inserted.toLocaleString()}`);
  console.log(`  Skipped:    ${skipped.toLocaleString()} (cap reached, duplicates, or invalid)`);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });