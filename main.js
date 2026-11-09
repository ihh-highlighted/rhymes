// main.js
document.addEventListener("DOMContentLoaded", () => {
  // If the browser served an old cached index.html / styles.js next to a newer
  // main.js, reload once automatically instead of leaving a half-started app.
  if (
    typeof StyleKit === "undefined" ||
    !document.getElementById("setting-line-gap")
  ) {
    let tried = false;
    try {
      tried = sessionStorage.getItem("assets-reloaded") === "1";
      sessionStorage.setItem("assets-reloaded", "1");
    } catch (e) {}
    if (!tried) {
      location.reload();
    } else {
      alert(
        "Some app files are out of date in your browser cache. Clear this site's cache (or start the app with serve.py) and reload.",
      );
    }
    return;
  }
  try {
    sessionStorage.removeItem("assets-reloaded");
  } catch (e) {}

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
  const settingLineGap = document.getElementById("setting-line-gap");
  const settingTextStyle = document.getElementById("setting-text-style");
  const settingTextDepth = document.getElementById("setting-text-depth");
  const settingHlStyle = document.getElementById("setting-hl-style");
  const settingBgImageEffect = document.getElementById("setting-bg-image-effect");
  const settingBgBlur = document.getElementById("setting-bg-blur");
  const settingBgDim = document.getElementById("setting-bg-dim");
  const bgCustomColor = document.getElementById("bg-custom-color");
  const bgImageInput = document.getElementById("bg-image-input");
  const btnBgImagePick = document.getElementById("btn-bg-image-pick");
  const btnBgImageRemove = document.getElementById("btn-bg-image-remove");
  const bgImageControls = document.getElementById("bg-image-controls");
  const bgGrid = document.getElementById("bg-grid");
  const textStyleGrid = document.getElementById("text-style-grid");
  const hlStyleGrid = document.getElementById("hl-style-grid");
  const valLineGap = document.getElementById("val-line-gap");
  const valTextDepth = document.getElementById("val-text-depth");
  const valBgBlur = document.getElementById("val-bg-blur");
  const valBgDim = document.getElementById("val-bg-dim");

  // Background photo (stored compressed inside the project)
  let currentBgImage = "";
  let lastFontValue = null;

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
  const btnUndoKf = document.getElementById("btn-undo-kf");
  const btnRedoKf = document.getElementById("btn-redo-kf");

  // Keyframe edit history (separate from highlight undo/redo)
  const KF_EPS = 0.12; // seconds: "same keyframe" tolerance
  const KF_HISTORY_LIMIT = 100;
  const kfHistory = { undo: [], redo: [] };

  // Last known lyrics text, used to work out exactly what an edit changed
  let lastLyricsText = "";

  // Word touched when a highlight/underline gesture starts (tap = whole word)
  let gestureWord = null;

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
  const toolButtons = document.querySelectorAll(".tool-btn");
  const highlightHint = document.getElementById("highlight-instructions");
  const hlConfigPanel = document.getElementById("hl-config-panel");
  const fontPickerBtn = document.getElementById("font-picker-btn");
  const fontPickerPanel = document.getElementById("font-picker-panel");
  const fontPickerSample = document.getElementById("font-picker-sample");
  const fontPickerName = document.getElementById("font-picker-name");
  const fontList = document.getElementById("font-list");
  const fontNotice = document.getElementById("font-notice");
  const fontFileInput = document.getElementById("font-file-input");
  const btnUploadFont = document.getElementById("btn-upload-font");
  let googleFontsFailed = false;
  const hlConfigList = document.getElementById("hl-config-list");
  const hlConfigCount = document.getElementById("hl-config-count");
  const hlFilterBtns = document.querySelectorAll("#hl-config-filter .seg-btn");
  const paletteSection = document.querySelector(".color-palette-section");
  let hlConfigFilter = "all";
  let hlConfigTimer = null;
  if (!window.AppState.highlightTool) window.AppState.highlightTool = "highlight";

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

  // PREVIEW QUALITY
  // The editor preview is a small window, so it is drawn at a reduced size and
  // 30 fps to keep editing smooth on phones. Full quality (1920x1080, 60 fps)
  // is only used in fullscreen. Exports use their own canvas and are unaffected.
  const PREVIEW_WIDTH = 960; // editor preview width in pixels (height follows 16:9)
  const PREVIEW_FPS = 30;
  const PREVIEW_FRAME_MS = 1000 / PREVIEW_FPS;

  function isFullscreenNow() {
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    return !!el && el.classList.contains("preview-container");
  }

  function applyPreviewQuality() {
    const cfg = window.APP_CONFIG;
    const w = isFullscreenNow() ? cfg.CANVAS_WIDTH : PREVIEW_WIDTH;
    const h = Math.round((w * cfg.CANVAS_HEIGHT) / cfg.CANVAS_WIDTH);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; // resizing clears the canvas, so redraw straight away
      canvas.height = h;
      if (window.AppState.currentProject) {
        renderCanvas(ctx, canvas.width, canvas.height, AudioManager.audio.currentTime || 0);
      }
    }
  }
  applyPreviewQuality();
  document.addEventListener("fullscreenchange", applyPreviewQuality);
  document.addEventListener("webkitfullscreenchange", applyPreviewQuality);

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


  // --- PREVIEW RENDER LOOP (30 fps in editor, full rate in fullscreen) ---
  function startPlaybackLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    let lastFrameTs = 0;
    function loop(ts) {
      if (AudioManager.isPlaying) {
        // 30 fps in the editor, full refresh rate in fullscreen
        const interval = isFullscreenNow() ? 0 : PREVIEW_FRAME_MS;
        if (!interval || ts - lastFrameTs >= interval - 2) {
          lastFrameTs = ts;
          onAudioTimeUpdate();
        }
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
    // Older projects: split highlights so none spans spaces or two words
    project.highlights = normalizeAnnotations(project.highlights, project.lyrics || "");
    if (!project.wordTimings) project.wordTimings = {};

    // Older projects don't have the newer style options yet
    project.settings = { ...StyleKit.DEFAULTS, ...project.settings };

    window.AppState.currentProject = project;
    window.AppState.keyframes = project.keyframes;
    window.AppState.highlights = project.highlights;
    window.AppState.wordTimings = project.wordTimings;
    window.AppState.manualScrollY = 0;
    resetKfHistory();
    window.AppState.selectedHlId = null;
    endTempPreview();
    window.AppState.isHighlightMode = false;
    window.AppState.isRecording = false;
    window.AppState.undoStack = [];
    window.AppState.redoStack = [];

    toggleHighlightMode.checked = false;
    highlightModeText.textContent = "Preview Mode";
    updateToolUI();

    titleInput.value = project.title;
    lyricsInput.value = project.lyrics;
    lastLyricsText = lyricsInput.value;

    settingFont.value = project.settings.fontFamily;
    settingFontSize.value = project.settings.fontSize;
    settingMarginLeft.value = project.settings.marginLeftPercent;
    settingMarginRight.value = project.settings.marginRightPercent;
    settingTextColor.value = project.settings.textColor;
    settingBgColor.value = project.settings.bgColor;
    settingAlign.value = project.settings.textAlign;
    settingLineGap.value = project.settings.lineHeight;
    settingTextStyle.value = project.settings.textStyle;
    settingTextDepth.value = project.settings.textDepth;
    settingHlStyle.value = project.settings.hlStyle;
    settingBgImageEffect.value = project.settings.bgImageEffect;
    settingBgBlur.value = project.settings.bgBlur;
    settingBgDim.value = project.settings.bgDim;
    currentBgImage = project.settings.bgImage || "";
    lastFontValue = project.settings.fontFamily;
    renderBgThumbs();
    renderTextThumbs();
    refreshStyleUI();
    StyleKit.ensureFont(project.settings).then(() => {
      renderTextThumbs();
      requestRerender();
    });

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
        '<div class="empty-state"><strong>No projects yet</strong>Tap “New project” to make your first rhyme video.</div>';
      return;
    }

    window.AppState.projects.forEach((project) => {
      const card = document.createElement("div");
      card.className = "project-card";
      card.innerHTML = `
      <div class="card-info">
        <h3>${escapeHtml(project.title)}</h3>
        <p class="card-date">${new Date(project.updatedAt).toLocaleDateString()}</p>
      </div>
      <div class="card-actions">
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

  function findKfIndexAt(time) {
    return window.AppState.keyframes.findIndex(
      (kf) => Math.abs(kf.time - time) < KF_EPS,
    );
  }

  function updateKfUI() {
    const currentTime = AudioManager.audio.currentTime || 0;
    const existingIndex = findKfIndexAt(currentTime);
    const hasUnsavedMove = Math.abs(window.AppState.manualScrollY) > 0.5;

    if (existingIndex !== -1) {
      kfStatus.textContent =
        `KF at ${AudioManager.formatTime(currentTime)}` +
        (hasUnsavedMove ? " • unsaved move" : "");
      if (btnAddKf) btnAddKf.textContent = "✓ Update Keyframe";
      btnDelKf.style.display = "inline-block";
    } else {
      kfStatus.textContent = hasUnsavedMove
        ? "No KF here • unsaved move"
        : "No KF at current time";
      if (btnAddKf) btnAddKf.textContent = "+ Add Keyframe";
      btnDelKf.style.display = "none";
    }

    AudioManager.renderKeyframeBar(
      keyframeBar,
      window.AppState.keyframes,
      jumpToKeyframe,
      currentTime,
    );

    btnUndoKf.disabled = kfHistory.undo.length === 0;
    btnRedoKf.disabled = kfHistory.redo.length === 0;
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
  targetCtx.font = StyleKit.fontString(s, scaledFontSize);

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
  // One shared integer scroll offset: every line moves by the same amount
  // each frame, so lines can't cross rounding thresholds at different times.
  const scrollOffset = Math.round(totalScrollY);

  return wrappedLines.map((lineObj, idx) => {
    // Static layout is rounded once; scroll is added uniformly on top
    const lineCenterY = Math.round(baseStartY + idx * lineHeight) + scrollOffset;
    const baselineY = Math.round(lineCenterY + scaledFontSize * 0.35);

    const highlightTop = Math.round(baselineY - scaledFontSize * 0.78);
    const highlightBottom = Math.round(baselineY + scaledFontSize * 0.08);
    const highlightHeight = Math.round(highlightBottom - highlightTop);
    const underlineTop = baselineY + Math.round(scaledFontSize * 0.11);
    const underlineHeight = Math.max(2, Math.round(scaledFontSize * 0.07));

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
      underlineTop,
      underlineHeight,
      lineHeight,
      startX,
      charXPositions,
      wordRanges,
    };
  });
}

// --- UNIVERSAL CANVAS RENDER FUNCTION ---
// When a highlight/underline appears. A manual startTime wins; otherwise it
// follows the recorded timing of its word (split evenly if a word has several).
function lineAvgDuration(rawWords) {
  let total = 0,
    count = 0;
  const wt = window.AppState.wordTimings;
  for (let i = 0; i < rawWords.length - 1; i++) {
    const t1 = wt ? wt[rawWords[i].startIdx] : undefined;
    const t2 = wt ? wt[rawWords[i + 1].startIdx] : undefined;
    if (t1 !== undefined && t2 !== undefined && t2 > t1) {
      total += t2 - t1;
      count++;
    }
  }
  return count > 0 ? total / count : 0.35;
}

function computeHlTime(hl, wordObj, line, rawLineWordsMap) {
  if (typeof hl.startTime === "number") return hl.startTime;

  let hlTime = hl.timestamp !== undefined ? hl.timestamp : 0;
  const wt = window.AppState.wordTimings;

  if (wt && wt[wordObj.startIdx] !== undefined) {
    const tWord = wt[wordObj.startIdx];
    const rawWords = rawLineWordsMap[line.rawLineIndex] || [];
    const wordIdxInRawLine = rawWords.findIndex(
      (w) => w.startIdx === wordObj.startIdx,
    );

    const wordHls = window.AppState.highlights
      .filter(
        (h) =>
          (h.type || "highlight") === (hl.type || "highlight") &&
          Math.max(h.startIdx, wordObj.startIdx) <
            Math.min(h.endIdx, wordObj.wordEndIdx),
      )
      .sort((a, b) => a.startIdx - b.startIdx);

    const hlIndexInWord = wordHls.indexOf(hl);
    const totalHlsInWord = wordHls.length;

    let totalWordDuration = 0.3;
    if (rawWords.length > 1) {
      if (wordIdxInRawLine >= 0 && wordIdxInRawLine < rawWords.length - 1) {
        const nextWord = rawWords[wordIdxInRawLine + 1];
        const tNext = wt[nextWord.startIdx];
        totalWordDuration =
          tNext !== undefined && tNext > tWord
            ? tNext - tWord
            : lineAvgDuration(rawWords);
      } else {
        totalWordDuration = lineAvgDuration(rawWords);
      }
    }

    const interWordGap = Math.min(0.1, totalWordDuration * 0.15);
    const activeDuration = Math.max(0.01, totalWordDuration - interWordGap);

    if (totalHlsInWord > 1 && hlIndexInWord >= 0) {
      hlTime = tWord + (hlIndexInWord * activeDuration) / totalHlsInWord;
    } else {
      hlTime = tWord;
    }
  }
  return hlTime;
}

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

  // 0. Known-good drawing state + opaque base, so a frame can never smear
  //    over the previous one even if something below fails or leaks state.
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.shadowColor = "transparent";
  targetCtx.shadowBlur = 0;
  targetCtx.shadowOffsetX = 0;
  targetCtx.shadowOffsetY = 0;
  targetCtx.fillStyle = "#101010";
  targetCtx.fillRect(0, 0, width, height);

  // 1. Draw Background (presets, textures, glass, your image)
  StyleKit.drawBackground(targetCtx, width, height, s, requestRerender);

  if (!lyricsInput.value.trim()) return;

  const interpolatedScrollY =
    getInterpolatedScrollY(currentTime) * scaleRatio;
  const manualOffset = forcePreviewMode ? 0 : window.AppState.manualScrollY;
  const totalScrollY = interpolatedScrollY + manualOffset * scaleRatio;

  const linesData = computeLyricsLayout(
    targetCtx,
    width,
    height,
    totalScrollY,
    s,
    scaleRatio,
  );

  const isHighlightMode =
    window.AppState.isHighlightMode &&
    !forcePreviewMode &&
    !window.AppState.tempPreview;
  const isRecording = window.AppState.isRecording && !forcePreviewMode;

  // 2. Draw Highlights (Background Boxes)
  const rawLineWordsMap = {};
  linesData.forEach((line) => {
    const rIdx = line.rawLineIndex;
    if (!rawLineWordsMap[rIdx]) rawLineWordsMap[rIdx] = [];
    rawLineWordsMap[rIdx].push(...line.wordRanges);
  });

  window.AppState.highlights.forEach((hl) => {
    linesData.forEach((line) => {
      line.wordRanges.forEach((wordObj) => {
        const overlapStart = Math.max(hl.startIdx, wordObj.startIdx);
        const overlapEnd = Math.min(hl.endIdx, wordObj.wordEndIdx);

        if (overlapStart < overlapEnd) {
          const hlTime = computeHlTime(hl, wordObj, line, rawLineWordsMap);

          let shouldDrawHighlight = false;

          if (isHighlightMode) {
            shouldDrawHighlight = true;
          } else {
            if (currentTime >= hlTime) {
              shouldDrawHighlight = true;
            }
          }

          if (shouldDrawHighlight) {
            const localStart = overlapStart - line.startIdx;
            const localEnd = overlapEnd - line.startIdx;

            const hx1 = Math.round(line.charXPositions[localStart]);
            const hx2 = Math.round(line.charXPositions[localEnd]);

            StyleKit.drawAnnotation(
              targetCtx,
              hl.type,
              hl.color,
              hx1,
              hx2,
              line,
              s.hlStyle,
              hl.startIdx * 977 + overlapStart * 31 + overlapEnd,
            );
          }
        }
      });
    });
  });

  // Active drag preview (per word, spaces skipped, matches the chosen tool)
  if (
    isHighlightMode &&
    window.AppState.highlightTool !== "clear" &&
    activeHighlightDrag &&
    activeHighlightDrag.startIdx !== null &&
    activeHighlightDrag.endIdx !== null
  ) {
    let minIdx = Math.min(activeHighlightDrag.startIdx, activeHighlightDrag.endIdx);
    let maxIdx = Math.max(activeHighlightDrag.startIdx, activeHighlightDrag.endIdx);
    if (minIdx === maxIdx && gestureWord) {
      // finger hasn't moved: a tap would take the whole word
      minIdx = gestureWord.startIdx;
      maxIdx = gestureWord.wordEndIdx;
    }
    const previewUnderline = window.AppState.highlightTool === "underline";

    linesData.forEach((line) => {
      line.wordRanges.forEach((wordObj) => {
        const overlapStart = Math.max(minIdx, wordObj.startIdx);
        const overlapEnd = Math.min(maxIdx, wordObj.wordEndIdx);
        if (overlapStart >= overlapEnd) return;

        const hx1 = Math.round(line.charXPositions[overlapStart - line.startIdx]);
        const hx2 = Math.round(line.charXPositions[overlapEnd - line.startIdx]);

        StyleKit.drawAnnotation(
          targetCtx,
          previewUnderline ? "underline" : "highlight",
          window.AppState.selectedHighlightColor,
          hx1,
          hx2,
          line,
          s.hlStyle,
          overlapStart * 977 + overlapEnd * 31,
        );
      });
    });
  }

  // 3. Draw Lyrics Text
  const scaledFontSize = s.fontSize * scaleRatio;
  targetCtx.font = StyleKit.fontString(s, scaledFontSize);
  targetCtx.textBaseline = "alphabetic";

  linesData.forEach((line) => {
    targetCtx.textAlign = "left";

    line.wordRanges.forEach((wordObj) => {
      const wordStartIdx = wordObj.startIdx;
      const localCharIdx = wordStartIdx - line.startIdx;

      const wordX = Math.round(line.charXPositions[localCharIdx]);
      const drawY = Math.round(line.baselineY);

      let wordAlpha = 1.0;

      if (isRecording) {
        const isWordActivated = sessionRecordedWords.has(wordStartIdx);
        wordAlpha = isWordActivated ? 1.0 : 0.4;
      }

      targetCtx.save();
      targetCtx.globalAlpha = wordAlpha;
      StyleKit.drawText(
        targetCtx,
        wordObj.word,
        wordX,
        drawY,
        s.textStyle,
        s.textColor,
        scaledFontSize,
        s.textDepth,
      );
      targetCtx.restore();
    });
  });

  // Configure tool: outline the highlight/underline that is being edited
  if (
    !forcePreviewMode &&
    !window.AppState.tempPreview &&
    window.AppState.highlightTool === "configure" &&
    window.AppState.selectedHlId
  ) {
    const sel = window.AppState.highlights.find(
      (h) => h.id === window.AppState.selectedHlId,
    );
    if (sel) {
      const k = scaleRatio;
      linesData.forEach((line) => {
        line.wordRanges.forEach((w) => {
          const oS = Math.max(sel.startIdx, w.startIdx);
          const oE = Math.min(sel.endIdx, w.wordEndIdx);
          if (oS >= oE) return;
          const x1 = Math.round(line.charXPositions[oS - line.startIdx]);
          const x2 = Math.round(line.charXPositions[oE - line.startIdx]);
          const top =
            (sel.type === "underline" ? line.underlineTop - 6 * k : line.highlightTop) - 5 * k;
          const bottom =
            (sel.type === "underline"
              ? line.underlineTop + line.underlineHeight + 6 * k
              : line.highlightTop + line.highlightHeight) + 5 * k;
          targetCtx.save();
          targetCtx.lineJoin = "round";
          targetCtx.setLineDash([10 * k, 7 * k]);
          targetCtx.lineWidth = Math.max(4, 5 * k);
          targetCtx.strokeStyle = "rgba(0,0,0,0.65)";
          targetCtx.strokeRect(x1 - 7 * k, top, x2 - x1 + 14 * k, bottom - top);
          targetCtx.lineWidth = Math.max(2, 3 * k);
          targetCtx.strokeStyle = "#ffffff";
          targetCtx.strokeRect(x1 - 7 * k, top, x2 - x1 + 14 * k, bottom - top);
          targetCtx.restore();
        });
      });
    }
  }
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

    btnToggleRecord.textContent = "■ Stop recording";
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
    btnToggleRecord.textContent = "● Start recording";
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
    updateToolUI();
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
  let gestureMode = null; // "scroll" | "select" | "clear"
  let cfgTap = null; // pending tap on a highlight (Configure tool)
  let clearChanged = false;
  let clearUndoPushed = false;
  let lastTouchTime = 0;

  // Tool buttons (Highlight / Underline / Clear)
  const HINTS = {
    highlight:
      "<strong>Highlight</strong>: drag across words to highlight them, or tap a word to highlight all of it. Touch empty space and drag to scroll.",
    underline:
      "<strong>Underline</strong>: drag across words to underline them, or tap a word to underline all of it. Touch empty space and drag to scroll.",
    clear:
      "<strong>Clear</strong>: touch or drag over a highlight/underline to remove it. Touch empty space and drag to scroll.",
    configure:
      "<strong>Configure</strong>: tap a highlight on the preview, or pick it from the list, to change when it appears or its color. Touch empty space and drag to scroll.",
  };
  function updateToolUI() {
    const tool = window.AppState.highlightTool;
    const editing = window.AppState.isHighlightMode;
    toolButtons.forEach((b) => {
      const isConfigure = b.dataset.tool === "configure";
      // Highlight / Underline / Clear need Highlighting Mode; Configure works in both
      b.classList.toggle("active", (editing || isConfigure) && b.dataset.tool === tool);
      b.disabled = !editing && !isConfigure;
    });
    if (highlightHint) {
      highlightHint.innerHTML =
        editing || tool === "configure"
          ? HINTS[tool]
          : "<strong>Preview mode</strong>: highlights appear at their timings and you can scroll the canvas. Switch to Highlighting Mode to use Highlight, Underline or Clear. Configure works in both modes.";
    }
    const configuring = tool === "configure";
    hlConfigPanel.style.display = configuring ? "block" : "none";
    if (paletteSection) paletteSection.style.display = configuring ? "none" : "";
    if (configuring) refreshHlConfig(true);
    else window.AppState.selectedHlId = null;
  }
  toolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.AppState.highlightTool = btn.dataset.tool;
      updateToolUI();
    });
  });
  updateToolUI();

  // Current text layout (what is on the canvas right now)
  function getCurrentLayout() {
    const proj = window.AppState.currentProject;
    if (!proj) return null;
    const currentTime = AudioManager.audio.currentTime || 0;
    const scaleRatio = canvas.width / window.APP_CONFIG.CANVAS_WIDTH;
    const totalScrollY =
      (getInterpolatedScrollY(currentTime) + window.AppState.manualScrollY) *
      scaleRatio;

    const linesData = computeLyricsLayout(
      ctx,
      canvas.width,
      canvas.height,
      totalScrollY,
      proj.settings,
      scaleRatio,
    );
    const rawMap = {};
    linesData.forEach((l) => {
      (rawMap[l.rawLineIndex] = rawMap[l.rawLineIndex] || []).push(...l.wordRanges);
    });
    return { linesData, rawMap, fontPx: proj.settings.fontSize * scaleRatio };
  }

  // Screen position -> canvas position + current layout
  function getPointerLayout(clientX, clientY) {
    const L = getCurrentLayout();
    if (!L) return null;
    const rect = canvas.getBoundingClientRect();
    const canX = (clientX - rect.left) * (canvas.width / rect.width);
    const canY = (clientY - rect.top) * (canvas.height / rect.height);
    return { canX, canY, linesData: L.linesData, fontPx: L.fontPx };
  }

  function nearestLocalIdx(line, canX) {
    let best = 0;
    let minDistance = Infinity;
    line.charXPositions.forEach((xPos, idx) => {
      const dist = Math.abs(canX - xPos);
      if (dist < minDistance) {
        minDistance = dist;
        best = idx;
      }
    });
    return best;
  }

  // The word under the finger (with a finger-sized margin), or null = empty space
  function findWordAtPoint(p) {
    const padX = p.fontPx * 0.25;
    const padY = p.fontPx * 0.2;
    let best = null;
    let bestDist = Infinity;

    p.linesData.forEach((line) => {
      if (p.canY < line.highlightTop - padY || p.canY > line.highlightBottom + padY) return;
      line.wordRanges.forEach((w) => {
        if (w.wordEndIdx <= w.startIdx) return;
        const x1 = line.charXPositions[w.startIdx - line.startIdx];
        const x2 = line.charXPositions[w.wordEndIdx - line.startIdx];
        if (p.canX < x1 - padX || p.canX > x2 + padX) return;
        const d = Math.abs(p.canX - (x1 + x2) / 2);
        if (d < bestDist) {
          bestDist = d;
          best = { line, word: w };
        }
      });
    });
    return best;
  }

  // While dragging a selection: nearest character on the nearest line
  function charIdxNearPoint(p) {
    const pad = p.fontPx * 0.35;
    let bestLine = null;
    let bestDist = Infinity;
    p.linesData.forEach((line) => {
      const d =
        p.canY < line.highlightTop
          ? line.highlightTop - p.canY
          : p.canY > line.highlightBottom
            ? p.canY - line.highlightBottom
            : 0;
      if (d <= pad && d < bestDist) {
        bestDist = d;
        bestLine = line;
      }
    });
    if (!bestLine) return null;
    return bestLine.startIdx + nearestLocalIdx(bestLine, p.canX);
  }

  // Highlights/underlines under the finger
  function findAnnotationsAt(p) {
    const padX = p.fontPx * 0.12;
    const padY = p.fontPx * 0.15;
    const hits = [];

    window.AppState.highlights.forEach((hl) => {
      let hit = false;
      p.linesData.forEach((line) => {
        if (hit) return;
        const top = line.highlightTop - padY;
        const bottom =
          Math.max(line.highlightBottom, line.underlineTop + line.underlineHeight) + padY;
        if (p.canY < top || p.canY > bottom) return;

        line.wordRanges.forEach((w) => {
          const oS = Math.max(hl.startIdx, w.startIdx);
          const oE = Math.min(hl.endIdx, w.wordEndIdx);
          if (oS >= oE) return;
          const x1 = line.charXPositions[oS - line.startIdx];
          const x2 = line.charXPositions[oE - line.startIdx];
          if (p.canX >= x1 - padX && p.canX <= x2 + padX) hit = true;
        });
      });
      if (hit) hits.push(hl);
    });
    return hits;
  }

  function removeAnnotationsAt(p) {
    const hits = findAnnotationsAt(p);
    if (hits.length === 0) return;
    if (!clearUndoPushed) {
      pushHighlightState(); // one undo step per swipe
      clearUndoPushed = true;
    }
    window.AppState.highlights = window.AppState.highlights.filter(
      (h) => !hits.includes(h),
    );
    clearChanged = true;
    renderCanvas(ctx, canvas.width, canvas.height, AudioManager.audio.currentTime || 0);
  }

  // Add one highlight/underline per word inside [a, b) - never over spaces
  function addAnnotations(a, b) {
    const segs = wordSegments(lyricsInput.value, a, b);
    if (segs.length === 0) return;

    const type = window.AppState.highlightTool === "underline" ? "underline" : "highlight";
    const now = Date.now();
    const t = AudioManager.audio.currentTime || 0;

    pushHighlightState();
    segs.forEach(([sIdx, eIdx], i) => {
      // re-marking the exact same range replaces it (e.g. new color)
      window.AppState.highlights = window.AppState.highlights.filter(
        (h) =>
          !((h.type || "highlight") === type && h.startIdx === sIdx && h.endIdx === eIdx),
      );
      window.AppState.highlights.push({
        id: "hl_" + now + "_" + i,
        type,
        startIdx: sIdx,
        endIdx: eIdx,
        color: window.AppState.selectedHighlightColor,
        timestamp: t,
      });
    });
    triggerSave();
  }

  function onDragStart(clientX, clientY) {
    isDragging = true;
    startY = clientY;
    gestureMode = "scroll"; // default: empty space scrolls
    gestureWord = null;
    clearChanged = false;
    clearUndoPushed = false;
    activeHighlightDrag = { startIdx: null, endIdx: null };

    cfgTap = null;
    if (window.AppState.tempPreview) return;

    // Configure tool (Preview or Highlighting mode): a tap on a highlight opens
    // it, dragging anywhere still scrolls.
    if (window.AppState.highlightTool === "configure") {
      const p0 = getPointerLayout(clientX, clientY);
      const L = getCurrentLayout();
      if (p0 && L) {
        const now = AudioManager.audio.currentTime || 0;
        const hits = findAnnotationsAt(p0).filter(
          (h) => window.AppState.isHighlightMode || getHlInfo(h, L).time <= now,
        );
        if (hits.length > 0) {
          cfgTap = { hl: hits[hits.length - 1], x: clientX, y: clientY, moved: false };
        }
      }
      return;
    }

    if (!window.AppState.isHighlightMode) return;

    const p = getPointerLayout(clientX, clientY);
    if (!p) return;

    const hit = findWordAtPoint(p);
    if (!hit) return; // touched empty space -> scroll

    if (window.AppState.highlightTool === "clear") {
      gestureMode = "clear";
      removeAnnotationsAt(p);
    } else {
      gestureMode = "select";
      gestureWord = hit.word;
      const idx = Math.min(
        hit.word.wordEndIdx,
        Math.max(
          hit.word.startIdx,
          hit.line.startIdx + nearestLocalIdx(hit.line, p.canX),
        ),
      );
      activeHighlightDrag = { startIdx: idx, endIdx: idx };
      renderCanvas(ctx, canvas.width, canvas.height, AudioManager.audio.currentTime || 0);
    }
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const currentTime = AudioManager.audio.currentTime || 0;

    if (gestureMode === "select") {
      const p = getPointerLayout(clientX, clientY);
      const idx = p ? charIdxNearPoint(p) : null;
      if (idx !== null) {
        activeHighlightDrag.endIdx = idx;
        renderCanvas(ctx, canvas.width, canvas.height, currentTime);
      }
    } else if (gestureMode === "clear") {
      const p = getPointerLayout(clientX, clientY);
      if (p) removeAnnotationsAt(p);
    } else if (gestureMode === "configure") {
      // tap only
    } else {
      // scroll (preview mode, or empty space in edit mode)
      if (cfgTap && Math.hypot(clientX - cfgTap.x, clientY - cfgTap.y) > 8) {
        cfgTap.moved = true; // it was a scroll, not a tap
      }
      const deltaY = clientY - startY;
      startY = clientY;

      const rect = canvas.getBoundingClientRect();
      const scaleFactor = window.APP_CONFIG.CANVAS_HEIGHT / rect.height;
      const scaledDeltaY = deltaY * scaleFactor;

      // Free move: only changes the temporary offset. A keyframe is
      // created/updated only when the Add/Update Keyframe button is pressed.
      window.AppState.manualScrollY += scaledDeltaY;

      renderCanvas(ctx, canvas.width, canvas.height, currentTime);
      updateKfUI();
      scheduleHlConfigRefresh();
    }
  }

  function onDragEnd() {
    if (!isDragging) return;

    if (cfgTap && !cfgTap.moved) selectHlFromCanvas(cfgTap.hl);
    cfgTap = null;

    if (gestureMode === "select" && activeHighlightDrag.startIdx !== null) {
      let a = Math.min(activeHighlightDrag.startIdx, activeHighlightDrag.endIdx);
      let b = Math.max(activeHighlightDrag.startIdx, activeHighlightDrag.endIdx);
      if (a === b && gestureWord) {
        // a tap (no drag) takes the whole word
        a = gestureWord.startIdx;
        b = gestureWord.wordEndIdx;
      }
      addAnnotations(a, b);
    } else if (gestureMode === "clear" && clearChanged) {
      triggerSave();
    }

    activeHighlightDrag = { startIdx: null, endIdx: null };
    gestureWord = null;
    gestureMode = null;
    isDragging = false;
    renderCanvas(ctx, canvas.width, canvas.height, AudioManager.audio.currentTime || 0);
  }

  // Touch also fires emulated mouse events; ignore those so a tap isn't applied twice
  const recentTouch = () => Date.now() - lastTouchTime < 700;

  canvasWrapper.addEventListener("mousedown", (e) => {
    if (recentTouch()) return;
    onDragStart(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    if (recentTouch()) return;
    onDragMove(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (recentTouch()) return;
    onDragEnd();
  });

  canvasWrapper.addEventListener(
    "touchstart",
    (e) => {
      lastTouchTime = Date.now();
      if (e.cancelable) e.preventDefault();
      onDragStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: false },
  );
  window.addEventListener("touchmove", (e) => {
    lastTouchTime = Date.now();
    onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  });
  window.addEventListener("touchend", () => {
    lastTouchTime = Date.now();
    onDragEnd();
  });
  window.addEventListener("touchcancel", () => {
    lastTouchTime = Date.now();
    onDragEnd();
  });

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
    scheduleHlConfigRefresh();
  }

  audioUpload.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    audioUpload.value = ""; // lets you pick the same file again later
    if (!file) return;

    const proj = window.AppState.currentProject;
    if (!proj) {
      alert("Open a project first, then add the song.");
      return;
    }

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
      () => {
        alert(
          "This browser couldn't open that audio file. Try an MP3, WAV or M4A.",
        );
      },
    );
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

  const skipBy = (sec) => {
    window.AppState.manualScrollY = 0;
    AudioManager.skip(sec);
  };
  skipBack5.addEventListener("click", () => skipBy(-5));
  skipBack1.addEventListener("click", () => skipBy(-1));
  skipFwd1.addEventListener("click", () => skipBy(1));
  skipFwd5.addEventListener("click", () => skipBy(5));

  timelineScrubber.addEventListener("input", () => {
    AudioManager.seekRelativePercent(timelineScrubber.value);
    window.AppState.manualScrollY = 0;
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

  // --- KEYFRAME EDITING (history, add/update, delete, jump) ---
  function cloneKeyframes() {
    return JSON.parse(JSON.stringify(window.AppState.keyframes));
  }

  function resetKfHistory() {
    kfHistory.undo = [];
    kfHistory.redo = [];
  }

  // Call right BEFORE changing keyframes
  function pushKfHistory() {
    kfHistory.undo.push(cloneKeyframes());
    if (kfHistory.undo.length > KF_HISTORY_LIMIT) kfHistory.undo.shift();
    kfHistory.redo = [];
  }

  function afterKfChange() {
    window.AppState.manualScrollY = 0;
    triggerSave();
    updateKfUI();
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  function undoKf() {
    if (kfHistory.undo.length === 0) return;
    kfHistory.redo.push(cloneKeyframes());
    window.AppState.keyframes = kfHistory.undo.pop();
    afterKfChange();
  }

  function redoKf() {
    if (kfHistory.redo.length === 0) return;
    kfHistory.undo.push(cloneKeyframes());
    window.AppState.keyframes = kfHistory.redo.pop();
    afterKfChange();
  }

  btnUndoKf.addEventListener("click", undoKf);
  btnRedoKf.addEventListener("click", redoKf);

  // Tap a diamond under the timeline: pause, jump to it, ready to edit
  function jumpToKeyframe(time) {
    AudioManager.pause();
    stopPlaybackLoop();
    btnPlay.textContent = "▶";
    window.AppState.manualScrollY = 0;
    AudioManager.audio.currentTime = time;
    onAudioTimeUpdate();
  }

  btnDelKf.addEventListener("click", () => {
    const currentTime = AudioManager.audio.currentTime || 0;
    if (findKfIndexAt(currentTime) === -1) return;
    pushKfHistory();
    window.AppState.keyframes = window.AppState.keyframes.filter(
      (kf) => Math.abs(kf.time - currentTime) >= KF_EPS,
    );
    afterKfChange();
  });

  // Add a keyframe here, or update the one at this time, using the
  // current visual position (interpolated scroll + your free move).
  if (btnAddKf) {
    btnAddKf.addEventListener("click", () => {
      const currentTime = AudioManager.audio.currentTime || 0;
      const targetScrollY =
        getInterpolatedScrollY(currentTime) + window.AppState.manualScrollY;
      setKeyframeAtTime(currentTime, targetScrollY);
      afterKfChange();
    });
  }

  function setKeyframeAtTime(time, targetScrollY) {
    const kfs = window.AppState.keyframes;
    const existingIndex = findKfIndexAt(time);

    if (
      existingIndex !== -1 &&
      Math.abs(kfs[existingIndex].scrollY - targetScrollY) < 0.01
    ) {
      return; // nothing changed, don't pollute undo history
    }

    pushKfHistory();

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
      (msg) => {
        exportStatusText.textContent = msg;
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
      lineHeight: parseFloat(settingLineGap.value) || 1.4,
      textStyle: settingTextStyle.value,
      textDepth: parseInt(settingTextDepth.value, 10),
      bgImage: currentBgImage,
      bgImageEffect: settingBgImageEffect.value,
      bgBlur: parseInt(settingBgBlur.value, 10),
      bgDim: parseInt(settingBgDim.value, 10),
      hlStyle: settingHlStyle.value,
    };
  }

  function triggerSave() {
    if (!window.AppState.currentProject) return;
    refreshHlConfig(false);

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

  function requestRerender() {
    renderCanvas(
      ctx,
      canvas.width,
      canvas.height,
      AudioManager.audio.currentTime || 0,
    );
  }

  // --- STYLE TAB UI ---
  function renderBgThumbs() {
    StyleKit.renderChipThumbs(bgGrid, StyleKit.BG_PRESETS, (cv, item) =>
      StyleKit.drawBgThumb(cv, item, { imageSrc: currentBgImage }),
    );
  }
  function renderTextThumbs() {
    const st = { fontFamily: settingFont.value };
    StyleKit.renderChipThumbs(textStyleGrid, StyleKit.TEXT_STYLES, (cv, item) =>
      StyleKit.drawTextThumb(cv, item, st),
    );
  }
  function renderHlThumbs() {
    StyleKit.renderChipThumbs(hlStyleGrid, StyleKit.HL_STYLES, (cv, item) =>
      StyleKit.drawHlThumb(cv, item),
    );
  }
  function refreshStyleUI() {
    updateFontButton();
    valFontSize.textContent = settingFontSize.value;
    valMarginLeft.textContent = settingMarginLeft.value;
    valMarginRight.textContent = settingMarginRight.value;
    valLineGap.textContent = (+settingLineGap.value).toFixed(2);
    valTextDepth.textContent = settingTextDepth.value;
    valBgBlur.textContent = settingBgBlur.value;
    valBgDim.textContent = settingBgDim.value;

    StyleKit.setActiveChip(bgGrid, settingBgColor.value);
    StyleKit.setActiveChip(textStyleGrid, settingTextStyle.value);
    StyleKit.setActiveChip(hlStyleGrid, settingHlStyle.value);
    updateStyleSummaries();

    bgImageControls.style.display =
      settingBgColor.value === "image" ? "block" : "none";
    if (/^#[0-9a-f]{6}$/i.test(settingBgColor.value)) {
      bgCustomColor.value = settingBgColor.value;
    }
  }

  function onSettingsChange() {
    refreshStyleUI();

    if (window.AppState.currentProject) {
      window.AppState.currentProject.settings = getSettingsFromUI();
    }

    // a different font needs to finish loading before it can be drawn
    if (settingFont.value !== lastFontValue) {
      lastFontValue = settingFont.value;
      StyleKit.ensureFont({ fontFamily: settingFont.value }).then(() => {
        renderTextThumbs();
        requestRerender();
      });
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

  // =====================================================================
  // KEEP HIGHLIGHTS & WORD TIMINGS ATTACHED TO THE TEXT THEY BELONG TO
  // Highlights/timings are stored as character positions in the lyrics.
  // When the text changes, every stored position is moved to match.
  // =====================================================================

  // Work out what changed: { start, oldEnd, newEnd, insLen, delta, inserted, oldText }
  // The cursor position disambiguates repeated characters (e.g. typing "a" in "aaa").
  function computeTextEdit(oldT, newT, cursor) {
    const oldLen = oldT.length;
    const newLen = newT.length;
    let start = 0, oldEnd = 0, newEnd = 0, found = false;

    if (typeof cursor === "number" && cursor >= 0 && cursor <= newLen) {
      const oe = oldLen - (newLen - cursor);
      if (oe >= 0 && oe <= oldLen && oldT.slice(oe) === newT.slice(cursor)) {
        let p = 0;
        const maxP = Math.min(oe, cursor);
        while (p < maxP && oldT[p] === newT[p]) p++;
        start = p;
        oldEnd = oe;
        newEnd = cursor;
        found = true;
      }
    }

    if (!found) {
      let p = 0;
      const minLen = Math.min(oldLen, newLen);
      while (p < minLen && oldT[p] === newT[p]) p++;
      let sfx = 0;
      while (
        sfx < minLen - p &&
        oldT[oldLen - 1 - sfx] === newT[newLen - 1 - sfx]
      ) sfx++;
      start = p;
      oldEnd = oldLen - sfx;
      newEnd = newLen - sfx;
    }

    return {
      start,
      oldEnd,
      newEnd,
      insLen: newEnd - start,
      delta: newLen - oldLen,
      inserted: newT.slice(start, newEnd),
      oldText: oldT,
    };
  }

  // Generic position mapper. assoc: +1 sticks to the right of an insertion, -1 to the left
  function mapIdx(pos, e, assoc) {
    if (pos < e.start) return pos;
    if (pos > e.oldEnd) return pos + e.delta;
    if (e.start === e.oldEnd) return assoc > 0 ? pos + e.delta : pos; // pure insertion
    if (pos === e.start) return e.start;
    if (pos === e.oldEnd) return e.newEnd;
    return assoc > 0 ? e.newEnd : e.start; // inside the removed/replaced text
  }

  // Typing a letter right next to a highlighted word joins that word, so it stays highlighted
  function mapHighlightStart(pos, e) {
    if (e.start === e.oldEnd && pos === e.start) {
      const joins =
        e.inserted.length > 0 &&
        !/\s/.test(e.inserted) &&
        pos < e.oldText.length &&
        !/\s/.test(e.oldText[pos]);
      return joins ? pos : pos + e.delta;
    }
    return mapIdx(pos, e, 1);
  }

  function mapHighlightEnd(pos, e) {
    if (e.start === e.oldEnd && pos === e.start) {
      const joins =
        e.inserted.length > 0 &&
        !/\s/.test(e.inserted) &&
        pos > 0 &&
        !/\s/.test(e.oldText[pos - 1]);
      return joins ? pos + e.delta : pos;
    }
    return mapIdx(pos, e, -1);
  }

  function remapHighlights(list, e, newLen) {
    const out = [];
    (list || []).forEach((hl) => {
      const s = Math.max(0, mapHighlightStart(hl.startIdx, e));
      const en = Math.min(newLen, mapHighlightEnd(hl.endIdx, e));
      if (en > s) out.push({ ...hl, startIdx: s, endIdx: en });
    });
    return out;
  }

  // wordTimings is { wordStartIndex: seconds }
  function mapTimingKey(pos, e) {
    if (pos < e.start) return pos;
    if (pos >= e.oldEnd) {
      if (e.start === e.oldEnd && pos === e.start) {
        // New word(s) typed right before this word push it forward;
        // a letter typed at its start just edits the word.
        return /\s$/.test(e.inserted) ? pos + e.delta : pos;
      }
      return pos + e.delta;
    }
    // Word start was inside the changed text
    if (pos === e.start && e.insLen > 0) return pos; // word typed over keeps its timing
    return null; // that word was deleted
  }

  function remapWordTimings(timings, e, newText) {
    const out = {};
    Object.keys(timings || {}).forEach((k) => {
      const t = timings[k];
      if (typeof t !== "number") return;
      const nk = mapTimingKey(parseInt(k, 10), e);
      if (nk === null || nk < 0 || nk > newText.length) return;
      // only keep keys that are still at the start of a word
      const atWordStart =
        nk === 0 || newText[nk - 1] === " " || newText[nk - 1] === "\n";
      if (atWordStart && !(nk in out)) out[nk] = t;
    });
    return out;
  }

  // Non-space runs inside [a, b): one entry per word piece
  function wordSegments(text, a, b) {
    const segs = [];
    const end = Math.min(b, text.length);
    let i = Math.max(0, a);
    while (i < end) {
      while (i < end && /\s/.test(text[i])) i++;
      let j = i;
      while (j < end && !/\s/.test(text[j])) j++;
      if (j > i) segs.push([i, j]);
      i = j;
    }
    return segs;
  }

  // Make sure no highlight/underline covers a space or two words.
  // Anything that does is split into one per word.
  function normalizeAnnotations(list, text) {
    const out = [];
    (list || []).forEach((hl) => {
      const type = hl.type || "highlight";
      const segs = wordSegments(text, hl.startIdx, hl.endIdx);
      if (
        segs.length === 1 &&
        segs[0][0] === hl.startIdx &&
        segs[0][1] === hl.endIdx
      ) {
        out.push({
          ...hl,
          type,
          id: hl.id || "hl_" + Date.now() + "_" + out.length,
        });
        return;
      }
      segs.forEach(([a, b], i) => {
        out.push({
          ...hl,
          type,
          id: (hl.id || "hl") + "_" + i,
          startIdx: a,
          endIdx: b,
        });
      });
    });
    return out;
  }

  function applyLyricsEdit(e, newText) {
    const st = window.AppState;
    st.highlights = normalizeAnnotations(
      remapHighlights(st.highlights, e, newText.length),
      newText,
    );
    st.wordTimings = remapWordTimings(st.wordTimings, e, newText);

    // Highlight undo/redo snapshots must follow the text too, otherwise
    // undoing after an edit would bring back stale positions.
    const remapStack = (stack) =>
      (stack || []).map((str) =>
        JSON.stringify(
          normalizeAnnotations(
            remapHighlights(JSON.parse(str), e, newText.length),
            newText,
          ),
        ),
      );
    st.undoStack = remapStack(st.undoStack);
    st.redoStack = remapStack(st.redoStack);
  }

  lyricsInput.addEventListener("input", () => {
    const newText = lyricsInput.value;
    if (newText !== lastLyricsText) {
      const edit = computeTextEdit(
        lastLyricsText,
        newText,
        lyricsInput.selectionStart,
      );
      applyLyricsEdit(edit, newText);
      lastLyricsText = newText;
    }
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
    settingLineGap,
    settingTextDepth,
    settingBgImageEffect,
    settingBgBlur,
    settingBgDim,
  ].forEach((input) => {
    input.addEventListener("input", onSettingsChange);
  });


  // =====================================================================
  // CONFIGURE TOOL: every highlight/underline with its text, color and
  // start time. Tap one (list or preview) to open it and change its timing.
  // Times use the same clock as the timeline (0:00 = start of the trim).
  // =====================================================================
  function fmtHlTime(abs) {
    const rel = Math.max(0, abs - (AudioManager.trimStart || 0));
    const m = Math.floor(rel / 60);
    const sec = rel - m * 60;
    return m + ":" + sec.toFixed(2).padStart(5, "0");
  }
  function parseHlTime(str) {
    const t = String(str).trim().replace(",", ".");
    if (!t) return NaN;
    let rel;
    if (t.includes(":")) {
      const [mm, ss] = t.split(":");
      rel = parseFloat(mm) * 60 + parseFloat(ss);
    } else {
      rel = parseFloat(t);
    }
    return rel + (AudioManager.trimStart || 0);
  }

  function getHlInfo(hl, layout) {
    let line = null;
    let word = null;
    outer: for (const ln of layout.linesData) {
      for (const w of ln.wordRanges) {
        if (Math.max(hl.startIdx, w.startIdx) < Math.min(hl.endIdx, w.wordEndIdx)) {
          line = ln;
          word = w;
          break outer;
        }
      }
    }
    const manual = typeof hl.startTime === "number";
    const time = manual
      ? hl.startTime
      : line
        ? computeHlTime(hl, word, line, layout.rawMap)
        : hl.timestamp || 0;
    const onScreen = !!line && line.highlightBottom >= 0 && line.highlightTop <= canvas.height;
    return { time, manual, onScreen };
  }

  function refreshHlConfig(force) {
    if (window.AppState.highlightTool !== "configure") return;
    if (!force && hlConfigList.contains(document.activeElement)) return;

    const layout = getCurrentLayout();
    if (!layout) return;
    const text = lyricsInput.value;

    let items = window.AppState.highlights.map((hl) => ({
      hl,
      ...getHlInfo(hl, layout),
    }));
    const total = items.length;
    if (hlConfigFilter === "screen") items = items.filter((i) => i.onScreen);
    items.sort((a, b) => a.time - b.time);

    hlConfigCount.textContent =
      hlConfigFilter === "screen"
        ? items.length + " of " + total + " on screen"
        : total + (total === 1 ? " item" : " items");

    if (items.length === 0) {
      hlConfigList.innerHTML =
        '<div class="hl-empty">' +
        (total === 0
          ? "No highlights yet. Use the Highlight or Underline tool first."
          : "Nothing on screen right now. Scroll the preview or choose All.") +
        "</div>";
      return;
    }

    const sel = window.AppState.selectedHlId;
    hlConfigList.innerHTML = items
      .map(({ hl, time, manual }) => {
        const label = escapeHtml(text.slice(hl.startIdx, hl.endIdx));
        const type = hl.type === "underline" ? "underline" : "highlight";
        const open = hl.id === sel ? " open" : "";
        return `
        <div class="hl-item${open}" data-id="${escapeHtml(hl.id)}">
          <button type="button" class="hl-item-head">
            <span class="hl-dot ${type}" style="--c:${escapeHtml(hl.color)}"></span>
            <span class="hl-text">${label}</span>
            <span class="hl-time">${fmtHlTime(time)}${manual ? "<i>•</i>" : ""}</span>
          </button>
          <div class="hl-item-body">
            <div class="hl-meta">${type === "underline" ? "Underline" : "Highlight"} on “${label}” · ${manual ? "manual time" : "time from recording"}</div>
            <div class="hl-time-row">
              <button type="button" class="btn" data-act="nudge" data-d="-0.1">−0.1s</button>
              <input type="text" class="input-control hl-time-input" inputmode="decimal" value="${fmtHlTime(time)}" aria-label="Start time (m:ss.ss or seconds)">
              <button type="button" class="btn" data-act="nudge" data-d="0.1">+0.1s</button>
            </div>
            <div class="hl-row">
              <input type="color" class="hl-color" value="${escapeHtml(hl.color)}" title="Color">
              <button type="button" class="btn" data-act="goto">Go to</button>
              <button type="button" class="btn" data-act="play">Play</button>
            </div>
            <div class="hl-row">
              <button type="button" class="btn" data-act="reset" ${manual ? "" : "disabled"}>Use recorded time</button>
              <button type="button" class="btn danger-btn" data-act="delete">Delete</button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  function scheduleHlConfigRefresh() {
    if (hlConfigFilter !== "screen") return;
    if (window.AppState.highlightTool !== "configure") return;
    if (hlConfigTimer) return;
    hlConfigTimer = setTimeout(() => {
      hlConfigTimer = null;
      refreshHlConfig(false);
    }, 250);
  }

  function findHl(id) {
    return window.AppState.highlights.find((h) => h.id === id);
  }
  function effectiveHlTime(hl) {
    const layout = getCurrentLayout();
    return layout ? getHlInfo(hl, layout).time : hl.timestamp || 0;
  }

  function updateHlRow(hl) {
    const row = hlConfigList.querySelector('[data-id="' + hl.id.replace(/"/g, '\\"') + '"]');
    if (!row) return;
    const t = effectiveHlTime(hl);
    row.querySelector(".hl-time").innerHTML = fmtHlTime(t) + "<i>•</i>";
    row.querySelector(".hl-time-input").value = fmtHlTime(t);
    row.querySelector(".hl-meta").textContent =
      (hl.type === "underline" ? "Underline" : "Highlight") + " · manual time";
    const reset = row.querySelector('[data-act="reset"]');
    if (reset) reset.disabled = false;
  }

  function setHlTime(hl, absTime) {
    if (!isFinite(absTime)) return;
    let t = Math.max(0, absTime);
    const dur = AudioManager.audio.duration;
    if (isFinite(dur)) t = Math.min(t, dur);
    t = Math.round(t * 1000) / 1000;
    pushHighlightState();
    hl.startTime = t;
    triggerSave();
    updateHlRow(hl);
    requestRerender();
  }

  function selectHl(id, fromCanvas) {
    window.AppState.selectedHlId = window.AppState.selectedHlId === id && !fromCanvas ? null : id;
    refreshHlConfig(true);
    const hl = findHl(window.AppState.selectedHlId);
    if (hl) {
      const layout = getCurrentLayout();
      // opened from the list but not visible? jump to where it appears
      if (!fromCanvas && layout && !getHlInfo(hl, layout).onScreen) {
        jumpToKeyframe(effectiveHlTime(hl));
      }
      const row = hlConfigList.querySelector('[data-id="' + id.replace(/"/g, '\\"') + '"]');
      if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    requestRerender();
  }
  function selectHlFromCanvas(hl) {
    // the filter must not hide the thing you just tapped
    selectHl(hl.id, true);
  }

  hlFilterBtns.forEach((b) =>
    b.addEventListener("click", () => {
      hlConfigFilter = b.dataset.filter;
      hlFilterBtns.forEach((x) => x.classList.toggle("active", x === b));
      refreshHlConfig(true);
    }),
  );

  const previewBadge = document.getElementById("preview-badge");
  function startTempPreview() {
    window.AppState.tempPreview = true;
    if (previewBadge) previewBadge.style.display = "block";
    requestRerender();
  }
  function endTempPreview() {
    if (!window.AppState.tempPreview) return;
    window.AppState.tempPreview = false;
    if (previewBadge) previewBadge.style.display = "none";
    requestRerender();
  }
  // playback stopped (pause, jump, or end of song) -> back to the editing view
  AudioManager.audio.addEventListener("pause", () => {
    if (AudioManager.audio.paused) endTempPreview();
  });
  AudioManager.audio.addEventListener("ended", endTempPreview);
  // keep the Play button and the render loop in step with the real audio state
  // (song ended / trim end reached / paused by anything else)
  AudioManager.audio.addEventListener("pause", () => {
    btnPlay.textContent = "▶";
    stopPlaybackLoop();
  });

  let hlColorBurst = false;
  hlConfigList.addEventListener("click", (e) => {
    const row = e.target.closest(".hl-item");
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest(".hl-item-head")) {
      selectHl(id, false);
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    const hl = findHl(id);
    if (!hl) return;

    switch (btn.dataset.act) {
      case "nudge":
        setHlTime(hl, effectiveHlTime(hl) + parseFloat(btn.dataset.d));
        break;
      case "goto":
        jumpToKeyframe(effectiveHlTime(hl));
        break;
      case "play": {
        if (btnPlay.disabled) break;
        jumpToKeyframe(Math.max(AudioManager.trimStart || 0, effectiveHlTime(hl) - 1));
        btnPlay.click();
        // play it like the final video (highlights appear at their times);
        // editing view comes back as soon as playback stops
        if (!AudioManager.audio.paused && window.AppState.isHighlightMode) startTempPreview();
        break;
      }
      case "reset":
        pushHighlightState();
        delete hl.startTime;
        triggerSave();
        refreshHlConfig(true);
        requestRerender();
        break;
      case "delete":
        pushHighlightState();
        window.AppState.highlights = window.AppState.highlights.filter((h) => h.id !== id);
        if (window.AppState.selectedHlId === id) window.AppState.selectedHlId = null;
        triggerSave();
        refreshHlConfig(true);
        requestRerender();
        break;
    }
  });

  hlConfigList.addEventListener("change", (e) => {
    const row = e.target.closest(".hl-item");
    if (!row) return;
    const hl = findHl(row.dataset.id);
    if (!hl) return;

    if (e.target.classList.contains("hl-time-input")) {
      const t = parseHlTime(e.target.value);
      if (isNaN(t)) {
        e.target.value = fmtHlTime(effectiveHlTime(hl)); // not a time: put it back
      } else {
        setHlTime(hl, t);
      }
    } else if (e.target.classList.contains("hl-color")) {
      hlColorBurst = false;
      hl.color = e.target.value;
      triggerSave();
      refreshHlConfig(true);
      requestRerender();
    }
  });
  hlConfigList.addEventListener("input", (e) => {
    if (!e.target.classList.contains("hl-color")) return;
    const hl = findHl(e.target.closest(".hl-item").dataset.id);
    if (!hl) return;
    if (!hlColorBurst) {
      pushHighlightState(); // one undo step for the whole color drag
      hlColorBurst = true;
    }
    hl.color = e.target.value;
    const dot = e.target.closest(".hl-item").querySelector(".hl-dot");
    if (dot) dot.style.setProperty("--c", hl.color);
    requestRerender();
  });
  hlConfigList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("hl-time-input")) e.target.blur();
  });


  // =====================================================================
  // FONT PICKER: every font shown in its own style, using your own lyrics
  // as the sample text. Upload .ttf/.otf/.woff files to add your own.
  // =====================================================================
  function fontPreviewText() {
    const first =
      (lyricsInput.value || "")
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) || "Rhyme Studio";
    return first.split(/\s+/).slice(0, 2).join(" ").slice(0, 16);
  }
  function findFontEntry(value) {
    return StyleKit.allFonts().find((f) => f.value === value);
  }
  function markActiveFontCard() {
    fontList.querySelectorAll(".font-card").forEach((c) =>
      c.classList.toggle("active", c.dataset.value === settingFont.value),
    );
  }
  function updateFontButton() {
    const f = findFontEntry(settingFont.value);
    fontPickerName.textContent = f
      ? f.label
      : settingFont.value.split(",")[0].replace(/['"]/g, "");
    fontPickerSample.style.fontFamily = settingFont.value;
    fontPickerSample.style.fontWeight = f ? f.weight : "bold";
    if (!fontPickerPanel.hidden) markActiveFontCard();
  }

  function renderFontList() {
    const sample = fontPreviewText();
    const fonts = StyleKit.allFonts();
    const ordered = fonts.filter((f) => f.custom).concat(fonts.filter((f) => !f.custom));
    fontList.innerHTML = "";
    let group = null;
    ordered.forEach((f) => {
      if (f.group !== group) {
        group = f.group;
        const t = document.createElement("div");
        t.className = "font-group-title";
        t.textContent = group;
        fontList.appendChild(t);
      }
      const card = document.createElement("button");
      card.type = "button";
      card.className = "font-card";
      card.dataset.value = f.value;

      const smp = document.createElement("span");
      smp.className = "font-sample";
      smp.textContent = sample;
      smp.style.fontFamily = f.value;
      smp.style.fontWeight = f.weight;

      const name = document.createElement("span");
      name.className = "font-name";
      name.textContent = f.label;

      card.append(smp, name);
      if (f.custom) {
        const del = document.createElement("span");
        del.className = "font-del";
        del.dataset.id = f.id;
        del.title = "Remove this font";
        del.textContent = "×";
        card.appendChild(del);
      }
      fontList.appendChild(card);
    });
    markActiveFontCard();
    checkFontAvailability();
  }

  // Fonts that didn't load (offline / blocked / not on this device) get a tag,
  // so a fallback is never mistaken for the real thing.
  async function checkFontAvailability() {
    const sample = fontPreviewText();
    const fonts = StyleKit.allFonts();
    await Promise.allSettled(
      fonts.map((f) =>
        document.fonts.load(StyleKit.fontString({ fontFamily: f.value }, 24), sample),
      ),
    );
    let missingWeb = 0;
    fontList.querySelectorAll(".font-card").forEach((card) => {
      const f = fonts.find((x) => x.value === card.dataset.value);
      if (!f) return;
      const missing = !StyleKit.isFontAvailable(f.value);
      card.classList.toggle("unavailable", missing);
      const nameEl = card.querySelector(".font-name");
      nameEl.querySelectorAll(".font-tag").forEach((t) => t.remove());
      if (missing) {
        const tag = document.createElement("span");
        tag.className = "font-tag";
        tag.textContent = f.group === "Classic" ? "not installed" : "not loaded";
        nameEl.appendChild(tag);
        if (f.group !== "Classic") missingWeb++;
      }
    });
    if (googleFontsFailed || missingWeb > 0) {
      fontNotice.style.display = "block";
      fontNotice.textContent =
        "Fonts tagged below aren't available here, so they show a fallback. Online fonts need internet access (and a browser that allows Google Fonts); Classic fonts depend on what your device has installed. You can upload your own .ttf at the bottom.";
    } else {
      fontNotice.style.display = "none";
    }
  }

  // --- Style tab dropdowns (Font, Text, Layout, Background, Highlight) ---
  // One group open at a time. Their headers ignore touches while the panel is
  // scrolling (see the scroll lock below), so scrolling can't open/close them.
  const accSections = Array.from(document.querySelectorAll("#tab-settings .acc"));
  function setAccOpen(sec, open) {
    const head = sec.querySelector(".acc-head");
    const body = sec.querySelector(".acc-body");
    head.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
    if (open && sec.dataset.acc === "font") {
      renderFontList();
      const active = fontList.querySelector(".font-card.active");
      if (active) active.scrollIntoView({ block: "nearest" });
    }
  }
  accSections.forEach((sec) => {
    sec.querySelector(".acc-head").addEventListener("click", () => {
      const open = sec.querySelector(".acc-body").hidden; // closed now -> open it
      accSections.forEach((o) => {
        if (o !== sec) setAccOpen(o, false);
      });
      setAccOpen(sec, open);
      if (open) requestAnimationFrame(() => sec.scrollIntoView({ block: "start", behavior: "smooth" }));
    });
  });

  // short live summary on each dropdown header
  function updateStyleSummaries() {
    const $ = (id) => document.getElementById(id);
    const label = (grid) => {
      const el = grid && grid.querySelector(".chip.active span");
      return el ? el.textContent.trim() : "";
    };
    const set = (id, txt) => {
      const el = $(id);
      if (el && el.textContent !== txt) el.textContent = txt;
    };
    const align = settingAlign.value || "center";
    const bg = settingBgColor.value || "";
    set("sum-text", settingFontSize.value + "px · " + (label(textStyleGrid) || "Flat"));
    set(
      "sum-layout",
      settingMarginLeft.value + "% / " + settingMarginRight.value + "% · " +
        align.charAt(0).toUpperCase() + align.slice(1),
    );
    set("sum-bg", label(bgGrid) || (/^#/.test(bg) ? "Custom " + bg.toUpperCase() : "Background"));
    set("sum-hl", label(hlStyleGrid) || "Solid");
  }

  // --- Scroll lock: while a panel scrolls (and ~0.2s after, i.e. momentum),
  // its controls ignore touches. A finger landing to stop the scroll can't
  // toggle a dropdown, pick a style or nudge a slider by accident.
  document.querySelectorAll(".tab-content").forEach((panel) => {
    let t = null;
    panel.addEventListener(
      "scroll",
      () => {
        panel.classList.add("is-scrolling");
        clearTimeout(t);
        t = setTimeout(() => panel.classList.remove("is-scrolling"), 200);
      },
      { passive: true, capture: true }, // capture: also hears the font list scrolling
    );
  });

  fontList.addEventListener("click", async (e) => {
    const del = e.target.closest(".font-del");
    if (del) {
      e.stopPropagation();
      if (!confirm("Remove this font from your library?")) return;
      const current = findFontEntry(settingFont.value);
      await StyleKit.removeCustomFont(del.dataset.id);
      if (current && current.id === del.dataset.id) settingFont.value = "Impact, sans-serif";
      renderFontList();
      onSettingsChange();
      return;
    }
    const card = e.target.closest(".font-card");
    if (!card) return;
    settingFont.value = card.dataset.value;
    onSettingsChange(); // saves, loads the font and redraws the preview
  });

  fontFileInput.multiple = true;
  btnUploadFont.addEventListener("click", () => fontFileInput.click());
  fontFileInput.addEventListener("change", async () => {
    const files = Array.from(fontFileInput.files || []);
    fontFileInput.value = "";
    let last = null;
    for (const file of files) {
      try {
        last = await StyleKit.importFontFile(file);
        if (last.sessionOnly) {
          alert('"' + file.name + '" works for now but your browser wouldn\'t store it, so you\'ll need to upload it again next time.');
        }
      } catch (err) {
        alert('"' + file.name + '" isn\'t a usable font file. Use .ttf, .otf, .woff or .woff2.');
      }
    }
    if (last) settingFont.value = last.value;
    renderFontList();
    onSettingsChange();
  });

  // bring back fonts uploaded earlier, then redraw (a project may use one)
  StyleKit.loadSavedFonts().then(() => {
    updateFontButton();
    if (!fontPickerPanel.hidden) renderFontList();
    requestRerender();
  });

  // --- Style pickers (visual chips) ---
  try {
    const gfLink = document.createElement("link");
    gfLink.rel = "stylesheet";
    gfLink.href = StyleKit.GOOGLE_FONTS_URL;
    gfLink.onload = () => {
      StyleKit.ensureFont({ fontFamily: settingFont.value }).then(() => {
        renderTextThumbs();
        requestRerender();
        if (!fontPickerPanel.hidden) renderFontList();
      });
    };
    gfLink.onerror = () => {
      googleFontsFailed = true;
      if (!fontPickerPanel.hidden) renderFontList();
    };
    document.head.appendChild(gfLink);


    StyleKit.buildChipGrid(bgGrid, StyleKit.BG_PRESETS, (item) => {
      if (item.id === "image" && !currentBgImage) {
        bgImageInput.click(); // nothing picked yet: choose a photo first
        return;
      }
      settingBgColor.value = item.id;
      onSettingsChange();
    });
    StyleKit.buildChipGrid(textStyleGrid, StyleKit.TEXT_STYLES, (item) => {
      settingTextStyle.value = item.id;
      onSettingsChange();
    });
    StyleKit.buildChipGrid(hlStyleGrid, StyleKit.HL_STYLES, (item) => {
      settingHlStyle.value = item.id;
      onSettingsChange();
    });
    renderBgThumbs();
    renderTextThumbs();
    renderHlThumbs();

    bgCustomColor.addEventListener("input", () => {
      settingBgColor.value = bgCustomColor.value;
      onSettingsChange();
    });

    btnBgImagePick.addEventListener("click", () => bgImageInput.click());
    bgImageInput.addEventListener("change", async () => {
      const file = bgImageInput.files && bgImageInput.files[0];
      if (!file) return;
      try {
        currentBgImage = await StyleKit.fileToDataURL(file, 1600, 0.82);
      } catch (err) {
        alert("Couldn't read that image. Try a JPG or PNG.");
        bgImageInput.value = "";
        return;
      }
      bgImageInput.value = "";
      settingBgColor.value = "image";
      renderBgThumbs();
      onSettingsChange();
    });
    btnBgImageRemove.addEventListener("click", () => {
      currentBgImage = "";
      settingBgColor.value = "matte-black";
      renderBgThumbs();
      onSettingsChange();
    });

    updateStyleSummaries();
  } catch (err) {
    console.error("Style tab failed to initialise:", err);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }


  // --- UI polish: filled sliders + keyboard shortcuts (desktop) ---
  const paintRanges = () => {
    document.querySelectorAll('input[type="range"]').forEach((r) => {
      const min = parseFloat(r.min) || 0;
      const max = parseFloat(r.max) || 100;
      const val = parseFloat(r.value) || 0;
      const p = max > min ? ((val - min) / (max - min)) * 100 : 0;
      const txt = p.toFixed(1) + "%";
      if (r.style.getPropertyValue("--p") !== txt) r.style.setProperty("--p", txt);
    });
  };
  setInterval(paintRanges, 100);
  paintRanges();

  document.addEventListener("keydown", (e) => {
    if (!editorScreen.classList.contains("active")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    const typing =
      el &&
      (el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        (el.tagName === "INPUT" && el.type !== "range" && el.type !== "checkbox"));
    if (typing) return;

    if (e.code === "Space") {
      e.preventDefault();
      if (!btnPlay.disabled) btnPlay.click();
    } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      if (btnPlay.disabled) return;
      e.preventDefault();
      const sec = (e.shiftKey ? 5 : 1) * (e.code === "ArrowLeft" ? -1 : 1);
      window.AppState.manualScrollY = 0;
      AudioManager.skip(sec);
    }
  });

  showDashboard();
});
