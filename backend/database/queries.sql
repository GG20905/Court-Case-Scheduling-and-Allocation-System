-- 1) Dashboard summary counts
SELECT
	(SELECT COUNT(*) FROM users) AS total_users,
	(SELECT COUNT(*) FROM cases) AS total_cases,
	(SELECT COUNT(*) FROM hearings WHERE status = 'scheduled') AS scheduled_hearings,
	(SELECT COUNT(*) FROM hearings WHERE status = 'ongoing') AS ongoing_hearings,
	(SELECT COUNT(*) FROM hearings WHERE status = 'completed') AS completed_hearings;


SELECT
	c.id,
	c.case_number,
	c.title,
	c.status,
	c.created_at,
	ct.name AS case_type,
	p.full_name AS plaintiff,
	d.full_name AS defendant
FROM cases c
JOIN case_types ct ON ct.id = c.case_type_id
JOIN users p ON p.id = c.plaintiff_id
JOIN users d ON d.id = c.defendant_id
ORDER BY c.created_at DESC;


SELECT
	h.id,
	c.case_number,
	co.name AS court_name,
	u.full_name AS judge_name,
	h.scheduled_start,
	h.scheduled_end,
	h.status,
	h.meeting_link
FROM hearings h
JOIN cases c ON c.id = h.case_id
JOIN courts co ON co.id = h.court_id
JOIN judges j ON j.id = h.judge_id
JOIN users u ON u.id = j.user_id
WHERE h.scheduled_start >= NOW()
ORDER BY h.scheduled_start ASC;


SELECT
	id,
	case_id,
	uploaded_by,
	file_name,
	file_path,
	mime_type,
	file_size,
	uploaded_at
FROM documents
WHERE case_id = $1
ORDER BY uploaded_at DESC;

-- Notifications for a user 
SELECT
	id,
	title,
	message,
	is_read,
	created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC;
