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

    // Listen for fullscreen change events (e.g. ESC key pressed).
    // Only the preview container counts: the whole app may be fullscreen too
    // (see AppFullscreen below) and that must not turn on the preview gestures.
    const onChange = () => {
      const wasPreview = this.isFullscreen;
      this.isFullscreen = this._fsElement() === this.container;
      this.toggleFullscreenClass();
      // leaving the preview fullscreen: go back to the app being fullscreen
      if (wasPreview && !this.isFullscreen) AppFullscreen.afterPreviewExit();
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);

    // Handle double-tap gestures inside the fullscreen container
    this.container.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
  },

  /**
   * Toggle Fullscreen Mode
   */
  _fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  },

  async toggleFullScreen() {
    try {
      if (this._fsElement() === this.container) {
        // preview is fullscreen -> leave it
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      } else if (this.container.requestFullscreen) {
        // remember whether the whole app was fullscreen, to go back to it afterwards
        AppFullscreen.resume = this._fsElement() === document.documentElement;
        // works even if the whole app is already fullscreen
        await this.container.requestFullscreen();
      } else if (this.container.webkitRequestFullscreen) {
        await this.container.webkitRequestFullscreen();
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

/**
 * AppFullscreen: makes the whole app fill the screen so the browser's address
 * bar / toolbars get out of the way.
 *  - Android / desktop browsers: goes fullscreen on the first tap (browsers
 *    only allow this from a user gesture). The button in the top bar toggles it.
 *  - Installed as an app ("Add to Home Screen" / "Install app"): the manifest
 *    already opens it fullscreen, so nothing needs to be done.
 *  - iPhone Safari has no fullscreen API for web pages: use Add to Home Screen.
 */
const AppFullscreen = {
  PREF_KEY: 'rs_app_fullscreen', // '0' = the user switched it off
  armed: true,
  resume: false, // the app was fullscreen before the preview went fullscreen

  get supported() {
    const d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen);
  },
  get active() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },
  get installed() {
    try {
      return (
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
      );
    } catch (e) {
      return false;
    }
  },
  get wanted() {
    try { return localStorage.getItem(this.PREF_KEY) !== '0'; } catch (e) { return true; }
  },
  setWanted(v) {
    try { localStorage.setItem(this.PREF_KEY, v ? '1' : '0'); } catch (e) {}
  },

  async enter() {
    if (!this.supported || this.active) return;
    const d = document.documentElement;
    try {
      if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
      else d.webkitRequestFullscreen();
    } catch (e) {
      /* needs a user gesture; we'll try again on the next tap */
    }
  },
  async exit() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  },
  toggle() {
    if (this.active) {
      this.setWanted(false); // the user chose to leave: don't pull them back in
      this.exit();
    } else {
      this.setWanted(true);
      this.enter();
    }
  },

  // called when the preview's own fullscreen closes
  afterPreviewExit() {
    if (!this.resume || !this.wanted || this.installed) return;
    this.resume = false;
    this.armed = true;
    this.enter(); // works when the exit came from a tap; otherwise the next tap does it
  },

  init() {
    const buttons = document.querySelectorAll('.app-fs-btn');
    const showButtons = this.supported && !this.installed;
    buttons.forEach((b) => {
      b.hidden = !showButtons;
      b.addEventListener('click', () => this.toggle());
    });
    if (!this.supported || this.installed) return;

    // first tap on a touch device -> fullscreen
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      document.addEventListener(
        'pointerup',
        () => {
          if (!this.armed || this.active || !this.wanted) return;
          this.armed = false;
          this.enter();
        },
        true,
      );
    }

    const sync = () => {
      buttons.forEach((b) => {
        b.classList.toggle('is-on', this.active);
        b.title = this.active ? 'Exit full screen' : 'Full screen (hide browser bars)';
      });
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
  },
};

document.addEventListener('DOMContentLoaded', () => AppFullscreen.init());
