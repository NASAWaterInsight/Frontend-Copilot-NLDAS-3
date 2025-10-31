import { getStableUserId } from '../utils/userIdentity'

const API_BASE_URL = 'http://localhost:8000'

console.log('🔧 API Configuration:', {
  API_BASE_URL,
  ENDPOINT: `${API_BASE_URL}/api/chat`,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  DEV_MODE: import.meta.env.DEV,
  NODE_ENV: import.meta.env.NODE_ENV
})

export async function callMultiAgentFunction(requestData: any) {
  const userId = await getStableUserId()
  const endpoint = `${API_BASE_URL}/api/chat`
  console.log('🚀 Making API call to FastAPI:', endpoint)
  console.log('User ID:', userId.substring(0, 8) + '...')
  console.log('Request data:', requestData)

  const query = requestData.data?.query || requestData.query || requestData

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify({ query, user_id: userId })
  })

  console.log('📡 Response status:', response.status)
  console.log('📡 Response ok:', response.ok)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Response error text:', errorText)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  console.log('📦 Raw FastAPI response:', data)
  console.log('📦 Raw response keys:', Object.keys(data))
  console.log('📦 Tile config in raw response:', data.tile_config)
  console.log('📦 Use tiles in raw response:', data.use_tiles)

  // ✅ ADD COMPREHENSIVE TILE DEBUG
  if (data.tile_config) {
    console.log('🔍 ===== BACKEND TILE CONFIG ANALYSIS =====')
    console.log('🔍 tile_config keys:', Object.keys(data.tile_config))
    console.log('🔍 tile_list exists:', !!data.tile_config.tile_list)
    console.log('🔍 tile_list type:', typeof data.tile_config.tile_list)
    console.log('🔍 tile_list is array:', Array.isArray(data.tile_config.tile_list))
    console.log('🔍 tile_list length:', data.tile_config.tile_list?.length)
    console.log('🔍 Full tile_list:', data.tile_config.tile_list)
    
    if (data.tile_config.tile_list && Array.isArray(data.tile_config.tile_list) && data.tile_config.tile_list.length > 0) {
      console.log('🔍 First tile in list:', data.tile_config.tile_list[0])
      console.log('🔍 First tile URL:', data.tile_config.tile_list[0]?.url)
      console.log('🔍 First tile bounds:', data.tile_config.tile_list[0]?.bounds)
    }
    console.log('🔍 ===== END TILE CONFIG ANALYSIS =====')
  }

  const transformedResponse = {
    response: {
      status: data.status,
      content: data.content,
      static_url: data.static_url,
      overlay_url: data.overlay_url,
      geojson: data.geojson,
      bounds: data.bounds,
      use_tiles: Boolean(data.use_tiles),
      tile_config: data.tile_config ? {
        tile_url: data.tile_config.tile_url,
        variable: data.tile_config.variable,
        date: data.tile_config.date,
        min_zoom: data.tile_config.min_zoom || 3,
        max_zoom: data.tile_config.max_zoom || 10,
        tile_size: data.tile_config.tile_size || 256,
        bounds_endpoint: data.tile_config.bounds_endpoint,
        // ✅ CRITICAL FIX: Pass through tile_list from backend
        tile_list: data.tile_config.tile_list,
        region_bounds: data.tile_config.region_bounds,
        tile_count: data.tile_config.tile_count,
        color_scale: data.tile_config.color_scale
      } : undefined,
      temperature_data: data.geojson?.features ? data.geojson.features
        .filter((f: any) => {
          const lat = f.geometry?.coordinates?.[1]
          const lng = f.geometry?.coordinates?.[0]
          const value = f.properties?.value
          return (
            f && f.geometry && f.properties &&
            typeof lat === 'number' && isFinite(lat) &&
            typeof lng === 'number' && isFinite(lng) &&
            typeof value === 'number' && isFinite(value)
          )
        })
        .map((f: any) => ({
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          value: f.properties.value,
          variable: f.properties.variable || 'temperature',
          unit: f.properties.unit || '°C'
        })) : [],
      map_config: data.bounds ? {
        zoom: data.map_config?.zoom || 6,
        center: [
          (data.bounds.west + data.bounds.east) / 2,
          (data.bounds.north + data.bounds.south) / 2
        ],
        style: data.map_config?.style || 'satellite',
        overlay_mode: data.map_config?.overlay_mode !== false
      } : undefined,
      variable_info: data.variable_info,
      analysis_type: data.analysis_type,
      regions: data.regions,
      extreme_regions: data.extreme_regions,
      type: data.type,
      agent_id: data.agent_id,
      thread_id: data.thread_id,
      debug: data.debug,
      analysis_data: data.analysis_data
    }
  }

  console.log('✅ Transformed FastAPI response:', transformedResponse)
  console.log('✅ Temperature data count:', transformedResponse.response.temperature_data.length)
  console.log('✅ Use tiles:', transformedResponse.response.use_tiles)
  console.log('✅ Tile config after transformation:', transformedResponse.response.tile_config)
  
  // ✅ VERIFY TILE_LIST SURVIVAL
  if (transformedResponse.response.tile_config) {
    console.log('🔍 ===== TRANSFORMATION VERIFICATION =====')
    console.log('🔍 tile_list survived transformation:', !!transformedResponse.response.tile_config.tile_list)
    console.log('🔍 tile_list after transformation:', transformedResponse.response.tile_config.tile_list)
    console.log('🔍 ===== END VERIFICATION =====')
  }

  if (transformedResponse.response.use_tiles && !transformedResponse.response.tile_config) {
    console.warn('⚠️ use_tiles true but tile_config undefined')
  }

  if (transformedResponse.response.use_tiles && !transformedResponse.response.tile_config?.tile_url) {
    console.error('❌ use_tiles is true but tile_config is missing tile_url. Disabling tiles.')
    transformedResponse.response.use_tiles = false
  }

  return transformedResponse
}

export async function testFastAPIConnection(): Promise<boolean> {
  const tryFetch = async (path: string, init?: RequestInit) => {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, init)
      return res.ok || (path === '/api/chat' && res.status === 405)
    } catch {
      return false
    }
  }
  if (await tryFetch('/api/health')) return true
  if (await tryFetch('/docs')) return true
  if (await tryFetch('/api/chat', { method: 'OPTIONS' })) return true
  if (await tryFetch('/', { method: 'HEAD' })) return true
  return false
}

export async function queryHydrologyCopilot(query: string) {
  return callMultiAgentFunction({ query })
}

export { API_BASE_URL }