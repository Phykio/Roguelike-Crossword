CREATE TABLE IF NOT EXISTS clues (
  id          SERIAL PRIMARY KEY,
  clue        TEXT NOT NULL,
  answer      TEXT NOT NULL,
  word_length INT GENERATED ALWAYS AS (LENGTH(answer)) STORED,
  difficulty  INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  category    TEXT,
  pubid       TEXT,
  year        INT,
  UNIQUE(pubid, year, answer, clue)
);

CREATE TABLE IF NOT EXISTS words (
  id          SERIAL PRIMARY KEY,
  answer      TEXT NOT NULL UNIQUE,
  word_length INT GENERATED ALWAYS AS (LENGTH(answer)) STORED
);

CREATE TABLE IF NOT EXISTS word_lexicon (
  id             SERIAL PRIMARY KEY,
  answer         TEXT NOT NULL UNIQUE,
  part_of_speech TEXT,
  definition     TEXT,
  synonym        TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id         UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_used_clues (
  id        SERIAL PRIMARY KEY,
  player_id UUID NOT NULL,
  clue_id   INT  REFERENCES clues(id) ON DELETE CASCADE,
  used_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, clue_id)
);

CREATE TABLE IF NOT EXISTS runs (
  id         SERIAL PRIMARY KEY,
  player_id  UUID NOT NULL,
  score      INT  DEFAULT 0,
  level      INT  DEFAULT 1,
  coins      INT  DEFAULT 0,
  hearts     INT  DEFAULT 1,
  extra_hearts_count INT DEFAULT 0 CHECK (extra_hearts_count BETWEEN 0 AND 4),
  extra_time_seconds INT DEFAULT 0 CHECK (extra_time_seconds BETWEEN 0 AND 600),
  bonus_time_long_purchased BOOLEAN DEFAULT FALSE,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_upgrades (
  id           SERIAL PRIMARY KEY,
  run_id       INT  REFERENCES runs(id) ON DELETE CASCADE,
  upgrade      TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clues_length     ON clues(word_length);
CREATE INDEX IF NOT EXISTS idx_clues_difficulty ON clues(difficulty);
CREATE INDEX IF NOT EXISTS idx_used_player      ON player_used_clues(player_id);
CREATE INDEX IF NOT EXISTS idx_words_length     ON words(word_length);
CREATE INDEX IF NOT EXISTS idx_lexicon_answer   ON word_lexicon(answer);