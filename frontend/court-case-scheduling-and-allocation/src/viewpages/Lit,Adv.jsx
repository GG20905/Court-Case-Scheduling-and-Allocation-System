import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetchJson } from '../utils/api';
import LitigantPageShell, { LITIGANT_THEME } from '../components/LitigantPageShell';

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => String(value || '').slice(0, 5) || '-';

export default function LitigantDashboard() {
  const navigate = useNavigate();
  const [activeSidebar, setActiveSidebar] = useState('overview');
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const handleSidebarSelect = (key) => {
    setActiveSidebar(key);
    if (key === 'my-cases') navigate('/dashboard/litigant/cases');
    if (key === 'my-hearings') navigate('/dashboard/litigant/schedule');
    if (key === 'my-documents') navigate('/dashboard/litigant/documents');
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        const [casesRes, hearingsRes] = await Promise.all([
          authFetchJson('/api/cases'),
          authFetchJson('/api/hearings'),
        ]);

        const casesData = Array.isArray(casesRes.data) ? casesRes.data : [];
        const hearingsData = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];

        setCases(casesData);
        setHearings(hearingsData);

        const docsByCase = await Promise.all(
          casesData.map(async (item) => {
            const result = await authFetchJson(`/api/cases/${item.case_id}/documents`);
            const docs = Array.isArray(result.data) ? result.data : [];
            return docs.length;
          })
        );

        setDocumentsCount(docsByCase.reduce((total, current) => total + current, 0));
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
    const hearingsToday = hearings.filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey()).length;
    const requestedHearings = hearings.filter((item) => String(item.status || '').toLowerCase() === 'requested').length;
    const concludedCases = cases.filter((item) => {
      const status = String(item.case_status || '').toLowerCase();
      return status === 'closed' || status === 'dismissed';
    }).length;

    return {
      totalCases,
      hearingsToday,
      requestedHearings,
      concludedCases,
      documentsCount,
    };
  }, [cases, hearings, documentsCount]);

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
      status: String(item.case_status || 'pending').toLowerCase(),
    }));
  }, [cases]);

  return (
    <LitigantPageShell
      activeNav="Dashboard"
      sidebarTitle="Litigant Panel"
      sidebarItems={[
        { key: 'overview', label: 'Overview' },
      ]}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={handleSidebarSelect}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Litigant Dashboard</h2>

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
          { title: 'My cases', value: stats.totalCases },
          { title: 'Hearings today', value: stats.hearingsToday },
          { title: 'Requested hearings', value: stats.requestedHearings },
          { title: 'Concluded cases', value: stats.concludedCases },
          { title: 'My documents', value: stats.documentsCount },
        ].map((card) => (
          <div
            key={card.title}
            style={{
              backgroundColor: '#fff',
              border: `1px solid ${LITIGANT_THEME.border}`,
              borderRadius: '10px',
              padding: '12px 14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
            <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <section
          style={{
            backgroundColor: '#fff',
            border: `1px solid ${LITIGANT_THEME.border}`,
            borderRadius: '10px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Recent Cases</h3>
            <span onClick={() => navigate('/dashboard/litigant/cases')} style={{ fontSize: '12px', color: LITIGANT_THEME.accent, cursor: 'pointer' }}>
              View all →
            </span>
          </div>
          <div style={{ marginTop: '10px' }}>
            {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>}
            {!isLoading && recentCases.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent cases.</p>}
            {!isLoading && recentCases.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: LITIGANT_THEME.accent }}>{item.id}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.type} · {item.date}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            backgroundColor: '#fff',
            border: `1px solid ${LITIGANT_THEME.border}`,
            borderRadius: '10px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Today Hearings</h3>
            <button
              onClick={() => navigate('/dashboard/litigant/schedule')}
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
              Request hearing
            </button>
          </div>
          <div style={{ marginTop: '10px' }}>
            {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>}
            {!isLoading && todaysHearings.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No hearings for today.</p>}
            {!isLoading && todaysHearings.map((item) => (
              <div key={item.id + item.time} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: LITIGANT_THEME.accent }}>{item.time}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.id}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LitigantPageShell>
  );
}
