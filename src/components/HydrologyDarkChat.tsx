import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction, testFastAPIConnection } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
import { getStableUserId, clearUserId } from '../utils/userIdentity'
import type { Message, MapData } from '../types'

// Get Azure Maps credentials from environment variables
const AZURE_MAPS_KEY = import.meta.env.VITE_AZURE_MAPS_SUBSCRIPTION_KEY
const AZURE_MAPS_CLIENT_ID = import.meta.env.VITE_AZURE_MAPS_CLIENT_ID

export default function HydrologyDarkChat() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [debug, setDebug] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize user ID on component mount
  useEffect(() => {
    const initUser = async () => {
      const id = await getStableUserId()
      setUserId(id)
      console.log('Chat initialized for user:', id.substring(0, 8) + '...')
      
      console.log('🔧 Testing backend connection...')
      const backendWorking = await testFastAPIConnection()
      if (backendWorking) {
        console.log('✅ Backend server is working!')
      } else {
        console.error('❌ Backend server not responding')
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

  const forceDebugLog = () => {
    console.log('🔥 FORCE DEBUG LOG TEST')
    setShowDebug(!showDebug)
    console.log('Environment variables:', {
      AZURE_KEY: !!AZURE_MAPS_KEY,
      API_URL: import.meta.env.VITE_API_BASE_URL,
      DEV_MODE: import.meta.env.DEV
    })
    console.log('Current messages:', messages.length)
    console.log('Current userId:', userId ? userId.substring(0, 8) + '...' : 'none')
    console.log('Current threadId:', threadId ? threadId.substring(0, 12) + '...' : 'none')
    
    testFastAPIConnection().then(working => {
      console.log('🔧 Backend connection test result:', working)
    })
  }

  // Helper functions
  function getDisplayName(variable: string): string {
    const variableMap: { [key: string]: string } = {
      'Tair': 'Air Temperature',
      'Tair_f_inst': 'Air Temperature',
      'Rainf_f_tavg': 'Precipitation',
      'Rainf': 'Precipitation',
      'Wind_E': 'Wind (East Component)',
      'Wind_N': 'Wind (North Component)',
      'Wind_Speed': 'Wind Speed',
      'wind_speed': 'Wind Speed',
      'Qair': 'Specific Humidity',
      'Qair_f_inst': 'Specific Humidity',
      'RelHum': 'Relative Humidity',
      'humidity': 'Relative Humidity',
      'SPI': 'SPI (Drought Index)',
      'SPI3': 'SPI-3 (3-Month Drought)',
      'spi': 'SPI (Drought Index)',
      'temperature': 'Temperature'
    }
    return variableMap[variable] || variable.replace(/_/g, ' ')
  }

  function getVariableUnit(variable: string): string {
    const unitMap: { [key: string]: string } = {
      'Tair': '°C',
      'temperature': '°C',
      'Rainf': 'mm/hr',
      'Wind_Speed': 'm/s',
      'wind_speed': 'm/s',
      'Wind_E': 'm/s',
      'Wind_N': 'm/s',
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

  function extractMarkdownImage(text: string): { imageUrl: string | null, cleanText: string } {
    let markdownImageMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    
    if (markdownImageMatch) {
      const imageUrl = markdownImageMatch[1]
      const cleanText = text
        .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)/g, '')
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\)/g, '')
        .trim()
        .replace(/\n\s*\n/g, '\n')
      
      console.log('📷 Detected markdown IMAGE syntax, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    
    const markdownLinkMatch = text.match(/\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*)\)/i)
    
    if (markdownLinkMatch) {
      const imageUrl = markdownLinkMatch[1]
      const cleanText = text
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*\)/gi, '')
        .trim()
        .replace(/\n\s*\n/g, '\n')
      
      console.log('📷 Detected markdown LINK to image file, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    
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
      
      if (r?.thread_id) {
        setThreadId(r.thread_id)
        console.log('💾 Stored thread_id:', r.thread_id.substring(0, 12) + '...')
      }

      let hasError = false
      let errorMessage = ''

      if (r?.status === 'error' || r?.analysis_data?.status === 'error') {
        hasError = true
        errorMessage = r?.error || r?.analysis_data?.error || 'An error occurred during analysis'
        console.log('❌ Error detected:', errorMessage)
      }

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

      let cleanContent = ''
      
      if (r?.analysis_data?.status === 'success' && r?.analysis_data?.result) {
        if (typeof r.analysis_data.result === 'string') {
          const hasUrl = /https?:\/\/[^\s]+/.test(r.analysis_data.result)
          if (!hasUrl) {
            cleanContent = r.analysis_data.result
            console.log('📝 Using text result from analysis_data.result:', cleanContent)
          }
        }
      }

      if (!cleanContent && r?.content) {
        cleanContent = typeof r.content === 'string' ? r.content : ''
      }

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

      if (!markdownExtractedUrl && typeof cleanContent === 'string' && cleanContent) {
        const hasSubstantialText = cleanContent.length > 30 && /[a-zA-Z]/.test(cleanContent)
        const looksLikeAnswer = /\b(is|are|average|total|maximum|minimum|speed|temperature|value)\b/i.test(cleanContent)
        
        if (!looksLikeAnswer || cleanContent.includes('Analysis completed')) {
          cleanContent = cleanContent.replace(/^Analysis completed:?.*$/im, '').trim()
          cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
          cleanContent = cleanContent.replace(/\n\s*\n/g, '\n').trim()
        }
      }

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

      if (hasGeoJsonData) {
        console.log('🔍 Processing GeoJSON data...')
        
        r.geojson.features = r.geojson.features
          .filter((f: any) => {
            const lat = f.geometry?.coordinates?.[1]
            const lng = f.geometry?.coordinates?.[0]
            const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
            
            const isValid = isFinite(lat) && isFinite(lng) && isFinite(value)
            if (!isValid) {
              console.warn('❌ Invalid GeoJSON feature:', { lat, lng, value, properties: f.properties })
            }
            return isValid
          })
          .map((f: any) => {
            const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
            const variable = f.properties?.variable || 'spi'
            
            return {
              ...f,
              properties: {
                ...f.properties,
                value: value,
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
            geojson: r.geojson,
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
    <div className="min-h-screen text-white flex flex-col" style={{ 
      background: 'linear-gradient(180deg, #0a1628 0%, #111827 50%, #000000 100%)'
    }}>
      {/* NARROWER Header - Title OVERLAID on RIGHT side of image */}
      <div className="relative w-full overflow-hidden" style={{ height: '280px' }}>
        {/* Image fills entire width */}
        <div className="absolute inset-0">
          <img 
            src="/hydrology-visualization.png" 
            alt="Hydrology Cycle" 
            className="w-full h-full object-cover object-left"
            style={{
              filter: 'drop-shadow(0 10px 40px rgba(0, 150, 255, 0.3))',
              animation: 'float 6s ease-in-out infinite'
            }}
            onError={(e) => {
              console.error('❌ Failed to load /hydrology-visualization.png')
              e.currentTarget.style.display = 'none'
            }}
            onLoad={() => {
              console.log('✅ Successfully loaded /hydrology-visualization.png')
            }}
          />
        </div>
        
        {/* Title OVERLAID on top-right of image */}
        <div className="absolute inset-0 flex items-end justify-end pr-16 pb-10">
          <div className="text-right">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2" style={{
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)'
            }}>
              Hydrology Copilot
            </h1>
            <p className="text-gray-200 text-base" style={{
              textShadow: '0 1px 10px rgba(0, 0, 0, 0.9)'
            }}>
              Drought Monitoring and Hydrological Data Analysis
            </p>
          </div>
        </div>
        
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Control buttons - STACKED VERTICALLY */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
        {userId && (
          <div className="text-xs text-gray-500 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
            User: {userId.substring(0, 8)}
            {messages.length > 0 && <span className="text-green-400 ml-2">● Active</span>}
          </div>
        )}
        
        <button
          onClick={handleNewConversation}
          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 rounded-lg transition-all duration-200"
          title="Start fresh conversation"
        >
          📝 New Chat
        </button>
        
        <button
          onClick={forceDebugLog}
          className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all duration-200"
          title="Toggle debug mode"
        >
          🔥 Debug
        </button>
      </div>

      {/* Main chat container */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 pb-4">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-6 space-y-4" style={{ maxHeight: 'calc(100vh - 430px)' }}>
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-2">Ask a question to get started</p>
              <p className="text-gray-600 text-sm">
                Try: "Show temperature in Michigan" or "Analyze drought conditions in California"
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${
                m.role === 'user' 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-gray-900/80 border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
              } px-5 py-3 backdrop-blur-sm`}>
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                
                {/* Side-by-side maps layout */}
                {(m.mapData || m.imageUrl) && (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Azure Interactive Map */}
                    {m.mapData && AZURE_MAPS_KEY && (
                      <div>
                        <div className="text-sm font-semibold text-gray-300 mb-2">🗺️ Interactive Map:</div>
                        <div className="rounded-lg overflow-hidden border border-gray-700">
                          <AzureMapView 
                            mapData={m.mapData} 
                            subscriptionKey={AZURE_MAPS_KEY}
                            clientId={AZURE_MAPS_CLIENT_ID}
                            height="450px"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Click points for details
                        </p>
                      </div>
                    )}

                    {/* Static PNG with Legend */}
                    {(m.mapData?.azureData?.static_url || m.imageUrl) && (
                      <div>
                        <div className="mb-2">
                          <span className="text-sm font-semibold text-gray-300">📊 Static Map with Legend:</span>
                        </div>
                        <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900" style={{ height: '450px' }}>
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
                                  <button onClick={() => zoomIn()} className="bg-black/70 hover:bg-black/90 text-white border border-gray-600 rounded px-2 py-1 text-sm">+</button>
                                  <button onClick={() => zoomOut()} className="bg-black/70 hover:bg-black/90 text-white border border-gray-600 rounded px-2 py-1 text-sm">−</button>
                                  <button onClick={() => resetTransform()} className="bg-black/70 hover:bg-black/90 text-white border border-gray-600 rounded px-2 py-1 text-sm">⌂</button>
                                </div>
                                <TransformComponent 
                                  wrapperStyle={{ width: '100%', height: '100%' }} 
                                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <img 
                                    src={m.mapData?.azureData?.static_url || m.imageUrl || ''} 
                                    alt="Static map with legend" 
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                    draggable={false} 
                                  />
                                </TransformComponent>
                              </>
                            )}
                          </TransformWrapper>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            💡 Scroll to zoom, drag to pan
                          </span>
                          <a 
                            href={m.mapData?.azureData?.static_url || m.imageUrl || '#'} 
                            download="static-map.png"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-900/80 border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                  <span className="text-gray-300">Processing your request...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={endRef} />
        </div>

        {/* Input form at bottom */}
        <form onSubmit={handleSubmit} className="border-t border-gray-800 pt-4 mt-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about hydrology data..."
              className="flex-1 px-5 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-w-[100px]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing
                </span>
              ) : 'Send'}
            </button>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Debug panel */}
        {showDebug && debug && (
          <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">Debug Information</span>
              <button 
                onClick={() => setShowDebug(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <pre className="text-xs text-gray-300 overflow-auto max-h-48">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
