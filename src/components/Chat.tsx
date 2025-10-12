import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
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
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      
      console.log('=== AZURE MAPS DEBUG ===')
      console.log('Backend response:', r)
      console.log('Response status:', r?.status)
      console.log('Response data_type:', r?.data_type)
      console.log('Has map_config:', !!r?.map_config)
      console.log('Map config keys:', r?.map_config ? Object.keys(r.map_config) : 'none')
      console.log('Has data_points:', !!r?.map_config?.data_points)
      console.log('Data points length:', r?.map_config?.data_points?.length || 0)
      console.log('Current query:', currentQuery)
      console.log('Is Azure Maps query:', currentQuery.toLowerCase().includes('azure maps'))
      
      // NEW: Check for overlay_url in the response
      console.log('=== URL DETECTION DEBUG ===')
      console.log('r.overlay_url:', r?.overlay_url)
      console.log('r.result (type):', typeof r?.result, r?.result)
      console.log('r.content:', r?.content)
      console.log('Full response structure:', JSON.stringify(r, null, 2))
      console.log('=== END URL DEBUG ===')
      console.log('=== END DEBUG ===')

      console.log('=== BACKEND STRUCTURE CHECK ===')
      console.log('Does r.overlay_url exist?', !!r?.overlay_url)
      console.log('r.overlay_url value:', r?.overlay_url)
      console.log('Does r.map_config exist?', !!r?.map_config)
      console.log('Does r.weather_data exist?', !!r?.weather_data)
      console.log('r.data_type:', r?.data_type)
      
      // Check if your backend matches the expected structure
      const expectedStructure = {
        hasOverlayUrl: !!r?.overlay_url,
        hasMapConfig: !!r?.map_config,
        hasDataPoints: !!r?.map_config?.data_points,
        hasWeatherData: !!r?.weather_data,
        isAzureMapsType: r?.data_type === 'azure_maps_interactive'
      }
      console.log('Backend structure check:', expectedStructure)
      console.log('=== END BACKEND CHECK ===')
      
      let imageUrl = null
      let mapData: MapData | undefined
      let cleanContent = r?.content || ''

      // Enhanced Azure Maps detection - check for map_config with data_points
      const isAzureMapsQuery = currentQuery.toLowerCase().includes('azure maps')
      const hasAzureMapsData = r?.map_config && r?.map_config?.data_points && r?.map_config.data_points.length > 0

      console.log('Azure Maps detection result:', hasAzureMapsData)

      if (hasAzureMapsData) {
        console.log('✅ Processing as Azure Maps response')
        console.log('Map config:', r.map_config)
        console.log('Data points count:', r.map_config.data_points.length)
        
        // Extract map configuration from backend response
        const bounds = getMapBounds(currentQuery)
        
        // Use backend center if available, otherwise calculate from bounds
        const backendCenter = r.map_config.center
        const center = backendCenter ? {
          lat: backendCenter[1], // Azure Maps uses [lng, lat]
          lng: backendCenter[0]
        } : {
          lat: (bounds.north + bounds.south) / 2,
          lng: (bounds.east + bounds.west) / 2
        }
        
        console.log('Calculated center:', center)
        console.log('Using bounds:', bounds)
        
        // IMPORTANT: Also look for overlay_url from your new backend structure
        let overlayImageUrl = null
        
        // Check for the new backend structure with overlay_url
        if (r?.overlay_url && r.overlay_url.startsWith('http')) {
          overlayImageUrl = r.overlay_url
        }
        // Fallback: Check if backend returned a regular image URL in result field
        else if (r?.result && typeof r.result === 'string' && r.result.startsWith('http')) {
          overlayImageUrl = r.result
        } 
        // Final fallback: extract URL from content
        else if (r?.content) {
          const urlMatch = r.content.match(/https?:\/\/[^\s]+/)
          overlayImageUrl = urlMatch ? urlMatch[0] : null
        }
        
        console.log('Found overlay image URL:', overlayImageUrl)
        console.log('Response overlay_url field:', r?.overlay_url)
        console.log('Response result field:', r?.result)
        
        // Calculate precise bounds from weather_data arrays
        const weatherData = r.weather_data
        let calculatedBounds = bounds // fallback
        
        if (weatherData && weatherData.longitude && weatherData.latitude) {
          calculatedBounds = {
            west: Math.min(...weatherData.longitude),
            east: Math.max(...weatherData.longitude),
            south: Math.min(...weatherData.latitude), 
            north: Math.max(...weatherData.latitude)
          }
          console.log('Using precise bounds from weather_data:', calculatedBounds)
        }
        
        mapData = {
          map_url: r.overlay_url || '', // Use the backend overlay URL directly
          bounds: calculatedBounds, // Use precise calculated bounds
          center: weatherData?.center ? {
            lat: weatherData.center[1],
            lng: weatherData.center[0] 
          } : center,
          zoom: r.map_config.zoom || 7,
          azureData: {
            map_config: r.map_config,
            temperature_data: r.map_config.data_points
              .filter((point: any) => {
                return point.latitude != null && 
                       point.longitude != null && 
                       point.value != null && 
                       !isNaN(point.value) &&
                       isFinite(point.value)
              })
              .map((point: any) => ({
                latitude: point.latitude,
                longitude: point.longitude,
                value: point.value, // Keep original value
                originalValue: point.value, // Store original for display
                location: point.title || `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`
              })),
            overlay_url: r.overlay_url,
            weather_data: r.weather_data,
            legend: r.map_config.legend,
            data_type: r.data_type,
            variable_info: {
              name: r.weather_data?.variable || 'Unknown',
              unit: r.weather_data?.unit || '',
              displayName: getDisplayName(r.weather_data?.variable)
            },
            raw_response: r
          }
        }
        
        console.log('Created mapData with matplotlib overlay:', overlayImageUrl)
        
        // Clean content for Azure Maps responses
        cleanContent = 'Interactive Azure Maps visualization with temperature data ready.'
        
      } else {
        console.log('❌ Not detected as Azure Maps - processing as regular response')
        // Regular PNG image response - existing logic
        imageUrl = r?.analysis_data?.result?.map_url || null
        // Check if the result field directly contains a URL (your current backend format)
        // Check if the result field directly contains a URL (your current backend format)
        if (!imageUrl && r?.result && typeof r.result === 'string' && r.result.startsWith('http')) {
          imageUrl = r.result
        }
        
        // Fallback: extract URL from content if not in proper structure
        if (!imageUrl && r?.content) {
          const urlMatch = r.content.match(/https?:\/\/[^\s]+/)
          imageUrl = urlMatch ? urlMatch[0] : null
        }
        
        // Clean the content text to remove URLs and unwanted patterns
        cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').replace(/Result:\s*$/, '').trim()
        cleanContent = cleanContent.replace(/^(Temperature map created:|Analysis completed[\.!]*\s*Result:\s*)/i, '').trim()
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
              <div>
                <div className="text-lg font-semibold">Hydrology Copilot</div>
                <div className="text-xs text-gray-500">Ask a question and get a visualization</div>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="p-6 space-y-4 h-[calc(100vh-280px)] overflow-auto bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500">
                <div>Type a query to generate a visualization</div>
                <div className="text-xs text-gray-400 mt-1">
                  💡 Try: "show temperature in Florida" or "show temperature in Florida on azure maps"
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-xl rounded-tr-none' : 'bg-white text-gray-900 rounded-xl rounded-tl-none shadow'} p-4`}>
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                  
                  {/* Interactive Azure Map - Only when mapData exists and has azureData AND valid Azure Maps key */}
                  {m.mapData?.azureData && AZURE_MAPS_KEY && AZURE_MAPS_KEY !== 'your_actual_azure_maps_key_here' && (
                    <div className="mt-3">
                      <AzureMapView 
                        mapData={m.mapData} 
                        subscriptionKey={AZURE_MAPS_KEY}
                        clientId={AZURE_MAPS_CLIENT_ID}
                        height="500px"
                      />
                      <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                        <span className="text-xs">🗺️ Interactive Azure Maps • Zoom, pan, and hover for details</span>
                        <span className="text-xs text-green-600">Live Data</span>
                      </div>
                    </div>
                  )}

                  {/* Fallback: Show static image if no valid Azure Maps key or if it's a regular response */}
                  {((m.imageUrl && !m.mapData?.azureData) || (m.mapData?.azureData && (!AZURE_MAPS_KEY || AZURE_MAPS_KEY === 'your_actual_azure_maps_key_here'))) && (
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