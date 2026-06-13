const pool = require('../config/db');

const getUsers = async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, phone, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { full_name, email, password_hash, role, phone } = req.body;

    if (!full_name || !email || !password_hash || !role) {
      return res.status(400).json({ message: 'full_name, email, password_hash, and role are required.' });
    }

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, phone, created_at`,
      [full_name, email, password_hash, role, phone || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser
};
