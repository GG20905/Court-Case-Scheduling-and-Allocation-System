import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetchJson } from '../utils/api';
import AdminPageShell, { ADMIN_THEME } from '../components/AdminPageShell';

const toInt = (value) => Number.parseInt(value, 10) || 0;
const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getFcfsPriority = (ageDays) => {
  if (ageDays >= 14) return 'Urgent';
  if (ageDays >= 7) return 'High';
  return 'Normal';
};

const getFcfsPriorityColor = (priority) => {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'urgent') return '#B91C1C';
  if (normalized === 'high') return '#B45309';
  return '#166534';
};

export default function AdminJudgeDashboard() {
  const navigate = useNavigate();
  const [activeSidebar, setActiveSidebar] = useState('Overview');
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [judges, setJudges] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [assignmentResponses, setAssignmentResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setFetchError('');
      try {
        const [summaryRes, casesRes, hearingsRes, judgesRes, usersRes, responsesRes] = await Promise.all([
          authFetchJson('/api/dashboard/summary'),
          authFetchJson('/api/cases'),
          authFetchJson('/api/hearings'),
          authFetchJson('/api/dashboard/judges'),
          authFetchJson('/api/users'),
          authFetchJson('/api/dashboard/assignment-responses'),
        ]);

        setSummary(summaryRes.data || null);
        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
        setHearings(Array.isArray(hearingsRes.data) ? hearingsRes.data : []);
        setJudges(Array.isArray(judgesRes.data) ? judgesRes.data : []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        setAssignmentResponses(Array.isArray(responsesRes.data) ? responsesRes.data : []);
      } catch (error) {
        setFetchError(error.message || 'Failed to load admin dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const stats = useMemo(() => {
    return {
      totalCases: toInt(summary?.cases?.total_cases),
      hearingsToday: hearings.filter((item) => String(item.hearing_date || '').slice(0, 10) === todayKey()).length,
      delayedCases: toInt(summary?.cases?.pending),
      concludedCases: toInt(summary?.cases?.closed),
      pendingJudgeResponses: toInt(summary?.assignments?.pending_judge_responses),
    };
  }, [summary, hearings]);

  const recentCases = useMemo(() => {
    const sorted = [...cases].sort((a, b) => {
      const aDate = new Date(a.filing_date || a.created_at || 0).getTime();
      const bDate = new Date(b.filing_date || b.created_at || 0).getTime();
      return bDate - aDate;
    });

    return sorted.slice(0, 6).map((item) => ({
      id: `CASE-${item.case_id}`,
      title: item.case_title || 'Untitled case',
      status: String(item.case_status || 'pending').toLowerCase(),
      date: formatDate(item.filing_date || item.created_at),
    }));
  }, [cases]);

  const fcfsAgingQueue = useMemo(() => {
    const nowMs = Date.now();

    return cases
      .filter((item) => {
        const status = String(item.case_status || '').toLowerCase();
        return status !== 'closed' && status !== 'dismissed';
      })
      .map((item) => {
        const createdDate = parseDate(item.filing_date || item.created_at) || new Date();
        const ageDays = Math.max(0, Math.floor((nowMs - createdDate.getTime()) / (24 * 60 * 60 * 1000)));
        const fcfsPriority = getFcfsPriority(ageDays);

        return {
          caseId: item.case_id,
          title: item.case_title || 'Untitled case',
          fcfsPriority,
          fcfsPriorityColor: getFcfsPriorityColor(fcfsPriority),
          assignmentStatus: String(item.assignment_status || '').toLowerCase(),
          assignedJudgeName: item.assigned_judge_name || '',
          rejectionReason: String(item.rejection_reason || '').trim(),
          createdAt: createdDate.getTime(),
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 8);
  }, [cases]);

  const sidebarItems = [
    { key: 'Overview', label: 'Overview' },
    { key: 'Users', label: 'Users' },
    { key: 'Reports', label: 'Reports' },
  ];

  const usersByRole = useMemo(() => {
    const counts = { admin: 0, judge: 0, litigant: 0, advocate: 0 };
    users.forEach((item) => {
      const role = String(item.role || '').toLowerCase();
      if (counts[role] !== undefined) {
        counts[role] += 1;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = userSearchTerm.trim().toLowerCase();
    return users.filter((item) => {
      const role = String(item.role || '').toLowerCase();
      const roleMatch =
        userRoleFilter === 'all' ||
        role === userRoleFilter ||
        (userRoleFilter === 'litigant_advocate' && (role === 'litigant' || role === 'advocate'));
      const searchMatch =
        !term ||
        String(item.full_name || '').toLowerCase().includes(term) ||
        String(item.email || '').toLowerCase().includes(term) ||
        String(item.user_id || '').includes(term);
      return roleMatch && searchMatch;
    });
  }, [userRoleFilter, userSearchTerm, users]);

  const caseStatusSummary = useMemo(() => {
    const counts = { pending: 0, active: 0, scheduled: 0, closed: 0, dismissed: 0 };
    cases.forEach((item) => {
      const status = String(item.case_status || '').toLowerCase();
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [cases]);

  const hearingStatusSummary = useMemo(() => {
    const counts = { requested: 0, scheduled: 0, completed: 0, cancelled: 0, postponed: 0 };
    hearings.forEach((item) => {
      const status = String(item.status || '').toLowerCase();
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [hearings]);

  const judgeStatusRows = useMemo(() => {
    return judges.map((judge) => {
      const activeCases = toInt(judge.active_cases);
      let statusLabel = 'Idle';
      let statusColor = '#64748B';

      if (activeCases >= 5) {
        statusLabel = 'Heavy workload';
        statusColor = '#B91C1C';
      } else if (activeCases > 0) {
        statusLabel = 'Active';
        statusColor = '#166534';
      }

      return {
        judgeId: judge.judge_id,
        name: judge.full_name || 'Unknown judge',
        station: judge.court_station || '-',
        email: judge.email || '-',
        activeCases,
        statusLabel,
        statusColor,
      };
    });
  }, [judges]);

  return (
    <AdminPageShell
      activeNav="Dashboard"
      sidebarTitle="Admin Panel"
      sidebarItems={sidebarItems}
      activeSidebarKey={activeSidebar}
      onSidebarSelect={setActiveSidebar}
    >
      <h2 className="pegasus-page-title" style={{ fontSize: '22px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Admin Dashboard</h2>

      {fetchError && (
        <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
          {fetchError}
        </div>
      )}

      {activeSidebar === 'Overview' && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {[
              { title: 'Total cases', value: stats.totalCases },
              { title: 'Hearings today', value: stats.hearingsToday },
              { title: 'Delayed cases', value: stats.delayedCases },
              { title: 'Concluded cases', value: stats.concludedCases },
              { title: 'Pending judge responses', value: stats.pendingJudgeResponses },
            ].map((card) => (
              <div key={card.title} className="pegasus-card" style={{ borderRadius: '12px', padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
              </div>
            ))}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '14px' }}>
              <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Recent Cases</h3>
              <div style={{ marginTop: '10px' }}>
                {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>}
                {!isLoading && recentCases.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No recent cases.</p>}
                {!isLoading && recentCases.map((item) => (
                  <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: ADMIN_THEME.accent }}>{item.id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{item.status} · {item.date}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '14px' }}>
              <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Priority Cases</h3>
             
              <div style={{ marginTop: '10px' }}>
                {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading FCFS queue...</p>}
                {!isLoading && fcfsAgingQueue.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No open cases in queue.</p>}
                {!isLoading && fcfsAgingQueue.map((item) => (
                  <button
                    key={`fcfs-slot-${item.caseId}`}
                    type="button"
                    onClick={() => navigate(`/dashboard/admin/cases?focusCaseId=${item.caseId}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                      padding: '10px 12px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: item.fcfsPriorityColor, fontWeight: 700 }}>
                      Priority: {item.fcfsPriority}
                    </p>
                    {(item.assignmentStatus === 'approved' || item.assignmentStatus === 'rejected') && (
                      <p
                        style={{
                          margin: '2px 0 0',
                          fontSize: '12px',
                          color: item.assignmentStatus === 'rejected' ? '#B91C1C' : '#15803D',
                          fontWeight: 700,
                        }}
                      >
                        Judge response: {item.assignmentStatus === 'approved' ? 'Accepted' : 'Rejected'}
                        {item.assignedJudgeName ? ` · ${item.assignedJudgeName}` : ''}
                      </p>
                    )}
                    {item.assignmentStatus === 'rejected' && item.rejectionReason && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#B91C1C' }}>
                        Reason: {item.rejectionReason}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="pegasus-block" style={{ marginTop: '12px', borderRadius: '12px', padding: '14px' }}>
            <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Judge Assignment Responses</h3>
            <div style={{ marginTop: '10px' }}>
              {isLoading && <p style={{ margin: 0, color: '#64748B' }}>Loading responses...</p>}
              {!isLoading && assignmentResponses.length === 0 && <p style={{ margin: 0, color: '#64748B' }}>No judge responses yet.</p>}
              {!isLoading && assignmentResponses.map((item) => {
                const state = String(item.assignment_status || '').toLowerCase();
                const stateColor = state === 'approved' ? '#15803D' : '#B91C1C';
                const label = state === 'approved' ? 'accepted' : 'rejected';
                return (
                  <div key={item.assignment_id} style={{ padding: '10px 0', borderBottom: '1px solid #EEF2F7' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                      <span style={{ fontWeight: 700 }}>{item.judge_name || 'Judge'}</span>{' '}
                      <span style={{ color: stateColor, fontWeight: 700 }}>{label}</span>{' '}
                      assignment for{' '}
                      <span style={{ fontWeight: 700, color: ADMIN_THEME.accent }}>CASE-{item.case_id}</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                      {item.case_title || 'Untitled case'} · {formatDate(item.updated_at || item.assignment_date)}
                    </p>
                    {state === 'rejected' && item.rejection_reason && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#B91C1C' }}>
                        Reason: {item.rejection_reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </>
      )}

      {activeSidebar === 'Users' && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {[
              { title: 'Total registered users', value: users.length },
              { title: 'Judges', value: usersByRole.judge },
              { title: 'Litigants', value: usersByRole.litigant },
              { title: 'Advocates', value: usersByRole.advocate },
            ].map((card) => (
              <div key={card.title} className="pegasus-card" style={{ borderRadius: '12px', padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
              </div>
            ))}
          </section>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <input
              type="text"
              value={userSearchTerm}
              onChange={(event) => setUserSearchTerm(event.target.value)}
              placeholder="Search by name, email or ID"
              style={{
                width: '100%',
                maxWidth: '320px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${ADMIN_THEME.border}`,
                fontSize: '14px',
              }}
            />
            <select
              value={userRoleFilter}
              onChange={(event) => setUserRoleFilter(event.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${ADMIN_THEME.border}`,
                fontSize: '14px',
                textTransform: 'capitalize',
              }}
            >
              <option value="all">all</option>
              <option value="admin">admin</option>
              <option value="judge">judge</option>
              <option value="litigant_advocate">litigant/advocate</option>
            </select>
          </div>

          <section className="pegasus-block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="pegasus-table-head">
                  {['User ID', 'Name', 'Email', 'Role', 'Registered on'].map((header) => (
                    <th key={header} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#334155' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px', color: '#64748B' }}>No users match the current filter.</td>
                  </tr>
                )}
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 12px', color: ADMIN_THEME.accent, fontWeight: 700 }}>U-{user.user_id}</td>
                    <td style={{ padding: '10px 12px', color: '#1E293B' }}>{user.full_name || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{user.email || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569', textTransform: 'capitalize' }}>{user.role || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeSidebar === 'Reports' && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            {[
              { title: 'Total judges', value: usersByRole.judge },
              { title: 'Pending judge responses', value: stats.pendingJudgeResponses },
              { title: 'Total litigants + advocates', value: usersByRole.litigant + usersByRole.advocate },
              { title: 'Open participant cases', value: caseStatusSummary.pending + caseStatusSummary.active + caseStatusSummary.scheduled },
            ].map((card) => (
              <div key={card.title} style={{ backgroundColor: '#fff', border: `1px solid ${ADMIN_THEME.border}`, borderRadius: '10px', padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{card.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{isLoading ? '-' : card.value}</p>
              </div>
            ))}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '14px' }}>
              <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Case status (litigants and advocates)</h3>
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  ['Pending', caseStatusSummary.pending],
                  ['Active', caseStatusSummary.active],
                  ['Scheduled', caseStatusSummary.scheduled],
                  ['Closed', caseStatusSummary.closed],
                  ['Dismissed', caseStatusSummary.dismissed],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{isLoading ? '-' : value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="pegasus-block" style={{ borderRadius: '12px', padding: '14px' }}>
              <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Hearing status overview</h3>
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  ['Requested', hearingStatusSummary.requested],
                  ['Scheduled', hearingStatusSummary.scheduled],
                  ['Completed', hearingStatusSummary.completed],
                  ['Cancelled', hearingStatusSummary.cancelled],
                  ['Postponed', hearingStatusSummary.postponed],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{isLoading ? '-' : value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="pegasus-block" style={{ borderRadius: '12px', padding: '14px' }}>
            <h3 className="pegasus-section-title" style={{ margin: 0, fontSize: '16px', color: '#1E2A45' }}>Judge status report</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr className="pegasus-table-head">
                  {['Judge', 'Station', 'Email', 'Active cases', 'Status'].map((header) => (
                    <th key={header} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#334155' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!isLoading && judgeStatusRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px', color: '#64748B' }}>No judges found.</td>
                  </tr>
                )}
                {judgeStatusRows.map((judge) => (
                  <tr key={judge.judgeId} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 12px', color: '#1E293B' }}>{judge.name}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{judge.station}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{judge.email}</td>
                    <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 700 }}>{judge.activeCases}</td>
                    <td style={{ padding: '10px 12px', color: judge.statusColor, fontWeight: 700 }}>{judge.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
