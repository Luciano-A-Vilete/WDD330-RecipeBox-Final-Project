// ============================================
// FAVORITES MODULE — localStorage persistence + favorites UI
// Owns all read/write operations on the favorites list and the
// rendering of the Favorites screen. No API calls live here.
// ============================================

import { renderRecipeCards } from './render.js';

// Single key for all favorites data — using a namespaced string avoids
// collisions if other apps share the same origin's localStorage.
const FAVORITES_KEY = 'recipebox_favorites';

/**
 * Get all saved favorites from localStorage.
 * Returns an empty array rather than null so callers can always call
 * .some(), .filter(), etc. without a null-check first.
 *
 * @returns {Array} — array of saved recipe objects
 */
export function getFavorites() {
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save a recipe to favorites, guarding against duplicates.
 * The duplicate check uses the recipe's numeric id — more reliable than
 * comparing title strings, which can differ by casing or whitespace.
 *
 * @param {Object} recipe — recipe object (id, title, image, readyInMinutes, servings)
 */
export function saveFavorite(recipe) {
  const favorites = getFavorites();
  if (!favorites.some(r => r.id === recipe.id)) {
    favorites.push(recipe);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}

/**
 * Remove a recipe from favorites by ID.
 * Filter creates a new array without the target — we never mutate the
 * stored array directly, which avoids stale references if anything else
 * holds a reference to the old array.
 *
 * @param {number} id — Spoonacular recipe ID to remove
 */
export function removeFavorite(id) {
  const updated = getFavorites().filter(r => r.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
}

/**
 * Check if a recipe is already saved.
 * Used by render.js to set the initial ❤️/🤍 state when building cards,
 * so the heart icon is always in sync with localStorage on page load.
 *
 * @param {number} id
 * @returns {boolean}
 */
export function isFavorite(id) {
  return getFavorites().some(r => r.id === id);
}

/**
 * Toggle a recipe's saved state and update the button UI in place.
 * Called from the search results grid — does NOT remove the card from the
 * DOM (that's handled by removeFavoriteCard, which is favorites-view-only).
 *
 * @param {HTMLElement} btn — the .btn-favorite element that was clicked
 */
export function handleFavoriteToggle(btn) {
  const id     = Number(btn.dataset.id);
  // recipe data is stored as JSON on the button (see buildCardHTML in render.js)
  // so we can save to favorites without an extra network request.
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

    // Trigger the heart-pop CSS animation by adding .pop, then clean it up.
    // { once: true } automatically removes the listener after it fires once —
    // without it the listener would accumulate every time the user saves a recipe.
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  }
}

/**
 * Render all saved favorites into the favorites grid container.
 * Re-renders from scratch on every call so the UI stays in sync with
 * localStorage (e.g., after a recipe is removed from the favorites view).
 *
 * @param {HTMLElement} container — the favorites grid element
 * @param {Function}    onDetails — callback for "View Recipe" (opens modal)
 */
export function renderFavorites(container, onDetails) {
  const favorites = getFavorites();

  // Update the "· N" count badge next to the Favorites heading.
  // The dot separator gives a typographic break between the label and number.
  const countEl = document.getElementById('fav-count');
  if (countEl) countEl.textContent = favorites.length ? `· ${favorites.length}` : '';

  // "Clear all" button — show only when there is something to clear.
  const clearBtn = document.getElementById('fav-clear');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', favorites.length === 0);

    // onclick (assignment) instead of addEventListener — renderFavorites() runs
    // every time the user visits the Favorites tab, so addEventListener would
    // stack a new listener on each visit and fire multiple clears on one click.
    clearBtn.onclick = () => {
      localStorage.removeItem(FAVORITES_KEY);
      renderFavorites(container, onDetails); // re-render immediately after clearing
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

  // Pass removeFavoriteCard as the onFavorite callback — in the favorites view,
  // un-hearting a recipe should both update localStorage AND remove the card
  // from the DOM, which is a different behavior from the search results view.
  renderRecipeCards(favorites, container, onDetails, removeFavoriteCard);
}

/**
 * Remove a favorite from localStorage AND remove its card from the DOM.
 * This is intentionally NOT exported — it is only the correct behavior in
 * the favorites view. The search results view uses handleFavoriteToggle instead,
 * which updates the button state without removing the card.
 *
 * @param {HTMLElement} btn — the .btn-favorite that was clicked
 */
function removeFavoriteCard(btn) {
  const id = Number(btn.dataset.id);
  removeFavorite(id);

  // .closest('article') walks up the DOM to find the card wrapper.
  // Optional chaining (?.) guards against the edge case where the card
  // was already removed (e.g., double-click before the DOM updates).
  const card = btn.closest('article');
  card?.remove();
}
