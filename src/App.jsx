import { useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import FieldBot from './pages/FieldBot'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'

// ── SHARED MOBILE DRAWER ──
export function MobileDrawer({ open, onClose }) {
  const location = useLocation()

  const links = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/bot', icon: '🤖', label: 'Chat Bot' },
    { to: '/calendar', icon: '📅', label: 'Calendar' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className={`mobile-drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-logo">CAPITUP</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close menu">✕</button>
        </div>

        <nav className="drawer-nav">
          {links.map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`drawer-nav-item ${location.pathname === to ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="drawer-nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="drawer-footer">
          Field Intelligence Platform · v1.0
        </div>
      </div>
    </>
  )
}

// ── HAMBURGER BUTTON ──
export function HamburgerBtn({ onClick }) {
  return (
    <button className="ham-btn" onClick={onClick} aria-label="Open menu">
      ☰
    </button>
  )
}

// ── APP WRAPPER ──
function AppWithDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard openDrawer={() => setDrawerOpen(true)} />} />
        <Route path="/bot" element={<FieldBot openDrawer={() => setDrawerOpen(true)} />} />
        <Route path="/calendar" element={<Calendar openDrawer={() => setDrawerOpen(true)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

export default AppWithDrawer
