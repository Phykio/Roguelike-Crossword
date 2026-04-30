-- ── words (unchanged structure, drop stored column) ────────────
CREATE TABLE IF NOT EXISTS words (
  id      SERIAL PRIMARY KEY,
  answer  TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_words_answer ON words(answer);
-- functional index replaces idx_words_length
CREATE INDEX IF NOT EXISTS idx_words_length ON words(length(answer));

-- ── clues (normalized — answer stored once in words) ────────────
CREATE TABLE IF NOT EXISTS clues (
  id      SERIAL PRIMARY KEY,
  word_id INT  NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  clue    TEXT NOT NULL,
  UNIQUE(word_id, clue)
);
CREATE INDEX IF NOT EXISTS idx_clues_word_id ON clues(word_id);

-- ── word_lexicon (drop updated_at, keep lean) ───────────────────
CREATE TABLE IF NOT EXISTS word_lexicon (
  id             SERIAL PRIMARY KEY,
  answer         TEXT NOT NULL UNIQUE,
  part_of_speech TEXT,
  definition     TEXT,
  synonym        TEXT,
  example        TEXT   -- add properly if your seed uses it
);

-- ── players (unchanged) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id         UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── player_used_clues (unchanged) ───────────────────────────────
CREATE TABLE IF NOT EXISTS player_used_clues (
  id        SERIAL PRIMARY KEY,
  player_id UUID NOT NULL,
  clue_id   INT  REFERENCES clues(id) ON DELETE CASCADE,
  used_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, clue_id)
);
CREATE INDEX IF NOT EXISTS idx_used_player ON player_used_clues(player_id);

-- ── runs + run_upgrades (unchanged) ─────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id         SERIAL PRIMARY KEY,
  player_id  UUID NOT NULL,
  score      INT  DEFAULT 0,
  level      INT  DEFAULT 1,
  coins      INT  DEFAULT 0,
  hearts     INT  DEFAULT 1,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active','won','lost')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_upgrades (
  id           SERIAL PRIMARY KEY,
  run_id       INT  REFERENCES runs(id) ON DELETE CASCADE,
  upgrade      TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);