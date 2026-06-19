const sharp = require('sharp');

/**
 * Calculates the average luminance of the image to determine if it is light or dark.
 * Resizes the image to 1x1 to fetch the average RGB values.
 * Formula: Luminance = 0.299*R + 0.587*G + 0.114*B
 * @param {Buffer} imageBuffer - Input image buffer
 * @returns {Promise<boolean>} - True if the image is light, false if dark
 */
async function isImageLight(imageBuffer) {
  try {
    const stats = await sharp(imageBuffer)
      .resize(1, 1)
      .raw()
      .toBuffer();
    
    if (stats && stats.length >= 3) {
      const [r, g, b] = stats;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      console.log(`Luminance check: R=${r}, G=${g}, B=${b}, Luminance=${luminance.toFixed(1)}`);
      return luminance > 127;
    }
    return true;
  } catch (err) {
    console.error('Error calculating image luminance, assuming light:', err);
    return true; // default fallback
  }
}

/**
 * Applies a text-based watermark dynamically onto the image using settings.
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {Object} settings - Watermark settings object
 * @returns {Promise<Buffer>} - Watermarked image buffer
 */
async function watermarkImage(imageBuffer, settings = {}) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    const isLight = await isImageLight(imageBuffer);
    
    // Aesthetic Harmonious Colors
    // White text with subtle black shadow/stroke for dark background
    // Dark grey text with white shadow/stroke for light background
    const textColor = isLight ? '#222222' : '#FFFFFF';
    const strokeColor = isLight ? '#FFFFFF' : '#000000';
    
    const textOpacity = (settings.watermarkOpacity !== undefined ? settings.watermarkOpacity : 20) / 100;
    const text = settings.watermarkText || 'sbflorist.in';
    const rotation = settings.watermarkRotation !== undefined ? settings.watermarkRotation : -45;
    const sizePercentage = settings.watermarkSize !== undefined ? settings.watermarkSize : 30;
    const position = settings.watermarkPosition || 'Center + Bottom Right';
    const repeatingPattern = settings.repeatingPattern ?? false;

    let svgElements = '';

    if (repeatingPattern) {
      // Create a grid pattern across the image
      const rows = 5;
      const cols = 5;
      const fontSz = Math.round((width / cols) * 0.22); // responsive scale
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (width / cols) * (c + 0.5);
          const y = (height / rows) * (r + 0.5);
          svgElements += `
            <text 
              x="${x}" 
              y="${y}" 
              font-family="'Montserrat', 'Inter', 'Arial', sans-serif" 
              font-size="${fontSz}" 
              font-weight="900" 
              letter-spacing="1px"
              fill="${textColor}" 
              fill-opacity="${textOpacity * 0.85}" 
              stroke="${strokeColor}" 
              stroke-opacity="${textOpacity * 0.85}" 
              stroke-width="1"
              text-anchor="middle" 
              dominant-baseline="middle"
              transform="rotate(${rotation}, ${x}, ${y})"
            >${text}</text>
          `;
        }
      }
    } else {
      // 1. Center Diagonal Watermark
      if (position.includes('Center')) {
        const x = width / 2;
        const y = height / 2;
        const fontSz = Math.round((width * sizePercentage) / 320); // Scale relative to width
        svgElements += `
          <text 
            x="${x}" 
            y="${y}" 
            font-family="'Montserrat', 'Inter', 'Arial', sans-serif" 
            font-size="${fontSz}" 
            font-weight="900" 
            letter-spacing="2px"
            fill="${textColor}" 
            fill-opacity="${textOpacity}" 
            stroke="${strokeColor}" 
            stroke-opacity="${textOpacity}" 
            stroke-width="2"
            text-anchor="middle" 
            dominant-baseline="middle"
            transform="rotate(${rotation}, ${x}, ${y})"
          >${text}</text>
        `;
      }

      // 2. Corner Watermark (Bottom Right)
      if (position.includes('Bottom Right')) {
        const fontSz = Math.max(Math.round(width * 0.035), 14); // Proportionate size (minimum 14px)
        const x = width - (fontSz * text.length * 0.38) - 24;
        const y = height - fontSz - 24;
        
        svgElements += `
          <text 
            x="${x}" 
            y="${y}" 
            font-family="'Montserrat', 'Inter', 'Arial', sans-serif" 
            font-size="${fontSz}" 
            font-weight="bold" 
            fill="${textColor}" 
            fill-opacity="${textOpacity * 1.4 > 1 ? 1 : textOpacity * 1.4}" 
            stroke="${strokeColor}" 
            stroke-opacity="${textOpacity * 1.4 > 1 ? 1 : textOpacity * 1.4}"
            stroke-width="1.2"
            text-anchor="start"
          >${text}</text>
        `;
      }
    }

    const svgBuffer = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgElements}
      </svg>
    `);

    // Overlay SVG on image buffer
    return await sharp(imageBuffer)
      .composite([{ input: svgBuffer, blend: 'over' }])
      .toBuffer();
  } catch (err) {
    console.error('Error applying watermark:', err);
    throw err;
  }
}

module.exports = {
  isImageLight,
  watermarkImage
};
