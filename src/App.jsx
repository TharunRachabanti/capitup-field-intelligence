import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import FieldBot from './pages/FieldBot'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'

function MobileNav() {
  const location = useLocation()
  return (
    <div className="mobile-nav">
      <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <div className="mobile-nav-icon">📊</div>
        <span>Dashboard</span>
      </Link>
      <Link to="/bot" className={`mobile-nav-item ${location.pathname === '/bot' ? 'active' : ''}`}>
        <div className="mobile-nav-icon">🤖</div>
        <span>Chat Bot</span>
      </Link>
      <Link to="/calendar" className={`mobile-nav-item ${location.pathname === '/calendar' ? 'active' : ''}`}>
        <div className="mobile-nav-icon">📅</div>
        <span>Calendar</span>
      </Link>
    </div>
  )
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bot" element={<FieldBot />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <MobileNav />
    </>
  )
}

export default App
