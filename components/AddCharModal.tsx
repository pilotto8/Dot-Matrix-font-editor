
import React, { useState, useMemo } from 'react';
import { CloseIcon } from './Icons';

interface AddCharModalProps {
  onClose: () => void;
  onAdd: (codePoint: number) => void;
  existingChars: string;
}

const AddCharModal: React.FC<AddCharModalProps> = ({ onClose, onAdd, existingChars }) => {
  const [input, setInput] = useState('');

  const { char, codePoint, error } = useMemo(() => {
    if (!input) {
      return { char: '?', codePoint: null, error: null };
    }

    let parsedCodePoint: number | null = null;
    let parsedChar: string | null = null;
    let parseError: string | null = null;

    const trimmedInput = input.trim();
    if (trimmedInput.toLowerCase().startsWith('u+')) {
      parsedCodePoint = parseInt(trimmedInput.substring(2), 16);
    } else if (trimmedInput.toLowerCase().startsWith('0x')) {
      parsedCodePoint = parseInt(trimmedInput.substring(2), 16);
    } else if (/^\d+$/.test(trimmedInput)) {
      parsedCodePoint = parseInt(trimmedInput, 10);
    } else {
      // Treat as direct character input
      // Fix: Explicitly type 'chars' as string[] to resolve TS error.
      const chars: string[] = Array.from(trimmedInput); // Handles surrogate pairs
      if (chars.length === 1) {
        parsedChar = chars[0];
        parsedCodePoint = parsedChar.codePointAt(0)!;
      } else {
        parseError = 'Enter a single character or a valid code point.';
      }
    }

    if (parsedCodePoint !== null && !isNaN(parsedCodePoint)) {
      if (parsedCodePoint >= 0 && parsedCodePoint <= 0x10FFFF) {
        try {
          parsedChar = String.fromCodePoint(parsedCodePoint);
        } catch (e) {
          parseError = 'Invalid Unicode code point.';
          parsedChar = null;
          parsedCodePoint = null;
        }
      } else {
        parseError = 'Code point out of range (0 to 10FFFF).';
        parsedChar = null;
        parsedCodePoint = null;
      }
    } else if (parsedCodePoint === null && !parseError) {
        // This case handles non-numeric inputs that aren't a single character
        parseError = 'Invalid input format.';
    }

    if (parsedChar && existingChars.includes(parsedChar)) {
        parseError = `Character '${parsedChar}' already exists in the set.`;
        // Keep char and codePoint for display, but error prevents adding
    }

    return { char: parsedChar ?? '?', codePoint: parsedCodePoint, error: parseError };
  }, [input, existingChars]);


  const handleAdd = () => {
    if (codePoint !== null && !error) {
      onAdd(codePoint);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleAdd();
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="add-char-title"
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-sm flex flex-col"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="add-char-title" className="text-xl font-semibold text-cyan-300">
            Add New Character
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close dialog">
            <CloseIcon />
          </button>
        </header>
        <main className="p-6 space-y-4">
          <div>
            <label htmlFor="char-input" className="block mb-2 font-medium text-gray-300">
              Character or Code Point
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                id="char-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono w-full focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                placeholder="e.g., 🚀, 128640, or U+1F680"
                autoFocus
              />
               <div className="w-16 h-12 bg-gray-900 rounded-md flex items-center justify-center border border-gray-600" aria-live="polite">
                <span className="text-2xl font-mono text-cyan-300">
                  {char.trim() === '' && char !== '?' ? `"${char}"` : char}
                </span>
              </div>
            </div>
             {codePoint !== null && (
              <p className="text-xs text-gray-400 mt-2">
                  Code Point: <span className="font-semibold text-gray-300">U+{codePoint.toString(16).toUpperCase().padStart(4, '0')}</span>
              </p>
            )}
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </main>
        <footer className="flex justify-end gap-3 p-4 bg-gray-900/50 border-t border-gray-700 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={codePoint === null || !!error}
            className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Character
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AddCharModal;
