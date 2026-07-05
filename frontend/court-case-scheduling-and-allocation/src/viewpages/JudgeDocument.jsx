import { useEffect, useMemo, useState } from 'react';
import { getStoredAuthToken } from '../utils/auth';
import JudgePageShell, { JUDGE_THEME } from '../components/JudgePageShell';

const toMonthKey = (value) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function JudgeDocument() {
	const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
	const [searchTerm, setSearchTerm] = useState('');
	const [documents, setDocuments] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [fetchError, setFetchError] = useState('');
	const [actionError, setActionError] = useState('');

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
			setActionError('');

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
							sharedAt: doc.shared_at || null,
							sharedByAdminName: doc.shared_by_admin_name || '',
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
			const sameMonth = !monthFilter || toMonthKey(doc.uploadedAt) === monthFilter;
			const matchesSearch =
				doc.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
				doc.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
				doc.docName.toLowerCase().includes(searchTerm.toLowerCase());
			return sameMonth && matchesSearch;
		});
	}, [documents, monthFilter, searchTerm]);

	const handleDownload = async (documentId, fallbackName) => {
		const token = getStoredAuthToken();
		if (!token) {
			setActionError('Session expired. Please login again.');
			return;
		}

		setActionError('');

		try {
			const response = await fetch(`/api/documents/${documentId}/download`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.message || 'Unable to download this document.');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = fallbackName || 'document';
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			setActionError(error.message || 'Unable to download this document.');
		}
	};

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
		<JudgePageShell
			activeNav="Documents"
			sidebarTitle="Judge Panel"
			sidebarItems={[{ key: 'month', label: 'Month filter' }]}
			activeSidebarKey="month"
			onSidebarSelect={() => {}}
				topNavExtra={(
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<label style={{ color: JUDGE_THEME.navText, fontSize: '12px' }}>Month</label>
					<input
						type="month"
						value={monthFilter}
						onChange={(e) => setMonthFilter(e.target.value)}
						style={{
							padding: '6px 8px',
							borderRadius: '8px',
							border: `1px solid ${JUDGE_THEME.border}`,
							backgroundColor: '#fff',
							fontSize: '12px',
						}}
					/>
						<button
							type="button"
							onClick={() => setMonthFilter('')}
							style={{
								padding: '6px 8px',
								borderRadius: '8px',
								border: `1px solid ${JUDGE_THEME.border}`,
								backgroundColor: '#fff',
								fontSize: '12px',
								cursor: 'pointer',
							}}
						>
							All
						</button>
				</div>
			)}
		>
					<h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>Monthly Documents Outlook</h2>
					<p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>
						Documents are grouped by the case they are attached to.
					</p>

					{fetchError && (
						<div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
							{fetchError}
						</div>
					)}

					{actionError && (
						<div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
							{actionError}
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
							border: `1px solid ${JUDGE_THEME.border}`,
							borderRadius: '8px',
							fontSize: '14px',
						}}
					/>

					{isLoading && (
						<div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
							<p style={{ margin: 0, color: '#64748B' }}>Loading documents...</p>
						</div>
					)}

					{!isLoading && docsByCase.length === 0 && (
						<div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
							<p style={{ margin: 0, color: '#64748B' }}>No documents found for this month/filter.</p>
						</div>
					)}

					{!isLoading && docsByCase.map((group) => (
						<div
							className="pegasus-block"
							key={group.caseId}
							style={{
								borderRadius: '12px',
								marginBottom: '14px',
								overflow: 'hidden',
							}}
						>
							<div style={{ backgroundColor: JUDGE_THEME.panel, padding: '10px 14px', borderBottom: `1px solid ${JUDGE_THEME.border}` }}>
								<p style={{ margin: 0, color: JUDGE_THEME.accent, fontWeight: 700 }}>{group.caseId}</p>
								<p style={{ margin: '2px 0 0', color: '#334155', fontSize: '13px' }}>{group.caseTitle}</p>
							</div>

							<table style={{ width: '100%', borderCollapse: 'collapse' }}>
								<thead>
									<tr className="pegasus-table-head">
										{['Document', 'Type', 'Uploaded by', 'Date attached', 'Shared on', 'Actions'].map((h) => (
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
											<td style={{ padding: '10px 14px', color: '#475569' }}>
												{doc.sharedAt ? new Date(doc.sharedAt).toLocaleDateString() : '-'}
												{doc.sharedByAdminName ? ` by ${doc.sharedByAdminName}` : ''}
											</td>
											<td style={{ padding: '10px 14px' }}>
												<button
													type="button"
													onClick={() => handleDownload(doc.id, doc.docName)}
													style={{
														border: `1px solid ${JUDGE_THEME.border}`,
														backgroundColor: '#fff',
														borderRadius: '6px',
														padding: '6px 10px',
														fontSize: '12px',
														color: JUDGE_THEME.accent,
														cursor: 'pointer',
													}}
												>
												 Download
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
		</JudgePageShell>
	);
}
