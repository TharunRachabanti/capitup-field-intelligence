# CAPITUP — Complete Setup Guide

> Follow each step carefully. Once done, your **entire pipeline** works:
> Bot → Google Sheet → Google Calendar → Gmail Alerts → Vercel Hosting

---

## STEP 1: Get an OpenAI API Key (for AI features)

1. Go to **https://platform.openai.com/api-keys**
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-...`)
4. Open your project file `.env` and paste it:

```
VITE_OPENAI_API_KEY=sk-paste-your-key-here
```

> **Note:** If you don't have an OpenAI account, create one at https://platform.openai.com/signup. You get some free credits initially.

---

## STEP 2: Create a Google Sheet (2 minutes)

1. Go to **https://sheets.google.com**
2. Click **"+ Blank spreadsheet"**
3. Rename it to **"CAPITUP Client Database"** (click the title at top-left)
4. **Don't add any data** — the script will create headers automatically
5. Keep this sheet open — you'll need it in Step 3

---

## STEP 3: Add the Apps Script (3 minutes)

1. In your Google Sheet, click **Extensions → Apps Script**
2. A new tab opens with a code editor
3. **Delete all** the existing code in `Code.gs`
4. Open the file `google-apps-script/Code.gs` from this project
5. **Copy ALL the code** and paste it into the Apps Script editor
6. (Optional) Set your email in `CONFIG.ALERT_EMAIL` at the top of the script, OR leave it blank — it will use your Gmail automatically
7. Click the **save icon** (💾) or press Ctrl+S

---

## STEP 4: Test the Script (1 minute)

1. In the Apps Script editor, select the function **`testSetup`** from the dropdown at the top
2. Click **▶ Run**
3. It will ask for **permissions** — click:
   - "Review permissions"
   - Select your Google account
   - Click "Advanced" → "Go to CAPITUP (unsafe)" → "Allow"
4. Wait 5-10 seconds. Check the **Execution log** at the bottom.
5. You should see:
   ```
   ✅ Written to row: 2
   ✅ Calendar event: ...
   ✅ Email sent!
   🎉 All tests passed! CAPITUP Backend is ready.
   ```
6. **Verify:**
   - Go back to your Google Sheet → You should see a "ClientData" tab with a test row
   - Check **Google Calendar** → A new "CAPITUP Renewals" calendar with an event
   - Check your **Gmail inbox** → A CAPITUP alert email

---

## STEP 5: Deploy the Script as a Web App (2 minutes)

1. In Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" → choose **"Web app"**
3. Fill in:
   - **Description:** `CAPITUP Backend v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. It will show a **Web app URL** like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
6. **Copy this URL**
7. Open your project file `.env` and paste it:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby.../exec
```

---

## STEP 6: Set Up Daily Email Reminders (1 minute)

1. In the Apps Script editor, select the function **`setupDailyTrigger`** from the dropdown
2. Click **▶ Run**
3. Grant permissions if asked
4. Done! You'll now receive a daily email digest at 8 AM for upcoming renewals

---

## STEP 7: Deploy to Vercel (5 minutes)

### Option A: Using Vercel CLI (Fastest)

1. Open a terminal and run:
   ```
   npm i -g vercel
   ```
2. Navigate to your project:
   ```
   cd c:\Users\Tharun Rachabanti\KGSolutions\PERSONAL\SIAIEIN\CAPITUP
   ```
3. Run:
   ```
   vercel
   ```
4. Follow the prompts:
   - Login with GitHub/Email
   - Project name: `capitup`
   - Framework: `Vite`
5. After deploy, run:
   ```
   vercel --prod
   ```

### Option B: Using GitHub (Recommended for auto-deploys)

1. Push your project to GitHub:
   ```
   git init
   git add .
   git commit -m "CAPITUP Field Intelligence Platform"
   git remote add origin https://github.com/YOUR-USERNAME/capitup.git
   git push -u origin main
   ```
2. Go to **https://vercel.com** → Sign up with GitHub
3. Click **"Add New Project"** → Import your `capitup` repo
4. Framework: `Vite`
5. **Environment Variables** — Add these in the Vercel dashboard:
   - `VITE_OPENAI_API_KEY` = your OpenAI key
   - `VITE_APPS_SCRIPT_URL` = your Apps Script URL
   - `VITE_ADMIN_PASSWORD` = any password you choose
6. Click **Deploy**

> 🎉 Your app is now live at `https://capitup.vercel.app` (or similar URL)

---

## STEP 8: Add `.env` to `.gitignore` (Important!)

Make sure your API keys are NOT pushed to GitHub. The `.gitignore` file should include:

```
.env
.env.local
```

---

## Summary: What Each Tool Does

| Tool | What It Does |
|------|-------------|
| **React + Vite** | The frontend app (Chat UI, Dashboard, Calendar) |
| **OpenAI GPT-4o** | AI-powered smart replies + Policy document OCR scanning |
| **Google Sheets** | Cloud database — every client visit is saved here |
| **Google Calendar** | Renewal events with color-coded reminders |
| **Google Apps Script** | Backend glue — receives data, writes to Sheet, syncs Calendar, sends Email |
| **Gmail** | Automatic email alerts for critical renewals + daily digest |
| **Vercel** | Free hosting — your app accessible from anywhere |

---

## Need Help?

If anything doesn't work:
1. Check the **Apps Script Execution log** for errors
2. Make sure the Web App URL is correct in `.env`
3. Make sure you authorized all permissions when prompted
4. For Vercel issues, check the build logs in the Vercel dashboard
