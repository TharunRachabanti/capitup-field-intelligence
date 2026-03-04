#  CAPITUP — Field Intelligence Platform

> **A next-generation CRM and AI Field Assistant built specifically for the Indian General Insurance market.**

CAPITUP revolutionizes how insurance brokers capture, manage, and act on client data in the field. By replacing tedious forms with a brilliant, conversational AI bot, brokers can effortlessly log visits, automatically sync data to the cloud, and never miss a renewal.

---

##  Core Features

###  1. AI-Powered Field Assistant (Bot)
- **Conversational UI:** WhatsApp-style chat interface that guides field agents through data collection naturally.
- **Smart Lookup:** Instantly searches the database for existing clients and pre-fills their data, saving valuable time.
- **AI Document Scanning:** Upload policy documents and the AI instantly extracts key details (Policy No, Premium, Expiry Date).
- **Intelligent Validation:** Analyzes names, phone numbers, and dates to ensure clean, accurate data entry.
- **Opportunity Scoring:** Automatically calculates cross-sell opportunities based on the client's industry and current coverage.

###  2. Executive Dashboard
- **Real-Time Analytics:** Visualize total clients, upcoming renewals, and high-value opportunities.
- **Dynamic Data Table:** View, search, and filter all field data seamlessly.
- **Intelligent Filtering:** Instantly filter by "Critical Renewals" (≤30 days) or "Hot Leads" (Score > 80).

###  3. Automated Renewal Calendar
- **Visual Tracking:** A full-featured, color-coded calendar showcasing all upcoming client renewals.
- **Google Calendar Sync:** Every logged client is automatically pushed to a dedicated Google Calendar.
- **Automated Email Alerts:** Sends automated Gmail alerts for critical upcoming renewals.

---

##  Architecture & Tech Stack

CAPITUP uses a modern, serverless architecture designed for speed, reliability, and seamless integration.

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + Vite | Blazing fast, responsive UI (Desktop & Mobile) |
| **Styling** | Custom CSS | Premium dark-theme aesthetics with fluid animations |
| **AI Engine** | OpenAI API (GPT-4o) | Conversational logic, validation, and OCR document scanning |
| **Backend** | Google Apps Script | Serverless endpoint handling data routing and logic |
| **Database** | Google Sheets | Highly accessible, zero-maintenance cloud database |
| **Syncing** | Google Calendar & Gmail | Automated event creation and alert dispatching |
| **Hosting** | Vercel | Global edge network deployment |

---

##  Project Structure

```text
capitup/
├── src/
│   ├── pages/
│   │   ├── FieldBot.jsx    # Core AI Chat Interface & Logic
│   │   ├── Dashboard.jsx   # Analytics & Data Tables
│   │   └── Calendar.jsx    # Renewal Tracking Visualizer
│   ├── components/
│   │   └── Sidebar.jsx     # Global Navigation
│   ├── styles/
│   │   ├── bot.css         # Premium Chat UI styling
│   │   └── dashboard.css   # Analytics UI styling
│   ├── App.jsx             # Application Routing
│   └── main.jsx            # React Entry Point
├── google-apps-script/
│   └── Code.gs             # The complete Backend Serverless Code
├── docs/
│   └── SETUP_GUIDE.md      # Comprehensive Deployment Instructions
└── package.json            # Project Dependencies
```

---

##  Getting Started

To get CAPITUP running locally or push it to production, follow our comprehensive, step-by-step setup guide. It covers everything from obtaining API keys to configuring the Google Sheets database and deploying to Vercel.

 **[View the Complete Setup Guide](docs/SETUP_GUIDE.md)**

### Quick Local Dev Start
```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

*Note: You must configure your `.env` file with `VITE_OPENAI_API_KEY` and `VITE_APPS_SCRIPT_URL` for the application to function locally.*

---

##  Security & Privacy

- **No Database Lock-in:** By utilizing Google Sheets, the organization retains 100% ownership and immediate accessibility of all client data.
- **Environment Variables:** All sensitive keys (OpenAI, Backend URLs) are secured via `.env` files and Vercel Environment Variables.
- **Stateless Client:** The React frontend maintains no persistent sensitive state between sessions.

---

*Designed and Developed by SIAIEIN for the modern insurance professional.*
