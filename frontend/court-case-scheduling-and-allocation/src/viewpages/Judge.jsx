import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import JudgePageShell, { JUDGE_THEME } from '../components/JudgePageShell';

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => String(value || '').slice(0, 5) || '-';

export default function Judge() {
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        const [casesRes, hearingsRes] = await Promise.all([
          authFetchJson('/api/cases'),
          authFetchJson('/api/hearings'),
        ]);

        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
        setHearings(Array.isArray(hearingsRes.data) ? hearingsRes.data : []);
      } catch (error) {
        setFetchError(error.message || 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const stats = useMemo(() => {
    const totalCases = cases.length;
    const concludedCases = cases.filter((item) => {
      const status = String(item.case_status || '').toLowerCase();
      return status === 'closed' || status === 'dismissed';
    }).length;

    const delayedCases = cases.filter((item) => String(item.case_status || '').toLowerCase() === 'pending').length;
    const urgentCases = cases.filter((item) => {
      const priority = String(item.priority || '').toLowerCase();
      return priority === 'urgent' || priority === 'high';
    }).length;

    const hearingsToday = hearings.filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey()).length;

    return {
      totalCases,
      hearingsToday,
      delayedCases,
      concludedCases,
      urgentCases,
    };
  }, [cases, hearings]);

  const todaysHearings = useMemo(() => {
    return hearings
      .filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey())
      .slice(0, 5)
      .map((item) => ({
        id: `CASE-${item.case_id}`,
        time: formatTime(item.hearing_time),
        title: item.case_title || 'Untitled case',
      }));
  }, [hearings]);

  const recentCases = useMemo(() => {
    const sorted = [...cases].sort((a, b) => {
      const aDate = new Date(a.filing_date || a.created_at || 0).getTime();
      const bDate = new Date(b.filing_date || b.created_at || 0).getTime();
      return bDate - aDate;
    });

    return sorted.slice(0, 5).map((item) => ({
      id: `CASE-${item.case_id}`,
      title: item.case_title || 'Untitled case',
      type: item.case_category || 'General',
      date: formatDate(item.filing_date || item.created_at),
    }));
  }, [cases]);

  return (
    <JudgePageShell
      activeNav="Dashboard"
      sidebarTitle="Judge Panel"
      sidebarItems={[{ key: 'overview', label: 'Overview' }]}
      activeSidebarKey="overview"
      onSidebarSelect={() => {}}
    >
          <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Dashboard</h2>

          {fetchError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {fetchError}
            </div>
          )}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {[
              { title: 'Total cases', value: stats.totalCases },
              { title: 'Hearings today', value: stats.hearingsToday },
              { title: 'Urgent cases', value: stats.urgentCases },
            ].map((card) => (
              <div
                className="pegasus-card"
                key={card.title}
                style={{
                  borderRadius: '12px',
                  padding: '12px 14px',
                }}
              >
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
              </div>
            ))}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', width: '100%' }}>
            <section
              className="pegasus-block"
              style={{
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Recent Cases</h3>
              <div style={{ marginTop: '10px' }}>
                {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>}
                {!isLoading && recentCases.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent cases.</p>}
                {!isLoading && recentCases.map((item) => (
                  <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: JUDGE_THEME.accent }}>{item.id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.type} · {item.date}</p>
                  </div>
                ))}
              </div>
            </section>

          </div>
    </JudgePageShell>
  );
}
