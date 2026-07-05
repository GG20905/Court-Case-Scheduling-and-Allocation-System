import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import LitigantPageShell, { LITIGANT_THEME } from '../components/LitigantPageShell';

const DEFAULT_CASE_TYPES = ['Criminal', 'Civil', 'Family', 'Commercial', 'Constitutional'];
const CUSTOM_CASE_TYPE_KEY = '__custom__';
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

const toDateInputValue = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const toTimeInputValue = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const combineDateAndTime = (dateText, timeText) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ''))) return null;
  if (!/^\d{2}:\d{2}$/.test(String(timeText || ''))) return null;

  const [year, month, day] = String(dateText).split('-').map(Number);
  const [hour, minute] = String(timeText).split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export default function LitAdvSchedule() {
  const [view, setView] = useState('request');
  const [now, setNow] = useState(new Date());
  const [cases, setCases] = useState([]);
  const [caseTypeOptions, setCaseTypeOptions] = useState(DEFAULT_CASE_TYPES);
  const [hearings, setHearings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [requestCaseTitle, setRequestCaseTitle] = useState('');
  const [requestCaseType, setRequestCaseType] = useState('');
  const [isCustomCaseType, setIsCustomCaseType] = useState(false);
  const [customCaseType, setCustomCaseType] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const loadData = async () => {
    const [casesRes, hearingsRes] = await Promise.all([
      authFetchJson('/api/cases'),
      authFetchJson('/api/hearings'),
    ]);

    const caseRows = Array.isArray(casesRes.data) ? casesRes.data : [];
    const hearingRows = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];

    let categories = [];
    try {
      const categoriesRes = await authFetchJson('/api/cases/categories');
      categories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
    } catch {
      categories = [];
    }

    const dbTypes = categories
      .map((item) => String(item.case_category || '').trim())
      .filter((item) => item.length > 0);
    const caseTypesFromVisibleCases = caseRows
      .map((item) => String(item.case_category || '').trim())
      .filter((item) => item.length > 0);
    const mergedTypes = Array.from(new Set([...dbTypes, ...caseTypesFromVisibleCases, ...DEFAULT_CASE_TYPES]));
    setCaseTypeOptions(
      mergedTypes.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    );

    setCases(caseRows);

    setHearings(
      hearingRows.map((item) => ({
        id: `CASE-${item.case_id}`,
        day: dayLabel(item.hearing_date),
        date: dateLabel(item.hearing_date),
        time: timeLabel(item.hearing_time),
        title: item.case_title || 'Untitled case',
        judge: item.judge_name || 'Not assigned',
        status: item.status || 'requested',
        hearingDateRaw: item.hearing_date,
      }))
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError('');

      try {
        await loadData();
      } catch (error) {
        setFetchError(error.message || 'Failed to load hearings.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
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

  useEffect(() => {
    if (!requestCaseType && caseTypeOptions.length > 0) {
      setRequestCaseType(caseTypeOptions[0]);
    }
  }, [caseTypeOptions, requestCaseType]);

  const minDateForRequest = useMemo(() => toDateInputValue(now), [now]);

  const minTimeForToday = useMemo(() => {
    if (preferredDate !== minDateForRequest) return '';
    return toTimeInputValue(now);
  }, [minDateForRequest, now, preferredDate]);

  useEffect(() => {
    if (!preferredDate || !preferredTime) return;
    const selected = combineDateAndTime(preferredDate, preferredTime);
    if (!selected) return;
    if (selected.getTime() < now.getTime()) {
      setPreferredTime('');
    }
  }, [preferredDate, preferredTime, now]);

  const handleRequestHearing = async () => {
    setRequestError('');
    setRequestMessage('');

    const effectiveCaseType = (isCustomCaseType ? customCaseType : requestCaseType).trim();

    if (!effectiveCaseType || !preferredDate || !preferredTime) {
      setRequestError('Please fill case type, date and time.');
      return;
    }

    const selectedDateTime = combineDateAndTime(preferredDate, preferredTime);
    if (!selectedDateTime) {
      setRequestError('Please choose a valid date and time.');
      return;
    }

    if (selectedDateTime.getTime() < Date.now()) {
      setRequestError('Past hearing dates/times are not allowed.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      // Always create a new case so each hearing request has its own case number.
      const createdCase = await authFetchJson('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_title: requestCaseTitle.trim() || `${effectiveCaseType} case`,
          case_category: effectiveCaseType,
          case_description: requestNotes.trim() || 'Case created from hearing request workflow.',
        }),
      });

      const caseIdToUse = createdCase?.data?.case_id;
      if (!caseIdToUse) {
        throw new Error('Failed to create case for hearing request.');
      }

      await authFetchJson('/api/hearings/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: Number(caseIdToUse),
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          notes: requestNotes.trim(),
        }),
      });

      setRequestMessage('New case created and hearing request submitted successfully. Awaiting admin review.');
      setPreferredDate('');
      setPreferredTime('');
      setRequestNotes('');

      const normalizedType = effectiveCaseType;
      if (normalizedType) {
        setCaseTypeOptions((prev) => {
          if (prev.includes(normalizedType)) return prev;
          return [...prev, normalizedType].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        });
      }
      setRequestCaseType(normalizedType);
      setIsCustomCaseType(false);
      setCustomCaseType('');

      await loadData();
    } catch (error) {
      setRequestError(error.message || 'Failed to request hearing.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <LitigantPageShell
      activeNav="Schedule"
      sidebarTitle="Litigant Panel"
      sidebarItems={[
        { key: 'request', label: 'Schedule hearing' },
        { key: 'monthly', label: 'Monthly view' },
        { key: 'all', label: 'All hearings' },
      ]}
      activeSidebarKey={view}
      onSidebarSelect={setView}
    >
      <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>My Schedule</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      {view === 'request' && requestError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {requestError}
        </div>
      )}

      {view === 'request' && requestMessage && (
        <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
          {requestMessage}
        </div>
      )}

      {view === 'request' && (
        <section className="pegasus-block" style={{ borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h3 className="pegasus-section-title" style={{ margin: '0 0 10px', fontSize: '16px', color: '#1E2A45' }}>Request Hearing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              value={requestCaseTitle}
              onChange={(e) => setRequestCaseTitle(e.target.value)}
              placeholder={'Case title/ Name (optional)'}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
            <select
              value={requestCaseType}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (nextValue === CUSTOM_CASE_TYPE_KEY) {
                  setIsCustomCaseType(true);
                  setRequestCaseType(CUSTOM_CASE_TYPE_KEY);
                  return;
                }

                setIsCustomCaseType(false);
                setRequestCaseType(nextValue);
              }}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            >
              {!caseTypeOptions.length && <option value="">No categories available</option>}
              {caseTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
              <option value={CUSTOM_CASE_TYPE_KEY}>Other (type new category)</option>
            </select>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={minDateForRequest}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              min={minTimeForToday || undefined}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
          </div>
          {isCustomCaseType && (
            <input
              type="text"
              value={customCaseType}
              onChange={(e) => setCustomCaseType(e.target.value)}
              placeholder="Type new case category"
              style={{ width: '100%', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}`, marginBottom: '10px' }}
            />
          )}
          <textarea
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            style={{ width: '100%', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}`, resize: 'vertical', marginBottom: '10px' }}
          />
          <button
            onClick={handleRequestHearing}
            disabled={isSubmittingRequest || isLoading}
            style={{
              backgroundColor: LITIGANT_THEME.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              cursor: isSubmittingRequest || isLoading ? 'not-allowed' : 'pointer',
              opacity: isSubmittingRequest || isLoading ? 0.7 : 1,
            }}
          >
            {isSubmittingRequest ? 'Submitting...' : 'Submit Hearing Request'}
          </button>
        </section>
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
            {monthlyCalendar.map((cell) => (
              (() => {
                const isToday = fullDateKey(cell.date) === fullDateKey(now);
                return (
              <div
                key={cell.key}
                style={{
                  minHeight: '68px',
                  border: isToday ? `2px solid ${LITIGANT_THEME.accent}` : `1px solid ${LITIGANT_THEME.border}`,
                  borderRadius: '8px',
                  padding: '4px',
                  backgroundColor: cell.inCurrentMonth ? '#fff' : '#F8FAFC',
                  opacity: cell.inCurrentMonth ? 1 : 0.7,
                }}
              >
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: isToday ? LITIGANT_THEME.accent : '#334155' }}>{cell.date.getDate()}</p>
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
              })()
            ))}
          </div>
        </div>
      )}

      {!isLoading && view === 'all' && (
        <div className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="pegasus-table-head">
                {['Case', 'Day', 'Time', 'Title', 'Judge', 'Status'].map((header) => (
                  <th key={header} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>{header}</th>
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
                  <td style={{ padding: '12px 14px', color: LITIGANT_THEME.accent, fontWeight: 600 }}>{h.id}</td>
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
    </LitigantPageShell>
  );
}
