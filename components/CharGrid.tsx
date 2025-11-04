
import React from 'react';
import type { GeneratedChar } from '../types';

interface CharGridProps {
  charData: GeneratedChar;
  width: number;
  height: number;
  onPixelToggle?: (x: number, y: number) => void;
  onClick?: () => void;
  onDelete?: () => void;
  zoom?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  isBeingDragged?: boolean;
  isDragTarget?: boolean;
}

const CharGrid: React.FC<CharGridProps> = ({ 
    charData, width, height, onPixelToggle, onClick, onDelete, zoom = 1,
    draggable, onDragStart, onDragOver, onDrop, onDragEnd, onDragEnter, onDragLeave,
    isBeingDragged, isDragTarget 
}) => {

  const basePixelSizeRem = 0.75;
  const scaledPixelSizeRem = basePixelSizeRem * zoom;
  const gap = zoom > 2 ? '2px' : '1px';

  const containerClasses = [
    'bg-gray-900', 'p-3', 'rounded-lg', 'border', 'border-gray-700', 'flex', 'flex-col', 'items-center', 'shadow-md',
    'transition-all duration-150',
    onClick ? 'cursor-pointer' : '',
    onDelete ? 'group relative' : '',
    draggable ? 'cursor-grab' : '',
    isBeingDragged ? 'opacity-50' : (isDragTarget ? '' : 'hover:border-cyan-400 hover:scale-105'),
    isDragTarget ? 'border-cyan-400 scale-105 ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400' : ''
  ].filter(Boolean).join(' ');


  return (
    <div 
      className={containerClasses}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
       {onDelete && (
          <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="absolute top-0 right-0 -mt-2 -mr-2 w-6 h-6 bg-red-600 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-red-500 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 z-10"
              aria-label={`Delete character ${charData.char}`}
          >
              <span className="text-xl font-bold leading-none -mt-px">&times;</span>
          </button>
      )}
      <div 
        className="grid mb-2" 
        style={{
          gridTemplateColumns: `repeat(${width}, 1fr)`,
          width: `${width * scaledPixelSizeRem}rem`,
          height: `${height * scaledPixelSizeRem}rem`,
          gap: gap,
        }}
        aria-label={`Bitmap for character ${charData.char}`}
      >
        {Array.from({ length: height * width }).map((_, i) => {
            const row = Math.floor(i / width);
            const col = i % width;
            const pixel = charData.bitmap[row]?.[col] ?? false;
            return (
                <div
                    key={i}
                    onClick={onPixelToggle ? () => onPixelToggle(col, row) : undefined}
                    className={`w-full h-full rounded-[1px] ${pixel ? 'bg-cyan-300' : 'bg-gray-700'} ${onPixelToggle ? 'cursor-pointer hover:bg-opacity-70' : ''}`}
                ></div>
            );
        })}
      </div>
      <div className="text-center">
        <p className="font-mono text-lg text-white">{charData.char === ' ' ? '" "' : charData.char}</p>
        <p className="text-xs text-gray-500">U+{charData.codePoint.toString(16).toUpperCase().padStart(4, '0')}</p>
      </div>
    </div>
  );
};


export default CharGrid;
