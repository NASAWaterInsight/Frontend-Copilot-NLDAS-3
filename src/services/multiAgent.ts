import { getStableUserId } from '../utils/userIdentity'

// Use relative path in development to leverage Vite proxy
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071');

export async function callMultiAgentFunction(requestData: any) {
  // Get stable user ID for conversation memory
  const userId = await getStableUserId()
  
  console.log('Making API call to:', `${API_BASE_URL}/multi_agent_function`);
  console.log('User ID:', userId.substring(0, 8) + '...')
  console.log('Request data:', requestData);

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
  });

  console.log('Response status:', response.status);
  console.log('Response ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Response error text:', errorText);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Get response as text first to handle NaN values
  const responseText = await response.text();
  console.log('Raw response text length:', responseText.length);
  
  try {
    // Replace NaN values with null before parsing
    const sanitizedText = responseText
      .replace(/:\s*NaN/g, ': null')
      .replace(/,\s*NaN/g, ', null')
      .replace(/\[\s*NaN/g, '[null')
      .replace(/NaN\s*,/g, 'null,')
      .replace(/NaN\s*]/g, 'null]');
    
    const data = JSON.parse(sanitizedText);
    return data;
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError);
    console.error('Response text preview:', responseText.substring(0, 500));
    throw new Error(`Invalid JSON response from server: ${parseError}`);
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