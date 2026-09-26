const canvas = document.getElementById('rhymeCanvas');
const ctx = canvas.getContext('2d');
const lyricsInput = document.getElementById('lyricsInput');

let activeColor = '#FF0055';
let wordsData = []; // Holds position, size, text, and list of highlights

// Undo / Redo History Stacks
let undoStack = [];
let redoStack = [];

// Clear Mode State
let isClearModeActive = false;

// Drag State
let isDragging = false;
let currentTargetWord = null;
let dragStartX = 0;
let dragCurrentX = 0;

// Scroll & Gesture State
let touchStartY = 0;
let isVerticalScroll = false;

// Helper to save deep clone of highlights state
function saveState() {
  const snapshot = wordsData.map(w => ({
    highlights: JSON.parse(JSON.stringify(w.highlights))
  }));
  undoStack.push(snapshot);
  redoStack = []; // Clear redo stack on new action
}

// Color Selection Setup
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeColor = btn.dataset.color;
    
    // Deactivate Clear Mode if a color is selected
    if (isClearModeActive) {
      isClearModeActive = false;
      const toggleClearModeBtn = document.getElementById('toggleClearModeBtn');
      if (toggleClearModeBtn) {
        toggleClearModeBtn.textContent = '🧹 Clear Mode: OFF';
        toggleClearModeBtn.style.background = '';
        toggleClearModeBtn.style.color = '';
      }
    }
  });
});

// Clear Mode Toggle Button Handler
const toggleClearModeBtn = document.getElementById('toggleClearModeBtn');
if (toggleClearModeBtn) {
  toggleClearModeBtn.addEventListener('click', () => {
    isClearModeActive = !isClearModeActive;
    if (isClearModeActive) {
      toggleClearModeBtn.textContent = '🧹 Clear Mode: ON';
      toggleClearModeBtn.style.background = '#eab308';
      toggleClearModeBtn.style.color = '#000';
    } else {
      toggleClearModeBtn.textContent = '🧹 Clear Mode: OFF';
      toggleClearModeBtn.style.background = '';
      toggleClearModeBtn.style.color = '';
    }
  });
}

function layoutText() {
  if (!lyricsInput) return;
  const text = lyricsInput.value;
  const rawLines = text.split('\n');

  const fontSize = canvasConfig.fontSize;
  const lineHeight = fontSize * 1.5;
  let currentY = 180;

  ctx.font = `bold ${fontSize}px ${canvasConfig.fontFamily}`;

  // Calculate printable boundary based on percentage margins
  const leftMarginPx = (canvas.width * canvasConfig.marginStart) / 100;
  const rightMarginPx = canvas.width - ((canvas.width * canvasConfig.marginEnd) / 100);
  const maxLineWidth = rightMarginPx - leftMarginPx;

  const newWordsData = [];
  let lineCounter = 0;

  rawLines.forEach((line) => {
    const spaceWidth = ctx.measureText(' ').width;
    const words = line.split(' ');

    // 1. Break line into wrapped sub-lines based on maxLineWidth
    const wrappedLines = [];
    let currentLineWords = [];
    let currentLineWidth = 0;

    words.forEach(w => {
      if (!w) return;
      const wWidth = ctx.measureText(w).width;

      if (currentLineWords.length > 0 && (currentLineWidth + spaceWidth + wWidth) > maxLineWidth) {
        wrappedLines.push({ words: currentLineWords, width: currentLineWidth });
        currentLineWords = [w];
        currentLineWidth = wWidth;
      } else {
        currentLineWords.push(w);
        currentLineWidth += (currentLineWords.length > 1 ? spaceWidth : 0) + wWidth;
      }
    });

    if (currentLineWords.length > 0) {
      wrappedLines.push({ words: currentLineWords, width: currentLineWidth });
    }

    // 2. Position wrapped words on canvas based on Alignment
    wrappedLines.forEach((subLine) => {
      let currentX = leftMarginPx; // Default Left alignment

      if (canvasConfig.textAlign === 'center') {
        currentX = leftMarginPx + (maxLineWidth - subLine.width) / 2;
      } else if (canvasConfig.textAlign === 'right') {
        currentX = rightMarginPx - subLine.width;
      }

      subLine.words.forEach((wordText, wordIndex) => {
        const wordWidth = ctx.measureText(wordText).width;

        // Character bounds calculation
        const charBounds = [];
        let accumulatedX = 0;
        for (let i = 0; i < wordText.length; i++) {
          const charWidth = ctx.measureText(wordText[i]).width;
          charBounds.push({
            char: wordText[i],
            startX: accumulatedX,
            endX: accumulatedX + charWidth
          });
          accumulatedX += charWidth;
        }

        // Preserve highlight mapping across layout updates
        const existing = wordsData.find(w => w.text === wordText && w.lineIndex === lineCounter && w.wordIndex === wordIndex) ||
                         wordsData.find(w => w.text === wordText);

        let remappedHighlights = [];
        if (existing && existing.highlights && existing.highlights.length > 0 && existing.charBounds) {
          remappedHighlights = existing.highlights.map(hl => {
            let startCharIdx = 0;
            let endCharIdx = wordText.length;

            existing.charBounds.forEach((cb, idx) => {
              const mid = (cb.startX + cb.endX) / 2;
              if (mid < hl.startX) startCharIdx = idx + 1;
              if (mid <= hl.startX + hl.width) endCharIdx = idx + 1;
            });

            const newStartX = charBounds[startCharIdx] ? charBounds[startCharIdx].startX : 0;
            const newEndX = charBounds[endCharIdx - 1] ? charBounds[endCharIdx - 1].endX : wordWidth;

            return { startX: newStartX, width: newEndX - newStartX, color: hl.color };
          });
        }

        newWordsData.push({
          text: wordText,
          lineIndex: lineCounter,
          wordIndex: wordIndex,
          x: currentX,
          y: currentY,
          w: wordWidth,
          h: fontSize,
          charBounds: charBounds,
          highlights: remappedHighlights
        });

        currentX += wordWidth + spaceWidth;
      });

      currentY += lineHeight;
      lineCounter++;
    });
  });

  wordsData = newWordsData;
  renderCanvas();
}

// Convert drag distance into letter-snapped start and width
function getSnappedSelection(word, startX, currentX) {
  const relStart = Math.min(startX, currentX) - word.x;
  const relEnd = Math.max(startX, currentX) - word.x;

  let snappedStart = word.w;
  let snappedEnd = 0;

  // Snap to character bounds
  word.charBounds.forEach(cb => {
    if (relStart < cb.endX && relEnd > cb.startX) {
      snappedStart = Math.min(snappedStart, cb.startX);
      snappedEnd = Math.max(snappedEnd, cb.endX);
    }
  });

  if (snappedEnd <= snappedStart) {
    return { startX: 0, width: 0 };
  }

  return {
    startX: snappedStart,
    width: snappedEnd - snappedStart
  };
}

// Draw everything
function renderCanvas() {
  if (!ctx) return;

  // Clear Background
  ctx.fillStyle = canvasConfig.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `bold ${canvasConfig.fontSize}px ${canvasConfig.fontFamily}`;
  ctx.textBaseline = 'top';

  // Apply keyframe scroll translation
  ctx.save();
  ctx.translate(0, currentScrollY);

  wordsData.forEach(word => {
    // 1. Draw Saved Highlights
    word.highlights.forEach(hl => {
      ctx.fillStyle = hl.color;
      ctx.fillRect(word.x + hl.startX, word.y, hl.width, word.h);
    });

    // 2. Draw Active Drag Highlight
    let activeDragSelection = null;
    if (isDragging && currentTargetWord === word) {
      activeDragSelection = getSnappedSelection(word, dragStartX, dragCurrentX);
      if (activeDragSelection.width > 0) {
        ctx.fillStyle = activeColor;
        ctx.fillRect(word.x + activeDragSelection.startX, word.y, activeDragSelection.width, word.h);
      }
    }

    // 3. Draw Letter-by-Letter Text
    word.charBounds.forEach(cb => {
      ctx.fillStyle = canvasConfig.textColor;
      ctx.fillText(cb.char, word.x + cb.startX, word.y);
    });
  });

  ctx.restore();
}

// Transform Screen Touch/Mouse coordinates to Canvas Coordinates (Accounts for Scaling & Scroll Offset)
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches && e.touches.length > 0 ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (touch.clientX - rect.left) * scaleX;
  
  // CRITICAL FIX: Subtract currentScrollY so Y matches the translated canvas coordinates
  const canvasY = ((touch.clientY - rect.top) * scaleY) - currentScrollY;

  return { x: canvasX, y: canvasY };
}

// Forgiving Touch Hit-Test (With Padding and Line Fallback)
function findWordAtPosition(posX, posY) {
  if (!wordsData || wordsData.length === 0) return null;

  const HIT_PADDING_X = 18; // Generous horizontal touch margin
  const HIT_PADDING_Y = 14; // Generous vertical touch margin

  // 1. Direct or Padded Match
  let matchedWord = wordsData.find(word => {
    return (
      posX >= (word.x - HIT_PADDING_X) &&
      posX <= (word.x + word.w + HIT_PADDING_X) &&
      posY >= (word.y - HIT_PADDING_Y) &&
      posY <= (word.y + word.h + HIT_PADDING_Y)
    );
  });

  if (matchedWord) return matchedWord;

  // 2. Fallback: Find closest word on the same vertical row
  const closestLineWords = wordsData.filter(word => {
    return Math.abs(posY - (word.y + word.h / 2)) < (word.h + HIT_PADDING_Y);
  });

  if (closestLineWords.length > 0) {
    let closest = closestLineWords[0];
    let minDistance = Math.abs(posX - (closest.x + closest.w / 2));

    for (let i = 1; i < closestLineWords.length; i++) {
      const dist = Math.abs(posX - (closestLineWords[i].x + closestLineWords[i].w / 2));
      if (dist < minDistance) {
        minDistance = dist;
        closest = closestLineWords[i];
      }
    }
    return closest;
  }

  return null;
}

// Touch / Mouse Down
function handleStart(e) {
  const coords = getCanvasCoords(e);
  
  // -------------------------------------------------------------
  // MODE 1: SCROLL LOCKED ON (Highlighting & Clear Mode Active)
  // -------------------------------------------------------------
  if (typeof isScrollLocked !== 'undefined' && isScrollLocked) {
    const targetWord = findWordAtPosition(coords.x, coords.y);

    if (targetWord) {
      // Clear Mode Action
      if (isClearModeActive) {
        saveState();
        targetWord.highlights = [];
        renderCanvas();
        if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
        return;
      }

      // Highlight Drag / Tap Action
      isDragging = true;
      currentTargetWord = targetWord;
      dragStartX = coords.x;
      dragCurrentX = coords.x;
    }
    return;
  }

  // -------------------------------------------------------------
  // MODE 2: SCROLL UNLOCKED (Finger Canvas Scrolling Active)
  // -------------------------------------------------------------
  if (e.touches && e.touches.length === 1) {
    isVerticalScroll = true;
    touchStartY = e.touches[0].clientY;
  }
}

// Touch / Mouse Move
function handleMove(e) {
  // 1. SCROLL LOCKED MODE: Handle Highlight Dragging
  if (isScrollLocked && isDragging && currentTargetWord) {
    if (e.cancelable) e.preventDefault();
    const coords = getCanvasCoords(e);
    dragCurrentX = coords.x;
    renderCanvas();
    return;
  }

  // 2. SCROLL UNLOCKED MODE: Handle Smooth Finger Scrolling
  if (!isScrollLocked && isVerticalScroll && e.touches && e.touches.length === 1) {
    if (e.cancelable) e.preventDefault(); // Prevents web page bouncing/scrolling

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY;
    touchStartY = touch.clientY;

    // Apply scroll offset
    currentScrollY += deltaY;

    // Auto-record keyframe if playing/recording in Sync Mode
    if (typeof isFreeRoam !== 'undefined' && !isFreeRoam && typeof addOrUpdateKeyframe === 'function' && audioElement && audioElement.src) {
      addOrUpdateKeyframe(audioElement.currentTime, currentScrollY);
    }

    renderCanvas();
  }
}

// Touch / Mouse End
function handleEnd() {
  if (isScrollLocked && isDragging && currentTargetWord) {
    const word = currentTargetWord;
    const snapped = getSnappedSelection(word, dragStartX, dragCurrentX);

    if (snapped.width > 0) {
      saveState();
      word.highlights.push({
        startX: snapped.startX,
        width: snapped.width,
        color: activeColor
      });
      if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
    } else {
      // Tap selection fallback: Highlight whole word on tap
      saveState();
      word.highlights.push({
        startX: 0,
        width: word.w,
        color: activeColor
      });
      if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
    }
  }

  isDragging = false;
  currentTargetWord = null;
  isVerticalScroll = false;
  renderCanvas();
}

// MOUSE WHEEL SCROLL
canvas.addEventListener('wheel', (e) => {
  if (typeof isScrollLocked !== 'undefined' && isScrollLocked) return;

  currentScrollY -= e.deltaY * 0.5;

  if (typeof isFreeRoam !== 'undefined' && !isFreeRoam && typeof addOrUpdateKeyframe === 'function' && audioElement && audioElement.src) {
    addOrUpdateKeyframe(audioElement.currentTime, currentScrollY);
  }

  renderCanvas();
}, { passive: true });

// Unified Event Listeners
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);

if (lyricsInput) {
  lyricsInput.addEventListener('input', () => {
    layoutText();
    if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
  });
}

// Undo Action
const undoBtn = document.getElementById('undoBtn');
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;

    const currentState = wordsData.map(w => ({ highlights: JSON.parse(JSON.stringify(w.highlights)) }));
    redoStack.push(currentState);

    const previousState = undoStack.pop();
    wordsData.forEach((w, index) => {
      if (previousState[index]) {
        w.highlights = previousState[index].highlights;
      }
    });
    renderCanvas();
    if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
  });
}

// Redo Action
const redoBtn = document.getElementById('redoBtn');
if (redoBtn) {
  redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;

    const currentState = wordsData.map(w => ({ highlights: JSON.parse(JSON.stringify(w.highlights)) }));
    undoStack.push(currentState);

    const nextState = redoStack.pop();
    wordsData.forEach((w, index) => {
      if (nextState[index]) {
        w.highlights = nextState[index].highlights;
      }
    });
    renderCanvas();
    if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
  });
}

// Clear All with Undo Support
const clearHighlightsBtn = document.getElementById('clearHighlightsBtn') || document.getElementById('clearHighlights');
if (clearHighlightsBtn) {
  clearHighlightsBtn.addEventListener('click', () => {
    saveState();
    wordsData.forEach(w => w.highlights = []);
    renderCanvas();
    if (typeof autoSaveCurrentProject === 'function') autoSaveCurrentProject();
  });
}

// Initial Layout
layoutText();