// global.js
window.APP_CONFIG = {
  CANVAS_WIDTH: 1920,
  CANVAS_HEIGHT: 1080,
  ASPECT_RATIO: 16 / 9,
  STORAGE_KEY: 'genius_rhymes_projects',
  
  DEFAULT_SETTINGS: {
    fontFamily: 'Impact, sans-serif',
    fontSize: 70,
    textColor: '#FFFF00',
    bgColor: '#121212',
    marginLeftPercent: 15,
    marginRightPercent: 15,
    textAlign: 'center',
    lineHeight: 1.4
  }
};

window.AppState = {
  currentProject: null,
  projects: [],
  manualScrollY: 0,
  keyframes: [],
  isFreeRoam: false,
  
  // Highlight System State
  highlights: [],
  selectedHighlightColor: '#FF007F', // Default Pink
  isHighlightMode: false,
  undoStack: [],
  redoStack: []
};

// Add to global.js inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.querySelector('.preview-container');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const playBtn = document.getElementById('btn-play');

  if (previewContainer && typeof FullScreenManager !== 'undefined') {
    FullScreenManager.init(previewContainer, {
      onTogglePlayPause: () => {
        // Trigger play/pause by clicking your existing play button
        if (playBtn) playBtn.click();
      },
      onRestart: () => {
        // Seek back to start trim time
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.seekTo === 'function') {
          const start = AudioManager.trimStart || 0;
          AudioManager.seekTo(start);
        }
      }
    });
  }

  // Bind the fullscreen button click event
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (typeof FullScreenManager !== 'undefined') {
        FullScreenManager.toggleFullScreen();
      }
    });
  }
});