import DashboardDrawerShell from './DashboardDrawerShell';

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
      theme={LITIGANT_THEME}
      navRouteByItem={navRouteByItem}
    >
      {children}
    </DashboardDrawerShell>
  );
}
