// ============================================
// APP.JS — Main controller (wires all modules together)
// ============================================

import { searchRecipes, getRecipeById }                             from './recipes.js';
import { getNutritionById }                                         from './nutrition.js';
import { renderRecipeCards, buildModalHTML, setLoading, showError } from './render.js';
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

// ============================================
// NAVIGATION
// ============================================
navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    if (link.dataset.section === 'favorites') {
      searchSection.classList.add('hidden');
      favoritesSection.classList.remove('hidden');
      renderFavorites(favoritesGrid, openModal);
    } else {
      favoritesSection.classList.add('hidden');
      searchSection.classList.remove('hidden');
    }
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
    // Fetch recipe info AND nutrition at the same time — faster! 🚀
    const [recipe, nutrients] = await Promise.all([
      getRecipeById(id),
      getNutritionById(id)
    ]);
    modalContent.innerHTML = buildModalHTML(recipe, nutrients);
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