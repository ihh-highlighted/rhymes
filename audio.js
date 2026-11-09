// audio.js
//
// PLAYBACK ENGINE
// ---------------
// Playback used to go through a plain <audio> element. Seeking such an element
// (currentTime = x) is NOT sample-accurate for many MP3/M4A files: the browser
// jumps to the nearest frame/packet or estimates the position from the bitrate,
// so after a rewind / skip / "Go to" the music could sit a fraction of a second
// to several seconds away from the time the app *thought* it was at. Highlights
// and scrolling are driven by that reported time, so they drifted from the music.
//
// Now the song is decoded once into an AudioBuffer (the same buffer the exporter
// uses) and played through an AudioBufferSourceNode. Every seek starts the
// source at the exact requested sample, and the clock is the audio hardware clock
// (AudioContext.currentTime), so the music and the timings can't drift apart.
//
// BufferPlayer exposes the same small surface the rest of the app already uses
// on an <audio> element (currentTime, duration, paused, play, pause,
// addEventListener) so main.js keeps working unchanged.
const BufferPlayer = {
  ctx: null,
  destNode: null,
  buffer: null,
  _offset: 0,        // song position (s) while paused / where the source was started
  _startedAt: 0,     // ctx.currentTime when the current source started
  _source: null,
  _playing: false,
  _timer: null,
  _listeners: {},

  get duration() {
    return this.buffer ? this.buffer.duration : NaN;
  },
  get paused() {
    return !this._playing;
  },
  get currentTime() {
    if (!this.buffer) return 0;
    let t = this._offset;
    if (this._playing) t += this.ctx.currentTime - this._startedAt;
    return Math.min(Math.max(0, t), this.buffer.duration);
  },
  set currentTime(v) {
    if (!this.buffer) return;
    const t = Math.min(Math.max(0, Number(v) || 0), this.buffer.duration);
    if (this._playing) this._startSource(t); // re-start exactly at t
    else this._offset = t;
  },

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  },
  _emit(type) {
    (this._listeners[type] || []).slice().forEach((fn) => {
      try { fn({ type }); } catch (e) { console.error(e); }
    });
  },

  setBuffer(buf) {
    this._hardStop();
    this.buffer = buf;
    this._offset = 0;
  },

  unload() {
    const wasPlaying = this._playing;
    this._hardStop();
    this.buffer = null;
    this._offset = 0;
    if (wasPlaying) this._emit('pause');
  },

  _killSource() {
    if (!this._source) return;
    try { this._source.onended = null; this._source.stop(); } catch (e) {}
    try { this._source.disconnect(); } catch (e) {}
    this._source = null;
  },

  _startSource(at) {
    this._killSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.ctx.destination);
    if (this.destNode) src.connect(this.destNode);
    this._offset = at;
    this._startedAt = this.ctx.currentTime;
    src.start(0, at);
    this._source = src;
  },

  _hardStop() {
    this._playing = false;
    this._killSource();
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  play() {
    if (!this.buffer || this._playing) return Promise.resolve();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    let at = this._offset;
    if (at >= this.buffer.duration - 0.001) at = 0;
    this._playing = true;
    this._startSource(at);
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), 25);
    this._emit('play');
    return Promise.resolve();
  },

  pause() {
    if (!this._playing) return;
    const t = this.currentTime; // read before the playing flag changes
    this._hardStop();
    this._offset = t;
    this._emit('pause');
  },

  _lastTU: 0,
  getLimit: null, // set by AudioManager: the trim end (s)

  _tick() {
    if (!this._playing) return;
    if (this.currentTime >= this.buffer.duration - 0.001) {
      this._hardStop();
      this._offset = this.buffer.duration;
      this._emit('pause');
      this._emit('ended');
      return;
    }
    // Like a real <audio> element, report ~4x per second (the render loop draws
    // the frames); but react immediately when the trim end is reached.
    const now = performance.now();
    const lim = this.getLimit ? this.getLimit() : 0;
    if ((lim > 0 && this.currentTime >= lim) || now - this._lastTU >= 250) {
      this._lastTU = now;
      this._emit('timeupdate');
    }
  },
};

const AudioManager = {
  audio: BufferPlayer,
  audioContext: null,
  audioDestinationNode: null,
  rawAudioBuffer: null, // decoded song: used for playback AND for audio export
  audioFile: null,
  isPlaying: false,
  trimStart: 0,
  trimEnd: 0,
  onTimeUpdateCallback: null,
  _loadToken: 0,

  init(onTimeUpdate) {
    this.onTimeUpdateCallback = onTimeUpdate;
    this.audio.getLimit = () => this.trimEnd;

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
      if (this.onTimeUpdateCallback) this.onTimeUpdateCallback();
    });
  },

  // One shared AudioContext for the whole app (phones only allow a few).
  ensureContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      // kept for the real-time recorder fallback: a stream of what is playing
      try {
        this.audioDestinationNode = this.audioContext.createMediaStreamDestination();
      } catch (e) {
        this.audioDestinationNode = null;
      }
      this.audio.ctx = this.audioContext;
      this.audio.destNode = this.audioDestinationNode;
    }
    return this.audioContext;
  },

  setupWebAudioNodes() {
    this.ensureContext();
  },

  loadAudio(file, savedTrimStart = 0, savedTrimEnd = 0, callback, onError) {
    this.audioFile = file;
    this.rawAudioBuffer = null; // never export the previous song's audio
    this.audio.unload();
    this.isPlaying = false;

    const token = ++this._loadToken;
    const fail = () => {
      if (token !== this._loadToken) return;
      this.audioFile = null;
      if (onError) onError();
    };

    let ctx;
    try {
      ctx = this.ensureContext();
    } catch (err) {
      fail();
      return;
    }

    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = (e) => {
      const done = (buf) => {
        if (token !== this._loadToken) return; // a newer file was picked meanwhile
        this.rawAudioBuffer = buf;
        this.audio.setBuffer(buf);

        const dur = buf.duration;
        this.trimStart = savedTrimStart || 0;
        this.trimEnd =
          savedTrimEnd > 0 && savedTrimEnd <= dur ? savedTrimEnd : dur;

        this.audio.currentTime = this.trimStart;
        if (callback) callback(dur, this.trimStart, this.trimEnd);
      };
      try {
        // callback form works on old Safari too; the promise it also returns is ignored
        const p = ctx.decodeAudioData(e.target.result, done, fail);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (err) {
        console.warn('Audio decode failed:', err);
        fail();
      }
    };
    reader.readAsArrayBuffer(file);
  },

  play() {
    this.ensureContext();
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (this.audio.currentTime < this.trimStart || (this.trimEnd > 0 && this.audio.currentTime >= this.trimEnd)) {
      this.audio.currentTime = this.trimStart;
    }
    this.audio.play();
    this.isPlaying = !this.audio.paused;
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

  // Jump to an absolute song time (used by fullscreen "restart")
  seekTo(time) {
    const maxEnd = this.trimEnd > 0 ? this.trimEnd : this.audio.duration;
    let t = Math.max(this.trimStart, time || 0);
    if (isFinite(maxEnd)) t = Math.min(t, maxEnd);
    this.audio.currentTime = t;
    if (this.onTimeUpdateCallback) this.onTimeUpdateCallback();
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