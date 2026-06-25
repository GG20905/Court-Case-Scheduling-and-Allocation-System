const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const parsePositiveIntId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
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
    const parsedCaseId = parsePositiveIntId(req.params.caseId);
    if (!parsedCaseId) {
      return res.status(400).json({ success: false, message: 'Invalid case ID. It must be a positive integer.' });
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

module.exports = { createDocument, getDocumentsByCase, downloadDocument, deleteDocument };