import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import ProfileMenu from './ProfileMenu';

const DEFAULT_MAIN_NAV_ITEMS = ['Dashboard', 'Cases', 'Schedule', 'Documents'];
const BRAND_NAV_HEIGHT = 78;
const FILTER_NAV_HEIGHT = 60;
const DRAWER_TOP_OFFSET = BRAND_NAV_HEIGHT + FILTER_NAV_HEIGHT;

export default function DashboardDrawerShell({
  activeNav,
  sidebarTitle,
  sidebarItems,
  activeSidebarKey,
  onSidebarSelect,
  topNavExtra,
  children,
  theme,
  navRouteByItem,
  mainNavItems = DEFAULT_MAIN_NAV_ITEMS,
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
    <div style={{ fontFamily: "var(--pegasus-font-ui)", minHeight: '100vh', backgroundColor: theme.pageBg, position: 'relative' }}>
      <Navbar />

      <nav
        style={{
          backgroundColor: theme.navPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: isNarrowScreen ? '8px 12px' : '0 24px',
          minHeight: `${FILTER_NAV_HEIGHT}px`,
          position: 'relative',
        }}
      >
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: theme.accent,
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
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onSidebarSelect(item.key)}
              style={{
                background: activeSidebarKey === item.key ? theme.accent : 'transparent',
                color: activeSidebarKey === item.key ? '#fff' : theme.navText,
                border: 'none',
                borderRadius: '6px',
                padding: isNarrowScreen ? '8px 14px' : '8px 22px',
                fontSize: '14.5px',
                fontWeight: activeSidebarKey === item.key ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {topNavExtra && <div style={{ flexShrink: 0 }}>{topNavExtra}</div>}

        <div style={{ flexShrink: 0 }}>
          <ProfileMenu accentColor={theme.accent} borderColor={theme.border} />
        </div>
      </nav>

      {isSidebarOpen && (
        <>
          <div
            className="drawer-backdrop-enter"
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'absolute',
              top: `${DRAWER_TOP_OFFSET}px`,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.35)',
              zIndex: 1200,
            }}
          />
          <aside
            className="drawer-panel-enter"
            style={{
              position: 'absolute',
              top: `${DRAWER_TOP_OFFSET}px`,
              left: 0,
              bottom: 0,
              width: isNarrowScreen ? '78%' : '260px',
              maxWidth: '320px',
              backgroundColor: theme.panel,
              borderRight: `1px solid ${theme.border}`,
              padding: '14px 0',
              zIndex: 1201,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 14px 10px' }}>
              <p
                style={{
                  fontFamily: 'var(--pegasus-font-display)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: theme.accent,
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
                  color: theme.accent,
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

            {mainNavItems.map((item) => (
              <button
                key={item}
                onClick={() => {
                  navigate(navRouteByItem[item]);
                  setIsSidebarOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  padding: '10px 20px',
                  fontSize: '16.5px',
                  color: activeNav === item ? theme.accent : '#475569',
                  fontWeight: activeNav === item ? 600 : 400,
                  cursor: 'pointer',
                  backgroundColor: activeNav === item ? '#deeaf7' : 'transparent',
                  borderLeft: activeNav === item ? `3px solid ${theme.accent}` : '3px solid transparent',
                }}
              >
                {item}
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
