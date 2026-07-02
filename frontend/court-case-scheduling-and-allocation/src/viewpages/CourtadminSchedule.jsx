import { useEffect, useMemo, useState } from 'react';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';
import { authFetchJson } from '../utils/api';

const calendarWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default function CourtadminSchedule() {
  const [view, setView] = useState('requests');
  const [now, setNow] = useState(new Date());
  const [hearings, setHearings] = useState([]);
  const [judges, setJudges] = useState([]);
  const [selectedJudgeByHearing, setSelectedJudgeByHearing] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionBusyHearingId, setActionBusyHearingId] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setFetchError('');

    try {
      const [hearingsRes, judgesRes] = await Promise.all([
        authFetchJson('/api/hearings'),
        authFetchJson('/api/dashboard/judges'),
      ]);

      const rows = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];
      const judgeRows = Array.isArray(judgesRes.data) ? judgesRes.data : [];

      const mappedHearings = rows.map((item) => ({
        hearingId: item.hearing_id,
        caseId: item.case_id,
        id: `CASE-${item.case_id}`,
        day: dayLabel(item.hearing_date),
        date: dateLabel(item.hearing_date),
        time: timeLabel(item.hearing_time),
        title: item.case_title || 'Untitled case',
        judge: item.judge_name || 'Not assigned',
        status: item.status || 'requested',
        rawDate: item.hearing_date,
        createdAt: item.created_at,
      }));

      setHearings(mappedHearings);
      setJudges(
        judgeRows.map((judge) => ({
          id: judge.judge_id,
          name: judge.full_name || `Judge ${judge.judge_id}`,
        }))
      );

      if (judgeRows.length > 0) {
        const defaultJudgeId = String(judgeRows[0].judge_id);
        setSelectedJudgeByHearing((prev) => {
          const next = { ...prev };
          mappedHearings
            .filter((h) => String(h.status).toLowerCase() === 'requested')
            .forEach((h) => {
              if (!next[h.hearingId]) {
                next[h.hearingId] = defaultJudgeId;
              }
            });
          return next;
        });
      }
    } catch (error) {
      setFetchError(error.message || 'Failed to load hearings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleApprove = async (hearingId) => {
    setActionError('');
    setActionMessage('');

    const judgeId = selectedJudgeByHearing[hearingId];
    if (!judgeId) {
      setActionError('Please select a judge before approving.');
      return;
    }

    setActionBusyHearingId(hearingId);
    try {
      await authFetchJson(`/api/hearings/${hearingId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judge_id: Number(judgeId) }),
      });
      setActionMessage('Hearing request approved.');
      await loadData();
    } catch (error) {
      setActionError(error.message || 'Failed to approve hearing request.');
    } finally {
      setActionBusyHearingId(null);
    }
  };

  const handleReject = async (hearingId) => {
    setActionError('');
    setActionMessage('');

    if (!hearingId) {
      setActionError('Unable to reject hearing: missing hearing id.');
      return;
    }

    setActionBusyHearingId(hearingId);

    try {
      try {
        await authFetchJson(`/api/hearings/${hearingId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Rejected by court administrator.' }),
        });
      } catch (error) {
        if (!String(error.message || '').includes('404')) {
          throw error;
        }

        // Backward compatibility: fallback for servers that only expose /status.
        await authFetchJson(`/api/hearings/${hearingId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        });
      }

      setActionMessage('Hearing request rejected.');
      await loadData();
    } catch (error) {
      setActionError(error.message || 'Failed to reject hearing request.');
    } finally {
      setActionBusyHearingId(null);
    }
  };

  const activeMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return hearings.filter((h) => monthKey(h.rawDate) === currentMonth).length;
  }, [hearings]);

  const monthlyCalendar = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const startDate = new Date(year, month, 1 - startOffset);

    const hearingsByDate = new Map();
    for (const item of hearings) {
      const key = fullDateKey(item.rawDate);
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

  const pendingRequests = useMemo(
    () => hearings
      .filter((h) => String(h.status || '').toLowerCase() === 'requested')
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [hearings]
  );

  return (
    <AdminPageShell
      activeNav="Schedule"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'requests', label: 'Hearing requests' },
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

      {actionError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
          {actionMessage}
        </div>
      )}

      {isLoading && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>
        </div>
      )}

      {!isLoading && view === 'requests' && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: ADMIN_THEME.panel }}>
                {['Case', 'Date', 'Time', 'Title', 'Assign Judge', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '16px 14px', color: '#64748B' }}>No pending hearing requests.</td>
                </tr>
              )}
              {pendingRequests.map((h) => {
                const isBusy = actionBusyHearingId === h.hearingId;
                return (
                  <tr key={h.hearingId} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px 14px', color: ADMIN_THEME.accent, fontWeight: 600 }}>{h.id}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{h.day} {h.date}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{h.time}</td>
                    <td style={{ padding: '12px 14px', color: '#1E293B' }}>{h.title}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={selectedJudgeByHearing[h.hearingId] || ''}
                        onChange={(e) => setSelectedJudgeByHearing((prev) => ({ ...prev, [h.hearingId]: e.target.value }))}
                        disabled={isBusy || judges.length === 0}
                        style={{ width: '100%', minWidth: '180px', padding: '8px 9px', borderRadius: '8px', border: `1px solid ${ADMIN_THEME.border}` }}
                      >
                        {judges.length === 0 && <option value="">No judges available</option>}
                        {judges.map((judge) => (
                          <option key={judge.id} value={String(judge.id)}>{judge.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApprove(h.hearingId)}
                          disabled={isBusy || judges.length === 0}
                          style={{
                            border: 'none',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            fontSize: '12px',
                            color: '#fff',
                            backgroundColor: '#15803D',
                            cursor: isBusy || judges.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: isBusy || judges.length === 0 ? 0.7 : 1,
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(h.hearingId)}
                          disabled={isBusy}
                          style={{
                            border: 'none',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            fontSize: '12px',
                            color: '#fff',
                            backgroundColor: '#B91C1C',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            opacity: isBusy ? 0.7 : 1,
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && view === 'monthly' && (
        <div style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '12px', maxWidth: '1040px', margin: '0 auto' }}>
          <p style={{ margin: '0 0 2px', color: '#334155', fontWeight: 700 }}>
            {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
          <p style={{ margin: '0 0 10px', color: '#64748B', fontSize: '12px' }}>
            Today: {now.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '13px' }}>There are {activeMonthCount} hearings in the current month.</p>
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
                    border: isToday ? `2px solid ${ADMIN_THEME.accent}` : `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: '8px',
                    padding: '4px',
                    backgroundColor: cell.inCurrentMonth ? '#fff' : '#F8FAFC',
                    opacity: cell.inCurrentMonth ? 1 : 0.7,
                  }}
                >
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: isToday ? ADMIN_THEME.accent : '#334155' }}>{cell.date.getDate()}</p>
                  {cell.hearings.slice(0, 2).map((h) => (
                    <p key={`${cell.key}-${h.hearingId}-${h.time}`} style={{ margin: '3px 0 0', fontSize: '10px', color: statusColor(h.status), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                <tr key={h.hearingId} style={{ borderTop: '1px solid #E2E8F0' }}>
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
