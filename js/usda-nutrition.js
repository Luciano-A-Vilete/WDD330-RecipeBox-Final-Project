// ============================================
// USDA NUTRITION MODULE — USDA FoodData Central API
// Docs: https://fdc.nal.usda.gov/api-guide.html
//
// Two entry points:
//   fetchNutrition()       — ingredient-level lookup (used by feature cards)
//   searchUSDANutrition()  — recipe-title lookup (used by the modal)
// Both resolve through the same /foods/search endpoint but differ in how
// many candidates they fetch and how they pick among them.
// ============================================

import { USDA_API_KEY } from './config.js';
const USDA_BASE    = 'https://api.nal.usda.gov/fdc/v1';

// Translation table: USDA's verbose nutrient names → our display labels.
// USDA uses official scientific names (e.g. "Total lipid (fat)") that would
// look awkward in the UI, so we map them to short, user-friendly labels.
const NUTRIENT_MAP = {
  'Energy':                      { label: 'Calories', unit: 'kcal' },
  'Protein':                     { label: 'Protein',  unit: 'g'    },
  'Total lipid (fat)':           { label: 'Fat',      unit: 'g'    },
  'Carbohydrate, by difference': { label: 'Carbs',    unit: 'g'    },
  'Fiber, total dietary':        { label: 'Fiber',    unit: 'g'    },
  'Sodium, Na':                  { label: 'Sodium',   unit: 'mg'   },
};

/**
 * Fetch nutrition data for a single ingredient by name.
 * Fetches up to 5 candidates so pickBestMatch() has options to choose from —
 * the top USDA result by relevance score is not always the best semantic match
 * for what a recipe ingredient actually refers to.
 *
 * @param {string} ingredient — ingredient name, e.g. "olive oil" or "garlic"
 * @returns {Promise<{ source: string, fdcId: number, items: Array<{ label, value, unit }> } | null>}
 */
export async function fetchNutrition(ingredient) {
  const params = new URLSearchParams({
    api_key:  USDA_API_KEY,
    query:    ingredient,
    pageSize: 5,                     // fetch several candidates so pickBestMatch has options
    dataType: 'Foundation,SR Legacy',
  });

  const response = await fetch(`${USDA_BASE}/foods/search?${params}`);
  if (!response.ok) {
    throw new Error(`USDA API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.foods || data.foods.length === 0) return null;

  const best = pickBestMatch(data.foods, ingredient);
  if (!best) return null;

  return {
    source: best.description,
    fdcId:  best.fdcId,
    items:  mapNutrients(best.foodNutrients),
  };
}

/**
 * Choose the best food item from USDA search candidates.
 * Strategy: Foundation data is preferred over SR Legacy because it is based
 * on laboratory analysis rather than calculated values, making it more accurate.
 * Within the preferred data type, a description match beats relevance rank.
 *
 * @param {Array}  candidates — up to 5 USDA food objects from /foods/search
 * @param {string} query      — the original ingredient name
 * @returns {Object|null}     — the chosen food object, or null if no candidates
 */
function pickBestMatch(candidates, query) {
  const term = query.toLowerCase();

  // 1. Narrow to Foundation entries if any exist (most scientifically rigorous).
  //    Fall back to the full candidate list when no Foundation entries match.
  const foundation = candidates.filter(f => f.dataType === 'Foundation');
  const pool = foundation.length > 0 ? foundation : candidates;

  // 2. Within the pool, prefer a description that contains the query term.
  //    ?? falls back to pool[0] (highest USDA relevance score) when no
  //    description match exists.
  const exact = pool.find(f => f.description.toLowerCase().includes(term));
  return exact ?? pool[0];
}

/**
 * Search USDA FoodData Central for a recipe by name and return nutrient data.
 * Uses pageSize: 1 (vs 5 in fetchNutrition) because recipe titles are longer
 * and more specific — the top USDA result is almost always the right one,
 * so picking among multiple candidates is unnecessary overhead here.
 *
 * Called from app.js openModal() with the recipe title as the query.
 *
 * @param {string} query      — food or recipe name (e.g. "Chicken Tikka Masala")
 * @param {string} [dataType] — filter: 'Foundation', 'SR Legacy', etc.
 * @returns {Promise<{ source: string, items: Array<{ label, value, unit }> }>}
 */
export async function searchUSDANutrition(query, dataType = 'Foundation,SR Legacy') {
  const params = new URLSearchParams({
    api_key:  USDA_API_KEY,
    query,
    pageSize: 1,   // recipe title is specific enough that the top result is sufficient
    dataType,
  });

  const response = await fetch(`${USDA_BASE}/foods/search?${params}`);

  if (!response.ok) {
    throw new Error(`USDA API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();

  // Return an empty items array rather than throwing — the caller (app.js)
  // uses .catch(() => null) on this function, but a graceful empty result
  // avoids logging an unhandled rejection in the console.
  if (!data.foods || data.foods.length === 0) {
    return { source: null, items: [] };
  }

  const food = data.foods[0];
  return {
    source: food.description,      // e.g. "Chicken, broilers or fryers, breast, meat only, cooked, roasted"
    fdcId:  food.fdcId,
    items:  mapNutrients(food.foodNutrients),
  };
}

/**
 * Get detailed nutrition for a specific food by its FDC ID.
 * More precise than the search endpoint — use when you already know the fdcId
 * (e.g., from a prior fetchNutrition() call that returned an fdcId).
 *
 * @param {number} fdcId
 * @returns {Promise<{ source: string, items: Array<{ label, value, unit }> }>}
 */
export async function getUSDANutritionById(fdcId) {
  const params = new URLSearchParams({ api_key: USDA_API_KEY });
  const response = await fetch(`${USDA_BASE}/food/${fdcId}?${params}`);

  if (!response.ok) {
    throw new Error(`USDA fetch failed (${response.status}): ${response.statusText}`);
  }

  const food = await response.json();
  return {
    source: food.description,
    fdcId:  food.fdcId,
    items:  mapNutrients(food.foodNutrients),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Convert a raw USDA foodNutrients array into our normalized display format.
 * Filters to only the nutrients listed in NUTRIENT_MAP, discarding the dozens
 * of minor nutrients the API returns that we don't display.
 *
 * Field name inconsistency: the /foods/search endpoint puts the nutrient name
 * at .nutrientName (flat), while the /food/{fdcId} detail endpoint nests it
 * under .nutrient.name. The OR expression handles both shapes.
 *
 * @param {Array} rawNutrients — foodNutrients array from either USDA endpoint
 * @returns {Array<{ label: string, value: string, unit: string }>}
 */
function mapNutrients(rawNutrients = []) {
  const results = [];

  for (const [usdaName, display] of Object.entries(NUTRIENT_MAP)) {
    // Dual-field lookup: search response uses .nutrientName (flat string),
    // detail endpoint uses .nutrient.name (nested object). Optional chaining
    // prevents a TypeError if the nested .nutrient object is missing.
    const found = rawNutrients.find(n =>
      (n.nutrientName || n.nutrient?.name) === usdaName
    );

    if (found) {
      // Similarly, .value is used in search results and .amount in detail responses.
      const amount = found.value ?? found.amount ?? 0;
      results.push({
        label: display.label,
        value: `${Math.round(amount)}${display.unit}`,
        unit:  display.unit,
      });
    }
  }

  return results;
}
