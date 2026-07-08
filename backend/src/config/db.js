const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Support env files in both backend/.env and project-root/.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const ensureDocumentSharingSchema = async (client) => {
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS document_shares (
      share_id            SERIAL PRIMARY KEY,
      document_id         INT NOT NULL UNIQUE REFERENCES documents(document_id) ON DELETE CASCADE,
      case_id             INT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      judge_id            INT NOT NULL REFERENCES judges(judge_id) ON DELETE CASCADE,
      shared_by_admin_id  INT REFERENCES court_administrators(admin_id) ON DELETE SET NULL,
      shared_at           TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at          TIMESTAMP DEFAULT NOW(),
      updated_at          TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_document_shares_case ON document_shares(case_id);');
  await client.query('CREATE INDEX IF NOT EXISTS idx_document_shares_judge ON document_shares(judge_id);');

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_document_shares_updated_at'
      ) THEN
        CREATE TRIGGER update_document_shares_updated_at
          BEFORE UPDATE ON document_shares
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END
    $$;
  `);
};

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    const tableCheck = await client.query(`SELECT to_regclass('public.users') AS users_table`);
    if (tableCheck.rows[0]?.users_table) {
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_code_hash VARCHAR(255);
      `);
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_code_expires_at TIMESTAMP;
      `);
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255);
      `);
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMP;
      `);
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMP;
      `);
    }

    const judgesTableCheck = await client.query(`SELECT to_regclass('public.judges') AS judges_table`);
    if (judgesTableCheck.rows[0]?.judges_table) {
      await client.query(`
        ALTER TABLE judges
        ADD COLUMN IF NOT EXISTS specialty VARCHAR(140);
      `);
    }

    const hearingsTableCheck = await client.query(`SELECT to_regclass('public.hearings') AS hearings_table`);
    if (hearingsTableCheck.rows[0]?.hearings_table) {
      await client.query(`
        ALTER TABLE hearings
        ADD COLUMN IF NOT EXISTS hearing_mode VARCHAR(20) NOT NULL DEFAULT 'physical';
      `);
      await client.query(`
        ALTER TABLE hearings
        DROP CONSTRAINT IF EXISTS hearings_hearing_mode_check;
      `);
      await client.query(`
        ALTER TABLE hearings
        ADD CONSTRAINT hearings_hearing_mode_check
        CHECK (hearing_mode IN ('physical', 'virtual'));
      `);
    }

    await ensureDocumentSharingSchema(client);
    console.log('Connected to PostgreSQL database');
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.error('Backend is still running, but database-dependent endpoints may fail until DB config is fixed.');
  } finally {
    client.release();
  }
};

initializeDatabase().catch((err) => {
  console.error('Database initialization failed:', err.message);
  console.error('Backend is still running, but database-dependent endpoints may fail until DB config is fixed.');
});

module.exports = pool;