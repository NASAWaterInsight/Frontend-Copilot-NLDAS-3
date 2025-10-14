import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
import { getStableUserId, clearUserId, getCurrentUserId } from '../utils/userIdentity'
import type { Message, MapData } from '../types'

// Get Azure Maps credentials from environment variables
const AZURE_MAPS_KEY = import.meta.env.VITE_AZURE_MAPS_SUBSCRIPTION_KEY
const AZURE_MAPS_CLIENT_ID = import.meta.env.VITE_AZURE_MAPS_CLIENT_ID

// Add debug logging
console.log('=== ENVIRONMENT VARIABLES DEBUG ===')
console.log('AZURE_MAPS_KEY loaded:', !!AZURE_MAPS_KEY)
console.log('AZURE_MAPS_KEY value:', AZURE_MAPS_KEY ? `${AZURE_MAPS_KEY.substring(0, 10)}...` : 'NOT FOUND')
console.log('AZURE_MAPS_CLIENT_ID loaded:', !!AZURE_MAPS_CLIENT_ID)
console.log('API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
console.log('=== END ENV DEBUG ===')

export default function Chat() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [debug, setDebug] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize user ID on component mount
  useEffect(() => {
    const initUser = async () => {
      const id = await getStableUserId()
      setUserId(id)
      console.log('Chat initialized for user:', id.substring(0, 8) + '...')
    }
    initUser()
  }, [])

  // Handle new conversation
  const handleNewConversation = () => {
    clearUserId()
    // Generate new user ID on next request
    setUserId('')
    setMessages([])
    setError(null)
    setDebug(null)
    console.log('🔄 Cleared user ID for fresh conversation')
  }

  // Function to determine map bounds based on query
  function getMapBounds(query: string): MapData['bounds'] {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('florida')) {
      return { north: 31.0, south: 24.5, east: -80.0, west: -87.6 }
    }
    if (lowerQuery.includes('california')) {
      return { north: 42.0, south: 32.5, east: -114.1, west: -124.4 }
    }
    if (lowerQuery.includes('maryland')) {
      return { north: 39.7, south: 37.9, east: -75.0, west: -79.5 }
    }
    if (lowerQuery.includes('texas')) {
      return { north: 36.5, south: 25.8, east: -93.5, west: -106.6 }
    }
    
    // Default bounds (continental US)
    return { north: 49.0, south: 25.0, east: -66.0, west: -125.0 }
  }

  // Add this helper function after the getMapBounds function
  function getDisplayName(variable: string): string {
    const variableMap: { [key: string]: string } = {
      // Temperature variables
      'Tair': 'Air Temperature',
      'Tair_f_inst': 'Air Temperature',
      
      // Precipitation variables
      'Rainf_f_tavg': 'Precipitation',
      'Rainf': 'Precipitation',
      'Snowf_tavg': 'Snowfall',
      'Evap_tavg': 'Evaporation',
      
      // Pressure variables
      'Psurf': 'Surface Pressure',
      'Psurf_f_inst': 'Surface Pressure',
      
      // Wind variables
      'Wind_f_inst': 'Wind Speed',
      'Wind_f_tavg': 'Wind Speed',
      'Uwind': 'Wind Speed (U)',
      'Vwind': 'Wind Speed (V)',
      
      // Humidity variables
      'Qair_f_inst': 'Humidity',
      'Qair': 'Humidity',
      'RelHum': 'Relative Humidity',
      
      // Radiation variables
      'SWdown_f_tavg': 'Solar Radiation',
      'SWdown': 'Solar Radiation',
      'LWdown_f_tavg': 'Longwave Radiation',
      'LWdown': 'Longwave Radiation',
      
      // Soil variables
      'SoilMoi0_10cm': 'Soil Moisture',
      'SoilMoi10_40cm': 'Soil Moisture',
      'SoilTemp0_10cm': 'Soil Temperature',
      
      // Energy variables
      'LatHeat': 'Latent Heat',
      'SensHeat': 'Sensible Heat',
      'GrndHeat': 'Ground Heat',
      
      // Water balance
      'Runoff': 'Surface Runoff',
      'Baseflow': 'Baseflow',
      'Streamflow': 'Streamflow'
    }
    return variableMap[variable] || variable.replace(/_/g, ' ').replace(/f inst|f tavg/g, '').trim()
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    const currentQuery = query
    setQuery('')
    setError(null)
    setLoading(true)

    try {
      console.log('Sending request to backend with query:', userMsg.text)
      const resp = await callMultiAgentFunction({ action: 'generate', data: { query: userMsg.text } })
      console.log('Raw backend response:', resp)
      
      const r = resp.response
      
      console.log('=== UNIFIED BACKEND STRUCTURE DEBUG ===')
      console.log('Response status:', r?.status)
      console.log('Has static_url:', !!r?.static_url)
      console.log('Has overlay_url:', !!r?.overlay_url)
      console.log('Has geojson:', !!r?.geojson)
      console.log('Has temperature_data:', !!r?.temperature_data)
      console.log('Has map_config:', !!r?.map_config)
      console.log('Has bounds:', !!r?.bounds)
      console.log('Temperature data count:', r?.temperature_data?.length || 0)
      console.log('GeoJSON features count:', r?.geojson?.features?.length || 0)
      console.log('Map config:', r?.map_config)
      console.log('=== END UNIFIED DEBUG ===')
      
      let imageUrl = null
      let mapData: MapData | undefined
      let cleanContent = r?.content || ''

      // Check for new unified backend structure
      const hasStaticUrl = !!r?.static_url
      const hasOverlayUrl = !!r?.overlay_url
      const hasTemperatureData = !!r?.temperature_data && r.temperature_data.length > 0
      const hasGeoJsonData = !!r?.geojson?.features && r.geojson.features.length > 0
      const hasBounds = !!r?.bounds
      const hasMapConfig = !!r?.map_config

      console.log('Unified backend features:', { 
        hasStaticUrl, hasOverlayUrl, hasTemperatureData, 
        hasGeoJsonData, hasBounds, hasMapConfig 
      })

      if (hasStaticUrl || hasOverlayUrl) {
        console.log('✅ Processing unified backend format')
        
        // Use backend-provided bounds or calculate from temperature_data
        let mapBounds = r.bounds
        let mapCenter = r.map_config?.center
        
        if (!mapBounds && hasTemperatureData) {
          // Calculate bounds from temperature_data if not provided
          const lats = r.temperature_data.map((p: any) => p.latitude)
          const lngs = r.temperature_data.map((p: any) => p.longitude)
          mapBounds = {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
          }
        }
        
        if (!mapCenter && mapBounds) {
          mapCenter = [(mapBounds.west + mapBounds.east) / 2, (mapBounds.north + mapBounds.south) / 2]
        }
        
        // Add padding for map view
        const latPadding = mapBounds ? (mapBounds.north - mapBounds.south) * 0.1 : 1
        const lngPadding = mapBounds ? (mapBounds.east - mapBounds.west) * 0.1 : 1
        const paddedBounds = mapBounds ? {
          north: mapBounds.north + latPadding,
          south: mapBounds.south - latPadding,
          east: mapBounds.east + lngPadding,
          west: mapBounds.west - lngPadding
        } : getMapBounds(currentQuery)
        
        const center = mapCenter ? {
          lat: mapCenter[1],
          lng: mapCenter[0]
        } : {
          lat: paddedBounds ? (paddedBounds.north + paddedBounds.south) / 2 : 39.5,
          lng: paddedBounds ? (paddedBounds.east + paddedBounds.west) / 2 : -98.35
        }
        
        console.log('Final bounds:', paddedBounds)
        console.log('Final center:', center)
        
        // Create unified mapData structure
        mapData = {
          map_url: r.overlay_url || r.static_url || '',
          bounds: paddedBounds,
          center: center,
          zoom: r.map_config?.zoom || 7,
          azureData: {
            // New unified structure
            static_url: r.static_url,
            overlay_url: r.overlay_url,
            temperature_data: r.temperature_data || [],
            geojson: r.geojson,
            bounds: r.bounds,
            map_config: r.map_config,
            
            // Variable info from geojson or temperature_data
            variable_info: {
              name: r.temperature_data?.[0]?.variable || r.geojson?.features?.[0]?.properties?.variable || 'Unknown',
              unit: r.temperature_data?.[0]?.unit || r.geojson?.features?.[0]?.properties?.unit || '',
              displayName: getDisplayName(r.temperature_data?.[0]?.variable || r.geojson?.features?.[0]?.properties?.variable || '')
            },
            
            data_type: 'unified_backend',
            raw_response: r
          }
        }
        
        // Set image URL for fallback display (prefer static for legend)
        imageUrl = r.static_url
        
        // Clean content
        cleanContent = hasTemperatureData 
          ? `Interactive map ready with ${r.temperature_data.length} data points. ${messages.length > 0 ? 'I can reference this map in follow-up questions.' : ''}`
          : 'Map visualization ready. Static and interactive views available.'
        
      } else {
        console.log('❌ Processing as legacy or incomplete response')
        // Fallback for incomplete responses
        imageUrl = r?.static_url || r?.overlay_url || r?.content?.match(/https?:\/\/[^\s]+/)?.[0] || null
        
        if (typeof cleanContent === 'string') {
          cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').replace(/Result:\s*$/, '').trim()
          cleanContent = cleanContent.replace(/^(Temperature map created:|Analysis completed[\.!]*\s*Result:\s*)/i, '').trim()
        }
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: cleanContent || 'Analysis completed.',
        imageUrl: imageUrl,
        mapData: mapData
      }

      setMessages((prev) => [...prev, assistantMsg])
      setDebug((r?.debug ?? r) || null)
      
    } catch (err: any) {
      console.error('Query failed:', err)
      console.error('Error details:', {
        message: err?.message,
        status: err?.status,
        statusText: err?.statusText,
        response: err?.response
      })
      setError(`Connection failed: ${err?.message || 'Unknown error'}`)
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', text: `Request failed: ${err?.message || 'Backend connection error'}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex justify-center items-start pt-8">
        <div className="w-full max-w-6xl bg-white shadow-lg rounded-xl overflow-hidden mx-4">
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">HC</div>
              <div className="flex-1">
                <div className="text-lg font-semibold">Hydrology Copilot</div>
                <div className="text-xs text-gray-500">Ask a question and get a visualization</div>
              </div>
              
              {/* Session info and controls */}
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={handleNewConversation}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
                    title="Start fresh conversation"
                  >
                    🔄 New Chat
                  </button>
                )}
                
                {userId && (
                  <div className="text-xs text-gray-400 flex flex-col items-end">
                    <div>User: {userId.substring(0, 8)}...</div>
                    {messages.length > 0 && (
                      <div className="text-blue-600">
                        💬 Active Session
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="p-6 space-y-4 h-[calc(100vh-280px)] overflow-auto bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500">
                <div>Type a query to generate a visualization</div>
                <div className="text-xs text-gray-400 mt-1">
                  💡 Try: "show temperature in Toronto" - Now with conversation memory!
                </div>
                {userId && (
                  <div className="text-xs text-gray-300 mt-2">
                    Your conversation history helps me provide better context.
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-xl rounded-tr-none' : 'bg-white text-gray-900 rounded-xl rounded-tl-none shadow'} p-4`}>
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                  
                  {/* Show both static and interactive maps when we have GeoJSON data */}
                  {m.mapData?.azureData?.geojson && (
                    <div className="mt-3 space-y-4">
                      {/* Interactive Azure Map */}
                      {AZURE_MAPS_KEY && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">🗺️ Interactive Azure Maps</h4>
                          <AzureMapView 
                            mapData={m.mapData} 
                            subscriptionKey={AZURE_MAPS_KEY}
                            clientId={AZURE_MAPS_CLIENT_ID}
                            height="500px"
                          />
                          <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                            <span className="text-xs">🗺️ Interactive Azure Maps • Click points for details • {m.mapData.azureData.geojson.features.length} data points</span>
                            <span className="text-xs text-green-600">Live Data</span>
                          </div>
                        </div>
                      )}

                      {/* Static Map */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">📊 Static Map with Legend</h4>
                        <div className="border rounded-md overflow-hidden bg-white" style={{ height: '400px' }}>
                          <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={4}
                            centerOnInit={true}
                            wheel={{ step: 0.1 }}
                            pinch={{ step: 5 }}
                            doubleClick={{ mode: 'toggle', step: 0.7 }}
                          >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                              <>
                                <div className="absolute top-2 left-2 z-10 flex gap-1">
                                  <button onClick={() => zoomIn()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm">+</button>
                                  <button onClick={() => zoomOut()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm">−</button>
                                  <button onClick={() => resetTransform()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm">⌂</button>
                                </div>
                                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img src={m.mapData.azureData.static_url} alt="Static map with legend" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} draggable={false} />
                                </TransformComponent>
                              </>
                            )}
                          </TransformWrapper>
                        </div>
                        <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                          <span className="text-xs">💡 Scroll to zoom, drag to pan, double-click to toggle zoom</span>
                          <a href={m.mapData.azureData.static_url} download="static-map-with-legend.png" className="text-indigo-600 hover:text-indigo-800 text-xs">Download</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fallback: Show static image only if no GeoJSON data */}
                  {!m.mapData?.azureData?.geojson && m.imageUrl && (
                    <div className="mt-3">
                      <div className="border rounded-md overflow-hidden bg-white" style={{ height: '500px' }}>
                        <TransformWrapper
                          initialScale={1}
                          minScale={0.5}
                          maxScale={4}
                          centerOnInit={true}
                          wheel={{ step: 0.1 }}
                          pinch={{ step: 5 }}
                          doubleClick={{ mode: 'toggle', step: 0.7 }}
                        >
                          {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                              <div className="absolute top-2 left-2 z-10 flex gap-1">
                                <button onClick={() => zoomIn()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm" title="Zoom In">+</button>
                                <button onClick={() => zoomOut()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm" title="Zoom Out">−</button>
                                <button onClick={() => resetTransform()} className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm" title="Reset">⌂</button>
                              </div>
                              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={m.imageUrl} alt="visualization" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} draggable={false} />
                              </TransformComponent>
                            </>
                          )}
                        </TransformWrapper>
                      </div>
                      <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                        <span className="text-xs">💡 Scroll to zoom, drag to pan, double-click to toggle zoom</span>
                        <a href={m.imageUrl} download="visualization.png" className="text-indigo-600 hover:text-indigo-800 text-xs">Download</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about hydrology data... (add 'azure maps' for interactive maps)"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Send'}
              </button>
            </div>
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          </form>

          {debug && (
            <details className="p-4 border-t bg-gray-50">
              <summary className="cursor-pointer text-sm text-gray-600">Debug Info</summary>
              <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(debug, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}