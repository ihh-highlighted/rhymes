// audio.js
const AudioManager = {
  audio: new Audio(),
  audioContext: null,
  mediaSourceNode: null,
  audioDestinationNode: null,
  rawAudioBuffer: null, // Stored for WAV export
  audioFile: null,
  isPlaying: false,
  trimStart: 0,
  trimEnd: 0,
  onTimeUpdateCallback: null,

  init(onTimeUpdate) {
    this.onTimeUpdateCallback = onTimeUpdate;

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.currentTime < this.trimStart) {
        this.audio.currentTime = this.trimStart;
      }
      if (this.trimEnd > 0 && this.audio.currentTime >= this.trimEnd) {
        this.pause();
        this.audio.currentTime = this.trimStart;
      }

      if (this.onTimeUpdateCallback) this.onTimeUpdateCallback();
    });

    this.audio.addEventListener('ended', () => {
      this.pause();
      this.audio.currentTime = this.trimStart;
    });
  },

  setupWebAudioNodes() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.audioDestinationNode = this.audioContext.createMediaStreamDestination();
      
      this.mediaSourceNode.connect(this.audioContext.destination);
      this.mediaSourceNode.connect(this.audioDestinationNode);
    }
  },

  loadAudio(file, savedTrimStart = 0, savedTrimEnd = 0, callback, onError) {
    this.audioFile = file;
    this.rawAudioBuffer = null; // never export the previous song's audio

    if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
    const url = URL.createObjectURL(file);
    this._objectUrl = url;

    this.audio.pause();
    this.isPlaying = false;

    // handlers first, then the source (so no event can be missed)
    this.audio.onloadedmetadata = () => {
      this.trimStart = savedTrimStart || 0;
      this.trimEnd = (savedTrimEnd > 0 && savedTrimEnd <= this.audio.duration)
        ? savedTrimEnd
        : this.audio.duration;

      this.audio.currentTime = this.trimStart;
      if (callback) callback(this.audio.duration, this.trimStart, this.trimEnd);
    };
    this.audio.onerror = () => {
      if (onError) onError();
    };

    this.audio.src = url;
    this.audio.load();

    // Decode a copy for audio export. One short-lived context per file, then closed
    // (phones only allow a handful of live AudioContexts).
    const reader = new FileReader();
    reader.onload = (e) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      let ctx;
      try {
        ctx = new AudioCtx();
        ctx.decodeAudioData(
          e.target.result,
          (buf) => {
            this.rawAudioBuffer = buf;
            if (ctx.close) ctx.close();
          },
          (err) => {
            console.warn('Could not decode audio for export:', err);
            if (ctx.close) ctx.close();
          },
        );
      } catch (err) {
        console.warn('Audio decode unavailable:', err);
        if (ctx && ctx.close) ctx.close();
      }
    };
    reader.readAsArrayBuffer(file);
  },

  play() {
    this.setupWebAudioNodes();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (this.audio.currentTime < this.trimStart || (this.trimEnd > 0 && this.audio.currentTime >= this.trimEnd)) {
      this.audio.currentTime = this.trimStart;
    }
    this.audio.play();
    this.isPlaying = true;
  },

  pause() {
    this.audio.pause();
    this.isPlaying = false;
  },

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
    return this.isPlaying;
  },

  skip(seconds) {
    if (!this.audio.duration) return;
    let target = this.audio.currentTime + seconds;
    const maxEnd = this.trimEnd > 0 ? this.trimEnd : this.audio.duration;
    if (target < this.trimStart) target = this.trimStart;
    if (target > maxEnd) target = maxEnd;

    this.audio.currentTime = target;
    if (this.onTimeUpdateCallback) this.onTimeUpdateCallback();
  },

  setTrim(start, end) {
    const maxDuration = this.audio.duration || 0;
    this.trimStart = Math.max(0, Math.min(start, maxDuration));
    this.trimEnd = Math.max(this.trimStart + 0.5, Math.min(end, maxDuration));

    if (this.audio.currentTime < this.trimStart || this.audio.currentTime > this.trimEnd) {
      this.audio.currentTime = this.trimStart;
    }

    if (this.onTimeUpdateCallback) this.onTimeUpdateCallback();
  },

  getEffectiveDuration() {
    if (!this.audio.duration) return 1;
    const end = this.trimEnd > 0 ? this.trimEnd : this.audio.duration;
    return Math.max(0.1, end - this.trimStart);
  },

  getRelativeCurrentTime() {
    return Math.max(0, this.audio.currentTime - this.trimStart);
  },

  seekRelativePercent(percent) {
    if (!this.audio.duration) return;
    const effectiveDur = this.getEffectiveDuration();
    this.audio.currentTime = this.trimStart + (percent / 100) * effectiveDur;
  },

  renderKeyframeBar(container, keyframes, onClick, activeTime) {
    const effectiveDur = this.getEffectiveDuration();

    // Only rebuild the DOM when keyframes/trim actually changed. Rebuilding
    // every frame during playback would swallow taps on the diamonds.
    const sig = keyframes.map(k => `${k.time}`).join('|') + `#${this.trimStart}#${effectiveDur}`;
    if (container._kfSig !== sig) {
      container._kfSig = sig;
      container.innerHTML = '';

      keyframes.forEach(kf => {
        const relativeTime = kf.time - this.trimStart;
        const percent = (relativeTime / effectiveDur) * 100;

        if (percent >= 0 && percent <= 100) {
          const diamond = document.createElement('div');
          diamond.className = 'kf-diamond';
          diamond.style.left = `${percent}%`;
          diamond.dataset.time = kf.time;
          diamond.title = `Keyframe at ${this.formatTime(kf.time)} - tap to jump`;
          diamond.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onClick) onClick(parseFloat(diamond.dataset.time));
          });
          container.appendChild(diamond);
        }
      });
    }

    // Highlight the diamond at the playhead
    container.querySelectorAll('.kf-diamond').forEach(d => {
      const isActive = activeTime !== undefined &&
        Math.abs(parseFloat(d.dataset.time) - activeTime) < 0.12;
      d.classList.toggle('active', isActive);
    });
  },

  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};