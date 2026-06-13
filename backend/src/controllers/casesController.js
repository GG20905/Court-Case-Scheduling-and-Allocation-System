const pool = require('../config/db');

const getCases = async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.case_number, c.title, c.status, c.created_at,
              ct.name AS case_type,
              p.full_name AS plaintiff,
              d.full_name AS defendant
       FROM cases c
       JOIN case_types ct ON ct.id = c.case_type_id
       JOIN users p ON p.id = c.plaintiff_id
       JOIN users d ON d.id = c.defendant_id
       ORDER BY c.created_at DESC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, ct.name AS case_type
       FROM cases c
       JOIN case_types ct ON ct.id = c.case_type_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const createCase = async (req, res, next) => {
  try {
    const {
      case_number,
      title,
      description,
      case_type_id,
      plaintiff_id,
      defendant_id,
      filed_by,
      status
    } = req.body;

    if (!case_number || !title || !case_type_id || !plaintiff_id || !defendant_id || !filed_by) {
      return res.status(400).json({
        message: 'case_number, title, case_type_id, plaintiff_id, defendant_id, and filed_by are required.'
      });
    }

    const result = await pool.query(
      `INSERT INTO cases (
          case_number, title, description, status,
          case_type_id, plaintiff_id, defendant_id, filed_by
       )
       VALUES ($1, $2, $3, COALESCE($4, 'filed'), $5, $6, $7, $8)
       RETURNING *`,
      [
        case_number,
        title,
        description || null,
        status || null,
        case_type_id,
        plaintiff_id,
        defendant_id,
        filed_by
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateCaseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required.' });
    }

    const result = await pool.query(
      `UPDATE cases
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCaseStatus
};
