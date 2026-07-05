import DashboardDrawerShell from './DashboardDrawerShell';

const navRouteByItem = {
  Dashboard: '/dashboard/admin',
  Cases: '/dashboard/admin/cases',
  Schedule: '/dashboard/admin/schedule',
  Documents: '/dashboard/admin/documents',
};

export const ADMIN_THEME = {
  pageBg: '#f5f7fc',
  navPrimary: '#0d1652',
  navText: '#d2ddff',
  accent: '#1a3a8c',
  panel: '#eef2fa',
  border: '#a8bfe0',
};

export default function AdminPageShell({
  activeNav,
  sidebarTitle,
  sidebarItems,
  activeSidebarKey,
  onSidebarSelect,
  topNavExtra,
  children,
}) {
  return (
    <DashboardDrawerShell
      activeNav={activeNav}
      sidebarTitle={sidebarTitle}
      sidebarItems={sidebarItems}
      activeSidebarKey={activeSidebarKey}
      onSidebarSelect={onSidebarSelect}
      topNavExtra={topNavExtra}
      theme={ADMIN_THEME}
      navRouteByItem={navRouteByItem}
    >
      {children}
    </DashboardDrawerShell>
  );
}
