const pool = require('../config/db');

const getDocumentsByCase = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM documents
       WHERE case_id = $1
       ORDER BY uploaded_at DESC`,
      [caseId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createDocument = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { uploaded_by, file_name, file_path, mime_type, file_size } = req.body;

    if (!uploaded_by || !file_name || !file_path) {
      return res.status(400).json({ message: 'uploaded_by, file_name, and file_path are required.' });
    }

    const result = await pool.query(
      `INSERT INTO documents (case_id, uploaded_by, file_name, file_path, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [caseId, uploaded_by, file_name, file_path, mime_type || null, file_size || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDocumentsByCase,
  createDocument
};
