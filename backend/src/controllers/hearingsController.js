const pool = require('../config/db');

const getHearings = async (req, res, next) => {
  try {
    const { case_id } = req.query;

    const values = [];
    let whereClause = '';

    if (case_id) {
      values.push(case_id);
      whereClause = 'WHERE h.case_id = $1';
    }

    const result = await pool.query(
      `SELECT h.id, h.case_id, h.court_id, h.judge_id, h.scheduled_start, h.scheduled_end,
              h.hearing_type, h.status, h.meeting_link, h.created_at,
              c.case_number,
              co.name AS court_name,
              u.full_name AS judge_name
       FROM hearings h
       JOIN cases c ON c.id = h.case_id
       JOIN courts co ON co.id = h.court_id
       JOIN judges j ON j.id = h.judge_id
       JOIN users u ON u.id = j.user_id
       ${whereClause}
       ORDER BY h.scheduled_start ASC`,
      values
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createHearing = async (req, res, next) => {
  try {
    const {
      case_id,
      court_id,
      judge_id,
      scheduled_start,
      scheduled_end,
      hearing_type,
      status,
      meeting_link,
      created_by
    } = req.body;

    if (!case_id || !court_id || !judge_id || !scheduled_start || !scheduled_end || !hearing_type || !created_by) {
      return res.status(400).json({
        message: 'case_id, court_id, judge_id, scheduled_start, scheduled_end, hearing_type, and created_by are required.'
      });
    }

    const result = await pool.query(
      `INSERT INTO hearings (
          case_id, court_id, judge_id, scheduled_start, scheduled_end,
          hearing_type, status, meeting_link, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'scheduled'), $8, $9)
       RETURNING *`,
      [
        case_id,
        court_id,
        judge_id,
        scheduled_start,
        scheduled_end,
        hearing_type,
        status || null,
        meeting_link || null,
        created_by
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateHearingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required.' });
    }

    const result = await pool.query(
      `UPDATE hearings
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Hearing not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHearings,
  createHearing,
  updateHearingStatus
};
