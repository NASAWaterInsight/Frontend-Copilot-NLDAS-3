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
      
      // ✅ Test FastAPI connection with better messaging
      console.log('🔧 Testing FastAPI connection...')
      const fastApiWorking = await testFastAPIConnection()
      if (fastApiWorking) {
        console.log('✅ FastAPI server is working!')
      } else {
        console.error('❌ FastAPI server not responding')
        console.error('💡 Make sure your FastAPI server is running on port 8000')
        console.error('💡 Try: cd /path/to/your/fastapi/server && python -m uvicorn main:app --host 0.0.0.0 --port 8000')
      }
    }
    initUser()
  }, [])

  // Handle new conversation
  const handleNewConversation = () => {
    clearUserId()
    setUserId('')
    setMessages([])
    setError(null)
    setDebug(null)
    console.log('🔄 Cleared user ID for fresh conversation')
  }

  // Add this debug function after handleNewConversation
  const forceDebugLog = () => {
    console.log('🔥 FORCE DEBUG LOG TEST')
    console.log('Environment variables:', {
      AZURE_KEY: !!AZURE_MAPS_KEY,
      API_URL: import.meta.env.VITE_API_BASE_URL,
      DEV_MODE: import.meta.env.DEV
    })
    console.log('Current messages:', messages.length)
    console.log('Browser info:', {
      userAgent: navigator.userAgent,
      location: window.location.href
    })
    
    // ✅ Test FastAPI connection with detailed output
    console.log('🔧 Testing FastAPI endpoints...')
    testFastAPIConnection().then(working => {
      console.log('🔧 FastAPI connection test result:', working)
    })
    
    // ✅ Test specific endpoints
    const testEndpoints = [
      '/api/health',
      '/docs', 
      '/api/chat',
      '/'
    ]
    
    testEndpoints.forEach(endpoint => {
      fetch(`http://localhost:8000${endpoint}`, { method: 'HEAD' })
        .then(response => {
          console.log(`🔍 ${endpoint}: ${response.status} ${response.statusText}`)
        })
        .catch(error => {
          console.log(`❌ ${endpoint}: Failed - ${error.message}`)
        })
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
    
    // Default bounds (continental US)
    return { north: 49.0, south: 25.0, east: -66.0, west: -125.0 }
  }

  // Helper function for display names
  function getDisplayName(variable: string): string {
    const variableMap: { [key: string]: string } = {
      'Tair': 'Air Temperature',
      'Tair_f_inst': 'Air Temperature',
      'Rainf_f_tavg': 'Precipitation',
      'Rainf': 'Precipitation',
      'Snowf_tavg': 'Snowfall',
      'Evap_tavg': 'Evaporation',
      'Psurf': 'Surface Pressure',
      'Psurf_f_inst': 'Surface Pressure',
      'Wind_f_inst': 'Wind Speed',
      'Wind_f_tavg': 'Wind Speed',
      'Uwind': 'Wind Speed (U)',
      'Vwind': 'Wind Speed (V)',
      'Qair_f_inst': 'Humidity',
      'Qair': 'Humidity',
      'RelHum': 'Relative Humidity',
      'SWdown_f_tavg': 'Solar Radiation',
      'SWdown': 'Solar Radiation',
      'LWdown_f_tavg': 'Longwave Radiation',
      'LWdown': 'Longwave Radiation',
      'SoilMoi0_10cm': 'Soil Moisture',
      'SoilMoi10_40cm': 'Soil Moisture',
      'SoilTemp0_10cm': 'Soil Temperature',
      'LatHeat': 'Latent Heat',
      'SensHeat': 'Sensible Heat',
      'GrndHeat': 'Ground Heat',
      'Runoff': 'Surface Runoff',
      'Baseflow': 'Baseflow',
      'Streamflow': 'Streamflow',
      'SPI': 'SPI (Drought Index)',
      'SPI3': 'SPI-3 (3-Month Drought)',
      'temperature': 'Temperature'
    }
    return variableMap[variable] || variable.replace(/_/g, ' ').replace(/f inst|f tavg/g, '').trim()
  }

  // Helper function to get variable unit
  function getVariableUnit(variable: string): string {
    const unitMap: { [key: string]: string } = {
      'Tair': '°C',
      'temperature': '°C',
      'Rainf': 'mm/hr',
      'Psurf': 'kPa',
      'Wind': 'm/s',
      'Qair': 'kg/kg',
      'SPI': '',
      'SPI3': ''
    }
    return unitMap[variable] || ''
  }

  // Helper function to get severity label
  function getSeverityLabel(analysisType: string, value: number): string {
    if (analysisType.includes('temperature')) {
      if (analysisType.includes('coldest')) return 'coldest'
      if (analysisType.includes('hottest')) return 'hottest'
      return value < 15 ? 'cold' : 'warm'
    }
    if (analysisType.includes('wet')) return 'wettest'
    if (analysisType.includes('dry')) return 'driest'
    if (analysisType.includes('drought')) {
      if (value <= -2.0) return 'extreme drought'
      if (value <= -1.5) return 'severe drought'
      if (value <= -1.0) return 'moderate drought'
      return 'mild drought'
    }
    return 'extreme'
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
      
      console.log('=== BACKEND RESPONSE STRUCTURE ===')
      console.log('Full response keys:', Object.keys(r || {}))
      console.log('geotiff_url:', r?.geotiff_url)
      console.log('static_url:', r?.static_url)
      console.log('overlay_url:', r?.overlay_url)
      console.log('geojson features:', r?.geojson?.features?.length)
      console.log('temperature_data:', r?.temperature_data?.length)
      console.log('bounds:', r?.bounds)
      console.log('=== END RESPONSE STRUCTURE ===')

      // ✅ Check for visualization data with proper priority
      const hasGeoTiffUrl = !!(r?.geotiff_url)
      const hasStaticUrl = !!(r?.static_url)
      const hasOverlayUrl = !!(r?.overlay_url)
      let hasGeoJsonData = !!(r?.geojson?.features?.length > 0)
      let hasTemperatureData = !!(r?.temperature_data?.length > 0)

      console.log('📊 Data availability (initial):', {
        hasGeoTiffUrl,
        hasStaticUrl,
        hasOverlayUrl,
        hasGeoJsonData,
        hasTemperatureData
      })

      // ✅ Extract and validate GeoJSON to prevent NaN
      if (hasGeoJsonData) {
        const validFeatures = r.geojson.features.filter((f: any) => {
          const lat = f.geometry?.coordinates?.[1]
          const lng = f.geometry?.coordinates?.[0]
          const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature
          
          const isValid = (
            isFinite(lat) && 
            isFinite(lng) && 
            isFinite(value)
          )
          
          if (!isValid) {
            console.warn('❌ Invalid feature filtered out:', { 
              lat, lng, value, 
              properties: f.properties 
            })
          }
          
          return isValid
        })
        
        console.log(`✅ Valid GeoJSON features: ${validFeatures.length} / ${r.geojson.features.length}`)
        
        // Replace with valid features only
        r.geojson.features = validFeatures
        hasGeoJsonData = validFeatures.length > 0
      }

      // ✅ Validate temperature data
      if (hasTemperatureData) {
        const validTempData = r.temperature_data.filter((point: any) => {
          const isValid = (
            isFinite(point.latitude) && 
            isFinite(point.longitude) && 
            isFinite(point.value ?? point.spi ?? 0)
          )
          
          if (!isValid) {
            console.warn('❌ Invalid temperature point filtered out:', point)
          }
          
          return isValid
        })
        
        console.log(`✅ Valid temperature data: ${validTempData.length} / ${r.temperature_data.length}`)
        r.temperature_data = validTempData
        hasTemperatureData = validTempData.length > 0
      }

      console.log('📊 Data availability (after validation):', {
        hasGeoTiffUrl,
        hasStaticUrl,
        hasOverlayUrl,
        hasGeoJsonData,
        hasTemperatureData
      })
      
      let imageUrl = null
      let mapData: MapData | undefined
      let cleanContent = r?.content || ''
      let hasRegionSummary = false

      // Extract regions analysis (drought, temperature extremes, etc.)
      let extremeRegions = 
        r?.analysis_data?.result?.regions ||
        r?.regions ||
        r?.analysis_data?.result?.significant_drought_regions ||
        r?.analysis_data?.result?.significant_regions ||
        null

      console.log('🔍 Extreme regions detection:', {
        found: extremeRegions,
        isArray: Array.isArray(extremeRegions),
        length: extremeRegions?.length
      })

      // If content is structured, blank it before prepend
      const contentIsObject = typeof r?.content === 'object' && r?.content !== null
      if (contentIsObject) cleanContent = ''
      
      // ✅ CRITICAL FIX: Strip URLs from content to prevent display
      if (typeof cleanContent === 'string') {
        // Remove analysis completed line
        cleanContent = cleanContent.replace(/^Analysis completed:.*$/i, '').trim()
        
        // ✅ NEW: Remove all URLs (static_url, overlay_url, etc.) from content
        cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
        
        // ✅ NEW: Remove Azure blob storage URLs specifically
        cleanContent = cleanContent.replace(/https:\/\/[^.\s]+\.blob\.core\.windows\.net\/[^\s]+/g, '').trim()
        
        // ✅ NEW: Clean up any leftover whitespace or empty lines
        cleanContent = cleanContent.replace(/\n\s*\n/g, '\n').trim()
      }

      // Get analysis info from backend
      const analysisType = r?.analysis_data?.result?.analysis_type || 
                          r?.analysis_type || 
                          'extreme temperature regions'
      const variable = r?.analysis_data?.result?.variable || 
                      r?.variable || 
                      r?.temperature_data?.[0]?.variable || 
                      r?.geojson?.features?.[0]?.properties?.variable || 
                      'temperature'

      console.log('📊 Analysis metadata:', { analysisType, variable })

      // Process and display extreme regions
      if (Array.isArray(extremeRegions) && extremeRegions.length > 0) {
        console.log('✅ Processing extreme regions:', extremeRegions)
        
        // Validate and normalize regions data
        const validRegions = extremeRegions
          .filter(p => {
            const isValid = p && isFinite(p.latitude) && isFinite(p.longitude) && 
                           (isFinite(p.value) || isFinite(p.spi_value))
            if (!isValid) {
              console.log('🔍 Invalid region filtered:', p)
            }
            return isValid
          })
          .map((p, idx) => {
            const value = isFinite(p.value) ? p.value : p.spi_value
            return {
              latitude: p.latitude,
              longitude: p.longitude,
              value: value,
              rank: p.rank ?? (idx + 1),
              severity: p.severity || getSeverityLabel(analysisType, value),
              location: p.location || `${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}`
            }
          })

        console.log('📋 Valid regions after processing:', validRegions.length)

        if (validRegions.length > 0) {
          // Create formatted summary
          const listText = validRegions
            .map((p: any) => 
              `${p.rank}. Lat ${p.latitude.toFixed(3)}, Lon ${p.longitude.toFixed(3)}, ${variable} ${p.value.toFixed(3)} (${p.severity})`
            )
            .join('\n')
          
          const summaryHeader = `Top ${validRegions.length} ${analysisType.replace('_', ' ')} locations:\n${listText}\n\n`
          cleanContent = summaryHeader + (typeof cleanContent === 'string' ? cleanContent : '')
          hasRegionSummary = true

          // Precompute bounds for map
          const lats = validRegions.map((p: any) => p.latitude)
          const lngs = validRegions.map((p: any) => p.longitude)
          const regionBounds = {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
          }

          console.log('🗺️ Region bounds calculated:', regionBounds)

          // Create mapData for regions visualization if no other map artifacts
          const hasMapArtifacts = hasStaticUrl || hasOverlayUrl || hasGeoTiffUrl
          
          if (!hasMapArtifacts) {
            console.log('📍 Creating standalone region map...')
            
            const padLat = Math.max(0.1, (regionBounds.north - regionBounds.south) * 0.2)
            const padLng = Math.max(0.1, (regionBounds.east - regionBounds.west) * 0.2)
            const paddedBounds = {
              north: regionBounds.north + padLat,
              south: regionBounds.south - padLat,
              east: regionBounds.east + padLng,
              west: regionBounds.west - padLng
            }

            const tempData = validRegions.map((p: any) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              value: p.value,
              originalValue: p.value,
              variable: variable,
              unit: getVariableUnit(variable),
              location: p.location
            }))

            const geojson = {
              type: 'FeatureCollection',
              features: validRegions.map((p: any) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: {
                  value: p.value,
                  variable: variable,
                  unit: getVariableUnit(variable),
                  severity: p.severity,
                  rank: p.rank,
                  analysis_type: analysisType
                }
              }))
            }

            mapData = {
              map_url: '',
              bounds: paddedBounds,
              center: {
                lat: (regionBounds.north + regionBounds.south) / 2,
                lng: (regionBounds.east + regionBounds.west) / 2
              },
              zoom: 8,
              azureData: {
                geojson,
                temperature_data: tempData,
                extreme_regions: validRegions,
                variable_info: {
                  name: variable,
                  unit: getVariableUnit(variable),
                  displayName: getDisplayName(variable)
                },
                analysis_type: analysisType,
                data_type: 'extreme_regions',
                raw_response: r
              }
            }

            console.log('🏗️ Created standalone mapData for regions')
          } else {
            // Attach regions to existing map artifacts
            console.log('🔗 Attaching regions to existing map artifacts')
            ;(r as any).__extreme_regions = validRegions
            ;(r as any).__region_bounds = regionBounds
          }
        }
      }

      // Build mapData if map artifacts exist OR if we have regions
      if (hasStaticUrl || hasOverlayUrl || hasGeoJsonData || hasTemperatureData || hasGeoTiffUrl || mapData) {
        if (!mapData) {
          console.log('✅ Building mapData from backend artifacts')
          
          // Better bounds calculation to handle NaN values
          let mapBounds = null
          let mapCenter = r.map_config?.center
          
          // Try to get bounds from backend first
          if (r.bounds && isFinite(r.bounds.north) && isFinite(r.bounds.south) && 
              isFinite(r.bounds.east) && isFinite(r.bounds.west)) {
            mapBounds = r.bounds
            console.log('📊 Using backend bounds:', mapBounds)
          } 
          // Calculate bounds from geojson if available and valid
          else if (hasGeoJsonData) {
            const features = r.geojson.features
            const validCoords = features
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
            } else {
              console.error('❌ All GeoJSON coordinates are invalid (NaN)')
            }
          }
          // Calculate bounds from temperature data
          else if (hasTemperatureData) {
            const validTempData = r.temperature_data.filter((p: any) => 
              isFinite(p.latitude) && isFinite(p.longitude)
            )
            
            if (validTempData.length > 0) {
              const lats = validTempData.map((p: any) => p.latitude)
              const lngs = validTempData.map((p: any) => p.longitude)
              mapBounds = {
                north: Math.max(...lats), 
                south: Math.min(...lats),
                east: Math.max(...lngs), 
                west: Math.min(...lngs)
              }
              console.log('📊 Calculated bounds from temperature data:', mapBounds)
            }
          }
          
          // Fallback to query-based bounds if all else fails
          if (!mapBounds) {
            mapBounds = getMapBounds(currentQuery)
            console.log('📊 Using query-based fallback bounds:', mapBounds)
          }
          
          // Calculate center from bounds
          if (!mapCenter && mapBounds) {
            mapCenter = [
              (mapBounds.west + mapBounds.east) / 2, 
              (mapBounds.north + mapBounds.south) / 2
            ]
            console.log('📊 Calculated center:', mapCenter)
          }
          
          // Add padding to bounds
          const latPadding = mapBounds ? Math.abs(mapBounds.north - mapBounds.south) * 0.1 : 1
          const lngPadding = mapBounds ? Math.abs(mapBounds.east - mapBounds.west) * 0.1 : 1
          const paddedBounds = mapBounds ? {
            north: mapBounds.north + latPadding, 
            south: mapBounds.south - latPadding,
            east: mapBounds.east + lngPadding, 
            west: mapBounds.west - lngPadding
          } : getMapBounds(currentQuery)
          
          const center = mapCenter ? { lat: mapCenter[1], lng: mapCenter[0] } : {
            lat: (paddedBounds.north + paddedBounds.south) / 2,
            lng: (paddedBounds.east + paddedBounds.west) / 2
          }
          
          console.log('🗺️ Final map configuration:', {
            originalBounds: mapBounds,
            paddedBounds: paddedBounds,
            center: center,
            zoom: r.map_config?.zoom || 7,
            geotiffUrl: r.geotiff_url
          })
          
          mapData = {
            map_url: r.overlay_url || r.static_url || '',
            bounds: paddedBounds,
            center: center,
            zoom: r.map_config?.zoom || 7,
            azureData: {
              static_url: r.static_url,
              overlay_url: r.overlay_url,
              geotiff_url: r.geotiff_url,  // ✅ Direct access from root level
              temperature_data: r.temperature_data || [],
              geojson: r.geojson,
              bounds: mapBounds,  // Original bounds without padding
              map_config: r.map_config,
              extreme_regions: (r as any).__extreme_regions || undefined,
              // ✅ CRITICAL: Pass through tile configuration
              use_tiles: r.use_tiles,
              tile_config: r.tile_config,
              variable_info: {
                name: variable,
                unit: getVariableUnit(variable),
                displayName: getDisplayName(variable)
              },
              analysis_type: analysisType,
              data_type: 'unified_backend',
              raw_response: r  // Pass entire raw response
            }
          }
          
          console.log('🏗️ Created mapData with tile info:', {
            use_tiles: mapData.azureData?.use_tiles,
            tile_config: mapData.azureData?.tile_config,
            geotiff_url: mapData.azureData?.geotiff_url,
            static_url: mapData.azureData?.static_url,
            overlay_url: mapData.azureData?.overlay_url
          })
        }
        
        imageUrl = r.static_url
        
        // Don't append extra notes if we have a region summary
        if (!hasRegionSummary && hasTemperatureData) {
          const note = `Interactive map ready with ${r.temperature_data.length} data points.`
          // ✅ FIXED: Only add note if cleanContent doesn't already contain URLs
          if (!cleanContent.includes('Interactive map ready')) {
            cleanContent = cleanContent ? `${cleanContent}\n${note}` : note
          }
        }
      } else {
        // Legacy fallback
        console.log('❌ Processing as legacy response')
        imageUrl = r?.content?.match(/https?:\/\/[^\s]+/)?.[0] || null
        if (typeof cleanContent === 'string') {
          cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
        }
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',        // ✅ FINAL CLEANUP: Ensure no URLs in final text
        text: (cleanContent || 'Analysis completed.').replace(/https?:\/\/[^\s]+/g, '').trim() || 'Analysis completed.',
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
                {/* Add debug button */}
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
                  💡 Try: "show temperature in Michigan" - Now with conversation memory!
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
                  
                  {/* Show Azure Maps when we have any valid map data */}
                  {m.mapData && AZURE_MAPS_KEY && (
                    <div className="mt-3 space-y-4">
                      {/* Interactive Azure Map */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">🗺️ Interactive Azure Maps</h4>
                        <AzureMapView 
                          mapData={m.mapData} 
                          subscriptionKey={AZURE_MAPS_KEY}
                          clientId={AZURE_MAPS_CLIENT_ID}
                          height="500px"
                        />
                        <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                          <span className="text-xs">
                            🗺️ Interactive Azure Maps • {
                              m.mapData.azureData?.geojson?.features?.length 
                                ? `Click points for details • ${m.mapData.azureData.geojson.features.length} data points`
                                : m.mapData.azureData?.geotiff_url
                                ? 'GeoTIFF overlay with data visualization'
                                : 'Interactive map'
                            }
                          </span>
                          <span className="text-xs text-green-600">Live Data</span>
                        </div>
                      </div>

                      {/* Static Map - only if static_url exists */}
                      {m.mapData.azureData?.static_url && (
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
                      )}
                    </div>
                  )}

                  {/* Fallback: Show static image only if no mapData but imageUrl exists */}
                  {!m.mapData && m.imageUrl && (
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
                placeholder="Ask about hydrology data... (e.g., 'show temperature in Michigan')"
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

          {/* Debug section - always present but collapsed */}
        <details className="p-4 border-t bg-gray-50">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2">
            <span>🔍 Debug Info</span>
            {debug && <span className="text-xs text-green-600">(Data available)</span>}
          </summary>
          {debug ? (
            <div className="mt-3 bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
              <pre className="text-xs">{JSON.stringify(debug, null, 2)}</pre>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-500 italic">
              No debug data yet. Submit a query to see debug information.
            </div>
          )}
        </details>
        </div>
      </div>
    </div>
  )
}