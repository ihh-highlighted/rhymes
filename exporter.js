// exporter.js

// ---------------------------------------------------------------------
// SimpleMp4: tiny built-in MP4 writer (H.264 video + optional AAC audio).
// Writes a normal "fast-start" MP4: header with the real duration first,
// constant frame rate, interleaved samples. No external library needed.
// ---------------------------------------------------------------------
const SimpleMp4 = (() => {
  const te = new TextEncoder();
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const u16 = (n) => [(n >>> 8) & 255, n & 255];

  function concat(parts) {
    let len = 0;
    const arrs = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
    arrs.forEach((a) => (len += a.length));
    const out = new Uint8Array(len);
    let o = 0;
    arrs.forEach((a) => {
      out.set(a, o);
      o += a.length;
    });
    return out;
  }
  function box(type, parts) {
    const body = concat(parts);
    const out = new Uint8Array(8 + body.length);
    new DataView(out.buffer).setUint32(0, out.length);
    out.set(te.encode(type), 4);
    out.set(body, 8);
    return out;
  }
  function fullBox(type, version, flags, parts) {
    return box(type, [[version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts]);
  }
  function u32list(list) {
    const out = new Uint8Array(list.length * 4);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < list.length; i++) dv.setUint32(i * 4, list[i] >>> 0);
    return out;
  }
  const MATRIX = [].concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));

  function rle(values) {
    const out = [];
    for (let i = 0; i < values.length; ) {
      let j = i;
      while (j < values.length && values[j] === values[i]) j++;
      out.push([j - i, values[i]]);
      i = j;
    }
    return out;
  }

  function descLen(n) {
    return n < 128 ? [n] : [0x80 | (n >> 7), n & 127];
  }
  function esds(asc, channels) {
    const dsi = [0x05, ...descLen(asc.length), ...asc];
    const dcd = [0x04, ...descLen(13 + dsi.length), 0x40, 0x15, 0, 0, 0, ...u32(0), ...u32(0), ...dsi];
    const slc = [0x06, 0x01, 0x02];
    const es = [0x03, ...descLen(3 + dcd.length + slc.length), 0, 0, 0, ...dcd, ...slc];
    return fullBox('esds', 0, 0, [es]);
  }

  class Track {
    constructor(kind, timescale) {
      this.kind = kind;
      this.timescale = timescale;
      this.samples = []; // {data, dur, key, time(sec)}
      this.description = null;
      this.sampleRate = 0;
      this.channels = 0;
    }
    get durationTicks() {
      return this.samples.reduce((a, s) => a + s.dur, 0);
    }
  }

  class Writer {
    constructor(opts) {
      this.width = opts.width;
      this.height = opts.height;
      this.fps = opts.fps;
      this.video = new Track('video', 90000);
      this.audio = null;
      this._vTs = []; // video timestamps (us), turned into durations at finalize
    }

    addVideo(data, isKey, timestampUs, description) {
      if (description && !this.video.description) this.video.description = description;
      this.video.samples.push({ data, dur: 0, key: !!isKey, time: timestampUs / 1e6 });
      this._vTs.push(timestampUs);
    }

    addAudio(data, timestampUs, durationUs, cfg) {
      if (!this.audio) {
        this.audio = new Track('audio', cfg.sampleRate);
        this.audio.sampleRate = cfg.sampleRate;
        this.audio.channels = cfg.channels;
        this.audio.description = cfg.description;
      }
      const dur = Math.max(1, Math.round((durationUs * cfg.sampleRate) / 1e6));
      this.audio.samples.push({ data, dur, key: true, time: timestampUs / 1e6 });
    }

    hasVideo() {
      return this.video.samples.length > 0 && !!this.video.description;
    }

    _videoDurations() {
      const ts = this._vTs.map((t) => Math.round((t * 90000) / 1e6));
      const samples = this.video.samples;
      for (let i = 0; i < samples.length; i++) {
        samples[i].dur = i + 1 < samples.length ? Math.max(1, ts[i + 1] - ts[i]) : (i > 0 ? samples[i - 1].dur : Math.round(90000 / this.fps));
      }
    }

    _stbl(track, offsets) {
      const n = track.samples.length;
      let entry;
      if (track.kind === 'video') {
        const avcC = box('avcC', [new Uint8Array(track.description)]);
        entry = box('avc1', [
          [0, 0, 0, 0, 0, 0, 0, 1], // reserved + data_reference_index
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // pre_defined / reserved
          u16(this.width), u16(this.height),
          u32(0x00480000), u32(0x00480000), u32(0), u16(1),
          new Array(32).fill(0), // compressor name
          u16(0x0018), u16(0xffff),
          avcC,
        ]);
      } else {
        entry = box('mp4a', [
          [0, 0, 0, 0, 0, 0, 0, 1],
          [0, 0, 0, 0, 0, 0, 0, 0], // version, revision, vendor
          u16(track.channels), u16(16), u16(0), u16(0),
          u32(track.sampleRate * 65536 > 0xffffffff ? 0 : track.sampleRate * 65536),
          esds(new Uint8Array(track.description), track.channels),
        ]);
      }
      const stsd = fullBox('stsd', 0, 0, [u32(1), entry]);

      const runs = rle(track.samples.map((s) => s.dur));
      const sttsParts = [u32(runs.length)];
      runs.forEach(([c, d]) => sttsParts.push(u32(c), u32(d)));
      const stts = fullBox('stts', 0, 0, sttsParts);

      const parts = [stsd, stts];
      if (track.kind === 'video') {
        const keys = [];
        track.samples.forEach((s, i) => s.key && keys.push(i + 1));
        parts.push(fullBox('stss', 0, 0, [u32(keys.length), u32list(keys)]));
      }
      parts.push(fullBox('stsc', 0, 0, [u32(1), u32(1), u32(1), u32(1)])); // one sample per chunk
      parts.push(fullBox('stsz', 0, 0, [u32(0), u32(n), u32list(track.samples.map((s) => s.data.length))]));
      parts.push(fullBox('stco', 0, 0, [u32(n), u32list(offsets)]));
      return box('stbl', parts);
    }

    _trak(track, id, offsets) {
      const durMovie = Math.round((track.durationTicks / track.timescale) * 1000);
      const isVideo = track.kind === 'video';
      const tkhd = fullBox('tkhd', 0, 3, [
        u32(0), u32(0), u32(id), u32(0), u32(durMovie),
        [0, 0, 0, 0, 0, 0, 0, 0],
        u16(0), u16(0), u16(isVideo ? 0 : 0x0100), u16(0),
        MATRIX,
        u32(isVideo ? this.width * 65536 : 0), u32(isVideo ? this.height * 65536 : 0),
      ]);
      const mdhd = fullBox('mdhd', 0, 0, [u32(0), u32(0), u32(track.timescale), u32(track.durationTicks), u16(0x55c4), u16(0)]);
      const hdlr = fullBox('hdlr', 0, 0, [
        u32(0), te.encode(isVideo ? 'vide' : 'soun'), u32(0), u32(0), u32(0),
        te.encode(isVideo ? 'VideoHandler\0' : 'SoundHandler\0'),
      ]);
      const mediaHeader = isVideo
        ? fullBox('vmhd', 0, 1, [u16(0), u16(0), u16(0), u16(0)])
        : fullBox('smhd', 0, 0, [u16(0), u16(0)]);
      const dinf = box('dinf', [fullBox('dref', 0, 0, [u32(1), fullBox('url ', 0, 1, [])])]);
      const minf = box('minf', [mediaHeader, dinf, this._stbl(track, offsets)]);
      const mdia = box('mdia', [mdhd, hdlr, minf]);
      return box('trak', [tkhd, mdia]);
    }

    _moov(offsetsV, offsetsA) {
      const vDur = Math.round((this.video.durationTicks / this.video.timescale) * 1000);
      const aDur = this.audio ? Math.round((this.audio.durationTicks / this.audio.timescale) * 1000) : 0;
      const mvhd = fullBox('mvhd', 0, 0, [
        u32(0), u32(0), u32(1000), u32(Math.max(vDur, aDur)),
        u32(0x00010000), u16(0x0100), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        MATRIX,
        new Array(24).fill(0),
        u32(this.audio ? 3 : 2),
      ]);
      const traks = [this._trak(this.video, 1, offsetsV)];
      if (this.audio) traks.push(this._trak(this.audio, 2, offsetsA));
      return box('moov', [mvhd, ...traks]);
    }

    // Returns a Blob containing the finished .mp4
    finalize() {
      if (!this.hasVideo()) throw new Error('No video was encoded.');
      this._videoDurations();

      const ftyp = box('ftyp', [te.encode('isom'), u32(512), te.encode('isom'), te.encode('iso2'), te.encode('avc1'), te.encode('mp41')]);

      // interleave video/audio samples by time so editors can stream the file
      const order = [];
      this.video.samples.forEach((s, i) => order.push({ t: s.time, tr: 0, i }));
      if (this.audio) this.audio.samples.forEach((s, i) => order.push({ t: s.time, tr: 1, i }));
      order.sort((a, b) => a.t - b.t || a.tr - b.tr);

      const zeroV = new Array(this.video.samples.length).fill(0);
      const zeroA = this.audio ? new Array(this.audio.samples.length).fill(0) : [];
      const moovSize = this._moov(zeroV, zeroA).length; // sizes don't depend on offset values

      let pos = ftyp.length + moovSize + 8;
      const offV = new Array(this.video.samples.length);
      const offA = this.audio ? new Array(this.audio.samples.length) : [];
      const dataParts = [];
      order.forEach((o) => {
        const smp = o.tr === 0 ? this.video.samples[o.i] : this.audio.samples[o.i];
        (o.tr === 0 ? offV : offA)[o.i] = pos;
        pos += smp.data.length;
        dataParts.push(smp.data);
      });

      const moov = this._moov(offV, offA);
      const mdatHeader = new Uint8Array(8);
      new DataView(mdatHeader.buffer).setUint32(0, pos - (ftyp.length + moov.length));
      mdatHeader.set(te.encode('mdat'), 4);

      return new Blob([ftyp, moov, mdatHeader, ...dataParts], { type: 'video/mp4' });
    }
  }

  return { Writer };
})();

const ExportManager = {
  isExporting: false,
  mediaRecorder: null,
  recordedChunks: [],

  getResolutionDimensions(resolution) {
    switch (resolution) {
      case '1080p': return { width: 1920, height: 1080 };
      case '720p': return { width: 1280, height: 720 };
      case '480p': return { width: 854, height: 480 };
      default: return { width: 1920, height: 1080 };
    }
  },

  // Calculate exact preview duration matching project trim settings
  getExportDuration(project) {
    const start = AudioManager.trimStart || 0;
    let end = AudioManager.trimEnd;
    if (!end || end <= start) {
      if (typeof AudioManager.getEffectiveDuration === 'function' && AudioManager.getEffectiveDuration() > 0) {
        end = start + AudioManager.getEffectiveDuration();
      } else if (project && project.duration) {
        end = project.duration;
      } else {
        end = start + 10;
      }
    }
    return {
      start,
      end,
      duration: Math.max(0.1, end - start)
    };
  },

  // Get mobile editor-friendly MIME type (Prefers MP4 for Alight Motion / VN Editor)
  getSupportedMimeType() {
    const types = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  },

  // ---------------------------------------------------------------
  // WebCodecs exporter: frame-by-frame (not real-time), constant frame rate,
  // real duration in the header, AAC audio inside. Opens in CapCut / Alight.
  // If the device's encoder misbehaves it automatically falls back to the
  // older real-time recorder instead of getting stuck.
  // ---------------------------------------------------------------
  cancelled: false,

  supportsWebCodecs() {
    return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
  },

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },

  // Promise.race with a timeout
  _withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(label + ' timed out')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  },

  // Find a video encoder config that REALLY produces output on this device
  // (some phones say "supported" and then never deliver a single frame).
  async findWorkingVideoConfig(width, height, fps, bitrate) {
    const codecs = ['avc1.64002A', 'avc1.640028', 'avc1.4D0028', 'avc1.42E028', 'avc1.42E01F'];
    const accels = ['no-preference', 'prefer-software'];
    let stalls = 0;
    for (const accel of accels) {
      for (const codec of codecs) {
        const cfg = {
          codec, width, height, bitrate, framerate: fps,
          hardwareAcceleration: accel,
          avc: { format: 'avc' },
        };
        try {
          const sup = await VideoEncoder.isConfigSupported(cfg);
          if (!sup.supported) continue;
          const r = await this._probeVideoConfig(cfg);
          if (r === 'ok') return cfg;
          if (r === 'stall' && ++stalls >= 2) return null; // encoder just hangs: stop wasting time
        } catch (e) { /* try next */ }
      }
    }
    return null;
  },

  // returns 'ok' | 'fail' | 'stall'
  async _probeVideoConfig(cfg) {
    let enc = null;
    try {
      let outputs = 0;
      let failed = false;
      enc = new VideoEncoder({
        output: () => { outputs++; },
        error: () => { failed = true; }
      });
      enc.configure(cfg);
      const c = document.createElement('canvas');
      c.width = cfg.width;
      c.height = cfg.height;
      const x = c.getContext('2d');
      for (let i = 0; i < 3; i++) {
        x.fillStyle = i % 2 ? '#222' : '#ddd';
        x.fillRect(0, 0, c.width, c.height);
        const f = new VideoFrame(c, { timestamp: i * 33333, duration: 33333 });
        enc.encode(f, { keyFrame: i === 0 });
        f.close();
      }
      try {
        await this._withTimeout(enc.flush(), 2500, 'encoder probe');
      } catch (e) {
        return failed ? 'fail' : 'stall';
      }
      return !failed && outputs > 0 ? 'ok' : 'fail';
    } catch (e) {
      return 'fail';
    } finally {
      try { if (enc && enc.state !== 'closed') enc.close(); } catch (e) {}
    }
  },

  async pickAudioConfig(sampleRate, channels) {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
    const cfg = { codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 128000 };
    try {
      const res = await AudioEncoder.isConfigSupported(cfg);
      return res.supported ? cfg : null;
    } catch (e) { return null; }
  },

  async exportVideo(options, project, renderFunction, onProgress, onComplete, onError, onStatus) {
    if (this.isExporting) return;

    const status = (msg) => { if (onStatus) onStatus(msg); };

    if (!this.supportsWebCodecs()) {
      return this.exportVideoLegacy(options, project, renderFunction, onProgress, onComplete, onError, onStatus);
    }

    this.isExporting = true;
    this.cancelled = false;
    const fps = parseInt(options.fps, 10) || 30;

    try {
      status('Preparing encoder...');
      if (onProgress) onProgress(0);
      await this._sleep(30); // let the screen show "0%" / the message

      const blob = await this._exportWithWebCodecs(options, project, renderFunction, onProgress, status, fps);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project.title || 'video').replace(/\s+/g, '_')}_${options.resolution}_${fps}fps.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      if (onProgress) onProgress(100);
      this.isExporting = false;
      if (onComplete) onComplete();
    } catch (err) {
      this.isExporting = false;
      if (err && err.message === '__cancelled__') return;

      if (err && err.fallback) {
        // This device's encoder can't be used: use the real-time recorder instead
        console.warn('WebCodecs export unavailable, falling back:', err.message);
        status('Compatibility mode (real-time)...');
        return this.exportVideoLegacy(options, project, renderFunction, onProgress, onComplete, onError, onStatus);
      }
      console.error(err);
      if (onError) onError((err && err.message) || 'Export failed.');
    }
  },

  // Throws {fallback:true} when the encoder can't be used at all
  async _exportWithWebCodecs(options, project, renderFunction, onProgress, status, fps) {
    const fallback = (msg) => { const e = new Error(msg); e.fallback = true; return e; };

    const dims = this.getResolutionDimensions(options.resolution);
    const bitrate = dims.width >= 1920 ? 8_000_000 : dims.width >= 1280 ? 5_000_000 : 2_500_000;
    const timeInfo = this.getExportDuration(project);

    const videoCfg = await this.findWorkingVideoConfig(dims.width, dims.height, fps, bitrate);
    if (!videoCfg) throw fallback('No working H.264 encoder found');

    const canvas = document.createElement('canvas');
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    const mp4 = new SimpleMp4.Writer({ width: dims.width, height: dims.height, fps });

    let encoderError = null;
    let lastOutputAt = performance.now();
    let videoOutputs = 0;

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        lastOutputAt = performance.now();
        videoOutputs++;
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const desc = meta && meta.decoderConfig && meta.decoderConfig.description;
        mp4.addVideo(data, chunk.type === 'key', chunk.timestamp, desc ? new Uint8Array(desc.buffer ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc) : null);
      },
      error: (e) => { encoderError = e; }
    });
    let audioEncoder = null;

    try {
      videoEncoder.configure(videoCfg);

      // ---- audio setup (optional) ----
      const buf = AudioManager.rawAudioBuffer;
      const channels = buf ? Math.min(2, buf.numberOfChannels) : 0;
      const audioCfg = buf ? await this.pickAudioConfig(buf.sampleRate, channels) : null;
      const audioCodecCfg = audioCfg ? { sampleRate: buf.sampleRate, channels } : null;
      if (audioCfg) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            let desc = meta && meta.decoderConfig && meta.decoderConfig.description;
            if (desc) desc = new Uint8Array(desc.buffer ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc);
            if (!mp4.audio && !desc) {
              // build the 2-byte AAC-LC AudioSpecificConfig ourselves
              const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
              const idx = Math.max(0, rates.indexOf(audioCodecCfg.sampleRate));
              desc = new Uint8Array([(2 << 3) | (idx >> 1), ((idx & 1) << 7) | (audioCodecCfg.channels << 3)]);
            }
            mp4.addAudio(data, chunk.timestamp, chunk.duration || Math.round((1024 / audioCodecCfg.sampleRate) * 1e6), { ...audioCodecCfg, description: desc });
          },
          error: () => { /* audio is optional: video still finishes */ }
        });
        try {
          audioEncoder.configure(audioCfg);
        } catch (e) {
          audioEncoder = null;
        }
      }

      status(`Exporting Video (${options.resolution} @ ${fps}fps)...`);

      // ---- VIDEO: deterministic frame loop ----
      const totalFrames = Math.max(1, Math.round(timeInfo.duration * fps));
      const frameDurUs = 1e6 / fps;
      const keyEvery = fps * 2;

      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) throw new Error('__cancelled__');
        if (encoderError) throw fallback('Encoder error: ' + (encoderError.message || encoderError));

        const t = timeInfo.start + i / fps;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, dims.width, dims.height);
        renderFunction(ctx, dims.width, dims.height, t, true);

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(i * frameDurUs),
          duration: Math.round(frameDurUs)
        });
        videoEncoder.encode(frame, { keyFrame: i % keyEvery === 0 });
        frame.close();

        // Backpressure (phones run out of memory otherwise) + stall detection
        let waitStart = performance.now();
        while (videoEncoder.encodeQueueSize > 6) {
          if (this.cancelled) throw new Error('__cancelled__');
          if (encoderError) throw fallback('Encoder error');
          if (performance.now() - Math.max(waitStart, lastOutputAt) > 12000) {
            throw fallback('Encoder stalled');
          }
          await this._sleep(4);
        }

        if (i % 3 === 0) {
          if (onProgress) onProgress((i / totalFrames) * (audioEncoder ? 92 : 98));
          await this._sleep(0); // let the UI repaint
        }
        // very first frames must produce output soon, or this encoder is broken
        if (i === 12 && videoOutputs === 0) {
          await this._sleep(3000);
          if (videoOutputs === 0) throw fallback('Encoder produced no output');
        }
      }
      await this._withTimeout(videoEncoder.flush(), 30000, 'video flush').catch(() => { throw fallback('Encoder flush failed'); });

      // ---- AUDIO (never blocks the video) ----
      if (audioEncoder) {
        try {
          const sr = buf.sampleRate;
          const startSample = Math.floor(timeInfo.start * sr);
          const endSample = Math.min(buf.length, startSample + Math.round(timeInfo.duration * sr));
          const CHUNK = 4096;
          const chData = [];
          for (let c = 0; c < channels; c++) chData.push(buf.getChannelData(c));

          for (let pos = startSample; pos < endSample; pos += CHUNK) {
            if (this.cancelled) throw new Error('__cancelled__');
            const n = Math.min(CHUNK, endSample - pos);
            const planar = new Float32Array(n * channels);
            for (let c = 0; c < channels; c++) planar.set(chData[c].subarray(pos, pos + n), c * n);
            const ad = new AudioData({
              format: 'f32-planar',
              sampleRate: sr,
              numberOfFrames: n,
              numberOfChannels: channels,
              timestamp: Math.round(((pos - startSample) / sr) * 1e6),
              data: planar
            });
            audioEncoder.encode(ad);
            ad.close();
            let w0 = performance.now();
            while (audioEncoder.encodeQueueSize > 20) {
              if (performance.now() - w0 > 8000) throw new Error('audio stalled');
              await this._sleep(4);
            }
          }
          await this._withTimeout(audioEncoder.flush(), 15000, 'audio flush');
        } catch (e) {
          if (e && e.message === '__cancelled__') throw e;
          console.warn('Audio encoding failed, exporting without sound:', e);
          mp4.audio = null; // drop partial audio so the file stays valid
        }
      }

      if (!mp4.audio) {
        status('Note: this device could not encode audio. Export the WAV and add it in your editor.');
      }
      return mp4.finalize();
    } finally {
      try { if (videoEncoder.state !== 'closed') videoEncoder.close(); } catch (e) {}
      try { if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close(); } catch (e) {}
    }
  },

  // Old real-time MediaRecorder exporter (fallback only)
  exportVideoLegacy(options, project, renderFunction, onProgress, onComplete, onError, onStatus) {
    if (this.isExporting) return;
    this.isExporting = true;
    if (onStatus) onStatus(`Exporting Video (${options.resolution} @ ${options.fps}fps, real-time)...`);

    const fps = parseInt(options.fps, 10) || 30;
    const dims = this.getResolutionDimensions(options.resolution);

    // Offscreen Canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = dims.width;
    exportCanvas.height = dims.height;
    const exportCtx = exportCanvas.getContext('2d', { alpha: false });

    // Stream captured at target FPS
    const canvasStream = exportCanvas.captureStream(fps);

    const mimeType = this.getSupportedMimeType();
    const targetBitrate = dims.width >= 1920 ? 8000000 : 4000000;

    try {
      this.mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: mimeType,
        videoBitsPerSecond: targetBitrate
      });
    } catch (e) {
      this.isExporting = false;
      if (onError) onError('MediaRecorder initialization failed.');
      return;
    }

    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    const timeInfo = this.getExportDuration(project);
    const targetDurationMs = Math.round(timeInfo.duration * 1000);

    this.mediaRecorder.onstop = async () => {
      this.isExporting = false;

      const rawBlob = new Blob(this.recordedChunks, { type: mimeType });
      
      // Patch duration metadata into WebM files if needed
      let finalBlob = rawBlob;
      if (mimeType.includes('webm')) {
        finalBlob = await this.patchWebmDuration(rawBlob, targetDurationMs);
      }

      const url = URL.createObjectURL(finalBlob);
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project.title || 'video').replace(/\s+/g, '_')}_${options.resolution}_${fps}fps.${ext}`;
      a.click();

      if (onComplete) onComplete();
    };

    // Start recorder
    this.mediaRecorder.start(1000);

    const startTime = performance.now();

    // Real-time animation frame loop to guarantee exact duration & no slow-motion
    const fail = (err) => {
      console.error(err);
      this.isExporting = false;
      try { if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') { this.mediaRecorder.onstop = null; this.mediaRecorder.stop(); } } catch (e) {}
      if (onError) onError((err && err.message) || 'Export failed.');
    };

    const renderLoop = () => {
      if (!this.isExporting) return;
      try {
        renderStep();
      } catch (err) {
        fail(err);
      }
    };

    const renderStep = () => {

      const elapsedMs = performance.now() - startTime;
      const progress = Math.min(100, Math.max(0, (elapsedMs / targetDurationMs) * 100));

      if (elapsedMs >= targetDurationMs) {
        // Render final frame exactly at clip end time
        exportCtx.fillStyle = '#000000';
        exportCtx.fillRect(0, 0, dims.width, dims.height);
        renderFunction(exportCtx, dims.width, dims.height, timeInfo.end, true);

        if (onProgress) onProgress(100);
        this.mediaRecorder.stop();
        return;
      }

      // Sync virtual time 1:1 with real-world clock
      const virtualTime = timeInfo.start + (elapsedMs / 1000);

      exportCtx.fillStyle = '#000000';
      exportCtx.fillRect(0, 0, dims.width, dims.height);
      renderFunction(exportCtx, dims.width, dims.height, virtualTime, true);

      if (onProgress) onProgress(progress);

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  },

  // --- EBML DURATION HEADER PATCHER FOR WEBM ---
  async patchWebmDuration(blob, durationMs) {
    try {
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);

      // Search for Segment Info Box (0x1549A966)
      let infoPos = -1;
      for (let i = 0; i < view.byteLength - 4; i++) {
        if (view.getUint32(i) === 0x1549A966) {
          infoPos = i;
          break;
        }
      }

      if (infoPos === -1) return blob;

      // Search for Duration tag (0x4489)
      let durationPos = -1;
      for (let i = infoPos; i < Math.min(view.byteLength - 4, infoPos + 150); i++) {
        if (view.getUint16(i) === 0x4489) {
          durationPos = i;
          break;
        }
      }

      if (durationPos !== -1) {
        const patchedBuffer = buffer.slice(0);
        const patchedView = new DataView(patchedBuffer);
        const dataSize = patchedView.getUint8(durationPos + 2);

        if (dataSize === 8) {
          patchedView.setFloat64(durationPos + 3, durationMs, false);
          return new Blob([patchedBuffer], { type: blob.type });
        } else if (dataSize === 4) {
          patchedView.setFloat32(durationPos + 3, durationMs, false);
          return new Blob([patchedBuffer], { type: blob.type });
        }
      }
    } catch (err) {
      console.warn('Duration header patching skipped:', err);
    }
    return blob;
  },

  exportAudioWav(project, onComplete) {
    if (!AudioManager.rawAudioBuffer) {
      alert('Audio not fully decoded yet. Please wait a moment and try again.');
      return;
    }

    const timeInfo = this.getExportDuration(project);
    const buffer = AudioManager.rawAudioBuffer;
    const startSample = Math.floor(timeInfo.start * buffer.sampleRate);
    const endSample = Math.min(buffer.length, Math.floor(timeInfo.end * buffer.sampleRate));
    const frameCount = Math.max(1, endSample - startSample);

    const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, frameCount, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0, timeInfo.start, timeInfo.duration);

    offlineCtx.startRendering().then(renderedBuffer => {
      const wavBlob = this.bufferToWave(renderedBuffer, frameCount);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project.title || 'lyrics').replace(/\s+/g, '_')}_audio.wav`;
      a.click();
      if (onComplete) onComplete();
    });
  },

  cancelExport() {
    this.cancelled = true;
    if (this.isExporting) {
      this.isExporting = false;
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      AudioManager.pause();
    }
  },

  bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4);

    for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while (offset < len) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }
};