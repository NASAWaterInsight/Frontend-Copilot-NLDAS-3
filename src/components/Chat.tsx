import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction, testFastAPIConnection } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
import { getStableUserId, clearUserId } from '../utils/userIdentity'
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
  const [threadId, setThreadId] = useState<string | null>(null)
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
      
      console.log('🔧 Testing FastAPI connection...')
      const fastApiWorking = await testFastAPIConnection()
      if (fastApiWorking) {
        console.log('✅ FastAPI server is working!')
      } else {
        console.error('❌ FastAPI server not responding')
      }
    }
    initUser()
  }, [])

  // Handle new conversation
  const handleNewConversation = () => {
    clearUserId()
    setUserId('')
    setThreadId(null)
    setMessages([])
    setError(null)
    setDebug(null)
    console.log('🔄 Cleared user ID and thread ID for fresh conversation')
  }

  // Debug function
  const forceDebugLog = () => {
    console.log('🔥 FORCE DEBUG LOG TEST')
    console.log('Environment variables:', {
      AZURE_KEY: !!AZURE_MAPS_KEY,
      API_URL: import.meta.env.VITE_API_BASE_URL,
      DEV_MODE: import.meta.env.DEV
    })
    console.log('Current messages:', messages.length)
    console.log('Current userId:', userId ? userId.substring(0, 8) + '...' : 'none')
    console.log('Current threadId:', threadId ? threadId.substring(0, 12) + '...' : 'none')
    
    testFastAPIConnection().then(working => {
      console.log('🔧 FastAPI connection test result:', working)
    })
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
    if (lowerQuery.includes('michigan')) {
      return { north: 48.3, south: 41.7, east: -82.4, west: -90.4 }
    }
    
    return { north: 49.0, south: 25.0, east: -66.0, west: -125.0 }
  }

  // Helper function for display names
  function getDisplayName(variable: string): string {
    const variableMap: { [key: string]: string } = {
      'Tair': 'Air Temperature',
      'Rainf': 'Precipitation',
      'Wind_E': 'Wind (East Component)',
      'Wind_N': 'Wind (North Component)',
      'Wind_Speed': 'Wind Speed',
      'wind_speed': 'Wind Speed',
      // ✅ FIXED: Add proper humidity mappings
      'Qair': 'Specific Humidity',
      'Qair_f_inst': 'Specific Humidity',
      'RelHum': 'Relative Humidity',
      'humidity': 'Relative Humidity',
      'SPI': 'SPI (Drought Index)',
      'SPI3': 'SPI-3 (1-Month Drought)',
      'spi': 'SPI (Drought Index)',
      'temperature': 'Temperature'
    }
    return variableMap[variable] || variable.replace(/_/g, ' ')
  }

  // Helper function to get variable unit
  function getVariableUnit(variable: string): string {
    const unitMap: { [key: string]: string } = {
      'Tair': '°C',
      'temperature': '°C',
      'Rainf': 'mm/hr',
      'Wind_Speed': 'm/s',
      'wind_speed': 'm/s',
      'Wind_E': 'm/s',
      'Wind_N': 'm/s',
      // ✅ FIXED: Add proper humidity units
      'Qair': 'kg/kg',
      'Qair_f_inst': 'kg/kg',
      'RelHum': '%',
      'humidity': '%',
      'SPI': '',
      'SPI3': '',
      'spi': ''
    }
    return unitMap[variable] || ''
  }

  // ✅ NEW: Helper function for smart number formatting
  function formatValueWithPrecision(value: number, variable: string): string {
    if (!isFinite(value)) return 'N/A'
    
    // Determine appropriate decimal places based on variable type and value magnitude
    if (variable.toLowerCase().includes('qair') || variable.toLowerCase().includes('humidity')) {
      // For humidity values (often very small decimals like 0.006430634782494356)
      if (Math.abs(value) < 0.001) {
        return value.toExponential(2) // Scientific notation for very small values
      } else if (Math.abs(value) < 0.1) {
        return value.toFixed(4) // 4 decimal places for small values
      } else {
        return value.toFixed(2) // 2 decimal places for larger values
      }
    } else if (variable.toLowerCase().includes('temp')) {
      // Temperature values
      return value.toFixed(1)
    } else if (variable.toLowerCase().includes('precip') || variable.toLowerCase().includes('rain')) {
      // Precipitation values
      return value.toFixed(2)
    } else if (variable.toLowerCase().includes('spi')) {
      // SPI values (drought index)
      return value.toFixed(2)
    } else if (variable.toLowerCase().includes('wind')) {
      // Wind speed values
      return value.toFixed(1)
    } else {
      // Default: dynamic precision based on magnitude
      if (Math.abs(value) < 0.001) {
        return value.toExponential(2)
      } else if (Math.abs(value) < 0.1) {
        return value.toFixed(4)
      } else if (Math.abs(value) < 10) {
        return value.toFixed(3)
      } else {
        return value.toFixed(1)
      }
    }
  }

  // ✅ UPDATED: Helper function to extract both markdown images AND links
  function extractMarkdownImage(text: string): { imageUrl: string | null, cleanText: string } {
    // Check for markdown image syntax first: ![...](url)
    let markdownImageMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    
    if (markdownImageMatch) {
      const imageUrl = markdownImageMatch[1]
      const cleanText = text
        .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)/g, '') // Remove markdown images
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\)/g, '') // Remove markdown links  
        .trim()
        .replace(/\n\s*\n/g, '\n') // Clean up extra newlines
      
      console.log('📷 Detected markdown IMAGE syntax, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    
    // ✅ NEW: Also check for markdown link syntax: [...](url) pointing to image files
    const markdownLinkMatch = text.match(/\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*)\)/i)
    
    if (markdownLinkMatch) {
      const imageUrl = markdownLinkMatch[1]
      const cleanText = text
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*\)/gi, '') // Remove markdown links to images
        .trim()
        .replace(/\n\s*\n/g, '\n') // Clean up extra newlines
      
      console.log('📷 Detected markdown LINK to image file, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    
    // No markdown detected - return original text unchanged
    return { imageUrl: null, cleanText: text }
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
      
      const resp = await callMultiAgentFunction({ 
        action: 'generate', 
        data: { 
          query: userMsg.text,
          user_id: userId,
          thread_id: threadId
        } 
      })
      
      console.log('Raw backend response:', resp)
      const r = resp.response
      
      // Store thread_id from response
      if (r?.thread_id) {
        setThreadId(r.thread_id)
        console.log('💾 Stored thread_id:', r.thread_id.substring(0, 12) + '...')
      }

      // ✅ PRIORITY 1: CHECK FOR ERRORS (highest priority)
      let hasError = false
      let errorMessage = ''

      // Check multiple locations for errors
      if (r?.status === 'error' || r?.analysis_data?.status === 'error') {
        hasError = true
        errorMessage = r?.error || r?.analysis_data?.error || 'An error occurred during analysis'
        console.log('❌ Error detected:', errorMessage)
      }

      // If error, show it immediately and skip processing
      if (hasError) {
        const errorMsg: Message = {
          id: String(Date.now() + 1),
          role: 'assistant',
          text: `⚠️ Error: ${errorMessage}\n\n${r?.analysis_data?.suggestion ? `💡 Suggestion: ${r.analysis_data.suggestion}` : ''}`
        }
        setMessages((prev) => [...prev, errorMsg])
        setDebug((r?.debug ?? r) || null)
        setLoading(false)
        return
      }

      // ✅ PRIORITY 2: EXTRACT TEXT RESULT
      let cleanContent = ''
      
      // Check analysis_data.result first (text answers like "The average wind speed is 3.41 m/s")
      if (r?.analysis_data?.status === 'success' && r?.analysis_data?.result) {
        if (typeof r.analysis_data.result === 'string') {
          const hasUrl = /https?:\/\/[^\s]+/.test(r.analysis_data.result)
          if (!hasUrl) {
            // Pure text result
            cleanContent = r.analysis_data.result
            console.log('📝 Using text result from analysis_data.result:', cleanContent)
          }
        }
      }

      // Fallback to content field if no result was found
      if (!cleanContent && r?.content) {
        cleanContent = typeof r.content === 'string' ? r.content : ''
      }

      // ✅ NEW: Check for markdown image OR link syntax and extract if present
      let markdownExtractedUrl = null
      if (typeof cleanContent === 'string' && 
          (cleanContent.includes('![') || (cleanContent.includes('[') && cleanContent.includes('](')))) {
        const extracted = extractMarkdownImage(cleanContent)
        if (extracted.imageUrl) {
          markdownExtractedUrl = extracted.imageUrl
          cleanContent = extracted.cleanText
          console.log('✅ Processed markdown syntax, using extracted URL')
        }
      }

      // ✅ ONLY strip URLs if NOT from markdown (preserve existing behavior)
      if (!markdownExtractedUrl && typeof cleanContent === 'string' && cleanContent) {
        const hasSubstantialText = cleanContent.length > 30 && /[a-zA-Z]/.test(cleanContent)
        const looksLikeAnswer = /\b(is|are|average|total|maximum|minimum|speed|temperature|value)\b/i.test(cleanContent)
        
        // Only strip URLs if it doesn't look like a text answer
        if (!looksLikeAnswer || cleanContent.includes('Analysis completed')) {
          cleanContent = cleanContent.replace(/^Analysis completed:?.*$/im, '').trim()
          cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
          cleanContent = cleanContent.replace(/\n\s*\n/g, '\n').trim()
        }
      }

      // Default message if still empty
      if (!cleanContent || cleanContent.trim() === '') {
        cleanContent = 'Analysis completed successfully.'
      }

      console.log('=== PROCESSING RESPONSE ===')
      console.log('Final cleanContent:', cleanContent)
      console.log('static_url:', r?.static_url)
      console.log('geojson features:', r?.geojson?.features?.length)
      console.log('=== END PROCESSING ===')

      const hasGeoTiffUrl = !!(r?.geotiff_url)
      const hasStaticUrl = !!(r?.static_url)
      const hasOverlayUrl = !!(r?.overlay_url)
      let hasGeoJsonData = !!(r?.geojson?.features?.length > 0)

      let imageUrl = null
      let mapData: MapData | undefined

      // ✅ NORMALIZE GEOJSON DATA (fix property names)
      if (hasGeoJsonData) {
        console.log('🔍 Processing GeoJSON data...')
        
        r.geojson.features = r.geojson.features
          .filter((f: any) => {
            const lat = f.geometry?.coordinates?.[1]
            const lng = f.geometry?.coordinates?.[0]
            // Check for value in multiple possible property names
            const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
            
            const isValid = isFinite(lat) && isFinite(lng) && isFinite(value)
            if (!isValid) {
              console.warn('❌ Invalid GeoJSON feature:', { lat, lng, value, properties: f.properties })
            }
            return isValid
          })
          .map((f: any) => {
            // Normalize property names - ensure 'value' exists
            const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
            const variable = f.properties?.variable || 'spi'
            
            return {
              ...f,
              properties: {
                ...f.properties,
                value: value,  // ✅ Ensure 'value' property exists
                variable: variable,
                unit: getVariableUnit(variable),
                displayName: getDisplayName(variable)
              }
            }
          })
        
        hasGeoJsonData = r.geojson.features.length > 0
        console.log(`✅ Normalized ${r.geojson.features.length} GeoJSON features`)
      }

      const variable = r?.variable || 'temperature'

      // Build mapData if map artifacts exist
      if (hasStaticUrl || hasOverlayUrl || hasGeoJsonData || hasGeoTiffUrl) {
        console.log('✅ Building mapData from backend artifacts')
        
        let mapBounds = null
        let mapCenter = r.map_config?.center
        
        if (r.bounds && isFinite(r.bounds.north) && isFinite(r.bounds.south) && 
            isFinite(r.bounds.east) && isFinite(r.bounds.west)) {
          mapBounds = r.bounds
          console.log('📊 Using backend bounds:', mapBounds)
        } 
        else if (hasGeoJsonData) {
          const validCoords = r.geojson.features
            .map((f: any) => ({
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0]
            }))
            .filter((coord: any) => isFinite(coord.lat) && isFinite(coord.lng))
          
          if (validCoords.length > 0) {
            const lats = validCoords.map((c: any) => c.lat)
            const lngs = validCoords.map((c: any) => c.lng)
            mapBounds = {
              north: Math.max(...lats), 
              south: Math.min(...lats),
              east: Math.max(...lngs), 
              west: Math.min(...lngs)
            }
            console.log('📊 Calculated bounds from GeoJSON:', mapBounds)
          }
        }
        
        if (!mapBounds) {
          mapBounds = getMapBounds(currentQuery)
          console.log('📊 Using query-based fallback bounds:', mapBounds)
        }
        
        if (!mapCenter && mapBounds) {
          mapCenter = [
            (mapBounds.west + mapBounds.east) / 2, 
            (mapBounds.north + mapBounds.south) / 2
          ]
        }
        
        const latPadding = mapBounds ? Math.abs(mapBounds.north - mapBounds.south) * 0.1 : 1
        const lngPadding = mapBounds ? Math.abs(mapBounds.east - mapBounds.west) * 0.1 : 1
        
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
          lat: (paddedBounds.north + paddedBounds.south) / 2,
          lng: (paddedBounds.east + paddedBounds.west) / 2
        }
        
        mapData = {
          map_url: r.overlay_url || r.static_url || '',
          bounds: paddedBounds,
          center: center,
          zoom: r.map_config?.zoom || 7,
          azureData: {
            static_url: r.static_url,
            overlay_url: r.overlay_url,
            geotiff_url: r.geotiff_url,
            temperature_data: r.temperature_data || [],
            geojson: r.geojson,  // ✅ Now has normalized 'value' property
            bounds: mapBounds,
            map_config: r.map_config,
            use_tiles: r.use_tiles,
            tile_config: r.tile_config,
            variable_info: {
              name: variable,
              unit: getVariableUnit(variable),
              displayName: getDisplayName(variable)
            },
            data_type: 'unified_backend',
            raw_response: r
          }
        }
        
        imageUrl = r.static_url
      } else {
        console.log('❌ No map artifacts found')
        imageUrl = r?.content?.match(/https?:\/\/[^\s]+/)?.[0] || null
      }

      // ✅ Use markdown-extracted URL first, then fall back to existing logic
      if (markdownExtractedUrl) {
        imageUrl = markdownExtractedUrl
        console.log('✅ Using markdown-extracted image URL')
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: cleanContent,
        imageUrl: imageUrl,
        mapData: mapData
      }

      setMessages((prev) => [...prev, assistantMsg])
      setDebug((r?.debug ?? r) || null)
      
    } catch (err: any) {
      console.error('Query failed:', err)
      setError(`Connection failed: ${err?.message || 'Unknown error'}`)
      setMessages((prev) => [...prev, { 
        id: String(Date.now()), 
        role: 'assistant', 
        text: `Request failed: ${err?.message || 'Backend connection error'}` 
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex justify-center items-start pt-8">
        <div className="w-full max-w-7xl bg-white shadow-lg rounded-xl overflow-hidden mx-4">
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">HC</div>
              <div className="flex-1">
                <div className="text-lg font-semibold">Hydrology Copilot</div>
                <div className="text-xs text-gray-500">Ask a question and get a visualization</div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={forceDebugLog}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition"
                  title="Force debug logging"
                >
                  🔥 Debug
                </button>
                
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
                      <div className="text-blue-600">💬 Active Session</div>
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
                  💡 Try: "show temperature in Michigan" - Now with conversation memory!
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-full ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-xl rounded-tr-none max-w-[85%]' : 'bg-white text-gray-900 rounded-xl rounded-tl-none shadow'} p-4`}>
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                
                  {/* ✅ SIDE-BY-SIDE MAPS LAYOUT */}
                  {(m.mapData || m.imageUrl) && (
                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Azure Map */}
                      {m.mapData && AZURE_MAPS_KEY && (
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-2">Interactive Map:</div>
                          <AzureMapView
                            mapData={m.mapData}
                            subscriptionKey={AZURE_MAPS_KEY}
                            clientId={AZURE_MAPS_CLIENT_ID}
                            height="500px"
                          />
                        </div>
                      )}
                      
                      {/* Static PNG */}
                      {(m.mapData?.azureData?.static_url || m.imageUrl) && (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Static Map with Legend:</span>
                            <a 
                              href={m.mapData?.azureData?.static_url || m.imageUrl || '#'} 
                              download="static-map.png"
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download PNG
                            </a>
                          </div>
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
                                <TransformComponent 
                                  wrapperStyle={{ width: '100%', height: '500px' }} 
                                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <img
                                    src={m.mapData?.azureData?.static_url || m.imageUrl || ''}
                                    alt="Static map visualization"
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    className="rounded border border-gray-300"
                                    draggable={false}
                                  />
                                </TransformComponent>
                              </>
                            )}
                          </TransformWrapper>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* PROCESSING INDICATOR */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none shadow p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    <span className="text-gray-600">Agent is processing your request...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={endRef} />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about hydrology data..."
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
        </div>
      </div>

      {/* Debug Panel with Error Highlighting */}
      {debug && (
        <div className={`fixed bottom-4 right-4 w-96 max-h-64 ${
          debug?.analysis_data?.status === 'error' || debug?.status === 'error'
            ? 'bg-red-900 border-2 border-red-500' 
            : 'bg-gray-800'
        } text-white rounded-lg shadow-xl overflow-hidden z-50`}>
          <div className={`${
            debug?.analysis_data?.status === 'error' || debug?.status === 'error'
              ? 'bg-red-800' 
              : 'bg-gray-700'
          } px-4 py-2 flex justify-between items-center`}>
            <span className="text-sm font-semibold">
              {debug?.analysis_data?.status === 'error' || debug?.status === 'error' ? '⚠️ Error Debug Info' : 'Debug Info'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const debugMsg: Message = {
                    id: String(Date.now()),
                    role: 'assistant',
                    text: `🐛 ${debug?.analysis_data?.status === 'error' || debug?.status === 'error' ? 'Error ' : ''}Debug Information:\n\n${JSON.stringify(debug, null, 2)}`
                  }
                  setMessages(prev => [...prev, debugMsg])
                  setDebug(null)
                }}
                className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
              >
                📤 Send to Chat
              </button>
              <button
                onClick={() => setDebug(null)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto max-h-52">
            {(debug?.analysis_data?.status === 'error' || debug?.status === 'error') && (
              <div className="bg-red-800/50 border border-red-500 rounded p-2 mb-2">
                <div className="font-bold text-red-200">Error:</div>
                <div className="text-sm">{debug?.analysis_data?.error || debug?.error}</div>
                {(debug?.analysis_data?.suggestion || debug?.suggestion) && (
                  <div className="mt-2 text-yellow-200 text-xs">
                    💡 {debug.analysis_data?.suggestion || debug.suggestion}
                  </div>
                )}
              </div>
            )}
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}