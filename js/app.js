// ============================================
// APP.JS — Main controller (wires all modules together)
// Each feature lives in its own module; this file only handles
// wiring: DOM events → module calls → DOM updates.
// ============================================

import { searchRecipes, getRecipeById, getRandomRecipe }            from './recipes.js';
import { getNutritionById }                                         from './nutrition.js';
import { searchUSDANutrition }                                      from './usda-nutrition.js';
import { renderRecipeCards, buildModalHTML, setLoading, showError, showEmptyState } from './render.js';
import { handleFavoriteToggle, renderFavorites }                    from './favorites.js';

// ---- DOM Elements ----
// All queried once at startup — repeated getElementById calls inside
// event handlers would work but re-query the DOM unnecessarily.
const searchForm       = document.getElementById('search-form');
const searchInput      = document.getElementById('search-input');
const dietFilter       = document.getElementById('diet-filter');
const cuisineFilter    = document.getElementById('cuisine-filter');
const resultsGrid      = document.getElementById('results-grid');
const favoritesGrid    = document.getElementById('favorites-grid');
const loadingEl        = document.getElementById('loading');
const modal            = document.getElementById('recipe-modal');
const modalContent     = document.getElementById('modal-content');
const modalClose       = document.querySelector('.modal-close');
const navLinks         = document.querySelectorAll('.nav-link');
const searchSection    = document.getElementById('search-section');
const favoritesSection = document.getElementById('favorites-section');
const featuredCard     = document.getElementById('featured-card');
const featuredSection  = document.getElementById('featured-section');
const bottomTabs       = document.querySelectorAll('.bottom-tab');

// ============================================
// NAVIGATION
// ============================================

/**
 * Switch the visible section and keep both nav bars in sync.
 * A named function (rather than inline handler) lets both the header
 * links and the bottom tabs share identical logic without duplication.
 *
 * @param {string} section — 'search' | 'favorites'
 */
function navigateTo(section) {
  const isFav = section === 'favorites';

  // Sync header links + aria-current
  // aria-current="page" is the correct ARIA pattern for SPA navigation —
  // it tells screen readers which link represents the current view.
  navLinks.forEach(l => {
    const isCurrent = l.dataset.section === section;
    l.classList.toggle('active', isCurrent);
    isCurrent ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current');
  });

  // Sync bottom tabs + aria-current (same logic, separate node list)
  bottomTabs.forEach(t => {
    const isCurrent = t.dataset.section === section;
    t.classList.toggle('active', isCurrent);
    isCurrent ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current');
  });

  if (isFav) {
    searchSection.classList.add('hidden');
    featuredSection.classList.add('hidden'); // featured is irrelevant on the Favorites screen
    favoritesSection.classList.remove('hidden');
    renderFavorites(favoritesGrid, openModal); // re-render on every visit so removals stay in sync
  } else {
    favoritesSection.classList.add('hidden');
    searchSection.classList.remove('hidden');
    featuredSection.classList.remove('hidden');
  }
}

// Spread both NodeLists into one array so a single forEach covers both
// the header nav (desktop) and the bottom tab bar (mobile).
[...navLinks, ...bottomTabs].forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault(); // stop the browser from scrolling to the fragment href
    navigateTo(link.dataset.section);
  });
});

// ============================================
// SEARCH
// ============================================
searchForm.addEventListener('submit', async e => {
  e.preventDefault();

  const query = searchInput.value.trim();
  if (!query) return; // guard: ignore empty submissions

  setLoading(loadingEl, true);
  resultsGrid.innerHTML = ''; // clear previous results before the new fetch completes

  try {
    const recipes = await searchRecipes(
      query,
      dietFilter.value,
      cuisineFilter.value
    );
    renderRecipeCards(recipes, resultsGrid, openModal, handleFavoriteToggle);
  } catch (err) {
    showError(resultsGrid, err.message);
  } finally {
    // finally always runs — hides the spinner whether the search succeeded or failed
    setLoading(loadingEl, false);
  }
});

// ============================================
// MODAL
// ============================================

/**
 * Open the recipe detail modal for a given recipe ID.
 * Shows a spinner immediately (before any fetch) so the user gets
 * instant visual feedback on slow connections.
 *
 * @param {number} id — Spoonacular recipe ID
 */
async function openModal(id) {
  // Render spinner first — modal.showModal() is called right after so
  // the user sees it as soon as the dialog opens, before any network call.
  modalContent.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading recipe...</p>
    </div>
  `;
  modal.showModal();

  try {
    // Fetch recipe info AND Spoonacular nutrition in parallel — both use
    // the same recipe ID so neither depends on the other's result.
    const [recipe, nutrients] = await Promise.all([
      getRecipeById(id),
      getNutritionById(id)
    ]);

    // USDA runs sequentially (not in Promise.all) because it needs
    // recipe.title as its search query, which isn't available until the
    // recipe fetch resolves. Failures are non-fatal — .catch(() => null)
    // ensures a broken USDA response never crashes the whole modal.
    const usdaNutrition = await searchUSDANutrition(recipe.title).catch(() => null);

    modalContent.innerHTML = buildModalHTML(recipe, nutrients, usdaNutrition);
  } catch (err) {
    modalContent.innerHTML = `<p class="error-msg">⚠️ ${err.message}</p>`;
  }
}

// Close modal on ✕ button
modalClose.addEventListener('click', () => modal.close());

// Close modal on backdrop click.
// The native <dialog>::backdrop doesn't fire click events directly, so we
// compare the click coordinates against the dialog's bounding rect instead.
// Clicks outside the rect hit the backdrop; clicks inside hit the content.
modal.addEventListener('click', e => {
  const rect = modal.getBoundingClientRect();
  const outside =
    e.clientX < rect.left || e.clientX > rect.right ||
    e.clientY < rect.top  || e.clientY > rect.bottom;
  if (outside) modal.close();
});

// ============================================
// FEATURED RECIPE (on page load)
// ============================================

/**
 * Fetch a random recipe and render it in the featured banner.
 * Errors are silently swallowed — the featured section is non-essential,
 * and an empty card is less disruptive than an error message in the hero area.
 */
async function loadFeaturedRecipe() {
  featuredCard.innerHTML = `
    <div class="featured-loading">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const recipe = await getRandomRecipe();
    // loading="eager" because this image is above the fold and should
    // render immediately — lazy-loading it would delay the most visible element.
    featuredCard.innerHTML = `
      <img class="featured-img" src="${recipe.image}" alt="${recipe.title}" loading="eager">
      <div class="featured-body">
        <p class="featured-eyebrow">Featured Recipe</p>
        <h2 class="featured-title">${recipe.title}</h2>
        <div class="featured-meta">
          ${recipe.readyInMinutes ? `<span>⏱ ${recipe.readyInMinutes} min</span>` : ''}
          ${recipe.servings       ? `<span>🍽 ${recipe.servings} servings</span>` : ''}
        </div>
        <button class="btn-search featured-btn" data-id="${recipe.id}" aria-label="View recipe: ${recipe.title}">View Recipe</button>
      </div>
    `;
    featuredCard.querySelector('.featured-btn')
      .addEventListener('click', () => openModal(recipe.id));
  } catch {
    featuredCard.innerHTML = ''; // collapse the section — no broken UI
  }
}

// Run on page load — no await needed; the UI updates asynchronously
// while the rest of the page initialises below.
loadFeaturedRecipe();
showEmptyState(resultsGrid);
