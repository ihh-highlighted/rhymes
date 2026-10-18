// storage.js

// wordTimings is a map { wordStartIndex: seconds }. Older saves stored it as a
// (sparse) array, and the old loader threw away any object-shaped value, so
// timings were lost on reload. Always normalize to a plain object.
function normalizeWordTimings(wt) {
  const out = {};
  if (wt && typeof wt === 'object') {
    Object.keys(wt).forEach(k => {
      const v = wt[k];
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
    });
  }
  return out;
}

const StorageManager = {
  getProjects() {
    const data = localStorage.getItem(window.APP_CONFIG.STORAGE_KEY);
    if (!data) return [];

    try {
      const projects = JSON.parse(data);
      if (!Array.isArray(projects)) throw new Error('projects is not a list');
      return projects.map(proj => ({
        ...proj,
        keyframes: Array.isArray(proj.keyframes) ? proj.keyframes : [{ id: 'kf_0', time: 0, scrollY: 0 }],
        timings: Array.isArray(proj.timings) ? proj.timings : [],
        wordTimings: normalizeWordTimings(proj.wordTimings),
        recordingModeData: proj.recordingModeData || null
      }));
    } catch (e) {
      console.error('Failed to parse projects from localStorage:', e);
      // keep a copy so a bad read can never silently wipe your work
      try {
        localStorage.setItem(window.APP_CONFIG.STORAGE_KEY + '_corrupt_backup', data);
      } catch (err) { /* storage full: nothing more we can do */ }
      return [];
    }
  },

  getProject(id) {
    const projects = this.getProjects();
    return projects.find(p => p.id === id) || null;
  },

  saveProjects(projects) {
    try {
      localStorage.setItem(window.APP_CONFIG.STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      console.error('Could not save projects:', err);
      if (!this._quotaWarned) {
        this._quotaWarned = true;
        alert('Browser storage is full, so your latest changes were NOT saved. Try a smaller background image, remove the background image, or delete old projects.');
      }
      return false;
    }
  },

  createProject(title) {
    const projects = this.getProjects();
    const newProject = {
      id: 'proj_' + Date.now(),
      title: title || 'Untitled Rhyme',
      lyrics: 'Check the rhymes step by step!\nTrim audio, set diamond keyframes, and scroll smoothly.',
      settings: { ...window.APP_CONFIG.DEFAULT_SETTINGS },
      trimStart: 0,
      trimEnd: 0,
      keyframes: [
        { id: 'kf_0', time: 0, scrollY: 0 }
      ],
      timings: [],             // Line/section timings
      wordTimings: {},         // Individual word-level timings { startIndex: seconds }
      recordingModeData: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projects.unshift(newProject);
    this.saveProjects(projects);
    return newProject;
  },

  updateProject(id, updatedFields) {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      this.saveProjects(projects);
      return projects[index];
    }
    return null;
  },

  saveRecordingTimings(id, timings = [], wordTimings = []) {
    return this.updateProject(id, {
      timings: Array.isArray(timings) ? timings : [],
      wordTimings: normalizeWordTimings(wordTimings)
    });
  },

  deleteProject(id) {
    let projects = this.getProjects();
    projects = projects.filter(p => p.id !== id);
    this.saveProjects(projects);
  },

  // ==========================================
  // EXPORT & IMPORT FEATURES
  // ==========================================

  exportProject(id) {
    const project = this.getProject(id);
    if (!project) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    const sanitizedTitle = (project.title || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedTitle}.json`;

    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importProject(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const project = JSON.parse(event.target.result);

          // Structural validation check
          if (!project || typeof project !== 'object' || !project.lyrics) {
            throw new Error("Invalid project file structure.");
          }

          // Generate fresh ID to prevent overwriting existing projects
          const importedProject = {
            ...project,
            id: 'proj_' + Date.now(),
            title: project.title ? `${project.title} (Imported)` : 'Imported Rhyme',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const projects = this.getProjects();
          projects.unshift(importedProject);
          this.saveProjects(projects);

          resolve(importedProject);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }
};