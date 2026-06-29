import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';

const toInt = (value) => Number.parseInt(value, 10) || 0;
const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => String(value || '').slice(0, 5) || '-';

export default function AdminJudgeDashboard() {
  const [activeSidebar, setActiveSidebar] = useState('Overview');
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [judges, setJudges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setFetchError('');
      try {
        const [summaryRes, casesRes, hearingsRes, judgesRes] = await Promise.all([
          authFetchJson('/api/dashboard/summary'),
          authFetchJson('/api/cases'),
          authFetchJson('/api/hearings'),
          authFetchJson('/api/dashboard/judges'),
        ]);

        setSummary(summaryRes.data || null);
        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
        setHearings(Array.isArray(hearingsRes.data) ? hearingsRes.data : []);
        setJudges(Array.isArray(judgesRes.data) ? judgesRes.data : []);
      } catch (error) {
        setFetchError(error.message || 'Failed to load admin dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const stats = useMemo(() => {
    return {
      totalCases: toInt(summary?.cases?.total_cases),
      hearingsToday: hearings.filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey()).length,
      delayedCases: toInt(summary?.cases?.pending),
      concludedCases: toInt(summary?.cases?.closed),
      pendingJudgeResponses: toInt(summary?.assignments?.pending_judge_responses),
    };
  }, [summary, hearings]);

  const recentCases = useMemo(() => {
    const sorted = [...cases].sort((a, b) => {
      const aDate = new Date(a.filing_date || a.created_at || 0).getTime();
      const bDate = new Date(b.filing_date || b.created_at || 0).getTime();
      return bDate - aDate;
    });

    return sorted.slice(0, 6).map((item) => ({
      id: `CASE-${item.case_id}`,
      title: item.case_title || 'Untitled case',
      status: String(item.case_status || 'pending').toLowerCase(),
      date: formatDate(item.filing_date || item.created_at),
    }));
  }, [cases]);

  const todaysHearings = useMemo(() => {
    return hearings
      .filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey())
      .slice(0, 6)
      .map((item) => ({
        time: formatTime(item.hearing_time),
        caseLabel: `CASE-${item.case_id} - ${item.case_title || 'Untitled case'}`,
        judge: item.judge_name || 'Not assigned',
        status: item.status || 'requested',
      }));
  }, [hearings]);

  const sidebarItems = [
    { key: 'Overview', label: 'Overview' },
    { key: 'Users', label: 'Users' },
    { key: 'Reports', label: 'Reports' },
  ];

  return (
    <AdminPageShell
      activeNav="Dashboard"
      sidebarTitle="Admin Panel"
      sidebarItems={sidebarItems}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Admin Dashboard</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { title: 'Total cases', value: stats.totalCases },
          { title: 'Hearings today', value: stats.hearingsToday },
          { title: 'Delayed cases', value: stats.delayedCases },
          { title: 'Concluded cases', value: stats.concludedCases },
          { title: 'Pending judge responses', value: stats.pendingJudgeResponses },
        ].map((card) => (
          <div key={card.title} style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
            <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <section style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Recent Cases</h3>
          <div style={{ marginTop: '10px' }}>
            {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>}
            {!isLoading && recentCases.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent cases.</p>}
            {!isLoading && recentCases.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: ADMIN_THEME.accent }}>{item.id}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.status} · {item.date}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Today Hearings</h3>
          <div style={{ marginTop: '10px' }}>
            {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>}
            {!isLoading && todaysHearings.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No hearings for today.</p>}
            {!isLoading && todaysHearings.map((item) => (
              <div key={item.caseLabel + item.time} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: ADMIN_THEME.accent }}>{item.time}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.caseLabel}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.judge} · {item.status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ marginTop: '12px', backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Judge Workload</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: ADMIN_THEME.panel }}>
              {['Judge', 'Station', 'Email', 'Active cases'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#334155' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!isLoading && judges.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '12px', color: '#64748B' }}>No judges found.</td>
              </tr>
            )}
            {judges.map((judge) => (
              <tr key={judge.judge_id} style={{ borderTop: '1px solid #E2E8F0' }}>
                <td style={{ padding: '10px 12px', color: '#1E293B' }}>{judge.full_name}</td>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{judge.court_station}</td>
                <td style={{ padding: '10px 12px', color: '#475569' }}>{judge.email}</td>
                <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 700 }}>{toInt(judge.active_cases)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminPageShell>
  );
}
