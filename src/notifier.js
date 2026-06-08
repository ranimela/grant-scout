import fs from 'fs/promises';
import path from 'path';
import { loadState, saveState } from './storage.js';
import { CONFIG } from './config.js';

/**
 * Compiles new grants (status === 'seen') into both Markdown and HTML reports,
 * saves them to the reports/ directory, writes to GitHub Step Summary if applicable,
 * and updates their status to 'notified' in the database.
 * 
 * @returns {Promise<{ markdown: string, html: string }|null>} The generated reports, or null if no new grants.
 */
export async function generateDailyReport() {
  const grants = await loadState();

  // 1. Isolate objects where status is 'seen'
  const newGrants = grants.filter(grant => grant.status === 'seen');

  if (newGrants.length === 0) {
    console.log('No new grants found with status "seen". Report generation skipped.');
    return null;
  }

  // Generate date tag (YYYY-MM-DD)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // 2. Generate Scannable Markdown Layout
  let markdown = `# Daily Grant Scout Report - ${dateStr}\n\n`;
  markdown += `Scouted **${newGrants.length}** new innovation grant opportunities.\n\n`;
  markdown += `| Grant Name | Deadline | Funding Amount | Source Link |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;

  for (const grant of newGrants) {
    const name = grant.grant_name || 'N/A';
    const deadline = grant.deadline || 'N/A';
    const funding = grant.funding_amount || 'N/A';
    const urlLink = grant.source_url ? `[Link](${grant.source_url})` : 'N/A';
    markdown += `| ${name} | ${deadline} | ${funding} | ${urlLink} |\n`;
  }

  markdown += `\n### Eligibility Criteria Details\n\n`;
  let hasCriteria = false;

  for (const grant of newGrants) {
    if (grant.eligibility_criteria && grant.eligibility_criteria.length > 0) {
      hasCriteria = true;
      markdown += `#### ${grant.grant_name}\n`;
      for (const criteria of grant.eligibility_criteria) {
        markdown += `> - ${criteria}\n`;
      }
      markdown += `\n`;
    }
  }

  if (!hasCriteria) {
    markdown += `*No specific eligibility criteria specified for today's new grants.*\n`;
  }

  // 3. Generate Parallel HTML Template String
  let html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דו"ח איתור מענקים יומי - ${dateStr}</title>
  <style>
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      max-width: 1000px;
      margin: 40px auto;
      padding: 0 20px;
      direction: rtl;
    }
    h1 {
      color: #1a5f7a;
      border-bottom: 3px solid #57c5b6;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    h2 {
      color: #159895;
      margin-top: 40px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
    }
    h3 {
      color: #002b5b;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 14px 16px;
      text-align: right;
    }
    th {
      background-color: #f7fafc;
      color: #4a5568;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #fcfdfd;
    }
    a {
      color: #1a5f7a;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }
    blockquote {
      margin: 12px 0;
      padding: 8px 16px;
      background-color: #f8fafc;
      border-right: 4px solid #1a5f7a;
      border-left: 0;
      color: #4a5568;
    }
    blockquote ul {
      margin: 0;
      padding-right: 20px;
    }
    blockquote li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <h1>דו"ח איתור מענקים יומי - ${dateStr}</h1>
  <p>אותרו <strong>${newGrants.length}</strong> הזדמנויות חדשות לקולות קוראים ומענקים.</p>
  
  <table>
    <thead>
      <tr>
        <th>שם המענק</th>
        <th>תאריך הגשה</th>
        <th>גובה המימון</th>
        <th>קישור מקור</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (const grant of newGrants) {
    const name = grant.grant_name || 'N/A';
    const deadline = grant.deadline || 'N/A';
    const funding = grant.funding_amount || 'N/A';
    const urlLink = grant.source_url ? `<a href="${grant.source_url}" target="_blank">קישור למקור</a>` : 'N/A';
    html += `      <tr>
        <td><strong>${name}</strong></td>
        <td>${deadline}</td>
        <td>${funding}</td>
        <td>${urlLink}</td>
      </tr>\n`;
  }

  html += `    </tbody>
  </table>

  <h2>פרטי תנאי סף וזכאות</h2>
  `;

  hasCriteria = false;
  for (const grant of newGrants) {
    if (grant.eligibility_criteria && grant.eligibility_criteria.length > 0) {
      hasCriteria = true;
      html += `  <h3>${grant.grant_name}</h3>\n`;
      html += `  <blockquote>\n    <ul>\n`;
      for (const criteria of grant.eligibility_criteria) {
        html += `      <li>${criteria}</li>\n`;
      }
      html += `    </ul>\n  </blockquote>\n`;
    }
  }

  if (!hasCriteria) {
    html += `  <p><em>אין תנאי סף מפורטים למענקים החדשים של היום.</em></p>\n`;
  }

  html += `</body>
</html>`;

  // 4. Save both assets inside reports/ folder
  const projectRoot = path.resolve(path.dirname(CONFIG.DB_PATH), '..');
  const reportsDir = path.join(projectRoot, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const reportPathMd = path.join(reportsDir, `daily-report-${dateStr}.md`);
  const reportPathHtml = path.join(reportsDir, `daily-report-${dateStr}.html`);

  await fs.writeFile(reportPathMd, markdown, 'utf-8');
  await fs.writeFile(reportPathHtml, html, 'utf-8');
  
  console.log(`Daily Markdown report written to: ${reportPathMd}`);
  console.log(`Daily HTML report written to: ${reportPathHtml}`);

  // 5. State Mutation: Update 'seen' to 'notified'
  for (const grant of grants) {
    if (grant.status === 'seen') {
      grant.status = 'notified';
    }
  }

  await saveState(grants);
  console.log('Database state mutated successfully (updated status to "notified").');

  // Helper to write to GITHUB_STEP_SUMMARY if available
  if (CONFIG.GITHUB_STEP_SUMMARY) {
    try {
      await fs.writeFile(CONFIG.GITHUB_STEP_SUMMARY, markdown, 'utf-8');
      console.log(`GitHub Step Summary successfully updated at: ${CONFIG.GITHUB_STEP_SUMMARY}`);
    } catch (err) {
      console.error(`Error writing to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  return { markdown, html };
}
