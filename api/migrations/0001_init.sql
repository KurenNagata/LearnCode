CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    language VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    "order" INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    starter_code TEXT,
    explanation TEXT,
    answer_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (language, "order")
);

CREATE TABLE IF NOT EXISTS test_cases (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    stdin TEXT NOT NULL DEFAULT '',
    stdout TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS progress (
    user_id VARCHAR(100) NOT NULL,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    cleared_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, problem_id)
);
