
import React, { useState, useEffect } from 'react';
import type { GeneratedChar } from '../types';
import CharGrid from './CharGrid';
import { CloseIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';

interface CharEditorModalProps {
  charData: GeneratedChar;
  height: number;
  onSave: (newBitmap: boolean[][]) => void;
  onClose: () => void;
  isDynamicWidth: boolean;
  fullFontData: GeneratedChar[];
}

const CharEditorModal: React.FC<CharEditorModalProps> = ({ charData, height, onSave, onClose, isDynamicWidth, fullFontData }) => {
  const [bitmap, setBitmap] = useState<boolean[][]>(charData.bitmap);
  const [charToCopyAscii, setCharToCopyAscii] = useState<string>('');


  // Reset local state if the character prop changes
  useEffect(() => {
    setBitmap(charData.bitmap);
    setCharToCopyAscii(''); // Reset selection when modal opens for a new char
  }, [charData]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleWidthChange = (delta: number) => {
    setBitmap(prevBitmap => {
      const currentWidth = prevBitmap[0]?.length || 0;
      const newWidth = Math.max(0, currentWidth + delta);

      if (newWidth === currentWidth) {
        return prevBitmap;
      }

      return prevBitmap.map(row => {
        if (delta > 0) {
          // Add columns
          return [...row, ...Array(delta).fill(false)];
        } else {
          // Remove columns
          return row.slice(0, newWidth);
        }
      });
    });
  };

  const handlePixelToggle = (x: number, y: number) => {
    const newBitmap = bitmap.map(row => [...row]);
    if (newBitmap[y]?.[x] !== undefined) {
      newBitmap[y][x] = !newBitmap[y][x];
      setBitmap(newBitmap);
    }
  };
  
  const handleShift = (direction: 'up' | 'down' | 'left' | 'right') => {
    setBitmap(prevBitmap => {
      const currentHeight = prevBitmap.length;
      if (currentHeight === 0) return prevBitmap;
      const currentWidth = prevBitmap[0]?.length || 0;
      if (currentWidth === 0 && (direction === 'left' || direction === 'right')) return prevBitmap;
  
      const newBitmap = prevBitmap.map(row => [...row]);
  
      switch (direction) {
        case 'up':
          newBitmap.shift();
          newBitmap.push(new Array(currentWidth).fill(false));
          break;
        case 'down':
          newBitmap.pop();
          newBitmap.unshift(new Array(currentWidth).fill(false));
          break;
        case 'left':
          for (let y = 0; y < currentHeight; y++) {
            newBitmap[y].shift();
            newBitmap[y].push(false);
          }
          break;
        case 'right':
          for (let y = 0; y < currentHeight; y++) {
            newBitmap[y].unshift(false);
            newBitmap[y].pop();
          }
          break;
      }
      return newBitmap;
    });
  };

  const handleCopyFromChar = () => {
    if (!charToCopyAscii) return; // No character selected

    const sourceChar = fullFontData.find(c => c.ascii === parseInt(charToCopyAscii, 10));
    if (!sourceChar) return; // Character not found

    // Deep copy the bitmap to avoid reference issues.
    const newBitmap = sourceChar.bitmap.map(row => [...row]);

    setBitmap(newBitmap);
  };

  const handleSave = () => {
    onSave(bitmap);
  };

  const charWidth = bitmap[0]?.length || 0;
  const commonButtonClasses = "p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-lg flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent click inside from closing
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="editor-title" className="text-xl font-semibold text-cyan-300">
            Edit Character: <span className="font-mono text-white">{charData.char === ' ' ? '" "' : charData.char}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close editor">
            <CloseIcon />
          </button>
        </header>

        <main className="p-6 flex-grow flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-4">
              {/* Vertical shift controls */}
              <div className="flex flex-col gap-2 self-stretch justify-center">
                  <button onClick={() => handleShift('up')} className={commonButtonClasses} aria-label="Shift character up">
                      <ArrowUpIcon />
                  </button>
                  <button onClick={() => handleShift('down')} className={commonButtonClasses} aria-label="Shift character down">
                      <ArrowDownIcon />
                  </button>
              </div>

              {/* Grid and bottom controls */}
              <div className="flex flex-col items-center gap-4">
                  <CharGrid 
                      charData={{...charData, bitmap}} // Pass the local, mutable bitmap
                      width={charWidth} 
                      height={height}
                      onPixelToggle={handlePixelToggle}
                      zoom={4} // Use a large fixed zoom for editing
                  />
                  
                  {/* Bottom controls container */}
                  <div className="flex flex-col items-center gap-3">
                      {/* Horizontal shift controls */}
                      <div className="flex items-center gap-2">
                          <button onClick={() => handleShift('left')} className={commonButtonClasses} aria-label="Shift character left">
                              <ArrowLeftIcon />
                          </button>
                          <button onClick={() => handleShift('right')} className={commonButtonClasses} aria-label="Shift character right">
                              <ArrowRightIcon />
                          </button>
                      </div>

                      {/* Width controls */}
                      {isDynamicWidth && (
                          <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg">
                              <span className="font-medium text-gray-300 text-sm">Width:</span>
                              <button 
                                  onClick={() => handleWidthChange(-1)} 
                                  disabled={charWidth <= 0} 
                                  className="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Decrease width"
                              >
                                  -
                              </button>
                              <span className="font-mono text-lg text-white w-10 text-center bg-gray-700/50 rounded-md py-1">{charWidth}</span>
                              <button 
                                  onClick={() => handleWidthChange(1)} 
                                  className="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
                                  aria-label="Increase width"
                              >
                                  +
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
          <div className="mt-6 p-4 bg-gray-900/50 border border-gray-700 rounded-lg w-full max-w-md mx-auto">
            <h4 className="text-md font-semibold text-gray-300 mb-3">Copy Pixels From Character</h4>
            <div className="flex items-center gap-3">
                <select
                    value={charToCopyAscii}
                    onChange={(e) => setCharToCopyAscii(e.target.value)}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                    aria-label="Select character to copy from"
                >
                    <option value="" disabled>Select a character...</option>
                    {fullFontData.map(c => (
                        <option key={c.ascii} value={c.ascii}>
                            {c.char === ' ' ? '" "' : c.char} (ASCII: {c.ascii})
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleCopyFromChar}
                    disabled={!charToCopyAscii}
                    className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Copy
                </button>
            </div>
        </div>
        </main>
        
        <footer className="flex justify-end gap-3 p-4 bg-gray-900/50 border-t border-gray-700 rounded-b-xl mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors"
          >
            Save & Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CharEditorModal;
