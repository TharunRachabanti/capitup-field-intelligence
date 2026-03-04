import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/bot.css'

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''
const SHEET_URL = import.meta.env.VITE_APPS_SCRIPT_URL || ''

// Bot conversation flow — each step maps to one data field
const FLOW_DEFS = [
    { key: null, botMsg: () => `👋 Hi! I'm your CAPITUP Field Assistant.\n\nAre you logging a *new client visit* or *updating an existing client*?`, quickReplies: ['🆕 New Client', '🔄 Update Existing'] },
    { key: 'clientName', botMsg: () => `Great! What is the client's *full name*?`, quickReplies: [] },
    { key: 'companyName', botMsg: () => `And the *company name*?`, quickReplies: [] },
    { key: 'designation', botMsg: (d) => `What is *${d.clientName}'s* designation?`, quickReplies: ['Owner/MD', 'CFO', 'CEO', 'Manager', 'Partner'] },
    { key: 'phone', botMsg: () => `*Phone number* of the client?`, quickReplies: [] },
    { key: 'email', botMsg: () => `*Email address*? (or type "skip")`, quickReplies: ['skip'] },
    { key: 'natureBusiness', botMsg: (d) => `What is *${d.companyName}'s* nature of business?`, quickReplies: ['Manufacturing', 'Trading', 'IT/Technology', 'Healthcare', 'Construction', 'Logistics', 'Retail', 'Other'] },
    { key: 'currentInsurer', botMsg: () => `Which *insurance company* do they currently use?`, quickReplies: ['New India', 'HDFC Ergo', 'Bajaj Allianz', 'ICICI Lombard', 'Star Health', 'Tata AIG', 'United India', 'Not Sure'] },
    { key: 'policyType', botMsg: () => `What *type of policy* do they have?`, quickReplies: ['Fire & Allied', 'Group Health', 'Marine Cargo', 'Motor Fleet', 'Cyber Insurance', 'Workmen Comp', 'Engineering', 'Multiple'] },
    { key: 'sumInsured', botMsg: () => `What is the *Sum Insured*? (approximate is fine)`, quickReplies: ['Below 50L', '50L - 1Cr', '1Cr - 5Cr', '5Cr - 25Cr', 'Above 25Cr'] },
    { key: 'premium', botMsg: () => `Approximate *annual premium amount*?`, quickReplies: [] },
    { key: 'policyStart', botMsg: () => `*Policy start date*? (e.g. 15 Jan 2025 or 01/01/2025)`, quickReplies: [] },
    { key: 'renewalDate', botMsg: () => `*Renewal / expiry date*? This will be added to the calendar automatically 📅`, quickReplies: [] },
    { key: 'satisfaction', botMsg: (d) => `Is *${d.clientName}* happy with their current insurer?`, quickReplies: ['😊 Very Happy', '😐 Okay / Neutral', '😞 Unhappy', '🔥 Very Dissatisfied - Wants to Switch'] },
    { key: 'competitorInfo', botMsg: () => `Any *competitor broker* involved? (or type "none")`, quickReplies: ['none', 'Yes - another broker approached', 'Direct with insurer'] },
    { key: 'notes', botMsg: () => `Any *additional notes* from this meeting? (claims history, special requests, anything important)`, quickReplies: ['No additional notes'] },
]

// Utility fns
function getTime() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseDate(str) {
    if (!str) return ''
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    str = str.trim().toLowerCase()
    const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) {
        const d = new Date(+dmyMatch[3], +dmyMatch[2] - 1, +dmyMatch[1])
        if (!isNaN(d)) return d.toISOString().split('T')[0]
    }
    const textMatch = str.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
    if (textMatch) {
        const m = months[textMatch[2].slice(0, 3)]
        if (m !== undefined) {
            const d = new Date(+textMatch[3], m, +textMatch[1])
            if (!isNaN(d)) return d.toISOString().split('T')[0]
        }
    }
    const d = new Date(str)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
    return str
}

function formatDateDisplay(isoStr) {
    if (!isoStr || isoStr.length < 8) return isoStr
    const d = new Date(isoStr)
    if (isNaN(d)) return isoStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(isoStr) {
    const d = new Date(isoStr)
    const today = new Date()
    return Math.round((d - today) / (1000 * 60 * 60 * 24))
}

function getCrossSellSuggestions(policyType, nature) {
    const suggestions = {
        'Manufacturing': ['Machinery Breakdown', 'Loss of Profit', 'Workmen Comp', 'Marine Inland Transit'],
        'IT/Technology': ['Cyber Insurance', 'Professional Indemnity', 'Directors & Officers'],
        'Healthcare': ['Group Health', 'Professional Indemnity', 'Fire & Allied', 'D&O'],
        'Construction': ['Contractors All Risk', 'Workmen Comp', 'Engineering', 'Marine'],
        'Logistics': ['Motor Fleet', 'Marine Cargo', 'Goods In Transit', 'Fire & Allied'],
        'Trading': ['Fire & Allied', 'Marine Cargo', 'Burglary', 'Group Health'],
        'Retail': ['Fire & Allied', 'Burglary', 'Group Health', 'Plate Glass'],
        'default': ['Group Health', 'Fire & Allied', 'Marine', 'Workmen Comp']
    }
    const all = suggestions[nature] || suggestions['default']
    const has = policyType || ''
    return all.filter(p => !has.toLowerCase().includes(p.toLowerCase().split(' ')[0].toLowerCase()))
}

function calculateScore(data) {
    let score = 0
    const renewal = new Date(data.renewalDate)
    const today = new Date()
    const days = Math.round((renewal - today) / (1000 * 60 * 60 * 24))

    if (days <= 30) score += 40
    else if (days <= 60) score += 25
    else if (days <= 90) score += 15

    if (data.satisfaction?.includes('Dissatisfied') || data.satisfaction?.includes('Switch')) score += 35
    else if (data.satisfaction?.includes('Unhappy')) score += 20

    // Only add competitor points if we have actually collected this data
    const competitor = data.competitorInfo || 'none'
    if (competitor !== 'none') score += 15

    const crossSell = getCrossSellSuggestions(data.policyType, data.natureBusiness)
    score += Math.min(crossSell.length * 3, 10)

    if (score >= 70) return { label: '🔥 HOT LEAD', className: 'score-hot', score }
    if (score >= 40) return { label: '🟡 WARM LEAD', className: 'score-warm', score }
    return { label: '🔵 COLD / NURTURE', className: 'score-cold', score }
}

// Detect if user is making small talk / greeting instead of answering the question
function isSmallTalk(input) {
    const lower = input.trim().toLowerCase()
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'namaste', 'howdy', 'sup', 'yo', 'hii', 'hiii', 'helo', 'heyyy', 'what\'s up', 'how are you', 'how r u', 'wassup', 'thanks', 'thank you', 'ok', 'okay', 'hmm', 'haha', 'lol', 'nice', 'great', 'cool', 'bye', 'good', 'fine']
    // Exact match or starts with a greeting
    if (greetings.includes(lower)) return true
    if (greetings.some(g => lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return true
    // Very short non-data responses
    if (lower.length <= 3 && !/^\d+$/.test(lower)) return true
    return false
}

async function getSmallTalkReply(userMessage, currentField, conversationHistory) {
    if (!OPENAI_KEY || OPENAI_KEY === 'paste-your-key-here') {
        // Fallback without AI
        const lower = userMessage.trim().toLowerCase()
        if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey'))
            return `Hey there! 👋 Great to have you. I'm ready to help capture client details. Let's continue!`
        if (lower.includes('how are') || lower.includes('how r'))
            return `I'm doing great, thank you for asking! 😊 Ready to assist you with your field work. Let's continue!`
        if (lower.includes('thank'))
            return `You're welcome! Happy to help. Let's keep going! 💪`
        return `No worries! Let me know when you're ready. 😊 Meanwhile, let's continue with the details.`
    }

    const fieldLabel = FLOW_DEFS.find(f => f.key === currentField)?.key || 'data'
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini', max_tokens: 100,
                messages: [
                    { role: 'system', content: `You are CAPITUP, a warm and friendly Indian insurance field assistant bot. The user just made casual conversation instead of answering a data question. Respond naturally and warmly — acknowledge what they said with personality, use relevant emojis, maybe add a light joke or encouraging comment. Then gently guide them back to the current question about "${fieldLabel}". Be like a friendly coworker, not a robot. Keep it to 2-3 sentences. Use Hinglish touches if appropriate.` },
                    ...conversationHistory.slice(-4),
                    { role: 'user', content: userMessage }
                ]
            })
        })
        const data = await response.json()
        return data.choices?.[0]?.message?.content?.trim() || null
    } catch { return null }
}

async function getAIReply(userMessage, currentField, conversationHistory) {
    if (!OPENAI_KEY || OPENAI_KEY === 'paste-your-key-here') return getFieldFallback(currentField, userMessage)
    const systemPrompt = `You are CAPITUP Field Assistant — a smart, warm, and genuinely engaging insurance bot for Indian brokers. Think of yourself as a friendly colleague who is helping on a field visit.

CURRENT CONTEXT: You just received the answer for "${currentField}".
User said: "${userMessage}"

YOUR PERSONALITY:
- Warm, friendly, and encouraging — like a supportive team member
- You use relevant insurance knowledge to make smart comments
- You add genuine value — not just "got it" responses
- Use emojis naturally (not excessively)
- Occasionally use light Hinglish touches for relatability
- Show that you understand the insurance industry

RESPOND WITH:
1. A warm acknowledgement that shows you understood what they said (1-2 sentences)
2. If relevant, add a brief insight or comment about their answer (e.g., "HDFC Ergo has great claim settlement ratios!" or "Construction — that's a high-risk sector, lots of insurance opportunities!")
3. Do NOT ask the next question — the system handles that automatically

Keep response to 2-3 sentences max. Be natural, never robotic.`

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini', max_tokens: 120,
                messages: [{ role: 'system', content: systemPrompt }, ...conversationHistory.slice(-6), { role: 'user', content: userMessage }]
            })
        })
        const data = await response.json()
        return data.choices?.[0]?.message?.content?.trim() || getFieldFallback(currentField, userMessage)
    } catch { return getFieldFallback(currentField, userMessage) }
}

// Contextual fallback messages when AI is unavailable (rate-limited, no key, etc.)
function getFieldFallback(field, input) {
    const name = input?.trim() || ''
    switch (field) {
        case 'clientName': return `Great to meet **${name}**! 👋 Sounds like a productive visit ahead.`
        case 'companyName': return `**${name}** — nice! Let me note that down. 📝`
        case 'designation': return `${name} — got it! Always good to know who we're dealing with. 🤝`
        case 'phone': return `Phone number saved! 📱 Easy to reach them now.`
        case 'email': return name === 'skip' ? `No worries, we can always get it later! 😊` : `Email noted — important for policy documents! 📧`
        case 'natureBusiness': return `**${name}** — interesting sector! Every industry has unique insurance needs. 🏭`
        case 'currentInsurer': return `**${name}** — good to know who we're competing with! 💪`
        case 'policyType': return `**${name}** — solid coverage choice. Let's make sure they get the best deal! 🛡️`
        case 'sumInsured': return `Got it — **${name}** is a significant coverage amount! 💰`
        case 'premium': return `**${name}** noted. Every rupee counts in this business! 💵`
        case 'policyStart': return `Policy start date locked in! 📅`
        case 'satisfaction': return null // Handled separately with score display
        case 'competitorInfo': return name === 'none' ? `Good — no competition! That's a strong position. 😎` : `Important intelligence captured! This helps strategize. 🧠`
        case 'notes': return `Notes captured perfectly! 📋 Every detail matters.`
        default: return `Got it! 👍 Moving forward.`
    }
}

function saveToLocal(data) {
    const existing = JSON.parse(localStorage.getItem('capitup_clients') || '[]')
    const clientId = 'CL-' + String(existing.length + 1).padStart(4, '0')
    existing.push({ ...data, clientId })
    localStorage.setItem('capitup_clients', JSON.stringify(existing))
}

// ── MESSAGE BUBBLE COMPONENT ──
function MessageBubble({ role, content, extras = {} }) {
    const html = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>')

    return (
        <div className={`msg-row ${role}`}>
            {role === 'bot' && <div className="msg-avatar">C</div>}
            <div className="msg-bubble">
                <span dangerouslySetInnerHTML={{ __html: html }} />
                {extras.location && (
                    <div className="location-tag">📍 {extras.location}</div>
                )}
                {extras.score && (
                    <div className={`score-badge ${extras.score.className}`}>
                        {extras.score.label} · Score: {extras.score.score}/100
                    </div>
                )}
                {extras.crossSell && extras.crossSell.length > 0 && (
                    <div className="crosssell-card">
                        <div className="crosssell-title">💡 CROSS-SELL OPPORTUNITIES DETECTED</div>
                        {extras.crossSell.map((p, i) => (
                            <div key={i} className="crosssell-item"><span className="missing">❌ Missing</span> {p}</div>
                        ))}
                    </div>
                )}
                <div className="msg-time">{getTime()}</div>
            </div>
            {role === 'user' && <div className="msg-avatar" style={{ background: 'linear-gradient(135deg, #58a6ff, #1d4ed8)' }}>E</div>}
        </div>
    )
}

function TypingIndicator() {
    return (
        <div className="msg-row bot">
            <div className="msg-avatar">C</div>
            <div className="typing-bubble">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
            </div>
        </div>
    )
}

// ── MAIN FIELD BOT PAGE ──
export default function FieldBot() {
    const navigate = useNavigate()
    const chatRef = useRef(null)
    const inputRef = useRef(null)
    const photoInputRef = useRef(null)
    const recognitionRef = useRef(null)

    const [messages, setMessages] = useState([])
    const [quickReplies, setQuickReplies] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [step, setStep] = useState(0)
    const [data, setData] = useState({})
    const [convHistory, setConvHistory] = useState([])
    const [locationCaptured, setLocationCaptured] = useState(false)
    const [isRecording, setIsRecording] = useState(false)

    // Modals
    const [showConfirm, setShowConfirm] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [savedScore, setSavedScore] = useState(null)

    // Refs for latest state in async callbacks
    const stepRef = useRef(step)
    const dataRef = useRef(data)
    const convRef = useRef(convHistory)
    const isTypingRef = useRef(isTyping)

    useEffect(() => { stepRef.current = step }, [step])
    useEffect(() => { dataRef.current = data }, [data])
    useEffect(() => { convRef.current = convHistory }, [convHistory])
    useEffect(() => { isTypingRef.current = isTyping }, [isTyping])

    // Scroll to bottom on new messages
    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [messages, isTyping])

    // Capture GPS on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setLocationCaptured(`${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`)
            }, () => { })
        }
    }, [])

    // Setup speech recognition
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SR) return
        const recognition = new SR()
        recognition.lang = 'en-IN'
        recognition.continuous = false
        recognition.interimResults = false
        recognition.onresult = (e) => {
            setInputValue(e.results[0][0].transcript)
            setIsRecording(false)
        }
        recognition.onend = () => setIsRecording(false)
        recognitionRef.current = recognition
    }, [])

    // Initial bot greeting
    useEffect(() => {
        const timer = setTimeout(() => {
            botSpeak(0, {})
        }, 500)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function addBotMsg(content, extras = null, role = 'assistant') {
        const time = getTime()
        setMessages(prev => [...prev, { id: Date.now() + '-' + Math.random().toString(36).substr(2, 5), role, content, time, ...extras }])
    }

    function addUserMsg(content, extras = null) {
        setMessages(prev => [...prev, { id: Date.now() + '-' + Math.random().toString(36).substr(2, 5), role: 'user', content, ...extras }])
    }

    async function botSpeak(s, d) {
        const flowStep = FLOW_DEFS[s]
        if (!flowStep) return
        setIsTyping(true)
        await sleep(800 + Math.random() * 400)
        setIsTyping(false)
        const msg = flowStep.botMsg(d)
        addBotMsg(msg)
        setQuickReplies(flowStep.quickReplies || [])
    }

    // ── INPUT VALIDATION ──
    function validateLocally(field, input) {
        const trimmed = input.trim()
        switch (field) {
            case 'clientName': {
                // Name should be mostly letters, contain vowels, and look like a real name
                if (trimmed.length < 3) return 'That seems too short for a name. Please enter the client\'s full name (e.g., "Rajesh Kumar").'
                if (/\d{2,}/.test(trimmed)) return 'A name shouldn\'t have numbers in it. Please enter a valid name.'
                if (!/[a-zA-Z]{2,}/.test(trimmed)) return 'That doesn\'t look like a name. Please enter the client\'s full name.'
                if (/^[^a-zA-Z\s.']+$/.test(trimmed)) return 'That doesn\'t look like a name. Please enter a proper name like "Amit Patel".'
                // Check for vowels — real names always have vowels
                if (!/[aeiouAEIOU]/.test(trimmed)) return 'That doesn\'t look like a real name. Please enter a proper name (e.g., "Rajesh Kumar").'
                // Check for too many consecutive consonants (gibberish detection)
                if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(trimmed)) return 'That doesn\'t look like a valid name. Please enter the client\'s real name.'
                // Check for repeating characters like "aaaa" or "fffff"
                if (/(.)\1{3,}/.test(trimmed)) return 'That doesn\'t look like a real name. Please try again.'
                return null
            }
            case 'companyName':
                if (trimmed.length < 2) return 'Company name seems too short. Please enter the full company name.'
                if (/^[0-9!@#$%^&*()]+$/.test(trimmed)) return 'That doesn\'t look like a company name. Please enter a valid company name.'
                if (/(.)\1{4,}/.test(trimmed)) return 'That doesn\'t look like a real company name. Please try again.'
                return null
            case 'phone':
                const digits = trimmed.replace(/[\s\-+()]/g, '')
                if (!/^\d{10,13}$/.test(digits)) return 'Please enter a valid 10-digit phone number (e.g., 9876543210).'
                return null
            case 'email':
                if (trimmed.toLowerCase() === 'skip') return null
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'That doesn\'t look like a valid email. Please enter a proper email (e.g., name@company.com) or type "skip".'
                return null
            case 'premium':
                // Allow formats like: 1.5L, 50000, ₹1,20,000, 3L, 8.40L
                if (!/\d/.test(trimmed)) return 'Please enter the premium amount (e.g., "1.5L", "₹50,000", or "120000").'
                return null
            case 'policyStart':
            case 'renewalDate': {
                const parsed = parseDate(trimmed)
                if (!parsed || parsed === trimmed) {
                    return 'I couldn\'t understand that date. Please use a format like "15 Jan 2025", "01/01/2025", or "2025-01-15".'
                }
                if (field === 'renewalDate') {
                    const d = new Date(parsed)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    if (d < today) return 'The renewal date seems to be in the past. Please enter a future date.'
                }
                return null
            }
            default:
                return null
        }
    }

    async function validateWithAI(field, input) {
        if (!OPENAI_KEY || OPENAI_KEY === 'paste-your-key-here') return null
        // Only use AI validation for name-like fields
        if (!['clientName', 'companyName'].includes(field)) return null

        const fieldLabel = field === 'clientName' ? 'person name' : 'company/business name'
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', max_tokens: 40,
                    messages: [{
                        role: 'system',
                        content: `You validate if text is a valid Indian ${fieldLabel}. Reply ONLY "VALID" or "INVALID: <short reason>". Examples of VALID person names: "Rajesh Kumar", "Priya V.", "Amit". Examples of INVALID: "hello", "asdf", "test123", "buy milk".`
                    }, {
                        role: 'user', content: `Is "${input}" a valid ${fieldLabel}?`
                    }]
                })
            })
            const data = await response.json()
            const reply = data.choices?.[0]?.message?.content?.trim() || ''
            if (reply.startsWith('INVALID')) {
                const reason = reply.replace('INVALID:', '').trim()
                return `That doesn't look like a valid ${fieldLabel === 'person name' ? 'name' : 'company name'}. ${reason ? reason : 'Please try again.'}`
            }
            return null
        } catch { return null }
    }

    async function handleUserInput(input) {
        if (isTypingRef.current) return
        if (!input.trim()) return

        setInputValue('')
        setQuickReplies([])
        addUserMsg(input)

        setIsTyping(true)
        isTypingRef.current = true

        const currentStep = stepRef.current
        const currentData = { ...dataRef.current }

        // Step 0 is greeting — engage warmly before starting data collection
        if (currentStep === 0) {
            // Check if user is greeting/chatting instead of picking a visit type
            const isVisitTypeBtn = ['🆕 New Client', '🔄 Update Existing'].includes(input)
            if (!isVisitTypeBtn && isSmallTalk(input)) {
                await sleep(500)
                let chatReply = ''
                if (OPENAI_KEY && OPENAI_KEY !== 'paste-your-key-here') {
                    try {
                        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini', max_tokens: 100,
                                messages: [{
                                    role: 'system',
                                    content: `You are CAPITUP, a warm and friendly Indian insurance field assistant bot. The user just greeted you casually. Respond naturally — be warm, friendly, use emojis. Then gently ask if they'd like to log a new client or update an existing one. Keep it 2-3 sentences. Use Hinglish touches if appropriate.`
                                }, { role: 'user', content: input }]
                            })
                        })
                        const rData = await resp.json()
                        chatReply = rData.choices?.[0]?.message?.content?.trim() || ''
                    } catch { }
                }
                if (!chatReply) {
                    const lower = input.trim().toLowerCase()
                    if (lower.includes('how are') || lower.includes('how r'))
                        chatReply = `I'm doing great, thank you for asking! 😊 Always excited to help with field work.\n\nSo, what's the plan today — new client visit or updating an existing one?`
                    else if (lower.includes('thank'))
                        chatReply = `You're welcome! Happy to help anytime. 💪\n\nShall we get started? New client or existing?`
                    else
                        chatReply = `Hey there! 👋 Great to see you! I'm your CAPITUP field assistant — ready to help!\n\nWould you like to log a new client visit or update an existing one?`
                }
                setIsTyping(false)
                isTypingRef.current = false
                addBotMsg(chatReply)
                await sleep(500)
                setQuickReplies(FLOW_DEFS[0]?.quickReplies || ['🆕 New Client', '🔄 Update Existing'])
                return // Stay on step 0
            }

            currentData.visitType = input
            setData(currentData)
            dataRef.current = currentData

            // Generate a warm AI welcome before asking first question
            let welcomeMsg = ''
            if (OPENAI_KEY && OPENAI_KEY !== 'paste-your-key-here') {
                try {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini', max_tokens: 100,
                            messages: [{
                                role: 'system',
                                content: `You are CAPITUP, a warm and friendly Indian insurance field assistant. The user just started a "${input}" visit. Give them an enthusiastic, warm 2-3 sentence welcome. Be encouraging like a supportive colleague starting a field visit together. Use emojis naturally. Add a motivating line. Don't ask any questions — the system will handle that.`
                            }, { role: 'user', content: input }]
                        })
                    })
                    const respData = await response.json()
                    welcomeMsg = respData.choices?.[0]?.message?.content?.trim() || ''
                } catch { }
            }

            if (!welcomeMsg) {
                // Smart fallback if AI unavailable
                const isNew = input.toLowerCase().includes('new')
                welcomeMsg = isNew
                    ? `Awesome! A new client visit — let's make this one count! 💼🔥\n\nI'll walk you through capturing all the important details step by step. Let's go!`
                    : `Great choice! Let's update the client info together. 📋\n\nI'll make sure everything is captured accurately. Here we go!`
            }

            setIsTyping(false)
            isTypingRef.current = false
            addBotMsg(welcomeMsg)

            const nextStep = 1
            setStep(nextStep)
            stepRef.current = nextStep
            await sleep(800)
            await botSpeak(nextStep, currentData)
            return
        }

        const currentField = FLOW_DEFS[currentStep]?.key

        // Handle DB lookup switch action
        if (currentField === 'clientName' && input === '🆕 Switch to New Client') {
            setIsTyping(false)
            isTypingRef.current = false
            currentData.visitType = '🆕 New Client'
            setData({ ...currentData })
            dataRef.current = currentData
            setConvHistory(prev => [...prev, { role: 'user', content: 'Switched to New Client' }])
            addBotMsg(`Switched to **New Client**. Let's capture their details.\n\nWhat is the client's *full name*?`)
            setQuickReplies([])
            return
        }

        if (currentField === 'clientName' && input === 'Try different name') {
            setIsTyping(false)
            isTypingRef.current = false
            addBotMsg(`Okay, what name should I search for?`)
            setQuickReplies([])
            return
        }

        // Handle greetings / small talk — respond without advancing flow
        const isQuickReplyOption = (FLOW_DEFS[currentStep]?.quickReplies || []).includes(input)
        if (!isQuickReplyOption && isSmallTalk(input)) {
            await sleep(500)
            const chatReply = await getSmallTalkReply(input, currentField, convRef.current)
            setIsTyping(false)
            isTypingRef.current = false
            addBotMsg(chatReply || `Hey! 😊 Let's keep going — I still need that info from you!`)
            // Re-show the current question
            await sleep(600)
            const flowStep = FLOW_DEFS[currentStep]
            if (flowStep) {
                addBotMsg(flowStep.botMsg(currentData))
                setQuickReplies(flowStep.quickReplies || [])
            }
            return // Stay on same step
        }

        // Field-level validation
        const localError = validateLocally(currentField, input)
        if (localError) {
            setIsTyping(false)
            isTypingRef.current = false
            addBotMsg(`⚠️ ${localError}`)
            setQuickReplies(FLOW_DEFS[currentStep]?.quickReplies || [])
            return // Stay on same step
        }

        // Lookup Existing Client Logic — Do this BEFORE AI validation/acknowledgement
        if (currentField === 'clientName' && currentData.visitType === '🔄 Update Existing') {
            setIsTyping(true)
            addBotMsg(`Searching database for **${input}**... 🔍`, null, 'system')

            // Optimistically save the name just in case
            currentData.clientName = input
            setData(currentData)
            dataRef.current = currentData
            setConvHistory(prev => [...prev, { role: 'user', content: input }])

            try {
                const response = await fetch(`${SHEET_URL}?search=${encodeURIComponent(input)}`)
                const result = await response.json()

                if (result.found && result.data) {
                    // Pre-fill existing data
                    const d = result.data
                    currentData.clientName = d.clientName || input
                    currentData.companyName = d.companyName || ''
                    currentData.designation = d.designation || ''
                    currentData.phone = d.phone || ''
                    currentData.email = d.email || ''
                    currentData.natureBusiness = d.natureBusiness || ''
                    currentData.currentInsurer = d.currentInsurer || ''
                    currentData.policyType = d.policyType || ''
                    currentData.sumInsured = d.sumInsured || ''
                    setData({ ...currentData })
                    dataRef.current = currentData

                    setIsTyping(false)
                    isTypingRef.current = false

                    addBotMsg(`Found them! 🎉\n\n**${d.clientName}** from **${d.companyName}**.\n\nI've loaded their existing contact & business info. Let's record the *new renewal details*...`)

                    // Jump straight to premium/renewal section (skip 2-9)
                    const nextStep = 10 // 'premium'
                    setStep(nextStep)
                    stepRef.current = nextStep
                    await sleep(1500)
                    await botSpeak(nextStep, currentData)
                    return
                } else {
                    setIsTyping(false)
                    isTypingRef.current = false
                    addBotMsg(`I couldn't find anyone named **${input}** in our database. 😕\n\nWant to try spelling it differently, or switch to a **New Client**?`, { overrideQuickReplies: ['🆕 Switch to New Client', 'Try different name'] })

                    // Reset field so they can try again
                    currentData.clientName = null
                    setData({ ...currentData })
                    dataRef.current = currentData
                    return // Stay on same step
                }
            } catch (err) {
                console.error("DB Lookup Error:", err)
                setIsTyping(false)
                isTypingRef.current = false
                addBotMsg(`Oops, I couldn't connect to the database right now. Let's just enter their details manually.`)
                // Fall through to normal flow on error
            }
        }

        // AI validation for name/company (only if no quick reply was used)
        const isQuickReply = (FLOW_DEFS[currentStep]?.quickReplies || []).includes(input)
        if (!isQuickReply && ['clientName', 'companyName'].includes(currentField)) {
            const aiError = await validateWithAI(currentField, input)
            if (aiError) {
                setIsTyping(false)
                isTypingRef.current = false
                addBotMsg(`⚠️ ${aiError}`)
                setQuickReplies(FLOW_DEFS[currentStep]?.quickReplies || [])
                return // Stay on same step
            }
        }

        // Get AI acknowledgement
        await sleep(600)
        const aiAck = await getAIReply(input, currentField, convRef.current)

        // Save data
        let value = input
        if (['policyStart', 'renewalDate'].includes(currentField)) {
            value = parseDate(input)
        }
        currentData[currentField] = value
        setData(currentData)
        dataRef.current = currentData
        setConvHistory(prev => [...prev, { role: 'user', content: input }])


        // Special handling for renewal date
        if (currentField === 'renewalDate') {
            setIsTyping(false)
            isTypingRef.current = false
            const days = daysUntil(value)
            const msg = aiAck || `Got it! Renewal on **${formatDateDisplay(value)}**`
            let urgency = ''
            if (days <= 30) urgency = `\n🔴 Only **${days} days** remaining — HIGH PRIORITY`
            else if (days <= 60) urgency = `\n🟡 **${days} days** to renewal — action soon`
            else urgency = `\n🟢 **${days} days** to renewal — good time to start`
            addBotMsg(msg + urgency)
            const nextStep = currentStep + 1
            setStep(nextStep)
            stepRef.current = nextStep
            await botSpeak(nextStep, currentData)
            return
        }

        // Special handling for satisfaction — show score
        if (currentField === 'satisfaction') {
            setIsTyping(false)
            isTypingRef.current = false
            const score = calculateScore(currentData)
            const crossSell = getCrossSellSuggestions(currentData.policyType, currentData.natureBusiness)
            const msg = aiAck || `Noted! Let me calculate the opportunity score...`
            addBotMsg(msg, { score, crossSell: crossSell.slice(0, 3) })
            const nextStep = currentStep + 1
            setStep(nextStep)
            stepRef.current = nextStep
            await sleep(800)
            await botSpeak(nextStep, currentData)
            return
        }

        // Show AI acknowledgement
        setIsTyping(false)
        isTypingRef.current = false
        if (aiAck) addBotMsg(aiAck)

        const nextStep = currentStep + 1
        setStep(nextStep)
        stepRef.current = nextStep

        // Check if flow is complete
        if (nextStep >= FLOW_DEFS.length) {
            await showConfirmation(currentData)
            return
        }

        await botSpeak(nextStep, currentData)
    }

    async function showConfirmation(d) {
        setIsTyping(true)
        await sleep(600)
        setIsTyping(false)
        addBotMsg(`✅ Perfect! I have all the details for **${d.clientName}**.\n\nLet me show you a summary to confirm before saving to the database and syncing the renewal calendar.`)
        await sleep(800)
        setShowConfirm(true)
    }

    async function handleSave() {
        setShowConfirm(false)
        setIsTyping(true)
        addBotMsg(`💾 Saving to database and syncing calendar...`)
        await sleep(400)
        setIsTyping(false)

        const currentData = dataRef.current
        const finalScore = calculateScore(currentData)
        setSavedScore(finalScore)
        const payload = {
            ...currentData,
            opportunityScore: finalScore.score,
            opportunityLabel: finalScore.label,
            visitDate: new Date().toISOString().split('T')[0],
            executiveId: 'EX-001',
            gps: locationCaptured || '',
            submittedAt: new Date().toISOString()
        }

        // Always save locally first
        saveToLocal(payload)

        // Try cloud sync
        if (SHEET_URL) {
            try {
                const resp = await fetch(SHEET_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'text/plain' }
                })
                const result = await resp.json()
                if (result.status === 'success') {
                    addBotMsg(`☁️ **Cloud sync complete!**\n✅ Google Sheet updated\n📅 Calendar event created\n${result.emailSent ? '📧 Email alert sent' : ''}`)
                } else {
                    addBotMsg(`⚠️ Cloud sync issue: ${result.message || 'Unknown error'}. Data saved locally.`)
                }
            } catch {
                addBotMsg(`⚠️ Could not reach cloud server. Data saved locally — will sync when online.`)
            }
        } else {
            addBotMsg(`💾 Saved locally. To enable cloud sync (Google Sheets + Calendar + Email), add your Apps Script URL in .env`)
        }

        setShowSuccess(true)
    }

    function handleEdit() {
        setShowConfirm(false)
        addBotMsg(`No problem! Which detail would you like to correct? Just tell me.`)
        setStep(1)
        stepRef.current = 1
    }

    function handleNewVisit() {
        setShowSuccess(false)
        setMessages([])
        setQuickReplies([])
        setStep(0)
        stepRef.current = 0
        setData({})
        dataRef.current = {}
        setConvHistory([])
        setInputValue('')
        setTimeout(() => botSpeak(0, {}), 500)
    }

    function handleVoice() {
        if (!recognitionRef.current) return
        if (isRecording) {
            recognitionRef.current.stop()
        } else {
            recognitionRef.current.start()
            setIsRecording(true)
        }
    }

    function handlePhotoUpload(e) {
        const file = e.target.files[0]
        if (!file) return

        addUserMsg(`📸 Policy document uploaded: ${file.name}`)
        setIsTyping(true)
        addBotMsg(`🔍 Reading your policy document with AI... give me a moment.`)

        const reader = new FileReader()
        reader.onload = async (ev) => {
            const base64 = ev.target.result.split(',')[1]
            if (!OPENAI_KEY || OPENAI_KEY === 'paste-your-key-here') {
                setIsTyping(false)
                addBotMsg(`⚠️ OpenAI API key not configured. Please add it to .env to enable document scanning.`)
                return
            }
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                    body: JSON.stringify({
                        model: 'gpt-4o', max_tokens: 300,
                        messages: [{
                            role: 'user', content: [
                                { type: 'text', text: 'This is an Indian insurance policy document. Extract: Policy Number, Insurer Name, Policy Type, Sum Insured, Premium Amount, Policy Start Date, Policy Expiry Date. Return as JSON only.' },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
                            ]
                        }]
                    })
                })
                const respData = await response.json()
                setIsTyping(false)
                const extracted = respData.choices?.[0]?.message?.content || '{}'
                const clean = extracted.replace(/```json|```/g, '').trim()
                let parsed = {}
                try { parsed = JSON.parse(clean) } catch { }

                let msg = `✅ **Policy scanned successfully!** Here's what I found:\n\n`
                Object.entries(parsed).forEach(([k, v]) => { if (v) msg += `**${k}:** ${v}\n` })
                msg += `\nShall I auto-fill these details?`
                addBotMsg(msg)
                setQuickReplies(['✅ Yes, auto-fill', "❌ I'll type manually"])

                const updated = { ...dataRef.current }
                if (parsed['Insurer Name']) updated.currentInsurer = parsed['Insurer Name']
                if (parsed['Policy Type']) updated.policyType = parsed['Policy Type']
                if (parsed['Premium Amount']) updated.premium = parsed['Premium Amount']
                if (parsed['Sum Insured']) updated.sumInsured = parsed['Sum Insured']
                if (parsed['Policy Expiry Date']) updated.renewalDate = parseDate(parsed['Policy Expiry Date'])
                if (parsed['Policy Start Date']) updated.policyStart = parseDate(parsed['Policy Start Date'])
                setData(updated)
                dataRef.current = updated
            } catch {
                setIsTyping(false)
                addBotMsg(`⚠️ Couldn't read the document clearly. Please fill details manually.`)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleUserInput(inputValue)
        }
    }

    const currentData = dataRef.current
    const score = calculateScore(currentData)
    const crossSell = getCrossSellSuggestions(currentData.policyType || '', currentData.natureBusiness || '')

    const confirmRows = [
        ['Client Name', currentData.clientName],
        ['Company', currentData.companyName],
        ['Designation', currentData.designation],
        ['Phone', currentData.phone],
        ['Email', currentData.email === 'skip' ? '—' : currentData.email],
        ['Nature of Business', currentData.natureBusiness],
        ['Current Insurer', currentData.currentInsurer],
        ['Policy Type', currentData.policyType],
        ['Sum Insured', currentData.sumInsured],
        ['Premium', currentData.premium],
        ['Policy Start', formatDateDisplay(currentData.policyStart)],
        ['Renewal Date', currentData.renewalDate ? `${formatDateDisplay(currentData.renewalDate)} (${daysUntil(currentData.renewalDate)} days)` : ''],
        ['Satisfaction', currentData.satisfaction],
        ['Competitor', currentData.competitorInfo],
        ['Notes', currentData.notes],
        ['Visit Date', new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['GPS Location', locationCaptured || 'Not captured'],
    ]

    return (
        <div className="field-bot-layout">
            {/* TOP BAR */}
            <div className="topbar">
                <div className="topbar-left">
                    <div className="bot-avatar">C</div>
                    <div>
                        <div className="bot-name">CAPITUP Field Assistant</div>
                        <div className="bot-status"><span className="dot"></span> Online — Ready to capture</div>
                    </div>
                </div>
                <div className="topbar-right">
                    <button className="icon-btn" onClick={() => navigate('/dashboard')} title="Admin Dashboard">⚡</button>
                    <button className="icon-btn" onClick={() => navigate('/calendar')} title="Calendar">📅</button>
                </div>
            </div>

            {/* CHAT WINDOW */}
            <div className="chat-window" ref={chatRef}>
                {messages.map((msg, i) => (
                    <MessageBubble key={i} role={msg.role} content={msg.content} extras={msg.extras} />
                ))}
                {isTyping && <TypingIndicator />}
            </div>

            {/* QUICK REPLIES */}
            <div className="quick-replies">
                {quickReplies.map((r, i) => (
                    <button key={i} className="qr-btn" onClick={() => handleUserInput(r)}>{r}</button>
                ))}
            </div>

            {/* INPUT AREA */}
            <div className="input-area">
                <button className={`attach-btn ${isRecording ? 'recording' : ''}`} onClick={handleVoice} title="Voice Input">
                    {isRecording ? '⏹' : '🎤'}
                </button>
                <button className="attach-btn" onClick={() => photoInputRef.current?.click()} title="Upload Policy Photo">📸</button>
                <input type="file" ref={photoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <input
                    type="text"
                    className="user-input"
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply here..."
                    autoComplete="off"
                />
                <button className="send-btn" onClick={() => handleUserInput(inputValue)}>➤</button>
            </div>

            {/* CONFIRMATION MODAL */}
            {showConfirm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <div className="modal-title">✅ Confirm Client Details</div>
                            <div className="modal-sub">Review before saving to database</div>
                        </div>
                        <div className="modal-body">
                            {confirmRows.map(([label, value], i) => (
                                <div key={i} className="confirm-row">
                                    <span className="confirm-label">{label}</span>
                                    <span className="confirm-value">{value || '—'}</span>
                                </div>
                            ))}
                            <div className="confirm-row score-row">
                                <span className="confirm-label">Opportunity Score</span>
                                <span className={`score-badge ${score.className}`}>{score.label} · {score.score}/100</span>
                            </div>
                            {crossSell.length > 0 && (
                                <div className="confirm-row" style={{ flexDirection: 'column', gap: '8px' }}>
                                    <span className="confirm-label">Cross-Sell Gaps Identified</span>
                                    <div>
                                        {crossSell.map((p, i) => (
                                            <div key={i} className="crosssell-item"><span className="missing">❌</span> {p}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={handleEdit}>✏️ Edit</button>
                            <button className="btn-primary" onClick={handleSave}>💾 Save & Sync Calendar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL */}
            {showSuccess && (
                <div className="modal-overlay">
                    <div className="modal success-modal">
                        <div className="success-icon">✅</div>
                        <div className="success-title">Client Saved Successfully!</div>
                        <div className="success-sub">
                            <strong>{currentData.clientName}</strong> from {currentData.companyName}<br />
                            Renewal: {formatDateDisplay(currentData.renewalDate)}<br />
                            Score: {(savedScore || score).label} ({(savedScore || score).score}/100)<br />
                            📅 Calendar event created automatically<br />
                            📊 Dashboard updated
                        </div>
                        <div className="success-actions">
                            <button className="btn-primary" onClick={handleNewVisit}>➕ New Visit</button>
                            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>📊 View Dashboard</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
