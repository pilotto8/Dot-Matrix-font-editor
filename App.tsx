
import React, { useState, useCallback, useEffect, useRef } from 'react';
// Fix: Import ParsedFontData from types.ts
import type { GeneratedChar, FontGeneratorOptions, ParsedFontData } from './types';
import { generateFontData, generatePreviewFontData, generateChars } from './services/fontGenerator';
// Fix: Remove ParsedFontData from this import as it's now in types.ts
import { parseImportedData } from './services/fontParser';
import FontPreview from './components/FontPreview';
import CodeOutput from './components/CodeOutput';
import CharGrid from './components/CharGrid';
import CharEditorModal from './components/CharEditorModal';
import ImportFontModal from './components/ImportFontModal';
import AddCharModal from './components/AddCharModal';
import { GithubIcon, SparklesIcon, ChevronDownIcon, UploadIcon } from './components/Icons';

const App: React.FC = () => {
  const [options, setOptions] = useState<FontGeneratorOptions>({
    fontFamily: 'VT323',
    fontWeight: 'normal',
    width: 6,
    height: 8,
    charSpacing: 1,
    characterSet: Array.from({ length: 126 - 32 + 1 }, (_, i) => String.fromCharCode(32 + i)).join(''),
    fontSizeAdjustment: 0,
    renderMode: 'aliased',
    renderThreshold: 128,
    autoAlign: 'bottom',
    xOffset: 0,
    yOffset: 0,
    dynamicWidth: false,
  });
  const [fontData, setFontData] = useState<GeneratedChar[] | null>(null);
  const [previewData, setPreviewData] = useState<GeneratedChar[] | null>(null);
  const [previewText, setPreviewText] = useState<string>('Hello\nWorld!');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCharSetVisible, setIsCharSetVisible] = useState(true);
  const [isStylePreviewVisible, setIsStylePreviewVisible] = useState(true);
  const [isLivePreviewVisible, setIsLivePreviewVisible] = useState(true);
  const [editingChar, setEditingChar] = useState<{ char: GeneratedChar; index: number; isPreview: boolean } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddCharModalOpen, setIsAddCharModalOpen] = useState(false);

  const debounceTimeout = useRef<number | null>(null);

  const handleCharUpdate = (charIndex: number, newBitmap: boolean[][], isPreview: boolean) => {
    const dataUpdater = isPreview ? setPreviewData : setFontData;
    
    dataUpdater(prevData => {
        if (!prevData) return null;

        return prevData.map((char, index) => {
            if (index === charIndex) {
                const newBytes: number[] = [];
                const totalWidth = newBitmap[0]?.length || 0;
                for (let c = 0; c < totalWidth; c++) {
                    let byte = 0;
                    for (let r = 0; r < options.height; r++) {
                        if (newBitmap[r]?.[c]) {
                            byte |= (1 << (options.height - 1 - r));
                        }
                    }
                    newBytes.push(byte);
                }
                return { ...char, bitmap: newBitmap, bytes: newBytes };
            }
            return char;
        });
    });
    setEditingChar(null); // Close modal on save
  };

  const handleOpenEditor = (index: number, isPreview: boolean) => {
    const data = isPreview ? previewData : fontData;
    if (data && data[index]) {
        setEditingChar({ char: data[index], index, isPreview });
    }
  };


  useEffect(() => {
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = window.setTimeout(async () => {
        if (options.width <= 0 || options.height <= 0 || options.height > 8 || !options.characterSet || !previewText) {
            setPreviewData(null);
            return;
        }
        try {
            const data = await generatePreviewFontData(options, previewText);
            setPreviewData(data);
        } catch (e) {
            console.error('Failed to generate preview:', e);
            setPreviewData(null);
        }
    }, 250);

    return () => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
    };
  }, [options, previewText]);


  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFontData(null);
    try {
      if (options.height > 8) {
        throw new Error('Height cannot be greater than 8, as each column is represented by a single byte.');
      }
      if (options.width <= 0 || options.height <= 0) {
        throw new Error('Width and height must be positive numbers.');
      }
       if (!options.dynamicWidth && options.width < 0) { // Spacing is separate, so width can be 0.
        throw new Error('Glyph width cannot be negative.');
      }
      if (!options.characterSet) {
        throw new Error('Character set cannot be empty.');
      }
      const data = await generateFontData(options);
      setFontData(data);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
     if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setOptions(prev => ({ ...prev, [name]: checked }));
    } else {
        const isNumeric = ['width', 'height', 'fontSizeAdjustment', 'renderThreshold', 'charSpacing', 'xOffset', 'yOffset'].includes(name);
        const parsedValue = isNumeric ? parseInt(value, 10) : value;
        setOptions(prev => ({ ...prev, [name]: parsedValue }));
    }
  };
  
  const handleImport = (data: ParsedFontData) => {
    setError(null);
    setFontData(data.fontData);
    setOptions(prev => ({...prev, ...data.fontOptions}));
    setIsImportModalOpen(false);
  };


  const handleAddExtendedChars = () => {
    const extendedChars = [];
    // Latin-1 Supplement block (U+00A0 to U+00FF)
    for (let i = 160; i <= 255; i++) {
        extendedChars.push(String.fromCharCode(i));
    }
    
    setOptions(prev => {
        const combined = prev.characterSet + extendedChars.join('');
        const uniqueChars = [...new Set(combined.split(''))].join('');
        return { ...prev, characterSet: uniqueChars };
    });
  };

  const handleCharDelete = (indexToDelete: number) => {
      setFontData(prevData => {
          if (!prevData) return null;
          const charToDelete = prevData[indexToDelete];
          if (!charToDelete) return prevData;

          setOptions(prevOpt => ({
              ...prevOpt,
              characterSet: prevOpt.characterSet.replace(charToDelete.char, ''),
          }));

          return prevData.filter((_, index) => index !== indexToDelete);
      });
  };

  const handleCharAdd = (ascii: number) => {
      const newCharStr = String.fromCharCode(ascii);
      if (options.characterSet.includes(newCharStr)) {
          setError(`Character '${newCharStr}' (ASCII: ${ascii}) already exists in the font set.`);
          setIsAddCharModalOpen(false);
          return;
      }

      try {
          const [newCharData] = generateChars(options, [newCharStr]);
          
          const newCharacterSet = (options.characterSet + newCharStr)
              .split('')
              .sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0))
              .join('');

          const newFontData = [...(fontData || []), newCharData]
              .sort((a, b) => a.ascii - b.ascii);
          
          setOptions(prev => ({ ...prev, characterSet: newCharacterSet }));
          setFontData(newFontData);
          setIsAddCharModalOpen(false);

      } catch (e) {
          if (e instanceof Error) {
              setError(e.message);
          } else {
              setError('An unknown error occurred while adding the character.');
          }
      }
  };

  const commonFonts = [
    'Press Start 2P',
    'Silkscreen',
    'VT323',
    'Roboto Mono',
    'Source Code Pro',
    'Courier New',
    'Inconsolata',
    'Monospace',
  ];
  
  const pixelFonts = ['Press Start 2P', 'Silkscreen', 'VT323'];

  const previewElements: React.ReactNode[][] = [];
  if (previewData) {
      let currentLine: React.ReactNode[] = [];
      previewData.forEach((charData, index) => {
          if (charData.char === '\n') {
              previewElements.push(currentLine);
              currentLine = [];
          } else {
              const charWidth = charData.bitmap[0]?.length || 0;
              currentLine.push(
                  <CharGrid 
                      key={`${charData.ascii}-${index}`} 
                      charData={charData} 
                      width={charWidth} 
                      height={options.height}
                      onClick={() => handleOpenEditor(index, true)}
                  />
              );
          }
      });
      if (currentLine.length > 0 || previewText.endsWith('\n')) {
          previewElements.push(currentLine);
      }
  }

  return (
    <>
      {editingChar && (
        <CharEditorModal 
            charData={editingChar.char}
            height={options.height}
            onSave={(newBitmap) => handleCharUpdate(editingChar.index, newBitmap, editingChar.isPreview)}
            onClose={() => setEditingChar(null)}
            isDynamicWidth={options.dynamicWidth}
            fullFontData={(editingChar.isPreview ? previewData : fontData) || []}
        />
      )}
      {isImportModalOpen && (
          <ImportFontModal
              onClose={() => setIsImportModalOpen(false)}
              onImport={handleImport}
          />
      )}
      {isAddCharModalOpen && (
          <AddCharModal
              onClose={() => setIsAddCharModalOpen(false)}
              onAdd={handleCharAdd}
              existingChars={options.characterSet}
          />
      )}
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              Dot Matrix Font Generator
            </h1>
            <p className="mt-2 text-lg text-gray-400">Create and edit C/Python arrays for your dot matrix display projects.</p>
          </header>

          <main>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-8 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-6 text-cyan-300 flex items-center gap-2"><SparklesIcon/>Controls</h2>
              <div className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <fieldset className="border border-gray-600 rounded-xl p-4 flex flex-col space-y-4">
                    <legend className="text-cyan-300 font-semibold px-2">Font & Style</legend>
                    <div className="flex flex-col">
                      <label htmlFor="fontFamily" className="mb-2 font-medium text-gray-300">Font Family</label>
                      <select 
                        id="fontFamily" 
                        name="fontFamily"
                        value={options.fontFamily} 
                        onChange={handleOptionChange}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                      >
                        {commonFonts.map(font => <option key={font} value={font}>{font}</option>)}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Pixel and Monospace fonts are recommended for best results.</p>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="fontWeight" className="mb-2 font-medium text-gray-300">Font Weight</label>
                      <select 
                        id="fontWeight" 
                        name="fontWeight"
                        value={options.fontWeight} 
                        onChange={handleOptionChange}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Sets the thickness of the font. 'Bold' may require a larger character width.</p>
                    </div>
                    
                    <div className="flex flex-col">
                      <label htmlFor="fontSizeAdjustment" className="mb-2 font-medium text-gray-300">Font Size Adjustment</label>
                      <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            id="fontSizeAdjustment"
                            name="fontSizeAdjustment"
                            value={options.fontSizeAdjustment} 
                            onChange={handleOptionChange}
                            min="-5"
                            max="5"
                            step="1"
                            className="w-full appearance-none cursor-pointer"
                        />
                        <span className="bg-gray-700 text-xs font-mono rounded-md px-2 py-1 w-12 text-center">{options.fontSizeAdjustment}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Fine-tunes character size within the grid. Negative is smaller.</p>
                    </div>

                    <div className="flex flex-col space-y-2 pt-2 border-t border-gray-700/50">
                        <label className="font-medium text-gray-300">Vertical Alignment</label>
                        <div className="flex flex-col space-y-2">
                           <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="autoAlign" value="top" checked={options.autoAlign === 'top'} onChange={handleOptionChange} className="w-4 h-4" />
                                <span>Align Top</span>
                            </label>
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="autoAlign" value="bottom" checked={options.autoAlign === 'bottom'} onChange={handleOptionChange} className="w-4 h-4" />
                                <span>Align Bottom</span>
                            </label>
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="autoAlign" value="manual" checked={options.autoAlign === 'manual'} onChange={handleOptionChange} className="w-4 h-4" />
                                <span>Manual</span>
                            </label>
                        </div>
                         <p className="text-xs text-gray-500">Automatically aligns characters. Manual mode enables X/Y offsets.</p>
                    </div>

                    <div className={`flex flex-col space-y-4 transition-opacity ${options.autoAlign !== 'manual' ? 'opacity-50' : ''}`}>
                      <div className="flex flex-col">
                        <label htmlFor="xOffset" className="mb-2 font-medium text-gray-300">X Offset</label>
                        <div className="flex items-center gap-2">
                          <input 
                              type="range" 
                              id="xOffset"
                              name="xOffset"
                              value={options.xOffset} 
                              onChange={handleOptionChange}
                              min="-10"
                              max="10"
                              step="1"
                              disabled={options.autoAlign !== 'manual'}
                              className="w-full"
                          />
                          <span className="bg-gray-700 text-xs font-mono rounded-md px-2 py-1 w-12 text-center">{options.xOffset}</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="yOffset" className="mb-2 font-medium text-gray-300">Y Offset</label>
                        <div className="flex items-center gap-2">
                          <input 
                              type="range" 
                              id="yOffset"
                              name="yOffset"
                              value={options.yOffset} 
                              onChange={handleOptionChange}
                              min="-10"
                              max="10"
                              step="1"
                              disabled={options.autoAlign !== 'manual'}
                              className="w-full"
                          />
                          <span className="bg-gray-700 text-xs font-mono rounded-md px-2 py-1 w-12 text-center">{options.yOffset}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Manually adjust position when auto-align is off.</p>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="border border-gray-600 rounded-xl p-4 flex flex-col space-y-4">
                    <legend className="text-cyan-300 font-semibold px-2">Matrix Layout</legend>
                    <div className="flex flex-col space-y-2 pb-4 border-b border-gray-700/50">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="dynamicWidth"
                                checked={options.dynamicWidth}
                                onChange={handleOptionChange}
                            />
                            <span className="font-medium text-gray-300">Dynamic Character Width</span>
                        </label>
                        <p className="text-xs text-gray-500 pl-7">Trims empty columns and generates width/offset lookup tables.</p>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="width" className="mb-2 font-medium text-gray-300">
                        {options.dynamicWidth ? 'Max Char Width (px)' : 'Glyph Width (px)'}
                      </label>
                      <input 
                        type="number" 
                        id="width"
                        name="width"
                        value={options.width} 
                        onChange={handleOptionChange}
                        min="1"
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {options.dynamicWidth 
                          ? 'The bounding box for rendering before trimming.' 
                          : 'The width of the glyph itself, before spacing is added.'
                        }
                      </p>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="height" className="mb-2 font-medium text-gray-300">Char Height (px)</label>
                      <input 
                        type="number" 
                        id="height"
                        name="height"
                        value={options.height} 
                        onChange={handleOptionChange}
                        min="1" 
                        max="8"
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max 8 for 1 byte/col output format.</p>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="charSpacing" className={`mb-2 font-medium text-gray-300 transition-opacity ${options.dynamicWidth ? 'opacity-50' : ''}`}>
                        Spacing (px)
                      </label>
                      <input 
                        type="number" 
                        id="charSpacing"
                        name="charSpacing"
                        value={options.charSpacing} 
                        onChange={handleOptionChange}
                        min="0"
                        disabled={options.dynamicWidth}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {options.dynamicWidth 
                          ? 'Spacing is not applicable in dynamic width mode.'
                          : 'Empty pixel columns added after the glyph.'
                        }
                      </p>
                    </div>
                  </fieldset>

                  <fieldset className="border border-gray-600 rounded-xl p-4 flex flex-col space-y-4">
                    <legend className="text-cyan-300 font-semibold px-2">Rendering</legend>
                    <div className="flex flex-col">
                      <label htmlFor="renderMode" className="mb-2 font-medium text-gray-300">Render Mode</label>
                      <select 
                        id="renderMode" 
                        name="renderMode"
                        value={options.renderMode} 
                        onChange={handleOptionChange}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                      >
                        <option value="anti-aliased">Anti-Aliased (Quality)</option>
                        <option value="dithered">Dithered (Grayscale)</option>
                        <option value="aliased">Aliased (Fast)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">'Aliased' is sharp, ideal for pixel fonts. Other modes offer higher quality for standard fonts.</p>
                      {pixelFonts.includes(options.fontFamily) && options.renderMode !== 'aliased' && (
                          <p className="text-xs text-amber-400 mt-1">For best results with this font, try 'Aliased' render mode.</p>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="renderThreshold" className="mb-2 font-medium text-gray-300">Render Threshold</label>
                      <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            id="renderThreshold"
                            name="renderThreshold"
                            value={options.renderThreshold} 
                            onChange={handleOptionChange}
                            min="0"
                            max="255"
                            step="1"
                            disabled={options.renderMode === 'aliased'}
                            className="w-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="bg-gray-700 text-xs font-mono rounded-md px-2 py-1 w-12 text-center">{options.renderThreshold}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Brightness cutoff for quality modes. Lower values = more pixels.</p>
                    </div>
                  </fieldset>
                </div>
                
                <div>
                  <div className="flex justify-between items-center">
                      <button 
                          onClick={() => setIsCharSetVisible(!isCharSetVisible)} 
                          className="flex items-center gap-2 font-medium text-gray-300 hover:text-cyan-300 transition-colors w-full text-left py-1"
                          aria-expanded={isCharSetVisible}
                          aria-controls="character-set-content"
                      >
                          <ChevronDownIcon className={`transition-transform duration-200 ${isCharSetVisible ? '' : '-rotate-90'}`} />
                          <span>Character Set</span>
                      </button>
                      <button
                        onClick={handleAddExtendedChars}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-2 rounded-md transition-colors flex-shrink-0"
                        title="Append common extended ASCII/Latin-1 characters (e.g., é, ñ, ©)"
                      >
                        + Add Extended
                      </button>
                  </div>
                  {isCharSetVisible && (
                    <div id="character-set-content" className="mt-2">
                      <textarea
                          id="characterSet"
                          name="characterSet"
                          value={options.characterSet}
                          onChange={handleOptionChange}
                          className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono h-24 resize-y focus:ring-2 focus:ring-cyan-400 focus:outline-none transition w-full"
                          placeholder="Type all characters you want to generate here..."
                      />
                      <p className="text-xs text-gray-500 mt-1">All unique characters to include in the font data.</p>
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                  <button 
                      onClick={() => setIsStylePreviewVisible(!isStylePreviewVisible)} 
                      className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider w-full text-left hover:text-gray-200 transition-colors"
                      aria-expanded={isStylePreviewVisible}
                      aria-controls="style-preview-content"
                  >
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isStylePreviewVisible ? '' : '-rotate-90'}`} />
                      <span>Font Style Preview</span>
                  </button>
                  {isStylePreviewVisible && (
                    <div
                      id="style-preview-content"
                      className="mt-2 bg-gray-900 p-4 rounded text-white text-xl overflow-x-auto whitespace-nowrap"
                      style={{ fontFamily: options.fontFamily, fontWeight: options.fontWeight }}
                      aria-live="polite"
                      title={`Previewing font: ${options.fontFamily}`}
                    >
                      The quick brown fox jumps over the lazy dog. 1234567890
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                  <button 
                    onClick={() => setIsLivePreviewVisible(!isLivePreviewVisible)} 
                    className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider w-full text-left hover:text-gray-200 transition-colors"
                    aria-expanded={isLivePreviewVisible}
                    aria-controls="live-preview-content"
                  >
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isLivePreviewVisible ? '' : '-rotate-90'}`} />
                    <span>Live Character Preview & Editor</span>
                  </button>
                  {isLivePreviewVisible && (
                    <div id="live-preview-content" className="mt-3 flex flex-col gap-4">
                      <textarea
                          value={previewText}
                          onChange={(e) => setPreviewText(e.target.value)}
                          placeholder="Type to preview..."
                          className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white font-mono text-sm focus:ring-1 focus:ring-cyan-400 focus:outline-none transition w-full h-20 resize-y"
                          aria-label="Characters for live preview"
                          rows={3}
                      />
                      <div className="flex flex-col gap-3 justify-center bg-gray-900 p-4 rounded-md min-h-[140px] items-start overflow-x-auto">
                          {previewData && previewText ? (
                              previewElements.map((line, lineIndex) => (
                                <div key={lineIndex} className="flex flex-row flex-nowrap gap-3 justify-start">
                                  {line}
                                </div>
                              ))
                          ) : (
                              <div className="w-full flex justify-center items-center">
                                  <p className="text-gray-500">Adjust controls or type characters to preview...</p>
                              </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full sm:w-auto justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all duration-300 ease-in-out flex items-center gap-2"
                  >
                    <UploadIcon/>
                    Import Font
                  </button>
                  <button 
                    onClick={handleGenerate} 
                    disabled={isLoading}
                    className="w-full sm:w-auto justify-center bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Generating...' : 'Generate Font'}
                  </button>
              </div>
            </div>

            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-8" role="alert">{error}</div>}

            {isLoading && 
              <div className="text-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
                <p className="mt-4 text-gray-400">Rendering characters on canvas...</p>
              </div>
            }

            {fontData && (
              <div className="space-y-8">
                <FontPreview 
                  fontData={fontData} 
                  height={options.height}
                  onCharClick={(index) => handleOpenEditor(index, false)}
                  onCharDelete={handleCharDelete}
                  onAddCharClick={() => setIsAddCharModalOpen(true)}
                />
                <CodeOutput fontData={fontData} options={options} />
              </div>
            )}
          </main>
          
          <footer className="text-center mt-12 text-gray-500 text-sm">
              <p>Built by a world-class senior frontend React engineer.</p>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-cyan-400 transition-colors mt-2">
                  <GithubIcon />
                  View on GitHub
              </a>
          </footer>
        </div>
      </div>
    </>
  );
};

export default App;