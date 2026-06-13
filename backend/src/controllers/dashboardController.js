const pool = require('../config/db');

const getSummary = async (_req, res, next) => {
  try {
    const [casesResult, hearingsResult, usersResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_cases FROM cases'),
      pool.query(`SELECT
                    COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled_hearings,
                    COUNT(*) FILTER (WHERE status = 'ongoing')::int AS ongoing_hearings,
                    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_hearings
                  FROM hearings`),
      pool.query('SELECT COUNT(*)::int AS total_users FROM users')
    ]);

    res.status(200).json({
      total_cases: casesResult.rows[0].total_cases,
      total_users: usersResult.rows[0].total_users,
      hearings: hearingsResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary
};
