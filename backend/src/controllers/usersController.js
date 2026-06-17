const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/register
const register = async (req, res) => {
  const client = await pool.connect();
  try {
    const { full_name, email, password, role, participant_type, court_station } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'full_name, email, password and role are required.' });
    }

    const validRoles = ['litigant', 'advocate', 'judge', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}.` });
    }

    if ((role === 'litigant' || role === 'advocate') && !participant_type) {
      return res.status(400).json({ success: false, message: 'participant_type is required for litigant/advocate.' });
    }

    if (role === 'judge' && !court_station) {
      return res.status(400).json({ success: false, message: 'court_station is required for judge.' });
    }

    await client.query('BEGIN');

    const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, full_name, email, role`,
      [full_name, email, hashedPassword, role]
    );
    const user = userResult.rows[0];

    if (role === 'admin') {
      await client.query(
        `INSERT INTO court_administrators (user_id, full_name, email, password)
         VALUES ($1, $2, $3, $4)`,
        [user.user_id, full_name, email, hashedPassword]
      );
    } else if (role === 'judge') {
      await client.query(
        `INSERT INTO judges (user_id, full_name, email, password, court_station)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.user_id, full_name, email, hashedPassword, court_station]
      );
    } else {
      await client.query(
        `INSERT INTO litigants_advocates (user_id, full_name, email, password, participant_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.user_id, full_name, email, hashedPassword, participant_type]
      );
    }

    await client.query('COMMIT');
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  } finally {
    client.release();
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT user_id, full_name, email, password, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, full_name, email, role, created_at FROM users WHERE user_id = $1',
      [req.user.user_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/users  (admin only)
const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, full_name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/users (kept for compatibility)
const createUser = async (req, res) => {
  return register(req, res);
};

module.exports = { register, login, getMe, getUsers, createUser };