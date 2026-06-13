BEGIN;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS case_participants CASCADE;
DROP TABLE IF EXISTS hearings CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS courts CASCADE;
DROP TABLE IF EXISTS case_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	full_name VARCHAR(150) NOT NULL,
	email VARCHAR(120) NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'judge', 'lawyer', 'clerk', 'party')),
	phone VARCHAR(30),
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE courts (
	id SERIAL PRIMARY KEY,
	name VARCHAR(120) NOT NULL,
	location VARCHAR(180) NOT NULL,
	virtual_link TEXT,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE case_types (
	id SERIAL PRIMARY KEY,
	name VARCHAR(80) NOT NULL UNIQUE,
	description TEXT
);

CREATE TABLE judges (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	court_id INT NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
	assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cases (
	id SERIAL PRIMARY KEY,
	case_number VARCHAR(50) NOT NULL UNIQUE,
	title VARCHAR(200) NOT NULL,
	description TEXT,
	status VARCHAR(30) NOT NULL DEFAULT 'filed' CHECK (status IN ('filed', 'scheduled', 'in_hearing', 'judgment_pending', 'closed', 'dismissed')),
	case_type_id INT NOT NULL REFERENCES case_types(id) ON DELETE RESTRICT,
	plaintiff_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	defendant_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	filed_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE hearings (
	id SERIAL PRIMARY KEY,
	case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
	court_id INT NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
	judge_id INT NOT NULL REFERENCES judges(id) ON DELETE RESTRICT,
	scheduled_start TIMESTAMP NOT NULL,
	scheduled_end TIMESTAMP NOT NULL,
	hearing_type VARCHAR(40) NOT NULL CHECK (hearing_type IN ('mention', 'pre_trial', 'trial', 'ruling', 'appeal')),
	status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'adjourned', 'cancelled')),
	meeting_link TEXT,
	created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	CONSTRAINT hearing_time_valid CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE case_participants (
	id SERIAL PRIMARY KEY,
	case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
	user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	participant_role VARCHAR(40) NOT NULL CHECK (participant_role IN ('plaintiff', 'defendant', 'lawyer', 'witness', 'clerk')),
	joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
	UNIQUE (case_id, user_id, participant_role)
);

CREATE TABLE documents (
	id SERIAL PRIMARY KEY,
	case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
	uploaded_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	file_name VARCHAR(180) NOT NULL,
	file_path TEXT NOT NULL,
	mime_type VARCHAR(80),
	file_size BIGINT,
	uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title VARCHAR(180) NOT NULL,
	message TEXT NOT NULL,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_case_type ON cases(case_type_id);
CREATE INDEX idx_hearings_case ON hearings(case_id);
CREATE INDEX idx_hearings_status ON hearings(status);
CREATE INDEX idx_documents_case ON documents(case_id);

COMMIT;
