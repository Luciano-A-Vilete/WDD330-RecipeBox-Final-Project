// ============================================
// FAVORITES MODULE — Favorites logic + localStorage
// ============================================

import { renderRecipeCards } from './render.js';

const FAVORITES_KEY = 'recipebox_favorites';

/**
 * Get all saved favorites from localStorage
 * @returns {Array}
 */
export function getFavorites() {
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save a recipe to favorites (no duplicates)
 * @param {Object} recipe
 */
export function saveFavorite(recipe) {
  const favorites = getFavorites();
  if (!favorites.some(r => r.id === recipe.id)) {
    favorites.push(recipe);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}

/**
 * Remove a recipe from favorites by ID
 * @param {number} id
 */
export function removeFavorite(id) {
  const updated = getFavorites().filter(r => r.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
}

/**
 * Check if a recipe is already saved
 * @param {number} id
 * @returns {boolean}
 */
export function isFavorite(id) {
  return getFavorites().some(r => r.id === id);
}

/**
 * Toggle a recipe's saved state and update the button UI
 * @param {HTMLElement} btn — the favorite button element
 */
export function handleFavoriteToggle(btn) {
  const id     = Number(btn.dataset.id);
  const recipe = JSON.parse(btn.dataset.recipe);

  if (isFavorite(id)) {
    removeFavorite(id);
    btn.classList.remove('saved');
    btn.textContent = '🤍';
    btn.setAttribute('aria-label', 'Add to favorites');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    saveFavorite(recipe);
    btn.classList.add('saved');
    btn.textContent = '❤️';
    btn.setAttribute('aria-label', 'Remove from favorites');
    btn.setAttribute('aria-pressed', 'true');
  }
}

/**
 * Render all saved favorites into a container
 * @param {HTMLElement} container
 * @param {Function}    onDetails  — callback for View Recipe button
 */
export function renderFavorites(container, onDetails) {
  const favorites = getFavorites();
  renderRecipeCards(favorites, container, onDetails, handleFavoriteToggle);
}