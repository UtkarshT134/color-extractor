/**
 * Assembles the extracted data into the desired JSON format.
 *
 * @param {string} url - The URL of the website.
 * @param {string[]} logos - An array of logo URLs.
 * @param {object} colors - An object containing primary and grayscale colors.
 * @returns {object} - The structured extraction result.
 */
function assembleData(url, logos, colors) {
  return {
    url,
    extractions: {
      logo: logos.slice(0, 5), // Limit to top 5 logo candidates
      siteStyle: [
        {
          colors: [
            colors.primaryColor,
            colors.secondaryColor,
            colors.accentColor,
            colors.textColor,
            colors.backgroundColor,
          ].filter(Boolean), // Remove null values
          grays: colors.grayscale,
        },
      ],
    },
  };
}
module.exports = assembleData;
