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

const toDisplayStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'dismissed') return 'Concluded';
  if (normalized === 'pending') return 'Pending';
  return 'Active';
};

const toDisplayPriority = (value, status) => {
  const normalizedPriority = String(value || '').toLowerCase();
  if (normalizedPriority === 'urgent' || normalizedPriority === 'high') return 'Urgent';
  if (String(status || '').toLowerCase() === 'pending') return 'Delayed';
  return 'Normal';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function JudgeCaseTab() {
  const navigate = useNavigate();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => window.innerWidth < 980);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Cases');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caseRows, setCaseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
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
          const priority = toDisplayPriority(item.priority, item.case_status);

          return {
            id: `CASE-${item.case_id}`,
            title: item.case_title || 'Untitled case',
            type: item.case_category || 'General',
            judge: 'Assigned Judge',
            hearing: formatDate(hearing?.hearing_date),
            priority,
            status,
          };
        });

        setCaseRows(mapped);
      } catch (error) {
        setFetchError(error.message || 'Failed to load cases.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredCases = useMemo(() => {
    return caseRows.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'urgent' && item.priority === 'Urgent') ||
        (activeFilter === 'delayed' && item.priority === 'Delayed') ||
        (activeFilter === 'concluded' && item.status === 'Concluded');

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, caseRows, searchTerm]);

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
          position: 'relative',
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
                Cases
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
              { key: 'all', label: 'All cases' },
              { key: 'urgent', label: 'Urgent cases' },
              { key: 'delayed', label: 'Delayed cases' },
              { key: 'concluded', label: 'Concluded cases' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveFilter(item.key);
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
                  color: activeFilter === item.key ? THEME.accent : '#475569',
                  fontWeight: activeFilter === item.key ? 600 : 400,
                  cursor: 'pointer',
                  backgroundColor: activeFilter === item.key ? '#deeaf7' : 'transparent',
                  borderLeft: activeFilter === item.key ? `3px solid ${THEME.accent}` : '3px solid transparent',
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
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A45', marginBottom: '16px' }}>Judge Cases</h2>

          {fetchError && (
            <div style={{ marginBottom: '14px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px' }}>
              {fetchError}
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
              border: `1px solid ${THEME.border}`,
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />

          {isLoading && (
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: `1px solid ${THEME.border}`, padding: '20px' }}>
              <p style={{ margin: 0, color: '#64748B' }}>Loading cases...</p>
            </div>
          )}

          {!isLoading && (
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: `1px solid ${THEME.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: THEME.panel }}>
                    {['Case No.', 'Title', 'Type', 'Judge', 'Next hearing', 'Priority', 'Status'].map((h) => (
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
                      <td style={{ padding: '12px 14px', color: THEME.accent, fontWeight: 600 }}>{item.id}</td>
                      <td style={{ padding: '12px 14px', color: '#1E293B' }}>{item.title}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.type}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.judge}</td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.hearing}</td>
                      <td style={{ padding: '12px 14px', color: item.priority === 'Urgent' || item.priority === 'Delayed' ? '#B91C1C' : '#475569' }}>
                        {item.priority}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{item.status}</td>
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
