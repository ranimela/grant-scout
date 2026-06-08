import { loadState, saveState, isNew } from './storage.js';
import { InnovationAuthorityScraper } from './scrapers/ii_scraper.js';
import { generateDailyReport } from './notifier.js';

async function runScout() {
    console.log("🚀 Starting daily grant scout...");

    // 1. Initialize the Scraper Engine
    const scraper = new InnovationAuthorityScraper();

    // 2. Fetch raw opportunities from the portal
    console.log("📡 Fetching data from Israel Innovation Authority...");
    const rawGrants = await scraper.scrape();

    if (!rawGrants || rawGrants.length === 0) {
        console.log("⚠️ No grants retrieved. Target might be empty or blocking requests.");
        return;
    }

    // 3. Load the historical database state
    const state = await loadState();
    let newGrantsCount = 0;

    // 4. Delta Engine: Filter out seen opportunities
    for (const grant of rawGrants) {
        const isNewGrant = !state.some((g) => g.id === grant.id);
        if (isNewGrant) {
            state.push({ ...grant, status: 'seen' });
            newGrantsCount++;
            console.log(`✨ [NEW GRANT DISCOVERED]: ${grant.grant_name}`);
        }
    }

    // 5. Commit state modifications to disk and generate report
    if (newGrantsCount > 0) {
        await saveState(state);
        console.log(`💾 Scout run complete. Added ${newGrantsCount} new opportunities to database.`);
        
        console.log("📋 Generating daily Markdown delta report...");
        await generateDailyReport();
    } else {
        console.log("📊 Scout run complete. Zero new changes detected.");
    }
}

runScout().catch((error) => {
    console.error("❌ Critical execution failure inside orchestrator:", error.stack || error.message);
    process.exit(1);
});