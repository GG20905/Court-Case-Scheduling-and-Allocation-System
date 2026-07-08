const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const parsePositiveIntId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
};

const safeDeleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Ignore cleanup errors for stale temp files.
  }
};

// POST /api/rulings
const submitRuling = async (req, res) => {
  try {
    const caseId = parsePositiveIntId(req.body?.case_id);
    const rulingText = String(req.body?.ruling_text || '').trim();
    const hasDocument = Boolean(req.file?.path);

    if (!caseId) {
      if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
      return res.status(400).json({ success: false, message: 'case_id must be a positive integer.' });
    }

    if (!rulingText && !hasDocument) {
      if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
      return res.status(400).json({ success: false, message: 'Provide ruling_text or upload a ruling document.' });
    }

    const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
    if (jResult.rows.length === 0) {
      if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
      return res.status(403).json({ success: false, message: 'Judge record not found.' });
    }
    const judgeId = jResult.rows[0].judge_id;

    const assignmentCheck = await pool.query(
      `SELECT assignment_id
       FROM judge_assignments
       WHERE case_id = $1 AND judge_id = $2 AND assignment_status = 'approved'
       ORDER BY updated_at DESC, assignment_date DESC, assignment_id DESC
       LIMIT 1`,
      [caseId, judgeId]
    );

    if (assignmentCheck.rows.length === 0) {
      if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
      return res.status(403).json({ success: false, message: 'You are not the approved judge for this case.' });
    }

    const nextText = hasDocument ? null : rulingText;
    const nextDocumentName = hasDocument ? req.file.originalname : null;
    const nextDocumentPath = hasDocument ? req.file.path : null;

    const existing = await pool.query(
      'SELECT ruling_id, judge_id, is_published, ruling_document_path FROM rulings WHERE case_id = $1',
      [caseId]
    );

    let result;
    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      if (Number(current.judge_id) !== Number(judgeId)) {
        if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
        return res.status(403).json({ success: false, message: 'Only the assigned judge can update this ruling.' });
      }

      if (current.is_published) {
        if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
        return res.status(400).json({ success: false, message: 'Ruling already published and cannot be edited.' });
      }

      result = await pool.query(
        `UPDATE rulings
         SET ruling_text = $1,
             ruling_document_name = $2,
             ruling_document_path = $3,
             ruling_date = CURRENT_DATE,
             updated_at = NOW()
         WHERE case_id = $4 AND judge_id = $5
         RETURNING *`,
        [nextText, nextDocumentName, nextDocumentPath, caseId, judgeId]
      );

      if (hasDocument && current.ruling_document_path) {
        safeDeleteFile(path.resolve(current.ruling_document_path));
      }
    } else {
      result = await pool.query(
        `INSERT INTO rulings (case_id, judge_id, ruling_text, ruling_document_name, ruling_document_path)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [caseId, judgeId, nextText, nextDocumentName, nextDocumentPath]
      );
    }

    return res.status(201).json({ success: true, message: 'Ruling submitted as draft.', data: result.rows[0] });
  } catch (err) {
    if (req.file?.path) safeDeleteFile(path.resolve(req.file.path));
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
    let query;
    let params = [];
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

// GET /api/rulings/:id/download
const downloadRulingDocument = async (req, res) => {
  try {
    const rulingId = parsePositiveIntId(req.params.id);
    if (!rulingId) {
      return res.status(400).json({ success: false, message: 'Invalid ruling ID.' });
    }

    const result = await pool.query(
      `SELECT r.*, c.participant_id
       FROM rulings r
       JOIN cases c ON c.case_id = r.case_id
       WHERE r.ruling_id = $1`,
      [rulingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ruling not found.' });
    }

    const ruling = result.rows[0];
    if (!ruling.ruling_document_path) {
      return res.status(404).json({ success: false, message: 'No ruling document attached.' });
    }

    if (req.user.role === 'judge') {
      const judgeResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
      if (judgeResult.rows.length === 0 || Number(judgeResult.rows[0].judge_id) !== Number(ruling.judge_id)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this ruling document.' });
      }
    }

    if (req.user.role === 'litigant' || req.user.role === 'advocate') {
      const participantResult = await pool.query(
        'SELECT participant_id FROM litigants_advocates WHERE user_id = $1',
        [req.user.user_id]
      );

      if (
        participantResult.rows.length === 0 ||
        Number(participantResult.rows[0].participant_id) !== Number(ruling.participant_id) ||
        !ruling.is_published
      ) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this ruling document.' });
      }
    }

    const filePath = path.resolve(ruling.ruling_document_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Ruling file not found on server.' });
    }

    return res.download(filePath, ruling.ruling_document_name || `ruling-${rulingId}.pdf`);
  } catch (err) {
    console.error('downloadRulingDocument error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { submitRuling, publishRuling, getAllRulings, getRulingByCase, downloadRulingDocument };
