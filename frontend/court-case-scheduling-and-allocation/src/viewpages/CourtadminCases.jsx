import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';
import { authFetchJson } from '../utils/api';

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'scheduled') return 'Scheduled';
  if (normalized === 'pending') return 'Pending';
  return 'Active';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizePriority = (value) => {
  const normalized = String(value || 'normal').toLowerCase();
  if (normalized === 'urgent' || normalized === 'high' || normalized === 'normal') return normalized;
  return 'normal';
};

export default function CourtadminCases() {
  const [searchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [priorityByCaseId, setPriorityByCaseId] = useState({});
  const [savedPriorityByCaseId, setSavedPriorityByCaseId] = useState({});
  const [busyCaseId, setBusyCaseId] = useState(null);
  const [judges, setJudges] = useState([]);
  const [selectedJudgeByCaseId, setSelectedJudgeByCaseId] = useState({});
  const [busyCaseActionId, setBusyCaseActionId] = useState(null);
  const [reassignModalCase, setReassignModalCase] = useState(null);
  const [reassignJudgeId, setReassignJudgeId] = useState('');

  const loadCases = async () => {
    setIsLoading(true);
    setFetchError('');

    try {
      const [casesRes, hearingsRes, judgesRes] = await Promise.all([
        authFetchJson('/api/cases'),
        authFetchJson('/api/hearings'),
        authFetchJson('/api/dashboard/judges'),
      ]);

      const cases = Array.isArray(casesRes.data) ? casesRes.data : [];
      const hearings = Array.isArray(hearingsRes.data) ? hearingsRes.data : [];
      const judgeRows = Array.isArray(judgesRes.data) ? judgesRes.data : [];
      setJudges(
        judgeRows.map((judge) => ({
          id: judge.judge_id,
          name: judge.full_name || `Judge ${judge.judge_id}`,
          specialty: judge.specialty || 'Specialty not provided',
        }))
      );

      const hearingByCase = new Map();
      for (const hearing of hearings) {
        const current = hearingByCase.get(hearing.case_id);
        if (!current) {
          hearingByCase.set(hearing.case_id, hearing);
          continue;
        }

        const currentStamp = new Date(current.hearing_date || current.created_at || 0).getTime();
        const incomingStamp = new Date(hearing.hearing_date || hearing.created_at || 0).getTime();
        if (incomingStamp > currentStamp) {
          hearingByCase.set(hearing.case_id, hearing);
        }
      }

      const mappedRows = cases.map((item) => {
        const hearing = hearingByCase.get(item.case_id);
        const rawStatus = String(item.case_status || '').toLowerCase();
        return {
          caseId: item.case_id,
          id: `CASE-${item.case_id}`,
          title: item.case_title || 'Untitled case',
          category: item.case_category || 'General',
          submittedBy: item.submitted_by || 'Unknown',
          status: toDisplayStatus(item.case_status),
          rawStatus,
          priority: normalizePriority(item.priority),
          filedOn: formatDate(item.filing_date || item.created_at),
          nextHearing: formatDate(hearing?.hearing_date),
          nextHearingRaw: hearing?.hearing_date || null,
          hearingId: hearing?.hearing_id || null,
          assignmentStatus: String(hearing?.assignment_status || item.assignment_status || '').toLowerCase(),
          rejectionReason: String(hearing?.rejection_reason || item.rejection_reason || '').trim(),
        };
      });

      setCaseRows(mappedRows);

      const nextPriorities = {};
      const nextSelectedJudges = {};
      const defaultJudgeId = judgeRows.length > 0 ? String(judgeRows[0].judge_id) : '';
      mappedRows.forEach((row) => {
        nextPriorities[row.caseId] = row.priority;
        if (row.assignmentStatus === 'rejected' && row.hearingId && defaultJudgeId) {
          nextSelectedJudges[row.caseId] = defaultJudgeId;
        }
      });
      setPriorityByCaseId(nextPriorities);
      setSavedPriorityByCaseId(nextPriorities);
      setSelectedJudgeByCaseId((prev) => ({ ...nextSelectedJudges, ...prev }));
    } catch (error) {
      setFetchError(error.message || 'Failed to load cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    const focusedCaseId = String(searchParams.get('focusCaseId') || '').trim();
    if (!focusedCaseId) return;

    setActiveFilter('all');
    setSearchTerm(`CASE-${focusedCaseId}`);
  }, [searchParams]);

  const filteredRows = useMemo(() => {
    return caseRows.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        item.id.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.submittedBy.toLowerCase().includes(term);

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'requested' && item.rawStatus === 'pending') ||
        (activeFilter === 'pending' && item.status === 'Pending') ||
        (activeFilter === 'active' && item.status === 'Active') ||
        (activeFilter === 'scheduled' && item.status === 'Scheduled') ||
        (activeFilter === 'concluded' && item.status === 'Concluded') ||
        (activeFilter === 'rejected' && item.assignmentStatus === 'rejected') ||
        (activeFilter === 'expired' && (() => {
          if (!item.nextHearingRaw) return false;
          const nextDate = new Date(item.nextHearingRaw);
          if (Number.isNaN(nextDate.getTime())) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return nextDate.getTime() < today.getTime();
        })());

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, caseRows, searchTerm]);

  const handleSetPriority = async (caseId) => {
    const selectedPriority = normalizePriority(priorityByCaseId[caseId]);
    const savedPriority = normalizePriority(savedPriorityByCaseId[caseId]);
    if (!selectedPriority) {
      setActionError('Please select a priority.');
      setActionMessage('');
      return;
    }

    if (selectedPriority === savedPriority) {
      setActionError('No change to confirm for this case.');
      setActionMessage('');
      return;
    }

    setActionError('');
    setActionMessage('');
    setBusyCaseId(caseId);

    try {
      await authFetchJson(`/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: selectedPriority }),
      });

      setActionMessage('Case priority confirmed and saved.');
      await loadCases();
    } catch (error) {
      setActionError(error.message || 'Failed to update case priority.');
    } finally {
      setBusyCaseId(null);
    }
  };

  const handleReassignRejectedCase = async (item) => {
    setActionError('');
    setActionMessage('');

    if (!item.hearingId) {
      setActionError('No hearing found for this case to reassign.');
      return;
    }

    const selectedJudgeId = String(item.selectedJudgeId || selectedJudgeByCaseId[item.caseId] || '');
    if (!selectedJudgeId) {
      setActionError('Please select a judge before reassigning this rejected case.');
      return;
    }

    setBusyCaseActionId(item.caseId);
    try {
      await authFetchJson(`/api/hearings/${item.hearingId}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_judge_id: Number(selectedJudgeId) }),
      });
      setActionMessage('Judge reassigned. Awaiting judge response.');
      await loadCases();
    } catch (error) {
      setActionError(error.message || 'Failed to reassign judge for rejected case.');
    } finally {
      setBusyCaseActionId(null);
    }
  };

  const openReassignModal = (item) => {
    if (!item.hearingId) {
      setActionError('No hearing found for this case to reassign.');
      setActionMessage('');
      return;
    }

    const defaultJudgeId = selectedJudgeByCaseId[item.caseId] || (judges[0] ? String(judges[0].id) : '');
    setReassignJudgeId(defaultJudgeId);
    setReassignModalCase(item);
  };

  const closeReassignModal = () => {
    setReassignModalCase(null);
    setReassignJudgeId('');
  };

  const confirmReassignFromModal = async () => {
    if (!reassignModalCase) return;
    if (!reassignJudgeId) {
      setActionError('Please select a judge before reassigning this rejected case.');
      setActionMessage('');
      return;
    }

    setSelectedJudgeByCaseId((prev) => ({ ...prev, [reassignModalCase.caseId]: reassignJudgeId }));
    await handleReassignRejectedCase({ ...reassignModalCase, selectedJudgeId: reassignJudgeId });
    closeReassignModal();
  };

  const handleDeleteExpiredCase = async (item) => {
    setActionError('');
    setActionMessage('');

    if (!item.nextHearingRaw) {
      setActionError('This case has no hearing date and cannot be deleted from expired cases.');
      return;
    }

    const confirmed = window.confirm(`Delete ${item.id}? This action cannot be undone.`);
    if (!confirmed) return;

    setBusyCaseActionId(item.caseId);
    try {
      let result;
      try {
        result = await authFetchJson(`/api/cases/${item.caseId}`, {
          method: 'DELETE',
        });
      } catch (primaryError) {
        if (!String(primaryError.message || '').includes('404')) {
          throw primaryError;
        }

        // Compatibility fallback for environments that expose the legacy delete path.
        result = await authFetchJson(`/api/cases/${item.caseId}/delete`, {
          method: 'DELETE',
        });
      }

      setActionMessage(result.message || 'Expired case deleted successfully.');
      await loadCases();
    } catch (error) {
      const errorText = String(error.message || '');
      if (errorText.includes('404')) {
        setActionError('Delete endpoint not found. Restart backend and ensure latest routes are loaded.');
      } else {
        setActionError(error.message || 'Failed to delete expired case.');
      }
    } finally {
      setBusyCaseActionId(null);
    }
  };

  return (
    <AdminPageShell
      activeNav="Cases"
      sidebarTitle="Admin Panel"
      sidebarItems={[
        { key: 'all', label: 'All cases' },
        { key: 'requested', label: 'Requested cases' },
        { key: 'pending', label: 'Pending cases' },
        { key: 'active', label: 'Active cases' },
        { key: 'scheduled', label: 'Scheduled cases' },
        { key: 'rejected', label: 'Rejected assignments' },
        { key: 'expired', label: 'Expired cases' },
        { key: 'concluded', label: 'Concluded cases' },
      ]}
      activeSidebarKey={activeFilter}
      onSidebarSelect={setActiveFilter}
    >
      <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Admin Cases</h2>

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
        placeholder="Search by case no, title, or participant"
        style={{
          width: '100%',
          maxWidth: '450px',
          marginBottom: '16px',
          padding: '10px 12px',
          border: `1px solid ${ADMIN_THEME.border}`,
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
        <div className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="pegasus-table-head">
                {['Case No.', 'Title', 'Category', 'Participant', 'Filed on', 'Next hearing', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '16px 14px', color: '#64748B' }}>No cases found.</td>
                </tr>
              )}
              {filteredRows.map((item) => (
                (() => {
                  const selectedPriority = normalizePriority(priorityByCaseId[item.caseId] || item.priority);
                  const savedPriority = normalizePriority(savedPriorityByCaseId[item.caseId] || item.priority);
                  const isDirty = selectedPriority !== savedPriority;
                  const isBusy = busyCaseId === item.caseId;
                  const isActionBusy = busyCaseActionId === item.caseId;
                  return (
                <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 14px', color: ADMIN_THEME.accent, fontWeight: 700 }}>{item.id}</td>
                  <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.category}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.submittedBy}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.filedOn}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.nextHearing}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={selectedPriority}
                        onChange={(e) => setPriorityByCaseId((prev) => ({ ...prev, [item.caseId]: e.target.value }))}
                        disabled={isBusy}
                        style={{
                          minWidth: '116px',
                          padding: '7px 8px',
                          borderRadius: '8px',
                          border: `1px solid ${ADMIN_THEME.border}`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {['normal', 'high', 'urgent'].map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSetPriority(item.caseId)}
                        disabled={isBusy || !isDirty}
                        style={{
                          border: 'none',
                          borderRadius: '7px',
                          backgroundColor: isDirty ? ADMIN_THEME.accent : '#94A3B8',
                          color: '#fff',
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isBusy || !isDirty ? 'not-allowed' : 'pointer',
                          opacity: isBusy || !isDirty ? 0.75 : 1,
                        }}
                      >
                        {isBusy ? 'Saving...' : 'Confirm'}
                      </button>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isDirty ? '#B45309' : '#15803D' }}>
                        {isDirty ? 'Unsaved' : 'Saved'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
                  <td style={{ padding: '12px 14px', color: '#475569' }}>
                    {item.assignmentStatus === 'rejected' ? (
                      <div style={{ display: 'grid', gap: '6px', minWidth: '220px' }}>
                        <button
                          type="button"
                          onClick={() => openReassignModal(item)}
                          disabled={isActionBusy || judges.length === 0}
                          style={{
                            border: 'none',
                            borderRadius: '7px',
                            backgroundColor: ADMIN_THEME.accent,
                            color: '#fff',
                            padding: '7px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: isActionBusy || judges.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: isActionBusy || judges.length === 0 ? 0.75 : 1,
                          }}
                        >
                          {isActionBusy ? 'Reassigning...' : 'Reassign judge'}
                        </button>
                        {item.rejectionReason && (
                          <span style={{ fontSize: '11px', color: '#B91C1C' }}>
                            Reason: {item.rejectionReason}
                          </span>
                        )}
                      </div>
                    ) : (() => {
                      if (!item.nextHearingRaw) {
                        return <span style={{ color: '#94A3B8', fontSize: '12px' }}>-</span>;
                      }
                      const nextDate = new Date(item.nextHearingRaw);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isExpired = !Number.isNaN(nextDate.getTime()) && nextDate.getTime() < today.getTime();
                      return isExpired ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteExpiredCase(item)}
                          disabled={isActionBusy}
                          style={{
                            border: 'none',
                            borderRadius: '7px',
                            backgroundColor: '#B91C1C',
                            color: '#fff',
                            padding: '7px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: isActionBusy ? 'not-allowed' : 'pointer',
                            opacity: isActionBusy ? 0.75 : 1,
                          }}
                        >
                          {isActionBusy ? 'Deleting...' : 'Delete expired case'}
                        </button>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '12px' }}>-</span>
                      );
                    })()}
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reassignModalCase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1300,
            padding: '16px',
          }}
          onClick={closeReassignModal}
        >
          <div
            className="pegasus-block"
            style={{ width: '100%', maxWidth: '520px', borderRadius: '12px', padding: '16px' }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', color: '#1E2A45', fontSize: '18px' }}>Reassign Judge</h3>
            <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '13px' }}>
              {reassignModalCase.id} - {reassignModalCase.title}
            </p>

            <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
              Select new judge
              <select
                value={reassignJudgeId}
                onChange={(event) => setReassignJudgeId(event.target.value)}
                disabled={judges.length === 0 || busyCaseActionId === reassignModalCase.caseId}
                style={{ width: '100%', marginTop: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${ADMIN_THEME.border}` }}
              >
                {judges.length === 0 && <option value="">No judges available</option>}
                {judges.map((judge) => (
                  <option key={judge.id} value={String(judge.id)}>{`${judge.name} - ${judge.specialty}`}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={closeReassignModal}
                style={{
                  border: `1px solid ${ADMIN_THEME.border}`,
                  backgroundColor: '#fff',
                  color: '#334155',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReassignFromModal}
                disabled={!reassignJudgeId || busyCaseActionId === reassignModalCase.caseId}
                style={{
                  border: 'none',
                  backgroundColor: ADMIN_THEME.accent,
                  color: '#fff',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  cursor: !reassignJudgeId || busyCaseActionId === reassignModalCase.caseId ? 'not-allowed' : 'pointer',
                  opacity: !reassignJudgeId || busyCaseActionId === reassignModalCase.caseId ? 0.75 : 1,
                }}
              >
                {busyCaseActionId === reassignModalCase.caseId ? 'Reassigning...' : 'Confirm reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
