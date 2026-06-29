import Navbar from './Navbar';
import { useNavigate } from 'react-router-dom';

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

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', backgroundColor: LITIGANT_THEME.pageBg }}>
      <Navbar />

      <nav
        style={{
          backgroundColor: LITIGANT_THEME.navPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '0 24px',
          height: '60px',
        }}
      >
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => navigate(navRouteByItem[item])}
            style={{
              background: activeNav === item ? LITIGANT_THEME.accent : 'transparent',
              color: activeNav === item ? '#fff' : LITIGANT_THEME.navText,
              border: 'none',
              borderRadius: '6px',
              padding: '8px 22px',
              fontSize: '14px',
              fontWeight: activeNav === item ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <aside
          style={{
            width: '190px',
            backgroundColor: LITIGANT_THEME.panel,
            borderRight: `1px solid ${LITIGANT_THEME.border}`,
            padding: '20px 0',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: LITIGANT_THEME.accent,
              padding: '6px 20px 4px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {sidebarTitle}
          </p>

          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onSidebarSelect(item.key)}
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

        <main style={{ flex: 1, padding: '28px 32px' }}>{children}</main>
      </div>
    </div>
  );
}
