import { useEffect, useMemo, useState } from 'react';
import { authFetchJson } from '../utils/api';
import JudgePageShell, { JUDGE_THEME } from '../components/JudgePageShell';

const REJECTION_REASON_OPTIONS = [
  { value: 'schedule', label: 'Schedule conflict' },
  { value: 'specialty', label: 'Outside specialty' },
  { value: 'other', label: 'Other' },
];

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'pending') return 'Pending';
  return 'Active';
};

const toDisplayPriority = (value) => {
  const normalizedPriority = String(value || '').toLowerCase();
  if (normalizedPriority === 'urgent') return 'Urgent';
  if (normalizedPriority === 'high') return 'High';
  return 'Normal';
};

const priorityRank = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'urgent') return 0;
  if (normalized === 'high') return 1;
  return 2;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function JudgeCaseTab() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyAssignmentId, setBusyAssignmentId] = useState(null);
  const [pendingRejectItem, setPendingRejectItem] = useState(null);
  const [rejectionReasonType, setRejectionReasonType] = useState('schedule');
  const [otherRejectionReason, setOtherRejectionReason] = useState('');

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

      const mapped = cases.map((item) => {
        const hearing = hearingByCase.get(item.case_id);
        const status = toDisplayStatus(item.case_status);
        const priority = toDisplayPriority(item.priority);
        const rawStatus = String(item.case_status || '').toLowerCase();

        return {
          id: `CASE-${item.case_id}`,
          title: item.case_title || 'Untitled case',
          type: item.case_category || 'General',
          judge: 'Assigned Judge',
          hearing: formatDate(hearing?.hearing_date),
          priority,
          priorityKey: String(priority).toLowerCase(),
          status,
          rawStatus,
          assignmentId: item.assignment_id,
          assignmentStatus: String(item.assignment_status || '').toLowerCase(),
          rejectionReason: item.rejection_reason || '',
        };
      });

      setCaseRows(mapped);
    } catch (error) {
      setFetchError(error.message || 'Failed to load cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignmentResponse = async (item, action) => {
    if (!item.assignmentId) {
      setActionError('No assignment found for this case.');
      setActionMessage('');
      return;
    }

    setActionError('');
    setActionMessage('');
    setBusyAssignmentId(item.assignmentId);

    try {
      await authFetchJson(`/api/hearings/assignments/${item.assignmentId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejection_reason: '',
        }),
      });

      setActionMessage(`Assignment ${action === 'approve' ? 'accepted' : 'rejected'}.`);
      await loadData();
    } catch (error) {
      setActionError(error.message || 'Failed to respond to assignment.');
    } finally {
      setBusyAssignmentId(null);
    }
  };

  const openRejectDialog = (item) => {
    setActionError('');
    setActionMessage('');
    setPendingRejectItem(item);
    setRejectionReasonType('schedule');
    setOtherRejectionReason('');
  };

  const closeRejectDialog = () => {
    if (busyAssignmentId) return;
    setPendingRejectItem(null);
    setRejectionReasonType('schedule');
    setOtherRejectionReason('');
  };

  const confirmRejectAssignment = async () => {
    if (!pendingRejectItem?.assignmentId) {
      setActionError('No assignment found for this case.');
      setActionMessage('');
      return;
    }

    let rejectionReason = '';
    if (rejectionReasonType === 'schedule') {
      rejectionReason = 'Schedule conflict';
    } else if (rejectionReasonType === 'specialty') {
      rejectionReason = 'Case outside specialty';
    } else {
      const typed = otherRejectionReason.trim();
      if (!typed) {
        setActionError('Please provide a reason when selecting Other.');
        setActionMessage('');
        return;
      }
      rejectionReason = `Other: ${typed}`;
    }

    setActionError('');
    setActionMessage('');
    setBusyAssignmentId(pendingRejectItem.assignmentId);

    try {
      await authFetchJson(`/api/hearings/assignments/${pendingRejectItem.assignmentId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason,
        }),
      });

      setActionMessage('Assignment rejected.');
      setPendingRejectItem(null);
      setRejectionReasonType('schedule');
      setOtherRejectionReason('');
      await loadData();
    } catch (error) {
      setActionError(error.message || 'Failed to respond to assignment.');
    } finally {
      setBusyAssignmentId(null);
    }
  };

  const filteredCases = useMemo(() => {
    const rows = caseRows.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'requested' && item.rawStatus === 'pending') ||
        (activeFilter === 'scheduled' && item.rawStatus === 'scheduled') ||
        (activeFilter === 'urgent' && item.priorityKey === 'urgent') ||
        (activeFilter === 'high' && item.priorityKey === 'high') ||
        (activeFilter === 'normal' && item.priorityKey === 'normal');

      return matchesSearch && matchesFilter;
    });

    // Keep the table ordered by priority severity.
    rows.sort((a, b) => priorityRank(a.priorityKey) - priorityRank(b.priorityKey));
    return rows;
  }, [activeFilter, caseRows, searchTerm]);

  return (
    <JudgePageShell
      activeNav="Cases"
      sidebarTitle="Judge Panel"
      sidebarItems={[
        { key: 'all', label: 'All cases' },
        { key: 'requested', label: 'Requested cases' },
        { key: 'scheduled', label: 'Scheduled cases' },
        { key: 'urgent', label: 'Urgent cases' },
        { key: 'high', label: 'High priority cases' },
        { key: 'normal', label: 'Normal cases' },
      ]}
      activeSidebarKey={activeFilter}
      onSidebarSelect={setActiveFilter}
    >
          <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Cases</h2>

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
              border: `1px solid ${JUDGE_THEME.border}`,
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />

          {isLoading && (
            <div className="pegasus-block" style={{ borderRadius: '12px', padding: '20px' }}>
              <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>
            </div>
          )}

          {!isLoading && (
            <div
              className="pegasus-block"
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="pegasus-table-head">
                    {['Case No.', 'Title', 'Type', 'Judge', 'Next hearing', 'Priority', 'Status', 'Assignment'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          fontSize: '12px',
                          color: '#334155',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '16px 14px', color: '#64748B' }}>No cases found.</td>
                    </tr>
                  )}
                  {filteredCases.map((item) => (
                    <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '12px 14px', color: JUDGE_THEME.accent, fontWeight: 600 }}>{item.id}</td>
                      <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.type}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.judge}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.hearing}</td>
                      <td style={{ padding: '12px 14px', color: item.priority === 'Urgent' ? '#B91C1C' : item.priority === 'High' ? '#B45309' : '#475569' }}>
                        {item.priority}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {item.assignmentStatus === 'pending' && item.assignmentId && (
                          <div style={{ display: 'grid', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleAssignmentResponse(item, 'approve')}
                                disabled={busyAssignmentId === item.assignmentId}
                                style={{
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  color: '#fff',
                                  backgroundColor: '#15803D',
                                  cursor: busyAssignmentId === item.assignmentId ? 'not-allowed' : 'pointer',
                                  opacity: busyAssignmentId === item.assignmentId ? 0.75 : 1,
                                }}
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => openRejectDialog(item)}
                                disabled={busyAssignmentId === item.assignmentId}
                                style={{
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  color: '#fff',
                                  backgroundColor: '#B91C1C',
                                  cursor: busyAssignmentId === item.assignmentId ? 'not-allowed' : 'pointer',
                                  opacity: busyAssignmentId === item.assignmentId ? 0.75 : 1,
                                }}
                              >
                                Reject
                              </button>
                            </div>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                            
                            </span>
                          </div>
                        )}
                        {item.assignmentStatus === 'approved' && (
                          <span style={{ color: '#15803D', fontWeight: 700, fontSize: '12px' }}>Accepted</span>
                        )}
                        {item.assignmentStatus === 'rejected' && (
                          <span style={{ color: '#B91C1C', fontWeight: 700, fontSize: '12px' }}>Rejected</span>
                        )}
                        {!item.assignmentStatus && <span style={{ color: '#64748B', fontSize: '12px' }}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pendingRejectItem && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '460px',
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: `1px solid ${JUDGE_THEME.border}`,
                  padding: '16px',
                  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '17px', color: '#1E2A45', fontWeight: 700 }}>Reject Assignment</h3>
                <p style={{ margin: '8px 0 12px', fontSize: '13px', color: '#475569' }}>
                  Select the rejection reason for {pendingRejectItem.id}.
                </p>

                <label style={{ display: 'block', fontSize: '13px', color: '#334155', marginBottom: '6px' }}>Reason</label>
                <select
                  value={rejectionReasonType}
                  onChange={(event) => setRejectionReasonType(event.target.value)}
                  disabled={Boolean(busyAssignmentId)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${JUDGE_THEME.border}`,
                    marginBottom: '10px',
                  }}
                >
                  {REJECTION_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {rejectionReasonType === 'other' && (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', color: '#334155', marginBottom: '6px' }}>Describe reason</label>
                    <textarea
                      value={otherRejectionReason}
                      onChange={(event) => setOtherRejectionReason(event.target.value)}
                      disabled={Boolean(busyAssignmentId)}
                      rows={3}
                      placeholder="Enter rejection reason"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${JUDGE_THEME.border}`,
                        resize: 'vertical',
                        marginBottom: '10px',
                      }}
                    />
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={closeRejectDialog}
                    disabled={Boolean(busyAssignmentId)}
                    style={{
                      border: `1px solid ${JUDGE_THEME.border}`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#fff',
                      color: '#334155',
                      cursor: busyAssignmentId ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmRejectAssignment}
                    disabled={Boolean(busyAssignmentId)}
                    style={{
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#B91C1C',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: busyAssignmentId ? 'not-allowed' : 'pointer',
                      opacity: busyAssignmentId ? 0.75 : 1,
                    }}
                  >
                    {busyAssignmentId ? 'Submitting...' : 'Confirm reject'}
                  </button>
                </div>
              </div>
            </div>
          )}
    </JudgePageShell>
  );
}
