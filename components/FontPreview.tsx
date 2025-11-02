import React from 'react';
import type { GeneratedChar } from '../types';
import { EyeIcon, PlusIcon } from './Icons';
import CharGrid from './CharGrid';

interface FontPreviewProps {
  fontData: GeneratedChar[];
  height: number;
  onCharClick: (index: number) => void;
  onCharDelete: (index: number) => void;
  onAddCharClick: () => void;
}

const FontPreview: React.FC<FontPreviewProps> = ({ fontData, height, onCharClick, onCharDelete, onAddCharClick }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-700">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-cyan-300 flex items-center gap-2">
          <EyeIcon/>Visual Preview & Editor
        </h2>
        <p className="text-sm text-gray-400">Click a character to edit, hover to delete, or add a new one.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
        {fontData.map((charData, index) => {
          const charWidth = charData.bitmap[0]?.length || 0;
          return (
            <CharGrid 
              key={`${charData.ascii}-${index}`} 
              charData={charData} 
              width={charWidth} 
              height={height}
              onClick={() => onCharClick(index)}
              onDelete={() => onCharDelete(index)}
            />
          )
        })}
        <button
          onClick={onAddCharClick}
          className="bg-gray-900/50 min-h-[124px] p-3 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center shadow-md cursor-pointer transition-all duration-150 hover:border-cyan-400 hover:scale-105 hover:text-cyan-400 text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-800"
          aria-label="Add new character"
        >
          <PlusIcon />
          <span className="mt-2 text-sm font-semibold">Add Char</span>
        </button>
      </div>
    </div>
  );
};

export default FontPreview;
