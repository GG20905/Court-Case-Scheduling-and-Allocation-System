BEGIN;

INSERT INTO users (full_name, email, password_hash, role, phone) VALUES
('System Admin', 'admin@virtualcourt.local', 'hashed_admin_pw', 'admin', '+254700000001'),
('Hon. Grace Wanjiku', 'judge1@virtualcourt.local', 'hashed_judge_pw', 'judge', '+254700000002'),
('Alex Mwangi', 'lawyer1@virtualcourt.local', 'hashed_lawyer_pw', 'lawyer', '+254700000003'),
('Mercy Njeri', 'lawyer2@virtualcourt.local', 'hashed_lawyer_pw', 'lawyer', '+254700000004'),
('John Karanja', 'party1@virtualcourt.local', 'hashed_party_pw', 'party', '+254700000005'),
('Faith Atieno', 'party2@virtualcourt.local', 'hashed_party_pw', 'party', '+254700000006'),
('Court Clerk Amina', 'clerk1@virtualcourt.local', 'hashed_clerk_pw', 'clerk', '+254700000007');

INSERT INTO courts (name, location, virtual_link) VALUES
('Milimani Civil Court - Virtual', 'Nairobi', 'https://meet.virtualcourt.local/milimani-civil'),
('Nairobi Commercial Court - Virtual', 'Nairobi', 'https://meet.virtualcourt.local/nairobi-commercial');

INSERT INTO case_types (name, description) VALUES
('Civil', 'General civil disputes'),
('Criminal', 'Criminal matters'),
('Commercial', 'Business and commercial disputes'),
('Family', 'Family law disputes');

INSERT INTO judges (user_id, court_id) VALUES
(2, 1);

INSERT INTO cases (
	case_number, title, description, status,
	case_type_id, plaintiff_id, defendant_id, filed_by
) VALUES
(
	'VC-2026-0001',
	'Breach of Contract - Karanja vs Atieno',
	'The plaintiff alleges breach of service agreement signed in 2025.',
	'scheduled',
	3,
	5,
	6,
	3
),
(
	'VC-2026-0002',
	'Property Boundary Dispute',
	'A civil dispute regarding land demarcation and title rights.',
	'filed',
	1,
	6,
	5,
	4
);

INSERT INTO case_participants (case_id, user_id, participant_role) VALUES
(1, 5, 'plaintiff'),
(1, 6, 'defendant'),
(1, 3, 'lawyer'),
(1, 4, 'lawyer'),
(2, 6, 'plaintiff'),
(2, 5, 'defendant');

INSERT INTO hearings (
	case_id, court_id, judge_id, scheduled_start, scheduled_end,
	hearing_type, status, meeting_link, created_by
) VALUES
(
	1,
	1,
	1,
	NOW() + INTERVAL '2 day',
	NOW() + INTERVAL '2 day 1 hour',
	'trial',
	'scheduled',
	'https://meet.virtualcourt.local/hearing/VC-2026-0001',
	7
);

INSERT INTO documents (case_id, uploaded_by, file_name, file_path, mime_type, file_size) VALUES
(1, 3, 'plaintiff_statement.pdf', '/uploads/plaintiff_statement.pdf', 'application/pdf', 198120),
(1, 4, 'defense_response.pdf', '/uploads/defense_response.pdf', 'application/pdf', 145090);

INSERT INTO notifications (user_id, title, message) VALUES
(5, 'Hearing Scheduled', 'Your case VC-2026-0001 has been scheduled for hearing in 2 days.'),
(6, 'Case Update', 'A response document has been uploaded for case VC-2026-0001.');

COMMIT;
