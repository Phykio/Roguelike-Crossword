import pg from 'pg';
import fs from 'fs';
import { config } from 'dotenv';
config({ path: '../.env' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

async function seedLexiconFromWordNet() {
    console.log("[1] Reading WordNet JSON...");
    const rawData = JSON.parse(fs.readFileSync('./wordnet.json', 'utf8'));
    const synsetEntries = Object.values(rawData.synset || {});
    const dictionaryMap = new Map();

    console.log(`[2] Mapping ${synsetEntries.length.toLocaleString()} synsets to memory...`);

    for (const synset of synsetEntries) {
        const fullGloss = synset.gloss || "";
        const parts = fullGloss.split('; "'); 
        const definition = parts[0].trim();
        const example = parts.length > 1 ? parts[1].replace(/"/g, '').trim() : null;

        if (Array.isArray(synset.word)) {
            for (const w of synset.word) {
                // Remove parentheticals and underscores
                const cleanWord = w.toUpperCase().replace(/\(.*\)/g, '').replace(/_/g, ' ').trim();
                if (!dictionaryMap.has(cleanWord)) {
                    dictionaryMap.set(cleanWord, {
                        pos: synset.pos,
                        definition: definition,
                        synonym: synset.word.filter(s => s !== w).join(', ').replace(/_/g, ' '),
                        example: example
                    });
                }
            }
        }
    }

    console.log(`[3] Dictionary Map built. Unique words in JSON: ${dictionaryMap.size.toLocaleString()}`);

    // CHECKPOINT: Test a common word
    console.log(`[4] Verification Check: Does 'APPLE' exist in JSON? ${dictionaryMap.has('APPLE')}`);

    console.log("[5] Querying 'words' table for missing entries...");
    const { rows } = await pool.query(
        `SELECT w.answer FROM words w
         LEFT JOIN word_lexicon l ON w.answer = l.answer
         WHERE l.answer IS NULL
           AND length(w.answer) BETWEEN 4 AND 15
         LIMIT 350000`
    );

    console.log(`[6] Database returned ${rows.length} words to process.`);

    if (rows.length === 0) {
        console.log("!!! No words found in database to process. Check if 'words' table has data.");
        await pool.end();
        return;
    }

    let batch = [];
    let matchCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const word = rows[i].answer.toUpperCase().trim();
        const data = dictionaryMap.get(word);

        if (data) {
            batch.push({ answer: word, ...data });
            matchCount++;
        } else {
            // Keep the record so we don't scan it again
            batch.push({ answer: word, pos: null, definition: null, synonym: null, example: null });
        }

        if (batch.length >= 500 || i === rows.length - 1) {
            await insertBatch(batch);
            batch = [];
            if (i % 5000 === 0) console.log(`Processed ${i}... Matches found so far: ${matchCount}`);
        }
    }

    await pool.end();
    console.log(`[7] Final Stats: ${matchCount} matches found and inserted.`);
}

async function insertBatch(items) {
    const values = [];
    const placeholders = items.map((item, idx) => {
        const b = idx * 5;
        values.push(item.answer, item.pos, item.definition, item.synonym, item.example);
        return `($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5})`;
    }).join(',');

    const query = `
        INSERT INTO word_lexicon (answer, part_of_speech, definition, synonym, example)
        VALUES ${placeholders}
        ON CONFLICT (answer) DO NOTHING
    `;
    await pool.query(query, values);
}

seedLexiconFromWordNet().catch(console.error);