
import React, { useState, useCallback } from 'react';
import type { GeneratedChar, FontGeneratorOptions } from '../types';
import { CodeIcon, ClipboardCheckIcon, ClipboardIcon } from './Icons';

type OutputFormat = 'c' | 'python' | 'hex';

interface CodeOutputProps {
  fontData: GeneratedChar[];
  options: FontGeneratorOptions;
}

const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const highlightCode = (code: string): string => {
  return code
    .split('\n')
    .map(line => {
      const escapedLine = escapeHtml(line);
      const trimmedLine = line.trim(); // Use unescaped line for check
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine.startsWith('/*')) {
        return `<span class="text-green-600">${escapedLine}</span>`;
      }
      return escapedLine;
    })
    .join('\n');
};

const CodeOutput: React.FC<CodeOutputProps> = ({ fontData, options }) => {
  const [copied, setCopied] = useState(false);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('c');

  const generateCode = useCallback(() => {
    const { fontFamily, width, height, charSpacing, characterSet, dynamicWidth } = options;
    const fontName = `font_${fontFamily.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}_${width}x${height}`;
    
    if (dynamicWidth) {
        let header = `// Font: ${fontFamily}, Size: Up to ${width}x${height} (Dynamic Width)\n`;
        header += `// Characters: "${characterSet.replace(/\n/g, "\\n")}"\n`;
        header += `// To render a character, get its width from ${fontName}_widths[],\n`;
        header += `// its offset from ${fontName}_offsets[], and then read the bytes\n`;
        header += `// from ${fontName}_data[] starting at that offset.\n`;

        const widths: number[] = [];
        const offsets: number[] = [];
        const font_data: number[] = [];
        let currentOffset = 0;

        fontData.forEach(charData => {
            const charWidth = charData.bytes.length;
            widths.push(charWidth);
            offsets.push(currentOffset);
            font_data.push(...charData.bytes);
            currentOffset += charWidth;
        });
        
        const formatHex = (b: number) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`;

        const ranges: { start: GeneratedChar; end: GeneratedChar; startIndex: number; endIndex: number }[] = [];
        if (fontData.length > 0) {
            let currentRange = {
            start: fontData[0],
            end: fontData[0],
            startIndex: 0,
            endIndex: 0
            };
            for (let i = 1; i < fontData.length; i++) {
            if (fontData[i].codePoint === fontData[i - 1].codePoint + 1) {
                currentRange.end = fontData[i];
                currentRange.endIndex = i;
            } else {
                ranges.push(currentRange);
                currentRange = {
                start: fontData[i],
                end: fontData[i],
                startIndex: i,
                endIndex: i
                };
            }
            }
            ranges.push(currentRange);
        }

        switch (outputFormat) {
            case 'c': {
                let cCode = header + `\n`;
                const CHUNK_SIZE = 16;
        
                const formatRangeComment = (range: typeof ranges[0]) => {
                    const start = range.start;
                    const end = range.end;
                    const escChar = (c: string) => c.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
                    if (start.codePoint === end.codePoint) {
                        return `  // Char '${escChar(start.char)}' (Code: ${start.codePoint})\n`;
                    }
                    return `  // Characters '${escChar(start.char)}' (Code: ${start.codePoint}) to '${escChar(end.char)}' (Code: ${end.codePoint})\n`;
                };
        
                cCode += `// Width of each character in pixels (columns)\n`;
                cCode += `const unsigned char ${fontName}_widths[] = {\n`;
                if (ranges.length === 0 && widths.length > 0) {
                    cCode += `  ${widths.join(', ')}\n`;
                } else if (ranges.length > 0) {
                    ranges.forEach(range => {
                        cCode += formatRangeComment(range);
                        const rangeValues = widths.slice(range.startIndex, range.endIndex + 1);
                        for (let i = 0; i < rangeValues.length; i += CHUNK_SIZE) {
                            cCode += '  ' + rangeValues.slice(i, i + CHUNK_SIZE).join(', ') + ',\n';
                        }
                    });
                    cCode = cCode.slice(0, -2) + '\n';
                }
                cCode += `};\n\n`;
        
                cCode += `// Start address of each character in the font data array\n`;
                cCode += `const unsigned int ${fontName}_offsets[] = {\n`;
                if (ranges.length === 0 && offsets.length > 0) {
                    cCode += `  ${offsets.join(', ')}\n`;
                } else if (ranges.length > 0) {
                  ranges.forEach(range => {
                      cCode += formatRangeComment(range);
                      const rangeValues = offsets.slice(range.startIndex, range.endIndex + 1);
                      for (let i = 0; i < rangeValues.length; i += CHUNK_SIZE) {
                          cCode += '  ' + rangeValues.slice(i, i + CHUNK_SIZE).join(', ') + ',\n';
                      }
                  });
                  cCode = cCode.slice(0, -2) + '\n';
                }
                cCode += `};\n\n`;
                
                cCode += `// Font data, column by column, for all characters concatenated\n`;
                cCode += `const unsigned char ${fontName}_data[] = {\n`;
                if (font_data.length > 0) {
                  for (let i = 0; i < font_data.length; i += CHUNK_SIZE) {
                    cCode += '  ' + font_data.slice(i, i + CHUNK_SIZE).map(formatHex).join(', ') + ',\n';
                  }
                  cCode = cCode.slice(0, -2) + '\n';
                }
                cCode += `};\n`;
                return cCode;
            }

            case 'python': {
                let pyCode = header.replace(/\/\//g, '#') + `\n`;
                const PY_CHUNK_SIZE = 16;
        
                const formatRangeComment = (range: typeof ranges[0]) => {
                    const start = range.start;
                    const end = range.end;
                    const escChar = (c: string) => c.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
                    if (start.codePoint === end.codePoint) {
                        return `    # Char '${escChar(start.char)}' (Code: ${start.codePoint})\n`;
                    }
                    return `    # Characters '${escChar(start.char)}' (Code: ${start.codePoint}) to '${escChar(end.char)}' (Code: ${end.codePoint})\n`;
                };

                pyCode += `# Width of each character in pixels (columns)\n`;
                pyCode += `${fontName}_widths = [\n`;
                if (ranges.length === 0 && widths.length > 0) {
                     pyCode += `    ${widths.join(', ')}\n`;
                } else if (ranges.length > 0) {
                    ranges.forEach(range => {
                        pyCode += formatRangeComment(range);
                        const rangeValues = widths.slice(range.startIndex, range.endIndex + 1);
                        for (let i = 0; i < rangeValues.length; i += PY_CHUNK_SIZE) {
                            pyCode += '    ' + rangeValues.slice(i, i + PY_CHUNK_SIZE).join(', ') + ',\n';
                        }
                    });
                    pyCode = pyCode.slice(0, -2) + '\n';
                }
                pyCode += `]\n\n`;

                pyCode += `# Start address of each character in the font data array\n`;
                pyCode += `${fontName}_offsets = [\n`;
                if (ranges.length === 0 && offsets.length > 0) {
                    pyCode += `    ${offsets.join(', ')}\n`;
                } else if (ranges.length > 0) {
                    ranges.forEach(range => {
                        pyCode += formatRangeComment(range);
                        const rangeValues = offsets.slice(range.startIndex, range.endIndex + 1);
                        for (let i = 0; i < rangeValues.length; i += PY_CHUNK_SIZE) {
                            pyCode += '    ' + rangeValues.slice(i, i + PY_CHUNK_SIZE).join(', ') + ',\n';
                        }
                    });
                    pyCode = pyCode.slice(0, -2) + '\n';
                }
                pyCode += `]\n\n`;

                pyCode += `# Font data, column by column, for all characters concatenated\n`;
                pyCode += `${fontName}_data = [\n`;
                if (font_data.length > 0) {
                    for (let i = 0; i < font_data.length; i += PY_CHUNK_SIZE) {
                        pyCode += '    ' + font_data.slice(i, i + PY_CHUNK_SIZE).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ') + ',\n';
                    }
                    pyCode = pyCode.slice(0, -2) + '\n';
                }
                pyCode += `]\n`;
                return pyCode;
            }
            
            case 'hex':
                return `--- WIDTHS ---\n${widths.map(w => w.toString(16).padStart(2, '0').toUpperCase()).join(' ')}\n\n--- OFFSETS ---\n${offsets.map(o => o.toString(16).padStart(4, '0').toUpperCase()).join(' ')}\n\n--- DATA ---\n${font_data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`;
        }
    }


    let header = `// Font: ${fontFamily}, Size: ${width}x${height} (+${charSpacing}px spacing)\n`;
    header += `// Characters: "${characterSet.replace(/\n/g, "\\n")}"\n`;

    switch (outputFormat) {
        case 'c':
            let cCode = header + `// Each byte represents a column, with the MSB as the top row.\n`;
            cCode += `const unsigned char ${fontName}[] = {\n`;
            fontData.forEach(charData => {
                const hexBytes = charData.bytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ');
                cCode += `  /* Char '${charData.char.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}' (Code: ${charData.codePoint}) */\n`;
                cCode += `  ${hexBytes},\n`;
            });
            cCode += `};\n`;
            return cCode;

        case 'python':
            let pyCode = header.replace(/\/\//g, '#') + `# Each byte represents a column, with the MSB as the top row.\n`;
            pyCode += `${fontName} = [\n`;
            fontData.forEach(charData => {
                const hexBytes = charData.bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
                pyCode += `  # Char '${charData.char.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}' (Code: ${charData.codePoint})\n`;
                pyCode += `  ${hexBytes},\n`;
            });
            pyCode += `]\n`;
            return pyCode;
        
        case 'hex':
            return fontData.map(charData => 
                charData.bytes.map(b => `${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')
            ).join('\n');
    }

  }, [fontData, options, outputFormat]);

  const handleCopy = useCallback(() => {
    const code = generateCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [generateCode]);

  const codeString = generateCode();
  const highlightedCode = highlightCode(codeString);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-700">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-cyan-300 flex items-center gap-2"><CodeIcon/>Generated Code</h2>
        <div className="flex items-center gap-2">
            <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
            >
                <option value="c">C Array</option>
                <option value="python">Python List</option>
                <option value="hex">Plain Hex</option>
            </select>
            <button
              onClick={handleCopy}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
            >
              {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
      </div>
      <div className="bg-gray-900 rounded-md p-4 max-h-96 overflow-auto border border-gray-700">
        <pre>
          <code 
            className="text-sm text-gray-300 font-mono whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  );
};

export default CodeOutput;