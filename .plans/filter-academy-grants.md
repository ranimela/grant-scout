# Filter Academy Grants Specification

Implement title-based filtering for the Israel Innovation Authority (IIA) scraper to only capture grants containing the word "אקדמיה" (Academy).

## Architectural Overview
- **Filtering Logic**: Modify `src/scrapers/ii_scraper.js` to inspect the extracted and sanitized grant name. If the name does not contain the substring `"אקדמיה"`, the card will be skipped.
- **No Schema Changes**: The output schema, tracking behavior, and database structure remain unchanged.

## Affected Files
- `[MODIFY]` [ii_scraper.js](file:///c:/Users/rmelamed/Projects/grant-scout/src/scrapers/ii_scraper.js)

## Step-by-Step Micro-Tasks
1. Open `src/scrapers/ii_scraper.js`.
2. Locate the loop traversing `cardsData` inside the `scrape` method (around line 90).
3. Right after extracting and sanitizing the `name` (around line 92), add a conditional check:
   ```javascript
   if (!name.includes("אקדמיה")) {
     continue;
   }
   ```
4. Save the file.

## Verification Criteria
### Automated Tests
- If there are existing unit tests, run them using the native Node.js test runner:
  ```bash
  npm test
  ```

### Manual Verification
- Run the orchestrator locally to verify that only grants containing `"אקדמיה"` in their name are captured and logged to the console/written to `grants_db.json`:
  ```bash
  node src/index.js
  ```
