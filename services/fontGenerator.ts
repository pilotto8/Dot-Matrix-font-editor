
import type { GeneratedChar, FontGeneratorOptions } from '../types';

function imageDataToBitmap(imageData: ImageData, threshold: number): boolean[][] {
    const { width, height, data } = imageData;
    const bitmap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alphaIndex = (y * width + x) * 4 + 3;
            if (data[alphaIndex] > threshold) {
                bitmap[y][x] = true;
            }
        }
    }
    return bitmap;
}


export function generateChars(options: FontGeneratorOptions, characters: string[]): GeneratedChar[] {
  const { 
    fontFamily, 
    fontWeight,
    width, 
    height, 
    charSpacing,
    fontSizeAdjustment,
    renderMode,
    renderThreshold,
    autoAlign,
    xOffset,
    yOffset,
    dynamicWidth,
  } = options;

  // 'width' from options is now consistently treated as the rendering area for the glyph.
  const glyphRenderWidth = width;

  // Short-circuit for cases where there is no glyph to render.
  if (glyphRenderWidth <= 0) {
    // In dynamic mode, width is 0. In fixed mode, width is just the spacing.
    const totalWidth = dynamicWidth ? 0 : charSpacing;
    if (totalWidth <= 0) {
      return characters.map(char => ({
        char,
        codePoint: char.codePointAt(0)!,
        bitmap: Array.from({ length: height }, () => []),
        bytes: [],
      }));
    }
    const finalBitmap = Array.from({ length: height }, () => new Array(totalWidth).fill(false));
    const finalBytes = Array(totalWidth).fill(0);
    return characters.map(char => ({
      char,
      codePoint: char.codePointAt(0)!,
      bitmap: finalBitmap,
      bytes: finalBytes,
    }));
  }


  const canvas = document.createElement('canvas');
  canvas.width = glyphRenderWidth;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');
  
  const adjustedFontSize = height + fontSizeAdjustment;
  ctx.font = `${fontWeight} ${adjustedFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const generatedChars: GeneratedChar[] = [];

  for (const char of characters) {
     if (char.trim() === '' && char !== ' ') {
      // For fixed width, total width is `width`. For dynamic, it's 0.
      const totalWidth = dynamicWidth ? 0 : glyphRenderWidth + charSpacing;
      generatedChars.push({
          char,
          codePoint: char.codePointAt(0)!,
          bitmap: Array(height).fill(0).map(() => Array(totalWidth).fill(false)),
          bytes: Array(totalWidth).fill(0),
      });
      continue;
    }
    
    let renderedBitmap: boolean[][];
    
    // Determine position
    let x_pos = glyphRenderWidth / 2;
    let y_pos = height / 2;

    const metrics = ctx.measureText(char);
    if (autoAlign === 'bottom') {
        y_pos = height - metrics.actualBoundingBoxDescent;
    } else if (autoAlign === 'top') {
        y_pos = metrics.actualBoundingBoxAscent;
    } else { // manual
        x_pos += xOffset;
        y_pos += yOffset;
    }

    if (renderMode === 'aliased') {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, glyphRenderWidth, height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(char, x_pos, y_pos);
      const imageData = ctx.getImageData(0, 0, glyphRenderWidth, height);
      renderedBitmap = imageDataToBitmap(imageData, 128);
    } else { 
        const SUPER_SAMPLE_RATE = 10;
        const superWidth = glyphRenderWidth * SUPER_SAMPLE_RATE;
        const superHeight = height * SUPER_SAMPLE_RATE;

        const superCanvas = document.createElement('canvas');
        superCanvas.width = superWidth;
        superCanvas.height = superHeight;
        const superCtx = superCanvas.getContext('2d', { willReadFrequently: true });
        if (!superCtx) throw new Error('Could not get super canvas context');

        superCtx.imageSmoothingEnabled = true;
        const superAdjustedFontSize = (height + fontSizeAdjustment) * SUPER_SAMPLE_RATE;
        superCtx.font = `${fontWeight} ${superAdjustedFontSize}px ${fontFamily}`;
        superCtx.textAlign = 'center';
        superCtx.textBaseline = 'middle';
        superCtx.fillStyle = '#FFFFFF';

        let super_x_pos = superWidth / 2;
        let super_y_pos = superHeight / 2;

        const superMetrics = superCtx.measureText(char);
        if (autoAlign === 'bottom') {
            super_y_pos = superHeight - superMetrics.actualBoundingBoxDescent;
        } else if (autoAlign === 'top') {
            super_y_pos = superMetrics.actualBoundingBoxAscent;
        } else { // manual
            super_x_pos += xOffset * SUPER_SAMPLE_RATE;
            super_y_pos += yOffset * SUPER_SAMPLE_RATE;
        }

        superCtx.clearRect(0, 0, superWidth, superHeight);
        superCtx.fillText(char, super_x_pos, super_y_pos);

        const superImageData = superCtx.getImageData(0, 0, superWidth, superHeight);
        const superData = superImageData.data;

        const grayscaleBitmap: number[][] = Array.from({ length: height }, () => new Array(glyphRenderWidth).fill(0));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < glyphRenderWidth; x++) {
                let sum = 0;
                for (let sy = 0; sy < SUPER_SAMPLE_RATE; sy++) {
                    for (let sx = 0; sx < SUPER_SAMPLE_RATE; sx++) {
                        const px = x * SUPER_SAMPLE_RATE + sx;
                        const py = y * SUPER_SAMPLE_RATE + sy;
                        const alphaIndex = (py * superWidth + px) * 4 + 3;
                        sum += superData[alphaIndex];
                    }
                }
                grayscaleBitmap[y][x] = sum / (SUPER_SAMPLE_RATE * SUPER_SAMPLE_RATE);
            }
        }

        if (renderMode === 'anti-aliased') {
            renderedBitmap = grayscaleBitmap.map(row => row.map(pixelValue => pixelValue > renderThreshold));
        } else { 
            const ditherGrayscale = grayscaleBitmap.map(row => [...row]);
            renderedBitmap = Array.from({ length: height }, () => new Array(glyphRenderWidth).fill(false));

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < glyphRenderWidth; x++) {
                    const oldPixel = ditherGrayscale[y][x];
                    const newPixel = oldPixel < renderThreshold ? 0 : 255;
                    renderedBitmap[y][x] = newPixel === 255;
                    const quantError = oldPixel - newPixel;

                    if (x + 1 < glyphRenderWidth) ditherGrayscale[y][x + 1] += quantError * 7 / 16;
                    if (y + 1 < height) {
                        if (x - 1 >= 0) ditherGrayscale[y + 1][x - 1] += quantError * 3 / 16;
                        ditherGrayscale[y + 1][x] += quantError * 5 / 16;
                        if (x + 1 < glyphRenderWidth) ditherGrayscale[y + 1][x + 1] += quantError * 1 / 16;
                    }
                }
            }
        }
    }

    let finalBitmap: boolean[][];

    if (dynamicWidth) {
        if (char === ' ') {
            const spaceWidth = Math.floor(glyphRenderWidth / 2) || 1;
            finalBitmap = Array.from({ length: height }, () => new Array(spaceWidth).fill(false));
        } else {
            let minX = glyphRenderWidth;
            let maxX = -1;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < glyphRenderWidth; x++) {
                    if (renderedBitmap[y][x]) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                    }
                }
            }
            if (maxX === -1) { 
                finalBitmap = Array.from({ length: height }, () => []);
            } else {
                finalBitmap = renderedBitmap.map(row => row.slice(minX, maxX + 1));
            }
        }
    } else {
        finalBitmap = renderedBitmap;
        if (charSpacing > 0) {
            const spacingColumns = Array(charSpacing).fill(false);
            finalBitmap.forEach(row => row.push(...spacingColumns));
        }
    }
    
    const msbTopBytes: number[] = [];
    const finalCharWidth = finalBitmap[0]?.length || 0;

    for (let c = 0; c < finalCharWidth; c++) {
      let byte = 0;
      for (let r = 0; r < height; r++) {
        if (finalBitmap[r]?.[c]) {
          byte |= (1 << (height - 1 - r)); 
        }
      }
      msbTopBytes.push(byte);
    }
    
    generatedChars.push({
      char,
      codePoint: char.codePointAt(0)!,
      bitmap: finalBitmap,
      bytes: msbTopBytes,
    });
  }
  
  return generatedChars;
}


export function generateFontData(options: FontGeneratorOptions): Promise<GeneratedChar[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
        const { characterSet } = options;
        const uniqueCharacters = [...new Set(Array.from(characterSet))];
        resolve(generateChars(options, uniqueCharacters));
    }, 10);
  });
}

export function generatePreviewFontData(options: FontGeneratorOptions, previewCharacters: string): Promise<GeneratedChar[]> {
    return new Promise((resolve) => {
        const characters = Array.from(previewCharacters);
        resolve(generateChars(options, characters));
    });
}