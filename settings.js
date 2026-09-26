// Default Canvas Style Config
let canvasConfig = {
  fontSize: 42,
  fontFamily: 'sans-serif',
  bgColor: '#0a0a0a',
  textColor: '#ffffff',
  textAlign: 'left',
  marginStart: 5,  // Percentage (0% to 50%)
  marginEnd: 5     // Percentage (0% to 50%)
};

// DOM Listeners for Margins
const marginStartSlider = document.getElementById('marginStartSlider');
const marginEndSlider = document.getElementById('marginEndSlider');
const marginStartValue = document.getElementById('marginStartValue');
const marginEndValue = document.getElementById('marginEndValue');

if (marginStartSlider) {
  marginStartSlider.addEventListener('input', (e) => {
    canvasConfig.marginStart = parseFloat(e.target.value);
    if (marginStartValue) marginStartValue.textContent = `${canvasConfig.marginStart}%`;
    if (typeof layoutText === 'function') layoutText();
  });
}

if (marginEndSlider) {
  marginEndSlider.addEventListener('input', (e) => {
    canvasConfig.marginEnd = parseFloat(e.target.value);
    if (marginEndValue) marginEndValue.textContent = `${canvasConfig.marginEnd}%`;
    if (typeof layoutText === 'function') layoutText();
  });
}

// UI Elements
const tabEditorBtn = document.getElementById('tabEditorBtn');
const tabSettingsBtn = document.getElementById('tabSettingsBtn');
const canvasTab = document.getElementById('canvasTab');
const settingsTab = document.getElementById('settingsTab');

const fontFamilySelect = document.getElementById('fontFamilySelect');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeVal = document.getElementById('fontSizeVal');
const bgColorPicker = document.getElementById('bgColorPicker');
const textColorPicker = document.getElementById('textColorPicker');

// Tab Switching
tabEditorBtn.addEventListener('click', () => {
  tabEditorBtn.classList.add('active');
  tabSettingsBtn.classList.remove('active');
  canvasTab.classList.remove('hidden');
  settingsTab.classList.add('hidden');
});

tabSettingsBtn.addEventListener('click', () => {
  tabSettingsBtn.classList.add('active');
  tabEditorBtn.classList.remove('active');
  settingsTab.classList.remove('hidden');
  canvasTab.classList.add('hidden');
});

// Settings Handlers
fontFamilySelect.addEventListener('change', (e) => {
  canvasConfig.fontFamily = e.target.value;
  layoutText();
});

fontSizeSlider.addEventListener('input', (e) => {
  canvasConfig.fontSize = parseInt(e.target.value);
  fontSizeVal.textContent = e.target.value;
  layoutText();
});

document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    canvasConfig.textAlign = btn.dataset.align;
    layoutText();
  });
});

bgColorPicker.addEventListener('input', (e) => {
  canvasConfig.bgColor = e.target.value;
  renderCanvas();
});

textColorPicker.addEventListener('input', (e) => {
  canvasConfig.textColor = e.target.value;
  renderCanvas();
});