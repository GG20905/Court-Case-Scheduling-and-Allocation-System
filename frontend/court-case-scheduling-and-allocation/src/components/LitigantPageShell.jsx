import Navbar from './Navbar';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileMenu from './ProfileMenu';

const navItems = ['Dashboard', 'Cases', 'Schedule', 'Documents'];

const navRouteByItem = {
  Dashboard: '/dashboard/litigant',
  Cases: '/dashboard/litigant/cases',
  Schedule: '/dashboard/litigant/schedule',
  Documents: '/dashboard/litigant/documents',
};

export const LITIGANT_THEME = {
  pageBg: '#f5f7fc',
  navPrimary: '#0d1652',
  navText: '#d2ddff',
  accent: '#1a3a8c',
  panel: '#eef2fa',
  border: '#a8bfe0',
};

export default function LitigantPageShell({
  activeNav,
  sidebarTitle,
  sidebarItems,
  activeSidebarKey,
  onSidebarSelect,
  children,
}) {
  const navigate = useNavigate();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => window.innerWidth < 980);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', backgroundColor: LITIGANT_THEME.pageBg }}>
      <Navbar />

      <nav
        style={{
          backgroundColor: LITIGANT_THEME.navPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: isNarrowScreen ? '8px 12px' : '0 24px',
          minHeight: '60px',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            border: `1px solid ${LITIGANT_THEME.border}`,
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: LITIGANT_THEME.accent,
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
              onClick={() => navigate(navRouteByItem[item])}
              style={{
                background: activeNav === item ? LITIGANT_THEME.accent : 'transparent',
                color: activeNav === item ? '#fff' : LITIGANT_THEME.navText,
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
          <ProfileMenu accentColor={LITIGANT_THEME.accent} borderColor={LITIGANT_THEME.border} />
        </div>
      </nav>

      {isSidebarOpen && (
        <>
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.35)',
              zIndex: 29,
            }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: isNarrowScreen ? '78%' : '260px',
              maxWidth: '320px',
              backgroundColor: LITIGANT_THEME.panel,
              borderRight: `1px solid ${LITIGANT_THEME.border}`,
              padding: '14px 0',
              zIndex: 30,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 14px 10px' }}>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: LITIGANT_THEME.accent,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                {sidebarTitle}
              </p>
              <button
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: LITIGANT_THEME.accent,
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close sidebar"
              >
                ←
              </button>
            </div>

            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  onSidebarSelect(item.key);
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
                  color: activeSidebarKey === item.key ? LITIGANT_THEME.accent : '#475569',
                  fontWeight: activeSidebarKey === item.key ? 600 : 400,
                  cursor: 'pointer',
                  backgroundColor: activeSidebarKey === item.key ? '#deeaf7' : 'transparent',
                  borderLeft: activeSidebarKey === item.key ? `3px solid ${LITIGANT_THEME.accent}` : '3px solid transparent',
                }}
              >
                {item.label}
              </button>
            ))}
          </aside>
        </>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <main style={{ flex: 1, padding: isNarrowScreen ? '16px' : '28px 32px', minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
