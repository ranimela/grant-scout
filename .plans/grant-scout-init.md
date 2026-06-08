# Grant Scout Application Implementation Specification

This plan outlines the architecture and implementation steps to construct a production-grade daily Grant Scouting Application in Node.js (ESM). It targets GitHub Actions and scrapes the Israel Innovation Authority portal.

## Architectural Overview

We will implement a modular, clean, and zero-dependency (for dates) architecture to scrape, track, and notify about new grants.

### 1. Data Flow
1. **Trigger**: GitHub Actions cron scheduler triggers the workflow.
2. **Setup**: The workflow checks out the repository, installs dependencies, and runs `node src/index.js`.
3. **Scraping**: `src/scrapers/ii_scraper.js` fetches the HTML of the target site using `axios` and parses it using `cheerio`.
4. **State Matching**: `src/storage.js` loads the existing `data/grants_db.json`. It computes the SHA-256 hash of `(source_url + grant_name)` for each scraped grant to determine if it is new.
5. **Mutation**:
   - New grants are added to the database with `status: "notified"` and `discovered_at` set to the current ISO timestamp.
   - Previously seen/notified grants remain unchanged or updated as appropriate.
6. **Reporting**: `src/notifier.js` generates a daily Markdown delta report highlighting the new grants. This report is written to `GITHUB_STEP_SUMMARY` and locally as a log file.
7. **Persistence**: The workflow commits and pushes the updated `data/grants_db.json` back to the repository using the default repository `GITHUB_TOKEN`.

### 2. Schemas & State
`data/grants_db.json` will contain a JSON array of grant objects matching:
```json
{
  "id": "sha256-hex-string",
  "grant_name": "string",
  "funding_amount": "string",
  "deadline": "string",
  "eligibility_criteria": ["string"],
  "source_url": "string",
  "discovered_at": "string",
  "status": "seen" | "notified"
}
```

## Affected Files

- `[NEW]` [daily-scout.yml](file:///c:/Users/rmelamed/Projects/grant-scout/.github/workflows/daily-scout.yml)
- `[NEW]` [package.json](file:///c:/Users/rmelamed/Projects/grant-scout/package.json)
- `[NEW]` [index.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/index.js)
- `[NEW]` [config.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/config.js)
- `[NEW]` [storage.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/storage.js)
- `[NEW]` [notifier.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/notifier.js)
- `[NEW]` [base_scraper.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/scrapers/base_scraper.js)
- `[NEW]` [ii_scraper.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/scrapers/ii_scraper.js)
- `[NEW]` [grants_db.json](file:///c:/Users/rmelamed/Projects/grant-scout/data/grants_db.json)

## Step-by-Step Micro-Tasks

### Task 1: Project Initialization & Settings
1. Create `package.json` with `"type": "module"` and dependencies: `axios`, `cheerio`.
2. Create `src/config.js` to manage environment constants (e.g., target URL, path to database, output directory).

### Task 2: Storage Layer
1. Implement `src/storage.js` to:
   - Safe-load `data/grants_db.json` (create empty array if not found).
   - Compute SHA-256 hash in ESM Node (using the built-in `crypto` module).
   - Detect new vs. old grants.
   - Save updated list back to `data/grants_db.json`.

### Task 3: Base Scraper Interface
1. Define abstract class `BaseScraper` in `src/scrapers/base_scraper.js` ensuring a common contract interface (`async scrape()`).

### Task 4: Hebrew Scraper (Israel Innovation Authority)
1. Implement `src/scrapers/ii_scraper.js` extending `BaseScraper`:
   - Fetch the Israel Innovation Authority page.
   - Use dynamic/fallback CSS selectors based on the Hebrew DOM of `https://innovationisrael.org.il/%D7%A4%D7%AA%D7%95%D7%97%D7%99%D7%9D-%D7%9C%D7%94%D7%92%D7%A9%D7%94/`.
   - Parse Hebrew dates using a clean regex matching `DD.MM.YYYY` or standard format.
   - Handle text extraction for `funding_amount`, `eligibility_criteria`, `grant_name`, and `source_url`.

### Task 5: Orchestrator & Notifier
1. Implement `src/notifier.js` to create the Markdown summary report:
   - Filter grants in the DB with status `"notified"`.
   - Construct a clear, readable summary.
   - Write the summary to `process.env.GITHUB_STEP_SUMMARY`.
   - Update statuses in the DB from `"notified"` to `"seen"` at the end of the run.
2. Implement `src/index.js` to run the workflow loop.

### Task 6: GitHub Actions Workflow Configuration
1. Create `.github/workflows/daily-scout.yml`:
   - Scheduled trigger (cron) and workflow_dispatch (manual trigger).
   - Set checkout options, Node.js setup, npm install.
   - Configure `permissions: contents: write`.
   - Execute scraper.
   - Check if `grants_db.json` has changed, commit and push changes back using a workflow git config identity.

## Verification Criteria

### 1. Functional Local Verification
- Run `node src/index.js` locally.
- Confirm `data/grants_db.json` is created/updated with correct schemas and hashes.
- Confirm standard Hebrew fields are correctly captured.

### 2. GitHub Actions Emulation
- Test step summary generation (simulate by setting `GITHUB_STEP_SUMMARY` to a local file path).
