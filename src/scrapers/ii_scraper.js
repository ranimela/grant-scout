import { chromium } from 'playwright';
import { BaseScraper } from './base_scraper.js';
import { generateHash, isNew } from '../storage.js';
import { CONFIG } from '../config.js';

/**
 * Helper to sanitize raw Hebrew text by removing extra spaces and LTR/RTL direction control characters.
 * 
 * @param {string} text - Raw Hebrew text.
 * @returns {string} Sanitized text.
 */
export function sanitizeHebrew(text) {
  if (!text) return '';
  return text
    .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '') // Remove directional overrides
    .replace(/\s+/g, ' ') // Replace multiple whitespace with a single space
    .trim();
}

/**
 * Scraper implementation for the Israel Innovation Authority portal using Playwright.
 */
export class InnovationAuthorityScraper extends BaseScraper {
  /**
   * Scrapes the Israel Innovation Authority portal.
   * 
   * @param {string} [url] - The URL to scrape. Defaults to CONFIG.TARGET_URL.
   * @returns {Promise<Array<object>>} List of parsed grant items.
   */
  async scrape(url = CONFIG.TARGET_URL) {
    let browser = null;
    let context = null;
    try {
      // Launch Chromium in headless mode
      browser = await chromium.launch({ headless: true });
      
      // Configure browser context with realistic desktop parameters to bypass challenges
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      });

      const page = await context.newPage();
      
      // Navigate to target portal and wait for the document to begin loading
      await page.goto(url, { waitUntil: 'commit', timeout: 30000 });

      // Selector capturing all common card containers used on the IIA website
      const cardSelector = '.document_item_div, .kol_kore_card, .document_item, .views-row, .card';

      // Wait for the primary grant cards to load on the screen
      try {
        await page.waitForSelector(cardSelector, { timeout: 15000 });
      } catch (err) {
        console.warn('Warning: Card selectors did not appear within timeout. Proceeding with DOM extraction.');
      }

      // Extract raw data from view cards directly within the page context
      const cardsData = await page.$$eval(cardSelector, (elements) => {
        return elements.map(el => {
          // Identify Title (check the class hierarchies found in both search result views)
          const nameEl = el.querySelector('.article_subject, .title_kol_kore, h2, h3, .title');
          const nameText = nameEl ? nameEl.textContent : '';

          // Find closest link tag (could be the element itself, its parent anchor, or a child anchor)
          let linkEl = null;
          if (el.tagName === 'A') {
            linkEl = el;
          } else {
            linkEl = el.closest('a') || el.querySelector('a');
          }
          const href = linkEl ? linkEl.getAttribute('href') : '';

          // Gather text contents for downstream parsing (deadlines, funding amounts)
          return {
            nameText,
            href,
            cardText: el.innerText || el.textContent || ''
          };
        });
      });

      const results = [];
      const baseUrl = new URL(url).origin;

      for (const card of cardsData) {
        const name = sanitizeHebrew(card.nameText);
        if (!name) {
          continue; // Skip cards lacking a title
        }

        if (!name.includes('אקדמיה')) {
          continue;
        }

        let targetUrl = card.href || '';
        if (targetUrl && !targetUrl.startsWith('http')) {
          targetUrl = new URL(targetUrl, baseUrl).href;
        }
        targetUrl = targetUrl.trim();

        const cardText = card.cardText;

        // Extract and format deadline date (DD/MM/YYYY or DD.MM.YYYY)
        const dateRegex = /(\d{1,2})[/\.](\d{1,2})[/\.](\d{4})/;
        const match = cardText.match(dateRegex);
        let deadline = '';
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          deadline = `${day}/${month}/${year}`;
        } else {
          const deadlineMatch = cardText.match(/(?:עד|להגשה עד|סגירה)\s*([^\n\r|:,]+)/i);
          deadline = deadlineMatch ? sanitizeHebrew(deadlineMatch[1]) : 'N/A';
        }

        // Extract funding details
        let funding = '';
        const fundingMatch = cardText.match(/(?:מימון של עד|מענק של עד|עד|בגובה|שיעור המענק)\s*(\d+%\s*(?:-\s*\d+%)?|\d+\s*%)/i);
        if (fundingMatch) {
          funding = sanitizeHebrew(fundingMatch[0]);
        } else {
          funding = 'N/A';
        }

        const id = generateHash(targetUrl, name);
        const isNewGrant = await isNew(id);

        results.push({
          id,
          grant_name: name,
          funding_amount: funding,
          deadline: deadline,
          eligibility_criteria: [], // default structure as required by schema
          source_url: targetUrl,
          discovered_at: new Date().toISOString(),
          status: 'seen',
          is_new: isNewGrant
        });
      }

      // Deduplicate results by ID to handle potential multi-class overlap matches
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
      // Prevent browser leakages in headless environments
      if (context) {
        await context.close();
      }
      if (browser) {
        await browser.close();
      }
    }
  }
}
