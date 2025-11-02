
import type { GeneratedChar, FontGeneratorOptions, ParsedFontData } from '../types';

interface ImportOptions {
    rawData: string;
    rawWidths: string;
    rawOffsets: string;
    characterSet: string;
    charHeight: number;
    charWidth: number; // For fixed-width
    isDynamic: boolean;
}

// Helper to convert an array of bytes for one char into a 2D boolean bitmap
function bytesToBitmap(bytes: number[], width: number, height: number): boolean[][] {
    const bitmap: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
    if (height > 8) {
        throw new Error("Cannot convert bytes to bitmap for height > 8.");
    }
    for (let c = 0; c < width; c++) {
        const byte = bytes[c] || 0;
        for (let r = 0; r < height; r++) {
            if ((byte >> (height - 1 - r)) & 1) {
                bitmap[r][c] = true;
            }
        }
    }
    return bitmap;
}

// Helper to extract numbers (hex, binary, or decimal) from a C/Python array string, ignoring comments
export function parseArrayString(text: string): number[] {
    if (!text) return [];

    // 1. Remove comments (both C-style /*..*/ and single-line // or #)
    let content = text.replace(/\/\*[\s\S]*?\*\/|(\/\/|#).*$/gm, '');

    // 2. Find content within the first '{' or '[' and the last '}' or ']'
    // This makes it robust against surrounding text like variable declarations.
    const firstBracket = content.indexOf('{');
    const firstSquare = content.indexOf('[');
    let start = -1;
    
    if (firstBracket > -1 && firstSquare > -1) {
        start = Math.min(firstBracket, firstSquare);
    } else {
        start = Math.max(firstBracket, firstSquare);
    }

    const lastBracket = content.lastIndexOf('}');
    const lastSquare = content.lastIndexOf(']');
    const end = Math.max(lastBracket, lastSquare);

    if (start !== -1 && end !== -1 && start < end) {
        content = content.substring(start + 1, end);
    }
    
    // 3. Find all number or char-literal tokens.
    // This regex finds: hex (0x..), binary (0b..), decimal, and char literals ('A', '\n', etc.)
    const tokenRegex = /0x[0-9a-fA-F]+|0b[01]+|-?\d+|'(\\.|[^'])'/g;
    const matches = content.match(tokenRegex);

    if (!matches) {
        return [];
    }
    
    const numbers: number[] = [];

    for (const token of matches) {
        // It's a character literal
        if (token.startsWith("'") && token.endsWith("'")) {
            const charContent = token.substring(1, token.length - 1);
            let charCode: number;

            if (charContent.startsWith('\\') && charContent.length > 1) {
                switch (charContent[1]) {
                    case 'n': charCode = 10; break;
                    case 'r': charCode = 13; break;
                    case 't': charCode = 9;  break;
                    case "'": charCode = 39; break;
                    case '"': charCode = 34; break;
                    case '\\': charCode = 92; break;
                    case '0': charCode = 0;  break;
                    case 'x':
                        if (charContent.length > 2) {
                            const hexVal = parseInt(charContent.substring(2), 16);
                            charCode = isNaN(hexVal) ? 'x'.charCodeAt(0) : hexVal;
                        } else {
                           charCode = 'x'.charCodeAt(0);
                        }
                        break;
                    default:
                        charCode = charContent.charCodeAt(1);
                        break;
                }
            } else {
                charCode = charContent.charCodeAt(0);
            }

            if (!isNaN(charCode)) {
                numbers.push(charCode);
            }
        } else {
            // It's a number. `Number()` correctly handles "0x...", "0b...", and decimal.
            const num = Number(token);
            if (!isNaN(num)) {
                numbers.push(num);
            }
        }
    }
    
    return numbers;
}


export function parseImportedData(options: ImportOptions): ParsedFontData {
    const { rawData, rawWidths, rawOffsets, characterSet, charHeight, charWidth, isDynamic } = options;
    const generatedChars: GeneratedChar[] = [];
    const uniqueChars = [...new Set(characterSet.split(''))];

    if (charHeight <= 0 || charHeight > 8) {
        throw new Error(`Invalid height: ${charHeight}. Must be between 1 and 8.`);
    }

    if (isDynamic) {
        // --- DYNAMIC WIDTH FONT PARSING ---
        const dataBytes = parseArrayString(rawData);
        const widths = parseArrayString(rawWidths);
        const offsets = parseArrayString(rawOffsets);

        if (widths.length > 0 && (uniqueChars.length !== widths.length || uniqueChars.length !== offsets.length)) {
             throw new Error(`Mismatch in array lengths: Character set (${uniqueChars.length}), widths (${widths.length}), and offsets (${offsets.length}) must all be the same size.`);
        }
        if (widths.length === 0 && uniqueChars.length > 0) {
             throw new Error(`Widths array appears to be empty or could not be parsed, but there are ${uniqueChars.length} characters in the set.`);
        }


        let maxWidth = 0;
        for (let i = 0; i < uniqueChars.length; i++) {
            const char = uniqueChars[i];
            const width = widths[i];
            const offset = offsets[i];
            
            if (width > maxWidth) maxWidth = width;

            if (offset + width > dataBytes.length) {
                throw new Error(`Character '${char}' (index ${i}) has an offset+width (${offset}+${width}) that exceeds the data array bounds (${dataBytes.length}).`);
            }

            const bytes = dataBytes.slice(offset, offset + width);
            const bitmap = bytesToBitmap(bytes, width, charHeight);

            generatedChars.push({
                char,
                ascii: char.charCodeAt(0),
                bitmap,
                bytes,
            });
        }
        
        return {
            fontData: generatedChars,
            fontOptions: {
                width: maxWidth > 0 ? maxWidth : 8, // Sensible default if no chars
                height: charHeight,
                characterSet: characterSet,
                dynamicWidth: true,
                charSpacing: 0,
            }
        };

    } else {
        // --- FIXED WIDTH FONT PARSING ---
        if (charWidth <= 0) {
            throw new Error(`Invalid width: ${charWidth}. Must be a positive number for fixed-width fonts.`);
        }
        
        const dataBytes = parseArrayString(rawData);
        
        if (dataBytes.length === 0 && uniqueChars.length > 0) {
            throw new Error(`Data array is empty or could not be parsed, but found ${uniqueChars.length} character(s) in the set.`);
        }

        const expectedBytes = uniqueChars.length * charWidth;
        
        if (dataBytes.length !== expectedBytes && uniqueChars.length > 0) {
            throw new Error(`Data array size mismatch. Expected ${expectedBytes} bytes (${uniqueChars.length} chars * ${charWidth} width), but found ${dataBytes.length}.`);
        }

        for (let i = 0; i < uniqueChars.length; i++) {
            const char = uniqueChars[i];
            const startIndex = i * charWidth;
            const bytes = dataBytes.slice(startIndex, startIndex + charWidth);
            const bitmap = bytesToBitmap(bytes, charWidth, charHeight);

            generatedChars.push({
                char,
                ascii: char.charCodeAt(0),
                bitmap,
                bytes,
            });
        }
        
        return {
            fontData: generatedChars,
            fontOptions: {
                width: charWidth,
                height: charHeight,
                characterSet: characterSet,
                dynamicWidth: false,
                charSpacing: 0, // Assuming imported fonts have spacing baked in
            }
        };
    }
}
