const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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
    }
    console.log('✅ Connected to PostgreSQL database');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
};

initializeDatabase();

module.exports = pool;