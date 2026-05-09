export const idBlockTransformerScript = `
  function escapeRegExp(string) {
    return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  }

  function getIndentation(line) {
    const match = line.match(/^(\\s*)/);
    return match ? match[1].length : 0;
  }

  function parseNumericValue(line, key) {
      if (!key) return null;
      const escapedKey = escapeRegExp(key);
      const regex = new RegExp('^(.*?)' + escapedKey + '(-?\\\\d+(\\\\.\\\\d+)?)(.*)$');
      const match = line.match(regex);
      if (match) {
          return {
              prefix: match[1],
              value: parseFloat(match[2]),
              suffix: match[4]
          };
      }
      return null;
  }

  function checkCondition(value, condition, conditionValue) {
      if (condition === 'none') return true;
      if (value === null) return false;

      switch(condition) {
          case '<': return value < conditionValue;
          case '=': return value === conditionValue;
          case '>': return value > conditionValue;
          default: return false;
      }
  }
  
  function applyOperation(originalValue, operation, operationValue, roundDecimals) {
      if (originalValue === null) return null;
      let result;
      switch(operation) {
          case 'fixed':    result = operationValue; break;
          case 'increase': result = originalValue + operationValue; break;
          case 'decrease': result = originalValue - operationValue; break;
          case 'multiply': result = originalValue * operationValue; break;
          case 'divide':   result = operationValue !== 0 ? originalValue / operationValue : originalValue; break;
          default:         result = originalValue;
      }

      if (roundDecimals && (operation === 'multiply' || operation === 'divide')) {
        return Math.round(result);
      }

      return Math.round(result * 10000) / 10000;
  }

  self.onmessage = (event) => {
    try {
      const { 
        inputText, 
        keywordsText, 
        blockStartFormat, 
        applyToBlock,
        includeIndentation,
        sourceKey, 
        condition, 
        conditionValue, 
        targetKey, 
        operation, 
        operationValue, 
        roundDecimals,
        mode = 'transform',
        replaceWithText = '',
        textToAdd = '',
        addPosition = 'start',
        addPositionOffset = 0,
        invertAddTextCondition = false
      } = event.data;

      if (!inputText || !keywordsText) {
        throw new Error('Invalid parameters for processing.');
      }
      
      const keywords = keywordsText.split('\\n').map(k => k.trim()).filter(Boolean);
      if (keywords.length === 0) {
          self.postMessage({ success: true, data: inputText });
          return;
      }

      const lines = inputText.split('\\n');
      let resultLines = [];
      let i = 0;

      // To find blocks we need a regex for blockStartFormat
      let wildcardRegex = null;
      if (blockStartFormat) {
          const parts = blockStartFormat.split('{ID}');
          if (parts.length === 2) {
              const prefix = escapeRegExp(parts[0]);
              const suffix = escapeRegExp(parts[1]);
              wildcardRegex = new RegExp('^(\\\\s*)' + prefix + '(.*?)' + suffix);
          } else {
              wildcardRegex = new RegExp('^(\\\\s*)' + escapeRegExp(blockStartFormat));
          }
      }

      while (i < lines.length) {
          const line = lines[i];
          if (line.trim() === '') {
              resultLines.push(line);
              i++;
              continue;
          }

          let isBlockStart = false;
          let matchedKeyword = null;
          let isTargetKeywordMatched = false;
          let activeStartIndentation = getIndentation(line);

          // Find matches by looping keywords to be safe and accurate
          for (const kw of keywords) {
              const expectedFormat = blockStartFormat ? blockStartFormat.replace('{ID}', kw) : kw;
              
              if (includeIndentation) {
                  const formatIndentation = getIndentation(expectedFormat);
                  const trimmedFormat = expectedFormat.trim();
                  
                  if (getIndentation(line) === formatIndentation && line.trim().startsWith(trimmedFormat)) {
                      isBlockStart = true;
                      isTargetKeywordMatched = true;
                      matchedKeyword = kw;
                      activeStartIndentation = formatIndentation;
                      break;
                  }
              } else {
                  if (line.includes(expectedFormat)) {
                      isBlockStart = true;
                      isTargetKeywordMatched = true;
                      matchedKeyword = kw;
                      break;
                  }
              }
          }

          // If not matched by target keywords, see if it is ANY block
          if (!isBlockStart && wildcardRegex && line.match(wildcardRegex)) {
              if (includeIndentation) {
                 const formatIndentation = getIndentation(blockStartFormat);
                 if (getIndentation(line) === formatIndentation) {
                     isBlockStart = true;
                     activeStartIndentation = formatIndentation;
                 }
              } else {
                 isBlockStart = true;
                 activeStartIndentation = getIndentation(line);
              }
          }

          if (isBlockStart) {
              const startIndentation = activeStartIndentation;
              const blockStartIndex = i;
              let blockEndIndex = i + 1;
              while (blockEndIndex < lines.length) {
                  const nextLine = lines[blockEndIndex];
                  if (nextLine.trim() !== '') {
                      let isNextStart = false;
                      if (wildcardRegex && nextLine.match(wildcardRegex)) {
                          if (includeIndentation) {
                              const expectedIndent = getIndentation(blockStartFormat);
                              if (getIndentation(nextLine) === expectedIndent) {
                                  isNextStart = true;
                              }
                          } else {
                              isNextStart = true;
                          }
                      } else if (!wildcardRegex) {
                          if (getIndentation(nextLine) <= startIndentation) {
                              isNextStart = true;
                          }
                      }
                      
                      if (isNextStart) {
                          break;
                      }
                  }
                  blockEndIndex++;
              }
              
              const blockLines = lines.slice(blockStartIndex, blockEndIndex);
              
              let action = 'keep';
              if (mode === 'transform') {
                  if (isTargetKeywordMatched) action = 'transform';
                  else action = 'keep';
              } else if (mode === 'remove') {
                  if (isTargetKeywordMatched) action = (replaceWithText && replaceWithText.trim() !== '') ? 'replace' : 'remove';
                  else action = 'keep';
              } else if (mode === 'maintain') {
                  if (!isTargetKeywordMatched) action = (replaceWithText && replaceWithText.trim() !== '') ? 'replace' : 'remove';
                  else action = 'keep';
              } else if (mode === 'addText') {
                  let shouldProcess = false;
                  if (invertAddTextCondition) shouldProcess = !isTargetKeywordMatched;
                  else shouldProcess = isTargetKeywordMatched;
                  
                  if (shouldProcess) action = 'addText';
                  else action = 'keep';
              }

              if (action === 'keep') {
                  resultLines.push(...blockLines);
              } else if (action === 'remove') {
                  // do nothing (skip block)
              } else if (action === 'replace') {
                  const baseIndent = ' '.repeat(activeStartIndentation);
                  const indentedReplace = replaceWithText.split('\\n').map(l => baseIndent + l);
                  resultLines.push(...indentedReplace);
              } else if (action === 'transform') {
                  let transformedBlock = [...blockLines];
                  if (applyToBlock) {
                      let conditionMet = condition === 'none';
                      if (condition !== 'none' && sourceKey) {
                          for (const bline of transformedBlock) {
                              const parsed = parseNumericValue(bline, sourceKey);
                              if (parsed !== null) {
                                  if (checkCondition(parsed.value, condition, conditionValue)) {
                                      conditionMet = true;
                                      break;
                                  }
                              }
                          }
                      }
    
                      if (conditionMet && targetKey) {
                          for (let j = 0; j < transformedBlock.length; j++) {
                              const bline = transformedBlock[j];
                              const parsed = parseNumericValue(bline, targetKey);
                              if (parsed !== null) {
                                  const newTargetValue = applyOperation(parsed.value, operation, operationValue, roundDecimals);
                                  transformedBlock[j] = parsed.prefix + targetKey + newTargetValue + parsed.suffix;
                              }
                          }
                      }
                  } else {
                      for (let j = 0; j < transformedBlock.length; j++) {
                          const bline = transformedBlock[j];
                          const parsed = parseNumericValue(bline, sourceKey);
                          if (parsed !== null) {
                              if (checkCondition(parsed.value, condition, conditionValue)) {
                                  const newTargetValue = applyOperation(parsed.value, operation, operationValue, roundDecimals);
                                  transformedBlock[j] = parsed.prefix + sourceKey + newTargetValue + parsed.suffix;
                              }
                          }
                      }
                  }
                  resultLines.push(...transformedBlock);
              } else if (action === 'addText') {
                  const baseIndent = ' '.repeat(activeStartIndentation);
                  const toAdd = textToAdd.split('\\n').map(l => baseIndent + l);
                  const offset = addPositionOffset || 0;
                  if (addPosition === 'start') {
                      const safeOffset = Math.min(offset, blockLines.length - 1);
                      resultLines.push(...blockLines.slice(0, safeOffset + 1));
                      resultLines.push(...toAdd);
                      resultLines.push(...blockLines.slice(safeOffset + 1));
                  } else if (addPosition === 'end') {
                      const safeOffset = Math.min(offset, blockLines.length - 1);
                      const insertIndex = blockLines.length - safeOffset;
                      resultLines.push(...blockLines.slice(0, insertIndex));
                      resultLines.push(...toAdd);
                      resultLines.push(...blockLines.slice(insertIndex));
                  }
              }

              i = blockEndIndex;
          } else {
              resultLines.push(line);
              i++;
          }
      }
      
      self.postMessage({ success: true, data: resultLines.join('\\n') });
    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  };
`;
