// fullscreen.js
const FullScreenManager = {
  container: null,
  isFullscreen: false,
  lastTapTime: 0,
  lastTapX: 0,
  tapThresholdMs: 300, // Maximum delay between clicks to register as double-tap

  /**
   * Initialize Fullscreen Manager on a given DOM element (e.g., canvas container or main preview wrapper)
   * @param {HTMLElement} containerElement 
   * @param {Object} controls - Methods to control editor playback
   * @param {Function} controls.onTogglePlayPause - Function to start/pause video
   * @param {Function} controls.onRestart - Function to restart video from beginning
   */
  init(containerElement, controls) {
    this.container = containerElement;
    this.controls = controls;

    // Listen for fullscreen change events (e.g. ESC key pressed)
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      this.toggleFullscreenClass();
    });

    // Handle double-tap gestures inside the fullscreen container
    this.container.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
  },

  /**
   * Toggle Fullscreen Mode
   */
  async toggleFullScreen() {
    try {
      if (!document.fullscreenElement) {
        if (this.container.requestFullscreen) {
          await this.container.requestFullscreen();
        } else if (this.container.webkitRequestFullscreen) {
          await this.container.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  },

  /**
   * Detect double-tap and calculate zone (Left, Middle, Right)
   */
  handlePointerDown(e) {
    if (!this.isFullscreen) return;

    const currentTime = performance.now();
    const timeDiff = currentTime - this.lastTapTime;
    const clientX = e.clientX;

    // Check if the interaction qualifies as a double-tap
    if (timeDiff < this.tapThresholdMs && Math.abs(clientX - this.lastTapX) < 50) {
      e.preventDefault();
      
      const width = window.innerWidth;
      const zoneWidth = width / 3;

      if (clientX < zoneWidth) {
        // --- LEFT ZONE: Restart from beginning ---
        this.showGestureFeedback('Restarting...', 'left');
        if (typeof this.controls.onRestart === 'function') {
          this.controls.onRestart();
        }
      } else if (clientX >= zoneWidth && clientX < zoneWidth * 2) {
        // --- MIDDLE ZONE: Toggle Start / Pause ---
        this.showGestureFeedback('Play / Pause', 'center');
        if (typeof this.controls.onTogglePlayPause === 'function') {
          this.controls.onTogglePlayPause();
        }
      } else {
        // --- RIGHT ZONE: Exit Full Screen ---
        this.showGestureFeedback('Exiting Fullscreen', 'right');
        this.toggleFullScreen();
      }

      // Reset timer to prevent triple-taps triggering back-to-back
      this.lastTapTime = 0;
    } else {
      this.lastTapTime = currentTime;
      this.lastTapX = clientX;
    }
  },

  /**
   * Toggle CSS styling during full screen mode
   */
  toggleFullscreenClass() {
    if (this.isFullscreen) {
      this.container.classList.add('in-fullscreen');
    } else {
      this.container.classList.remove('in-fullscreen');
    }
  },

  /**
   * Optional visual ripple indicator when a double tap succeeds
   */
  showGestureFeedback(text, position) {
    const toast = document.createElement('div');
    toast.className = `gesture-toast gesture-${position}`;
    toast.textContent = text;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 600);
  }
};