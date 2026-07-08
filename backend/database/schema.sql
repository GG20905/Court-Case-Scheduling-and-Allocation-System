
-- USERS

CREATE TABLE users (
  user_id    SERIAL PRIMARY KEY,
  full_name  VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(50)  NOT NULL CHECK (role IN ('litigant', 'advocate', 'judge', 'admin')),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_code_hash VARCHAR(255),
  two_factor_code_expires_at TIMESTAMP,
  password_reset_token_hash VARCHAR(255),
  password_reset_token_expires_at TIMESTAMP,
  password_reset_requested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- COURT ADMINISTRATORS

CREATE TABLE court_administrators (
  admin_id   SERIAL PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  full_name  VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);


-- JUDGES

CREATE TABLE judges (
  judge_id      SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  court_station VARCHAR(100) NOT NULL,
  specialty     VARCHAR(140) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);


-- LITIGANTS / ADVOCATES

CREATE TABLE litigants_advocates (
  participant_id   SERIAL PRIMARY KEY,
  user_id          INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  full_name        VARCHAR(150) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  password         VARCHAR(255) NOT NULL,
  participant_type VARCHAR(50) NOT NULL CHECK (participant_type IN ('litigant', 'advocate')),
  created_at       TIMESTAMP DEFAULT NOW()
);


-- CASES

CREATE TABLE cases (
  case_id          SERIAL PRIMARY KEY,
  case_title       VARCHAR(200) NOT NULL,
  case_category    VARCHAR(100) NOT NULL,
  case_description TEXT,
  case_status      VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (case_status IN ('pending', 'active', 'scheduled', 'closed', 'dismissed')),
  priority         VARCHAR(20) NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('normal', 'high', 'urgent')),
  filing_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  participant_id   INT REFERENCES litigants_advocates(participant_id) ON DELETE SET NULL,
  admin_id         INT REFERENCES court_administrators(admin_id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);


-- JUDGE ASSIGNMENTS
CREATE TABLE judge_assignments (
  assignment_id     SERIAL PRIMARY KEY,
  case_id           INT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  judge_id          INT NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  assigned_by       INT REFERENCES court_administrators(admin_id),
  assignment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  assignment_status VARCHAR(50) NOT NULL DEFAULT 'pending'
                    CHECK (assignment_status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);


-- HEARINGS

CREATE TABLE hearings (
  hearing_id    SERIAL PRIMARY KEY,
  case_id       INT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  judge_id      INT REFERENCES judges(judge_id) ON DELETE SET NULL,
  admin_id      INT REFERENCES court_administrators(admin_id) ON DELETE SET NULL,
  hearing_date  DATE NOT NULL,
  hearing_time  TIME NOT NULL,
  hearing_mode  VARCHAR(20) NOT NULL DEFAULT 'physical'
                CHECK (hearing_mode IN ('physical', 'virtual')),
  meeting_link  TEXT,
  status        VARCHAR(50) NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled', 'postponed')),
  hearing_notes TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);


-- DOCUMENTS

CREATE TABLE documents (
  document_id    SERIAL PRIMARY KEY,
  case_id        INT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  participant_id INT REFERENCES litigants_advocates(participant_id) ON DELETE SET NULL,
  uploaded_by    INT REFERENCES users(user_id) ON DELETE SET NULL,
  document_name  VARCHAR(200) NOT NULL,
  document_type  VARCHAR(100) NOT NULL,
  file_path      VARCHAR(255) NOT NULL,
  upload_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- DOCUMENT SHARES (admin -> designated judge)

CREATE TABLE document_shares (
  share_id            SERIAL PRIMARY KEY,
  document_id         INT NOT NULL UNIQUE REFERENCES documents(document_id) ON DELETE CASCADE,
  case_id             INT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  judge_id            INT NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  shared_by_admin_id  INT REFERENCES court_administrators(admin_id) ON DELETE SET NULL,
  shared_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);


-- RULINGS

CREATE TABLE rulings (
  ruling_id    SERIAL PRIMARY KEY,
  case_id      INT NOT NULL UNIQUE REFERENCES cases(case_id) ON DELETE CASCADE,
  judge_id     INT NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
  ruling_text  TEXT,
  ruling_document_name VARCHAR(255),
  ruling_document_path VARCHAR(500),
  ruling_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  CHECK (ruling_text IS NOT NULL OR ruling_document_path IS NOT NULL)
);


-- INDEXES

CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_role           ON users(role);
CREATE INDEX idx_cases_status         ON cases(case_status);
CREATE INDEX idx_cases_participant    ON cases(participant_id);
CREATE INDEX idx_hearings_case        ON hearings(case_id);
CREATE INDEX idx_hearings_judge       ON hearings(judge_id);
CREATE INDEX idx_hearings_date        ON hearings(hearing_date);
CREATE INDEX idx_documents_case       ON documents(case_id);
CREATE INDEX idx_document_shares_case ON document_shares(case_id);
CREATE INDEX idx_document_shares_judge ON document_shares(judge_id);
CREATE INDEX idx_assignments_case     ON judge_assignments(case_id);
CREATE INDEX idx_assignments_judge    ON judge_assignments(judge_id);
CREATE INDEX idx_rulings_case         ON rulings(case_id);


-- AUTO-UPDATE updated_at TRIGGER

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hearings_updated_at
  BEFORE UPDATE ON hearings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON judge_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rulings_updated_at
  BEFORE UPDATE ON rulings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_shares_updated_at
  BEFORE UPDATE ON document_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();