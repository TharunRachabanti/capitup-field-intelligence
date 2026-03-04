import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import Sidebar from '../components/Sidebar'
import { HamburgerBtn } from '../App'
import '../styles/dashboard.css'


function getClients() {
    return JSON.parse(localStorage.getItem('capitup_clients') || '[]')
}

function daysUntil(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((d - today) / (1000 * 60 * 60 * 24))
}

function getEventColor(days) {
    if (days <= 30) return { bg: '#da3633', border: '#b91c1c', text: '#fff' }
    if (days <= 60) return { bg: '#d4a843', border: '#b45309', text: '#0d1117' }
    if (days <= 90) return { bg: '#238636', border: '#15803d', text: '#fff' }
    return { bg: '#1d4ed8', border: '#1e40af', text: '#fff' }
}

export default function Calendar({ openDrawer }) {
    const navigate = useNavigate()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [popup, setPopup] = useState(null)
    const calendarRef = useRef(null)

    const currentDate = new Date()
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

    const years = Array.from({ length: 12 }, (_, i) => currentDate.getFullYear() - 2 + i)
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    function handleDateJump(m, y) {
        setSelectedMonth(m)
        setSelectedYear(y)
        if (calendarRef.current) {
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`
            calendarRef.current.getApi().gotoDate(dateStr)
        }
    }

    const loadClients = useCallback(async () => {
        setLoading(true)
        try {
            const url = import.meta.env.VITE_APPS_SCRIPT_URL
            if (!url) {
                setClients(JSON.parse(localStorage.getItem('capitup_clients') || '[]'))
                setLoading(false)
                return
            }

            const res = await fetch(`${url}?action=getAll`)
            const data = await res.json()

            if (data.status === 'success' && data.data) {
                setClients(data.data)
                localStorage.setItem('capitup_clients', JSON.stringify(data.data))
            } else if (data.status === 'ok') {
                alert("⚠️ PLEASE READ: The Dashboard cannot fetch your data because the Google Apps Script was just 'Saved' but not deployed as a 'New Version'.\n\nPlease go to Apps Script -> Deploy -> Manage Deployments -> Edit -> Select 'New Version' -> Deploy.")
                setClients(JSON.parse(localStorage.getItem('capitup_clients') || '[]'))
            } else {
                setClients(JSON.parse(localStorage.getItem('capitup_clients') || '[]'))
            }
        } catch (error) {
            console.error("Calendar fetch error:", error)
            setClients(JSON.parse(localStorage.getItem('capitup_clients') || '[]'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadClients() }, [loadClients])

    // Stats
    const critical = clients.filter(c => daysUntil(c.renewalDate) <= 30).length
    const warning = clients.filter(c => { const d = daysUntil(c.renewalDate); return d > 30 && d <= 60 }).length
    const upcoming = clients.filter(c => { const d = daysUntil(c.renewalDate); return d > 60 && d <= 90 }).length
    const total = clients.length

    // Calendar events
    const events = clients.map(c => {
        const days = daysUntil(c.renewalDate)
        const col = getEventColor(days)
        return {
            id: c.clientId,
            title: c.clientName,
            start: c.renewalDate,
            backgroundColor: col.bg,
            borderColor: col.border,
            textColor: col.text,
            extendedProps: { client: c, days }
        }
    })

    function openPopup(client, days) {
        setPopup({ client, days })
    }

    function closePopup() {
        setPopup(null)
    }

    const statsContent = (
        <>
            <div className="stat-mini"><div className="stat-mini-num red">{critical}</div><div className="stat-mini-lab">Critical</div></div>
            <div className="stat-mini"><div className="stat-mini-num yellow">{warning}</div><div className="stat-mini-lab">Warning</div></div>
            <div className="stat-mini"><div className="stat-mini-num green">{upcoming}</div><div className="stat-mini-lab">Upcoming</div></div>
            <div className="stat-mini"><div className="stat-mini-num">{total}</div><div className="stat-mini-lab">Total</div></div>
        </>
    )

    const popClient = popup?.client
    const popDays = popup?.days || 0
    const popColor = popClient ? getEventColor(popDays) : null
    const statusLabel = popDays <= 30 ? '🔴 CRITICAL — Act Immediately' :
        popDays <= 60 ? '🟡 WARNING — Prepare RFQ' :
            popDays <= 90 ? '🟢 UPCOMING — Follow Up' : '🔵 TRACKED'

    return (
        <div className="app-layout">
            <Sidebar showLegend showStats statsContent={statsContent} />

            <div className="main-area">
                {/* Mobile-only header with hamburger */}
                <div className="mobile-header">
                    <HamburgerBtn onClick={openDrawer} />
                    <span className="mobile-header-title">Calendar</span>
                </div>
                <div className="page-header">
                    <div>
                        <div className="page-title">Renewal Intelligence Calendar</div>
                        <div className="page-sub">
                            {total} clients tracked · {critical} critical renewals · Act now
                        </div>
                    </div>
                    <div className="header-actions">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span style={{ fontSize: '10px', color: '#7d8590', fontWeight: 'bold' }}>JUMP TO MONTH</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <select
                                    className="btn-outline"
                                    style={{ padding: '6px 10px', width: 'auto' }}
                                    value={selectedMonth}
                                    onChange={(e) => handleDateJump(parseInt(e.target.value), selectedYear)}
                                >
                                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                                <select
                                    className="btn-outline"
                                    style={{ padding: '6px 10px', width: 'auto' }}
                                    value={selectedYear}
                                    onChange={(e) => handleDateJump(selectedMonth, parseInt(e.target.value))}
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <button className="btn-outline" onClick={loadClients} style={{ alignSelf: 'flex-end' }}>{loading ? '⏳ Loading...' : '🔄 Refresh Data'}</button>
                    </div>
                </div>

                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,listMonth'
                    }}
                    events={events}
                    eventClick={(info) => {
                        const { client, days } = info.event.extendedProps
                        openPopup(client, days)
                    }}
                    height="auto"
                    eventDisplay="block"
                />
            </div>

            {/* CLIENT DETAIL POPUP */}
            {popup && popClient && (
                <div className="popup-overlay" onClick={closePopup}>
                    <div className="client-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header" style={{ borderLeft: `4px solid ${popColor?.bg}` }}>
                            <div>
                                <div className="popup-name">{popClient.clientName}</div>
                                <div className="popup-company">{popClient.companyName} · {popClient.policyType}</div>
                            </div>
                            <button className="popup-close" onClick={closePopup}>✕</button>
                        </div>
                        <div className="popup-body">
                            <div className="popup-status" style={{
                                background: `${popColor?.bg}20`,
                                color: popColor?.bg,
                                border: `1px solid ${popColor?.bg}40`
                            }}>
                                {statusLabel} · {popDays} days remaining
                            </div>
                            <div className="popup-grid">
                                {[
                                    ['Current Insurer', popClient.currentInsurer],
                                    ['Policy Type', popClient.policyType],
                                    ['Sum Insured', popClient.sumInsured],
                                    ['Premium', popClient.premium],
                                    ['Renewal Date', new Date(popClient.renewalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
                                    ['Satisfaction', popClient.satisfaction],
                                    ['Phone', popClient.phone],
                                    ['Nature', popClient.natureBusiness],
                                    ['Opportunity Score', `${popClient.opportunityLabel} (${popClient.opportunityScore}/100)`],
                                    ['Last Visit', popClient.visitDate],
                                    ['GPS Location', popClient.gps || '—'],
                                    ['Notes', popClient.notes],
                                ].map(([label, val], i) => (
                                    <div key={i} className="popup-row">
                                        <span className="pop-label">{label}</span>
                                        <span className="pop-val">{val}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="popup-actions">
                                <button className="btn-primary-sm" onClick={() => alert('RFQ preparation would start here in production')}>📋 Start RFQ</button>
                                <button className="btn-secondary-sm" onClick={() => alert('Call feature in production')}>📞 Call Client</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
