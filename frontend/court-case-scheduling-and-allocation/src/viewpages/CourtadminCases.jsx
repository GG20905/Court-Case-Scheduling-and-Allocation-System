import { useEffect, useMemo, useState } from 'react';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';
import { authFetchJson } from '../utils/api';

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'scheduled') return 'Scheduled';
  if (normalized === 'pending') return 'Pending';
  return 'Active';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function CourtadminCases() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const loadCases = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        const [casesRes, hearingsRes] = await Promise.all([
          authFetchJson('/api/cases'),
          authFetchJson('/api/hearings'),
        ]);

        const cases = Array.isArray(casesRes.data) ? casesRes.data : [];
        const hearings = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];

        const hearingByCase = new Map();
        for (const hearing of hearings) {
          if (!hearingByCase.has(hearing.case_id)) hearingByCase.set(hearing.case_id, hearing);
        }

        setCaseRows(
          cases.map((item) => {
            const hearing = hearingByCase.get(item.case_id);
            return {
              id: `CASE-${item.case_id}`,
              title: item.case_title || 'Untitled case',
              category: item.case_category || 'General',
              submittedBy: item.submitted_by || 'Unknown',
              status: toDisplayStatus(item.case_status),
              priority: String(item.priority || 'normal'),
              filedOn: formatDate(item.filing_date || item.created_at),
              nextHearing: formatDate(hearing?.hearing_date),
            };
          })
        );
      } catch (error) {
        setFetchError(error.message || 'Failed to load cases.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCases();
  }, []);

  const filteredRows = useMemo(() => {
    return caseRows.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        item.id.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.submittedBy.toLowerCase().includes(term);

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'pending' && item.status === 'Pending') ||
        (activeFilter === 'active' && item.status === 'Active') ||
        (activeFilter === 'scheduled' && item.status === 'Scheduled') ||
        (activeFilter === 'concluded' && item.status === 'Concluded');

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, caseRows, searchTerm]);

  return (
    <AdminPageShell
      activeNav="Cases"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'all', label: 'All cases' },
        { key: 'pending', label: 'Pending cases' },
        { key: 'active', label: 'Active cases' },
        { key: 'scheduled', label: 'Scheduled cases' },
        { key: 'concluded', label: 'Concluded cases' },
      ]}
      activeSidebarKey={activeFilter}
      onSidebarSelect={setActiveFilter}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Admin Cases</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by case no, title, or participant"
        style={{
          width: '100%',
          maxWidth: '450px',
          marginBottom: '16px',
          padding: '10px 12px',
          border: `1px solid ${ADMIN_THEME.border}`,
          borderRadius: '8px',
          fontSize: '14px',
        }}
      />

      {isLoading && (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: `1px solid ${ADMIN_THEME.border}`, padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>
        </div>
      )}

      {!isLoading && (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: `1px solid ${ADMIN_THEME.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: ADMIN_THEME.panel }}>
                {['Case No.', 'Title', 'Category', 'Participant', 'Filed on', 'Next hearing', 'Priority', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '16px 14px', color: '#64748B' }}>No cases found.</td>
                </tr>
              )}
              {filteredRows.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 14px', color: ADMIN_THEME.accent, fontWeight: 700 }}>{item.id}</td>
                  <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.category}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.submittedBy}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.filedOn}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.nextHearing}</td>
                  <td style={{ padding: '12px 14px', color: '#475569', textTransform: 'capitalize' }}>{item.priority}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
