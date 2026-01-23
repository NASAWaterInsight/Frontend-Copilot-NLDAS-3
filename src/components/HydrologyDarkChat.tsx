// src/components/HydrologyDarkChat.tsx
import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction, testFastAPIConnection } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
import ProgressSteps from './ProgressSteps'  // ✅ NEW
import { useStreamingChat } from '../hooks/useStreamingChat'  // ✅ NEW
import { getStableUserId, clearUserId } from '../utils/userIdentity'
import type { Message, MapData } from '../types'

// Get Azure Maps credentials from environment variables
const AZURE_MAPS_KEY = import.meta.env.VITE_AZURE_MAPS_SUBSCRIPTION_KEY
const AZURE_MAPS_CLIENT_ID = import.meta.env.VITE_AZURE_MAPS_CLIENT_ID

// ✅ NEW: Feature flag for streaming
const USE_STREAMING = true  // Set to false to disable streaming

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

  // ✅ NEW: Streaming hook
  const { 
    steps: progressSteps, 
    isStreaming, 
    sendStreamingQuery, 
    resetSteps 
  } = useStreamingChat()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progressSteps])  // ✅ Also scroll when progress updates

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
    resetSteps()  // ✅ NEW: Clear progress steps
    console.log('🔄 Cleared user ID and thread ID for fresh conversation')
  }

  const forceDebugLog = () => {
    console.log('🔥 FORCE DEBUG LOG TEST')
    setShowDebug(!showDebug)
    console.log('Environment variables:', {
      AZURE_KEY: !!AZURE_MAPS_KEY,
      API_URL: import.meta.env.VITE_API_BASE_URL,
      DEV_MODE: import.meta.env.DEV,
      USE_STREAMING: USE_STREAMING
    })
    console.log('Current messages:', messages.length)
    console.log('Current userId:', userId ? userId.substring(0, 8) + '...' : 'none')
    console.log('Current threadId:', threadId ? threadId.substring(0, 12) + '...' : 'none')
    console.log('Progress steps:', progressSteps.length)
    
    testFastAPIConnection().then(working => {
      console.log('🔧 Backend connection test result:', working)
    })
  }

  // Helper functions (keep your existing ones)
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

  // ✅ NEW: Process response (extracted for reuse)
  // ✅ NEW: Format data result object into readable text
function formatDataResult(result: any): string {
  console.log('📊 Formatting data result:', result)
  
  if (result.average_temperature !== undefined) {
    return `The average temperature in ${result.region || 'the selected area'} on ${result.date || 'the selected date'} was ${result.average_temperature}${result.unit || '°C'}.`
  }
  if (result.total_precipitation !== undefined) {
    return `The total precipitation in ${result.region || 'the selected area'} on ${result.date || 'the selected date'} was ${result.total_precipitation} ${result.unit || 'mm'}.`
  }
  if (result.average_precipitation !== undefined) {
    return `The average precipitation in ${result.region || 'the selected area'} on ${result.date || 'the selected date'} was ${result.average_precipitation} ${result.unit || 'mm'}.`
  }
  if (result.spi !== undefined || result.spi_value !== undefined) {
    const spiValue = result.spi ?? result.spi_value
    return `The SPI (drought index) in ${result.region || 'the selected area'} for ${result.date || result.period || 'the selected period'} was ${spiValue}.`
  }
  if (result.wind_speed !== undefined || result.average_wind_speed !== undefined) {
    const windSpeed = result.wind_speed ?? result.average_wind_speed
    return `The average wind speed in ${result.region || 'the selected area'} on ${result.date || 'the selected date'} was ${windSpeed} ${result.unit || 'm/s'}.`
  }
  
  // Generic fallback
  const excludeKeys = ['static_url', 'overlay_url', 'geojson', 'bounds', 'map_config', 'tile_config']
  const formattedPairs = Object.entries(result)
    .filter(([key, value]) => value !== null && value !== undefined && !excludeKeys.includes(key))
    .map(([key, value]) => {
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `${formattedKey}: ${value}`
    })
    .join('\n')
  
  return formattedPairs || 'Analysis completed successfully.'
}

// ✅ FIXED: Process response (extracted for reuse)
function processResponse(r: any, currentQuery: string): { 
  cleanContent: string, 
  imageUrl: string | null, 
  mapData: MapData | undefined 
} {
  let cleanContent = ''
  
  // ✅ FIX: Handle both string AND object results, remove strict status check
  if (r?.analysis_data?.result && r?.analysis_data?.status !== 'error') {
    const result = r.analysis_data.result
    
    if (typeof result === 'string') {
      const hasUrl = /https?:\/\/[^\s]+/.test(result)
      if (!hasUrl) {
        cleanContent = result
        console.log('📝 Using text result:', cleanContent)
      }
    } 
    else if (typeof result === 'object' && result !== null) {
      // ✅ NEW: Check if it's a data result (not a map result)
      const isMapResult = !!(result.static_url || result.overlay_url || result.geojson)
      if (!isMapResult) {
        cleanContent = formatDataResult(result)
        console.log('📊 Formatted data result:', cleanContent)
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
      }
    }

    if (!markdownExtractedUrl && typeof cleanContent === 'string' && cleanContent) {
      const looksLikeAnswer = /\b(is|are|average|total|maximum|minimum|speed|temperature|value)\b/i.test(cleanContent)
      
      if (!looksLikeAnswer || cleanContent.includes('Analysis completed')) {
        cleanContent = cleanContent.replace(/^Analysis completed:?.*$/im, '').trim()
        cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
        cleanContent = cleanContent.replace(/\n\s*\n/g, '\n').trim()
      }
    }

    if (!cleanContent || cleanContent.trim() === '') {
      cleanContent = ''
    }

    const hasStaticUrl = !!(r?.static_url)
    const hasOverlayUrl = !!(r?.overlay_url)
    const hasGeoTiffUrl = !!(r?.geotiff_url)
    let hasGeoJsonData = !!(r?.geojson?.features?.length > 0)

    // ✅ NEW: Detect animation/GIF from backend or URL
    const isAnimation = (
      r?.type === 'animation' ||
      r?.media_type === 'gif' ||
      (typeof r?.static_url === 'string' && r.static_url.toLowerCase().endsWith('.gif')) ||
      (typeof r?.overlay_url === 'string' && r.overlay_url.toLowerCase().endsWith('.gif'))
    )

    if (hasGeoJsonData) {
      r.geojson.features = r.geojson.features
        .filter((f: any) => {
          const lat = f.geometry?.coordinates?.[1]
          const lng = f.geometry?.coordinates?.[0]
          const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
          return isFinite(lat) && isFinite(lng) && isFinite(value)
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
    }

    const variable = r?.variable || 'temperature'

    const isSimpleVisualization = (
      r?.type === "simple_visualization" || 
      r?.metadata?.computation_type === "comparison" ||
      r?.use_tiles === false ||
      (!r?.bounds && !r?.map_config && hasStaticUrl) ||
      /recovery|flash drought/i.test(currentQuery)
    )

    let imageUrl = null
    let mapData: MapData | undefined

    // ✅ CASE 1: Simple visualization OR animation (GIF) - STATIC IMAGE ONLY
    if ((isSimpleVisualization || isAnimation) && hasStaticUrl) {
      console.log('📊 Static-only detected (animation/simple) - using static image (GIF)')
      imageUrl = r.static_url
    }
    else if ((hasStaticUrl || hasOverlayUrl || hasGeoJsonData || hasGeoTiffUrl) && !isSimpleVisualization) {
      let mapBounds = null
      let mapCenter = r.map_config?.center
      
      if (r.bounds && isFinite(r.bounds.north) && isFinite(r.bounds.south) && 
          isFinite(r.bounds.east) && isFinite(r.bounds.west)) {
        mapBounds = r.bounds
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
        }
      }
      
      if (!mapBounds) {
        mapBounds = getMapBounds(currentQuery)
      }
      
      if (!mapCenter && mapBounds) {
        mapCenter = [
          (mapBounds.west + mapBounds.east) / 2, 
          (mapBounds.north + mapBounds.south) / 2
        ]
      }
      
      const latPadding = mapBounds ? Math.abs(mapBounds.north - mapBounds.south) * 0.02 : 0.5
      const lngPadding = mapBounds ? Math.abs(mapBounds.east - mapBounds.west) * 0.02 : 0.5

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
        zoom: r.map_config?.zoom || 9,
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
    } 
    else {
      imageUrl = r?.content?.match(/https?:\/\/[^\s]+/)?.[0] || null
    }

    if (markdownExtractedUrl) {
      imageUrl = markdownExtractedUrl
    }

    return { cleanContent, imageUrl, mapData }
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
    resetSteps()  // ✅ Clear previous progress steps

    try {
      console.log('Sending request to backend with query:', userMsg.text)
      
      let r: any

      // ✅ NEW: Choose streaming or non-streaming based on flag
      if (USE_STREAMING) {
        console.log('🌊 Using streaming endpoint...')
        
        try {
          const streamResult = await sendStreamingQuery(currentQuery, userId, threadId)
          r = streamResult?.result || streamResult
          console.log('🌊 Stream result:', r)
        } catch (streamError: any) {
          console.warn('⚠️ Streaming failed, falling back to regular endpoint:', streamError)
          // Fallback to non-streaming
          const resp = await callMultiAgentFunction({ 
            action: 'generate', 
            data: { 
              query: userMsg.text,
              user_id: userId,
              thread_id: threadId
            } 
          })
          r = resp.response
        }
      } else {
        // Non-streaming path
        const resp = await callMultiAgentFunction({ 
          action: 'generate', 
          data: { 
            query: userMsg.text,
            user_id: userId,
            thread_id: threadId
          } 
        })
        r = resp.response
      }
      
      console.log('Raw backend response:', r)
      
      if (r?.thread_id) {
        setThreadId(r.thread_id)
        console.log('💾 Stored thread_id:', r.thread_id.substring(0, 12) + '...')
      }

      // Check for errors
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

      // Process the response
      const { cleanContent, imageUrl, mapData } = processResponse(r, currentQuery)

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
      background: '#000000'
    }}>
      {/* Header with integrated logos */}
      <div className="relative w-full overflow-hidden" style={{ height: '220px', background: '#000000' }}>
        <div className="absolute inset-0 z-0" style={{ background: '#000000' }}>
          <img 
            src="/total.svg" 
            alt="Hydrology Cycle with NASA and Microsoft logos" 
            className="w-full h-full object-cover object-left"
            style={{
              animation: 'float 6s ease-in-out infinite',
              background: '#000000'
            }}
            onError={(e) => {
              console.error('❌ Failed to load /total.svg')
              e.currentTarget.style.display = 'none'
            }}
            onLoad={() => {
              console.log('✅ Successfully loaded /total.svg')
            }}
          />
        </div>
        
        <div className="absolute bottom-0 right-0 pr-16 -mb-1 z-50">
          <div className="text-right">
            <h1 className="text-5xl md:text-6xl font-bold mb-2">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent block" style={{
                filter: 'drop-shadow(0 0 20px rgba(0, 0, 0, 1)) drop-shadow(0 0 40px rgba(0, 0, 0, 0.8))'
              }}>
                Hydrology Copilot
              </span>
              <span className="text-white text-base font-medium block mt-1" style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 1), 0 0 20px rgba(0, 0, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 1)'
              }}>
                An AI tool for unlocking hydrological insights
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Main chat container */}
      <div className="flex-1 flex flex-col mx-auto w-full px-4">
        <div 
          className="flex-1 overflow-y-auto py-6 mb-32" 
          style={{ 
            minHeight: '350px',
            maxHeight: 'calc(100vh - 350px)' 
          }}
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg mb-2">Ask a question to get started</p>
                <p className="text-gray-600 text-sm">
                  Try: "Show temperature in Michigan" or "Analyze drought conditions in California"
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* Text message bubble */}
                {m.text && !m.mapData && !m.imageUrl && (
                  <div className={`max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
                  } px-5 py-3`}>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                )}
                
                {/* Message with map - full width */}
                {m.mapData && (
                  <div className="w-full">
                    {m.text && (
                      <div className={`max-w-[85%] mb-4 ${
                        m.role === 'user' 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm ml-auto' 
                          : 'bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
                      } px-5 py-3`}>
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      </div>
                    )}
                    
                    {m.mapData && AZURE_MAPS_KEY && (
                      <div className="bg-black border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                        <div className="text-sm font-semibold text-gray-300 mb-2">🗺️ Interactive Map:</div>
                        <div className="rounded-lg overflow-hidden border border-gray-700">
                          <AzureMapView 
                            mapData={m.mapData} 
                            subscriptionKey={AZURE_MAPS_KEY}
                            clientId={AZURE_MAPS_CLIENT_ID}
                            height="400px"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Click points for details
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Image only message */}
                {m.imageUrl && !m.mapData && (
                  <div className={`max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
                  } px-5 py-3`}>
                    {m.text && <div className="whitespace-pre-wrap mb-4">{m.text}</div>}
                    <img src={m.imageUrl} alt="Result" className="rounded-lg w-full" />
                  </div>
                )}
              </div>
            ))}
            
            {/* ✅ NEW: Progress Steps Display */}
            {(loading || isStreaming) && (
              <div className="flex justify-start">
                <ProgressSteps steps={progressSteps} isLoading={loading || isStreaming} />
              </div>
            )}
            
            {/* ✅ MODIFIED: Fallback loading indicator (only shows if no progress steps) */}
            {loading && progressSteps.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-black border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                    <span className="text-gray-300">Connecting to server...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={endRef} />
          </div>
        </div>

        {/* Control buttons */}
        <div className="fixed bottom-24 left-0 right-0 z-40">
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-3">
            {userId && (
              <div className="text-xs text-gray-500 px-3 py-1.5 bg-black border border-gray-800 rounded-lg">
                User: {userId.substring(0, 8)}
                {messages.length > 0 && <span className="text-green-400 ml-2">● Active</span>}
                {isStreaming && <span className="text-purple-400 ml-2">● Streaming</span>}
              </div>
            )}
            
            <button
              onClick={handleNewConversation}
              className="px-3 py-1.5 text-xs bg-black hover:bg-black text-gray-300 border border-gray-800 rounded-lg transition-all duration-200 hover:border-gray-700"
              title="Start fresh conversation"
            >
              📝 New Chat
            </button>
            
            <button
              onClick={forceDebugLog}
              className="px-3 py-1.5 text-xs bg-black hover:bg-black text-red-400 border border-gray-800 rounded-lg transition-all duration-200 hover:border-red-900"
              title="Toggle debug mode"
            >
              🔥 Debug
            </button>
          </div>
        </div>

        {/* Input form */}
        <div className="fixed bottom-0 left-0 right-0 bg-black z-40">
          <div className="max-w-5xl mx-auto border-t border-gray-800 pt-4 pb-4 px-4">
            <form onSubmit={handleSubmit}>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about hydrology data..."
                  className="flex-1 px-5 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
                  disabled={loading || isStreaming}
                />
                <button
                  type="submit"
                  disabled={loading || isStreaming || !query.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-w-[100px]"
                >
                  {loading || isStreaming ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {isStreaming ? 'Streaming' : 'Processing'}
                    </span>
                  ) : 'Send'}
                </button>
              </div>
              {error && (
                <div className="mt-3 text-sm text-red-400 bg-black border border-red-800 rounded-lg px-4 py-2">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Debug panel */}
        {showDebug && debug && (
          <div className="fixed bottom-28 left-0 right-0 z-50">
            <div className="max-w-5xl mx-auto px-4">
              <div className="p-4 bg-black border border-gray-800 rounded-lg">
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
            </div>
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
