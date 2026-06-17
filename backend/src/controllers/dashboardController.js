const pool = require('../config/db');

const getSummary = async (req, res) => {
  try {
    const [casesStats, hearingsStats, assignmentsStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_cases,
          COUNT(*) FILTER (WHERE case_status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE case_status = 'active') AS active,
          COUNT(*) FILTER (WHERE case_status = 'scheduled') AS scheduled,
          COUNT(*) FILTER (WHERE case_status = 'closed') AS closed
        FROM cases
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_hearings,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS upcoming,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'requested') AS pending_approval
        FROM hearings
      `),
      pool.query(`
        SELECT COUNT(*) AS pending_judge_responses
        FROM judge_assignments WHERE assignment_status = 'pending'
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        cases: casesStats.rows[0],
        hearings: hearingsStats.rows[0],
        assignments: assignmentsStats.rows[0],
      },
    });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getJudges = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.judge_id, j.full_name, j.email, j.court_station,
        COUNT(ja.assignment_id) FILTER (WHERE ja.assignment_status = 'approved') AS active_cases
       FROM judges j
       LEFT JOIN judge_assignments ja ON j.judge_id = ja.judge_id
       GROUP BY j.judge_id ORDER BY j.full_name`
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getJudges error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getSummary, getJudges };