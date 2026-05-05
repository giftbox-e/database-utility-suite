export const idBlockTransformerScript = `
  function escapeRegExp(string) {
    return string.replace(/[.*+?^\\u0024{}()|[\\]\\\\]/g, '\\\\$&');
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
        sourceKey, 
        condition, 
        conditionValue, 
        targetKey, 
        operation, 
        operationValue, 
        roundDecimals
      } = event.data;

      if (!inputText || !keywordsText || !targetKey || !operation || isNaN(operationValue) || (condition !== 'none' && isNaN(conditionValue))) {
        throw new Error('Invalid parameters for processing.');
      }
      
      const keywords = keywordsText.split('\\n').map(k => k.trim()).filter(Boolean);
      if (keywords.length === 0) {
          self.postMessage({ success: true, data: inputText });
          return;
      }

      const lines = inputText.split('\\n');
      let newLines = [...lines];

      let i = 0;
      while (i < lines.length) {
          const line = lines[i];
          if (line.trim() === '') {
              i++;
              continue;
          }

          let isBlockStart = false;
          let matchedKeyword = null;
          for (const kw of keywords) {
              const expectedFormat = blockStartFormat ? blockStartFormat.replace('{ID}', kw) : kw;
              if (line.includes(expectedFormat)) {
                  isBlockStart = true;
                  matchedKeyword = kw;
                  break;
              }
          }

          if (isBlockStart) {
              const startIndentation = getIndentation(line);
              const blockStartIndex = i;
              let blockEndIndex = i + 1;
              while (blockEndIndex < lines.length) {
                  const nextLine = lines[blockEndIndex];
                  if (nextLine.trim() !== '' && getIndentation(nextLine) <= startIndentation) {
                      break;
                  }
                  blockEndIndex++;
              }
              
              const blockLines = lines.slice(blockStartIndex, blockEndIndex);
              
              if (applyToBlock) {
                  let conditionMet = condition === 'none';
                  if (condition !== 'none' && sourceKey) {
                      for (const bline of blockLines) {
                          const parsed = parseNumericValue(bline, sourceKey);
                          if (parsed !== null) {
                              if (checkCondition(parsed.value, condition, conditionValue)) {
                                  conditionMet = true;
                                  break;
                              }
                          }
                      }
                  }

                  if (conditionMet) {
                      for (let j = 0; j < blockLines.length; j++) {
                          const bline = blockLines[j];
                          const parsed = parseNumericValue(bline, targetKey);
                          if (parsed !== null) {
                              const newTargetValue = applyOperation(parsed.value, operation, operationValue, roundDecimals);
                              newLines[blockStartIndex + j] = parsed.prefix + targetKey + newTargetValue + parsed.suffix;
                          }
                      }
                  }
              } else {
                  for (let j = 0; j < blockLines.length; j++) {
                      const bline = blockLines[j];
                      const parsed = parseNumericValue(bline, sourceKey);
                      if (parsed !== null) {
                          if (checkCondition(parsed.value, condition, conditionValue)) {
                              const newTargetValue = applyOperation(parsed.value, operation, operationValue, roundDecimals);
                              newLines[blockStartIndex + j] = parsed.prefix + sourceKey + newTargetValue + parsed.suffix;
                          }
                      }
                  }
              }

              i = blockEndIndex;
          } else {
              i++;
          }
      }
      
      self.postMessage({ success: true, data: newLines.join('\\n') });
    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  };
`;
