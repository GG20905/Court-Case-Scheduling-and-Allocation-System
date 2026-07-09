import { useEffect, useMemo, useState } from 'react';
import { getStoredAuthToken } from '../utils/auth';
import JudgePageShell, { JUDGE_THEME } from '../components/JudgePageShell';

const toMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const toDisplayDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export default function JudgeDocument() {
  const [activeSidebar, setActiveSidebar] = useState('documents');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState([]);
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');

  const [rulings, setRulings] = useState([]);
  const [isRulingsLoading, setIsRulingsLoading] = useState(true);
  const [rulingError, setRulingError] = useState('');
  const [rulingMessage, setRulingMessage] = useState('');
  const [isSubmittingRuling, setIsSubmittingRuling] = useState(false);
  const [rulingForm, setRulingForm] = useState({ caseId: '', rulingText: '' });
  const [rulingMode, setRulingMode] = useState('text');
  const [rulingFile, setRulingFile] = useState(null);

  const loadDocuments = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setFetchError('Session expired. Please login again.');
      setIsLoading(false);
      return;
    }

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
      setCases(caseList);

      const approvedCases = caseList.filter((item) => String(item.assignment_status || '').toLowerCase() === 'approved');
      setRulingForm((prev) => ({ ...prev, caseId: prev.caseId || String(approvedCases[0]?.case_id || '') }));

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

  const loadRulings = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setRulingError('Session expired. Please login again.');
      setIsRulingsLoading(false);
      return;
    }

    setIsRulingsLoading(true);
    setRulingError('');

    try {
      const response = await fetch('/api/rulings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load rulings.');
      }

      setRulings(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setRulingError(error.message || 'Failed to load rulings.');
    } finally {
      setIsRulingsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadRulings();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const sameMonth = !monthFilter || toMonthKey(doc.uploadedAt) === monthFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        doc.caseId.toLowerCase().includes(term) ||
        doc.caseTitle.toLowerCase().includes(term) ||
        doc.docName.toLowerCase().includes(term);
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

  const approvedCases = useMemo(() => {
    return cases.filter((item) => String(item.assignment_status || '').toLowerCase() === 'approved');
  }, [cases]);

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

  const handleSubmitRuling = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setRulingError('Session expired. Please login again.');
      return;
    }

    const caseId = Number(rulingForm.caseId);
    const rulingText = String(rulingForm.rulingText || '').trim();

    if (!caseId) {
      setRulingError('Please select a case.');
      return;
    }

    if (rulingMode === 'text' && !rulingText) {
      setRulingError('Please enter ruling text.');
      return;
    }

    if (rulingMode === 'document' && !rulingFile) {
      setRulingError('Please upload a ruling PDF document.');
      return;
    }

    setIsSubmittingRuling(true);
    setRulingError('');
    setRulingMessage('');

    try {
      const requestOptions = {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      };

      if (rulingMode === 'document') {
        const payload = new FormData();
        payload.append('case_id', String(caseId));
        payload.append('submission_type', 'document');
        payload.append('ruling_document', rulingFile);
        requestOptions.body = payload;
      } else {
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify({ case_id: caseId, ruling_text: rulingText, submission_type: 'text' });
      }

      const response = await fetch('/api/rulings', requestOptions);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit ruling.');
      }

      setRulingMessage(data.message || 'Ruling submitted.');
      setRulingForm((prev) => ({ ...prev, rulingText: '' }));
      setRulingFile(null);
      await loadRulings();
    } catch (error) {
      setRulingError(error.message || 'Failed to submit ruling.');
    } finally {
      setIsSubmittingRuling(false);
    }
  };

  const handleDownloadRulingDocument = async (rulingId, fallbackName) => {
    const token = getStoredAuthToken();
    if (!token) {
      setRulingError('Session expired. Please login again.');
      return;
    }

    try {
      const response = await fetch(`/api/rulings/${rulingId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to download ruling document.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackName || 'ruling.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setRulingError(error.message || 'Unable to download ruling document.');
    }
  };

  return (
    <JudgePageShell
      activeNav="Documents"
      sidebarTitle="Judge Panel"
      sidebarItems={[
        { key: 'documents', label: 'Documents' },
        { key: 'rulings', label: 'Rulings' },
      ]}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
      topNavExtra={activeSidebar === 'documents' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ color: JUDGE_THEME.navText, fontSize: '12px' }}>Month</label>
          <input
            type="month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
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
      ) : null}
    >
      {activeSidebar === 'documents' && (
        <>
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
            onChange={(event) => setSearchTerm(event.target.value)}
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
              style={{ borderRadius: '12px', marginBottom: '14px', overflow: 'hidden' }}
            >
              <div style={{ backgroundColor: JUDGE_THEME.panel, padding: '10px 14px', borderBottom: `1px solid ${JUDGE_THEME.border}` }}>
                <p style={{ margin: 0, color: JUDGE_THEME.accent, fontWeight: 700 }}>{group.caseId}</p>
                <p style={{ margin: '2px 0 0', color: '#334155', fontSize: '13px' }}>{group.caseTitle}</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="pegasus-table-head">
                    {['Document', 'Type', 'Uploaded by', 'Date attached', 'Shared on', 'Actions'].map((heading) => (
                      <th key={heading} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.docs.map((doc) => (
                    <tr key={doc.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>{doc.docName}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.type}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.uploadedBy}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{toDisplayDate(doc.uploadedAt)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        {doc.sharedAt ? toDisplayDate(doc.sharedAt) : '-'}
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
        </>
      )}

      {activeSidebar === 'rulings' && (
        <>
          <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>Judge Rulings</h2>
          <p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>
          </p>

          {rulingError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {rulingError}
            </div>
          )}

          {rulingMessage && (
            <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
              {rulingMessage}
            </div>
          )}

          <section className="pegasus-block" style={{ borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1E2A45', fontSize: '16px' }}>Submit or update draft ruling</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#475569' }}>
                Submission mode
                <select
                  value={rulingMode}
                  onChange={(event) => setRulingMode(event.target.value)}
                  style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${JUDGE_THEME.border}` }}
                >
                  <option value="text">Text ruling</option>
                  <option value="document">Document ruling (PDF)</option>
                </select>
              </label>

              <label style={{ fontSize: '12px', color: '#475569' }}>
                Case
                <select
                  value={rulingForm.caseId}
                  onChange={(event) => setRulingForm((prev) => ({ ...prev, caseId: event.target.value }))}
                  style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${JUDGE_THEME.border}` }}
                >
                  {approvedCases.length === 0 && <option value="">No approved assigned cases</option>}
                  {approvedCases.map((item) => (
                    <option key={item.case_id} value={String(item.case_id)}>
                      CASE-{item.case_id} - {item.case_title}
                    </option>
                  ))}
                </select>
              </label>

              {rulingMode === 'text' && (
                <label style={{ fontSize: '12px', color: '#475569' }}>
                  Ruling text
                  <textarea
                    value={rulingForm.rulingText}
                    onChange={(event) => setRulingForm((prev) => ({ ...prev, rulingText: event.target.value }))}
                    rows={6}
                    placeholder="Write your ruling here"
                    style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${JUDGE_THEME.border}`, resize: 'vertical' }}
                  />
                </label>
              )}

              {rulingMode === 'document' && (
                <label style={{ fontSize: '12px', color: '#475569' }}>
                  Ruling document (PDF)
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setRulingFile(event.target.files?.[0] || null)}
                    style={{ display: 'block', marginTop: '6px' }}
                  />
                  {rulingFile && (
                    <span style={{ display: 'block', marginTop: '6px', color: '#334155', fontSize: '12px' }}>
                      Selected: {rulingFile.name}
                    </span>
                  )}
                </label>
              )}

              <button
                type="button"
                onClick={handleSubmitRuling}
                disabled={isSubmittingRuling || approvedCases.length === 0}
                style={{
                  width: 'fit-content',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: JUDGE_THEME.accent,
                  color: '#fff',
                  padding: '10px 14px',
                  fontWeight: 600,
                  cursor: isSubmittingRuling || approvedCases.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingRuling || approvedCases.length === 0 ? 0.75 : 1,
                }}
              >
                {isSubmittingRuling ? 'Submitting...' : 'Submit ruling'}
              </button>
            </div>
          </section>

          <section className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="pegasus-table-head">
                  {['Case', 'Ruling date', 'Status', 'Type', 'Content'].map((heading) => (
                    <th key={heading} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isRulingsLoading && (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 14px', color: '#64748B' }}>Loading rulings...</td>
                  </tr>
                )}
                {!isRulingsLoading && rulings.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 14px', color: '#64748B' }}>No rulings available.</td>
                  </tr>
                )}
                {!isRulingsLoading && rulings.map((item) => (
                  <tr key={item.ruling_id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>
                      CASE-{item.case_id} - {item.case_title || 'Untitled case'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{toDisplayDate(item.ruling_date)}</td>
                    <td style={{ padding: '10px 14px', color: item.is_published ? '#166534' : '#92400E', fontWeight: 700 }}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{item.ruling_document_path ? 'Document' : 'Text'}</td>
                    <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                      {item.ruling_document_path ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadRulingDocument(item.ruling_id, item.ruling_document_name)}
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
                          Download {item.ruling_document_name || 'ruling'}
                        </button>
                      ) : (
                        item.ruling_text
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </JudgePageShell>
  );
}
