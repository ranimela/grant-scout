import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from './config.js';

/**
 * Mutex class to serialize operations on the database file.
 */
class Mutex {
  constructor() {
    this.queue = Promise.resolve();
  }

  runExclusive(callback) {
    const next = this.queue.then(() => callback());
    this.queue = next.catch(() => {});
    return next;
  }
}

const dbMutex = new Mutex();

/**
 * Validates a single grant item against the JSON schema.
 * Throws an error if any field is invalid or missing.
 * 
 * @param {object} item - The grant item to validate.
 */
export function validateGrant(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Grant item must be a non-null object.');
  }

  if (typeof item.id !== 'string' || !item.id.trim()) {
    throw new Error('Grant must have a non-empty string "id".');
  }

  if (typeof item.grant_name !== 'string') {
    throw new Error('Grant must have a string "grant_name".');
  }

  if (typeof item.funding_amount !== 'string') {
    throw new Error('Grant must have a string "funding_amount".');
  }

  if (typeof item.deadline !== 'string') {
    throw new Error('Grant must have a string "deadline".');
  }

  if (!Array.isArray(item.eligibility_criteria) || !item.eligibility_criteria.every(c => typeof c === 'string')) {
    throw new Error('Grant "eligibility_criteria" must be an array of strings.');
  }

  if (typeof item.source_url !== 'string') {
    throw new Error('Grant must have a string "source_url".');
  }

  if (typeof item.discovered_at !== 'string') {
    throw new Error('Grant must have a string "discovered_at".');
  }

  if (item.status !== 'seen' && item.status !== 'notified') {
    throw new Error('Grant "status" must be either "seen" or "notified".');
  }
}

/**
 * Safely loads the database JSON file.
 * Returns an empty array if the file is missing.
 * Validates all loaded items against the schema.
 * 
 * @returns {Promise<Array<object>>} The list of registered grants.
 */
export async function loadState() {
  return dbMutex.runExclusive(async () => {
    try {
      const data = await fs.readFile(CONFIG.DB_PATH, 'utf-8');
      if (!data.trim()) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        throw new Error('Database root must be a JSON array.');
      }
      for (const item of parsed) {
        validateGrant(item);
      }
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  });
}

/**
 * Atomically writes the grants state to disk.
 * Validates the schema of all items before starting the write operation.
 * 
 * @param {Array<object>} data - The full array of grants.
 */
export async function saveState(data) {
  if (!Array.isArray(data)) {
    throw new Error('State data must be an array.');
  }

  // Strictly validate all items before serializing
  for (const item of data) {
    validateGrant(item);
  }

  return dbMutex.runExclusive(async () => {
    const targetDir = path.dirname(CONFIG.DB_PATH);
    await fs.mkdir(targetDir, { recursive: true });

    const tempPath = `${CONFIG.DB_PATH}.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const content = JSON.stringify(data, null, 2);

    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, CONFIG.DB_PATH);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch (_) {
        // Ignore if file wasn't created
      }
      throw error;
    }
  });
}

/**
 * Generates a deterministic hex SHA-256 string from URL and name.
 * Normalizes input URL and name to prevent minor variations (case, whitespace, trailing slashes) from generating different hashes.
 * 
 * @param {string} url - The source URL of the grant.
 * @param {string} name - The name of the grant.
 * @returns {string} The SHA-256 hex hash.
 */
export function generateHash(url, name) {
  if (typeof url !== 'string' || typeof name !== 'string') {
    throw new Error('Both URL and name must be strings.');
  }

  let normalizedUrl = url.trim();
  try {
    const parsed = new URL(normalizedUrl);
    let href = parsed.href;
    if (href.endsWith('/')) {
      href = href.slice(0, -1);
    }
    normalizedUrl = href;
  } catch (_) {
    normalizedUrl = normalizedUrl.toLowerCase();
  }

  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');

  return crypto
    .createHash('sha256')
    .update(`${normalizedUrl}|${normalizedName}`)
    .digest('hex');
}

/**
 * Evaluates if a grant ID is new (i.e. has NOT been recorded yet).
 * Returns true if new/unrecorded, false if it has already been recorded.
 * 
 * @param {string} id - The SHA-256 hex ID of the grant.
 * @returns {Promise<boolean>} True if the grant is new, false otherwise.
 */
export async function isNew(id) {
  if (typeof id !== 'string') {
    throw new Error('ID must be a string.');
  }
  const currentGrants = await loadState();
  return !currentGrants.some(grant => grant.id === id);
}

