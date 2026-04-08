// ============================================
// RECIPES MODULE — Recipe search & detail API calls
// ============================================

import { SPOONACULAR_API_KEY as API_KEY } from './config.js';

const BASE_URL = 'https://api.spoonacular.com';

/**
 * Search for recipes by query, diet, and cuisine
 * @param {string} query
 * @param {string} diet
 * @param {string} cuisine
 * @param {number} number
 * @returns {Promise<Array>}
 */
export async function searchRecipes(query, diet = '', cuisine = '', number = 12) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    query,
    number,
    addRecipeInformation: true,
  });

  if (diet)    params.append('diet', diet);
  if (cuisine) params.append('cuisine', cuisine);

  const response = await fetch(
    `${BASE_URL}/recipes/complexSearch?${params}`,
    { headers: { 'x-api-key': API_KEY } }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Search failed (${response.status}): ${err.message || response.statusText}`);
  }

  const data = await response.json();
  return data.results;
}

/**
 * Fetch one random recipe from Spoonacular /recipes/random
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
  return data.recipes[0]; // endpoint always returns an array
}

/**
 * Get full recipe information by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function getRecipeById(id) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    includeNutrition: false, // nutrition handled separately by nutrition.js
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