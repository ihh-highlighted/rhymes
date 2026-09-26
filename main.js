// main.js
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const dashboardScreen = document.getElementById("dashboard-screen");
  const editorScreen = document.getElementById("editor-screen");
  const projectList = document.getElementById("project-list");
  const btnNewProject = document.getElementById("btn-new-project");
  const btnBack = document.getElementById("btn-back");
  const titleInput = document.getElementById("project-title-input");
  const lyricsInput = document.getElementById("lyrics-input");
  // Add these with your other DOM Elements
  const btnImportProject = document.getElementById("btn-import-project");
  const importFileInput = document.getElementById("import-file-input");

  const canvas = document.getElementById("preview-canvas");
  const canvasWrapper = document.getElementById("canvas-wrapper");
  const ctx = canvas.getContext("2d");
  const saveStatus = document.getElementById("save-status");

  // Settings Controls
  const settingFont = document.getElementById("setting-font");
  const settingFontSize = document.getElementById("setting-font-size");
  const settingMarginLeft = document.getElementById("setting-margin-left");
  const settingMarginRight = document.getElementById("setting-margin-right");
  const settingTextColor = document.getElementById("setting-text-color");
  const settingBgColor = document.getElementById("setting-bg-color");
  const settingAlign = document.getElementById("setting-align");

  const valFontSize = document.getElementById("val-font-size");
  const valMarginLeft = document.getElementById("val-margin-left");
  const valMarginRight = document.getElementById("val-margin-right");

  // Audio & Timeline Controls
  const btnPlay = document.getElementById("btn-play");
  const audioUpload = document.getElementById("audio-upload");
  const timeDisplay = document.getElementById("time-display");
  const timelineScrubber = document.getElementById("timeline-scrubber");
  const keyframeBar = document.getElementById("keyframe-bar");
  const btnDelKf = document.getElementById("btn-del-kf");
  const btnAddKf = document.getElementById("btn-add-kf");
  const kfStatus = document.getElementById("kf-status");
  const toggleFreeRoam = document.getElementById("toggle-free-roam");

  const skipBack5 = document.getElementById("skip-back-5");
  const skipBack1 = document.getElementById("skip-back-1");
  const skipFwd1 = document.getElementById("skip-fwd-1");
  const skipFwd5 = document.getElementById("skip-fwd-5");

  // Highlight System Controls
  const toggleHighlightMode = document.getElementById("toggle-highlight-mode");
  const highlightModeText = document.getElementById("highlight-mode-text");
  const btnUndoHl = document.getElementById("btn-undo-hl");
  const btnRedoHl = document.getElementById("btn-redo-hl");
  const btnClearHl = document.getElementById("btn-clear-hl");
  const colorSwatches = document.querySelectorAll(".swatch");
  const customHlColor = document.getElementById("custom-hl-color");

  // Recording Controls
  const btnToggleRecord = document.getElementById("btn-toggle-record");
  const btnResetRecord = document.getElementById("btn-reset-record");
  const recordStatus = document.getElementById("record-status");
  const swipeArea = document.getElementById("swipe-area");
  const swipeTrackFill = document.getElementById("swipe-track-fill");
  const swipeInstruction = document.getElementById("swipe-instruction");
  const swipeSubtext = document.getElementById("swipe-subtext");

  // Hide yellow progress bar line in swipe zone completely
  if (swipeTrackFill) {
    swipeTrackFill.style.display = "none";
  }

  // Trim Controls
  const trimStartInput = document.getElementById("trim-start");
  const trimEndInput = document.getElementById("trim-end");
  const valTrimStart = document.getElementById("val-trim-start");
  const valTrimEnd = document.getElementById("val-trim-end");

  // Export UI Controls
  const exportFormat = document.getElementById("export-format");
  const exportVideoOptions = document.getElementById("export-video-options");
  const exportResolution = document.getElementById("export-resolution");
  const exportFps = document.getElementById("export-fps");
  const btnStartExport = document.getElementById("btn-start-export");
  const btnCancelExport = document.getElementById("btn-cancel-export");
  const exportProgressContainer = document.getElementById(
    "export-progress-container",
  );
  const exportStatusText = document.getElementById("export-status-text");
  const exportPercent = document.getElementById("export-percent");
  const exportProgressFill = document.getElementById("export-progress-fill");

  let animationFrameId = null;

  canvas.width = window.APP_CONFIG.CANVAS_WIDTH;
  canvas.height = window.APP_CONFIG.CANVAS_HEIGHT;

  AudioManager.init(onAudioTimeUpdate);

  // --- IMPORT PROJECT HANDLERS ---
if (btnImportProject && importFileInput) {
  // Trigger file browser when Import button is clicked
  btnImportProject.addEventListener("click", () => {
    importFileInput.click();
  });

  // Handle file selection
  importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const importedProj = await StorageManager.importProject(file);
      alert(`Project "${importedProj.title}" imported successfully!`);
      importFileInput.value = ""; // Reset input
      renderProjectList(); // Refresh project list to show the imported project
    } catch (err) {
      alert("Failed to import project: Invalid JSON file.");
      console.error(err);
    }
  });
}


  // --- 60 FPS PREVIEW RENDER LOOP ---
  function startPlaybackLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function loop() {
      if (AudioManager.isPlaying) {
        onAudioTimeUpdate();
        animationFrameId = requestAnimationFrame(loop);
      }
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function stopPlaybackLoop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // --- SCREEN ROUTING ---
  function showDashboard() {
    stopPlaybackLoop();
    AudioManager.pause();
    dashboardScreen.classList.add("active");
    editorScreen.classList.remove("active");
    window.AppState.currentProject = null;
    renderProjectList();
  }

  function openProject(project) {
    if (!project.settings)
      project.settings = { ...window.APP_CONFIG.DEFAULT_SETTINGS };
    if (!project.keyframes)
      project.keyframes = [{ id: "kf_0", time: 0, scrollY: 0 }];
    if (!project.highlights) project.highlights = [];
    if (!project.wordTimings) project.wordTimings = {};

    window.AppState.currentProject = project;
    window.AppState.keyframes = project.keyframes;
    window.AppState.highlights = project.highlights;
    window.AppState.wordTimings = project.wordTimings;
    window.AppState.manualScrollY = 0;
    window.AppState.isFreeRoam = false;
    window.AppState.isHighlightMode = false;
    window.AppState.isRecording = false;
    window.AppState.undoStack = [];
    window.AppState.redoStack = [];

    toggleFreeRoam.checked = false;
    toggleHighlightMode.checked = false;
    highlightModeText.textContent = "Preview Mode";

    titleInput.value = project.title;
    lyricsInput.value = project.lyrics;

    settingFont.value = project.settings.fontFamily;
    settingFontSize.value = project.settings.fontSize;
    settingMarginLeft.value = project.settings.marginLeftPercent;
    settingMarginRight.value = project.settings.marginRightPercent;
    settingTextColor.value = project.settings.textColor;
    settingBgColor.value = project.settings.bgColor;
    settingAlign.value = project.settings.textAlign;

    valFontSize.textContent = project.settings.fontSize;
    valMarginLeft.textContent = project.settings.marginLeftPercent;
    valMarginRight.textContent = project.settings.marginRightPercent;

    dashboardScreen.classList.remove("active");
    editorScreen.classList.add("active");

    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  function renderProjectList() {
    window.AppState.projects = StorageManager.getProjects();
    projectList.innerHTML = "";

    if (window.AppState.projects.length === 0) {
      projectList.innerHTML =
        '<p style="color: #888; text-align: center; margin-top: 20px;">No projects created yet.</p>';
      return;
    }

    window.AppState.projects.forEach((project) => {
      const card = document.createElement("div");
      card.className = "project-card";
      card.innerHTML = `
      <div>
        <h3>${escapeHtml(project.title)}</h3>
        <p style="font-size: 12px; color: #888; margin-top: 4px;">${new Date(project.updatedAt).toLocaleDateString()}</p>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn secondary export-btn" data-id="${project.id}">Export</button>
        <button class="btn danger delete-btn" data-id="${project.id}">Delete</button>
      </div>
    `;

      // Click card to open (unless clicking action buttons)
      card.addEventListener("click", (e) => {
        if (
          !e.target.classList.contains("delete-btn") &&
          !e.target.classList.contains("export-btn")
        ) {
          openProject(project);
        }
      });

      // Handle Export Button Click
      card.querySelector(".export-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        StorageManager.exportProject(project.id);
      });

      // Handle Delete Button Click
      card.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Delete project?")) {
          StorageManager.deleteProject(project.id);
          renderProjectList();
        }
      });

      projectList.appendChild(card);
    });
  }

  // --- KEYFRAME INTERPOLATION ---
  function getInterpolatedScrollY(currentTime) {
    const kfs = window.AppState.keyframes;
    if (!kfs || kfs.length === 0) return 0;

    const sorted = [...kfs].sort((a, b) => a.time - b.time);

    if (currentTime <= sorted[0].time) return sorted[0].scrollY;
    if (currentTime >= sorted[sorted.length - 1].time)
      return sorted[sorted.length - 1].scrollY;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];

      if (currentTime >= k1.time && currentTime <= k2.time) {
        const factor = (currentTime - k1.time) / (k2.time - k1.time);
        return k1.scrollY + factor * (k2.scrollY - k1.scrollY);
      }
    }
    return sorted[sorted.length - 1].scrollY;
  }

  function updateKfUI() {
    const currentTime = AudioManager.audio.currentTime || 0;
    const existingIndex = window.AppState.keyframes.findIndex(
      (kf) => Math.abs(kf.time - currentTime) < 0.15,
    );

    if (existingIndex !== -1) {
      kfStatus.textContent = `KF at ${AudioManager.formatTime(currentTime)}`;
      btnDelKf.style.display = "inline-block";
    } else {
      kfStatus.textContent = "No KF at current time";
      btnDelKf.style.display = "none";
    }
    AudioManager.renderKeyframeBar(keyframeBar, window.AppState.keyframes);
  }

  // --- TEXT LAYOUT & BASELINE HIGHLIGHT CALCULATOR ---
  function computeLyricsLayout(
    targetCtx,
    width,
    height,
    totalScrollY,
    s,
    scaleRatio,
  ) {
    const rawText = lyricsInput.value;
    if (!rawText.trim()) return [];

    const scaledFontSize = s.fontSize * scaleRatio;
    targetCtx.font = `bold ${scaledFontSize}px ${s.fontFamily}`;

    const leftX = width * (s.marginLeftPercent / 100);
    const rightX = width * (1 - s.marginRightPercent / 100);
    const maxAllowedWidth = rightX - leftX;

    const rawLines = rawText.split("\n");
    let globalIndexCounter = 0;
    const wrappedLines = [];

    rawLines.forEach((rawLine, lineIdx) => {
      const words = rawLine.split(" ");
      let currentLine = "";
      let lineStartIdx = globalIndexCounter;
      let lineWords = [];

      words.forEach((word) => {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = targetCtx.measureText(testLine).width;

        if (testWidth > maxAllowedWidth && currentLine !== "") {
          wrappedLines.push({
            text: currentLine,
            startIdx: lineStartIdx,
            endIdx: lineStartIdx + currentLine.length,
            words: lineWords,
            lineIndex: wrappedLines.length,
            rawLineIndex: lineIdx,
          });
          lineStartIdx += currentLine.length + 1;
          currentLine = word;
          lineWords = [word];
        } else {
          currentLine = testLine;
          lineWords.push(word);
        }
      });

      wrappedLines.push({
        text: currentLine,
        startIdx: lineStartIdx,
        endIdx: lineStartIdx + currentLine.length,
        words: lineWords,
        lineIndex: wrappedLines.length,
        rawLineIndex: lineIdx,
      });

      globalIndexCounter += rawLine.length + 1;
    });

    const lineHeight = scaledFontSize * s.lineHeight;
    const totalBlockHeight = wrappedLines.length * lineHeight;
    const baseStartY = height / 2 - totalBlockHeight / 2 + lineHeight / 2;
    const startY = baseStartY + totalScrollY;

    return wrappedLines.map((lineObj, idx) => {
      const lineCenterY = startY + idx * lineHeight;

      const baselineY = lineCenterY + scaledFontSize * 0.35;

      const highlightBottom = baselineY + scaledFontSize * 0.08;
      const highlightTop = baselineY - scaledFontSize * 0.78;
      const highlightHeight = highlightBottom - highlightTop;

      const totalLineWidth = targetCtx.measureText(lineObj.text).width;
      let startX = width / 2 - totalLineWidth / 2;

      if (s.textAlign === "left") {
        startX = leftX;
      } else if (s.textAlign === "right") {
        startX = rightX - totalLineWidth;
      }

      const charXPositions = [startX];
      let accWidth = 0;
      for (let i = 0; i < lineObj.text.length; i++) {
        accWidth += targetCtx.measureText(lineObj.text[i]).width;
        charXPositions.push(startX + accWidth);
      }

      const wordRanges = [];
      let wAcc = 0;
      const splitWords = lineObj.text.split(" ");

      splitWords.forEach((w) => {
        const wStart = lineObj.startIdx + wAcc;
        const wEnd = Math.min(lineObj.endIdx, wStart + w.length + 1);
        wordRanges.push({
          word: w,
          startIdx: wStart,
          wordEndIdx: wStart + w.length,
          endIdx: wEnd,
        });
        wAcc += w.length + 1;
      });

      return {
        text: lineObj.text,
        rawLineIndex: lineObj.rawLineIndex,
        startIdx: lineObj.startIdx,
        endIdx: lineObj.endIdx,
        lineCenterY,
        baselineY,
        highlightTop,
        highlightBottom,
        highlightHeight,
        lineHeight,
        startX,
        charXPositions,
        wordRanges,
      };
    });
  }

  // --- UNIVERSAL CANVAS RENDER FUNCTION ---
  // --- UNIVERSAL CANVAS RENDER FUNCTION ---
  function renderCanvas(
    targetCtx,
    width,
    height,
    currentTime,
    forcePreviewMode = false,
  ) {
    const proj = window.AppState.currentProject;
    if (!proj) return;

    const s = proj.settings;
    const scaleRatio = width / window.APP_CONFIG.CANVAS_WIDTH;

    // 1. Draw Background
    if (s.bgColor === "genius-gradient") {
      const bgGradient = targetCtx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0.0, "#333639");
      bgGradient.addColorStop(0.2, "#a8abaf");
      bgGradient.addColorStop(0.5, "#e8eaed");
      bgGradient.addColorStop(0.8, "#a8abaf");
      bgGradient.addColorStop(1.0, "#333639");
      targetCtx.fillStyle = bgGradient;
    } else {
      targetCtx.fillStyle = s.bgColor;
    }
    targetCtx.fillRect(0, 0, width, height);

    if (!lyricsInput.value.trim()) return;

    const interpolatedScrollY =
      getInterpolatedScrollY(currentTime) * scaleRatio;
    const totalScrollY =
      interpolatedScrollY + window.AppState.manualScrollY * scaleRatio;

    const linesData = computeLyricsLayout(
      targetCtx,
      width,
      height,
      totalScrollY,
      s,
      scaleRatio,
    );

    const isHighlightMode =
      window.AppState.isHighlightMode && !forcePreviewMode;
    const isRecording = window.AppState.isRecording && !forcePreviewMode;

    // 2. Draw Highlights (Background Boxes)
    // Group words by original raw input line index for line-level timing calculations
    const rawLineWordsMap = {};
    linesData.forEach((line) => {
      const rIdx = line.rawLineIndex;
      if (!rawLineWordsMap[rIdx]) rawLineWordsMap[rIdx] = [];
      rawLineWordsMap[rIdx].push(...line.wordRanges);
    });

    // Helper to calculate the average time duration between words in a raw line
    const getLineAvgDuration = (rawWords) => {
      let total = 0,
        count = 0;
      for (let i = 0; i < rawWords.length - 1; i++) {
        const t1 = window.AppState.wordTimings
          ? window.AppState.wordTimings[rawWords[i].startIdx]
          : undefined;
        const t2 = window.AppState.wordTimings
          ? window.AppState.wordTimings[rawWords[i + 1].startIdx]
          : undefined;
        if (t1 !== undefined && t2 !== undefined && t2 > t1) {
          total += t2 - t1;
          count++;
        }
      }
      return count > 0 ? total / count : 0.35; // Default fallback: 350ms per word
    };

    window.AppState.highlights.forEach((hl) => {
      linesData.forEach((line) => {
        line.wordRanges.forEach((wordObj) => {
          const overlapStart = Math.max(hl.startIdx, wordObj.startIdx);
          const overlapEnd = Math.min(hl.endIdx, wordObj.endIdx);

          if (overlapStart < overlapEnd) {
            let hlTime = hl.timestamp !== undefined ? hl.timestamp : 0;

            if (
              window.AppState.wordTimings &&
              window.AppState.wordTimings[wordObj.startIdx] !== undefined
            ) {
              const tWord = window.AppState.wordTimings[wordObj.startIdx];
              const rawWords = rawLineWordsMap[line.rawLineIndex] || [];
              const wordIdxInRawLine = rawWords.findIndex(
                (w) => w.startIdx === wordObj.startIdx,
              );

              // 1. Gather & SORT all highlights intersecting this word left-to-right
              const wordHls = window.AppState.highlights
                .filter(
                  (h) =>
                    Math.max(h.startIdx, wordObj.startIdx) <
                    Math.min(h.endIdx, wordObj.endIdx),
                )
                .sort((a, b) => a.startIdx - b.startIdx);

              const hlIndexInWord = wordHls.indexOf(hl);
              const totalHlsInWord = wordHls.length;

              // 2. Compute exact raw duration window for the word
              let totalWordDuration = 0.3;

              if (rawWords.length > 1) {
                if (
                  wordIdxInRawLine >= 0 &&
                  wordIdxInRawLine < rawWords.length - 1
                ) {
                  const nextWord = rawWords[wordIdxInRawLine + 1];
                  const tNext = window.AppState.wordTimings[nextWord.startIdx];
                  if (tNext !== undefined && tNext > tWord) {
                    totalWordDuration = tNext - tWord;
                  } else {
                    totalWordDuration = getLineAvgDuration(rawWords);
                  }
                } else {
                  // End-of-line word -> use average duration of line
                  totalWordDuration = getLineAvgDuration(rawWords);
                }
              }

              // 3. Dynamic Inter-Word Gap:
              // Scaled to max 15% of total word duration (max 100ms).
              // For fast words, this gap naturally shrinks down to almost zero so intra-word highlights get priority.
              const interWordGap = Math.min(0.1, totalWordDuration * 0.15);
              const activeDuration = Math.max(
                0.01,
                totalWordDuration - interWordGap,
              );

              // 4. Stagger highlights across activeDuration without hardcoded minimum floor
              if (totalHlsInWord > 1 && hlIndexInWord >= 0) {
                const delayPerHl = activeDuration / totalHlsInWord;
                hlTime = tWord + hlIndexInWord * delayPerHl;
              } else {
                hlTime = tWord; // First highlight triggers immediately with the word
              }
            }

            let shouldDrawHighlight = false;

            if (isHighlightMode) {
              // Highlight Mode: Show full highlights statically for editing
              shouldDrawHighlight = true;
            } else {
              // Preview / Export Mode: Appear when currentTime reaches the calculated hlTime
              if (currentTime >= hlTime) {
                shouldDrawHighlight = true;
              }
            }

            if (shouldDrawHighlight) {
              const localStart = overlapStart - line.startIdx;
              const localEnd = overlapEnd - line.startIdx;

              const hx1 = line.charXPositions[localStart];
              const hx2 = line.charXPositions[localEnd];

              targetCtx.save();
              targetCtx.globalAlpha = 1.0;
              targetCtx.fillStyle = hl.color;
              targetCtx.fillRect(
                hx1,
                line.highlightTop,
                hx2 - hx1,
                line.highlightHeight,
              );
              targetCtx.restore();
            }
          }
        });
      });
    });

    // Active dragging highlight preview box
    if (
      isHighlightMode &&
      activeHighlightDrag &&
      activeHighlightDrag.startIdx !== null &&
      activeHighlightDrag.endIdx !== null
    ) {
      const minIdx = Math.min(
        activeHighlightDrag.startIdx,
        activeHighlightDrag.endIdx,
      );
      const maxIdx = Math.max(
        activeHighlightDrag.startIdx,
        activeHighlightDrag.endIdx,
      );

      linesData.forEach((line) => {
        const overlapStart = Math.max(minIdx, line.startIdx);
        const overlapEnd = Math.min(maxIdx, line.endIdx);

        if (overlapStart < overlapEnd) {
          const localStart = overlapStart - line.startIdx;
          const localEnd = overlapEnd - line.startIdx;

          const hx1 = line.charXPositions[localStart];
          const hx2 = line.charXPositions[localEnd];

          targetCtx.save();
          targetCtx.globalAlpha = 1.0;
          targetCtx.fillStyle = window.AppState.selectedHighlightColor;
          targetCtx.fillRect(
            hx1,
            line.highlightTop,
            hx2 - hx1,
            line.highlightHeight,
          );
          targetCtx.restore();
        }
      });
    }

    // 3. Draw Lyrics Text (100% Opacity Everywhere Except Unactivated Words in Recording Mode)
    const scaledFontSize = s.fontSize * scaleRatio;
    targetCtx.font = `bold ${scaledFontSize}px ${s.fontFamily}`;
    targetCtx.textBaseline = "alphabetic";

    linesData.forEach((line) => {
      targetCtx.textAlign = "left";

      line.wordRanges.forEach((wordObj) => {
        const wordStartIdx = wordObj.startIdx;
        const localCharIdx = wordStartIdx - line.startIdx;
        const wordX = line.charXPositions[localCharIdx];

        let wordAlpha = 1.0; // Default: Always 100% opacity for all text

        if (isRecording) {
          // Recording mode ONLY: Unactivated words = low opacity (40%), Activated = 100%
          const isWordActivated = sessionRecordedWords.has(wordStartIdx);
          wordAlpha = isWordActivated ? 1.0 : 0.4;
        }

        targetCtx.save();
        targetCtx.globalAlpha = wordAlpha;
        targetCtx.fillStyle = s.textColor;
        targetCtx.fillText(wordObj.word, wordX, line.baselineY);
        targetCtx.restore();
      });
    });
  }

  // --- RECORDING SWIPE & TIMING SYSTEM ---
  let sessionRecordedWords = new Set();

  let recordingState = {
    linesData: [],
    currentLineIdx: 0,
    wordsInCurrentLine: [],
    wordsActivatedInCurrentLine: 0,
    swipeStartX: 0,
    isSwiping: false,
  };

  btnToggleRecord.addEventListener("click", () => {
    if (!AudioManager.audioFile) {
      alert("Please upload an audio track first!");
      return;
    }

    if (window.AppState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  btnResetRecord.addEventListener("click", () => {
    if (confirm("Reset all recorded word timings?")) {
      window.AppState.wordTimings = {};
      sessionRecordedWords.clear();
      triggerSave();
      renderCanvas(
        ctx,
        canvas.width,
        canvas.height,
        AudioManager.audio.currentTime || 0,
      );
      recordStatus.textContent = "Timings reset";
    }
  });
  function startRecording() {
    window.AppState.isRecording = true;
    sessionRecordedWords.clear();

    btnToggleRecord.textContent = "⏹ Stop Recording";
    btnToggleRecord.classList.add("recording");
    recordStatus.textContent = "Recording word timings...";
    swipeInstruction.textContent = "SWIPE HERE →";
    swipeSubtext.textContent =
      "Drag right across this box line-by-line to trigger word timings";

    const scaleRatio = canvas.width / window.APP_CONFIG.CANVAS_WIDTH;
    const interpolatedScrollY =
      getInterpolatedScrollY(AudioManager.audio.currentTime || 0) * scaleRatio;
    const totalScrollY =
      interpolatedScrollY + window.AppState.manualScrollY * scaleRatio;

    // 1. Compute visual layout lines (which now carry rawLineIndex)
    const visualLines = computeLyricsLayout(
      ctx,
      canvas.width,
      canvas.height,
      totalScrollY,
      window.AppState.currentProject.settings,
      scaleRatio,
    );

    // 2. Group all wordRanges by original raw input line index
    const groupedRawLines = {};
    visualLines.forEach((line) => {
      const rawIdx = line.rawLineIndex;
      if (!groupedRawLines[rawIdx]) {
        groupedRawLines[rawIdx] = [];
      }
      groupedRawLines[rawIdx].push(...line.wordRanges);
    });

    // 3. Map into recordingState.linesData as full original lines
    recordingState.linesData = Object.keys(groupedRawLines)
      .sort((a, b) => Number(a) - Number(b))
      .map((rawIdx) => ({
        wordRanges: groupedRawLines[rawIdx],
      }));

    recordingState.currentLineIdx = 0;
    setupLineForRecording(0);

    if (!AudioManager.isPlaying) {
      AudioManager.play();
      btnPlay.textContent = "⏸";
      startPlaybackLoop();
    }

    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  function stopRecording() {
    window.AppState.isRecording = false;
    btnToggleRecord.textContent = "🔴 Start Recording";
    btnToggleRecord.classList.remove("recording");
    recordStatus.textContent = "Recording saved!";
    swipeInstruction.textContent = 'Press "Start Recording" to begin';
    swipeSubtext.textContent = "Swipe across this area to trigger word timings";

    const project = window.AppState.currentProject;
    if (project) {
      // 1. Safely extract timing buffers (fallback to window or existing project arrays)
      const currentTimings =
        typeof recordedTimings !== "undefined"
          ? recordedTimings
          : window.recordedTimings || project.timings || [];

      const currentWordTimings =
        typeof recordedWordTimings !== "undefined"
          ? recordedWordTimings
          : window.recordedWordTimings || project.wordTimings || [];

      // 2. Assign directly to the active project object in AppState
      project.timings = currentTimings;
      project.wordTimings = currentWordTimings;

      // 3. Persist to LocalStorage
      StorageManager.updateProject(project.id, {
        timings: project.timings,
        wordTimings: project.wordTimings,
      });
    }

    // 4. Save any additional project state (lyrics, settings, keyframes)
    if (typeof triggerSave === "function") {
      triggerSave();
    }

    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  // --- UPDATED RECORDING SWIPE LOGIC ---

  function setupLineForRecording(lineIdx) {
    const lines = recordingState.linesData;

    // Automatically skip blank/empty lines if any exist
    while (
      lineIdx < lines.length &&
      (!lines[lineIdx].wordRanges || lines[lineIdx].wordRanges.length === 0)
    ) {
      lineIdx++;
    }

    recordingState.currentLineIdx = lineIdx;

    if (lineIdx >= lines.length) {
      recordingState.wordsInCurrentLine = [];
      recordingState.wordsActivatedInCurrentLine = 0;
      recordStatus.textContent = "🎉 All words recorded!";
      return;
    }

    recordingState.wordsInCurrentLine = lines[lineIdx].wordRanges;
    recordingState.wordsActivatedInCurrentLine = 0;
  }

  function onSwipeStart(clientX) {
    if (!window.AppState.isRecording) return;
    recordingState.isSwiping = true;
    recordingState.swipeStartX = clientX;
    // Remember how many words were already triggered before this new swipe gesture
    recordingState.initialWordsActivated =
      recordingState.wordsActivatedInCurrentLine || 0;
  }

  function onSwipeMove(clientX) {
    if (!window.AppState.isRecording || !recordingState.isSwiping) return;

    const deltaX = Math.max(0, clientX - recordingState.swipeStartX);

    // Distance in pixels required per word (adjust between 35-50 if needed)
    const PIXELS_PER_WORD = 20;

    const totalWords = recordingState.wordsInCurrentLine.length;
    if (totalWords === 0) return;

    // Calculate new target count based on initial words + new drag distance
    const additionalWords = Math.floor(deltaX / PIXELS_PER_WORD);
    const targetWordsToActivate = Math.min(
      totalWords,
      recordingState.initialWordsActivated + additionalWords,
    );

    if (targetWordsToActivate > recordingState.wordsActivatedInCurrentLine) {
      const currentTime = AudioManager.audio.currentTime || 0;

      for (
        let i = recordingState.wordsActivatedInCurrentLine;
        i < targetWordsToActivate;
        i++
      ) {
        const wordObj = recordingState.wordsInCurrentLine[i];

        window.AppState.wordTimings[wordObj.startIdx] = currentTime;
        sessionRecordedWords.add(wordObj.startIdx);
      }

      recordingState.wordsActivatedInCurrentLine = targetWordsToActivate;
      renderCanvas(ctx, canvas.width, canvas.height, currentTime);
    }
  }

  function onSwipeEnd() {
    if (!window.AppState.isRecording || !recordingState.isSwiping) return;
    recordingState.isSwiping = false;

    // Advance to next line only if all words in current line were activated
    if (
      recordingState.wordsInCurrentLine.length > 0 &&
      recordingState.wordsActivatedInCurrentLine >=
        recordingState.wordsInCurrentLine.length
    ) {
      recordingState.currentLineIdx++;
      setupLineForRecording(recordingState.currentLineIdx);
    }
  }
  swipeArea.addEventListener("mousedown", (e) => onSwipeStart(e.clientX));
  window.addEventListener("mousemove", (e) => onSwipeMove(e.clientX));
  window.addEventListener("mouseup", onSwipeEnd);

  swipeArea.addEventListener("touchstart", (e) =>
    onSwipeStart(e.touches[0].clientX),
  );
  window.addEventListener("touchmove", (e) =>
    onSwipeMove(e.touches[0].clientX),
  );
  window.addEventListener("touchend", onSwipeEnd);

  // --- HIGHLIGHT UNDO / REDO STATE STACK ---
  function pushHighlightState() {
    window.AppState.undoStack.push(JSON.stringify(window.AppState.highlights));
    window.AppState.redoStack = [];
  }

  btnUndoHl.addEventListener("click", () => {
    if (window.AppState.undoStack.length === 0) return;
    window.AppState.redoStack.push(JSON.stringify(window.AppState.highlights));
    window.AppState.highlights = JSON.parse(window.AppState.undoStack.pop());
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
    triggerSave();
  });

  btnRedoHl.addEventListener("click", () => {
    if (window.AppState.redoStack.length === 0) return;
    window.AppState.undoStack.push(JSON.stringify(window.AppState.highlights));
    window.AppState.highlights = JSON.parse(window.AppState.redoStack.pop());
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
    triggerSave();
  });

  btnClearHl.addEventListener("click", () => {
    if (window.AppState.highlights.length === 0) return;
    if (confirm("Clear all highlights?")) {
      pushHighlightState();
      window.AppState.highlights = [];
      renderCanvas(
        ctx,
        canvas.width,
        canvas.height,
        AudioManager.audio.currentTime || 0,
      );
      triggerSave();
    }
  });

  toggleHighlightMode.addEventListener("change", () => {
    window.AppState.isHighlightMode = toggleHighlightMode.checked;
    highlightModeText.textContent = window.AppState.isHighlightMode
      ? "Highlighting Mode"
      : "Preview Mode";
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  });

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener("click", () => {
      colorSwatches.forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");
      window.AppState.selectedHighlightColor = swatch.dataset.color;
    });
  });

  customHlColor.addEventListener("input", (e) => {
    colorSwatches.forEach((s) => s.classList.remove("active"));
    window.AppState.selectedHighlightColor = e.target.value;
  });

  // --- DRAGGING / TOUCH HIGHLIGHTING & SCROLLING ---
  let isDragging = false;
  let startY = 0;

  let activeHighlightDrag = {
    startIdx: null,
    endIdx: null,
  };

  function getCharIdxFromCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canX = (clientX - rect.left) * scaleX;
    const canY = (clientY - rect.top) * scaleY;

    const currentTime = AudioManager.audio.currentTime || 0;
    const proj = window.AppState.currentProject;
    if (!proj) return null;

    const scaleRatio = canvas.width / window.APP_CONFIG.CANVAS_WIDTH;
    const interpolatedScrollY =
      getInterpolatedScrollY(currentTime) * scaleRatio;
    const totalScrollY =
      interpolatedScrollY + window.AppState.manualScrollY * scaleRatio;

    const linesData = computeLyricsLayout(
      ctx,
      canvas.width,
      canvas.height,
      totalScrollY,
      proj.settings,
      scaleRatio,
    );

    const forgivingPadding = 24 * scaleRatio;
    const matchedLine = linesData.find((line) => {
      return (
        canY >= line.highlightTop - forgivingPadding &&
        canY <= line.highlightBottom + forgivingPadding
      );
    });

    if (!matchedLine) return null;

    let closestCharIdx = 0;
    let minDistance = Infinity;

    matchedLine.charXPositions.forEach((xPos, idx) => {
      const dist = Math.abs(canX - xPos);
      if (dist < minDistance) {
        minDistance = dist;
        closestCharIdx = idx;
      }
    });

    return matchedLine.startIdx + closestCharIdx;
  }

  function onDragStart(clientX, clientY) {
    isDragging = true;
    startY = clientY;

    if (window.AppState.isHighlightMode) {
      const snappedIdx = getCharIdxFromCoords(clientX, clientY);
      if (snappedIdx !== null) {
        activeHighlightDrag.startIdx = snappedIdx;
        activeHighlightDrag.endIdx = snappedIdx;
      }
    }
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const currentTime = AudioManager.audio.currentTime || 0;

    if (window.AppState.isHighlightMode) {
      if (activeHighlightDrag.startIdx !== null) {
        const snappedIdx = getCharIdxFromCoords(clientX, clientY);
        if (snappedIdx !== null) {
          activeHighlightDrag.endIdx = snappedIdx;
          renderCanvas(ctx, canvas.width, canvas.height, currentTime);
        }
      }
    } else {
      const deltaY = clientY - startY;
      startY = clientY;

      const rect = canvas.getBoundingClientRect();
      const scaleFactor = window.APP_CONFIG.CANVAS_HEIGHT / rect.height;
      const scaledDeltaY = deltaY * scaleFactor;

      if (window.AppState.isFreeRoam) {
        window.AppState.manualScrollY += scaledDeltaY;
      } else {
        const currentScrollY =
          getInterpolatedScrollY(currentTime) + scaledDeltaY;
        window.AppState.manualScrollY = 0;
        setKeyframeAtTime(currentTime, currentScrollY);
      }

      renderCanvas(ctx, canvas.width, canvas.height, currentTime);
      updateKfUI();
    }
  }

  function onDragEnd() {
    if (isDragging && window.AppState.isHighlightMode) {
      if (
        activeHighlightDrag.startIdx !== null &&
        activeHighlightDrag.endIdx !== null
      ) {
        const minIdx = Math.min(
          activeHighlightDrag.startIdx,
          activeHighlightDrag.endIdx,
        );
        const maxIdx = Math.max(
          activeHighlightDrag.startIdx,
          activeHighlightDrag.endIdx,
        );

        if (maxIdx > minIdx) {
          pushHighlightState();

          window.AppState.highlights.push({
            id: "hl_" + Date.now(),
            startIdx: minIdx,
            endIdx: maxIdx,
            color: window.AppState.selectedHighlightColor,
            timestamp: AudioManager.audio.currentTime || 0,
          });

          triggerSave();
        }
      }
      activeHighlightDrag = { startIdx: null, endIdx: null };
      renderCanvas(
        ctx,
        canvas.width,
        canvas.height,
        AudioManager.audio.currentTime || 0,
      );
    }
    isDragging = false;
  }

  canvasWrapper.addEventListener("mousedown", (e) =>
    onDragStart(e.clientX, e.clientY),
  );
  window.addEventListener("mousemove", (e) => onDragMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onDragEnd);

  canvasWrapper.addEventListener("touchstart", (e) =>
    onDragStart(e.touches[0].clientX, e.touches[0].clientY),
  );
  window.addEventListener("touchmove", (e) =>
    onDragMove(e.touches[0].clientX, e.touches[0].clientY),
  );
  window.addEventListener("touchend", onDragEnd);

  // --- AUDIO & TIMELINE EVENTS ---
  function onAudioTimeUpdate() {
    const relTime = AudioManager.getRelativeCurrentTime();
    const effDur = AudioManager.getEffectiveDuration();

    timelineScrubber.value = (relTime / effDur) * 100;
    timeDisplay.textContent = `${AudioManager.formatTime(relTime)} / ${AudioManager.formatTime(effDur)}`;

    updateKfUI();
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  audioUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const proj = window.AppState.currentProject;
      AudioManager.loadAudio(
        file,
        proj.trimStart,
        proj.trimEnd,
        (dur, start, end) => {
          btnPlay.disabled = false;
          timelineScrubber.disabled = false;
          [
            skipBack5,
            skipBack1,
            skipFwd1,
            skipFwd5,
            trimStartInput,
            trimEndInput,
          ].forEach((b) => (b.disabled = false));

          trimStartInput.max = dur;
          trimEndInput.max = dur;

          trimStartInput.value = start;
          trimEndInput.value = end;

          valTrimStart.textContent = AudioManager.formatTime(start);
          valTrimEnd.textContent = AudioManager.formatTime(end);

          onAudioTimeUpdate();
        },
      );
    }
  });

  btnPlay.addEventListener("click", () => {
    const playing = AudioManager.togglePlay();
    btnPlay.textContent = playing ? "⏸" : "▶";
    if (playing) {
      startPlaybackLoop();
    } else {
      stopPlaybackLoop();
    }
  });

  skipBack5.addEventListener("click", () => AudioManager.skip(-5));
  skipBack1.addEventListener("click", () => AudioManager.skip(-1));
  skipFwd1.addEventListener("click", () => AudioManager.skip(1));
  skipFwd5.addEventListener("click", () => AudioManager.skip(5));

  timelineScrubber.addEventListener("input", () => {
    AudioManager.seekRelativePercent(timelineScrubber.value);
    if (!window.AppState.isFreeRoam) {
      window.AppState.manualScrollY = 0;
    }
    onAudioTimeUpdate();
  });

  function onTrimChange() {
    let startVal = parseFloat(trimStartInput.value);
    let endVal = parseFloat(trimEndInput.value);

    if (startVal >= endVal) {
      startVal = endVal - 0.5;
      trimStartInput.value = startVal;
    }

    valTrimStart.textContent = AudioManager.formatTime(startVal);
    valTrimEnd.textContent = AudioManager.formatTime(endVal);

    AudioManager.setTrim(startVal, endVal);
    triggerSave();
  }

  trimStartInput.addEventListener("input", onTrimChange);
  trimEndInput.addEventListener("input", onTrimChange);

  toggleFreeRoam.addEventListener("change", () => {
    window.AppState.isFreeRoam = toggleFreeRoam.checked;
    if (!window.AppState.isFreeRoam) {
      window.AppState.manualScrollY = 0;
      renderCanvas(
        ctx,
        canvas.width,
        canvas.height,
        AudioManager.audio.currentTime || 0,
      );
    }
  });

  btnDelKf.addEventListener("click", () => {
    const currentTime = AudioManager.audio.currentTime || 0;
    window.AppState.keyframes = window.AppState.keyframes.filter(
      (kf) => Math.abs(kf.time - currentTime) >= 0.15,
    );
    updateKfUI();
    renderCanvas(ctx, canvas.width, canvas.height, currentTime);
    triggerSave();
  });

  // Around Line 520 - Add Keyframe Button Listener
  if (btnAddKf) {
    btnAddKf.addEventListener("click", () => {
      const currentTime = AudioManager.audio.currentTime || 0;
      const scaleRatio = canvas.width / window.APP_CONFIG.CANVAS_WIDTH;
      const currentScrollY =
        getInterpolatedScrollY(currentTime) +
        window.AppState.manualScrollY * scaleRatio;

      setKeyframeAtTime(currentTime, currentScrollY);
      window.AppState.manualScrollY = 0; // Reset manual offset to snap into the keyframe
      updateKfUI();
      renderCanvas(ctx, canvas.width, canvas.height, currentTime);
    });
  }

  function setKeyframeAtTime(time, targetScrollY) {
    const kfs = window.AppState.keyframes;
    const existingIndex = kfs.findIndex(
      (kf) => Math.abs(kf.time - time) < 0.12,
    );

    if (existingIndex !== -1) {
      kfs[existingIndex].scrollY = targetScrollY;
    } else {
      kfs.push({
        id: "kf_" + Date.now(),
        time: time,
        scrollY: targetScrollY,
      });
    }

    kfs.sort((a, b) => a.time - b.time);
    triggerSave();
  }

  // --- EXPORT LOGIC ---
  exportFormat.addEventListener("change", () => {
    exportVideoOptions.style.display =
      exportFormat.value === "wav" ? "none" : "block";
  });

  btnStartExport.addEventListener("click", () => {
    if (!AudioManager.audioFile) {
      alert("Please upload an audio track before exporting!");
      return;
    }

    const fmt = exportFormat.value;

    if (fmt === "wav") {
      exportStatusText.textContent = "Rendering WAV Audio...";
      exportProgressContainer.style.display = "block";
      exportProgressFill.style.width = "100%";

      ExportManager.exportAudioWav(window.AppState.currentProject, () => {
        exportProgressContainer.style.display = "none";
        alert("Audio export complete!");
      });
      return;
    }

    exportProgressContainer.style.display = "block";
    btnStartExport.disabled = true;

    ExportManager.exportVideo(
      {
        resolution: exportResolution.value,
        fps: exportFps.value,
      },
      window.AppState.currentProject,
      (targetCtx, w, h, time) => renderCanvas(targetCtx, w, h, time, true),
      (progress) => {
        exportStatusText.textContent = `Exporting Video (${exportResolution.value} @ ${exportFps.value}fps)...`;
        exportPercent.textContent = `${Math.floor(progress)}%`;
        exportProgressFill.style.width = `${progress}%`;
      },
      () => {
        exportProgressContainer.style.display = "none";
        btnStartExport.disabled = false;
        alert("Video export finished successfully!");
      },
      (err) => {
        exportProgressContainer.style.display = "none";
        btnStartExport.disabled = false;
        alert("Export error: " + err);
      },
    );
  });

  btnCancelExport.addEventListener("click", () => {
    ExportManager.cancelExport();
    exportProgressContainer.style.display = "none";
    btnStartExport.disabled = false;
  });

  // --- SAVE STATE ---
  function getSettingsFromUI() {
    return {
      fontFamily: settingFont.value,
      fontSize: parseInt(settingFontSize.value, 10),
      marginLeftPercent: parseInt(settingMarginLeft.value, 10),
      marginRightPercent: parseInt(settingMarginRight.value, 10),
      textColor: settingTextColor.value,
      bgColor: settingBgColor.value,
      textAlign: settingAlign.value,
      lineHeight: 1.4,
    };
  }

  function triggerSave() {
    if (!window.AppState.currentProject) return;

    saveStatus.textContent = "Saving...";

    const updated = StorageManager.updateProject(
      window.AppState.currentProject.id,
      {
        title: titleInput.value,
        lyrics: lyricsInput.value,
        settings: getSettingsFromUI(),
        trimStart: AudioManager.trimStart,
        trimEnd: AudioManager.trimEnd,
        keyframes: window.AppState.keyframes,
        highlights: window.AppState.highlights,
        wordTimings: window.AppState.wordTimings,
      },
    );

    if (updated) {
      window.AppState.currentProject = updated;
      setTimeout(() => {
        saveStatus.textContent = "Saved";
      }, 300);
    }
  }

  function onSettingsChange() {
    valFontSize.textContent = settingFontSize.value;
    valMarginLeft.textContent = settingMarginLeft.value;
    valMarginRight.textContent = settingMarginRight.value;

    if (window.AppState.currentProject) {
      window.AppState.currentProject.settings = getSettingsFromUI();
    }

    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
    triggerSave();
  }

  // --- TABS ---
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  btnNewProject.addEventListener("click", () => {
    const title = prompt("Project Name:", "New Rhyme Video");
    if (title) openProject(StorageManager.createProject(title));
  });

  btnBack.addEventListener("click", showDashboard);

  lyricsInput.addEventListener("input", () => {
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
    triggerSave();
  });

  titleInput.addEventListener("input", triggerSave);

  [
    settingFont,
    settingFontSize,
    settingMarginLeft,
    settingMarginRight,
    settingTextColor,
    settingBgColor,
    settingAlign,
  ].forEach((input) => {
    input.addEventListener("input", onSettingsChange);
  });

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  showDashboard();
});

// --- IMPORT PROJECT HANDLERS ---
if (btnImportProject && importFileInput) {
  // Trigger file browser when Import button is clicked
  btnImportProject.addEventListener("click", () => {
    importFileInput.click();
  });

  // Handle file selection
  importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const importedProj = await StorageManager.importProject(file);
      alert(`Project "${importedProj.title}" imported successfully!`);
      importFileInput.value = ""; // Reset input
      renderProjectList(); // Refresh project list to show the imported project
    } catch (err) {
      alert("Failed to import project: Invalid JSON file.");
      console.error(err);
    }
  });
}
