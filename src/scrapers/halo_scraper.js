import { chromium } from 'playwright';
import { BaseScraper } from './base_scraper.js';
import { generateHash, isNew } from '../storage.js';
import { CONFIG } from '../config.js';

/**
 * Scraper implementation for the Halo Science marketplace using Playwright.
 */
export class HaloScraper extends BaseScraper {
  /**
   * Scrapes the Halo Science marketplace for academic researcher requests.
   * 
   * @param {string} [url] - The URL to scrape. Defaults to CONFIG.HALO_TARGET_URL.
   * @returns {Promise<Array<object>>} List of parsed grant items.
   */
  async scrape(url = CONFIG.HALO_TARGET_URL) {
    let browser = null;
    let context = null;
    try {
      // Launch Chromium in headless mode
      browser = await chromium.launch({ headless: true });
      
      // Configure browser context
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      
      // Navigate to target and wait for DOM content to load
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait 5000 ms to let dynamic content render fully
      await page.waitForTimeout(5000);

      const anchorSelector = 'a[href*="/request_for_solutions/"]';

      // Wait for the request links to load
      try {
        await page.waitForSelector(anchorSelector, { timeout: 15000 });
      } catch (err) {
        console.warn('Warning: Halo request links did not appear within timeout. Proceeding with DOM extraction.');
      }

      // Extract raw details from the request cards on the page
      const cardsData = await page.$$eval(anchorSelector, (elements) => {
        return elements.map(el => {
          return {
            href: el.getAttribute('href') || '',
            text: el.innerText || el.textContent || ''
          };
        });
      });

      const results = [];
      const baseUrl = new URL(url).origin;

      for (const card of cardsData) {
        let targetUrl = card.href || '';
        if (targetUrl && !targetUrl.startsWith('http')) {
          targetUrl = new URL(targetUrl, baseUrl).href;
        }
        targetUrl = targetUrl.trim();

        // Split inner text by newlines and filter out empty lines
        const lines = card.text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          continue; // Skip cards without at least a sponsor and a title
        }

        // Title is on the 2nd line, Sponsor name is on the 1st line of the card link text.
        const sponsor = lines[0];
        const title = lines[1];
        const combinedName = `[${sponsor}] ${title}`;

        // Partnership tags and deadline placeholders
        const partnershipKeywords = [
          'sponsored research', 'co-development', 'licensing', 
          'material transfer', 'joint venture', 'equity investment',
          'funding', 'grant', 'collaboration'
        ];
        const matchedTags = [];
        let deadline = 'N/A';

        for (const line of lines) {
          // Extract deadline: Match "Apply by [Month] [Day]"
          const deadlineMatch = line.match(/Apply by\s+([A-Za-z]+)\s+(\d+)/i);
          if (deadlineMatch) {
            const monthName = deadlineMatch[1].toLowerCase();
            const day = parseInt(deadlineMatch[2], 10);

            const months = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
              january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
            };

            const monthIndex = months[monthName] !== undefined ? months[monthName] : -1;
            if (monthIndex !== -1 && !isNaN(day)) {
              const today = new Date();
              const currentYear = today.getFullYear();
              const parsedDate = new Date(currentYear, monthIndex, day);
              
              let targetYear = currentYear;
              // If parsed date is in the past compared to the current date/time, use next year
              if (parsedDate < today) {
                targetYear = currentYear + 1;
              }
              const dayStr = String(day).padStart(2, '0');
              const monthStr = String(monthIndex + 1).padStart(2, '0');
              deadline = `${dayStr}/${monthStr}/${targetYear}`;
            }
          }

          // Extract partnership tags: lines containing tags like "Sponsored research", "Co-development"
          const lowerLine = line.toLowerCase();
          const isKeyword = partnershipKeywords.some(keyword => lowerLine.includes(keyword));
          if (isKeyword && line !== sponsor && line !== title && !lowerLine.includes('apply by')) {
            matchedTags.push(line);
          }
        }

        const fundingAmount = matchedTags.length > 0 ? matchedTags.join(', ') : 'N/A';
        const id = generateHash(targetUrl, combinedName);
        const isNewGrant = await isNew(id);

        results.push({
          id,
          grant_name: combinedName,
          funding_amount: fundingAmount,
          deadline: deadline,
          eligibility_criteria: ['Academic researchers'],
          source_url: targetUrl,
          discovered_at: new Date().toISOString(),
          status: 'seen',
          is_new: isNewGrant
        });
      }

      // Deduplicate results by ID
      const uniqueResults = [];
      const seenIds = new Set();
      for (const res of results) {
        if (!seenIds.has(res.id)) {
          seenIds.add(res.id);
          uniqueResults.push(res);
        }
      }

      return uniqueResults;
    } finally {
      if (context) {
        await context.close();
      }
      if (browser) {
        await browser.close();
      }
    }
  }
}
