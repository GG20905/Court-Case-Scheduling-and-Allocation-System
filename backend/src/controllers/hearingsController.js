const pool = require('../config/db');

// POST /api/hearings/request
const requestHearing = async (req, res) => {
  try {
    const { case_id, preferred_date, preferred_time, notes } = req.body;

    if (!case_id || !preferred_date || !preferred_time) {
      return res.status(400).json({ success: false, message: 'case_id, preferred_date and preferred_time are required.' });
    }

    const pResult = await pool.query(
      'SELECT participant_id FROM litigants_advocates WHERE user_id = $1',
      [req.user.user_id]
    );

    if (pResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Participant not found.' });
    }

    const caseCheck = await pool.query(
      'SELECT case_id FROM cases WHERE case_id = $1 AND participant_id = $2',
      [case_id, pResult.rows[0].participant_id]
    );

    if (caseCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Case not found or does not belong to you.' });
    }

    const result = await pool.query(
      `INSERT INTO hearings (case_id, hearing_date, hearing_time, status, hearing_notes)
       VALUES ($1, $2, $3, 'requested', $4) RETURNING *`,
      [case_id, preferred_date, preferred_time, notes || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Hearing request submitted. Awaiting admin approval.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('requestHearing error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/hearings
const getHearings = async (req, res) => {
  try {
    let query, params = [];

    if (req.user.role === 'admin') {
      query = `
        SELECT h.*, c.case_title, c.case_status, j.full_name AS judge_name
        FROM hearings h
        JOIN cases c ON h.case_id = c.case_id
        LEFT JOIN judges j ON h.judge_id = j.judge_id
        ORDER BY h.hearing_date ASC`;
    } else if (req.user.role === 'judge') {
      const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
      query = `
        SELECT h.*, c.case_title, c.priority
        FROM hearings h
        JOIN cases c ON h.case_id = c.case_id
        WHERE h.judge_id = $1 ORDER BY h.hearing_date ASC`;
      params = [jResult.rows[0].judge_id];
    } else {
      const pResult = await pool.query('SELECT participant_id FROM litigants_advocates WHERE user_id = $1', [req.user.user_id]);
      query = `
        SELECT h.*, c.case_title, j.full_name AS judge_name
        FROM hearings h
        JOIN cases c ON h.case_id = c.case_id
        LEFT JOIN judges j ON h.judge_id = j.judge_id
        WHERE c.participant_id = $1 ORDER BY h.hearing_date ASC`;
      params = [pResult.rows[0].participant_id];
    }

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('getHearings error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/hearings  (kept for compatibility - same as requestHearing)
const createHearing = async (req, res) => requestHearing(req, res);

// PATCH /api/hearings/:id/status  (kept for compatibility)
const updateHearingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE hearings SET status = $1, updated_at = NOW() WHERE hearing_id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('updateHearingStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/hearings/:id/approve  (admin)
const approveHearing = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { judge_id, hearing_date, hearing_time, meeting_link } = req.body;

    if (!judge_id) {
      return res.status(400).json({ success: false, message: 'judge_id is required.' });
    }

    const adminResult = await pool.query(
      'SELECT admin_id FROM court_administrators WHERE user_id = $1',
      [req.user.user_id]
    );
    const admin_id = adminResult.rows[0]?.admin_id;

    await client.query('BEGIN');

    const hearingResult = await client.query(
      `UPDATE hearings SET
        status = 'scheduled', judge_id = $1, admin_id = $2,
        hearing_date = COALESCE($3, hearing_date),
        hearing_time = COALESCE($4, hearing_time),
        meeting_link = COALESCE($5, meeting_link),
        updated_at = NOW()
       WHERE hearing_id = $6 RETURNING *`,
      [judge_id, admin_id, hearing_date, hearing_time, meeting_link, id]
    );

    if (hearingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }

    const hearing = hearingResult.rows[0];

    await client.query(
      `INSERT INTO judge_assignments (case_id, judge_id, assigned_by, assignment_status)
       VALUES ($1, $2, $3, 'pending')`,
      [hearing.case_id, judge_id, admin_id]
    );

    await client.query(
      `UPDATE cases SET case_status = 'scheduled', updated_at = NOW() WHERE case_id = $1`,
      [hearing.case_id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Hearing approved and judge assigned.', data: hearing });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveHearing error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
};

// PATCH /api/hearings/:id/reject  (admin)
const rejectHearing = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const notesSuffix = reason ? ` Rejection reason: ${String(reason).trim()}` : '';

    const result = await pool.query(
      `UPDATE hearings
       SET status = 'cancelled',
           hearing_notes = COALESCE(hearing_notes, '') || $1,
           updated_at = NOW()
       WHERE hearing_id = $2
       RETURNING *`,
      [notesSuffix, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Hearing request rejected.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('rejectHearing error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/hearings/assignments/:assignmentId/respond  (judge)
const respondToAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { action, rejection_reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "approve" or "reject".' });
    }

    const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
    if (jResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Judge record not found.' });
    }

    const judge_id = jResult.rows[0].judge_id;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await pool.query(
      `UPDATE judge_assignments SET
        assignment_status = $1, rejection_reason = $2, updated_at = NOW()
       WHERE assignment_id = $3 AND judge_id = $4 RETURNING *`,
      [newStatus, rejection_reason || null, assignmentId, judge_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found or not assigned to you.' });
    }

    return res.status(200).json({ success: true, message: `Assignment ${newStatus}.`, data: result.rows[0] });
  } catch (err) {
    console.error('respondToAssignment error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/hearings/:hearingId/reassign  (admin)
const reassignJudge = async (req, res) => {
  try {
    const { hearingId } = req.params;
    const { new_judge_id } = req.body;

    if (!new_judge_id) {
      return res.status(400).json({ success: false, message: 'new_judge_id is required.' });
    }

    const adminResult = await pool.query('SELECT admin_id FROM court_administrators WHERE user_id = $1', [req.user.user_id]);
    const admin_id = adminResult.rows[0]?.admin_id;

    const hearingResult = await pool.query(
      `UPDATE hearings SET judge_id = $1, updated_at = NOW() WHERE hearing_id = $2 RETURNING *`,
      [new_judge_id, hearingId]
    );

    if (hearingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }

    const hearing = hearingResult.rows[0];

    await pool.query(
      `INSERT INTO judge_assignments (case_id, judge_id, assigned_by, assignment_status)
       VALUES ($1, $2, $3, 'pending')`,
      [hearing.case_id, new_judge_id, admin_id]
    );

    return res.status(200).json({ success: true, message: 'Judge reassigned.', data: hearing });
  } catch (err) {
    console.error('reassignJudge error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/hearings/:id
const getHearingById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT h.*, c.case_title, c.case_category, c.priority,
        j.full_name AS judge_name, j.court_station
       FROM hearings h
       JOIN cases c ON h.case_id = c.case_id
       LEFT JOIN judges j ON h.judge_id = j.judge_id
       WHERE h.hearing_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getHearingById error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  requestHearing, getHearings, createHearing, updateHearingStatus,
  approveHearing, rejectHearing, respondToAssignment, reassignJudge, getHearingById
};