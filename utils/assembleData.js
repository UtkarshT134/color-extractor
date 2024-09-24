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
      logo: logos,
      siteStyle: [
        {
          colors: [colors.primaryColor, colors.mutedColor].filter(Boolean),
          grays: colors.grayscale,
        },
      ],
    },
  };
}

module.exports = assembleData;
