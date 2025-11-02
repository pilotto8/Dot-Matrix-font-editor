
export interface GeneratedChar {
  char: string;
  ascii: number;
  bitmap: boolean[][];
  bytes: number[];
}

export interface FontGeneratorOptions {
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  width: number;
  height: number;
  charSpacing: number;
  characterSet: string;
  fontSizeAdjustment: number;
  renderMode: 'aliased' | 'anti-aliased' | 'dithered';
  renderThreshold: number;
  autoAlign: 'top' | 'bottom' | 'manual';
  xOffset: number;
  yOffset: number;
  dynamicWidth: boolean;
}

// Fix: Add ParsedFontData interface to be shared across the application
export interface ParsedFontData {
  fontData: GeneratedChar[];
  fontOptions: Partial<FontGeneratorOptions>;
}