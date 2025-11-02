
import React, { useState } from 'react';
import type { ParsedFontData, GeneratedChar } from '../types';
import { parseImportedData, parseArrayString } from '../services/fontParser';
import { CloseIcon, UploadIcon } from './Icons';

interface ImportFontModalProps {
  onClose: () => void;
  onImport: (data: ParsedFontData) => void;
}

// --- Conversion Helper Functions ---

function bitmapToBytes(bitmap: boolean[][], height: number): number[] {
    const bytes: number[] = [];
    const width = bitmap[0]?.length || 0;
    for (let c = 0; c < width; c++) {
        let byte = 0;
        for (let r = 0; r < height; r++) {
            if (bitmap[r]?.[c]) {
                byte |= (1 << (height - 1 - r));
            }
        }
        bytes.push(byte);
    }
    return bytes;
}

function alignBitmap(bitmap: boolean[][], direction: 'top' | 'bottom'): boolean[][] {
  const height = bitmap.length;
  if (height === 0) return bitmap;
  const width = bitmap[0]?.length ?? 0;
  
  let firstRowWithPixel = -1;
  let lastRowWithPixel = -1;

  for (let r = 0; r < height; r++) {
    if (bitmap[r].some(pixel => pixel)) {
      if (firstRowWithPixel === -1) {
        firstRowWithPixel = r;
      }
      lastRowWithPixel = r;
    }
  }
  
  // No pixels in bitmap, no change needed
  if (firstRowWithPixel === -1) {
    return bitmap;
  }

  const newBitmap = Array.from({ length: height }, () => new Array(width).fill(false));

  if (direction === 'top') {
    const shiftAmount = firstRowWithPixel;
    if (shiftAmount === 0) return bitmap; // Already top-aligned
    for (let r = shiftAmount; r < height; r++) {
      newBitmap[r - shiftAmount] = bitmap[r];
    }
  } else { // bottom
    const shiftAmount = (height - 1) - lastRowWithPixel;
    if (shiftAmount === 0) return bitmap; // Already bottom-aligned
    for (let r = 0; r <= lastRowWithPixel; r++) {
      newBitmap[r + shiftAmount] = bitmap[r];
    }
  }
  return newBitmap;
}


function convertToDynamic(fontData: GeneratedChar[], originalWidth: number): { newData: GeneratedChar[], maxWidth: number } {
  let maxWidth = 0;
  const newData = fontData.map(charData => {
    if (charData.char === ' ') {
      const spaceWidth = Math.max(1, Math.floor(originalWidth / 2));
      const newBitmap = Array.from({ length: charData.bitmap.length }, () => new Array(spaceWidth).fill(false));
      const newBytes = Array(spaceWidth).fill(0);
      if (spaceWidth > maxWidth) maxWidth = spaceWidth;
      return { ...charData, bitmap: newBitmap, bytes: newBytes };
    }

    let minX = charData.bitmap[0]?.length ?? 0;
    let maxX = -1;
    const height = charData.bitmap.length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < (charData.bitmap[y]?.length ?? 0); x++) {
        if (charData.bitmap[y][x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    if (maxX === -1) { // Empty character
      return { ...charData, bitmap: Array.from({ length: height }, () => []), bytes: [] };
    } else {
      const newWidth = maxX - minX + 1;
      if (newWidth > maxWidth) maxWidth = newWidth;
      const newBitmap = charData.bitmap.map(row => row.slice(minX, maxX + 1));
      const newBytes = charData.bytes.slice(minX, maxX + 1);
      return { ...charData, bitmap: newBitmap, bytes: newBytes };
    }
  });
  return { newData, maxWidth };
}


function convertToFixed(fontData: GeneratedChar[], newWidth: number): GeneratedChar[] {
  return fontData.map(charData => {
    const currentWidth = charData.bytes.length;
    if (currentWidth === newWidth) return charData;

    let newBitmap: boolean[][];
    let newBytes: number[];

    if (currentWidth > newWidth) { // Truncate
      newBitmap = charData.bitmap.map(row => row.slice(0, newWidth));
      newBytes = charData.bytes.slice(0, newWidth);
    } else { // Pad
      const paddingCols = newWidth - currentWidth;
      const bitmapPadding = Array(paddingCols).fill(false);
      newBitmap = charData.bitmap.map(row => [...row, ...bitmapPadding]);
      const bytePadding = Array(paddingCols).fill(0);
      newBytes = [...charData.bytes, ...bytePadding];
    }

    return { ...charData, bitmap: newBitmap, bytes: newBytes };
  });
}


const ImportFontModal: React.FC<ImportFontModalProps> = ({ onClose, onImport }) => {
  const [isDynamic, setIsDynamic] = useState(false);
  const [characterSet, setCharacterSet] = useState('');
  const [height, setHeight] = useState(8);
  const [width, setWidth] = useState(6); // Only for fixed-width
  const [rawData, setRawData] = useState('');
  const [rawWidths, setRawWidths] = useState('');
  const [rawOffsets, setRawOffsets] = useState('');
  const [startAscii, setStartAscii] = useState('20');
  const [error, setError] = useState<string | null>(null);

  // State for adding custom range
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');


  // State for the second (conversion) step
  const [parsedData, setParsedData] = useState<ParsedFontData | null>(null);
  const [conversionMode, setConversionMode] = useState<'keep' | 'convert'>('keep');
  const [newFixedWidth, setNewFixedWidth] = useState(8);
  const [verticalAlign, setVerticalAlign] = useState<'keep' | 'top' | 'bottom'>('keep');


  const handleParseAndPreview = () => {
    setError(null);
    try {
      const result = parseImportedData({
        rawData,
        rawWidths,
        rawOffsets,
        characterSet,
        charHeight: height,
        charWidth: width,
        isDynamic,
      });
      setParsedData(result);
      // Set sensible defaults for the conversion screen
      setConversionMode('keep'); 
      setVerticalAlign('keep');
      setNewFixedWidth(result.fontOptions.width || 8);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unknown error occurred during parsing.');
      }
    }
  };

  const handleFinalImport = () => {
    if (!parsedData) return;

    try {
        let tempFontData = [...parsedData.fontData];
        let tempFontOptions = {...parsedData.fontOptions};

        // 1. Apply fixed/dynamic conversion if requested
        if (conversionMode === 'convert') {
            if (parsedData.fontOptions.dynamicWidth) {
                // Dynamic -> Fixed
                tempFontData = convertToFixed(parsedData.fontData, newFixedWidth);
                tempFontOptions = {
                    ...parsedData.fontOptions,
                    dynamicWidth: false,
                    width: newFixedWidth,
                    charSpacing: 1, // Add a default spacing
                    autoAlign: 'bottom',
                };
            } else {
                // Fixed -> Dynamic
                const { newData, maxWidth } = convertToDynamic(parsedData.fontData, parsedData.fontOptions.width || 0);
                tempFontData = newData;
                tempFontOptions = {
                    ...parsedData.fontOptions,
                    dynamicWidth: true,
                    width: maxWidth,
                    charSpacing: 0,
                    autoAlign: 'bottom',
                };
            }
        }
        
        // 2. Apply vertical alignment if requested
        if (verticalAlign !== 'keep') {
            tempFontData = tempFontData.map(charData => {
                const newBitmap = alignBitmap(charData.bitmap, verticalAlign);
                const newBytes = bitmapToBytes(newBitmap, tempFontOptions.height || height);
                return {...charData, bitmap: newBitmap, bytes: newBytes};
            });
        }
        
        const finalData: ParsedFontData = {
            fontData: tempFontData,
            fontOptions: tempFontOptions
        };

        onImport(finalData);
    } catch(e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred during conversion.');
        }
    }
  };


  const handleFillAscii = () => {
    const chars = [];
    for (let i = 32; i <= 126; i++) {
        chars.push(String.fromCharCode(i));
    }
    setCharacterSet(chars.join(''));
  };

  const handleAppendLatin1 = () => {
    const chars = [];
    for (let i = 160; i <= 255; i++) {
        chars.push(String.fromCharCode(i));
    }
    setCharacterSet(prev => {
        const combined = prev + chars.join('');
        const uniqueChars = [...new Set(Array.from(combined))];
        uniqueChars.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
        return uniqueChars.join('');
    });
  };

  const handleAppendCyrillic = () => {
    const cyrillicChars = [];
    // Capital letters А-Я (U+0410 to U+042F)
    for (let i = 1040; i <= 1071; i++) {
        cyrillicChars.push(String.fromCharCode(i));
    }
    // Small letters а-я (U+0430 to U+044F)
    for (let i = 1072; i <= 1103; i++) {
        cyrillicChars.push(String.fromCharCode(i));
    }
    // Add Ё (U+0401) and ё (U+0451)
    cyrillicChars.push(String.fromCharCode(1025)); // Ё
    cyrillicChars.push(String.fromCharCode(1105)); // ё
    
    setCharacterSet(prev => {
        const combined = prev + cyrillicChars.join('');
        const uniqueChars = [...new Set(Array.from(combined))];
        uniqueChars.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
        return uniqueChars.join('');
    });
  };
  
  const handleAddCustomRange = () => {
    setError(null);
    const start = parseInt(rangeStart, 16);
    const end = parseInt(rangeEnd, 16);

    if (isNaN(start) || isNaN(end)) {
        setError('Please enter valid hexadecimal codes for the start and end of the range.');
        return;
    }

    if (start > end) {
        setError('The "Start" code cannot be greater than the "End" code.');
        return;
    }

    setCharacterSet(prev => {
        const charsToAdd = [];
        for (let i = start; i <= end; i++) {
            charsToAdd.push(String.fromCodePoint(i));
        }
        const combined = prev + charsToAdd.join('');
        const uniqueChars = [...new Set(Array.from(combined))];
        uniqueChars.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));
        return uniqueChars.join('');
    });
    
    setRangeStart('');
    setRangeEnd('');
  };


  const handleGenerateFromAscii = () => {
    setError(null);
    try {
        const startCode = parseInt(startAscii, 16);
        if (isNaN(startCode)) {
            throw new Error('Invalid "Start Hex Code". Please enter a valid hex number.');
        }

        let numChars = 0;

        if (isDynamic) {
            if (!rawWidths.trim()) {
                throw new Error('The "Widths Array" is empty. Please paste the widths data to determine character count.');
            }
            const widths = parseArrayString(rawWidths);
            if (widths.length === 0) {
                throw new Error('Could not parse any numbers from the "Widths Array". Please check the format (e.g., { 1, 2, 3 }).');
            }
            numChars = widths.length;

        } else {
            if (width <= 0) {
                throw new Error('The "Character Width" must be a positive number.');
            }
            if (!rawData.trim()) {
                throw new Error('The "Font Data Array" is empty. Please paste the font data to determine character count.');
            }
            const dataBytes = parseArrayString(rawData);
            if (dataBytes.length === 0) {
                 throw new Error('Could not parse any numbers from the "Font Data Array". Please check the format (e.g., { 0x01, 0x02, 0x03 }).');
            }
            
            if (dataBytes.length % width !== 0) {
                setError(`Warning: Data array size (${dataBytes.length}) is not a perfect multiple of the character width (${width}). Some data may be truncated.`);
            }
            numChars = Math.floor(dataBytes.length / width);
        }
        
        if (numChars <= 0) {
            throw new Error(`Based on the provided data and settings, the calculated number of characters is ${numChars}. Cannot generate character set.`);
        }
        
        const chars = Array.from({ length: numChars }, (_, i) => String.fromCodePoint(startCode + i));
        setCharacterSet(chars.join(''));

    } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred while generating the character set.');
        }
    }
  };

  const renderImportForm = () => {
    const commonTextareaClasses = "bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono resize-y focus:ring-2 focus:ring-cyan-400 focus:outline-none transition w-full";
    const fieldsetClasses = "border border-gray-600 rounded-xl p-4";
    const legendClasses = "text-cyan-300 font-semibold px-2 text-lg";
    const stepNumberClasses = "text-gray-500 mr-2 font-normal";
    const smallInputClasses = "bg-gray-600 border border-gray-500 rounded-md px-2 py-1 text-white text-sm focus:ring-1 focus:ring-cyan-400 focus:outline-none";
    const helperButtonClasses = "text-xs bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-2 rounded-md transition-colors";

    return (
      <div className="space-y-6">
        {/* --- STEP 1: Select Font Type --- */}
        <fieldset className={fieldsetClasses}>
          <legend className={legendClasses}><span className={stepNumberClasses}>1.</span>Select Font Type</legend>
          <div className="flex flex-col space-y-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer mt-1">
              <input type="checkbox" name="dynamicWidth" checked={isDynamic} onChange={(e) => setIsDynamic(e.target.checked)} />
              <span className="font-medium text-gray-300">Dynamic Width Font</span>
            </label>
            <p className="text-xs text-gray-500 pl-7">Check this if your font uses width and offset lookup tables.</p>
          </div>
        </fieldset>

        {/* --- STEP 2: Provide Font Data --- */}
        <fieldset className={fieldsetClasses}>
          <legend className={legendClasses}><span className={stepNumberClasses}>2.</span>Provide Font Data</legend>
          <div className="space-y-4">
            <div>
              <label htmlFor="rawData" className="mb-2 font-medium text-gray-300 block">Font Data Array</label>
              <textarea id="rawData" value={rawData} onChange={(e) => setRawData(e.target.value)} className={`${commonTextareaClasses} h-32`} placeholder="const unsigned char font[] = { ... };" required />
              <p className="text-xs text-gray-500 mt-1">Paste the entire array, including brackets.</p>
            </div>
            <div className={`space-y-4 transition-opacity ${!isDynamic ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div>
                <label htmlFor="rawWidths" className={`mb-2 font-medium text-gray-300 block ${!isDynamic ? 'text-gray-500' : ''}`}>Widths Array (for Dynamic Width)</label>
                <textarea id="rawWidths" value={rawWidths} onChange={(e) => setRawWidths(e.target.value)} className={`${commonTextareaClasses} h-24`} placeholder="const unsigned char font_widths[] = { ... };" required={isDynamic} disabled={!isDynamic} />
              </div>
              <div>
                <label htmlFor="rawOffsets" className={`mb-2 font-medium text-gray-300 block ${!isDynamic ? 'text-gray-500' : ''}`}>Offsets Array (for Dynamic Width)</label>
                <textarea id="rawOffsets" value={rawOffsets} onChange={(e) => setRawOffsets(e.target.value)} className={`${commonTextareaClasses} h-24`} placeholder="const unsigned int font_offsets[] = { ... };" required={isDynamic} disabled={!isDynamic} />
              </div>
            </div>
          </div>
        </fieldset>

        {/* --- STEP 3: Define Character Set --- */}
        <fieldset className={fieldsetClasses}>
          <legend className={legendClasses}><span className={stepNumberClasses}>3.</span>Define Character Set</legend>
          <div className="space-y-4">
            <div>
              <label htmlFor="characterSet" className="mb-2 font-medium text-gray-300 block">Character Set String (in order)</label>
              <textarea id="characterSet" value={characterSet} onChange={(e) => setCharacterSet(e.target.value)} className={`${commonTextareaClasses} h-24`} placeholder="Paste characters here, or use the helpers below..." required />
              <p className="text-xs text-gray-500 mt-1">This is crucial for mapping data to characters correctly.</p>
            </div>

            <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 space-y-3">
              <h4 className="text-sm font-semibold text-gray-300">Helpers</h4>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400 font-medium">Presets:</span>
                <button onClick={handleFillAscii} className={helperButtonClasses}>ASCII (0x20-0x7E)</button>
                <button onClick={handleAppendLatin1} className={helperButtonClasses}>+ Latin-1 (0xA0-0xFF)</button>
                <button onClick={handleAppendCyrillic} className={helperButtonClasses}>+ Cyrillic (0x0410-0x044F)</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-600">
                <span className="text-sm text-gray-400 font-medium mr-1">Add Range (Hex):</span>
                <input type="text" placeholder="Start (Hex)" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={`${smallInputClasses} font-mono w-24`} aria-label="Custom Range Start Hex Code" />
                <input type="text" placeholder="End (Hex)" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={`${smallInputClasses} font-mono w-24`} aria-label="Custom Range End Hex Code" />
                <button onClick={handleAddCustomRange} className={helperButtonClasses}>Add</button>
              </div>
              <div className="pt-2 border-t border-gray-600">
                <p className="text-sm font-semibold text-gray-300">Generate from Data</p>
                <p className="text-xs text-gray-400 mb-2">Calculates the character set from your pasted arrays in Step 2.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-400 font-medium mr-1">Start Hex Code:</span>
                  <input type="text" value={startAscii} onChange={e => setStartAscii(e.target.value)} className={`${smallInputClasses} font-mono w-24`} aria-label="Starting Hex Code" />
                  <button onClick={handleGenerateFromAscii} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1 px-2 rounded-md transition-colors">Generate Set</button>
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* --- STEP 4: Define Dimensions --- */}
        <fieldset className={fieldsetClasses}>
          <legend className={legendClasses}><span className={stepNumberClasses}>4.</span>Define Dimensions</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="height" className="mb-2 font-medium text-gray-300">Character Height (px)</label>
              <input type="number" id="height" value={height} onChange={e => setHeight(parseInt(e.target.value, 10))} min="1" max="8" className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition" required />
              <p className="text-xs text-gray-500 mt-1">Must be between 1 and 8.</p>
            </div>
            <div className={`flex flex-col transition-opacity ${isDynamic ? 'opacity-50' : ''}`}>
              <label htmlFor="width" className="mb-2 font-medium text-gray-300">Character Width (px)</label>
              <input type="number" id="width" value={width} onChange={e => setWidth(parseInt(e.target.value, 10))} min="1" disabled={isDynamic} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">Required for fixed-width fonts only.</p>
            </div>
          </div>
        </fieldset>
      </div>
    );
  };

  const renderConversionStep = () => {
    if (!parsedData) return null;
    const isOriginallyDynamic = parsedData.fontOptions.dynamicWidth;
    
    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-white">Import Successful!</h3>
                <p className="text-gray-400 mt-1">
                    Successfully parsed a <strong className="text-cyan-400">{isOriginallyDynamic ? 'Dynamic-Width' : 'Fixed-Width'}</strong> font
                    with <strong className="text-cyan-400">{parsedData.fontData.length}</strong> characters.
                </p>
            </div>
            
            <fieldset className="border border-gray-600 rounded-xl p-4">
                <legend className="text-cyan-300 font-semibold px-2">Format Conversion</legend>
                <div className="mt-2 space-y-3 rounded-lg bg-gray-900/50 p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="conversion" value="keep" checked={conversionMode === 'keep'} onChange={() => setConversionMode('keep')} className="w-4 h-4" />
                        <span className="font-medium text-gray-200">Keep as {isOriginallyDynamic ? 'Dynamic-Width' : 'Fixed-Width'}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="conversion" value="convert" checked={conversionMode === 'convert'} onChange={() => setConversionMode('convert')} className="w-4 h-4"/>
                        <span className="font-medium text-gray-200">Convert to {isOriginallyDynamic ? 'Fixed-Width' : 'Dynamic-Width'}</span>
                    </label>
                </div>

                {conversionMode === 'convert' && (
                    <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                        {isOriginallyDynamic ? (
                            <div>
                                <label htmlFor="newFixedWidth" className="mb-2 font-medium text-gray-300 block">New Fixed Width (px)</label>
                                <input 
                                    type="number" 
                                    id="newFixedWidth"
                                    value={newFixedWidth} 
                                    onChange={e => setNewFixedWidth(Math.max(1, parseInt(e.target.value, 10)))}
                                    min="1"
                                    className="bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition w-full"
                                />
                                <p className="text-xs text-gray-400 mt-1">Pads or truncates all characters to this width.</p>
                                {newFixedWidth < (parsedData.fontOptions.width || 0) && (
                                    <p className="text-xs text-amber-400 mt-2">Warning: Some characters are wider than {newFixedWidth}px and will be truncated.</p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h4 className="font-medium text-gray-300">Dynamic Width Conversion</h4>
                                <p className="text-sm text-gray-400 mt-1">This will automatically trim empty columns from the start and end of each character to optimize storage space.</p>
                            </div>
                        )}
                    </div>
                )}
            </fieldset>

            <fieldset className="border border-gray-600 rounded-xl p-4">
                <legend className="text-cyan-300 font-semibold px-2">Vertical Alignment</legend>
                <div className="mt-2 space-y-3 rounded-lg bg-gray-900/50 p-4">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="alignment" value="keep" checked={verticalAlign === 'keep'} onChange={() => setVerticalAlign('keep')} className="w-4 h-4" />
                        <span className="font-medium text-gray-200">Keep Original</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="alignment" value="top" checked={verticalAlign === 'top'} onChange={() => setVerticalAlign('top')} className="w-4 h-4" />
                        <span className="font-medium text-gray-200">Align All to Top</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="alignment" value="bottom" checked={verticalAlign === 'bottom'} onChange={() => setVerticalAlign('bottom')} className="w-4 h-4"/>
                        <span className="font-medium text-gray-200">Align All to Bottom</span>
                    </label>
                </div>
                 <p className="text-xs text-gray-500 mt-2 p-1">Shifts the pixels of all characters to be flush with the top or bottom of the grid.</p>
            </fieldset>

        </div>
    );
  };


  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 id="import-title" className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
            <UploadIcon />
            Import Existing Font Array
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close import dialog">
            <CloseIcon />
          </button>
        </header>

        <main className="p-6 flex-grow overflow-y-auto space-y-6">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">{error}</div>}
          {parsedData ? renderConversionStep() : renderImportForm()}
        </main>
        
        <footer className="flex justify-end gap-3 p-4 bg-gray-900/50 border-t border-gray-700 rounded-b-xl flex-shrink-0">
          {parsedData ? (
              <>
                <button onClick={() => setParsedData(null)} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">
                    Back
                </button>
                <button onClick={handleFinalImport} className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors flex items-center gap-2">
                    <UploadIcon />
                    Confirm &amp; Import
                </button>
              </>
          ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">
                    Cancel
                </button>
                <button onClick={handleParseAndPreview} className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors">
                    Parse &amp; Continue
                </button>
              </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ImportFontModal;