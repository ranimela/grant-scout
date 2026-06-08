import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv configuration
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Application configuration settings.
 */
export const CONFIG = {
  // Target scraping URL for Israel Innovation Authority
  TARGET_URL: process.env.TARGET_URL || 'https://innovationisrael.org.il/%D7%A4%D7%AA%D7%95%D7%97%D7%99%D7%9D-%D7%9C%D7%94%D7%92%D7%A9%D7%94/',
  
  // Target scraping URL for Halo Science
  HALO_TARGET_URL: process.env.HALO_TARGET_URL || 'https://www.halo.science/marketplace/requests?partner_types=ACADEMIC_RESEARCHERS',

  // Storage paths
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../data/grants_db.json'),
  
  // Execution environment and modes
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // GitHub Action output path
  GITHUB_STEP_SUMMARY: process.env.GITHUB_STEP_SUMMARY || null,
};
