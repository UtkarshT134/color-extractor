require('dotenv').config();
const playwright = require("playwright");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const sharp = require("sharp");

const extractLogos = require("./utils/extractLogos");
const extractColors = require("./utils/extractColors");
const assembleData = require("./utils/assembleData");
const { getCache, setCache } = require("./utils/cache");
const logger = require("./utils/logger");
const mkdirp = require("mkdirp");

(async () => {
  // Parse command-line arguments for URLs
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 --urls <url1,url2,...>")
    .option("urls", {
      alias: "u",
      describe: "Comma-separated list of URLs to process",
      type: "string",
      demandOption: true,
    })
    .help().argv;

  const urls = argv.urls.split(",").map((url) => url.trim());

  if (urls.length === 0) {
    logger.error("No URLs provided. Use the --urls argument to specify URLs.");
    process.exit(1);
  }

  // Ensure necessary directories exist
  mkdirp.sync(path.join(__dirname, "screenshots"));
  mkdirp.sync(path.join(__dirname, "cache"));
  mkdirp.sync(path.join(__dirname, "logs"));

  // Launch Playwright browser instance
  const browser = await playwright.chromium.launch({
    headless: process.env.HEADLESS === 'true'
  });

  // Function to process a single URL
  const processUrl = async (url) => {
    // Check cache first
    const cachedData = getCache(url);
    if (cachedData) {
      console.log(JSON.stringify(cachedData, null, 2));
      return;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      logger.info(`Processing URL: ${url}`);
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: parseInt(process.env.PAGE_LOAD_TIMEOUT),
        });
      } catch (error) {
        if (error.name === 'TimeoutError') {
          logger.warn(`Timeout occurred while loading ${url}. Proceeding with partial page load.`);
        } else {
          throw error;
        }
      }
      await page.waitForSelector("body", { state: "visible", timeout: 30000 });
      // Set viewport size for consistency
      await page.setViewportSize({
        width: parseInt(process.env.SCREENSHOT_WIDTH),
        height: parseInt(process.env.SCREENSHOT_HEIGHT),
      });

      // Hide specific elements that might skew color extraction
      await page.evaluate(() => {
        const selectorsToHide = ["button", ".ad-banner", ".subscribe-button"];
        selectorsToHide.forEach((selector) => {
          document
            .querySelectorAll(selector)
            .forEach((el) => (el.style.display = "none"));
        });
      });

      // Wait for any lazy-loaded content
      await page.waitForTimeout(parseInt(process.env.WAIT_FOR_TIMEOUT));

      // Capture page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract logos
      const logos = extractLogos($, url);

      // Take a full-page screenshot to extract color
      const screenshotName = `${Date.now()}-${url.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}.png`;
      const screenshotPath = path.join(
        __dirname,
        "screenshots",
        screenshotName
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Optional: Preprocess the image
      const processedScreenshotPath = path.join(
        __dirname,
        "screenshots",
        `processed-${screenshotName}`
      );
      await sharp(screenshotPath)
        .resize(
          parseInt(process.env.PROCESSED_IMAGE_WIDTH),
          parseInt(process.env.PROCESSED_IMAGE_HEIGHT)
        )
        .blur(0.5) // Reduce blur to capture more detail
        .toFile(processedScreenshotPath);
      // **Extract colors using extractColors**
      const colors = await extractColors(processedScreenshotPath); // Extract 7 colors instead of 5
      if (!colors) {
  logger.error(`Failed to extract colors for URL: ${url}`);
  return; // or handle this case as appropriate
}

      // Assemble Data
      const extractionResult = assembleData(url, logos, colors);

      // Log and output the result
      logger.info(`Extraction successful for URL: ${url}`);
      logger.info(
        `Extracted Data: ${JSON.stringify(extractionResult, null, 2)}`
      );
      console.log(JSON.stringify(extractionResult, null, 2));

      // Save to cache
      setCache(url, extractionResult);

      // Clean up screenshots if desired
      // fs.unlinkSync(screenshotPath);
      // fs.unlinkSync(processedScreenshotPath);
    } catch (error) {
      logger.error(`Error processing URL ${url}: ${error.message}`);
      console.error(`Error processing URL ${url}: ${error.message}`);
    } finally {
      await page.close();
      await context.close();
    }
  };

  // Process all URLs concurrently with a limit to prevent resource exhaustion
  const CONCURRENT_LIMIT = parseInt(process.env.CONCURRENT_LIMIT);
  const queue = [...urls];
  const promises = [];

  const runNext = async () => {
    if (queue.length === 0) return;
    const url = queue.shift();
    await processUrl(url);
    await runNext();
  };

  for (let i = 0; i < Math.min(CONCURRENT_LIMIT, urls.length); i++) {
    promises.push(runNext());
  }

  await Promise.all(promises);

  await browser.close();
})();
