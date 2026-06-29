import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
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

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const statusColor = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'cancelled' || normalized === 'postponed') return '#B91C1C';
  if (normalized === 'completed') return '#15803D';
  return '#1A3A8C';
};

const dayLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Mon';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
};

const dateLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.getDate();
};

const timeLabel = (timeValue) => String(timeValue || '').slice(0, 5) || '-';

const monthKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function JudgeSchedule() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('Schedule');
  const [view, setView] = useState('weekly');
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const loadHearings = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        const result = await authFetchJson('/api/hearings');
        const rows = Array.isArray(result.data) ? result.data : [];

        const mapped = rows.map((item) => ({
          id: `CASE-${item.case_id}`,
          day: dayLabel(item.hearing_date),
          date: dateLabel(item.hearing_date),
          time: timeLabel(item.hearing_time),
          title: item.case_title || 'Untitled case',
          judge: item.judge_name || 'Assigned Judge',
          status: item.status || 'scheduled',
          hearingDateRaw: item.hearing_date,
        }));

        setHearings(mapped);
      } catch (error) {
        setFetchError(error.message || 'Failed to load hearings.');
      } finally {
        setIsLoading(false);
      }
    };

    loadHearings();
  }, []);

  const grouped = useMemo(() => {
    return days.map((day) => ({ day, items: hearings.filter((h) => h.day === day) }));
  }, [hearings]);

  const activeMonthCount = useMemo(() => {
    if (!hearings.length) return 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    return hearings.filter((h) => monthKey(h.hearingDateRaw) === currentMonth).length;
  }, [hearings]);

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      <Navbar />

      <nav
        style={{
          backgroundColor: THEME.navPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '0 24px',
          height: '60px',
        }}
      >
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
              padding: '8px 22px',
              fontSize: '14px',
              fontWeight: activeNav === item ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <aside
          style={{
            width: '190px',
            backgroundColor: THEME.panel,
            borderRight: `1px solid ${THEME.border}`,
            padding: '20px 0',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: THEME.accent,
              padding: '6px 20px 4px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Schedule
          </p>
          {[
            { key: 'weekly', label: 'Weekly view' },
            { key: 'monthly', label: 'Monthly view' },
            { key: 'all', label: 'All hearings' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                padding: '9px 20px',
                fontSize: '13.5px',
                color: view === item.key ? THEME.accent : '#475569',
                fontWeight: view === item.key ? 600 : 400,
                cursor: 'pointer',
                backgroundColor: view === item.key ? '#deeaf7' : 'transparent',
                borderLeft: view === item.key ? `3px solid ${THEME.accent}` : '3px solid transparent',
              }}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main style={{ flex: 1, padding: '28px 32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Schedule</h2>

          {fetchError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {fetchError}
            </div>
          )}

          {isLoading && (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', padding: '20px' }}>
              <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>
            </div>
          )}

          {!isLoading && view === 'weekly' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
              {grouped.map((col) => (
                <div
                  key={col.day}
                  style={{
                    backgroundColor: '#fff',
                    border: `1px solid ${THEME.border}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ backgroundColor: THEME.panel, padding: '10px 12px', fontWeight: 700, color: '#334155' }}>{col.day}</div>
                  <div style={{ padding: '10px' }}>
                    {col.items.length === 0 && <p style={{ color: '#64748B', fontSize: '12px' }}>No hearings</p>}
                    {col.items.map((h) => (
                      <div
                        key={h.id + h.time}
                        style={{
                          border: `1px solid ${THEME.border}`,
                          borderLeft: `4px solid ${statusColor(h.status)}`,
                          borderRadius: '8px',
                          padding: '8px 10px',
                          marginBottom: '8px',
                          backgroundColor: '#fff',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{h.time} · {h.id}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>{h.title}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: statusColor(h.status), fontWeight: 700 }}>{h.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && view === 'monthly' && (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', padding: '20px' }}>
              <p style={{ margin: 0, color: '#334155', fontWeight: 600 }}>Monthly summary</p>
              <p style={{ marginTop: '8px', color: '#64748B' }}>You have {activeMonthCount} hearings in the current month.</p>
            </div>
          )}

          {!isLoading && view === 'all' && (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: THEME.panel }}>
                    {['Case', 'Day', 'Time', 'Title', 'Judge', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hearings.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '16px 14px', color: '#64748B' }}>No hearings found.</td>
                    </tr>
                  )}
                  {hearings.map((h) => (
                    <tr key={h.id + h.time} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '12px 14px', color: THEME.accent, fontWeight: 600 }}>{h.id}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{h.day} {h.date}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{h.time}</td>
                      <td style={{ padding: '12px 14px', color: '#1E293B' }}>{h.title}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{h.judge}</td>
                      <td style={{ padding: '12px 14px', color: statusColor(h.status), fontWeight: 700 }}>{h.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
