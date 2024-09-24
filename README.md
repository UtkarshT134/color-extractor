# Website Color Extractor

Website Color Extractor is a backend service that extracts primary colors and logos from a given list of websites. It uses Playwright for web scraping, Cheerio for DOM manipulation, and node-vibrant for color extraction.

## Features

- Extracts logos from `<img>`, `<meta property="og:image">`, and `<link rel="icon">` tags.
- Extracts primary and muted colors from website screenshots.
- Caches results to improve performance on subsequent runs.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/yourusername/website-color-extractor.git
    cd website-color-extractor
    ```

2. Install the dependencies:

    ```sh
    npm install
    ```

3. Install Playwright:

    ```sh
    npx playwright install
    ```

## Usage

1. Run the service with a list of URLs:

    ```sh
    node index.js --urls "https://example.com,https://anotherexample.com"
    ```

    Replace the URLs with the websites you want to process.

## Project Structure

- `index.js`: Main entry point of the application.
- `utils/`: Contains utility modules for extracting logos, colors, assembling data, and caching.
- `logs/`: Directory for log files.
- `cache/`: Directory for cached data.
- `screenshots/`: Directory for temporary screenshots.

## Logging

Logs are stored in the `logs` directory. There are two log files:

- `error.log`: Contains error messages.
- `combined.log`: Contains all log messages.

## Caching

Cached data is stored in the `cache` directory. Each URL's data is hashed and saved as a JSON file.

## License

This project is licensed under the ISC License.