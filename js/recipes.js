// ============================================
// RECIPES MODULE — Spoonacular recipe search & detail API calls
// All functions here are pure network calls: they fetch, check for errors,
// and return parsed data. No DOM updates, no localStorage — keeps the
// data-fetching concern isolated from rendering and storage.
// ============================================

import { SPOONACULAR_API_KEY as API_KEY } from './config.js';

const BASE_URL = 'https://api.spoonacular.com';

/**
 * Search for recipes matching a query with optional diet and cuisine filters.
 * addRecipeInformation=true asks Spoonacular to embed full recipe info
 * (readyInMinutes, servings, image, etc.) in the search results so we don't
 * need a separate detail fetch just to render the cards.
 *
 * @param {string} query    — free-text search term (e.g. "pasta", "chicken soup")
 * @param {string} diet     — Spoonacular diet label (e.g. "vegetarian", "vegan"), or ''
 * @param {string} cuisine  — Spoonacular cuisine label (e.g. "Italian", "Thai"), or ''
 * @param {number} number   — max results to return (default 12 fills a 3-column grid)
 * @returns {Promise<Array>} — array of recipe objects from data.results
 */
export async function searchRecipes(query, diet = '', cuisine = '', number = 12) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    query,
    number,
    addRecipeInformation: true,
  });

  // Diet and cuisine are appended only when non-empty — URLSearchParams would
  // send "diet=" (empty string) which Spoonacular treats as no filter anyway,
  // but omitting them keeps the URL clean and slightly shorter.
  if (diet)    params.append('diet', diet);
  if (cuisine) params.append('cuisine', cuisine);

  const response = await fetch(
    `${BASE_URL}/recipes/complexSearch?${params}`,
    { headers: { 'x-api-key': API_KEY } }
  );

  if (!response.ok) {
    // Attempt to parse Spoonacular's JSON error body (contains a .message field)
    // before falling back to the HTTP status text.
    const err = await response.json().catch(() => ({}));
    throw new Error(`Search failed (${response.status}): ${err.message || response.statusText}`);
  }

  const data = await response.json();
  // complexSearch wraps results in a { results: [], totalResults: N } envelope
  return data.results;
}

/**
 * Fetch one random recipe from Spoonacular.
 * The /recipes/random endpoint always returns an array under data.recipes —
 * even when number=1 — so we index [0] to unwrap the single item.
 *
 * @returns {Promise<Object>} — a single recipe object
 */
export async function getRandomRecipe() {
  const params = new URLSearchParams({
    apiKey:               API_KEY,
    number:               1,
    addRecipeInformation: true,
  });

  const response = await fetch(
    `${BASE_URL}/recipes/random?${params}`,
    { headers: { 'x-api-key': API_KEY } }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Random recipe failed (${response.status}): ${err.message || response.statusText}`);
  }

  const data = await response.json();
  // /recipes/random always returns { recipes: [...] } — unwrap the first element.
  return data.recipes[0];
}

/**
 * Get full recipe information by Spoonacular recipe ID.
 * includeNutrition=false keeps the response smaller — nutrition is fetched
 * separately by nutrition.js using the dedicated nutritionWidget endpoint,
 * which returns a cleaner per-nutrient structure with % daily values.
 *
 * @param {number} id — Spoonacular recipe ID
 * @returns {Promise<Object>} — full recipe object including extendedIngredients
 *                             and analyzedInstructions
 */
export async function getRecipeById(id) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    includeNutrition: false, // nutrition fetched separately via nutrition.js
  });

  const response = await fetch(
    `${BASE_URL}/recipes/${id}/information?${params}`,
    { headers: { 'x-api-key': API_KEY } }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Recipe fetch failed (${response.status}): ${err.message || response.statusText}`);
  }

  return await response.json();
}
