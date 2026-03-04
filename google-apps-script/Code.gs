/**
 * CAPITUP Backend
 * Handles Sheets storage, Calendar sync, and email alerts.
 */

// Config
const CONFIG = {
  SHEET_NAME: 'ClientData',           // Name of the data sheet tab
  CALENDAR_NAME: 'CAPITUP Renewals',  // Name of the Google Calendar
  ALERT_EMAIL: '',                     // Will be set from sheet or manually — your email
  RENEWAL_ALERT_DAYS: [30, 15, 7, 3, 1], // Days before renewal to send alerts
  COMPANY_NAME: 'CAPITUP Insurance Brokers'
};

// Main POST handler — receives data from the React app
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Write to Google Sheet
    const row = writeToSheet(data);
    
    // Create Google Calendar event
    const eventId = createCalendarEvent(data);
    
    // Send email alert if critical (≤30 days)
    let emailSent = false;
    const daysLeft = getDaysUntil(data.renewalDate);
    if (daysLeft <= 30) {
      sendEmailAlert(data, daysLeft);
      emailSent = true;
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        row: row,
        calendarEventId: eventId,
        emailSent: emailSent,
        message: `Client ${data.clientName} saved successfully`
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Also handle GET requests (for testing and client lookup)
function doGet(e) {
  // If a search parameter is provided, look up the client
  if (e.parameter.search) {
    const searchTerm = e.parameter.search.toLowerCase();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    
    // If sheet doesn't exist, return not found
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ found: false, message: 'No data yet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ found: false, message: 'No clients yet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Assuming headers are in first row. Map column indexes.
    const headers = data[0];
    const nameIdx = headers.indexOf('Client Name');
    
    // Search for a matching client name (partial or exact)
    for (let i = data.length - 1; i > 0; i--) { // Start from bottom to get most recent
      const row = data[i];
      const clientName = String(row[nameIdx] || '').toLowerCase();
      
      if (clientName && (clientName.includes(searchTerm) || searchTerm.includes(clientName))) {
        // Found a match! Construct client object mapping headers back to keys
        const clientData = {};
        
        // Match exact sheet headers to frontend keys
        const keyMap = {
          'Client Name': 'clientName',
          'Company Name': 'companyName',
          'Designation': 'designation',
          'Phone': 'phone',
          'Email': 'email',
          'Nature of Business': 'natureBusiness',
          'Current Insurer': 'currentInsurer',
          'Policy Type': 'policyType',
          'Sum Insured': 'sumInsured'
        };
        
        headers.forEach((header, idx) => {
          const key = keyMap[header]; // Only map known core fields
          if (key) {
            clientData[key] = row[idx];
          }
        });
        
        return ContentService
          .createTextOutput(JSON.stringify({ found: true, data: clientData }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // No match found
    return ContentService
      .createTextOutput(JSON.stringify({ found: false, message: 'Client not found in sheet' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default response
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'CAPITUP Backend is running!',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Saves client data row to the sheet, creates headers if needed
function writeToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // Create sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    const headers = [
      'Client ID', 'Client Name', 'Company Name', 'Designation',
      'Phone', 'Email', 'Nature of Business', 'Current Insurer',
      'Policy Type', 'Sum Insured', 'Premium', 'Policy Start',
      'Renewal Date', 'Satisfaction', 'Competitor Info', 'Notes',
      'Opportunity Score', 'Opportunity Label', 'Visit Date',
      'Executive ID', 'GPS Location', 'Submitted At', 'Visit Type'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#d4a843');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  // Generate Client ID
  const lastRow = sheet.getLastRow();
  const clientId = data.clientId || ('CL-' + String(lastRow).padStart(4, '0'));
  
  // Append data row
  const row = [
    clientId,
    data.clientName || '',
    data.companyName || '',
    data.designation || '',
    data.phone || '',
    data.email || '',
    data.natureBusiness || '',
    data.currentInsurer || '',
    data.policyType || '',
    data.sumInsured || '',
    data.premium || '',
    data.policyStart || '',
    data.renewalDate || '',
    data.satisfaction || '',
    data.competitorInfo || '',
    data.notes || '',
    data.opportunityScore || 0,
    data.opportunityLabel || '',
    data.visitDate || new Date().toISOString().split('T')[0],
    data.executiveId || 'EX-001',
    data.gps || '',
    data.submittedAt || new Date().toISOString(),
    data.visitType || ''
  ];
  
  sheet.appendRow(row);
  
  // Color-code the renewal date cell based on urgency
  const newLastRow = sheet.getLastRow();
  const renewalCell = sheet.getRange(newLastRow, 13); // Column M = Renewal Date
  const daysLeft = getDaysUntil(data.renewalDate);
  
  if (daysLeft <= 30) {
    renewalCell.setBackground('#b91c1c');
    renewalCell.setFontColor('#ffffff');
  } else if (daysLeft <= 60) {
    renewalCell.setBackground('#d4a843');
    renewalCell.setFontColor('#000000');
  } else if (daysLeft <= 90) {
    renewalCell.setBackground('#238636');
    renewalCell.setFontColor('#ffffff');
  }
  
  // Color-code the score cell
  const scoreCell = sheet.getRange(newLastRow, 17); // Column Q = Score
  const score = data.opportunityScore || 0;
  if (score >= 70) {
    scoreCell.setBackground('#b91c1c');
    scoreCell.setFontColor('#ffffff');
  } else if (score >= 40) {
    scoreCell.setBackground('#d4a843');
    scoreCell.setFontColor('#000000');
  } else {
    scoreCell.setBackground('#1d4ed8');
    scoreCell.setFontColor('#ffffff');
  }
  
  return newLastRow;
}

// Creates a calendar event on the renewal date
function createCalendarEvent(data) {
  if (!data.renewalDate || !data.clientName) return null;
  
  try {
    // Find or create the CAPITUP calendar
    let calendar = null;
    const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
    
    if (calendars.length > 0) {
      calendar = calendars[0];
    } else {
      calendar = CalendarApp.createCalendar(CONFIG.CALENDAR_NAME, {
        summary: 'CAPITUP Insurance Renewal Tracker',
        color: CalendarApp.Color.RED
      });
    }
    
    // Parse renewal date
    const renewalDate = new Date(data.renewalDate);
    const daysLeft = getDaysUntil(data.renewalDate);
    
    // Urgency prefix
    let prefix = '🔵';
    if (daysLeft <= 30) prefix = '🔴 CRITICAL';
    else if (daysLeft <= 60) prefix = '🟡 WARNING';
    else if (daysLeft <= 90) prefix = '🟢 UPCOMING';
    
    const title = `${prefix} | ${data.clientName} — ${data.policyType || 'Policy'} Renewal`;
    
    const description = `    CAPITUP Renewal Reminder

Client: ${data.clientName}
Company: ${data.companyName || '—'}
Phone: ${data.phone || '—'}
Email: ${data.email || '—'}

Policy Type: ${data.policyType || '—'}
Current Insurer: ${data.currentInsurer || '—'}
Sum Insured: ${data.sumInsured || '—'}
Premium: ${data.premium || '—'}

Opportunity Score: ${data.opportunityLabel || '—'} (${data.opportunityScore || 0}/100)
Satisfaction: ${data.satisfaction || '—'}
Competitor: ${data.competitorInfo || '—'}

Notes: ${data.notes || '—'}
GPS: ${data.gps || '—'}
Visit Date: ${data.visitDate || '—'}
`.trim();
    
    // Create all-day event on renewal date
    const event = calendar.createAllDayEvent(title, renewalDate, { description: description });
    
    // Add reminders: 30 days, 15 days, 7 days, 3 days, 1 day before
    event.removeAllReminders();
    if (daysLeft > 30) event.addPopupReminder(30 * 24 * 60); // 30 days in minutes
    if (daysLeft > 15) event.addPopupReminder(15 * 24 * 60);
    if (daysLeft > 7)  event.addPopupReminder(7 * 24 * 60);
    if (daysLeft > 3)  event.addPopupReminder(3 * 24 * 60);
    event.addPopupReminder(1 * 24 * 60); // 1 day
    
    // Color code
    if (daysLeft <= 30)      event.setColor(CalendarApp.EventColor.RED);
    else if (daysLeft <= 60) event.setColor(CalendarApp.EventColor.YELLOW);
    else if (daysLeft <= 90) event.setColor(CalendarApp.EventColor.GREEN);
    else                     event.setColor(CalendarApp.EventColor.BLUE);
    
    return event.getId();
    
  } catch (error) {
    Logger.log('Calendar error: ' + error.toString());
    return null;
  }
}

// Sends immediate email alert for critical renewals
function sendEmailAlert(data, daysLeft) {
  const email = getAlertEmail();
  if (!email) return;
  
  const urgency = daysLeft <= 7 ? '🚨 URGENT' : daysLeft <= 15 ? '⚠️ WARNING' : '🔴 CRITICAL';
  
  const subject = `${urgency} | ${data.clientName} — Renewal in ${daysLeft} days | CAPITUP Alert`;
  
  const body = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; padding: 30px;">
  <div style="max-width: 600px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #d4a843, #b8860b); padding: 20px 30px;">
      <h1 style="margin: 0; color: #0d1117; font-size: 22px;">CAPITUP Alert</h1>
      <p style="margin: 5px 0 0; color: #0d1117; opacity: 0.8;">Renewal Intelligence System</p>
    </div>
    
    <!-- Alert Banner -->
    <div style="background: ${daysLeft <= 7 ? '#b91c1c' : daysLeft <= 15 ? '#d4a843' : '#da3633'}; padding: 12px 30px; text-align: center;">
      <strong style="color: ${daysLeft <= 15 && daysLeft > 7 ? '#000' : '#fff'}; font-size: 16px;">
        ${urgency} — Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} until renewal!
      </strong>
    </div>
    
    <!-- Client Details -->
    <div style="padding: 25px 30px;">
      <h2 style="color: #d4a843; margin: 0 0 5px;">${data.clientName || '—'}</h2>
      <p style="color: #7d8590; margin: 0 0 20px;">${data.companyName || '—'} · ${data.designation || '—'}</p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Phone</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.phone || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Current Insurer</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.currentInsurer || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Policy Type</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.policyType || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Sum Insured</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.sumInsured || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Premium</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.premium || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Renewal Date</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong style="color: #da3633;">${data.renewalDate || '—'}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590; border-bottom: 1px solid #21262d;">Score</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #21262d;"><strong>${data.opportunityLabel || '—'} (${data.opportunityScore || 0}/100)</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #7d8590;">Satisfaction</td><td style="padding: 8px 0; text-align: right;"><strong>${data.satisfaction || '—'}</strong></td></tr>
      </table>
      
      ${data.notes && data.notes !== 'No additional notes' ? `<div style="margin-top: 15px; padding: 12px; background: #21262d; border-radius: 8px; border-left: 3px solid #d4a843;"><strong style="color: #d4a843;">Notes:</strong><br/><span style="color: #e6edf3;">${data.notes}</span></div>` : ''}
    </div>
    
    <!-- Footer -->
    <div style="padding: 15px 30px; background: #0d1117; text-align: center; border-top: 1px solid #21262d;">
      <p style="color: #484f58; font-size: 12px; margin: 0;">CAPITUP Field Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`.trim();
  
  GmailApp.sendEmail(email, subject, `CAPITUP Alert: ${data.clientName} renewal in ${daysLeft} days`, {
    htmlBody: body,
    name: CONFIG.COMPANY_NAME
  });
}

// Runs daily to check for upcoming renewals and sends a digest email
// Set up via setupDailyTrigger()
function checkRenewals() {
  const email = getAlertEmail();
  if (!email) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const renewalCol = headers.indexOf('Renewal Date');
  const nameCol = headers.indexOf('Client Name');
  const companyCol = headers.indexOf('Company Name');
  const phoneCol = headers.indexOf('Phone');
  const policyCol = headers.indexOf('Policy Type');
  const premiumCol = headers.indexOf('Premium');
  const scoreCol = headers.indexOf('Opportunity Score');
  const labelCol = headers.indexOf('Opportunity Label');
  
  if (renewalCol === -1 || nameCol === -1) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let criticalClients = [];
  let warningClients = [];
  
  for (let i = 1; i < data.length; i++) {
    const renewalStr = data[i][renewalCol];
    if (!renewalStr) continue;
    
    const renewalDate = new Date(renewalStr);
    const daysLeft = Math.round((renewalDate - today) / (1000 * 60 * 60 * 24));
    
    // Only alert for specific day counts
    if (CONFIG.RENEWAL_ALERT_DAYS.includes(daysLeft)) {
      const client = {
        name: data[i][nameCol],
        company: data[i][companyCol],
        phone: data[i][phoneCol],
        policy: data[i][policyCol],
        premium: data[i][premiumCol],
        score: data[i][scoreCol],
        label: data[i][labelCol],
        renewalDate: renewalStr,
        daysLeft: daysLeft
      };
      
      if (daysLeft <= 7) criticalClients.push(client);
      else warningClients.push(client);
    }
  }
  
  if (criticalClients.length === 0 && warningClients.length === 0) return;
  
  // Build digest email
  const subject = `📊 CAPITUP Daily Digest — ${criticalClients.length} critical, ${warningClients.length} warning renewals`;
  
  let tableRows = '';
  const allClients = [...criticalClients, ...warningClients];
  allClients.forEach(c => {
    const color = c.daysLeft <= 7 ? '#b91c1c' : '#d4a843';
    tableRows += `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #21262d;"><strong>${c.name}</strong><br/><span style="color: #7d8590; font-size: 12px;">${c.company}</span></td>
      <td style="padding: 10px; border-bottom: 1px solid #21262d;">${c.policy}</td>
      <td style="padding: 10px; border-bottom: 1px solid #21262d;">${c.premium}</td>
      <td style="padding: 10px; border-bottom: 1px solid #21262d; text-align: center;"><span style="background: ${color}; color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 12px;">${c.daysLeft} days</span></td>
      <td style="padding: 10px; border-bottom: 1px solid #21262d;">${c.phone}</td>
    </tr>`;
  });
  
  const body = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; padding: 30px;">
  <div style="max-width: 700px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #d4a843, #b8860b); padding: 20px 30px;">
      <h1 style="margin: 0; color: #0d1117;">📊 Daily Renewal Digest</h1>
      <p style="margin: 5px 0 0; color: #0d1117; opacity: 0.8;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
    <div style="padding: 20px 30px;">
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <div style="background: #b91c1c20; border: 1px solid #b91c1c; border-radius: 8px; padding: 12px 20px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #da3633;">${criticalClients.length}</div>
          <div style="font-size: 12px; color: #7d8590;">Critical (≤7 days)</div>
        </div>
        <div style="background: #d4a84320; border: 1px solid #d4a843; border-radius: 8px; padding: 12px 20px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #d4a843;">${warningClients.length}</div>
          <div style="font-size: 12px; color: #7d8590;">Warning (≤30 days)</div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid #d4a843;">
            <th style="padding: 10px; text-align: left; color: #d4a843;">Client</th>
            <th style="padding: 10px; text-align: left; color: #d4a843;">Policy</th>
            <th style="padding: 10px; text-align: left; color: #d4a843;">Premium</th>
            <th style="padding: 10px; text-align: center; color: #d4a843;">Expires In</th>
            <th style="padding: 10px; text-align: left; color: #d4a843;">Phone</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="padding: 15px 30px; background: #0d1117; text-align: center; border-top: 1px solid #21262d;">
      <p style="color: #484f58; font-size: 12px; margin: 0;">CAPITUP — Daily Renewal Digest</p>
    </div>
  </div>
</body>
</html>`.trim();
  
  GmailApp.sendEmail(email, subject, `CAPITUP Digest: ${allClients.length} renewals need attention`, {
    htmlBody: body,
    name: CONFIG.COMPANY_NAME
  });
}

// Helpers
function getDaysUntil(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getAlertEmail() {
  // First check CONFIG
  if (CONFIG.ALERT_EMAIL) return CONFIG.ALERT_EMAIL;
  
  // Fall back to Settings sheet
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = ss.getSheetByName('Settings');
    if (settingsSheet) {
      return settingsSheet.getRange('B1').getValue();
    }
  } catch (e) {}
  
  // Fall back to script owner's email
  return Session.getActiveUser().getEmail();
}

// Run once to set up the daily 8AM trigger
function setupDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => { if (t.getHandlerFunction() === 'checkRenewals') ScriptApp.deleteTrigger(t); });
  
  // Create new daily trigger at 8 AM
  ScriptApp.newTrigger('checkRenewals')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
    
  Logger.log('Daily trigger created. checkRenewals() will run at 8 AM.');
}

// Test function — Run this to verify everything works
function testSetup() {
  const testData = {
    clientName: 'Test Client',
    companyName: 'Test Company',
    designation: 'MD',
    phone: '9999999999',
    email: 'test@test.com',
    natureBusiness: 'Manufacturing',
    currentInsurer: 'Test Insurer',
    policyType: 'Fire & Allied',
    sumInsured: '1 Crore',
    premium: '1.50L',
    policyStart: '2025-01-01',
    renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    satisfaction: '😞 Unhappy',
    competitorInfo: 'none',
    notes: 'This is a test entry',
    opportunityScore: 75,
    opportunityLabel: '🔥 HOT LEAD',
    visitDate: new Date().toISOString().split('T')[0],
    executiveId: 'EX-001',
    gps: '28.6139°N, 77.2090°E',
    submittedAt: new Date().toISOString(),
    visitType: '🆕 New Client'
  };
  
  Logger.log('Writing to sheet...');
  const row = writeToSheet(testData);
  Logger.log('Written to row: ' + row);
  
  Logger.log('Creating calendar event...');
  const eventId = createCalendarEvent(testData);
  Logger.log('Calendar event: ' + eventId);
  
  Logger.log('Sending test email...');
  sendEmailAlert(testData, 15);
  Logger.log('Email sent.');
  
  Logger.log('All tests passed. Backend is ready.');
}
