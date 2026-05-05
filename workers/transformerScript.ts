export const transformerWorkerScript = `
  function escapeRegExp(string) {
    // $& means the whole matched string
    return string.replace(/[.*+?^\\u0024{}()|[\]\\\\]/g, '\\\\$&');
  }

  function getIndentation(line) {
    const match = line.match(/^(\\s*)/);
    return match ? match[1].length : 0;
  }

  function getNumericValue(line, key) {
      const escapedKey = escapeRegExp(key);
      const regex = new RegExp(escapedKey + '(-?\\\\d+(\\\\.\\\\d+)?)\\\\s*$');
      const match = line.match(regex);
      return match ? parseFloat(match[1]) : null;
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

      // Round to avoid floating point inaccuracies for integer-like results
      return Math.round(result * 10000) / 10000;
  }

  self.onmessage = (event) => {
    try {
      const { 
        inputText, applyToBlock, sourceKey, includeString, 
        condition, conditionValue, targetKey, operation, operationValue, roundDecimals
      } = event.data;

      if (!inputText || !sourceKey || !targetKey || !operation || isNaN(operationValue) || (condition !== 'none' && isNaN(conditionValue))) {
        throw new Error('Invalid parameters for processing.');
      }
      
      const lines = inputText.split('\\n');
      let newLines;

      if (applyToBlock) {
        // --- BLOCK-BASED TRANSFORMATION ---
        newLines = [...lines];
        const startIndentation = getIndentation(sourceKey);
        const trimmedIdentifier = sourceKey.trim();

        const isBlockStart = (line) => {
            if (!line || line.trim() === '') return false;
            if (getIndentation(line) !== startIndentation) return false;
            return !includeString || (trimmedIdentifier && line.trim().startsWith(trimmedIdentifier));
        }

        let i = 0;
        while (i < lines.length) {
            if (!isBlockStart(lines[i])) {
                i++;
                continue;
            }

            // Found block start, collect the block
            const blockStartIndex = i;
            let blockEndIndex = i + 1;
            while (blockEndIndex < lines.length && (lines[blockEndIndex].trim() === '' || getIndentation(lines[blockEndIndex]) > startIndentation)) {
                blockEndIndex++;
            }
            
            const blockLines = lines.slice(blockStartIndex, blockEndIndex);
            let conditionMetInBlock = condition === 'none';

            if (condition !== 'none') {
                 for (const line of blockLines) {
                    const sourceValue = getNumericValue(line, sourceKey);
                    if (sourceValue !== null) {
                        if (checkCondition(sourceValue, condition, conditionValue)) {
                            conditionMetInBlock = true;
                            break;
                        }
                    }
                }
            }

            if (conditionMetInBlock) {
                for (let j = 0; j < blockLines.length; j++) {
                    const line = blockLines[j];
                    const originalTargetValue = getNumericValue(line, targetKey);
                    if (originalTargetValue !== null) {
                        const newTargetValue = applyOperation(originalTargetValue, operation, operationValue, roundDecimals);
                        const lineIndentation = ' '.repeat(getIndentation(line));
                        newLines[blockStartIndex + j] = lineIndentation + targetKey + newTargetValue;
                    }
                }
            }
            i = blockEndIndex;
        }
      } else {
        // --- LINE-BASED TRANSFORMATION ---
        // In this mode, sourceKey and targetKey are the same.
        newLines = lines.map(line => {
            const originalValue = getNumericValue(line, sourceKey);
            if (originalValue !== null) {
                if (checkCondition(originalValue, condition, conditionValue)) {
                    const newValue = applyOperation(originalValue, operation, operationValue, roundDecimals);
                    const lineIndentation = ' '.repeat(getIndentation(line));
                    return lineIndentation + sourceKey + newValue;
                }
            }
            return line;
        });
      }
      
      self.postMessage({ success: true, data: newLines.join('\\n') });
    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  };
`;