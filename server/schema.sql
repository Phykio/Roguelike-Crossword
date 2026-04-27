CREATE TABLE IF NOT EXISTS clues (
  id          SERIAL PRIMARY KEY,
  pubid       TEXT,
  year        INT,
  clue        TEXT NOT NULL,
  answer      TEXT NOT NULL,
  word_length INT  GENERATED ALWAYS AS (LENGTH(answer)) STORED,
  difficulty  INT  DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  UNIQUE(pubid, year, answer, clue)
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