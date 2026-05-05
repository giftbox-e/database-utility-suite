export const blockRemoverWorkerScript = `
  function getIndentation(line) {
    const match = line.match(/^(\\s*)/);
    return match ? match[1].length : 0;
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
        invertAddTextCondition
      } = event.data;

      const lines = inputText.split('\\n');

      if (indentationFilterMode && indentationFilterMode !== 'none') {
        // --- INDENTATION FILTER MODE ---
        if (isNaN(indentationFilterValue)) {
            throw new Error('Invalid indentation filter value.');
        }

        let newLines = [];
        switch (indentationFilterMode) {
            case 'gt':
                newLines = lines.filter(line => getIndentation(line) <= indentationFilterValue);
                break;
            case 'lt':
                newLines = lines.filter(line => getIndentation(line) >= indentationFilterValue);
                break;
            case 'eq_remove':
                newLines = lines.filter(line => getIndentation(line) !== indentationFilterValue);
                break;
            case 'eq_maintain':
                newLines = lines.filter(line => getIndentation(line) === indentationFilterValue);
                break;
            default:
                newLines = lines;
                break;
        }
        self.postMessage({ success: true, data: newLines.join('\\n') });

      } else {
        // --- BLOCK PROCESSOR MODE ---
        if (includeIdentifierString && !blockStartIdentifier) {
          throw new Error('Missing block identifier when "Include String" is checked.');
        }
         if (mode !== 'addText' && !keywordsText) {
          throw new Error('Missing keywords for this block mode.');
        }

        const keywords = keywordsText.split('\\n').map(k => k.trim().toLowerCase()).filter(Boolean);
        if (keywords.length === 0 && mode !== 'addText' && !(mode === 'addText' && invertAddTextCondition)) {
          self.postMessage({ success: true, data: inputText });
          return;
        }
        
        const startIndentation = getIndentation(blockStartIdentifier);
        const trimmedIdentifier = blockStartIdentifier.trim();
        
        const isBlockStart = (line) => {
            if (!line || line.trim() === '') return false;
            
            const lineIndentation = getIndentation(line);

            if (lineIndentation !== startIndentation) {
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
          
          while (blockEndIndex < lines.length) {
              const nextLine = lines[blockEndIndex];
              if (nextLine.trim() !== '' && getIndentation(nextLine) <= startIndentation) {
                  break;
              }
              currentBlock.push(nextLine);
              blockEndIndex++;
          }
          
          const blockContainsKeyword = currentBlock.some(line => 
              keywords.some(keyword => isMatch(line, keyword))
          );

          const useReplaceMode = replaceWithText && replaceWithText.trim() !== '';
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

          switch (action) {
            case 'keep':
              outputLines.push(...currentBlock);
              break;
            case 'replace':
              const blockIndentation = ' '.repeat(startIndentation);
              const indentedReplacement = replaceWithText.split('\\n').map(line => blockIndentation + line).join('\\n');
              outputLines.push(indentedReplacement);
              break;
            case 'addText':
              const addedTextLines = textToAdd.split('\\n').map(line => {
                // Add indentation relative to the block start, e.g., 2 extra spaces
                const newIndentation = ' '.repeat(startIndentation + 2);
                return newIndentation + line;
              });
              
              if (addPosition === 'start') {
                  // Add after the first line (the block identifier)
                  outputLines.push(currentBlock[0], ...addedTextLines, ...currentBlock.slice(1));
              } else { // end
                  outputLines.push(...currentBlock, ...addedTextLines);
              }
              break;
            case 'remove':
              // Do nothing
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
`