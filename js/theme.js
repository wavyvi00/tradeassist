// ============================================================
// Theme Module — Dark/Light Mode with localStorage persistence
// ============================================================

const STORAGE_KEY = 'tradehud-theme';

let currentTheme = 'dark';
let onChangeCallback = null;

/**
 * Initialize theme from localStorage or default to dark
 * @param {function} onChange - called with isDark boolean when theme changes
 */
export function initTheme(onChange) {
    onChangeCallback = onChange;
    const saved = localStorage.getItem(STORAGE_KEY);
    currentTheme = saved === 'light' ? 'light' : 'dark';
    applyTheme();
}

/**
 * Toggle between dark and light theme
 */
export function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, currentTheme);
    applyTheme();
    if (onChangeCallback) onChangeCallback(currentTheme === 'dark');
}

/**
 * Get current theme
 */
export function getTheme() {
    return currentTheme;
}

/**
 * Apply theme to the document
 */
function applyTheme() {
    document.documentElement.dataset.theme = currentTheme;
    updateToggleButton();
}

/**
 * Update the toggle button icon
 */
function updateToggleButton() {
    const btn = document.getElementById('theme-btn');
    if (btn) {
        btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
        btn.title = currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}
