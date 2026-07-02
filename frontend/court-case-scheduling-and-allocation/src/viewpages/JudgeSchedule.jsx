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

const calendarWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const parseAsLocalDate = (value) => {
  if (!value) return null;

  // Keep YYYY-MM-DD values in local time to avoid UTC date shifts.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const fullDateKey = (dateValue) => {
  const date = parseAsLocalDate(dateValue);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function JudgeSchedule() {
  const navigate = useNavigate();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => window.innerWidth < 980);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Schedule');
  const [view, setView] = useState('monthly');
  const [now, setNow] = useState(new Date());
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const activeMonthCount = useMemo(() => {
    if (!hearings.length) return 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    return hearings.filter((h) => monthKey(h.hearingDateRaw) === currentMonth).length;
  }, [hearings]);

  const monthlyCalendar = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const startDate = new Date(year, month, 1 - startOffset);

    const hearingsByDate = new Map();
    for (const item of hearings) {
      const key = fullDateKey(item.hearingDateRaw);
      if (!key) continue;
      if (!hearingsByDate.has(key)) hearingsByDate.set(key, []);
      hearingsByDate.get(key).push(item);
    }

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + index);
      const key = fullDateKey(cellDate);
      return {
        key,
        date: cellDate,
        inCurrentMonth: cellDate.getMonth() === month,
        hearings: hearingsByDate.get(key) || [],
      };
    });
  }, [hearings, now]);

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
          <div onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)', zIndex: 29 }} />
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
                Schedule
              </p>
              <button
                onClick={() => setIsSidebarOpen(false)}
                style={{ border: 'none', background: 'transparent', color: THEME.accent, fontSize: '18px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close sidebar"
              >
                ←
              </button>
            </div>

            {[
              { key: 'monthly', label: 'Monthly view' },
              { key: 'all', label: 'All hearings' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  setIsSidebarOpen(false);
                }}
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
        </>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <main style={{ flex: 1, padding: isNarrowScreen ? '16px' : '28px 32px', minWidth: 0 }}>
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

          {!isLoading && view === 'monthly' && (
            <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '10px', padding: '12px', maxWidth: '1040px', margin: '0 auto' }}>
              <p style={{ margin: '0 0 2px', color: '#334155', fontWeight: 700 }}>
                {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
              <p style={{ margin: '0 0 10px', color: '#64748B', fontSize: '12px' }}>
                Today: {now.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '13px' }}>You have {activeMonthCount} hearings in the current month.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {calendarWeekDays.map((dayName) => (
                  <div key={dayName} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569', padding: '4px 0' }}>
                    {dayName}
                  </div>
                ))}
                {monthlyCalendar.map((cell) => {
                  const isToday = fullDateKey(cell.date) === fullDateKey(now);
                  return (
                    <div
                      key={cell.key}
                      style={{
                        minHeight: '68px',
                        border: isToday ? `2px solid ${THEME.accent}` : `1px solid ${THEME.border}`,
                        borderRadius: '8px',
                        padding: '4px',
                        backgroundColor: cell.inCurrentMonth ? '#fff' : '#F8FAFC',
                        opacity: cell.inCurrentMonth ? 1 : 0.7,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: isToday ? THEME.accent : '#334155' }}>{cell.date.getDate()}</p>
                      {cell.hearings.slice(0, 2).map((h) => (
                        <p key={`${cell.key}-${h.id}-${h.time}`} style={{ margin: '3px 0 0', fontSize: '10px', color: statusColor(h.status), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.time} {h.id}
                        </p>
                      ))}
                      {cell.hearings.length > 2 && (
                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748B' }}>+{cell.hearings.length - 2} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
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
