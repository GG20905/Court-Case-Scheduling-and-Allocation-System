import { useState } from "react";
import Navbar from "../components/Navbar";
 
const mockCases = [
  { id: "CR/041/26", title: "State v. Kamau", status: "Urgent", date: "04 Jun" },
  { id: "CV/112/26", title: "Otieno v. KCB Ltd", status: "Active", date: "05 Jun" },
  { id: "FM/008/26", title: "Njeri v. Njeri", status: "Pending", date: "09 Jun" },
  { id: "LC/053/26", title: "Wanjiku v. Nairobi CC", status: "Active", date: "10 Jun" },
  { id: "CR/029/26", title: "State v. Mwangi et al", status: "Concluded", date: "02 Jun" },
];
 
const statusStyles = {
  Urgent: { backgroundColor: "#FEE2E2", color: "#DC2626" },
  Active: { backgroundColor: "#DBEAFE", color: "#1D4ED8" },
  Pending: { backgroundColor: "#FEF9C3", color: "#B45309" },
  Concluded: { backgroundColor: "#DCFCE7", color: "#15803D" },
};
 
const navItems = ["Dashboard", "Cases", "Documents"];
const sidebarItems = ["My Cases", "My Hearings", "My Documents"];

const THEME = {
  pageBg: "#f5f7fc",
  navPrimary: "#0d1652",
  navText: "#d2ddff",
  accent: "#1a3a8c",
  accentSoft: "#deeaf7",
  panel: "#eef2fa",
  border: "#a8bfe0",
};
 
export default function LitigantDashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [activeSidebar, setActiveSidebar] = useState("Dashboard");
 
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", backgroundColor: THEME.pageBg }}>
      <Navbar />

      {/* Top bar label */}
      <div style={{ backgroundColor: THEME.navPrimary, color: THEME.navText, fontSize: "13px", padding: "8px 24px" }}>
        Litigant / Advocate dashboard
      </div>
 
      {/* Navbar */}
      <nav style={{
        backgroundColor: THEME.navPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "0 24px",
        position: "relative",
        height: "56px",
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
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: activeNav === item ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {item}
          </button>
        ))}
        {/* Profile icon */}
        <div style={{ position: "absolute", right: "24px", top: "50%", transform: "translateY(-50%)" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            border: `2px solid ${THEME.border}`, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={THEME.navText} strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </nav>
 
      <div style={{ display: "flex", minHeight: "calc(100vh - 92px)" }}>
        {/* Sidebar */}
        <aside style={{
          width: "180px",
          backgroundColor: THEME.panel,
          borderRight: `1px solid ${THEME.border}`,
          padding: "24px 0",
          flexShrink: 0,
        }}>
          <div style={{
            margin: "0 12px 16px 12px",
            backgroundColor: THEME.accent,
            color: "#fff",
            borderRadius: "6px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 600,
          }}>
            Dashboard
          </div>
          {sidebarItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveSidebar(item)}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                border: "none",
                textAlign: "left",
                padding: "10px 28px",
                fontSize: "13.5px",
                color: activeSidebar === item ? THEME.accent : "#475569",
                fontWeight: activeSidebar === item ? 600 : 400,
                cursor: "pointer",
                borderLeft: activeSidebar === item ? `3px solid ${THEME.accent}` : "3px solid transparent",
              }}
            >
              {item}
            </button>
          ))}
        </aside>
 
        {/* Main content */}
        <main style={{ flex: 1, padding: "28px 32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: THEME.navPrimary, marginBottom: "20px" }}>
            Overview
          </h2>
 
          {/* Stats cards */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "My cases", value: "1" },
              { label: "Next Hearing", value: "Tomorrow", sub: "10:00 AM" },
              { label: "Pending Documents", value: "1" },
            ].map((card, i) => (
              <div key={i} style={{
                flex: 1, backgroundColor: "#fff", borderRadius: "10px",
                border: `1px solid ${THEME.border}`, padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>{card.label}</p>
                <p style={{ fontSize: card.value === "Tomorrow" ? "22px" : "26px", fontWeight: 700, color: THEME.accent, margin: 0 }}>
                  {card.value}
                </p>
                {card.sub && (
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>{card.sub}</p>
                )}
              </div>
            ))}
          </div>
 
          {/* Lower section */}
          <div style={{
            backgroundColor: "#fff", borderRadius: "10px",
            border: `1px solid ${THEME.border}`, padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex", gap: "32px",
          }}>
            {/* Schedule hearing CTA */}
            <div style={{ flex: "0 0 260px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: THEME.navPrimary, marginBottom: "12px" }}>
                Want to Add a Hearing?<br />Click here
              </h3>
              <button style={{
                backgroundColor: THEME.accent, color: "#fff",
                border: "none", borderRadius: "6px",
                padding: "10px 20px", fontSize: "14px",
                fontWeight: 600, cursor: "pointer",
              }}>
                Schedule hearing
              </button>
            </div>
 
            {/* Recent cases */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.navPrimary }}>Recent cases</span>
                <span style={{ fontSize: "12px", color: THEME.accent, cursor: "pointer" }}>View all →</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {mockCases.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 0", fontSize: "13px", color: THEME.accent, fontWeight: 500, width: "100px" }}>
                        {c.id}
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "#334155" }}>
                        {c.title}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <span style={{
                          ...statusStyles[c.status],
                          borderRadius: "12px", padding: "3px 10px",
                          fontSize: "11.5px", fontWeight: 600,
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 0", fontSize: "13px", color: "#64748B", textAlign: "right" }}>
                        {c.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}