/**
 * Canvas Polyfill Module
 * This module provides a fallback implementation of the canvas API using jimp.
 * It's used when the native canvas module fails to install.
 */

const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._image = null;
    this._initImage();
  }

  async _initImage() {
    this._image = await new Jimp(this.width, this.height, 0xFFFFFFFF);
  }

  async toBuffer(mimeType = 'image/png', quality = 100) {
    if (!this._image) {
      await this._initImage();
    }
    return await this._image.getBufferAsync(Jimp.MIME_PNG);
  }

  async toDataURL(mimeType = 'image/png', quality = 100) {
    const buffer = await this.toBuffer(mimeType, quality);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  getContext(type) {
    if (type !== '2d') {
      throw new Error('Only 2d context is supported');
    }
    return new CanvasRenderingContext2D(this);
  }
}

class CanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
  }

  fillRect(x, y, width, height) {
    // Basic implementation using Jimp
    const color = Jimp.cssColorToHex(this.fillStyle);
    if (this.canvas._image) {
      this.canvas._image.scan(x, y, width, height, (x, y, idx) => {
        this.canvas._image.setPixelColor(color, x, y);
      });
    }
  }

  fillText(text, x, y, maxWidth) {
    // This is a simplified implementation
    // For real text support, consider using the jimp-font extensions
    console.warn('Text rendering is limited in the canvas polyfill');
  }

  // Add more methods as needed for your application
}

// Additional classes and utilities needed for compatibility
class Image {
  constructor() {
    this.src = '';
    this.onload = null;
    this.width = 0;
    this.height = 0;
  }

  set src(value) {
    this._src = value;
    if (value) {
      this._loadImage(value);
    }
  }

  get src() {
    return this._src;
  }

  async _loadImage(src) {
    try {
      const image = await Jimp.read(src);
      this.width = image.getWidth();
      this.height = image.getHeight();
      this._image = image;
      if (this.onload) {
        this.onload();
      }
    } catch (error) {
      console.error('Failed to load image:', error);
    }
  }
}

// Font registry to track registered fonts (won't be actually used in the polyfill)
const fontRegistry = new Map();

/**
 * Stub implementation of registerFont
 * In the polyfill, this just keeps track of the fonts that would be registered
 * but doesn't actually use them since Jimp has limited font support
 */
const registerFont = (path, options = {}) => {
  const fontFamily = options.family || path.split('/').pop().split('.')[0];
  fontRegistry.set(fontFamily, { path, options });
  console.log(`[Polyfill] Registered font: ${fontFamily} (${path})`);
};

const createCanvas = (width, height) => {
  return new Canvas(width, height);
};

const loadImage = async (src) => {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

module.exports = {
  Canvas,
  createCanvas,
  loadImage,
  Image,
  registerFont
}; 