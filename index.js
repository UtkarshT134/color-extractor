const playwright = require("playwright");
const cheerio = require("cheerio");
const ColorThief = require("colorthief"); // Retained for backward compatibility if needed
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

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
  const browser = await playwright.chromium.launch();

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

      // Increase timeout and add fallback
      await Promise.race([
        page.goto(url, { waitUntil: "networkidle", timeout: 120000 }),
        new Promise((resolve) => setTimeout(resolve, 90000)), // 90-second fallback
      ]);

      // Check if navigation was successful
      if (page.url() === "about:blank") {
        throw new Error("Navigation failed or timed out");
      }

      // Capture page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract logos
      const logos = extractLogos($, url);

      // Take a screenshot to extract color
      const screenshotName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 15)}.png`;
      const screenshotPath = path.join(
        __dirname,
        "screenshots",
        screenshotName
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Extract colors using node-vibrant
      const colors = await extractColors(screenshotPath);

      // Assemble Data
      const extractionResult = assembleData(url, logos, colors);

      // Log and output the result
      logger.info(`Extraction successful for URL: ${url}`);
      console.log(JSON.stringify(extractionResult, null, 2));

      // Save to cache
      setCache(url, extractionResult);

      // Clean up screenshot
      fs.unlinkSync(screenshotPath);
    } catch (error) {
      logger.error(`Error processing URL ${url}: ${error.message}`);
      console.error(`Error processing URL ${url}: ${error.message}`);

      // Attempt to salvage some data if possible
      try {
        const content = await page.content();
        const $ = cheerio.load(content);
        const logos = extractLogos($, url);
        const partialResult = assembleData(url, logos, {
          primaryColor: "",
          mutedColor: "",
          grayscale: [],
        });
        console.log(
          "Partial data extracted:",
          JSON.stringify(partialResult, null, 2)
        );
      } catch (salvageError) {
        logger.error(`Failed to salvage data: ${salvageError.message}`);
      }
    } finally {
      await page.close();
    }
  };

  // Process all URLs concurrently with a limit to prevent resource exhaustion
  const CONCURRENT_LIMIT = 5;
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
