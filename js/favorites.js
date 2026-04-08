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

    // Pulse animation — add .pop, remove it once the animation ends
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  }
}

/**
 * Render all saved favorites into a container.
 * Also updates the count badge and clear button in the favorites header.
 *
 * @param {HTMLElement} container
 * @param {Function}    onDetails  — callback for View Recipe button
 */
export function renderFavorites(container, onDetails) {
  const favorites = getFavorites();

  // Update count badge
  const countEl = document.getElementById('fav-count');
  if (countEl) countEl.textContent = favorites.length ? `· ${favorites.length}` : '';

  // Show/hide "Clear all" button
  const clearBtn = document.getElementById('fav-clear');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', favorites.length === 0);
    clearBtn.onclick = () => {
      localStorage.removeItem(FAVORITES_KEY);
      renderFavorites(container, onDetails); // re-render after clearing
    };
  }

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="fav-empty">
        <p class="empty-icon">🤍</p>
        <h2 class="empty-title">No saved recipes yet</h2>
        <p class="empty-hint">Tap the heart on any recipe to save it here.</p>
      </div>
    `;
    return;
  }

  renderRecipeCards(favorites, container, onDetails, removeFavoriteCard);
}

/**
 * Remove a favorite from localStorage AND remove its card from the DOM.
 * Used exclusively in the favorites view so the grid stays in sync.
 *
 * @param {HTMLElement} btn — the favorite button that was clicked
 */
function removeFavoriteCard(btn) {
  const id = Number(btn.dataset.id);
  removeFavorite(id);

  const card = btn.closest('article');
  card?.remove();
}