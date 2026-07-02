BEGIN;

-- Seed password for all accounts below:
-- Password123!
-- bcrypt hash generated with bcryptjs (cost 10)
-- Keep this in sync with backend auth expectations.
WITH user_seed(full_name, email, role) AS (
	VALUES
		('System Administrator', 'admin@vigil.local', 'admin'),
		('Hon. Grace Wanjiku', 'judge@vigil.local', 'judge'),
		('Alex Mwangi', 'litigant@vigil.local', 'litigant'),
		('Mercy Njeri', 'advocate@vigil.local', 'advocate')
)
INSERT INTO users (full_name, email, password, role)
SELECT
	s.full_name,
	s.email,
	'$2b$10$8YP69yixEzyUu1WYmXdZO.yH/LcZ4tXcmSKmTEZwCHEImK0WFdiRu',
	s.role
FROM user_seed s
ON CONFLICT (email) DO UPDATE SET
	full_name = EXCLUDED.full_name,
	role = EXCLUDED.role,
	password = EXCLUDED.password,
	updated_at = NOW();

INSERT INTO court_administrators (user_id, full_name, email, password)
SELECT u.user_id, u.full_name, u.email, u.password
FROM users u
WHERE u.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO judges (user_id, full_name, email, password, court_station)
SELECT u.user_id, u.full_name, u.email, u.password, 'Milimani Law Courts'
FROM users u
WHERE u.role = 'judge'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO litigants_advocates (user_id, full_name, email, password, participant_type)
SELECT u.user_id, u.full_name, u.email, u.password, u.role
FROM users u
WHERE u.role IN ('litigant', 'advocate')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO cases (case_title, case_category, case_description, case_status, priority, filing_date, participant_id, admin_id)
SELECT
	s.case_title,
	s.case_category,
	s.case_description,
	s.case_status,
	s.priority,
	s.filing_date,
	p.participant_id,
	a.admin_id
FROM (
	VALUES
		('State vs Njoroge', 'Criminal', 'Alleged robbery with violence at CBD.', 'active', 'urgent', CURRENT_DATE - 15),
		('Karanja vs Atieno Land Boundary', 'Civil', 'Dispute over parcel demarcation and title boundary.', 'scheduled', 'normal', CURRENT_DATE - 10),
		('Muriithi Holdings vs Beta Traders', 'Commercial', 'Breach of supply contract and unpaid invoices.', 'pending', 'high', CURRENT_DATE - 7),
		('In Re: Custody of Baby A', 'Family', 'Interim custody and visitation determination.', 'active', 'normal', CURRENT_DATE - 5),
		('Mwangi vs County Assembly', 'Constitutional', 'Petition alleging violation of fair administrative action.', 'pending', 'high', CURRENT_DATE - 3)
) AS s(case_title, case_category, case_description, case_status, priority, filing_date)
LEFT JOIN litigants_advocates p ON p.email = 'litigant@vigil.local'
LEFT JOIN court_administrators a ON a.email = 'admin@vigil.local'
WHERE NOT EXISTS (
	SELECT 1 FROM cases c WHERE c.case_title = s.case_title
);

INSERT INTO judge_assignments (case_id, judge_id, assigned_by, assignment_status, assignment_date)
SELECT
	c.case_id,
	j.judge_id,
	a.admin_id,
	CASE WHEN c.case_status IN ('active', 'scheduled') THEN 'approved' ELSE 'pending' END,
	CURRENT_DATE
FROM cases c
CROSS JOIN judges j
CROSS JOIN court_administrators a
WHERE j.email = 'judge@vigil.local'
	AND a.email = 'admin@vigil.local'
	AND NOT EXISTS (
		SELECT 1 FROM judge_assignments ja WHERE ja.case_id = c.case_id
	);

INSERT INTO hearings (case_id, judge_id, admin_id, hearing_date, hearing_time, meeting_link, status, hearing_notes)
SELECT
	c.case_id,
	j.judge_id,
	a.admin_id,
	s.hearing_date,
	s.hearing_time,
	s.meeting_link,
	s.status,
	s.hearing_notes
FROM (
	VALUES
		('State vs Njoroge', CURRENT_DATE + 2, TIME '09:30', 'https://meet.vigil.local/hearing/cr-001', 'scheduled', 'Pre-trial directions'),
		('Karanja vs Atieno Land Boundary', CURRENT_DATE + 4, TIME '11:00', 'https://meet.vigil.local/hearing/cv-001', 'requested', 'Awaiting admin confirmation')
) AS s(case_title, hearing_date, hearing_time, meeting_link, status, hearing_notes)
JOIN cases c ON c.case_title = s.case_title
JOIN judges j ON j.email = 'judge@vigil.local'
JOIN court_administrators a ON a.email = 'admin@vigil.local'
WHERE NOT EXISTS (
	SELECT 1
	FROM hearings h
	WHERE h.case_id = c.case_id
		AND h.hearing_date = s.hearing_date
		AND h.hearing_time = s.hearing_time
);

COMMIT;
