// ============================================
// NUTRITION MODULE — Spoonacular nutrition widget API calls
// Kept separate from recipes.js because the nutrition endpoint
// (/nutritionWidget.json) is a distinct API surface with its own
// response shape, and the two fetches run in parallel in app.js.
// ============================================

import { SPOONACULAR_API_KEY as API_KEY } from './config.js';

const BASE_URL = 'https://api.spoonacular.com';

/**
 * Get per-serving nutrition data for a recipe by its Spoonacular ID.
 * Uses the nutritionWidget.json endpoint rather than embedding nutrition
 * in the recipe detail call (includeNutrition=true) because the widget
 * response includes percentOfDailyNeeds for each nutrient — the field
 * that drives the % DV progress bars in the modal.
 *
 * @param {number} id — Spoonacular recipe ID
 * @returns {Promise<Array>} — array of { name, amount, unit, percentOfDailyNeeds }
 */
export async function getNutritionById(id) {
  const params = new URLSearchParams({ apiKey: API_KEY });

  const response = await fetch(
    `${BASE_URL}/recipes/${id}/nutritionWidget.json?${params}`,
    { headers: { 'x-api-key': API_KEY } }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Nutrition fetch failed (${response.status}): ${err.message || response.statusText}`);
  }

  const data = await response.json();
  // The widget response wraps nutrients in { nutrients: [...], ingredients: [...], ... }
  // We only need the nutrients array — ingredients are already on the recipe object.
  return data.nutrients;
}

/**
 * Extract and format a single nutrient value from a nutrients array.
 * A convenience helper used when only one nutrient is needed — avoids
 * repeating the find + format pattern at every call site.
 *
 * @param {Array}  nutrients — from getNutritionById()
 * @param {string} name      — nutrient name as returned by the API
 *                             (e.g. 'Calories', 'Protein', 'Fat', 'Carbohydrates')
 * @returns {string} — formatted value like "320kcal" or "–" if not found
 */
export function extractNutrient(nutrients, name) {
  const found = nutrients.find(n => n.name === name);
  // '–' (en dash) rather than '-' (hyphen) or 'N/A' — visually cleaner as
  // a placeholder in the nutrition grid when a value is missing.
  return found ? `${Math.round(found.amount)}${found.unit}` : '–';
}
