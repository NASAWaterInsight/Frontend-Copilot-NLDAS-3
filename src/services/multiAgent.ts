import { getStableUserId } from '../utils/userIdentity'

const API_BASE_URL = 'http://localhost:7071'

console.log('🔧 API Configuration:', {
  API_BASE_URL,
  ENDPOINT: `${API_BASE_URL}/multi_agent_function`,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  DEV_MODE: import.meta.env.DEV,
  NODE_ENV: import.meta.env.NODE_ENV
})

export async function callMultiAgentFunction(requestData: any) {
  const userId = await getStableUserId()
  const endpoint = `${API_BASE_URL}/multi_agent_function`
  console.log('🚀 Making API call to Azure Functions:', endpoint)
  console.log('User ID:', userId.substring(0, 8) + '...')
  console.log('Request data:', requestData)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(requestData)
  })

  console.log('📡 Response status:', response.status)
  console.log('📡 Response ok:', response.ok)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Response error text:', errorText)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  console.log('📦 Raw Azure Functions response:', data)

  // Transform response to match expected format
  const transformedResponse = {
    response: {
      status: data.status || 'success',
      content: data.content || data.result || data.response || '',
      static_url: data.static_url || data.image_url,
      overlay_url: data.overlay_url,
      geotiff_url: data.geotiff_url,
      geojson: data.geojson,
      bounds: data.bounds,
      use_tiles: Boolean(data.use_tiles),
      tile_config: data.tile_config,
      temperature_data: data.temperature_data || [],
      map_config: data.map_config,
      variable_info: data.variable_info,
      analysis_type: data.analysis_type,
      regions: data.regions,
      extreme_regions: data.extreme_regions,
      type: data.type || 'azure_functions',
      agent_id: data.agent_id,
      thread_id: data.thread_id,
      debug: data.debug,
      analysis_data: data.analysis_data
    }
  }

  console.log('✅ Transformed Azure Functions response:', transformedResponse)
  return transformedResponse
}

export async function testFastAPIConnection(): Promise<boolean> {
  // Test Azure Functions with a minimal POST request
  try {
    const res = await fetch(`${API_BASE_URL}/multi_agent_function`, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: true })
    })
    // Any response (even error) means the service is reachable
    return true
  } catch (error) {
    console.log('Azure Functions connection test failed:', (error as any)?.message)
    return false
  }
}

export async function queryHydrologyCopilot(query: string) {
  return callMultiAgentFunction({ query })
  return callMultiAgentFunction({ query })
}

export { API_BASE_URL }




