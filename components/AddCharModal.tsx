import React, { useState } from 'react';
import { CloseIcon } from './Icons';

interface AddCharModalProps {
  onClose: () => void;
  onAdd: (ascii: number) => void;
  existingChars: string;
}

const AddCharModal: React.FC<AddCharModalProps> = ({ onClose, onAdd, existingChars }) => {
  const [asciiValue, setAsciiValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    const num = parseInt(asciiValue, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      setError('Please enter a valid ASCII code (0-255).');
      return;
    }
    const char = String.fromCharCode(num);
    if (existingChars.includes(char)) {
      setError(`Character '${char}' already exists in the set.`);
      return;
    }
    onAdd(num);
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
            <label htmlFor="ascii-input" className="block mb-2 font-medium text-gray-300">
              ASCII Code (Decimal)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                id="ascii-input"
                value={asciiValue}
                onChange={(e) => setAsciiValue(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono w-full focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
                placeholder="e.g., 65 for 'A'"
                min="0"
                max="255"
                autoFocus
              />
               <div className="w-16 h-12 bg-gray-900 rounded-md flex items-center justify-center border border-gray-600" aria-live="polite">
                <span className="text-2xl font-mono text-cyan-300">
                  {(() => {
                    const num = parseInt(asciiValue, 10);
                    if (!isNaN(num) && num >= 0 && num <= 255) {
                      const char = String.fromCharCode(num);
                      return char.trim() === '' ? `"${char}"` : char;
                    }
                    return '?';
                  })()}
                </span>
              </div>
            </div>
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
            className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors"
          >
            Add Character
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AddCharModal;