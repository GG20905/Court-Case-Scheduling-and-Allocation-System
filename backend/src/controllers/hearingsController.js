const pool = require('../config/db');

const parseRequestedDateTime = (dateValue, timeValue) => {
  const dateText = String(dateValue || '').trim();
  const timeText = String(timeValue || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timeText)) return null;

  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parsePositiveIntId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
};

const normalizeHearingMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'physical' || normalized === 'virtual') return normalized;
  return '';
};

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// POST /api/hearings/request
const requestHearing = async (req, res) => {
  try {
    const { case_id, preferred_date, preferred_time, notes } = req.body;

    if (!case_id || !preferred_date || !preferred_time) {
      return res.status(400).json({ success: false, message: 'case_id, preferred_date and preferred_time are required.' });
    }

    const requestedDateTime = parseRequestedDateTime(preferred_date, preferred_time);
    if (!requestedDateTime) {
      return res.status(400).json({ success: false, message: 'Invalid preferred_date or preferred_time format.' });
    }

    if (requestedDateTime.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Preferred hearing date/time cannot be in the past.' });
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
        SELECT h.*, c.case_title, c.case_status, j.full_name AS judge_name, j.specialty AS judge_specialty,
          ja.assignment_status, ja.rejection_reason
        FROM hearings h
        JOIN cases c ON h.case_id = c.case_id
        LEFT JOIN judges j ON h.judge_id = j.judge_id
        LEFT JOIN LATERAL (
          SELECT assignment_status, rejection_reason
          FROM judge_assignments
          WHERE case_id = h.case_id
          ORDER BY updated_at DESC, assignment_date DESC, assignment_id DESC
          LIMIT 1
        ) ja ON TRUE
        ORDER BY
          CASE WHEN h.status = 'requested' THEN 0 ELSE 1 END,
          CASE WHEN h.status = 'requested' THEN h.created_at END ASC,
          h.hearing_date ASC,
          h.hearing_time ASC,
          h.created_at ASC`;
    } else if (req.user.role === 'judge') {
      const jResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
      query = `
        SELECT h.*, c.case_title, c.priority, ja.assignment_status
        FROM hearings h
        JOIN cases c ON h.case_id = c.case_id
        LEFT JOIN LATERAL (
          SELECT assignment_status
          FROM judge_assignments
          WHERE case_id = h.case_id AND judge_id = $1
          ORDER BY updated_at DESC, assignment_date DESC, assignment_id DESC
          LIMIT 1
        ) ja ON TRUE
        WHERE h.judge_id = $1 ORDER BY h.hearing_date ASC`;
      params = [jResult.rows[0].judge_id];
    } else {
      const pResult = await pool.query('SELECT participant_id FROM litigants_advocates WHERE user_id = $1', [req.user.user_id]);
      query = `
        SELECT h.*, c.case_title, j.full_name AS judge_name, j.specialty AS judge_specialty
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

    const normalizedRejectionReason = String(rejection_reason || '').trim();
    if (action === 'reject' && !normalizedRejectionReason) {
      return res.status(400).json({ success: false, message: 'rejection_reason is required when rejecting an assignment.' });
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
      [newStatus, normalizedRejectionReason || null, assignmentId, judge_id]
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

// PATCH /api/hearings/:id/mode  (judge)
const setHearingModeByJudge = async (req, res) => {
  try {
    const parsedHearingId = parsePositiveIntId(req.params.id);
    if (!parsedHearingId) {
      return res.status(400).json({ success: false, message: 'Invalid hearing ID. It must be a positive integer.' });
    }

    const hearingMode = normalizeHearingMode(req.body?.hearing_mode);
    const meetingLink = String(req.body?.meeting_link || '').trim();

    if (!hearingMode) {
      return res.status(400).json({ success: false, message: 'hearing_mode must be either "physical" or "virtual".' });
    }

    if (hearingMode === 'virtual' && (!meetingLink || !isValidHttpUrl(meetingLink))) {
      return res.status(400).json({ success: false, message: 'A valid http(s) meeting_link is required for virtual hearings.' });
    }

    const judgeResult = await pool.query('SELECT judge_id FROM judges WHERE user_id = $1', [req.user.user_id]);
    if (judgeResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Judge record not found.' });
    }

    const judgeId = judgeResult.rows[0].judge_id;

    const hearingResult = await pool.query(
      'SELECT hearing_id, case_id, judge_id FROM hearings WHERE hearing_id = $1',
      [parsedHearingId]
    );

    if (hearingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hearing not found.' });
    }

    const hearing = hearingResult.rows[0];
    if (Number(hearing.judge_id) !== Number(judgeId)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this hearing.' });
    }

    const approvalResult = await pool.query(
      `SELECT assignment_id
       FROM judge_assignments
       WHERE case_id = $1 AND judge_id = $2 AND assignment_status = 'approved'
       ORDER BY updated_at DESC, assignment_date DESC, assignment_id DESC
       LIMIT 1`,
      [hearing.case_id, judgeId]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Set hearing mode is allowed only after you accept the assignment.' });
    }

    const updatedResult = await pool.query(
      `UPDATE hearings
       SET hearing_mode = $1::varchar,
           meeting_link = CASE WHEN $1::varchar = 'virtual' THEN NULLIF($2::text, '') ELSE NULL END,
           updated_at = NOW()
       WHERE hearing_id = $3
       RETURNING *`,
      [hearingMode, meetingLink, parsedHearingId]
    );

    return res.status(200).json({ success: true, message: 'Hearing mode updated.', data: updatedResult.rows[0] });
  } catch (err) {
    if (err && err.code === '22001') {
      return res.status(400).json({ success: false, message: 'Meeting link is too long. Please use a shorter URL.' });
    }
    console.error('setHearingModeByJudge error:', err);
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
  approveHearing, rejectHearing, respondToAssignment, setHearingModeByJudge, reassignJudge, getHearingById
};