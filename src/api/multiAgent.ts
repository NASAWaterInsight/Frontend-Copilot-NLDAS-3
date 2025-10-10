import type { MultiAgentRequest, MultiAgentResponse } from '../types'

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || '/multi_agent_function'

export async function callMultiAgentFunction(data: MultiAgentRequest): Promise<MultiAgentResponse> {
  // Use the Azure Function URL instead of local proxy
  const endpoint = `${API_URL}/multi_agent_function`
  
  console.log('Making API call to:', endpoint)
  console.log('Request data:', data)
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Response error text:', errorText)
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
    }

    const responseText = await response.text()
    console.log('Raw response length:', responseText.length)
    
    // Log sections to find NaN
    console.log('Response start (500 chars):', responseText.substring(0, 500))
    
    // Find all NaN occurrences and their context
    let nanIndex = responseText.indexOf('NaN')
    let nanCount = 0
    while (nanIndex !== -1 && nanCount < 5) {
      console.log(`NaN #${nanCount + 1} at position ${nanIndex}:`)
      console.log('Context:', responseText.substring(Math.max(0, nanIndex - 50), nanIndex + 50))
      nanIndex = responseText.indexOf('NaN', nanIndex + 1)
      nanCount++
    }
    
    try {
      // More aggressive NaN cleanup with different patterns
      let cleanedResponse = responseText
        // Handle NaN in various contexts
        .replace(/:\s*NaN\b/g, ': null')
        .replace(/:\s*nan\b/g, ': null') 
        .replace(/:\s*NAN\b/g, ': null')
        .replace(/,\s*NaN\b/g, ', null')
        .replace(/\[\s*NaN\b/g, '[null')
        .replace(/\s+NaN\s*,/g, ' null,')
        .replace(/\s+NaN\s*\]/g, ' null]')
        .replace(/\s+NaN\s*\}/g, ' null}')
        // Handle quoted NaN
        .replace(/"NaN"/g, 'null')
        .replace(/'NaN'/g, 'null')
        // Handle Infinity values
        .replace(/:\s*Infinity\b/g, ': null')
        .replace(/:\s*-Infinity\b/g, ': null')
        // Handle undefined
        .replace(/:\s*undefined\b/g, ': null')
      
      console.log('Cleaned response start (500 chars):', cleanedResponse.substring(0, 500))
      
      // Check if any NaN still exists
      if (cleanedResponse.includes('NaN')) {
        console.error('NaN still exists after cleaning!')
        let remainingNaN = cleanedResponse.indexOf('NaN')
        console.error('Remaining NaN context:', cleanedResponse.substring(Math.max(0, remainingNaN - 50), remainingNaN + 50))
      }
      
      const result = JSON.parse(cleanedResponse)
      console.log('Successfully parsed JSON response')
      return result
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Parse error message:', (parseError as Error).message)
      
      // Last resort: try to manually fix the JSON
      try {
        console.log('Attempting manual JSON fix...')
        let manualFix = responseText
          .replace(/NaN/g, 'null')  // Replace ALL occurrences
          .replace(/Infinity/g, 'null')
          .replace(/-Infinity/g, 'null')
          .replace(/undefined/g, 'null')
        
        const result = JSON.parse(manualFix)
        console.log('Manual fix successful!')
        return result
      } catch (manualError) {
        console.error('Manual fix also failed:', manualError)
        throw new Error(`Invalid JSON response: ${parseError}`)
      }
    }
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}
