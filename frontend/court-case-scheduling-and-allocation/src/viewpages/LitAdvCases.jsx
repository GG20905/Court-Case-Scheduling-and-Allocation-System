import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import LitigantPageShell, { LITIGANT_THEME } from '../components/LitigantPageShell';

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'scheduled') return 'Scheduled';
  return 'Active';
};

const toWorkflowState = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pending') return 'Requested';
  if (normalized === 'active' || normalized === 'scheduled') return 'Accepted';
  return 'Concluded';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LitAdvCases() {
  const [activeFilter, setActiveFilter] = useState('accepted');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadData = async () => {
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
        if (!hearingByCase.has(hearing.case_id)) {
          hearingByCase.set(hearing.case_id, hearing);
        }
      }

      setCaseRows(
        cases.map((item) => {
          const hearing = hearingByCase.get(item.case_id);
          return {
            caseId: item.case_id,
            id: `CASE-${item.case_id}`,
            title: item.case_title || 'Untitled case',
            type: item.case_category || 'General',
            status: toDisplayStatus(item.case_status),
            workflowState: toWorkflowState(item.case_status),
            nextHearing: formatDate(hearing?.hearing_date),
            judge: hearing?.judge_name || 'Not assigned',
          };
        })
      );
    } catch (error) {
      setFetchError(error.message || 'Failed to load cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCases = useMemo(() => {
    return caseRows.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        (activeFilter === 'all') ||
        (activeFilter === 'accepted' && item.workflowState === 'Accepted');

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, caseRows, searchTerm]);

  return (
    <LitigantPageShell
      activeNav="Cases"
      sidebarTitle="Litigant Panel"
      sidebarItems={[
        { key: 'accepted', label: 'Accepted cases' },
        { key: 'all', label: 'All my cases' },
      ]}
      activeSidebarKey={activeFilter}
      onSidebarSelect={setActiveFilter}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>My Cases</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}


      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by case number or title"
        style={{
          width: '100%',
          maxWidth: '420px',
          marginBottom: '16px',
          padding: '10px 12px',
          border: `1px solid ${LITIGANT_THEME.border}`,
          borderRadius: '8px',
          fontSize: '14px',
        }}
      />

      {isLoading && (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: `1px solid ${LITIGANT_THEME.border}`, padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>
        </div>
      )}

      {!isLoading && (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: `1px solid ${LITIGANT_THEME.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: LITIGANT_THEME.panel }}>
                {['Case No.', 'Title', 'Category', 'Judge', 'Next hearing', 'Status'].map((header) => (
                  <th key={header} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '16px 14px', color: '#64748B' }}>No cases found.</td>
                </tr>
              )}
              {filteredCases.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 14px', color: LITIGANT_THEME.accent, fontWeight: 600 }}>{item.id}</td>
                  <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.type}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.judge}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.nextHearing}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LitigantPageShell>
  );
}
