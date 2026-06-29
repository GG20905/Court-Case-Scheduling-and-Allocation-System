import { useEffect, useMemo, useState } from 'react';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';
import { authFetchJson } from '../utils/api';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const statusColor = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'cancelled' || normalized === 'postponed') return '#B91C1C';
  if (normalized === 'completed') return '#15803D';
  if (normalized === 'requested') return '#B45309';
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

export default function CourtadminSchedule() {
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

        setHearings(
          rows.map((item) => ({
            id: `CASE-${item.case_id}`,
            day: dayLabel(item.hearing_date),
            date: dateLabel(item.hearing_date),
            time: timeLabel(item.hearing_time),
            title: item.case_title || 'Untitled case',
            judge: item.judge_name || 'Not assigned',
            status: item.status || 'requested',
            rawDate: item.hearing_date,
          }))
        );
      } catch (error) {
        setFetchError(error.message || 'Failed to load hearings.');
      } finally {
        setIsLoading(false);
      }
    };

    loadHearings();
  }, []);

  const grouped = useMemo(() => days.map((day) => ({ day, items: hearings.filter((h) => h.day === day) })), [hearings]);

  const activeMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return hearings.filter((h) => monthKey(h.rawDate) === currentMonth).length;
  }, [hearings]);

  return (
    <AdminPageShell
      activeNav="Schedule"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'weekly', label: 'Weekly view' },
        { key: 'monthly', label: 'Monthly view' },
        { key: 'all', label: 'All hearings' },
      ]}
      activeSidebarKey={view}
      onSidebarSelect={setView}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Admin Schedule</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      {isLoading && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>
        </div>
      )}

      {!isLoading && view === 'weekly' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          {grouped.map((col) => (
            <div key={col.day} style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: ADMIN_THEME.panel, padding: '10px 12px', fontWeight: 700, color: '#334155' }}>{col.day}</div>
              <div style={{ padding: '10px' }}>
                {col.items.length === 0 && <p style={{ color: '#64748B', fontSize: '12px' }}>No hearings</p>}
                {col.items.map((h) => (
                  <div
                    key={h.id + h.time}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderLeft: `4px solid ${statusColor(h.status)}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                      backgroundColor: '#fff',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontWeight: 700 }}>{h.time} · {h.id}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>{h.title}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>{h.judge}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: statusColor(h.status), fontWeight: 700 }}>{h.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && view === 'monthly' && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#334155', fontWeight: 600 }}>Monthly summary</p>
          <p style={{ marginTop: '8px', color: '#64748B' }}>There are {activeMonthCount} hearings in the current month.</p>
        </div>
      )}

      {!isLoading && view === 'all' && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: ADMIN_THEME.panel }}>
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
                  <td style={{ padding: '12px 14px', color: ADMIN_THEME.accent, fontWeight: 600 }}>{h.id}</td>
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
    </AdminPageShell>
  );
}
