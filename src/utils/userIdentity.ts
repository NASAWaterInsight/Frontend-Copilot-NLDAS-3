/**
 * Get or generate a stable user ID for persistent memory
 * Hierarchy:
 * 1. Check for authenticated user (if you have auth)
 * 2. Check localStorage for existing UUID
 * 3. Generate new UUID and store it
 */
export async function getStableUserId(): Promise<string> {
  // Priority 1: If you have authenticated users
  const authenticatedUserId = getAuthenticatedUser()
  if (authenticatedUserId) {
    return await hashEmail(authenticatedUserId) // Hash for privacy
  }

  // Priority 2: Check localStorage for existing UUID
  const STORAGE_KEY = 'hydrology_copilot_user_id'
  let userId = localStorage.getItem(STORAGE_KEY)
  
  if (!userId) {
    // Priority 3: Generate new UUID
    userId = generateUUID()
    localStorage.setItem(STORAGE_KEY, userId)
    console.log('Generated new stable user ID:', userId.substring(0, 8) + '...')
  }
  
  return userId
}

/**
 * Get authenticated user ID if available
 * Modify this based on your authentication system
 */
function getAuthenticatedUser(): string | null {
  // Example: If using Azure AD or similar
  // const user = getCurrentUser();
  // return user?.email || user?.id || null;
  
  // Check for potential email sources
  const email = getCurrentUserEmail()
  return email
}

/**
 * Placeholder for potential email detection (can be implemented later)
 */
function getCurrentUserEmail(): string | null {
  // This could check for:
  // - Azure AD authentication: window.msal?.getAccount()?.username
  // - Google OAuth: gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail()
  // - Local authentication state: sessionStorage.getItem('user_email')
  // - URL parameters: new URLSearchParams(location.search).get('email')
  
  return null // No auth system yet
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Hash email for privacy-preserving identification
 */
export async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 32) // First 32 chars
}

/**
 * Clear stored user ID (for testing or logout)
 */
export function clearUserId(): void {
  localStorage.removeItem('hydrology_copilot_user_id')
  console.log('Cleared stored user ID')
}

/**
 * Get current user ID without generating a new one
 */
export function getCurrentUserId(): string | null {
  return localStorage.getItem('hydrology_copilot_user_id')
}
