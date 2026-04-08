// ============================================
// USDA NUTRITION MODULE — USDA FoodData Central API
// Docs: https://fdc.nal.usda.gov/api-guide.html
// ============================================

import { USDA_API_KEY } from './config.js';
const USDA_BASE    = 'https://api.nal.usda.gov/fdc/v1';

// Maps USDA nutrient names → our app's display labels
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
 * This is the primary ingredient-level lookup — returns nutrients for the
 * best-matching USDA food item, or null if nothing useful is found.
 *
 * @param {string} ingredient — ingredient name, e.g. "olive oil" or "garlic"
 * @returns {Promise<{ source: string, fdcId: number, items: Array<{ label, value, unit }> } | null>}
 */
export async function fetchNutrition(ingredient) {
  const params = new URLSearchParams({
    api_key:  USDA_API_KEY,
    query:    ingredient,
    pageSize: 5,                     // fetch a few candidates so we can pick the best
    dataType: 'Foundation,SR Legacy',
  });

  const response = await fetch(`${USDA_BASE}/foods/search?${params}`);
  if (!response.ok) {
    throw new Error(`USDA API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.foods || data.foods.length === 0) return null;

  // TODO: Pick the best match from data.foods (Array of up to 5 candidates).
  // Each food has: .description (string), .dataType ('Foundation'|'SR Legacy'),
  // .foodNutrients (array), .score (relevance score from USDA).
  //
  // Some approaches to consider:
  //   • Simplest:  always take data.foods[0] (highest USDA relevance score)
  //   • Stricter:  prefer 'Foundation' entries over 'SR Legacy' when both exist
  //   • Smarter:   pick the one whose .description most closely matches `ingredient`
  //
  // Return the chosen food object, or null to signal "no good match".
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
 * Called by fetchNutrition() — implement your selection strategy here.
 *
 * @param {Array}  candidates — up to 5 USDA food objects
 * @param {string} query      — the original ingredient name
 * @returns {Object|null}     — the chosen food object, or null
 */
function pickBestMatch(candidates, query) {
  const term = query.toLowerCase();

  // 1. Prefer Foundation entries (most scientifically rigorous)
  const foundation = candidates.filter(f => f.dataType === 'Foundation');
  const pool = foundation.length > 0 ? foundation : candidates;

  // 2. Within the pool, prefer a description that contains the query term
  const exact = pool.find(f => f.description.toLowerCase().includes(term));
  return exact ?? pool[0];
}

/**
 * Search USDA FoodData Central for a food by name.
 * Returns the top matching food item's nutrients, mapped to our app's format.
 *
 * @param {string} query — food or ingredient name (e.g. "chicken breast")
 * @param {string} [dataType] — filter: 'Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'
 * @returns {Promise<{ source: string, items: Array<{ label, value, unit }> }>}
 */
export async function searchUSDANutrition(query, dataType = 'Foundation,SR Legacy') {
  const params = new URLSearchParams({
    api_key:  USDA_API_KEY,
    query,
    pageSize: 1,
    dataType,
  });

  const response = await fetch(`${USDA_BASE}/foods/search?${params}`);

  if (!response.ok) {
    throw new Error(`USDA API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();

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
 * More accurate than search — use when you already know the FDC ID.
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
 * Convert raw USDA foodNutrients array → normalized { label, value, unit } list.
 * Filters to only the nutrients we care about (defined in NUTRIENT_MAP).
 *
 * @param {Array} rawNutrients — foodNutrients from USDA API response
 * @returns {Array<{ label: string, value: string, unit: string }>}
 */
function mapNutrients(rawNutrients = []) {
  const results = [];

  for (const [usdaName, display] of Object.entries(NUTRIENT_MAP)) {
    // USDA search response uses .nutrientName; detail endpoint uses .nutrient.name
    const found = rawNutrients.find(n =>
      (n.nutrientName || n.nutrient?.name) === usdaName
    );

    if (found) {
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
