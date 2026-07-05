const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

let documentSharesSupport = null;

const parsePositiveIntId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

const checkDocumentSharesSupport = async () => {
  if (documentSharesSupport !== null) return documentSharesSupport;

  const result = await pool.query("SELECT to_regclass('public.document_shares') AS table_name");
  documentSharesSupport = Boolean(result.rows[0]?.table_name);
  return documentSharesSupport;
};

// POST /api/cases/:caseId/documents
const createDocument = async (req, res) => {
  try {
    const parsedCaseId = parsePositiveIntId(req.params.caseId);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { document_type } = req.body;

    if (!document_type || !String(document_type).trim()) {
      return res.status(400).json({ success: false, message: 'document_type is required.' });
    }

    const pResult = await pool.query(
      'SELECT participant_id FROM litigants_advocates WHERE user_id = $1',
      [req.user.user_id]
    );

    if (pResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Only litigants or advocates can upload documents.' });
    }

    const participant_id = pResult.rows[0].participant_id;

    const caseCheck = await pool.query(
      'SELECT case_id FROM cases WHERE case_id = $1 AND participant_id = $2',
      [parsedCaseId, participant_id]
    );

    if (caseCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Case not found or not authorized.' });
    }

    const result = await pool.query(
      `INSERT INTO documents (case_id, participant_id, uploaded_by, document_name, document_type, file_path)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [parsedCaseId, participant_id, req.user.user_id, req.file.originalname, document_type.trim(), req.file.path]
    );

    return res.status(201).json({ success: true, message: 'Document uploaded successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('createDocument error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/cases/:caseId/documents
const getDocumentsByCase = async (req, res) => {
  try {
    const hasDocumentShares = await checkDocumentSharesSupport();

    const parsedCaseId = parsePositiveIntId(req.params.caseId);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
    }

    if (req.user.role === 'judge') {
      if (!hasDocumentShares) {
        // Judge visibility now depends on explicit admin shares.
        return res.status(200).json({ success: true, count: 0, data: [] });
      }

      const judgeResult = await pool.query(
        'SELECT judge_id FROM judges WHERE user_id = $1',
        [req.user.user_id]
      );

      if (judgeResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Judge record not found.' });
      }

      const judgeId = judgeResult.rows[0].judge_id;

      const result = await pool.query(
        `SELECT d.*, la.full_name AS uploaded_by_name,
                ds.shared_at, ds.judge_id AS shared_judge_id,
                j.full_name AS shared_judge_name,
                ca.full_name AS shared_by_admin_name
         FROM documents d
         INNER JOIN document_shares ds ON ds.document_id = d.document_id
         LEFT JOIN litigants_advocates la ON d.participant_id = la.participant_id
         LEFT JOIN judges j ON ds.judge_id = j.judge_id
         LEFT JOIN court_administrators ca ON ds.shared_by_admin_id = ca.admin_id
         WHERE d.case_id = $1 AND ds.judge_id = $2
         ORDER BY d.created_at DESC`,
        [parsedCaseId, judgeId]
      );

      return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
    }

    if (req.user.role === 'admin') {
      if (!hasDocumentShares) {
        const result = await pool.query(
          `SELECT d.*, la.full_name AS uploaded_by_name
           FROM documents d
           LEFT JOIN litigants_advocates la ON d.participant_id = la.participant_id
           WHERE d.case_id = $1
           ORDER BY d.created_at DESC`,
          [parsedCaseId]
        );

        return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
      }

      const result = await pool.query(
        `SELECT d.*, la.full_name AS uploaded_by_name,
                ds.shared_at, ds.judge_id AS shared_judge_id,
                j.full_name AS shared_judge_name,
                ca.full_name AS shared_by_admin_name
         FROM documents d
         LEFT JOIN litigants_advocates la ON d.participant_id = la.participant_id
         LEFT JOIN document_shares ds ON ds.document_id = d.document_id
         LEFT JOIN judges j ON ds.judge_id = j.judge_id
         LEFT JOIN court_administrators ca ON ds.shared_by_admin_id = ca.admin_id
         WHERE d.case_id = $1
         ORDER BY d.created_at DESC`,
        [parsedCaseId]
      );

      return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
    }

    const result = await pool.query(
      `SELECT d.*, la.full_name AS uploaded_by_name
       FROM documents d
       LEFT JOIN litigants_advocates la ON d.participant_id = la.participant_id
       WHERE d.case_id = $1 ORDER BY d.created_at DESC`,
      [parsedCaseId]
    );
    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('getDocumentsByCase error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/documents/:id/share  (admin)
const shareDocumentToDesignatedJudge = async (req, res) => {
  try {
    const hasDocumentShares = await checkDocumentSharesSupport();
    if (!hasDocumentShares) {
      return res.status(400).json({
        success: false,
        message: 'Document sharing is not initialized in this database. Please apply the latest schema update.',
      });
    }

    const parsedDocumentId = parsePositiveIntId(req.params.id);
    if (!parsedDocumentId) {
      return res.status(400).json({ success: false, message: 'Invalid document ID. It must be a positive integer.' });
    }

    const documentResult = await pool.query(
      'SELECT document_id, case_id FROM documents WHERE document_id = $1',
      [parsedDocumentId]
    );

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const { case_id } = documentResult.rows[0];

    const adminResult = await pool.query(
      'SELECT admin_id FROM court_administrators WHERE user_id = $1',
      [req.user.user_id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Admin record not found.' });
    }

    const adminId = adminResult.rows[0].admin_id;

    let designatedJudgeResult = await pool.query(
      `SELECT judge_id
       FROM judge_assignments
       WHERE case_id = $1 AND assignment_status IN ('approved', 'pending')
       ORDER BY
         CASE WHEN assignment_status = 'approved' THEN 0 ELSE 1 END,
         updated_at DESC,
         assignment_date DESC,
         assignment_id DESC
       LIMIT 1`,
      [case_id]
    );

    if (designatedJudgeResult.rows.length === 0) {
      designatedJudgeResult = await pool.query(
        `SELECT judge_id
         FROM hearings
         WHERE case_id = $1 AND judge_id IS NOT NULL
         ORDER BY updated_at DESC, hearing_date DESC, hearing_id DESC
         LIMIT 1`,
        [case_id]
      );
    }

    if (designatedJudgeResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No designated judge found for this case. Assign a judge first.' });
    }

    const designatedJudgeId = designatedJudgeResult.rows[0].judge_id;

    const shareResult = await pool.query(
      `INSERT INTO document_shares (document_id, case_id, judge_id, shared_by_admin_id, shared_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (document_id)
       DO UPDATE SET
         case_id = EXCLUDED.case_id,
         judge_id = EXCLUDED.judge_id,
         shared_by_admin_id = EXCLUDED.shared_by_admin_id,
         shared_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [parsedDocumentId, case_id, designatedJudgeId, adminId]
    );

    const judgeInfo = await pool.query(
      'SELECT full_name FROM judges WHERE judge_id = $1',
      [designatedJudgeId]
    );

    return res.status(200).json({
      success: true,
      message: `Document shared with ${judgeInfo.rows[0]?.full_name || 'assigned judge'}.`,
      data: {
        ...shareResult.rows[0],
        judge_name: judgeInfo.rows[0]?.full_name || null,
      },
    });
  } catch (err) {
    console.error('shareDocumentToDesignatedJudge error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/documents/:id/download
const downloadDocument = async (req, res) => {
  try {
    const parsedDocumentId = parsePositiveIntId(req.params.id);
    if (!parsedDocumentId) {
      return res.status(400).json({ success: false, message: 'Invalid document ID. It must be a positive integer.' });
    }

    const result = await pool.query('SELECT * FROM documents WHERE document_id = $1', [parsedDocumentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    const doc = result.rows[0];

    if (req.user.role === 'judge') {
      const hasDocumentShares = await checkDocumentSharesSupport();
      if (!hasDocumentShares) {
        return res.status(403).json({ success: false, message: 'Document sharing is not initialized in this database.' });
      }

      const judgeResult = await pool.query(
        'SELECT judge_id FROM judges WHERE user_id = $1',
        [req.user.user_id]
      );

      if (judgeResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Judge record not found.' });
      }

      const judgeId = judgeResult.rows[0].judge_id;
      const shareResult = await pool.query(
        'SELECT share_id FROM document_shares WHERE document_id = $1 AND judge_id = $2 LIMIT 1',
        [parsedDocumentId, judgeId]
      );

      if (shareResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this document.' });
      }
    }

    if (req.user.role === 'litigant' || req.user.role === 'advocate') {
      const participantResult = await pool.query(
        'SELECT participant_id FROM litigants_advocates WHERE user_id = $1',
        [req.user.user_id]
      );

      if (participantResult.rows.length === 0 || participantResult.rows[0].participant_id !== doc.participant_id) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this document.' });
      }
    }

    const filePath = path.resolve(doc.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }
    return res.download(filePath, doc.document_name);
  } catch (err) {
    console.error('downloadDocument error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/documents/:id
const deleteDocument = async (req, res) => {
  try {
    const parsedDocumentId = parsePositiveIntId(req.params.id);
    if (!parsedDocumentId) {
      return res.status(400).json({ success: false, message: 'Invalid document ID. It must be a positive integer.' });
    }

    const docResult = await pool.query('SELECT * FROM documents WHERE document_id = $1', [parsedDocumentId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    const doc = docResult.rows[0];
    if (req.user.role !== 'admin' && doc.uploaded_by !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document.' });
    }
    const filePath = path.resolve(doc.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM documents WHERE document_id = $1', [parsedDocumentId]);
    return res.status(200).json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    console.error('deleteDocument error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  createDocument,
  getDocumentsByCase,
  downloadDocument,
  deleteDocument,
  shareDocumentToDesignatedJudge,
};