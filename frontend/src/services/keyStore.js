import { createStore, get, set, del } from 'idb-keyval'

// Custom IndexedDB database and store for security isolation
const keyVault = createStore('ResearchRAG_Vault', 'user_api_keys')

let inMemoryApiKey = ''

// Fixed client-side salt for key derivation
const VAULT_SALT = new TextEncoder().encode('ResearchRAG_Client_Vault_Salt_v2_2026')

/**
 * Derive an AES-GCM 256-bit encryption key using Web Crypto API.
 */
async function getCryptoKey(userId) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`rrag_vault_entropy_${userId || 'anonymous'}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: VAULT_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a plaintext API key with AES-GCM 256-bit before storing in IndexedDB.
 */
async function encryptWithAES(plainText, userId) {
  if (!plainText) return null
  const cryptoKey = await getCryptoKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit random IV
  const encoded = new TextEncoder().encode(plainText)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  )

  return {
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipherBuffer)),
    encrypted: true,
    version: 2,
  }
}

/**
 * Decrypt an AES-GCM encrypted payload from IndexedDB.
 */
async function decryptWithAES(payload, userId) {
  if (!payload) return ''
  // Backwards compatibility for unencrypted string
  if (typeof payload === 'string') {
    return payload
  }
  if (!payload.cipher || !payload.iv) return ''

  try {
    const cryptoKey = await getCryptoKey(userId)
    const iv = new Uint8Array(payload.iv)
    const cipher = new Uint8Array(payload.cipher)

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      cipher
    )

    return new TextDecoder().decode(decryptedBuffer)
  } catch (err) {
    console.warn('[IDB Vault] Decryption failed or corrupted record:', err)
    return ''
  }
}

/**
 * Get the currently cached plaintext API key in memory (for synchronous HTTP header injection).
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
 * Mask an API key for safe UI display (e.g. gsk_••••••••••••••••Wk2q).
 */
export function maskApiKey(key) {
  if (!key) return ''
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••••'
  const start = trimmed.slice(0, 4)
  const end = trimmed.slice(-4)
  return `${start}••••••••••••••••${end}`
}

/**
 * Load a user's Groq API key from IndexedDB, decrypt it with AES-GCM, and cache in memory.
 */
export async function loadUserApiKey(userId) {
  if (!userId) {
    inMemoryApiKey = ''
    return ''
  }
  try {
    const encryptedPayload = await get(`groq_key_${userId}`, keyVault)
    if (!encryptedPayload) {
      inMemoryApiKey = ''
      return ''
    }
    const decrypted = await decryptWithAES(encryptedPayload, userId)
    inMemoryApiKey = decrypted || ''
    return inMemoryApiKey
  } catch (err) {
    console.error('[IDB Vault] Failed to load/decrypt user API key:', err)
    inMemoryApiKey = ''
    return ''
  }
}

/**
 * Encrypt and persist user's Groq API key in IndexedDB with AES-GCM 256-bit.
 * Retained across reloads/sessions until user logs out.
 */
export async function saveUserApiKey(userId, apiKey) {
  if (!userId) return
  const cleanKey = (apiKey || '').trim()
  try {
    if (cleanKey) {
      const encrypted = await encryptWithAES(cleanKey, userId)
      await set(`groq_key_${userId}`, encrypted, keyVault)
      inMemoryApiKey = cleanKey
    } else {
      await del(`groq_key_${userId}`, keyVault)
      inMemoryApiKey = ''
    }
    return inMemoryApiKey
  } catch (err) {
    console.error('[IDB Vault] Failed to encrypt & save user API key:', err)
    throw err
  }
}

/**
 * Drop user's encrypted API key from IndexedDB upon logout.
 */
export async function dropUserApiKey(userId) {
  inMemoryApiKey = ''
  if (!userId) return
  try {
    await del(`groq_key_${userId}`, keyVault)
    console.log('[IDB Vault] Securely dropped user API key on logout.')
  } catch (err) {
    console.error('[IDB Vault] Failed to drop user API key on logout:', err)
  }
}
