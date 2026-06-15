/**
 * merge-images Polyfill
 * This is a fallback implementation for the merge-images package using Jimp
 */

const Jimp = require('jimp');
const canvasPolyfill = require('./index');

/**
 * Merges images together using Jimp
 * @param {Array} images - Array of image objects with src and position info
 * @param {Object} options - Options for the merged image
 * @returns {Promise<string>} - Promise resolving to a base64 data URL
 */
const mergeImages = async (images, options = {}) => {
  const { width = 0, height = 0 } = options;
  
  // Calculate dimensions if not provided
  let maxWidth = width;
  let maxHeight = height;
  
  if (maxWidth === 0 || maxHeight === 0) {
    // Pre-load all images to get their dimensions
    for (const image of images) {
      const imgX = image.x || 0;
      const imgY = image.y || 0;
      
      try {
        // Load the image to get its dimensions
        const loadedImage = await Jimp.read(image.src);
        const imgWidth = loadedImage.getWidth();
        const imgHeight = loadedImage.getHeight();
        
        maxWidth = Math.max(maxWidth, imgX + imgWidth);
        maxHeight = Math.max(maxHeight, imgY + imgHeight);
      } catch (error) {
        console.error(`Failed to load image for dimension calculation: ${image.src}`, error);
      }
    }
  }
  
  // Create a new image with the calculated dimensions
  const mergedImage = new Jimp(maxWidth, maxHeight, 0x00000000); // Transparent background
  
  // Composite each image onto the base image
  for (const image of images) {
    const imgX = image.x || 0;
    const imgY = image.y || 0;
    
    try {
      const loadedImage = await Jimp.read(image.src);
      mergedImage.composite(loadedImage, imgX, imgY);
    } catch (error) {
      console.error(`Failed to load image: ${image.src}`, error);
    }
  }
  
  // Convert to base64 data URL
  const buffer = await mergedImage.getBufferAsync(Jimp.MIME_PNG);
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

module.exports = mergeImages; 