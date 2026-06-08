# Add Halo Science Scraper Specification

Integrate a second scraper target for the Halo Science marketplace (specifically academic researcher requests) into the Grant Scout application.

## Architectural Overview
- **Scraper Pipeline**: Introduce `src/scrapers/halo_scraper.js` extending `BaseScraper`. It will scrape `https://www.halo.science/marketplace/requests?partner_types=ACADEMIC_RESEARCHERS` using Playwright.
- **Orchestrator Integration**: Update `src/index.js` to instantiate and execute both `InnovationAuthorityScraper` and `HaloScraper`. It will combine results into a single collection, identify new items, mutate state, and compile the report.
- **Data Mapping**:
  - `id`: SHA-256(source_url + grant_name)
  - `grant_name`: Scraped title of the request.
  - `funding_amount`: Extracted partnership models (e.g. "Sponsored research, Co-development").
  - `deadline`: Scraped date string, normalized to `DD/MM/YYYY` (resolving relative month/day like "Jul 25" to the target date/year).
  - `eligibility_criteria`: `["Academic researchers"]`.
  - `source_url`: Absolute URL link.
  - `status`: `"seen"`.

## Affected Files
- `[MODIFY]` [config.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/config.js)
- `[MODIFY]` [index.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/index.js)
- `[NEW]` [halo_scraper.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/scrapers/halo_scraper.js)

## Step-by-Step Micro-Tasks

### Task 1: Update Configuration
1. Open `src/config.js`.
2. Add `HALO_TARGET_URL: 'https://www.halo.science/marketplace/requests?partner_types=ACADEMIC_RESEARCHERS'` to the `CONFIG` object.

### Task 2: Create Halo Scraper
1. Create `src/scrapers/halo_scraper.js`.
2. Implement `HaloScraper` extending `BaseScraper`.
3. Use Playwright to launch a headless browser, navigate to `CONFIG.HALO_TARGET_URL`, and wait for `5000` ms.
4. Extract list of requests using anchor selector `a[href*="/request_for_solutions/"]`.
5. Map each request to the data contract:
   - Extract title: Title is on the 2nd line of the card link text.
   - Extract sponsor: Sponsor name is on the 1st line of the card link text.
   - Combine sponsor name with title for clear logging (e.g. `[Sponsor] Title`).
   - Extract partnership tags: Lines containing tags like "Sponsored research", "Co-development" to map to `funding_amount`.
   - Extract deadline: Match "Apply by [Month] [Day]" and convert to `DD/MM/YYYY` format using the current year (or next year if past).
   - Set `eligibility_criteria` to `["Academic researchers"]`.
6. Return unique items list.

### Task 3: Update Orchestrator
1. Open `src/index.js`.
2. Import `HaloScraper`.
3. In `runScout`, execute both scrapers concurrently or sequentially.
4. Merge lists of raw opportunities and process delta logic for all items.

## Verification Criteria
### Automated Tests
- Run `npm test` to verify syntax and baseline tests.

### Manual Verification
- Run `node src/index.js` locally.
- Inspect `data/grants_db.json` to ensure Halo requests are successfully added with correct schemas.
- Check generated reports under `reports/` to verify Halo grants appear alongside IIA grants.
