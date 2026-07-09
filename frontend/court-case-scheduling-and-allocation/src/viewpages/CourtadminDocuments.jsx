import { useEffect, useMemo, useState } from 'react';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';
import { authFetchJson } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';

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

export default function CourtadminDocuments() {
  const [activeSidebar, setActiveSidebar] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyDocumentId, setBusyDocumentId] = useState(null);
  const [rulings, setRulings] = useState([]);
  const [isRulingsLoading, setIsRulingsLoading] = useState(true);

  const loadDocuments = async () => {
    setIsLoading(true);
    setFetchError('');

    try {
      const casesRes = await authFetchJson('/api/cases');
      const caseList = Array.isArray(casesRes.data) ? casesRes.data : [];

      const docsResults = await Promise.all(
        caseList.map(async (caseItem) => {
          const docsRes = await authFetchJson(`/api/cases/${caseItem.case_id}/documents`);
          const rows = Array.isArray(docsRes.data) ? docsRes.data : [];

          return rows.map((doc) => ({
            id: doc.document_id,
            caseId: String(caseItem.case_id),
            caseTitle: caseItem.case_title || `Case ${caseItem.case_id}`,
            name: doc.document_name || 'Unnamed document',
            type: doc.document_type || 'Unspecified',
            uploadedAt: doc.created_at || doc.upload_date,
            uploadedBy: doc.uploaded_by_name || 'Unknown uploader',
            sharedAt: doc.shared_at || null,
            sharedJudgeName: doc.shared_judge_name || '',
            sharedByAdminName: doc.shared_by_admin_name || '',
          }));
        })
      );

      setDocuments(docsResults.flat());

      const rulingsRes = await authFetchJson('/api/rulings');
      setRulings(Array.isArray(rulingsRes.data) ? rulingsRes.data : []);
    } catch (error) {
      setFetchError(error.message || 'Failed to load documents.');
    } finally {
      setIsLoading(false);
      setIsRulingsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const sameMonth = toMonthKey(doc.uploadedAt) === monthFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        doc.caseId.toLowerCase().includes(term) ||
        doc.caseTitle.toLowerCase().includes(term) ||
        doc.name.toLowerCase().includes(term);

      if (activeSidebar === 'all') return sameMonth && matchesSearch;
      if (activeSidebar === 'ruling-docs') return sameMonth && matchesSearch && doc.type.toLowerCase() === 'ruling';
      if (activeSidebar === 'rulings') return false;
      return sameMonth && matchesSearch && doc.type.toLowerCase() === activeSidebar;
    });
  }, [activeSidebar, documents, monthFilter, searchTerm]);

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

  const handleDownload = async (documentId, fallbackName) => {
    const token = getStoredAuthToken();
    if (!token) return;

    const response = await fetch(`/api/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackName || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadRulingDocument = async (rulingId, fallbackName) => {
    const token = getStoredAuthToken();
    if (!token) return;

    const response = await fetch(`/api/rulings/${rulingId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackName || 'ruling.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleShareToDesignatedJudge = async (documentId) => {
    setActionError('');
    setActionMessage('');
    setBusyDocumentId(documentId);

    try {
      const result = await authFetchJson(`/api/documents/${documentId}/share`, {
        method: 'PATCH',
      });
      setActionMessage(result.message || 'Document shared to designated judge.');
      await loadDocuments();
    } catch (error) {
      setActionError(error.message || 'Failed to share document to designated judge.');
    } finally {
      setBusyDocumentId(null);
    }
  };

  return (
    <AdminPageShell
      activeNav="Documents"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'all', label: 'All documents' },
        { key: 'pleading', label: 'Pleadings' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'affidavit', label: 'Affidavits' },
        { key: 'ruling-docs', label: 'Ruling docs' },
        { key: 'rulings', label: 'Rulings' },
      ]}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
    >
      <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>Admin Documents</h2>
      <p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>Documents are grouped by case for monthly review.</p>

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

      {actionMessage && (
        <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
          {actionMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${ADMIN_THEME.border}` }}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by case or document name"
          style={{ width: '100%', maxWidth: '380px', padding: '10px 12px', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '8px' }}
        />
      </div>

      {isLoading && (
        <div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading documents...</p>
        </div>
      )}

      {activeSidebar !== 'rulings' && !isLoading && docsByCase.length === 0 && (
        <div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>No documents found for this filter.</p>
        </div>
      )}

      {activeSidebar !== 'rulings' && !isLoading && docsByCase.map((group) => (
        <div
          className="pegasus-block"
          key={group.caseId}
          style={{
            borderRadius: '12px',
            marginBottom: '14px',
            overflow: 'hidden',
          }}
        >
          <div style={{ backgroundColor: ADMIN_THEME.panel, padding: '10px 14px', borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
            <p style={{ margin: 0, color: ADMIN_THEME.accent, fontWeight: 700 }}>CASE-{group.caseId}</p>
            <p style={{ margin: '2px 0 0', color: '#334155', fontSize: '13px' }}>{group.caseTitle}</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="pegasus-table-head">
                {['Document', 'Type', 'Uploaded by', 'Date', 'Shared with', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.docs.map((doc) => (
                <tr key={doc.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>{doc.name}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.type}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.uploadedBy}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{toDisplayDate(doc.uploadedAt)}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>
                    {doc.sharedJudgeName
                      ? `${doc.sharedJudgeName}${doc.sharedAt ? ` (${toDisplayDate(doc.sharedAt)})` : ''}`
                      : 'Not shared'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleDownload(doc.id, doc.name)}
                        style={{
                          border: `1px solid ${ADMIN_THEME.border}`,
                          backgroundColor: '#fff',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: ADMIN_THEME.accent,
                          cursor: 'pointer',
                        }}
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleShareToDesignatedJudge(doc.id)}
                        disabled={busyDocumentId === doc.id}
                        style={{
                          border: 'none',
                          backgroundColor: ADMIN_THEME.accent,
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: busyDocumentId === doc.id ? 'not-allowed' : 'pointer',
                          opacity: busyDocumentId === doc.id ? 0.75 : 1,
                        }}
                      >
                        {busyDocumentId === doc.id ? 'Sharing...' : (doc.sharedJudgeName ? 'Re-share' : 'Share to Judge')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {activeSidebar === 'rulings' && (
        <div className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="pegasus-table-head">
                {['Case', 'Judge', 'Date', 'Status', 'Content'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
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
                  <td colSpan={5} style={{ padding: '12px 14px', color: '#64748B' }}>No rulings found.</td>
                </tr>
              )}
              {!isRulingsLoading && rulings.map((item) => (
                <tr key={item.ruling_id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>CASE-{item.case_id} - {item.case_title}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{item.judge_name || '-'}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{toDisplayDate(item.ruling_date)}</td>
                  <td style={{ padding: '10px 14px', color: item.is_published ? '#166534' : '#92400E', fontWeight: 700 }}>
                    {item.is_published ? 'Published' : 'Draft'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                    {item.ruling_document_path ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadRulingDocument(item.ruling_id, item.ruling_document_name)}
                        style={{
                          border: `1px solid ${ADMIN_THEME.border}`,
                          backgroundColor: '#fff',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: ADMIN_THEME.accent,
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
        </div>
      )}
    </AdminPageShell>
  );
}
