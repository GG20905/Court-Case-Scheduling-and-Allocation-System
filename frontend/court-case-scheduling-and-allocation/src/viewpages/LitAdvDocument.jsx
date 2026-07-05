import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';
import LitigantPageShell, { LITIGANT_THEME } from '../components/LitigantPageShell';

const sidebarItems = [
  { key: 'upload', label: 'Upload document' },
];

const DOCUMENT_TYPES = ['Pleading', 'Evidence', 'Affidavit', 'Motion', 'Order', 'Ruling', 'Other'];

const toMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getDisplayDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export default function LitAdvDocument() {
  const [activeSidebar, setActiveSidebar] = useState('upload');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({
    caseId: '',
    documentType: 'Pleading',
    documentTitle: '',
    description: '',
  });
  const [file, setFile] = useState(null);

  const fetchCasesAndDocuments = async () => {
    const casesRes = await authFetchJson('/api/cases');
    const caseList = Array.isArray(casesRes.data) ? casesRes.data : [];

    const docsResults = await Promise.all(
      caseList.map(async (caseItem) => {
        const res = await authFetchJson(`/api/cases/${caseItem.case_id}/documents`);
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map((doc) => ({
          id: doc.document_id,
          caseId: String(caseItem.case_id),
          caseTitle: caseItem.case_title || `Case ${caseItem.case_id}`,
          documentName: doc.document_name || 'Unnamed document',
          documentType: doc.document_type || 'Unspecified',
          uploadedAt: doc.created_at || doc.upload_date,
          uploadedBy: doc.uploaded_by_name || 'Unknown uploader',
        }));
      })
    );

    setCases(caseList);
    setDocuments(docsResults.flat());

    if (!form.caseId && caseList.length > 0) {
      setForm((prev) => ({ ...prev, caseId: String(caseList[0].case_id) }));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        await fetchCasesAndDocuments();
      } catch (error) {
        setFetchError(error.message || 'Failed to load documents.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const sameMonth = toMonthKey(doc.uploadedAt) === monthFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        doc.caseId.toLowerCase().includes(term) ||
        doc.caseTitle.toLowerCase().includes(term) ||
        doc.documentName.toLowerCase().includes(term);

      return sameMonth && matchesSearch;
    });
  }, [documents, monthFilter, searchTerm]);

  const docsByCase = useMemo(() => {
    const grouped = new Map();

    for (const doc of filteredDocs) {
      if (!grouped.has(doc.caseId)) {
        grouped.set(doc.caseId, {
          caseId: doc.caseId,
          caseTitle: doc.caseTitle,
          docs: [],
        });
      }

      grouped.get(doc.caseId).docs.push(doc);
    }

    return Array.from(grouped.values());
  }, [filteredDocs]);

  const recentDocs = useMemo(() => {
    const sorted = [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return sorted.slice(0, 5);
  }, [documents]);

  const handleUpload = async () => {
    setSubmitMessage('');
    setSubmitError('');

    if (!form.caseId) {
      setSubmitError('Please select a linked case.');
      return;
    }

    if (!file) {
      setSubmitError('Please choose a PDF file.');
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setSubmitError('Session expired. Please login again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('document', file);
      payload.append('document_type', form.documentType);

      const response = await fetch(`/api/cases/${form.caseId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed.');
      }

      setSubmitMessage('Document uploaded successfully.');
      setFile(null);
      setForm((prev) => ({ ...prev, documentTitle: '', description: '' }));

      await fetchCasesAndDocuments();
    } catch (error) {
      setSubmitError(error.message || 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (documentId, fallbackName) => {
    const token = getStoredAuthToken();
    if (!token) {
      setSubmitError('Session expired. Please login again.');
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download document.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setSubmitError(error.message || 'Failed to download document.');
    }
  };

  return (
    <LitigantPageShell
      activeNav="Documents"
      sidebarTitle="Litigant Panel"
      sidebarItems={sidebarItems}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
    >
          <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '8px' }}>My Documents</h2>
          <p style={{ color: '#64748B', marginTop: 0, marginBottom: '16px' }}>
            Upload and track case documents by month.
          </p>

          {fetchError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {fetchError}
            </div>
          )}

          {submitError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {submitError}
            </div>
          )}

          {submitMessage && (
            <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
              {submitMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>
            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '16px' }}>
              <h3 className="pegasus-section-title" style={{ margin: '0 0 12px', fontSize: '16px', color: '#1E2A45' }}>Upload document</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: '#475569' }}>
                  Linked case
                  <select
                    value={form.caseId}
                    onChange={(e) => setForm((prev) => ({ ...prev, caseId: e.target.value }))}
                    style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
                  >
                    {cases.length === 0 && <option value="">No cases available</option>}
                    {cases.map((caseItem) => (
                      <option key={caseItem.case_id} value={String(caseItem.case_id)}>
                        CASE-{caseItem.case_id} - {caseItem.case_title}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: '12px', color: '#475569' }}>
                  Document type
                  <select
                    value={form.documentType}
                    onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value }))}
                    style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                Document title (optional)
                <input
                  value={form.documentTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, documentTitle: e.target.value }))}
                  placeholder="Title shown for your own notes"
                  style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                Description / notes (optional)
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}`, resize: 'vertical' }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                PDF file (max 10 MB)
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ display: 'block', marginTop: '6px' }}
                />
              </label>

              {file && <p style={{ marginTop: 0, marginBottom: '10px', color: '#334155', fontSize: '13px' }}>Selected file: {file.name}</p>}

              <button
                onClick={handleUpload}
                disabled={isSubmitting || isLoading}
                style={{
                  backgroundColor: LITIGANT_THEME.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  cursor: isSubmitting || isLoading ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || isLoading ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Uploading...' : 'Submit document'}
              </button>
            </section>

            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '16px' }}>
              <h3 className="pegasus-section-title" style={{ margin: '0 0 12px', fontSize: '16px', color: '#1E2A45' }}>Recently uploaded</h3>
              {recentDocs.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent uploads.</p>}
              {recentDocs.map((doc) => (
                <div key={doc.id} style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '10px' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{doc.documentName}</p>
                  <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '12px' }}>CASE-{doc.caseId} - {doc.caseTitle}</p>
                  <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '12px' }}>{doc.documentType} - {getDisplayDate(doc.uploadedAt)}</p>
                </div>
              ))}
            </section>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by case or document name"
              style={{ width: '100%', maxWidth: '380px', padding: '10px 12px', border: `1px solid ${LITIGANT_THEME.border}`, borderRadius: '8px' }}
            />
          </div>

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
              <div style={{ backgroundColor: LITIGANT_THEME.panel, padding: '10px 14px', borderBottom: `1px solid ${LITIGANT_THEME.border}` }}>
                <p style={{ margin: 0, color: LITIGANT_THEME.accent, fontWeight: 700 }}>CASE-{group.caseId}</p>
                <p style={{ margin: '2px 0 0', color: '#334155', fontSize: '13px' }}>{group.caseTitle}</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="pegasus-table-head">
                    {['Document', 'Type', 'Uploaded by', 'Date', 'Actions'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.docs.map((doc) => (
                    <tr key={doc.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', color: '#1E293B', fontWeight: 600 }}>{doc.documentName}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.documentType}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{doc.uploadedBy}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{getDisplayDate(doc.uploadedAt)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => handleDownload(doc.id, doc.documentName)}
                          style={{
                            border: `1px solid ${LITIGANT_THEME.border}`,
                            backgroundColor: '#fff',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: LITIGANT_THEME.accent,
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
    </LitigantPageShell>
  );
}
