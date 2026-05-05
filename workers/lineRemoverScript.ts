export const lineRemoverWorkerScript = `
  function getIndentation(line) {
    const match = line.match(/^(\\s*)/);
    return match ? match[1].length : 0;
  }

  self.onmessage = (event) => {
    try {
      const { 
        inputText, 
        keywordsText, 
        replaceWithText, 
        removeAbove, 
        linesAbove, 
        removeBelow, 
        linesBelow,
        maintainAbove,
        linesToMaintainAbove,
        maintainBelow,
        linesToMaintainBelow,
        mode,
        matchMode,
        textToAdd,
        addPosition
      } = event.data;

      if (!inputText) {
        throw new Error('Missing input data.');
      }

      const keywords = keywordsText.split('\\n').map(k => k.trim()).filter(Boolean);
      const lines = inputText.split('\\n');
      let newLines = [];

      if (keywords.length === 0) {
        if (mode === 'addText' && (addPosition === 'start' || addPosition === 'end')) {
          newLines = lines.map(line => {
            if (addPosition === 'start') {
              return textToAdd + line;
            }
            // 'end'
            return line + textToAdd;
          });
        } else {
          // Keywords are required for other modes, so return original text
          newLines = lines;
        }
        self.postMessage({ success: true, data: newLines.join('\\n') });
        return;
      }
      
      const isMatch = (line, keyword) => (matchMode === 'exact') ? line.trim() === keyword : line.includes(keyword);

      switch (mode) {
        case 'remove': {
          const useReplaceMode = replaceWithText && replaceWithText.trim() !== '';
          if (useReplaceMode) {
            newLines = lines.map(line => {
              const containsKeyword = keywords.some(keyword => isMatch(line, keyword));
              if (containsKeyword) {
                const lineIndentation = getIndentation(line);
                return ' '.repeat(lineIndentation) + replaceWithText;
              }
              return line;
            });
          } else {
            const linesToRemove = new Set();
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const shouldRemove = keywords.some(keyword => isMatch(line, keyword));
              
              if (shouldRemove) {
                linesToRemove.add(i);
                if (removeAbove) {
                  for (let j = 1; j <= linesAbove; j++) {
                    if (i - j >= 0) linesToRemove.add(i - j);
                  }
                }
                if (removeBelow) {
                  for (let j = 1; j <= linesBelow; j++) {
                    if (i + j < lines.length) linesToRemove.add(i + j);
                  }
                }
              }
            }
            newLines = lines.filter((_, index) => !linesToRemove.has(index));
          }
          break;
        }
        
        case 'maintain': {
          const linesToKeep = new Set();
          const matchIndices = [];

          for (let i = 0; i < lines.length; i++) {
            if (keywords.some(keyword => isMatch(lines[i], keyword))) {
              matchIndices.push(i);
            }
          }

          for (const i of matchIndices) {
            linesToKeep.add(i);
            if (maintainAbove) {
              for (let j = 1; j <= linesToMaintainAbove; j++) {
                if (i - j >= 0) linesToKeep.add(i - j);
              }
            }
            if (maintainBelow) {
              for (let j = 1; j <= linesToMaintainBelow; j++) {
                if (i + j < lines.length) linesToKeep.add(i + j);
              }
            }
          }
          
          const useReplaceMode = replaceWithText && replaceWithText.trim() !== '';
          if (useReplaceMode) {
              newLines = lines.map((line, index) => {
                  if (linesToKeep.has(index)) {
                      return line;
                  }
                  const lineIndentation = getIndentation(line);
                  // Return indented replacement for lines that are not kept
                  return ' '.repeat(lineIndentation) + replaceWithText;
              });
          } else {
              newLines = lines.filter((_, index) => linesToKeep.has(index));
          }
          break;
        }

        case 'addText': {
          newLines = lines.map(line => {
            if (matchMode === 'exact') {
              if (keywords.some(k => line.trim() === k)) {
                switch (addPosition) {
                  case 'start':
                  case 'before': // Fallback for exact match
                    return textToAdd + line;
                  case 'end':
                  case 'after': // Fallback for exact match
                    return line + textToAdd;
                }
              }
            } else { // 'contains'
              const keywordFound = keywords.find(keyword => line.includes(keyword));
              if (keywordFound) {
                switch (addPosition) {
                  case 'start':
                    return textToAdd + line;
                  case 'end':
                    return line + textToAdd;
                  case 'before':
                    return line.replace(keywordFound, textToAdd + keywordFound);
                  case 'after':
                    return line.replace(keywordFound, keywordFound + textToAdd);
                  default:
                    return line;
                }
              }
            }
            return line;
          });
          break;
        }

        default:
          newLines = lines;
          break;
      }
      
      self.postMessage({ success: true, data: newLines.join('\\n') });
    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  };
`