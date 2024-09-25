require('dotenv').config();
const sharp = require("sharp");

/**
 * Extracts primary and grayscale colors from an image using extract-colors.
 *
 * @param {string} imagePath - The path to the image file.
 * @returns {Promise<object>} - An object containing primary and grayscale colors.
 */
async function extractImageColors(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .resize({ width: 200, height: 200, fit: "cover" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8ClampedArray(data);
    const colorMap = new Map();
    const totalPixels = info.width * info.height;

   for (let i = 0; i < pixels.length; i += 3) {
     const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
     const [h, s, l] = rgbToHsl(r, g, b);
     const key = `${Math.round(h * 360)},${Math.round(s * 100)},${Math.round(
       l * 100
     )}`;
     colorMap.set(key, (colorMap.get(key) || 0) + 1);
   }
    let colors = Array.from(colorMap, ([hsl, count]) => {
      const [h, s, l] = hsl.split(",").map(Number);
      const [r, g, b] = hslToRgb(h / 360, s / 100, l / 100);
      return {
        rgb: [r, g, b],
        hsl: [h, s, l],
        count,
        area: count / totalPixels,
      };
    });

    colors.sort((a, b) => b.count - a.count);

    const backgroundColor = colors[0];
    colors = colors.filter((color, index) => {
      if (index === 0) return true;
      return (
        color.area > parseFloat(process.env.COLOR_AREA_THRESHOLD) * 0.5 && // Lower threshold
        !isColorSimilar(color.hsl, backgroundColor.hsl, 20) && // Increase difference threshold
        !colors
          .slice(0, index)
          .some((c) => isColorSimilar(color.hsl, c.hsl, 20))
      );
    });

    // Boost importance of saturated colors
    colors.forEach((color) => {
      if (isSaturated(color.rgb)) {
        color.area *= 2;
      }
    });

    // Ensure we have colors from different hue ranges
    const hueRanges = [0, 60, 120, 180, 240, 300];
    hueRanges.forEach((hue) => {
      if (!colors.some((color) => Math.abs(color.hsl[0] - hue) < 30)) {
        const newColor = colors.find(
          (color) => Math.abs(color.hsl[0] - hue) < 30 && color.area > 0.0001
        );
        if (newColor) colors.push(newColor);
      }
    });

    colors.sort((a, b) => b.area - a.area);

    // Ensure we have at least MIN_COLORS colors
    while (colors.length < parseInt(process.env.MIN_COLORS)) {
      const newColor = generateContrastingColor(colors.map((c) => c.rgb));
      const [h, s, l] = rgbToHsl(...newColor);
      colors.push({
        rgb: newColor,
        hsl: [h * 360, s * 100, l * 100],
        count: 0,
        area: 0,
      });
    }

    colors = colors.slice(0, parseInt(process.env.MIN_COLORS));
    const categorizedColors = categorizeColors(colors); 
    const formattedColors = colors.map((color) => ({
      hex: rgbToHex(...color.rgb),
      rgb: `rgb(${color.rgb.join(",")})`,
      area: color.area,
    }));

    const accentColor = detectAccentColor(colors);
    if (accentColor) {
      colors.unshift(accentColor); // Add accent color to the beginning of the array
    }

    return {
      primaryColor: categorizedColors.primary?.rgb ? `rgb(${categorizedColors.primary.rgb.join(",")})` : null,
      secondaryColor: categorizedColors.secondary?.rgb ? `rgb(${categorizedColors.secondary.rgb.join(",")})` : null,
      accentColor: categorizedColors.accent?.rgb ? `rgb(${categorizedColors.accent.rgb.join(",")})` : null,
      textColor: categorizedColors.text?.rgb ? `rgb(${categorizedColors.text.rgb.join(",")})` : null,
      backgroundColor: categorizedColors.background?.rgb ? `rgb(${categorizedColors.background.rgb.join(",")})` : null,
      mutedColor: colors[0]?.rgb ? `rgba(${colors[0].rgb.join(",")},0.5)` : null,
      grayscale: colors[0]?.rgb ? [rgbToGrayscale(...colors[0].rgb)] : [],
      allColors: formattedColors,
    };
  } catch (error) {
    console.error(`Color extraction failed for ${imagePath}: ${error.message}`);
    return {
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      textColor: null,
      backgroundColor: null,
      mutedColor: null,
      grayscale: [],
      allColors: [],
    };
  }
}

// Helper functions
function detectAccentColor(colors) {
  if (!colors || colors.length === 0) return null;
  return colors.find((color) => {
    const [h, s, l] = color.hsl;
    return s > 50 && l > 50 && l < 80; // High saturation, medium-high lightness
  });
}
function isColorSimilar(rgb1, rgb2, threshold = parseFloat(process.env.COLOR_SIMILARITY_THRESHOLD)) {
  return (
    Math.sqrt(
      (rgb1[0] - rgb2[0]) ** 2 +
        (rgb1[1] - rgb2[1]) ** 2 +
        (rgb1[2] - rgb2[2]) ** 2
    ) < threshold
  );
}
function categorizeColors(colors) {
  return {
    primary: colors[0] || { rgb: [0, 0, 0] }, // Default to black
    secondary: colors[1] || colors[0] || { rgb: [255, 255, 255] }, // Default to white
    accent: detectAccentColor(colors) ||
      colors[2] ||
      colors[0] || { rgb: [128, 128, 128] }, // Default to gray
    text: colors.find((c) => c && c.hsl && c.hsl[2] < 30) ||
      colors[0] || { rgb: [0, 0, 0] }, // Default to black
    background: colors.find((c) => c && c.hsl && c.hsl[2] > 80) ||
      colors[colors.length - 1] || { rgb: [255, 255, 255] }, // Default to white
  };
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHsl(r, g, b) {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}
function isSaturated([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 100;
}

function generateContrastingColor(existingColors) {
  const baseColors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  return (
    baseColors.find(
      (color) =>
        !existingColors.some((existing) => isColorSimilar(color, existing))
    ) || [Math.random() * 255, Math.random() * 255, Math.random() * 255]
  );
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

function rgbToGrayscale(r, g, b) {
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `rgb(${gray},${gray},${gray})`;
}

module.exports = extractImageColors;
