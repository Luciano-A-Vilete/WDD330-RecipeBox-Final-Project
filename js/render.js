// ============================================
// RENDER MODULE — All DOM rendering functions
// Pure output: receives data, returns HTML strings or updates the DOM.
// No API calls, no localStorage — keeps rendering concerns isolated.
// ============================================

import { isFavorite } from './favorites.js';

/**
 * Render an array of recipe cards into a container element.
 * Uses innerHTML (not individual createElement calls) because building
 * the entire grid as one string and setting it once is faster than
 * appending nodes one-by-one in a loop.
 *
 * @param {Array}       recipes     — array of recipe objects from Spoonacular
 * @param {HTMLElement} container   — the grid element to render into
 * @param {Function}    onDetails   — callback when "View Recipe" is clicked
 * @param {Function}    onFavorite  — callback when favorite button is clicked
 */
export function renderRecipeCards(recipes, container, onDetails, onFavorite) {
  if (!recipes || recipes.length === 0) {
    container.innerHTML = '<p class="no-results">No recipes found. Try a different search!</p>';
    return;
  }

  container.innerHTML = recipes.map(recipe => buildCardHTML(recipe)).join('');

  // Event listeners must be attached after innerHTML is set —
  // the elements don't exist in the DOM until that line runs.
  container.querySelectorAll('.btn-details').forEach(btn => {
    btn.addEventListener('click', () => onDetails(Number(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-favorite').forEach(btn => {
    btn.addEventListener('click', e => {
      // stopPropagation prevents the card's own click (if any) from also firing
      // when the heart button is tapped — avoids double-handling the event.
      e.stopPropagation();
      onFavorite(btn);
    });
  });
}

/**
 * Build HTML string for a single recipe card.
 *
 * Design note — data-recipe stores a JSON snapshot of the recipe object.
 * This avoids an extra API call when the user saves a favorite: the
 * favorite toggle handler reads the data from the button itself rather
 * than re-fetching from the network.
 *
 * @param {Object} recipe — Spoonacular recipe object
 * @returns {string}      — HTML string for one <article> card
 */
export function buildCardHTML(recipe) {
  const saved = isFavorite(recipe.id);

  // Emoji are wrapped in aria-hidden so screen readers skip them,
  // and sr-only spans provide the accessible text equivalent instead.
  const cookTime = recipe.readyInMinutes
    ? `<span aria-hidden="true">⏱</span> <span class="sr-only">Cook time:</span>${recipe.readyInMinutes} min`
    : '';
  const servings = recipe.servings
    ? `<span aria-hidden="true">🍽</span> <span class="sr-only">Servings:</span>${recipe.servings} servings`
    : '';

  // Only the fields needed for the favorites list are serialised here —
  // full recipe detail is fetched fresh when the modal opens.
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
 * Build the full recipe detail modal HTML.
 * Combines Spoonacular nutrition (with % daily value bars) and optional
 * USDA nutrition data into a single scrollable view.
 *
 * @param {Object} recipe        — full recipe object from getRecipeById()
 * @param {Array}  nutrients     — nutrient array from getNutritionById()
 * @param {Object} usdaNutrition — result from searchUSDANutrition(), or null
 * @returns {string}             — complete HTML string for modal-content
 */
export function buildModalHTML(recipe, nutrients = [], usdaNutrition = null) {
  // Closure over `nutrients` — avoids passing the array into every call.
  // Returns { value, pct } where pct is capped at 100 for the bar width.
  const getNutrient = name => {
    const found = nutrients.find(n => n.name === name);
    if (!found) return { value: '–', pct: 0 };
    return {
      value: `${Math.round(found.amount)}${found.unit}`,
      // percentOfDailyNeeds is occasionally absent in the API response —
      // the ?? 0 fallback prevents NaN from reaching the progress bar.
      pct: Math.min(Math.round(found.percentOfDailyNeeds ?? 0), 100),
    };
  };

  // Strip HTML tags injected by Spoonacular (their summaries contain <b>, <a>, etc.)
  // and truncate to a reasonable preview length.
  const summary = recipe.summary
    ? recipe.summary.replace(/<[^>]+>/g, '').slice(0, 300) + '...'
    : '';

  // extendedIngredients contains the full human-readable strings like
  // "2 cups all-purpose flour, sifted" — more useful than name alone.
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
 *
 * analyzedInstructions is an array because some recipes have multiple
 * named sections (e.g. "For the sauce:" followed by "For the chicken:").
 * Each section has its own steps array and optional name string.
 *
 * @param {Array} instructions — recipe.analyzedInstructions from Spoonacular
 * @returns {string}           — HTML string, or '' if no instructions exist
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
 * Render the pre-search empty state in the results grid.
 * Called once on page load; replaced when the first search completes.
 *
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
 * Show or hide the loading spinner by toggling the .hidden class.
 *
 * @param {HTMLElement} el   — the loading element
 * @param {boolean}     show — true to show, false to hide
 */
export function setLoading(el, show) {
  el.classList.toggle('hidden', !show);
}

/**
 * Render an error message inside a container.
 * Uses the same grid-column span as .no-results so it centers correctly
 * regardless of how many columns the grid has.
 *
 * @param {HTMLElement} container — target element
 * @param {string}      message   — error text to display
 */
export function showError(container, message) {
  container.innerHTML = `<p class="error-msg">⚠️ ${message}</p>`;
}
