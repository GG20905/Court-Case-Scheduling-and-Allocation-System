const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const isBcryptHash = (value) => /^\$2[aby]\$/.test(String(value || ''));

const hashExistingPasswords = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT user_id, password FROM users ORDER BY user_id');

    let updatedCount = 0;
    for (const row of result.rows) {
      const currentPassword = String(row.password || '');

      if (isBcryptHash(currentPassword)) {
        continue;
      }

      const hashedPassword = await bcrypt.hash(currentPassword, 12);
      await client.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashedPassword, row.user_id]);
      updatedCount += 1;
    }

    await client.query('COMMIT');
    console.log(`Password migration complete. Updated ${updatedCount} user record(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

hashExistingPasswords().catch((error) => {
  console.error('Failed to hash existing passwords:', error.message);
  process.exit(1);
});
