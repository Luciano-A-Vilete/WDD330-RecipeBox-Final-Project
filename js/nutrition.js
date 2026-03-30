// ============================================
// NUTRITION MODULE — Nutrition data API calls
// ============================================

const BASE_URL = 'https://api.spoonacular.com';
const API_KEY  = '0a6488ae8f1745aa8c764ed39a755554';

/**
 * Get full nutrition data for a recipe by ID
 * Returns an array of nutrients with name, amount, unit
 * @param {number} id — recipe ID
 * @returns {Promise<Array>}
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
  return data.nutrients; // Array of { name, amount, unit, percentOfDailyNeeds }
}

/**
 * Extract a specific nutrient value from a nutrients array
 * @param {Array}  nutrients — from getNutritionById()
 * @param {string} name      — e.g. 'Calories', 'Protein', 'Fat', 'Carbohydrates'
 * @returns {string}         — formatted value like "320kcal" or "–" if not found
 */
export function extractNutrient(nutrients, name) {
  const found = nutrients.find(n => n.name === name);
  return found ? `${Math.round(found.amount)}${found.unit}` : '–';
}