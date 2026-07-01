import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProfileMenu from '../components/ProfileMenu';
import { authFetchJson } from '../utils/api';

const navItems = ['Dashboard', 'Cases', 'Schedule', 'Documents'];

const THEME = {
  pageBg: '#f5f7fc',
  navPrimary: '#0d1652',
  navText: '#d2ddff',
  accent: '#1a3a8c',
  panel: '#eef2fa',
  border: '#a8bfe0',
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => String(value || '').slice(0, 5) || '-';

export default function Judge() {
  const navigate = useNavigate();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => window.innerWidth < 980);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      <Navbar />

      <nav
        style={{
          backgroundColor: THEME.navPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: isNarrowScreen ? '8px 12px' : '0 24px',
          minHeight: '60px',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            border: `1px solid ${THEME.border}`,
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: THEME.accent,
            fontSize: '13px',
            fontWeight: 700,
            padding: '7px 10px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ☰ 
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => {
                setActiveNav(item);
                if (item === 'Dashboard') navigate('/dashboard/judge');
                if (item === 'Cases') navigate('/dashboard/judge/cases');
                if (item === 'Schedule') navigate('/dashboard/judge/schedule');
                if (item === 'Documents') navigate('/dashboard/judge/documents');
              }}
              style={{
                background: activeNav === item ? THEME.accent : 'transparent',
                color: activeNav === item ? '#fff' : THEME.navText,
                border: 'none',
                borderRadius: '6px',
                padding: isNarrowScreen ? '8px 14px' : '8px 22px',
                fontSize: '14px',
                fontWeight: activeNav === item ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={{ flexShrink: 0 }}>
          <ProfileMenu accentColor={THEME.accent} borderColor={THEME.border} />
        </div>
      </nav>

      {isSidebarOpen && (
        <>
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)', zIndex: 29 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: isNarrowScreen ? '78%' : '260px',
              maxWidth: '320px',
              backgroundColor: THEME.panel,
              borderRight: `1px solid ${THEME.border}`,
              padding: '14px 0',
              zIndex: 30,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 14px 10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: THEME.accent, letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                Judge Panel
              </p>
              <button
                onClick={() => setIsSidebarOpen(false)}
                style={{ border: 'none', background: 'transparent', color: THEME.accent, fontSize: '18px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close sidebar"
              >
                ←
              </button>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{
                display: 'block',
                width: '100%',
                background: '#deeaf7',
                border: 'none',
                textAlign: 'left',
                padding: '9px 20px',
                fontSize: '13.5px',
                color: THEME.accent,
                fontWeight: 600,
                borderLeft: `3px solid ${THEME.accent}`,
                cursor: 'pointer',
              }}
            >
              Overview
            </button>
          </aside>
        </>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <main style={{ flex: 1, padding: isNarrowScreen ? '16px' : '28px 32px', minWidth: 0 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Dashboard</h2>

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
              { title: 'Delayed cases', value: stats.delayedCases },
              { title: 'Concluded cases', value: stats.concludedCases },
              { title: 'Urgent cases', value: stats.urgentCases },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  backgroundColor: '#fff',
                  border: `1px solid ${THEME.border}`,
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
                border: `1px solid ${THEME.border}`,
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Recent Cases</h3>
              <div style={{ marginTop: '10px' }}>
                {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>}
                {!isLoading && recentCases.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent cases.</p>}
                {!isLoading && recentCases.map((item) => (
                  <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: THEME.accent }}>{item.id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.type} · {item.date}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              style={{
                backgroundColor: '#fff',
                border: `1px solid ${THEME.border}`,
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', color: '#1E2A45' }}>Today Hearings</h3>
              <div style={{ marginTop: '10px' }}>
                {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>}
                {!isLoading && todaysHearings.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No hearings for today.</p>}
                {!isLoading && todaysHearings.map((item) => (
                  <div key={item.id + item.time} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: THEME.accent }}>{item.time}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.title}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
