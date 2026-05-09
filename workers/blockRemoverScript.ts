export const blockRemoverWorkerScript = `
  function getIndentationLevel(line) {
    const match = line.match(/^([ \\t]*)/);
    if (!match) return 0;
    let level = 0;
    for (const char of match[1]) {
      if (char === '\\t') level += 4;
      else level += 1;
    }
    return level;
  }

  function getIndentationString(line) {
    const match = line.match(/^([ \\t]*)/);
    return match ? match[1] : '';
  }

  self.onmessage = (event) => {
    try {
      const { 
        inputText, 
        blockStartIdentifier,
        includeIdentifierString,
        keywordsText, 
        replaceWithText, 
        mode,
        matchMode,
        indentationFilterMode,
        indentationFilterValue,
        textToAdd,
        addPosition,
        addPositionOffset,
        invertAddTextCondition
      } = event.data;

      const lines = inputText.split('\\n');

      if (indentationFilterMode && indentationFilterMode !== 'none') {
        if (isNaN(indentationFilterValue)) {
            throw new Error('Invalid indentation filter value.');
        }

        let newLines = [];
        switch (indentationFilterMode) {
            case 'gt':
                newLines = lines.filter(line => getIndentationLevel(line) <= indentationFilterValue);
                break;
            case 'lt':
                newLines = lines.filter(line => getIndentationLevel(line) >= indentationFilterValue);
                break;
            case 'eq_remove':
                newLines = lines.filter(line => getIndentationLevel(line) !== indentationFilterValue);
                break;
            case 'eq_maintain':
                newLines = lines.filter(line => getIndentationLevel(line) === indentationFilterValue);
                break;
            default:
                newLines = lines;
                break;
        }
        self.postMessage({ success: true, data: newLines.join('\\n') });

      } else {
        if (includeIdentifierString && !blockStartIdentifier) {
          throw new Error('Missing block identifier when "Include String" is checked.');
        }
         if (mode !== 'addText' && !keywordsText) {
          throw new Error('Missing keywords for this block mode.');
        }

        const keywords = (keywordsText || '').split('\\n').map(k => k.trim().toLowerCase()).filter(Boolean);
        if (keywords.length === 0 && mode !== 'addText' && !(mode === 'addText' && invertAddTextCondition)) {
          self.postMessage({ success: true, data: inputText });
          return;
        }
        
        const startIndentationLevel = getIndentationLevel(blockStartIdentifier);
        const trimmedIdentifier = blockStartIdentifier.trim();
        
        const isBlockStart = (line) => {
            if (!line || line.trim() === '') return false;
            
            const lineIndentation = getIndentationLevel(line);

            if (lineIndentation !== startIndentationLevel) {
                return false;
            }
            
            if (!includeIdentifierString) {
                return true;
            }
            
            if (!trimmedIdentifier) {
                return false;
            }
            
            return line.trim().startsWith(trimmedIdentifier);
        }

        const outputLines = [];
        let i = 0;

        const isMatch = (line, keyword) => (matchMode === 'exact') 
            ? line.trim().toLowerCase() === keyword 
            : line.toLowerCase().includes(keyword);

        while (i < lines.length) {
          const currentLine = lines[i];

          if (!isBlockStart(currentLine)) {
            outputLines.push(currentLine);
            i++;
            continue;
          }

          const currentBlock = [currentLine];
          let blockEndIndex = i + 1;
          const currentIndentationLevel = getIndentationLevel(currentLine);
          
          while (blockEndIndex < lines.length) {
              const nextLine = lines[blockEndIndex];
              const nextIndentLevel = getIndentationLevel(nextLine);
              const nextTrimmed = nextLine.trim();

              if (nextTrimmed === '') {
                  currentBlock.push(nextLine);
                  blockEndIndex++;
                  continue;
              }

              if (nextIndentLevel <= currentIndentationLevel) {
                  break;
              }

              currentBlock.push(nextLine);
              blockEndIndex++;
          }
          
          const blockContainsKeyword = currentBlock.some(line => 
              keywords.some(keyword => isMatch(line, keyword))
          );

          const useReplaceMode = replaceWithText !== undefined && replaceWithText !== null && replaceWithText.trim() !== '';
          let action = 'keep'; 

          if (mode === 'remove') {
            if (blockContainsKeyword) {
              action = useReplaceMode ? 'replace' : 'remove';
            }
          } else if (mode === 'maintain') {
             if (!blockContainsKeyword) {
               action = useReplaceMode ? 'replace' : 'remove';
             }
          } else if (mode === 'addText') {
              const hasKeywords = keywords.length > 0;
              let shouldProcess = false;

              if (invertAddTextCondition) {
                  shouldProcess = !blockContainsKeyword;
              } else {
                  if (hasKeywords) {
                      shouldProcess = blockContainsKeyword;
                  }
              }
              
              if (shouldProcess) {
                  action = 'addText';
              }
          }

          const startIndentationString = getIndentationString(currentLine);

          switch (action) {
            case 'keep':
              outputLines.push(...currentBlock);
              break;
            case 'replace':
              const indentedReplacement = replaceWithText.split('\\n').map(line => startIndentationString + line).join('\\n');
              outputLines.push(indentedReplacement);
              break;
            case 'addText':
              const addedTextLines = textToAdd.split('\\n').map(line => startIndentationString + line);
              const offset = addPositionOffset || 0;
              if (addPosition === 'start') {
                  const safeOffset = Math.min(offset, currentBlock.length - 1);
                  outputLines.push(...currentBlock.slice(0, safeOffset + 1), ...addedTextLines, ...currentBlock.slice(safeOffset + 1));
              } else { 
                  const safeOffset = Math.min(offset, currentBlock.length - 1);
                  const insertIndex = currentBlock.length - safeOffset;
                  outputLines.push(...currentBlock.slice(0, insertIndex), ...addedTextLines, ...currentBlock.slice(insertIndex));
              }
              break;
            case 'remove':
              break;
          }
          
          i = blockEndIndex;
        }
        
        self.postMessage({ success: true, data: outputLines.join('\\n') });
      }

    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  };
`;