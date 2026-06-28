import { useState } from "react";
import Navbar from "../components/Navbar";
 
const mockCases = [
  { id: "CR/041/26", title: "State v. Kamau", status: "Urgent", date: "04 Jun" },
  { id: "CV/112/26", title: "Otieno v. KCB Ltd", status: "Active", date: "05 Jun" },
  { id: "FM/008/26", title: "Njeri v. Njeri", status: "Pending", date: "09 Jun" },
  { id: "LC/053/26", title: "Wanjiku v. Nairobi CC", status: "Active", date: "10 Jun" },
  { id: "CR/029/26", title: "State v. Mwangi et al", status: "Concluded", date: "02 Jun" },
];
 
const todaysHearings = [
  { time: "09:00", case: "CR/041/26 — State v. Kamau", judge: "Hon. Odhiambo", courtroom: "Courtroom 3" },
  { time: "11:30", case: "CV/112/26 — Otieno v. KCB Ltd", judge: "Hon. Wanjiru", courtroom: "Courtroom 1" },
];
 
const statusStyles = {
  Urgent: { backgroundColor: "#FEE2E2", color: "#DC2626" },
  Active: { backgroundColor: "#DBEAFE", color: "#1D4ED8" },
  Pending: { backgroundColor: "#FEF9C3", color: "#B45309" },
  Concluded: { backgroundColor: "#DCFCE7", color: "#15803D" },
};
 
const navItems = ["Dashboard", "Cases", "Schedule", "Documents"];
 
const JUNE_2026 = {
  year: 2026,
  month: "June",
  startDay: 1, // Monday (0=Sun, 1=Mon ...)
  days: 30,
  dotDays: [7, 9, 21], // days with hearing dots
};

const THEME = {
  pageBg: "#f5f7fc",
  navPrimary: "#0d1652",
  navText: "#d2ddff",
  accent: "#1a3a8c",
  panel: "#eef2fa",
  border: "#a8bfe0",
};
 
export default function AdminJudgeDashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [activeSidebar, setActiveSidebar] = useState("Dashboard");
  const [selectedDay, setSelectedDay] = useState(4);
 
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
 
  // Build calendar grid
  const calendarCells = [];
  // startDay=1 means first day is Monday (index 1 in Su-Sa week)
  for (let i = 0; i < JUNE_2026.startDay; i++) calendarCells.push(null);
  for (let d = 1; d <= JUNE_2026.days; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const weeks = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    weeks.push(calendarCells.slice(i, i + 7));
  }
 
  const sidebarSections = [
    {
      label: "Overview",
      items: [
        { key: "Dashboard", label: "Dashboard" },
      ],
    },
    {
      label: "Admin",
      items: [
        { key: "Users", label: "Users" },
        { key: "Reports", label: "Reports" },
      ],
    },
  ];
 
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", backgroundColor: THEME.pageBg }}>
      <Navbar />

      {/* Navbar */}
      <nav style={{
        backgroundColor: THEME.navPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "0 24px",
        position: "relative",
        height: "60px",
      }}>
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveNav(item)}
            style={{
              background: activeNav === item ? THEME.accent : "transparent",
              color: activeNav === item ? "#fff" : THEME.navText,
              border: "none",
              borderRadius: "6px",
              padding: "8px 22px",
              fontSize: "14px",
              fontWeight: activeNav === item ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {item}
          </button>
        ))}
        <div style={{ position: "absolute", right: "24px", top: "50%", transform: "translateY(-50%)" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            border: `2px solid ${THEME.border}`, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={THEME.navText} strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </nav>
 
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        {/* Sidebar */}
        <aside style={{
          width: "190px",
          backgroundColor: THEME.panel,
          borderRight: `1px solid ${THEME.border}`,
          padding: "20px 0",
          flexShrink: 0,
        }}>
          {sidebarSections.map((section) => (
            <div key={section.label} style={{ marginBottom: "8px" }}>
              <p style={{
                fontSize: "12px", fontWeight: 700, color: THEME.accent,
                padding: "6px 20px 4px", letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                {section.label}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSidebar(item.key)}
                  style={{
                    display: "block", width: "100%", background: "transparent",
                    border: "none", textAlign: "left",
                    padding: "9px 20px", fontSize: "13.5px",
                    color: activeSidebar === item.key ? THEME.accent : "#475569",
                    fontWeight: activeSidebar === item.key ? 600 : 400,
                    cursor: "pointer",
                    backgroundColor: activeSidebar === item.key ? "#deeaf7" : "transparent",
                    borderLeft: activeSidebar === item.key ? `3px solid ${THEME.accent}` : "3px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
 
        {/* Main content */}
        <main style={{ flex: 1, padding: "28px 32px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#64748B", marginBottom: "20px" }}>
            Dashboard overview
          </h2>
 
          {/* Stats cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "Total cases", value: "1,284", sub: "+38 this week", subColor: "#16A34A" },
              { label: "Hearings today", value: "24", sub: "6 urgent", subColor: "#DC2626" },
              { label: "Delayed cases", value: "87", sub: "Needs attention", subColor: "#B45309" },
              { label: "Concluded", value: "342", sub: "This month", subColor: "#64748B" },
            ].map((card, i) => (
              <div key={i} style={{
                backgroundColor: "#fff", borderRadius: "10px",
                border: `1px solid ${THEME.border}`, padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>{card.label}</p>
                <p style={{ fontSize: "26px", fontWeight: 700, color: THEME.accent, margin: "0 0 4px" }}>{card.value}</p>
                <p style={{ fontSize: "12px", color: card.subColor, margin: 0 }}>{card.sub}</p>
              </div>
            ))}
          </div>
 
          {/* Two-column lower section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Recent Cases table */}
            <div style={{
              backgroundColor: "#fff", borderRadius: "10px",
              border: `1px solid ${THEME.border}`, padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#1E2A45" }}>Recent cases</span>
                <span style={{ fontSize: "12px", color: THEME.accent, cursor: "pointer" }}>View all →</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {mockCases.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 0", fontSize: "12.5px", color: THEME.accent, fontWeight: 500, width: "95px" }}>
                        {c.id}
                      </td>
                      <td style={{ padding: "10px 6px", fontSize: "13px", color: "#334155" }}>
                        {c.title}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "center" }}>
                        <span style={{
                          ...statusStyles[c.status],
                          borderRadius: "12px", padding: "3px 10px",
                          fontSize: "11px", fontWeight: 600,
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 0", fontSize: "12px", color: "#64748B", textAlign: "right" }}>
                        {c.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
 
            {/* Calendar + Today's hearings */}
            <div style={{
              backgroundColor: "#fff", borderRadius: "10px",
              border: `1px solid ${THEME.border}`, padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              {/* Calendar header */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1E2A45" }}>June 2026</span>
              </div>
 
              {/* Day labels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "4px" }}>
                {daysOfWeek.map((d) => (
                  <div key={d} style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, padding: "4px 0" }}>{d}</div>
                ))}
              </div>
 
              {/* Calendar weeks */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" }}>
                  {week.map((day, di) => (
                    <div key={di} style={{ padding: "3px 0", position: "relative" }}>
                      {day && (
                        <button
                          onClick={() => setSelectedDay(day)}
                          style={{
                            width: "28px", height: "28px",
                            borderRadius: "50%", border: "none",
                            backgroundColor: selectedDay === day ? THEME.accent : "transparent",
                            color: selectedDay === day ? "#fff" : "#334155",
                            fontSize: "12.5px", fontWeight: selectedDay === day ? 700 : 400,
                            cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          {day}
                          {JUNE_2026.dotDays.includes(day) && (
                            <span style={{
                              position: "absolute", bottom: "2px",
                              left: "50%", transform: "translateX(-50%)",
                              width: "4px", height: "4px",
                              backgroundColor: selectedDay === day ? "#fff" : THEME.accent,
                              borderRadius: "50%",
                            }} />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
 
              {/* Today's hearings */}
              <div style={{ marginTop: "16px" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#1E2A45", marginBottom: "10px" }}>
                  Today's hearings
                </p>
                {todaysHearings.map((h, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "12px",
                    borderLeft: `3px solid ${THEME.accent}`,
                    paddingLeft: "10px", marginBottom: "10px",
                    backgroundColor: THEME.panel, borderRadius: "0 6px 6px 0",
                    padding: "8px 10px",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: THEME.accent, minWidth: "36px" }}>{h.time}</span>
                    <div>
                      <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#1E2A45", margin: "0 0 2px" }}>{h.case}</p>
                      <p style={{ fontSize: "11.5px", color: "#64748B", margin: 0 }}>
                        {h.judge} · {h.courtroom}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}