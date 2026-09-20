import { createStore, get, set, del } from 'idb-keyval'

// Custom IndexedDB database and store for security isolation
const keyVault = createStore('ResearchRAG_Vault', 'user_api_keys')

let inMemoryApiKey = ''

/**
 * Get the currently cached API key for synchronous HTTP header attachment.
 */
export function getActiveApiKey() {
  return inMemoryApiKey
}

/**
 * Set the in-memory cache.
 */
export function setActiveApiKey(key) {
  inMemoryApiKey = key ? key.trim() : ''
}

/**
 * Load a user's Groq API key from IndexedDB into memory.
 */
export async function loadUserApiKey(userId) {
  if (!userId) {
    inMemoryApiKey = ''
    return ''
  }
  try {
    const key = await get(`groq_key_${userId}`, keyVault)
    inMemoryApiKey = key || ''
    return inMemoryApiKey
  } catch (err) {
    console.error('[IDB] Failed to load user API key:', err)
    inMemoryApiKey = ''
    return ''
  }
}

/**
 * Persist user's Groq API key in IndexedDB.
 * Retained across reloads/sessions until user logs out.
 */
export async function saveUserApiKey(userId, apiKey) {
  if (!userId) return
  const cleanKey = (apiKey || '').trim()
  try {
    if (cleanKey) {
      await set(`groq_key_${userId}`, cleanKey, keyVault)
      inMemoryApiKey = cleanKey
    } else {
      await del(`groq_key_${userId}`, keyVault)
      inMemoryApiKey = ''
    }
    return inMemoryApiKey
  } catch (err) {
    console.error('[IDB] Failed to save user API key:', err)
    throw err
  }
}

/**
 * Drop user's API key from IndexedDB upon logout.
 */
export async function dropUserApiKey(userId) {
  inMemoryApiKey = ''
  if (!userId) return
  try {
    await del(`groq_key_${userId}`, keyVault)
    console.log('[IDB] Dropped user API key from IndexedDB on logout.')
  } catch (err) {
    console.error('[IDB] Failed to drop user API key on logout:', err)
  }
}
