// exporter.js
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

  exportVideo(options, project, renderFunction, onProgress, onComplete, onError) {
    if (this.isExporting) return;
    this.isExporting = true;

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
    const renderLoop = () => {
      if (!this.isExporting) return;

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