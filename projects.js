let currentProjectId = null;

const projectsView = document.getElementById('projectsView');
const editorView = document.getElementById('editorView');
const projectsList = document.getElementById('projectsList');
const currentProjectTitle = document.getElementById('currentProjectTitle');

// Helper to get all projects safely
function getProjects() {
  if (typeof getAllProjectsFromStorage === 'function') {
    return getAllProjectsFromStorage();
  }
  const data = localStorage.getItem('lyric_projects');
  return data ? JSON.parse(data) : [];
}

// Render the list of projects
function renderProjectsList() {
  const projects = getProjects();
  projectsList.innerHTML = '';

  if (projects.length === 0) {
    projectsList.innerHTML = '<p style="color: #666; text-align: center; margin-top: 20px;">No projects yet. Tap "+ New Project" to start!</p>';
    return;
  }

  projects.forEach(project => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <span class="project-card-title">${project.name || 'Untitled Project'}</span>
      <div class="project-card-actions">
        <button class="delete-btn" data-id="${project.id}">Delete</button>
      </div>
    `;

    // Open project on click
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return; // Ignore delete clicks
      openProject(project.id);
    });

    // Handle delete button
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${project.name || 'this project'}"?`)) {
        deleteProject(project.id);
        renderProjectsList();
      }
    });

    projectsList.appendChild(card);
  });
}

// Delete project helper
function deleteProject(id) {
  let projects = getProjects();
  projects = projects.filter(p => p.id !== id);
  localStorage.setItem('lyric_projects', JSON.stringify(projects));
}

// Open Editor with specific project
function openProject(id) {
  const projects = getProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return;

  currentProjectId = project.id;
  if (currentProjectTitle) {
    currentProjectTitle.textContent = project.name || 'Untitled Project';
  }

  // Restore session using our comprehensive storage restorer if available
  if (typeof restoreProjectSession === 'function') {
    restoreProjectSession(project);
  } else {
    if (lyricsInput) lyricsInput.value = project.lyrics || '';
    if (project.wordsData && project.wordsData.length > 0) {
      wordsData = project.wordsData;
    } else {
      wordsData = [];
    }
    if (typeof layoutText === 'function') layoutText();
  }

  // Switch Views
  if (projectsView) projectsView.classList.add('hidden');
  if (editorView) editorView.classList.remove('hidden');
}

// Create New Project Button
const newProjectBtn = document.getElementById('newProjectBtn');
if (newProjectBtn) {
  newProjectBtn.addEventListener('click', () => {
    const name = prompt('Enter project name:', 'New Song Rhymes');
    if (name && name.trim() !== '') {
      const newId = 'proj_' + Date.now();
      const newProject = {
        id: newId,
        name: name.trim(),
        lyrics: '',
        highlightsData: [],
        canvasConfig: typeof canvasConfig !== 'undefined' ? canvasConfig : {},
        keyframes: [{ time: 0, scrollY: 0 }],
        lastSaved: Date.now()
      };

      if (typeof saveProjectToStorage === 'function') {
        saveProjectToStorage(newProject);
      } else {
        const projects = getProjects();
        projects.push(newProject);
        localStorage.setItem('lyric_projects', JSON.stringify(projects));
      }

      openProject(newId);
    }
  });
}

// Back to Projects Screen Button
const backToProjectsBtn = document.getElementById('backToProjectsBtn');
if (backToProjectsBtn) {
  backToProjectsBtn.addEventListener('click', () => {
    // Save current project state before leaving
    if (currentProjectId && typeof autoSaveCurrentProject === 'function') {
      autoSaveCurrentProject();
    }

    if (editorView) editorView.classList.add('hidden');
    if (projectsView) projectsView.classList.remove('hidden');
    renderProjectsList();
  });
}

// Initial load
renderProjectsList();