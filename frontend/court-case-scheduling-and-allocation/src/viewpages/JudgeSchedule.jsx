import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import JudgePageShell, { JUDGE_THEME } from '../components/JudgePageShell';

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
  const [view, setView] = useState('monthly');
  const [now, setNow] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [modeByHearingId, setModeByHearingId] = useState({});
  const [meetingLinkByHearingId, setMeetingLinkByHearingId] = useState({});
  const [savedModeByHearingId, setSavedModeByHearingId] = useState({});
  const [savedMeetingLinkByHearingId, setSavedMeetingLinkByHearingId] = useState({});
  const [busyHearingId, setBusyHearingId] = useState(null);

  const normalizeMode = (value, meetingLinkValue) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'physical' || normalized === 'virtual') return normalized;
    return String(meetingLinkValue || '').trim() ? 'virtual' : 'physical';
  };

  useEffect(() => {
    const loadHearings = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        const result = await authFetchJson('/api/hearings');
        const rows = Array.isArray(result.data) ? result.data : [];

        const mapped = rows.map((item) => ({
          hearingId: item.hearing_id,
          caseId: item.case_id,
          id: `CASE-${item.case_id}`,
          day: dayLabel(item.hearing_date),
          date: dateLabel(item.hearing_date),
          time: timeLabel(item.hearing_time),
          title: item.case_title || 'Untitled case',
          judge: item.judge_name || 'Assigned Judge',
          status: item.status || 'scheduled',
          hearingDateRaw: item.hearing_date,
          hearingMode: normalizeMode(item.hearing_mode, item.meeting_link),
          meetingLink: String(item.meeting_link || ''),
          assignmentStatus: String(item.assignment_status || '').toLowerCase(),
        }));

        setHearings(mapped);

        const nextModes = {};
        const nextMeetingLinks = {};
        mapped.forEach((item) => {
          nextModes[item.hearingId] = item.hearingMode;
          nextMeetingLinks[item.hearingId] = item.meetingLink;
        });
        setModeByHearingId(nextModes);
        setSavedModeByHearingId(nextModes);
        setMeetingLinkByHearingId(nextMeetingLinks);
        setSavedMeetingLinkByHearingId(nextMeetingLinks);
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

  const handleSaveHearingMode = async (item) => {
    const selectedMode = normalizeMode(modeByHearingId[item.hearingId], meetingLinkByHearingId[item.hearingId]);
    const selectedLink = String(meetingLinkByHearingId[item.hearingId] || '').trim();
    const savedMode = normalizeMode(savedModeByHearingId[item.hearingId], savedMeetingLinkByHearingId[item.hearingId]);
    const savedLink = String(savedMeetingLinkByHearingId[item.hearingId] || '').trim();

    if (item.status !== 'scheduled') {
      setActionError('You can only set hearing mode for scheduled hearings.');
      setActionMessage('');
      return;
    }

    if (selectedMode === 'virtual' && !selectedLink) {
      setActionError('Meeting link is required for virtual hearings.');
      setActionMessage('');
      return;
    }

    if (selectedMode === savedMode && (selectedMode !== 'virtual' || selectedLink === savedLink)) {
      setActionError('No hearing mode changes to save for this row.');
      setActionMessage('');
      return;
    }

    setActionError('');
    setActionMessage('');
    setBusyHearingId(item.hearingId);

    try {
      await authFetchJson(`/api/hearings/${item.hearingId}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hearing_mode: selectedMode,
          meeting_link: selectedMode === 'virtual' ? selectedLink : '',
        }),
      });

      setSavedModeByHearingId((prev) => ({ ...prev, [item.hearingId]: selectedMode }));
      setSavedMeetingLinkByHearingId((prev) => ({ ...prev, [item.hearingId]: selectedMode === 'virtual' ? selectedLink : '' }));
      setMeetingLinkByHearingId((prev) => ({ ...prev, [item.hearingId]: selectedMode === 'virtual' ? selectedLink : '' }));
      setActionMessage(`Hearing mode saved for ${item.id}.`);
    } catch (error) {
      setActionError(error.message || 'Failed to update hearing mode.');
    } finally {
      setBusyHearingId(null);
    }
  };

  return (
    <JudgePageShell
      activeNav="Schedule"
      sidebarTitle="Judge Panel"
      sidebarItems={[
        { key: 'monthly', label: 'Monthly view' },
        { key: 'all', label: 'All hearings' },
      ]}
      activeSidebarKey={view}
      onSidebarSelect={setView}
    >
          <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Schedule</h2>

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
            <div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
              <p style={{ margin: 0, color: '#64748B' }}>Loading hearings...</p>
            </div>
          )}

          {!isLoading && view === 'monthly' && (
            <div className="pegasus-block" style={{ borderRadius: '12px', padding: '12px', maxWidth: '1040px', margin: '0 auto' }}>
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
                      onClick={() => setSelectedCalendarDate(cell)}
                      style={{
                        minHeight: '68px',
                        border: isToday ? `2px solid ${JUDGE_THEME.accent}` : `1px solid ${JUDGE_THEME.border}`,
                        borderRadius: '8px',
                        padding: '4px',
                        backgroundColor: cell.inCurrentMonth ? '#fff' : '#F8FAFC',
                        opacity: cell.inCurrentMonth ? 1 : 0.7,
                        cursor: 'pointer',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: isToday ? JUDGE_THEME.accent : '#334155' }}>{cell.date.getDate()}</p>
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
            <div className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="pegasus-table-head">
                    {['Case', 'Day', 'Time', 'Title', 'Status', 'Mode setup'].map((h) => (
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
                    (() => {
                      const selectedMode = normalizeMode(modeByHearingId[h.hearingId], meetingLinkByHearingId[h.hearingId]);
                      const selectedLink = String(meetingLinkByHearingId[h.hearingId] || '').trim();
                      const savedMode = normalizeMode(savedModeByHearingId[h.hearingId], savedMeetingLinkByHearingId[h.hearingId]);
                      const savedLink = String(savedMeetingLinkByHearingId[h.hearingId] || '').trim();
                      const isDirty = selectedMode !== savedMode || (selectedMode === 'virtual' && selectedLink !== savedLink);
                      const isBusy = busyHearingId === h.hearingId;
                      const canConfigure =
                        String(h.status || '').toLowerCase() === 'scheduled' &&
                        h.assignmentStatus === 'approved';

                      return (
                    <tr key={h.id + h.time} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '12px 14px', color: JUDGE_THEME.accent, fontWeight: 600 }}>{h.id}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{h.day} {h.date}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{h.time}</td>
                      <td style={{ padding: '12px 14px', color: '#1E293B' }}>{h.title}</td>
                      <td style={{ padding: '12px 14px', color: statusColor(h.status), fontWeight: 700 }}>{h.status}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        <div style={{ display: 'grid', gap: '8px', minWidth: '280px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={selectedMode}
                              onChange={(event) => setModeByHearingId((prev) => ({ ...prev, [h.hearingId]: event.target.value }))}
                              disabled={!canConfigure || isBusy}
                              style={{ padding: '7px 8px', borderRadius: '8px', border: `1px solid ${JUDGE_THEME.border}`, minWidth: '120px' }}
                            >
                              <option value="physical">Physical</option>
                              <option value="virtual">Virtual</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSaveHearingMode(h)}
                              disabled={!canConfigure || isBusy || !isDirty || (selectedMode === 'virtual' && !selectedLink)}
                              style={{
                                border: 'none',
                                borderRadius: '7px',
                                backgroundColor: isDirty ? JUDGE_THEME.accent : '#94A3B8',
                                color: '#fff',
                                padding: '7px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: !canConfigure || isBusy || !isDirty || (selectedMode === 'virtual' && !selectedLink) ? 'not-allowed' : 'pointer',
                                opacity: !canConfigure || isBusy || !isDirty || (selectedMode === 'virtual' && !selectedLink) ? 0.75 : 1,
                              }}
                            >
                              {isBusy ? 'Saving...' : 'Save'}
                            </button>
                          </div>

                          {selectedMode === 'virtual' && (
                            <input
                              type="url"
                              value={meetingLinkByHearingId[h.hearingId] || ''}
                              onChange={(event) => setMeetingLinkByHearingId((prev) => ({ ...prev, [h.hearingId]: event.target.value }))}
                              disabled={!canConfigure || isBusy}
                              placeholder="https://meeting-link"
                              style={{ padding: '7px 8px', borderRadius: '8px', border: `1px solid ${JUDGE_THEME.border}` }}
                            />
                          )}

                          {!canConfigure && (
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              Available after assignment is accepted and hearing is scheduled.
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedCalendarDate && (
            <div
              onClick={() => setSelectedCalendarDate(null)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1300,
                padding: '16px',
              }}
            >
              <div
                className="pegasus-block"
                style={{ width: '100%', maxWidth: '760px', borderRadius: '12px', padding: '16px', maxHeight: '80vh', overflowY: 'auto' }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#1E2A45', fontSize: '18px' }}>
                    {selectedCalendarDate.date.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#334155', cursor: 'pointer' }}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>

                {selectedCalendarDate.hearings.length === 0 && (
                  <p style={{ margin: 0, color: '#64748B' }}>No hearings on this date.</p>
                )}

                {selectedCalendarDate.hearings.map((item) => (
                  <div key={`${selectedCalendarDate.key}-${item.hearingId}`} style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '10px' }}>
                    <p style={{ margin: 0, color: JUDGE_THEME.accent, fontWeight: 700 }}>{item.id}</p>
                    <p style={{ margin: '4px 0 0', color: '#1E293B' }}>{item.title}</p>
                    <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '13px' }}>Time: {item.time}</p>
                    <p style={{ margin: '4px 0 0', color: statusColor(item.status), fontSize: '13px', fontWeight: 700 }}>Status: {item.status}</p>
                    <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '13px', textTransform: 'capitalize' }}>
                      Mode: {item.hearingMode || '-'}
                    </p>
                    {item.meetingLink && (
                      <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '13px', wordBreak: 'break-all' }}>
                        Meeting link: {item.meetingLink}
                      </p>
                    )}
                    <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '13px', textTransform: 'capitalize' }}>
                      Assignment: {item.assignmentStatus || '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
    </JudgePageShell>
  );
}
