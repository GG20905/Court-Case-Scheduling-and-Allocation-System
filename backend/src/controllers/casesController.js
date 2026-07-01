const pool = require('../config/db');

const VALID_CASE_STATUSES = ['pending', 'active', 'scheduled', 'closed', 'dismissed'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const parsePositiveIntId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

// POST /api/cases
const createCase = async (req, res) => {
  try {
    const { case_title, case_category, case_description } = req.body;

    if (!case_title || !case_category) {
      return res.status(400).json({ success: false, message: 'case_title and case_category are required.' });
    }

    const participantResult = await pool.query(
      'SELECT participant_id FROM litigants_advocates WHERE user_id = $1',
      [req.user.user_id]
    );

    if (participantResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Only litigants or advocates can submit cases.' });
    }

    const participant_id = participantResult.rows[0].participant_id;

    const result = await pool.query(
      `INSERT INTO cases (case_title, case_category, case_description, participant_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [case_title, case_category, case_description || null, participant_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Case submitted successfully. Awaiting admin review.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('createCase error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/cases
const getCases = async (req, res) => {
  try {
    let query, params = [];

    if (req.user.role === 'admin') {
      query = `
        SELECT c.*, la.full_name AS submitted_by, la.participant_type
        FROM cases c
        LEFT JOIN litigants_advocates la ON c.participant_id = la.participant_id
        ORDER BY c.created_at DESC`;
    } else if (req.user.role === 'judge') {
      const judgeResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
      query = `
        SELECT c.*, ja.assignment_status
        FROM cases c
        INNER JOIN judge_assignments ja ON c.case_id = ja.case_id
        WHERE ja.judge_id = $1 ORDER BY c.created_at DESC`;
      params = [judgeResult.rows[0].judge_id];
    } else {
      const pResult = await pool.query('SELECT participant_id FROM litigants_advocates WHERE user_id = $1', [req.user.user_id]);
      query = `SELECT * FROM cases WHERE participant_id = $1 ORDER BY created_at DESC`;
      params = [pResult.rows[0].participant_id];
    }

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('getCases error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/cases/categories
const getCaseCategories = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT TRIM(case_category) AS case_category
       FROM cases
       WHERE case_category IS NOT NULL AND TRIM(case_category) <> ''
       ORDER BY case_category ASC`
    );

    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('getCaseCategories error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/cases/:id
const getCaseById = async (req, res) => {
  try {
    if (String(req.params.id || '').toLowerCase() === 'categories') {
      return getCaseCategories(req, res);
    }

    const parsedCaseId = parsePositiveIntId(req.params.id);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
    }

    const result = await pool.query(
      `SELECT c.*,
        la.full_name AS submitted_by, la.participant_type,
        ca.full_name AS managed_by,
        h.hearing_date, h.hearing_time, h.meeting_link, h.status AS hearing_status,
        ja.assignment_status, j.full_name AS assigned_judge,
        r.ruling_text, r.ruling_date, r.is_published
       FROM cases c
       LEFT JOIN litigants_advocates la ON c.participant_id = la.participant_id
       LEFT JOIN court_administrators ca ON c.admin_id = ca.admin_id
       LEFT JOIN hearings h ON h.case_id = c.case_id
       LEFT JOIN judge_assignments ja ON ja.case_id = c.case_id
       LEFT JOIN judges j ON ja.judge_id = j.judge_id
       LEFT JOIN rulings r ON r.case_id = c.case_id
       WHERE c.case_id = $1`,
      [parsedCaseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getCaseById error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/cases/:id/status  (kept for compatibility)
const updateCaseStatus = async (req, res) => {
  try {
    const parsedCaseId = parsePositiveIntId(req.params.id);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
    }

    const { case_status, priority } = req.body;

    if (case_status === undefined && priority === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update: case_status or priority.',
      });
    }

    if (case_status !== undefined && typeof case_status === 'string' && case_status.trim() === '') {
      return res.status(400).json({ success: false, message: 'case_status cannot be empty.' });
    }

    if (priority !== undefined && typeof priority === 'string' && priority.trim() === '') {
      return res.status(400).json({ success: false, message: 'priority cannot be empty.' });
    }

    if (case_status !== undefined && !VALID_CASE_STATUSES.includes(case_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid case_status. Allowed values: ${VALID_CASE_STATUSES.join(', ')}.`,
      });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}.`,
      });
    }

    const result = await pool.query(
      `UPDATE cases SET
        case_status = COALESCE($1, case_status),
        priority = COALESCE($2, priority),
        updated_at = NOW()
       WHERE case_id = $3 RETURNING *`,
        [case_status, priority, parsedCaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    return res.status(200).json({ success: true, message: 'Case updated.', data: result.rows[0] });
  } catch (err) {
    console.error('updateCaseStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/cases/:id/register  (admin: register & set priority)
const registerCase = async (req, res) => {
  try {
    const parsedCaseId = parsePositiveIntId(req.params.id);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
    }

    const { priority, case_status } = req.body;

    if (case_status === undefined && priority === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update: case_status or priority.',
      });
    }

    if (case_status !== undefined && typeof case_status === 'string' && case_status.trim() === '') {
      return res.status(400).json({ success: false, message: 'case_status cannot be empty.' });
    }

    if (priority !== undefined && typeof priority === 'string' && priority.trim() === '') {
      return res.status(400).json({ success: false, message: 'priority cannot be empty.' });
    }

    if (case_status !== undefined && !VALID_CASE_STATUSES.includes(case_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid case_status. Allowed values: ${VALID_CASE_STATUSES.join(', ')}.`,
      });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}.`,
      });
    }

    const adminResult = await pool.query(
      'SELECT admin_id FROM court_administrators WHERE user_id = $1',
      [req.user.user_id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Admin record not found.' });
    }

    const admin_id = adminResult.rows[0].admin_id;

    const result = await pool.query(
      `UPDATE cases SET
        case_status = COALESCE($1, 'active'),
        priority = COALESCE($2, 'normal'),
        admin_id = $3,
        updated_at = NOW()
       WHERE case_id = $4 RETURNING *`,
      [case_status, priority, admin_id, parsedCaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    return res.status(200).json({ success: true, message: 'Case registered and priority set.', data: result.rows[0] });
  } catch (err) {
    console.error('registerCase error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createCase, getCases, getCaseCategories, getCaseById, updateCaseStatus, registerCase };