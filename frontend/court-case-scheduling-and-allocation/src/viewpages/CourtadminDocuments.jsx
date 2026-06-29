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

  useEffect(() => {
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
            }));
          })
        );

        setDocuments(docsResults.flat());
      } catch (error) {
        setFetchError(error.message || 'Failed to load documents.');
      } finally {
        setIsLoading(false);
      }
    };

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

  return (
    <AdminPageShell
      activeNav="Documents"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'all', label: 'All documents' },
        { key: 'pleading', label: 'Pleadings' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'affidavit', label: 'Affidavits' },
        { key: 'ruling', label: 'Rulings' },
      ]}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>Admin Documents</h2>
      <p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>Documents are grouped by case for monthly review.</p>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
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
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading documents...</p>
        </div>
      )}

      {!isLoading && docsByCase.length === 0 && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>No documents found for this filter.</p>
        </div>
      )}

      {!isLoading && docsByCase.map((group) => (
        <div
          key={group.caseId}
          style={{
            backgroundColor: '#fff',
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: '10px',
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
              <tr style={{ backgroundColor: '#F8FAFC' }}>
                {['Document', 'Type', 'Uploaded by', 'Date', 'Actions'].map((h) => (
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
                  <td style={{ padding: '10px 14px' }}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </AdminPageShell>
  );
}
