const THEMES = ['light', 'dark', 'eink'];

function normalizeTheme(theme) {
  return THEMES.includes(theme) ? theme : 'light';
}

export function getNextTheme(currentTheme) {
  const normalized = normalizeTheme(currentTheme);
  const currentIndex = THEMES.indexOf(normalized);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  return THEMES[nextIndex];
}

export function applyThemeFromState(state) {
  const theme = normalizeTheme(state.theme);
  state.theme = theme;

  const body = document.body;

  body.classList.remove('dark-theme', 'eink-theme');
  if (theme === 'dark') {
    body.classList.add('dark-theme');
  } else if (theme === 'eink') {
    body.classList.add('eink-theme');
  }

  body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  return theme;
}
