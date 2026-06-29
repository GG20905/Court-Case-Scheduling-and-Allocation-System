import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import LitigantPageShell, { LITIGANT_THEME } from '../components/LitigantPageShell';

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'scheduled') return 'Scheduled';
  return 'Active';
};

const toWorkflowState = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pending') return 'Requested';
  if (normalized === 'active' || normalized === 'scheduled') return 'Accepted';
  return 'Concluded';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LitAdvCases() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [requestCaseTitle, setRequestCaseTitle] = useState('');
  const [requestCaseType, setRequestCaseType] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setFetchError('');

    try {
      const [casesRes, hearingsRes] = await Promise.all([
        authFetchJson('/api/cases'),
        authFetchJson('/api/hearings'),
      ]);

      const cases = Array.isArray(casesRes.data) ? casesRes.data : [];
      const hearings = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];

      const hearingByCase = new Map();
      for (const hearing of hearings) {
        if (!hearingByCase.has(hearing.case_id)) {
          hearingByCase.set(hearing.case_id, hearing);
        }
      }

      setCaseRows(
        cases.map((item) => {
          const hearing = hearingByCase.get(item.case_id);
          return {
            caseId: item.case_id,
            id: `CASE-${item.case_id}`,
            title: item.case_title || 'Untitled case',
            type: item.case_category || 'General',
            status: toDisplayStatus(item.case_status),
            workflowState: toWorkflowState(item.case_status),
            nextHearing: formatDate(hearing?.hearing_date),
            judge: hearing?.judge_name || 'Not assigned',
          };
        })
      );
    } catch (error) {
      setFetchError(error.message || 'Failed to load cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCases = useMemo(() => {
    return caseRows.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        (activeFilter === 'all' && (item.workflowState === 'Requested' || item.workflowState === 'Accepted')) ||
        (activeFilter === 'active') ||
        (activeFilter === 'scheduled' && item.status === 'Scheduled');

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, caseRows, searchTerm]);

  const requestableCases = useMemo(
    () => caseRows.filter((item) => item.workflowState === 'Requested' || item.workflowState === 'Accepted'),
    [caseRows]
  );

  const requestableCaseTypes = useMemo(
    () => Array.from(new Set(requestableCases.map((item) => item.type).filter((value) => value && value.trim()))),
    [requestableCases]
  );

  useEffect(() => {
    if (!requestCaseType && requestableCaseTypes.length > 0) {
      setRequestCaseType(requestableCaseTypes[0]);
    }

    if (requestableCases.length === 0) {
      setRequestCaseTitle('');
      setRequestCaseType('');
    }
  }, [requestCaseType, requestableCases, requestableCaseTypes]);

  const selectedRequestCase = useMemo(() => {
    const normalizedTitle = requestCaseTitle.trim().toLowerCase();
    if (!normalizedTitle || !requestCaseType) return null;

    return requestableCases.find(
      (item) => item.type === requestCaseType && item.title.trim().toLowerCase() === normalizedTitle
    ) || null;
  }, [requestCaseTitle, requestCaseType, requestableCases]);

  const handleRequestHearing = async () => {
    setRequestError('');
    setRequestMessage('');

    if (!requestCaseTitle.trim() || !requestCaseType || !preferredDate || !preferredTime) {
      setRequestError('Please fill case title, case type, date and time.');
      return;
    }

    if (!selectedRequestCase) {
      setRequestError('No matching requested/accepted case found for the provided title and case type.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await authFetchJson('/api/hearings/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: Number(selectedRequestCase.caseId),
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          notes: requestNotes.trim(),
        }),
      });

      setRequestMessage('Hearing request submitted successfully. Awaiting admin review.');
      setPreferredDate('');
      setPreferredTime('');
      setRequestNotes('');
      await loadData();
    } catch (error) {
      setRequestError(error.message || 'Failed to request hearing.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <LitigantPageShell
      activeNav="Cases"
      sidebarTitle="Litigant Panel"
      sidebarItems={[
        { key: 'all', label: 'Requested / Accepted' },
        { key: 'active', label: 'All cases' },
        { key: 'scheduled', label: 'Scheduled cases' },
      ]}
      activeSidebarKey={activeFilter}
      onSidebarSelect={setActiveFilter}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>My Cases</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      {requestError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {requestError}
        </div>
      )}

      {requestMessage && (
        <div style={{ marginBottom: '14px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '8px', padding: '10px 12px' }}>
          {requestMessage}
        </div>
      )}

      {activeFilter === 'all' && (
        <section style={{ backgroundColor: '#fff', border: `1px solid ${LITIGANT_THEME.border}`, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: '#1E2A45' }}>Request Hearing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              value={requestCaseTitle}
              onChange={(e) => setRequestCaseTitle(e.target.value)}
              placeholder={requestableCases.length ? 'Case title/ Name' : 'No requested/accepted cases available'}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
            <select
              value={requestCaseType}
              onChange={(e) => setRequestCaseType(e.target.value)}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            >
              {!requestableCaseTypes.length && <option value="">Case type</option>}
              {requestableCaseTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              style={{ padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}` }}
            />
          </div>
          <textarea
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            style={{ width: '100%', padding: '9px', borderRadius: '8px', border: `1px solid ${LITIGANT_THEME.border}`, resize: 'vertical', marginBottom: '10px' }}
          />
          <button
            onClick={handleRequestHearing}
            disabled={isSubmittingRequest || isLoading || requestableCases.length === 0}
            style={{
              backgroundColor: LITIGANT_THEME.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              cursor: isSubmittingRequest || isLoading || requestableCases.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmittingRequest || isLoading || requestableCases.length === 0 ? 0.7 : 1,
            }}
          >
            {isSubmittingRequest ? 'Submitting...' : 'Submit Hearing Request'}
          </button>
        </section>
      )}

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by case number or title"
        style={{
          width: '100%',
          maxWidth: '420px',
          marginBottom: '16px',
          padding: '10px 12px',
          border: `1px solid ${LITIGANT_THEME.border}`,
          borderRadius: '8px',
          fontSize: '14px',
        }}
      />

      {isLoading && (
        <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: `1px solid ${LITIGANT_THEME.border}`, padding: '20px' }}>
          <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>
        </div>
      )}

      {!isLoading && (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: `1px solid ${LITIGANT_THEME.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: LITIGANT_THEME.panel }}>
                {['Case No.', 'Title', 'Category', 'Judge', 'Next hearing', 'Status'].map((header) => (
                  <th key={header} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '16px 14px', color: '#64748B' }}>No cases found.</td>
                </tr>
              )}
              {filteredCases.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 14px', color: LITIGANT_THEME.accent, fontWeight: 600 }}>{item.id}</td>
                  <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.type}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.judge}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.nextHearing}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LitigantPageShell>
  );
}
