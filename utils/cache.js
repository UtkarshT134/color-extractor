const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const crypto = require("crypto");
const logger = require("./logger");

/**
 * Generates a SHA-256 hash for a given URL.
 *
 * @param {string} url - The URL to hash.
 * @returns {string} - The hashed string.
 */
function hashUrl(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

/**
 * Retrieves cached data for a given URL if it exists.
 *
 * @param {string} url - The URL to retrieve from cache.
 * @returns {object|null} - The cached data or null if not found.
 */
function getCache(url) {
  try {
    const hashedUrl = hashUrl(url);
    const cachePath = path.join(__dirname, "..", "cache", `${hashedUrl}.json`);
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      logger.info(`Cache hit for URL: ${url}`);
      return JSON.parse(data);
    }
    logger.info(`Cache miss for URL: ${url}`);
    return null;
  } catch (error) {
    logger.error(`Error reading cache for URL ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Saves data to cache for a given URL.
 *
 * @param {string} url - The URL associated with the data.
 * @param {object} data - The data to cache.
 */
function setCache(url, data) {
  try {
    const hashedUrl = hashUrl(url);
    const cacheDir = path.join(__dirname, "..", "cache");
    mkdirp.sync(cacheDir);
    const cachePath = path.join(cacheDir, `${hashedUrl}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    logger.info(`Data cached for URL: ${url}`);
  } catch (error) {
    logger.error(`Error writing cache for URL ${url}: ${error.message}`);
  }
}

module.exports = {
  getCache,
  setCache,
};
