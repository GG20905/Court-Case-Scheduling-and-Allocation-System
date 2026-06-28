const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const isBrevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL);
const isTwoFactorRequiredByDefault = (process.env.TWO_FACTOR_REQUIRED || 'true') === 'true';
const validRoles = ['litigant', 'advocate', 'judge', 'admin'];

const normalizeLoginRoleSelection = (rawRole) => {
  const value = String(rawRole || '').trim().toLowerCase();

  if (!value) return '';
  if (value === 'judge') return 'judge';
  if (value === 'admin' || value === 'court administrator' || value === 'court_administrator') return 'admin';
  if (
    value === 'litigant_advocate' ||
    value === 'litigant' ||
    value === 'advocate' ||
    value === 'advocate / litigant' ||
    value === 'litigant / advocate'
  ) {
    return 'litigant_advocate';
  }

  return '';
};

const isLoginRoleAllowedForUser = (requestedRole, userRole) => {
  if (!requestedRole) return false;

  if (requestedRole === 'litigant_advocate') {
    return userRole === 'litigant' || userRole === 'advocate';
  }

  return requestedRole === userRole;
};

const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateTwoFactorChallengeToken = (user) => {
  const require2fa = Boolean(user.two_factor_enabled || isTwoFactorRequiredByDefault);
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, purpose: '2fa-login', require_2fa: require2fa },
    process.env.JWT_SECRET,
    { expiresIn: process.env.TWO_FACTOR_LOGIN_TOKEN_EXPIRES_IN || '10m' }
  );
};

const generateEmailOtpCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const authSuccessResponse = (user, token, message = 'Login successful.') => ({
  success: true,
  message,
  data: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
  token,
});

const validateTwoFactorToken = (twoFactorToken) => {
  if (!twoFactorToken) {
    return { ok: false, status: 400, message: 'two_factor_token is required.' };
  }

  let decoded;
  try {
    decoded = jwt.verify(twoFactorToken, process.env.JWT_SECRET);
  } catch (_err) {
    return { ok: false, status: 401, message: 'Invalid or expired 2FA token.' };
  }

  if (decoded.purpose !== '2fa-login') {
    return { ok: false, status: 401, message: 'Invalid 2FA challenge.' };
  }

  return { ok: true, decoded };
};

const insertRoleRecord = async (client, role, user, fullName, email, hashedPassword, participantType, courtStation) => {
  if (role === 'admin') {
    return client.query(
      `INSERT INTO court_administrators (user_id, full_name, email, password)
       VALUES ($1, $2, $3, $4)`,
      [user.user_id, fullName, email, hashedPassword]
    );
  }

  if (role === 'judge') {
    return client.query(
      `INSERT INTO judges (user_id, full_name, email, password, court_station)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, fullName, email, hashedPassword, courtStation]
    );
  }

  return client.query(
    `INSERT INTO litigants_advocates (user_id, full_name, email, password, participant_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.user_id, fullName, email, hashedPassword, participantType]
  );
};

const buildOtpMessage = (code) => ({
  subject: 'Your Court System verification code',
  text: `Your login verification code is ${code}. It expires in 10 minutes.`,
  html: `<p>Your login verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
});

const sendViaBrevoApi = async (toEmail, code) => {
  if (!isBrevoConfigured) {
    throw new Error('Brevo API is not configured on the server.');
  }

  const message = buildOtpMessage(code);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_FROM_EMAIL,
        name: process.env.BREVO_FROM_NAME || 'Court System',
      },
      to: [{ email: toEmail }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${bodyText || 'Unknown error'}`);
  }

  return true;
};

const sendTwoFactorCodeEmail = async (toEmail, code) => {
  const attempts = [];

  if (isBrevoConfigured) {
    try {
      await sendViaBrevoApi(toEmail, code);
      return {
        delivered: true,
        provider: 'brevo',
        reason: 'sent',
        detail: '2FA code sent using Brevo API.',
      };
    } catch (err) {
      console.error('2FA email delivery error (brevo):', err.message);
      attempts.push(`brevo: ${err.message}`);
    }
  }

  if (!isBrevoConfigured) {
    attempts.push('No email provider configured. Add Brevo credentials in backend/.env.');
  }

  return {
    delivered: false,
    provider: 'none',
    reason: 'provider_failed_or_missing',
    detail: attempts.join(' | '),
  };
};

const issueAndSendTwoFactorCode = async (user) => {
  const code = generateEmailOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `UPDATE users
     SET two_factor_code_hash = $1,
         two_factor_code_expires_at = $2
     WHERE user_id = $3`,
    [codeHash, expiresAt, user.user_id]
  );

  const delivery = await sendTwoFactorCodeEmail(user.email, code);

  return {
    delivery,
  };
};

// POST /api/auth/register
const register = async (req, res) => {
  const client = await pool.connect();
  try {
    const { full_name, email, password, role, participant_type, court_station } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'full_name, email, password and role are required.' });
    }

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

    await insertRoleRecord(client, role, user, full_name, email, hashedPassword, participant_type, court_station);

    await client.query('COMMIT');
    const token = generateToken(user);

    return res.status(201).json(authSuccessResponse(user, token, 'Registration successful.'));
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
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Email, password and role are required.' });
    }

    const requestedRole = normalizeLoginRoleSelection(role);
    if (!requestedRole) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const result = await pool.query(
      'SELECT user_id, full_name, email, password, role, two_factor_enabled FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    if (!isLoginRoleAllowedForUser(requestedRole, user.role)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.two_factor_enabled || isTwoFactorRequiredByDefault) {
      const issued = await issueAndSendTwoFactorCode(user);
      const emailDelivered = Boolean(issued.delivery?.delivered);

      const twoFactorToken = generateTwoFactorChallengeToken(user);
      const responseBody = {
        success: true,
        requires_2fa: true,
        message: emailDelivered
          ? 'Verification code sent to your email.'
          : 'Email code was not sent. Please retry.',
        two_factor_token: twoFactorToken,
        email_delivery: emailDelivered ? 'sent' : 'failed',
        email_delivery_provider: issued.delivery?.provider || 'none',
        email_delivery_reason: issued.delivery?.reason || '',
        email_delivery_detail: issued.delivery?.detail || '',
      };

      return res.status(200).json(responseBody);
    }

    const token = generateToken(user);
    return res.status(200).json(authSuccessResponse(user, token));
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// POST /api/auth/login/2fa
const loginWith2FA = async (req, res) => {
  try {
    const { two_factor_token, code } = req.body;

    if (!two_factor_token || !code) {
      return res.status(400).json({ success: false, message: 'two_factor_token and code are required.' });
    }

    const tokenValidation = validateTwoFactorToken(two_factor_token);
    if (!tokenValidation.ok) {
      return res.status(tokenValidation.status).json({ success: false, message: tokenValidation.message });
    }
    const { decoded } = tokenValidation;

    const result = await pool.query(
      `SELECT user_id, full_name, email, role, two_factor_enabled, two_factor_code_hash, two_factor_code_expires_at
       FROM users
       WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    const requires2FA = Boolean(user.two_factor_enabled || decoded.require_2fa);
    if (!requires2FA || !user.two_factor_code_hash) {
      return res.status(400).json({ success: false, message: '2FA is not enabled for this account.' });
    }

    if (!user.two_factor_code_expires_at || new Date(user.two_factor_code_expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: '2FA code expired. Please login again.' });
    }

    const codeMatches = await bcrypt.compare(String(code).trim(), user.two_factor_code_hash);
    if (!codeMatches) {
      return res.status(401).json({ success: false, message: 'Invalid 2FA code.' });
    }

    await pool.query(
      `UPDATE users
       SET two_factor_code_hash = NULL,
           two_factor_code_expires_at = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    const token = generateToken(user);
    return res.status(200).json(authSuccessResponse(user, token));
  } catch (err) {
    console.error('2FA login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during 2FA login.' });
  }
};

// POST /api/auth/login/2fa/resend
const resendLogin2FACode = async (req, res) => {
  try {
    const { two_factor_token } = req.body;
    const tokenValidation = validateTwoFactorToken(two_factor_token);
    if (!tokenValidation.ok) {
      return res.status(tokenValidation.status).json({ success: false, message: tokenValidation.message });
    }
    const { decoded } = tokenValidation;

    const result = await pool.query(
      'SELECT user_id, email, two_factor_enabled FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    const requires2FA = Boolean(user.two_factor_enabled || decoded.require_2fa);
    if (!requires2FA) {
      return res.status(400).json({ success: false, message: '2FA is not enabled for this account.' });
    }

    const issued = await issueAndSendTwoFactorCode(user);
    const emailDelivered = Boolean(issued.delivery?.delivered);
    const responseBody = {
      success: true,
      message: emailDelivered
        ? 'A new verification code has been sent to your email.'
        : 'Email code was not sent. Please retry.',
      email_delivery: emailDelivered ? 'sent' : 'failed',
      email_delivery_provider: issued.delivery?.provider || 'none',
      email_delivery_reason: issued.delivery?.reason || '',
      email_delivery_detail: issued.delivery?.detail || '',
    };

    return res.status(200).json(responseBody);
  } catch (err) {
    console.error('Resend 2FA code error:', err);
    return res.status(500).json({ success: false, message: 'Server error while resending 2FA code.' });
  }
};

// POST /api/auth/2fa/setup
const setup2FA = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.query(
      `UPDATE users
       SET two_factor_enabled = FALSE,
           two_factor_code_hash = NULL,
           two_factor_code_expires_at = NULL
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    return res.status(200).json({
      success: true,
      message: '2FA setup is ready for email delivery. Enable 2FA to require email verification codes on login.',
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    return res.status(500).json({ success: false, message: 'Server error during 2FA setup.' });
  }
};

// POST /api/auth/2fa/enable
const enable2FA = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.query(
      `UPDATE users
       SET two_factor_enabled = TRUE
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    return res.status(200).json({ success: true, message: 'Email 2FA enabled successfully.' });
  } catch (err) {
    console.error('Enable 2FA error:', err);
    return res.status(500).json({ success: false, message: 'Server error while enabling 2FA.' });
  }
};

// POST /api/auth/2fa/disable
const disable2FA = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, two_factor_enabled FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    if (!user.two_factor_enabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled for this account.' });
    }

    await pool.query(
      `UPDATE users
       SET two_factor_enabled = FALSE,
           two_factor_code_hash = NULL,
           two_factor_code_expires_at = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    return res.status(200).json({ success: true, message: '2FA disabled successfully.' });
  } catch (err) {
    console.error('Disable 2FA error:', err);
    return res.status(500).json({ success: false, message: 'Server error while disabling 2FA.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, full_name, email, role, two_factor_enabled, created_at FROM users WHERE user_id = $1',
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

module.exports = {
  register,
  login,
  loginWith2FA,
  resendLogin2FACode,
  setup2FA,
  enable2FA,
  disable2FA,
  getMe,
  getUsers,
  createUser,
};