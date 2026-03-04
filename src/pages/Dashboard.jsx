import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import '../styles/dashboard.css'

// Sample data for demo purposes
function getDateOffset(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

const SAMPLE_DATA = [
    { clientId: 'CL-0001', clientName: 'Ramesh Gupta', companyName: 'Gupta Textiles Pvt Ltd', designation: 'MD', phone: '9876543210', email: 'ramesh@guptatextiles.com', natureBusiness: 'Manufacturing', currentInsurer: 'New India Assurance', policyType: 'Fire & Allied Perils', sumInsured: '2.5 Crore', premium: '1.25L', policyStart: '2024-04-01', renewalDate: getDateOffset(18), satisfaction: '😞 Unhappy', competitorInfo: 'Yes - another broker approached', notes: 'Had claim issue last year. Very interested in switching.', opportunityScore: 85, opportunityLabel: '🔥 HOT LEAD', visitDate: '2025-03-01', gps: '28.6234°N, 77.2090°E', submittedAt: new Date().toISOString() },
    { clientId: 'CL-0002', clientName: 'Sunita Mehta', companyName: 'MedCare Hospitals', designation: 'CFO', phone: '9123456780', email: 'sunita@medcare.in', natureBusiness: 'Healthcare', currentInsurer: 'Star Health', policyType: 'Group Health Insurance', sumInsured: '5L per person', premium: '8.40L', policyStart: '2024-06-15', renewalDate: getDateOffset(22), satisfaction: '😐 Okay / Neutral', competitorInfo: 'none', notes: '250 employees. Wants better network hospitals.', opportunityScore: 72, opportunityLabel: '🟡 WARM LEAD', visitDate: '2025-02-28', gps: '19.0760°N, 72.8777°E', submittedAt: new Date().toISOString() },
    { clientId: 'CL-0003', clientName: 'Vikram Nair', companyName: 'CloudSoft Technologies', designation: 'CEO', phone: '9988776655', email: 'vikram@cloudsoft.io', natureBusiness: 'IT/Technology', currentInsurer: 'HDFC Ergo', policyType: 'Cyber Insurance', sumInsured: '1 Crore', premium: '2.20L', policyStart: '2024-03-10', renewalDate: getDateOffset(35), satisfaction: '😊 Very Happy', competitorInfo: 'none', notes: 'Wants to add Professional Indemnity next year.', opportunityScore: 45, opportunityLabel: '🟡 WARM LEAD', visitDate: '2025-02-25', gps: '12.9716°N, 77.5946°E', submittedAt: new Date().toISOString() },
    { clientId: 'CL-0004', clientName: 'Anita Sharma', companyName: 'Sharma Pharma Exports', designation: 'Partner', phone: '9765432100', email: 'anita@sharmapharma.com', natureBusiness: 'Trading', currentInsurer: 'Bajaj Allianz', policyType: 'Marine Cargo', sumInsured: '50L per shipment', premium: '3.80L', policyStart: '2024-05-01', renewalDate: getDateOffset(55), satisfaction: '😐 Okay / Neutral', competitorInfo: 'Direct with insurer', notes: 'Ships to UAE and Singapore monthly.', opportunityScore: 58, opportunityLabel: '🟡 WARM LEAD', visitDate: '2025-02-20', gps: '23.0225°N, 72.5714°E', submittedAt: new Date().toISOString() },
    { clientId: 'CL-0005', clientName: 'Deepak Joshi', companyName: 'Joshi Logistics Ltd', designation: 'Owner', phone: '9654321890', email: 'deepak@joshilogistics.com', natureBusiness: 'Logistics', currentInsurer: 'ICICI Lombard', policyType: 'Motor Fleet', sumInsured: '15 vehicles', premium: '1.60L', policyStart: '2024-07-01', renewalDate: getDateOffset(78), satisfaction: '😊 Very Happy', competitorInfo: 'none', notes: 'Expanding fleet by 5 vehicles next quarter.', opportunityScore: 32, opportunityLabel: '🔵 COLD / NURTURE', visitDate: '2025-02-15', gps: '28.7041°N, 77.1025°E', submittedAt: new Date().toISOString() },
    { clientId: 'CL-0006', clientName: 'Priya Venkatesh', companyName: 'Venkatesh Constructions', designation: 'MD', phone: '9543218760', email: 'priya@vkconstructions.com', natureBusiness: 'Construction', currentInsurer: 'United India', policyType: 'Contractors All Risk', sumInsured: '10 Crore', premium: '4.50L', policyStart: '2024-02-01', renewalDate: getDateOffset(12), satisfaction: '🔥 Very Dissatisfied - Wants to Switch', competitorInfo: 'Yes - another broker approached', notes: 'Had dispute on claim. Actively looking for new broker.', opportunityScore: 97, opportunityLabel: '🔥 HOT LEAD', visitDate: '2025-03-03', gps: '17.3850°N, 78.4867°E', submittedAt: new Date().toISOString() },
]


function getClients() {
    return JSON.parse(localStorage.getItem('capitup_clients') || '[]')
}

function daysUntil(dateStr) {
    const d = new Date(dateStr)
    const t = new Date(); t.setHours(0, 0, 0, 0)
    return Math.round((d - t) / (1000 * 60 * 60 * 24))
}

function getStatus(days) {
    if (days <= 0) return { label: '⛔ Expired', cls: 'pill-red' }
    if (days <= 30) return { label: '🔴 Critical', cls: 'pill-red' }
    if (days <= 60) return { label: '🟡 Warning', cls: 'pill-yellow' }
    if (days <= 90) return { label: '🟢 Upcoming', cls: 'pill-green' }
    return { label: '🔵 Tracked', cls: 'pill-blue' }
}

function getScoreClass(label) {
    if (label?.includes('HOT')) return 'score-hot-pill'
    if (label?.includes('WARM')) return 'score-warm-pill'
    return 'score-cold-pill'
}


export default function Dashboard() {
    const navigate = useNavigate()
    const [clients, setClients] = useState([])
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')

    const loadClients = useCallback(() => {
        setClients(getClients())
    }, [])

    useEffect(() => { loadClients() }, [loadClients])

    function loadSampleData() {
        const existing = getClients()
        const existingIds = new Set(existing.map(c => c.clientId))
        const newSamples = SAMPLE_DATA.filter(s => !existingIds.has(s.clientId))
        const merged = [...existing, ...newSamples]
        localStorage.setItem('capitup_clients', JSON.stringify(merged))
        loadClients()
    }

    // Filtered clients for the table
    let filteredClients = [...clients]
    if (search) {
        const s = search.toLowerCase()
        filteredClients = filteredClients.filter(c =>
            c.clientName?.toLowerCase().includes(s) ||
            c.companyName?.toLowerCase().includes(s) ||
            c.policyType?.toLowerCase().includes(s)
        )
    }
    if (filter === 'critical') filteredClients = filteredClients.filter(c => daysUntil(c.renewalDate) <= 30)
    if (filter === 'warning') filteredClients = filteredClients.filter(c => { const d = daysUntil(c.renewalDate); return d > 30 && d <= 60 })
    if (filter === 'hot') filteredClients = filteredClients.filter(c => c.opportunityLabel?.includes('HOT'))

    // KPI Calculations
    const total = clients.length
    const critical = clients.filter(c => daysUntil(c.renewalDate) <= 30).length
    const warning = clients.filter(c => { const d = daysUntil(c.renewalDate); return d > 30 && d <= 60 }).length
    const hot = clients.filter(c => c.opportunityLabel?.includes('HOT')).length

    const premiums = clients.map(c => {
        const p = c.premium?.toString().replace(/[₹,L\s]/gi, '')
        const num = parseFloat(p)
        return isNaN(num) ? 0 : (c.premium?.toString().toLowerCase().includes('l') ? num : num / 100000)
    })
    const totalPremium = premiums.reduce((a, b) => a + b, 0).toFixed(2)

    const insurers = {}
    clients.forEach(c => { if (c.currentInsurer) insurers[c.currentInsurer] = (insurers[c.currentInsurer] || 0) + 1 })
    const topCompetitor = Object.entries(insurers).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const sortedInsurers = Object.entries(insurers).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const maxInsurer = sortedInsurers[0]?.[1] || 1

    // Hot leads
    const hotLeads = clients
        .filter(c => (c.opportunityScore || 0) >= 60)
        .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
        .slice(0, 5)

    const todayStr = new Date().toISOString().split('T')[0]
    const addedToday = clients.filter(c => c.visitDate === todayStr).length

    const kpis = [
        { icon: '👥', val: total, label: 'Total Clients', badge: `${addedToday} added today`, badgeClass: 'badge-green' },
        { icon: '🔴', val: critical, label: 'Critical Renewals', badge: 'Act immediately', badgeClass: 'badge-red', valClass: 'red' },
        { icon: '🟡', val: warning, label: 'Renewals (30–60 days)', badge: 'Prepare RFQ', badgeClass: 'badge-yellow', valClass: 'yellow' },
        { icon: '🔥', val: hot, label: 'Hot Leads', badge: 'High conversion', badgeClass: 'badge-red', valClass: 'red' },
        { icon: '💰', val: `₹${totalPremium}L`, label: 'Premium at Stake', badge: 'Next 90 days', badgeClass: 'badge-yellow' },
        { icon: '🏢', val: topCompetitor, label: 'Top Competitor', badge: 'Most policies', badgeClass: 'badge-yellow' },
    ]

    if (!clients.length) {
        return (
            <div className="app-layout">
                <Sidebar showUser />
                <div className="main-area">
                    <div className="page-header">
                        <div>
                            <div className="page-title">Intelligence Dashboard</div>
                            <div className="page-sub">Live Database View</div>
                        </div>
                        <div className="header-actions">
                            <button className="btn-outline" onClick={loadClients}>{loading ? '⏳ Loading...' : '🔄 Refresh Data'}</button>
                            <button className="btn-outline" onClick={() => navigate('/')}>➕ Log Visit</button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="empty-state">
                            <div className="empty-icon">⏳</div>
                            <div className="empty-title">Fetching from Database...</div>
                            <div className="empty-sub">Connecting to Google Sheets securely.</div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <div className="empty-title">No clients yet</div>
                            <div className="empty-sub">Use the Field Bot to log your first client visit or check your database connection.</div>
                            <button className="btn-primary-sm" onClick={loadClients}>🔄 Refresh Data</button>
                            <br />
                            <button className="btn-secondary-sm" style={{ marginTop: '8px' }} onClick={() => navigate('/')}>🤖 Open Field Bot</button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="app-layout">
            <Sidebar showUser />
            <div className="main-area">
                {/* HEADER */}
                <div className="page-header">
                    <div>
                        <div className="page-title">Intelligence Dashboard</div>
                        <div className="page-sub">Live Database View</div>
                    </div>
                    <div className="header-actions">
                        <button className="btn-outline" onClick={loadClients}>{loading ? '⏳ Loading...' : '🔄 Refresh Data'}</button>
                        <button className="btn-outline" onClick={() => navigate('/')}>➕ Log Visit</button>
                    </div>
                </div>

                {/* KPI GRID */}
                <div className="kpi-grid">
                    {kpis.map((k, i) => (
                        <div key={i} className="kpi-card">
                            <div className="kpi-icon">{k.icon}</div>
                            <div className={`kpi-val ${k.valClass || ''}`}>{k.val}</div>
                            <div className="kpi-label">{k.label}</div>
                            <span className={`kpi-badge ${k.badgeClass}`}>{k.badge}</span>
                        </div>
                    ))}
                </div>

                {/* HOT LEADS + COMPETITOR MAP */}
                <div className="two-col-grid">
                    <div className="card">
                        <div className="card-title">🔥 Hot Leads — Act Now</div>
                        {hotLeads.length === 0 ? (
                            <div style={{ color: '#484f58', fontSize: '13px', padding: '10px 0' }}>No hot leads yet</div>
                        ) : (
                            hotLeads.map((c, i) => {
                                const days = daysUntil(c.renewalDate)
                                return (
                                    <div key={i} className="hot-lead-item">
                                        <div>
                                            <div className="hot-lead-name">{c.clientName}</div>
                                            <div className="hot-lead-meta">{c.companyName} · {days} days · {c.premium}</div>
                                        </div>
                                        <span className={`hot-lead-score ${getScoreClass(c.opportunityLabel)}`}>{c.opportunityScore}/100</span>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    <div className="card">
                        <div className="card-title">🏢 Competitor Dominance Map</div>
                        {sortedInsurers.length === 0 ? (
                            <div style={{ color: '#484f58', fontSize: '13px' }}>No data yet</div>
                        ) : (
                            sortedInsurers.map(([name, count], i) => (
                                <div key={i} className="comp-item">
                                    <span className="comp-name">{name}</span>
                                    <div className="comp-bar-wrap">
                                        <div className="comp-bar" style={{ width: `${(count / maxInsurer) * 100}%` }}></div>
                                    </div>
                                    <span className="comp-count">{count}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* CLIENT TABLE */}
                <div className="card">
                    <div className="card-header-row">
                        <div className="card-title">👥 All Clients</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search clients..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                                <option value="all">All Status</option>
                                <option value="critical">Critical</option>
                                <option value="warning">Warning</option>
                                <option value="hot">Hot Leads</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Company</th>
                                    <th>Policy</th>
                                    <th>Renewal</th>
                                    <th>Premium</th>
                                    <th>Score</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#484f58' }}>No clients found</td></tr>
                                ) : (
                                    filteredClients.map((c, i) => {
                                        const days = daysUntil(c.renewalDate)
                                        const status = getStatus(days)
                                        const scoreClass = getScoreClass(c.opportunityLabel)
                                        const renewalDisplay = new Date(c.renewalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <div className="client-name-cell">{c.clientName}</div>
                                                    <div className="client-id-cell">{c.clientId || '—'}</div>
                                                </td>
                                                <td>{c.companyName}</td>
                                                <td>{c.policyType}</td>
                                                <td>
                                                    <div>{renewalDisplay}</div>
                                                    <div style={{ fontSize: '11px', color: '#7d8590' }}>{days} days</div>
                                                </td>
                                                <td>{c.premium}</td>
                                                <td><span className={`score-pill ${scoreClass}`}>{c.opportunityScore || 0}/100</span></td>
                                                <td><span className={`status-pill ${status.cls}`}>{status.label}</span></td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
