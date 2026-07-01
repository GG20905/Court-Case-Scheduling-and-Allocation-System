import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProfileMenu from '../components/ProfileMenu';
import { getStoredAuthToken } from '../utils/auth';

const navItems = ['Dashboard', 'Cases', 'Schedule', 'Documents'];

const THEME = {
	pageBg: '#f5f7fc',
	navPrimary: '#0d1652',
	navText: '#d2ddff',
	accent: '#1a3a8c',
	panel: '#eef2fa',
	border: '#a8bfe0',
};

const toMonthKey = (value) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function JudgeDocument() {
	const navigate = useNavigate();
	const [isNarrowScreen, setIsNarrowScreen] = useState(() => window.innerWidth < 980);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [activeNav, setActiveNav] = useState('Documents');
	const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
	const [searchTerm, setSearchTerm] = useState('');
	const [documents, setDocuments] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [fetchError, setFetchError] = useState('');

	useEffect(() => {
		const onResize = () => setIsNarrowScreen(window.innerWidth < 980);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	useEffect(() => {
		const token = getStoredAuthToken();
		if (!token) {
			setFetchError('Session expired. Please login again.');
			setIsLoading(false);
			return;
		}

		const fetchDocuments = async () => {
			setIsLoading(true);
			setFetchError('');

			try {
				const casesRes = await fetch('/api/cases', {
					headers: { Authorization: `Bearer ${token}` },
				});

				const casesData = await casesRes.json();
				if (!casesRes.ok) {
					throw new Error(casesData.message || 'Failed to load cases.');
				}

				const caseList = Array.isArray(casesData.data) ? casesData.data : [];

				const docsByCaseResults = await Promise.all(
					caseList.map(async (caseItem) => {
						const caseId = caseItem.case_id;
						const res = await fetch(`/api/cases/${caseId}/documents`, {
							headers: { Authorization: `Bearer ${token}` },
						});
						const data = await res.json();

						if (!res.ok) {
							return [];
						}

						return (Array.isArray(data.data) ? data.data : []).map((doc) => ({
							id: doc.document_id,
							caseId: String(caseId),
							caseTitle: caseItem.case_title || `Case ${caseId}`,
							docName: doc.document_name || 'Unnamed document',
							type: doc.document_type || 'Unspecified',
							uploadedAt: doc.created_at || doc.upload_date,
							uploadedBy: doc.uploaded_by_name || 'Unknown uploader',
						}));
					})
				);

				setDocuments(docsByCaseResults.flat());
			} catch (error) {
				setFetchError(error.message || 'Failed to load documents.');
			} finally {
				setIsLoading(false);
			}
		};

		fetchDocuments();
	}, []);

	const filteredDocs = useMemo(() => {
		return documents.filter((doc) => {
			const sameMonth = toMonthKey(doc.uploadedAt) === monthFilter;
			const matchesSearch =
				doc.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
				doc.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
				doc.docName.toLowerCase().includes(searchTerm.toLowerCase());
			return sameMonth && matchesSearch;
		});
	}, [documents, monthFilter, searchTerm]);

	const docsByCase = useMemo(() => {
		const grouped = new Map();
		for (const doc of filteredDocs) {
			if (!grouped.has(doc.caseId)) {
				grouped.set(doc.caseId, { caseId: doc.caseId, caseTitle: doc.caseTitle, docs: [] });
			}
			grouped.get(doc.caseId).docs.push(doc);
		}
		return Array.from(grouped.values());
	}, [filteredDocs]);

	return (
		<div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', backgroundColor: THEME.pageBg }}>
			<Navbar />

			<nav
				style={{
					backgroundColor: THEME.navPrimary,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '10px',
					padding: isNarrowScreen ? '8px 12px' : '0 24px',
					minHeight: '60px',
				}}
			>
				<button
					onClick={() => setIsSidebarOpen(true)}
					style={{
						border: `1px solid ${THEME.border}`,
						borderRadius: '8px',
						backgroundColor: '#fff',
						color: THEME.accent,
						fontSize: '13px',
						fontWeight: 700,
						padding: '7px 10px',
						cursor: 'pointer',
						flexShrink: 0,
					}}
				>
					☰
				</button>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
					{navItems.map((item) => (
						<button
							key={item}
							onClick={() => {
								setActiveNav(item);
								if (item === 'Dashboard') navigate('/dashboard/judge');
								if (item === 'Cases') navigate('/dashboard/judge/cases');
								if (item === 'Schedule') navigate('/dashboard/judge/schedule');
								if (item === 'Documents') navigate('/dashboard/judge/documents');
							}}
							style={{
								background: activeNav === item ? THEME.accent : 'transparent',
								color: activeNav === item ? '#fff' : THEME.navText,
								border: 'none',
								borderRadius: '6px',
								padding: isNarrowScreen ? '8px 14px' : '8px 22px',
								fontSize: '14px',
								fontWeight: activeNav === item ? 600 : 400,
								cursor: 'pointer',
								whiteSpace: 'nowrap',
								flexShrink: 0,
							}}
						>
							{item}
						</button>
					))}
				</div>

				<div style={{ flexShrink: 0 }}>
					<ProfileMenu accentColor={THEME.accent} borderColor={THEME.border} />
				</div>
			</nav>

			{isSidebarOpen && (
				<>
					<div onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)', zIndex: 29 }} />
					<aside
						style={{
							position: 'fixed',
							top: 0,
							left: 0,
							bottom: 0,
							width: isNarrowScreen ? '78%' : '260px',
							maxWidth: '320px',
							backgroundColor: THEME.panel,
							borderRight: `1px solid ${THEME.border}`,
							padding: '14px 0',
							zIndex: 30,
							overflowY: 'auto',
						}}
					>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 14px 10px' }}>
							<p style={{ fontSize: '12px', fontWeight: 700, color: THEME.accent, letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
								Documents
							</p>
							<button
								onClick={() => setIsSidebarOpen(false)}
								style={{ border: 'none', background: 'transparent', color: THEME.accent, fontSize: '18px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
								aria-label="Close sidebar"
							>
								←
							</button>
						</div>
						<div style={{ padding: '8px 20px' }}>
							<label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>Month</label>
							<input
								type="month"
								value={monthFilter}
								onChange={(e) => setMonthFilter(e.target.value)}
								style={{
									width: '100%',
									padding: '8px',
									border: `1px solid ${THEME.border}`,
									borderRadius: '8px',
									backgroundColor: '#fff',
								}}
							/>
						</div>
					</aside>
				</>
			)}

			<div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
				<main style={{ flex: 1, padding: isNarrowScreen ? '16px' : '28px 32px', minWidth: 0 }}>
					<h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>Monthly Documents Outlook</h2>
					<p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>
						Documents are grouped by the case they are attached to.
					</p>

					{fetchError && (
						<div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
							{fetchError}
						</div>
					)}

					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search by case number, title, or document name"
						style={{
							width: '100%',
							maxWidth: '440px',
							marginBottom: '16px',
							padding: '10px 12px',
							border: `1px solid ${THEME.border}`,
							borderRadius: '8px',
							fontSize: '14px',
						}}
					/>

					{isLoading && (
						<div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', padding: '20px' }}>
							<p style={{ margin: 0, color: '#64748B' }}>Loading documents...</p>
						</div>
					)}

					{!isLoading && docsByCase.length === 0 && (
						<div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', padding: '20px' }}>
							<p style={{ margin: 0, color: '#64748B' }}>No documents found for this month/filter.</p>
						</div>
					)}

					{!isLoading && docsByCase.map((group) => (
						<div
							key={group.caseId}
							style={{
								backgroundColor: '#fff',
								border: `1px solid ${THEME.border}`,
								borderRadius: '10px',
								boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
								marginBottom: '14px',
								overflow: 'hidden',
							}}
						>
							<div style={{ backgroundColor: THEME.panel, padding: '10px 14px', borderBottom: `1px solid ${THEME.border}` }}>
								<p style={{ margin: 0, color: THEME.accent, fontWeight: 700 }}>{group.caseId}</p>
								<p style={{ margin: '2px 0 0', color: '#334155', fontSize: '13px' }}>{group.caseTitle}</p>
							</div>

							<table style={{ width: '100%', borderCollapse: 'collapse' }}>
								<thead>
									<tr style={{ backgroundColor: '#F8FAFC' }}>
										{['Document', 'Type', 'Uploaded by', 'Date attached'].map((h) => (
											<th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{group.docs.map((doc) => (
										<tr key={doc.id} style={{ borderTop: '1px solid #E2E8F0' }}>
											<td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>{doc.docName}</td>
											<td style={{ padding: '10px 14px', color: '#475569' }}>{doc.type}</td>
											<td style={{ padding: '10px 14px', color: '#475569' }}>{doc.uploadedBy}</td>
											<td style={{ padding: '10px 14px', color: '#475569' }}>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				</main>
			</div>
		</div>
	);
}
