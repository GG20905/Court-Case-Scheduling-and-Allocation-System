const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const runSqlFile = async (relativeSqlPath) => {
  const sqlPath = path.resolve(__dirname, '../../database', relativeSqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log(`Executed SQL file: ${relativeSqlPath}`);
  } finally {
    client.release();
    await pool.end();
  }
};

module.exports = runSqlFile;
