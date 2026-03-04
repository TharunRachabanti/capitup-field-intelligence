import { Link, useLocation } from 'react-router-dom'

export default function Sidebar({ showUser, showLegend, showStats, statsContent }) {
    const location = useLocation()

    return (
        <div className="sidebar">
            <div className="sidebar-logo">CAPITUP</div>

            {showUser && (
                <div className="sidebar-user">
                    <div className="user-avatar">F</div>
                    <div>
                        <div className="user-name">Founder View</div>
                        <div className="user-role">Full Access</div>
                    </div>
                </div>
            )}

            <nav className="sidebar-nav">
                <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                    📊 Dashboard
                </Link>
                <Link to="/bot" className={`nav-item ${location.pathname === '/bot' ? 'active' : ''}`}>
                    🤖 Chat Bot
                </Link>
                <Link to="/calendar" className={`nav-item ${location.pathname === '/calendar' ? 'active' : ''}`}>
                    📅 Calendar
                </Link>
            </nav>

            {showLegend && (
                <div className="sidebar-legend">
                    <div className="legend-title">RENEWAL STATUS</div>
                    <div className="legend-item"><span className="legend-dot red"></span> Critical (≤30 days)</div>
                    <div className="legend-item"><span className="legend-dot yellow"></span> Warning (≤60 days)</div>
                    <div className="legend-item"><span className="legend-dot green"></span> Upcoming (≤90 days)</div>
                    <div className="legend-item"><span className="legend-dot blue"></span> Tracked (90+ days)</div>
                </div>
            )}

            {showStats && statsContent && (
                <div className="sidebar-stats">{statsContent}</div>
            )}
        </div>
    )
}
