// ============================================
// APP.JS — Main controller (wires all modules together)
// ============================================

import { searchRecipes, getRecipeById, getRandomRecipe }            from './recipes.js';
import { getNutritionById }                                         from './nutrition.js';
import { searchUSDANutrition }                                      from './usda-nutrition.js';
import { renderRecipeCards, buildModalHTML, setLoading, showError, showEmptyState } from './render.js';
import { handleFavoriteToggle, renderFavorites }                    from './favorites.js';

// ---- DOM Elements ----
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
function navigateTo(section) {
  const isFav = section === 'favorites';

  // Sync header links + aria-current
  navLinks.forEach(l => {
    const isCurrent = l.dataset.section === section;
    l.classList.toggle('active', isCurrent);
    isCurrent ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current');
  });
  // Sync bottom tabs + aria-current
  bottomTabs.forEach(t => {
    const isCurrent = t.dataset.section === section;
    t.classList.toggle('active', isCurrent);
    isCurrent ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current');
  });

  if (isFav) {
    searchSection.classList.add('hidden');
    featuredSection.classList.add('hidden');
    favoritesSection.classList.remove('hidden');
    renderFavorites(favoritesGrid, openModal);
  } else {
    favoritesSection.classList.add('hidden');
    searchSection.classList.remove('hidden');
    featuredSection.classList.remove('hidden');
  }
}

[...navLinks, ...bottomTabs].forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.section);
  });
});

// ============================================
// SEARCH
// ============================================
searchForm.addEventListener('submit', async e => {
  e.preventDefault();

  const query = searchInput.value.trim();
  if (!query) return;

  setLoading(loadingEl, true);
  resultsGrid.innerHTML = '';

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
    setLoading(loadingEl, false);
  }
});

// ============================================
// MODAL
// ============================================
async function openModal(id) {
  modalContent.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading recipe...</p>
    </div>
  `;
  modal.showModal();

  try {
    // Fetch recipe info + Spoonacular nutrition in parallel — faster! 🚀
    const [recipe, nutrients] = await Promise.all([
      getRecipeById(id),
      getNutritionById(id)
    ]);

    // Query USDA using the recipe title as a food search term.
    // This runs after we have the title; failures are non-fatal.
    const usdaNutrition = await searchUSDANutrition(recipe.title).catch(() => null);

    modalContent.innerHTML = buildModalHTML(recipe, nutrients, usdaNutrition);
  } catch (err) {
    modalContent.innerHTML = `<p class="error-msg">⚠️ ${err.message}</p>`;
  }
}

// Close modal on ✕ button
modalClose.addEventListener('click', () => modal.close());

// Close modal on backdrop click
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
async function loadFeaturedRecipe() {
  featuredCard.innerHTML = `
    <div class="featured-loading">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const recipe = await getRandomRecipe();
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
    featuredCard.innerHTML = '';  // hide section silently if API fails
  }
}

loadFeaturedRecipe();
showEmptyState(resultsGrid);