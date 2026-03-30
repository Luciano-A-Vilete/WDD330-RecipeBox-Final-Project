// ============================================
// RENDER MODULE — All DOM rendering functions
// ============================================

import { isFavorite } from './favorites.js';

/**
 * Render an array of recipe cards into a container element
 * @param {Array}       recipes   — array of recipe objects
 * @param {HTMLElement} container — the grid element to render into
 * @param {Function}    onDetails   — callback when "View Recipe" is clicked
 * @param {Function}    onFavorite  — callback when favorite button is clicked
 */
export function renderRecipeCards(recipes, container, onDetails, onFavorite) {
  if (!recipes || recipes.length === 0) {
    container.innerHTML = '<p class="no-results">No recipes found. Try a different search!</p>';
    return;
  }

  container.innerHTML = recipes.map(recipe => buildCardHTML(recipe)).join('');

  // Attach event listeners after HTML is in the DOM
  container.querySelectorAll('.btn-details').forEach(btn => {
    btn.addEventListener('click', () => onDetails(Number(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-favorite').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onFavorite(btn);
    });
  });
}

/**
 * Build HTML string for a single recipe card
 * @param {Object} recipe
 * @returns {string}
 */
export function buildCardHTML(recipe) {
  const saved    = isFavorite(recipe.id);
  const cookTime = recipe.readyInMinutes ? `⏱ ${recipe.readyInMinutes} min` : '';
  const servings = recipe.servings       ? `🍽 ${recipe.servings} servings` : '';

  const recipeData = JSON.stringify({
    id:             recipe.id,
    title:          recipe.title,
    image:          recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    servings:       recipe.servings,
  });

  return `
    <article class="recipe-card" role="listitem">
      <img
        src="${recipe.image || 'images/placeholder.jpg'}"
        alt="${recipe.title}"
        loading="lazy"
        width="312"
        height="180"
      >
      <div class="card-body">
        <h3 class="card-title">${recipe.title}</h3>
        <div class="card-meta">
          ${cookTime ? `<span>${cookTime}</span>` : ''}
          ${servings  ? `<span>${servings}</span>`  : ''}
        </div>
        <div class="card-actions">
          <button
            class="btn-details"
            data-id="${recipe.id}"
            aria-label="View full details for ${recipe.title}"
          >View Recipe</button>
          <button
            class="btn-favorite ${saved ? 'saved' : ''}"
            data-id="${recipe.id}"
            data-recipe='${recipeData}'
            aria-label="${saved ? 'Remove from favorites' : 'Add to favorites'}"
            aria-pressed="${saved}"
          >${saved ? '❤️' : '🤍'}</button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Build modal HTML from a recipe + nutrition nutrients array
 * @param {Object} recipe
 * @param {Array}  nutrients — from getNutritionById()
 * @returns {string}
 */
export function buildModalHTML(recipe, nutrients = []) {
  const getNutrient = name => {
    const found = nutrients.find(n => n.name === name);
    return found ? `${Math.round(found.amount)}${found.unit}` : '–';
  };

  const summary = recipe.summary
    ? recipe.summary.replace(/<[^>]+>/g, '').slice(0, 300) + '...'
    : '';

  // Build ingredients list from extendedIngredients if available
  const ingredients = recipe.extendedIngredients
    ? recipe.extendedIngredients
        .map(ing => `<li>${ing.original}</li>`)
        .join('')
    : '';

  return `
    <div class="modal-hero">
      <img src="${recipe.image}" alt="${recipe.title}">
    </div>
    <div class="modal-body">
      <h2 class="modal-title" id="modal-title">${recipe.title}</h2>

      <div class="modal-meta">
        ${recipe.readyInMinutes ? `<span>⏱ ${recipe.readyInMinutes} min</span>` : ''}
        ${recipe.servings       ? `<span>🍽 ${recipe.servings} servings</span>` : ''}
      </div>

      <h3>Nutrition per serving</h3>
      <div class="nutrition-grid">
        <div class="nutrition-item">
          <div class="nutrition-value">${getNutrient('Calories')}</div>
          <div class="nutrition-label">Calories</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${getNutrient('Protein')}</div>
          <div class="nutrition-label">Protein</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${getNutrient('Carbohydrates')}</div>
          <div class="nutrition-label">Carbs</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${getNutrient('Fat')}</div>
          <div class="nutrition-label">Fat</div>
        </div>
      </div>

      ${ingredients ? `
        <h3>Ingredients</h3>
        <ul class="ingredients-list">${ingredients}</ul>
      ` : ''}

      ${summary ? `
        <h3>About this recipe</h3>
        <p class="recipe-summary">${summary}</p>
      ` : ''}
    </div>
  `;
}

/**
 * Show or hide the loading spinner
 * @param {HTMLElement} el   — the loading element
 * @param {boolean}     show
 */
export function setLoading(el, show) {
  el.classList.toggle('hidden', !show);
}

/**
 * Show an error message inside a container
 * @param {HTMLElement} container
 * @param {string}      message
 */
export function showError(container, message) {
  container.innerHTML = `<p class="error-msg">⚠️ ${message}</p>`;
}