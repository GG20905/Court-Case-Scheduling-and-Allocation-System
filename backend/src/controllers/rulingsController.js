const pool = require('../config/db');

// POST /api/rulings
const submitRuling = async (req, res) => {
  try {
    const { case_id, ruling_text } = req.body;
    if (!case_id || !ruling_text) {
      return res.status(400).json({ success: false, message: 'case_id and ruling_text are required.' });
    }

    const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
    if (jResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Judge record not found.' });
    }
    const judge_id = jResult.rows[0].judge_id;

    const assignmentCheck = await pool.query(
      `SELECT * FROM judge_assignments WHERE case_id = $1 AND judge_id = $2 AND assignment_status = 'approved'`,
      [case_id, judge_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not the approved judge for this case.' });
    }

    const existing = await pool.query('SELECT ruling_id FROM rulings WHERE case_id = $1', [case_id]);

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE rulings SET ruling_text = $1, ruling_date = CURRENT_DATE, updated_at = NOW()
         WHERE case_id = $2 AND judge_id = $3 AND is_published = FALSE RETURNING *`,
        [ruling_text, case_id, judge_id]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Ruling already published and cannot be edited.' });
      }
    } else {
      result = await pool.query(
        `INSERT INTO rulings (case_id, judge_id, ruling_text) VALUES ($1, $2, $3) RETURNING *`,
        [case_id, judge_id, ruling_text]
      );
    }

    return res.status(201).json({ success: true, message: 'Ruling submitted as draft.', data: result.rows[0] });
  } catch (err) {
    console.error('submitRuling error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/rulings/:id/publish
const publishRuling = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE rulings SET is_published = TRUE, published_at = NOW(), updated_at = NOW()
       WHERE ruling_id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ruling not found.' });
    }
    const ruling = result.rows[0];
    await pool.query(`UPDATE cases SET case_status = 'closed', updated_at = NOW() WHERE case_id = $1`, [ruling.case_id]);
    await pool.query(`UPDATE hearings SET status = 'completed', updated_at = NOW() WHERE case_id = $1`, [ruling.case_id]);
    return res.status(200).json({ success: true, message: 'Ruling published. Case is now closed.', data: ruling });
  } catch (err) {
    console.error('publishRuling error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/rulings
const getAllRulings = async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === 'admin') {
      query = `SELECT r.*, j.full_name AS judge_name, c.case_title FROM rulings r
               JOIN judges j ON r.judge_id = j.judge_id
               JOIN cases c ON r.case_id = c.case_id ORDER BY r.ruling_date DESC`;
    } else if (req.user.role === 'judge') {
      const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
      query = `SELECT r.*, c.case_title FROM rulings r JOIN cases c ON r.case_id = c.case_id
               WHERE r.judge_id = $1 ORDER BY r.ruling_date DESC`;
      params = [jResult.rows[0].judge_id];
    } else {
      const pResult = await pool.query('SELECT participant_id FROM litigants_advocates WHERE user_id = $1', [req.user.user_id]);
      query = `SELECT r.*, j.full_name AS judge_name, c.case_title FROM rulings r
               JOIN judges j ON r.judge_id = j.judge_id
               JOIN cases c ON r.case_id = c.case_id
               WHERE c.participant_id = $1 AND r.is_published = TRUE ORDER BY r.ruling_date DESC`;
      params = [pResult.rows[0].participant_id];
    }
    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('getAllRulings error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/rulings/case/:caseId
const getRulingByCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const result = await pool.query(
      `SELECT r.*, j.full_name AS judge_name, c.case_title FROM rulings r
       JOIN judges j ON r.judge_id = j.judge_id
       JOIN cases c ON r.case_id = c.case_id WHERE r.case_id = $1`,
      [caseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No ruling found for this case.' });
    }
    const ruling = result.rows[0];
    if (!ruling.is_published && !['admin', 'judge'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Ruling not yet published.' });
    }
    return res.status(200).json({ success: true, data: ruling });
  } catch (err) {
    console.error('getRulingByCase error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { submitRuling, publishRuling, getAllRulings, getRulingByCase };