import DashboardDrawerShell from './DashboardDrawerShell';

const navRouteByItem = {
  Dashboard: '/dashboard/judge',
  Cases: '/dashboard/judge/cases',
  Schedule: '/dashboard/judge/schedule',
  Documents: '/dashboard/judge/documents',
};

export const JUDGE_THEME = {
  pageBg: '#f5f7fc',
  navPrimary: '#0d1652',
  navText: '#d2ddff',
  accent: '#1a3a8c',
  panel: '#eef2fa',
  border: '#a8bfe0',
};

export default function JudgePageShell({
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
      theme={JUDGE_THEME}
      navRouteByItem={navRouteByItem}
    >
      {children}
    </DashboardDrawerShell>
  );
}
