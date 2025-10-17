import { getStableUserId } from '../utils/userIdentity'

// Use relative path in development to leverage Vite proxy
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071')

export async function callMultiAgentFunction(requestData: any) {
  // Get stable user ID for conversation memory
  const userId = await getStableUserId()
  
  console.log('Making API call to:', `${API_BASE_URL}/multi_agent_function`)
  console.log('User ID:', userId.substring(0, 8) + '...')
  console.log('Request data:', requestData)

  // Extract the query from the request data structure
  const query = requestData.data?.query || requestData.query || requestData

  const response = await fetch(`${API_BASE_URL}/multi_agent_function`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId  // Send user ID in header for backend memory
    },
    body: JSON.stringify({ 
      query: query,
      user_id: userId  // Also send in body for backend processing
    }),
  })

  console.log('Response status:', response.status)
  console.log('Response ok:', response.ok)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Response error text:', errorText)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // Get response as text first to handle NaN values
  const responseText = await response.text()
  console.log('Raw response text length:', responseText.length)
  
  try {
    // ✅ IMPROVED: More comprehensive NaN sanitization
    const sanitizedText = responseText
      // Handle NaN in various contexts
      .replace(/:\s*NaN\s*([,\}])/g, ': null$1')
      .replace(/,\s*NaN\s*([,\]\}])/g, ', null$1')
      .replace(/\[\s*NaN\s*([,\]])/g, '[null$1')
      .replace(/NaN\s*,/g, 'null,')
      .replace(/NaN\s*\]/g, 'null]')
      .replace(/NaN\s*\}/g, 'null}')
      // Handle Infinity
      .replace(/:\s*Infinity\s*([,\}])/g, ': null$1')
      .replace(/:\s*-Infinity\s*([,\}])/g, ': null$1')
      // Handle standalone NaN
      .replace(/\bNaN\b/g, 'null')
    
    const data = JSON.parse(sanitizedText)
    
    // ✅ Additional validation: recursively check for NaN in parsed data
    validateAndCleanData(data)
    
    return data
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError)
    console.error('Response text preview:', responseText.substring(0, 1000))
    throw new Error(`Invalid JSON response from server: ${parseError}`)
  }
}

// ✅ Helper function to recursively clean data
function validateAndCleanData(obj: any): void {
  if (obj === null || obj === undefined) return
  
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'number' && !isFinite(obj[i])) {
        console.warn(`🧹 Replaced non-finite number at index ${i}:`, obj[i])
        obj[i] = null
      } else if (typeof obj[i] === 'object') {
        validateAndCleanData(obj[i])
      }
    }
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      if (typeof obj[key] === 'number' && !isFinite(obj[key])) {
        console.warn(`🧹 Replaced non-finite number at key '${key}':`, obj[key])
        obj[key] = null
      } else if (typeof obj[key] === 'object') {
        validateAndCleanData(obj[key])
      }
    }
  }
}

// Alternative function that matches the backend example more closely
export async function queryHydrologyCopilot(query: string) {
  const userId = await getStableUserId()
  
  const response = await fetch(`${API_BASE_URL}/multi_agent_function`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify({ 
      query: query, 
      user_id: userId 
    })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}