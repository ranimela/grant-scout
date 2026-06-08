/**
 * Abstract base class for scrapers.
 * Enforces a uniform interface for all scraper implementations.
 */
export class BaseScraper {
  /**
   * Scrapes the target URL and extracts grant information.
   * 
   * @param {string} url - The URL to scrape.
   * @returns {Promise<Array<object>>} A list of extracted grant items.
   * @throws {Error} If not implemented by subclass, or if execution fails.
   */
  async scrape(url) {
    throw new Error('Method scrape(url) must be implemented by subclass.');
  }
}
