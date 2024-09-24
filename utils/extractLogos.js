const url = require('url');

/**
 * Extracts logo URLs from the DOM using Cheerio.
 *
 * @param {CheerioStatic} $ - The loaded Cheerio instance.
 * @param {string} baseUrl - The base URL of the website.
 * @returns {string[]} - An array of logo URLs.
 */
function extractLogos($, baseUrl) {
  const logos = new Set();

  // Extract from <img> tags
  $('img').each((i, img) => {
    const src = $(img).attr('src');
    if (src) {
      logos.add(resolveUrl(baseUrl, src));
    }
  });

  // Extract from <meta property="og:image">
  $('meta[property="og:image"]').each((i, meta) => {
    const content = $(meta).attr('content');
    if (content) {
      logos.add(resolveUrl(baseUrl, content));
    }
  });

  // Extract from <link rel="icon">
  $('link[rel="icon"], link[rel="shortcut icon"]').each((i, link) => {
    const href = $(link).attr('href');
    if (href) {
      logos.add(resolveUrl(baseUrl, href));
    }
  });

  return Array.from(logos);
}

/**
 * Resolves relative URLs to absolute URLs.
 *
 * @param {string} base - The base URL.
 * @param {string} relative - The relative URL.
 * @returns {string} - The absolute URL.
 */
function resolveUrl(base, relative) {
  return url.resolve(base, relative);
}

module.exports = extractLogos;
