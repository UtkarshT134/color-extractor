const Vibrant = require("node-vibrant");

/**
 * Extracts primary and grayscale colors from an image.
 *
 * @param {string} imagePath - The path to the image file.
 * @returns {Promise<object>} - An object containing primary and grayscale colors.
 */
async function extractColors(imagePath) {
  try {
    const palette = await Vibrant.from(imagePath).getPalette();

    const primaryColor = palette.Vibrant
      ? `rgb(${palette.Vibrant.r},${palette.Vibrant.g},${palette.Vibrant.b})`
      : null;

    const mutedColor = palette.Muted
      ? `rgb(${palette.Muted.r},${palette.Muted.g},${palette.Muted.b})`
      : null;

    const grayscaleColors =
      palette.DarkMuted && palette.DarkVibrant
        ? [
            `rgb(${palette.DarkMuted.r},${palette.DarkMuted.g},${palette.DarkMuted.b})`,
            `rgb(${palette.DarkVibrant.r},${palette.DarkVibrant.g},${palette.DarkVibrant.b})`,
          ]
        : [];

    return {
      primaryColor: primaryColor || "",
      mutedColor: mutedColor || "",
      grayscale: grayscaleColors,
    };
  } catch (error) {
    throw new Error(`Color extraction failed: ${error.message}`);
  }
}

module.exports = extractColors;
