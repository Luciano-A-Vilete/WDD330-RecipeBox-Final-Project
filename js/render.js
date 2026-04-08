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
  const cookTime = recipe.readyInMinutes
    ? `<span aria-hidden="true">⏱</span> <span class="sr-only">Cook time:</span>${recipe.readyInMinutes} min`
    : '';
  const servings = recipe.servings
    ? `<span aria-hidden="true">🍽</span> <span class="sr-only">Servings:</span>${recipe.servings} servings`
    : '';

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
 * @param {Array}  nutrients     — from getNutritionById() (Spoonacular)
 * @param {Object} usdaNutrition — from searchUSDANutrition() (USDA), may be null
 * @returns {string}
 */
export function buildModalHTML(recipe, nutrients = [], usdaNutrition = null) {
  // Returns { value, pct } for a nutrient — pct capped at 100 for the bar width
  const getNutrient = name => {
    const found = nutrients.find(n => n.name === name);
    if (!found) return { value: '–', pct: 0 };
    return {
      value: `${Math.round(found.amount)}${found.unit}`,
      pct:   Math.min(Math.round(found.percentOfDailyNeeds ?? 0), 100),
    };
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

  const stepsHTML = buildStepsHTML(recipe.analyzedInstructions);

  return `
    <div class="modal-hero">
      <img src="${recipe.image}" alt="${recipe.title}">
      <div class="modal-hero-overlay">
        <h2 class="modal-title" id="modal-title">${recipe.title}</h2>
        <div class="modal-meta">
          ${recipe.readyInMinutes ? `<span>⏱ ${recipe.readyInMinutes} min</span>` : ''}
          ${recipe.servings       ? `<span>🍽 ${recipe.servings} servings</span>` : ''}
        </div>
      </div>
    </div>
    <div class="modal-body">

      <h3>Nutrition per serving</h3>
      <div class="nutrition-grid">
        ${[
          { key: 'Calories',      label: 'kcal'    },
          { key: 'Protein',       label: 'Protein' },
          { key: 'Carbohydrates', label: 'Carbs'   },
          { key: 'Fat',           label: 'Fat'     },
        ].map(({ key, label }) => {
          const { value, pct } = getNutrient(key);
          return `
            <div class="nutrition-item">
              <div class="nutrition-value">${value}</div>
              <div class="nutrition-label">${label}</div>
              <div class="nutrition-bar" role="progressbar"
                   aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
                   aria-label="${label} ${pct}% of daily value">
                <div class="nutrition-bar-fill" style="width:${pct}%"></div>
              </div>
              <div class="nutrition-dv">${pct}% DV</div>
            </div>
          `;
        }).join('')}
      </div>

      ${usdaNutrition && usdaNutrition.items.length > 0 ? `
        <h3>USDA Nutrition Data
          <span class="usda-source" title="${usdaNutrition.source}">via FoodData Central</span>
        </h3>
        <div class="nutrition-grid usda-grid">
          ${usdaNutrition.items.map(item => `
            <div class="nutrition-item">
              <div class="nutrition-value">${item.value}</div>
              <div class="nutrition-label">${item.label}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${ingredients ? `
        <h3 id="modal-ingredients-heading">Ingredients</h3>
        <ul class="ingredients-list" aria-labelledby="modal-ingredients-heading">${ingredients}</ul>
      ` : ''}

      ${stepsHTML}

      ${summary ? `
        <h3>About this recipe</h3>
        <p class="recipe-summary">${summary}</p>
      ` : ''}
    </div>
  `;
}

/**
 * Build numbered cooking steps HTML from Spoonacular's analyzedInstructions.
 * Handles multiple instruction sets (e.g. "For the sauce:" + "For the chicken:").
 *
 * @param {Array} instructions — recipe.analyzedInstructions from Spoonacular
 * @returns {string} — HTML string, or '' if no instructions
 */
function buildStepsHTML(instructions) {
  if (!instructions || instructions.length === 0) return '';

  return instructions.map((section, idx) => `
    <h3 id="steps-heading-${idx}">${section.name ? `Steps: ${section.name}` : 'Instructions'}</h3>
    <ol class="steps-list" aria-labelledby="steps-heading-${idx}">
      ${section.steps.map(s => `
        <li class="step-item">
          <p class="step-text">${s.step}</p>
          ${s.ingredients?.length ? `
            <div class="step-tags" aria-label="Ingredients used in this step">
              ${s.ingredients.map(ing => `<span class="step-tag">${ing.name}</span>`).join('')}
            </div>
          ` : ''}
        </li>
      `).join('')}
    </ol>
  `).join('');
}

/**
 * Show an empty search prompt before the user has searched for anything
 * @param {HTMLElement} container — the results grid element
 */
export function showEmptyState(container) {
  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-icon">🍳</p>
      <h2 class="empty-title">What are you craving?</h2>
      <p class="empty-hint">Search by ingredient, dish name, or cuisine above.</p>
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