// src/components/HydrologyDarkChat.tsx
import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction, testFastAPIConnection } from '../services/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import AzureMapView from './AzureMapView'
import ProgressSteps from './ProgressSteps'
import { useStreamingChat } from '../hooks/useStreamingChat'
import { getStableUserId, clearUserId } from '../utils/userIdentity'
import type { Message, MapData } from '../types'

// Get Azure Maps credentials from environment variables
const AZURE_MAPS_KEY = import.meta.env.VITE_AZURE_MAPS_SUBSCRIPTION_KEY
const AZURE_MAPS_CLIENT_ID = import.meta.env.VITE_AZURE_MAPS_CLIENT_ID

// Feature flag for streaming
const USE_STREAMING = true

export default function HydrologyDarkChat() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [debug, setDebug] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Streaming hook
  const { 
    steps: progressSteps, 
    isStreaming, 
    sendStreamingQuery, 
    resetSteps 
  } = useStreamingChat()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progressSteps])

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
  const handleNewConversation = async () => {
    clearUserId()
    const newId = await getStableUserId()
    setUserId(newId)
    setThreadId(null)
    setMessages([])
    setError(null)
    setDebug(null)
    resetSteps()
    console.log('🔄 New conversation with user ID:', newId.substring(0, 8) + '...')
  }

  // ═══ PDF EXPORT FUNCTION ═══
  const handleExportPDF = async () => {
    const container = chatContainerRef.current
    if (!container || messages.length === 0) return

    setExporting(true)

    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')

      // Swap interactive maps for static images
      container.querySelectorAll('[data-export-hide="true"]').forEach(el => {
        ;(el as HTMLElement).style.display = 'none'
      })
      container.querySelectorAll('[data-export-show="true"]').forEach(el => {
        ;(el as HTMLElement).style.display = 'block'
      })

      // Expand container to full height
      const orig = {
        height: container.style.height,
        maxHeight: container.style.maxHeight,
        overflow: container.style.overflow
      }
      container.style.height = 'auto'
      container.style.maxHeight = 'none'
      container.style.overflow = 'visible'

      // Wait for images to load
      await new Promise(r => setTimeout(r, 800))

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000000',
        logging: false
      })

      // Restore container
      container.style.height = orig.height
      container.style.maxHeight = orig.maxHeight
      container.style.overflow = orig.overflow
      container.querySelectorAll('[data-export-hide="true"]').forEach(el => {
        ;(el as HTMLElement).style.display = ''
      })
      container.querySelectorAll('[data-export-show="true"]').forEach(el => {
        ;(el as HTMLElement).style.display = 'none'
      })

      // Build multi-page PDF
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4'
      })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const marginTop = 40
      const marginBottom = 30
      const contentH = pageH - marginTop - marginBottom
      const scale = pageW / canvas.width
      const scaledH = canvas.height * scale
      const totalPages = Math.ceil(scaledH / contentH)

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage()

        // Header on first page
        if (p === 0) {
          pdf.setFontSize(14)
          pdf.setTextColor(30, 30, 60)
          pdf.text('NLDAS-3 Hydrology Copilot — Session Export', 40, 25)
          pdf.setFontSize(8)
          pdf.setTextColor(120, 120, 140)
          pdf.text(new Date().toLocaleString(), pageW - 160, 25)
        }

        // Slice canvas for this page
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        const sliceStartY = (p * contentH) / scale
        const sliceHeight = Math.min(contentH / scale, canvas.height - sliceStartY)
        sliceCanvas.height = sliceHeight
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(
          canvas,
          0, sliceStartY, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        )
        pdf.addImage(
          sliceCanvas.toDataURL('image/png'),
          'PNG', 0, marginTop, pageW, sliceHeight * scale
        )

        // Footer
        pdf.setFontSize(7)
        pdf.setTextColor(150, 150, 170)
        pdf.text(
          `NLDAS-3 Weather Copilot — Page ${p + 1} of ${totalPages}`,
          pageW / 2, pageH - 12, { align: 'center' }
        )
      }

      pdf.save(`hydrology_chat_${new Date().toISOString().slice(0, 10)}.pdf`)
      console.log('✅ PDF exported successfully')
    } catch (err) {
      console.error('❌ PDF export failed:', err)
      alert('PDF export failed. Check console for details.')
    } finally {
      setExporting(false)
    }
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
      'temperature': 'Temperature',
      'Evap': 'Evapotranspiration',
      'PotEvap': 'Potential ET',
      'ECanop': 'Canopy Evaporation',
      'ESoil': 'Soil Evaporation',
      'TVeg': 'Transpiration',
      'Qs': 'Surface Runoff',
      'Qsb': 'Baseflow Runoff',
      'Snowf': 'Snowfall',
      'SoilM_0_10cm': 'Soil Moisture (0-10cm)',
      'SoilM_10_40cm': 'Soil Moisture (10-40cm)',
      'SoilM_40_100cm': 'Soil Moisture (40-100cm)',
      'SoilM_100_200cm': 'Soil Moisture (100-200cm)',
      'SoilM_root_zone': 'Root-Zone Soil Moisture',
      'VPD': 'Vapor Pressure Deficit',
      'SWE': 'Snow Water Equivalent',
      'SnowDepth': 'Snow Depth',
      'AvgSurfT': 'Surface Temperature',
      'SoilT_0_10cm': 'Soil Temp (0-10cm)',
      'SoilT_10_40cm': 'Soil Temp (10-40cm)',
      'SoilT_40_100cm': 'Soil Temp (40-100cm)',
      'SoilT_100_200cm': 'Soil Temp (100-200cm)',
      'SoilM_root_zone': 'Root-Zone Soil Moisture (0-100cm)',
      'SoilMoisture_root_zone': 'Root-Zone Soil Moisture',  // GPT-4o sometimes uses this
      'Evapotranspiration': 'Evapotranspiration',    
      'LAI': 'Leaf Area Index',
      'GPP': 'gC/m²/day',
      'NEE': 'gC/m²/day',
      'NPP': 'gC/m²/day',
      'TWS': 'Total Water Storage',
      'GWS': 'Groundwater Storage',
      'WaterTableD': 'Water Table Depth',
      'Qh': 'Sensible Heat Flux',
      'Qle': 'Latent Heat Flux',
      'Qg': 'Ground Heat Flux',
      'LWnet': 'Net Longwave',
      'SWnet': 'Net Shortwave',
      'LWdown': 'Longwave Down',
      'SWdown': 'Shortwave Down',
      'PSurf': 'Surface Pressure',
      'corn_yield': 'Corn Yield',
      'SnowFrac': 'Snow Cover Fraction',
      'CanopInt': 'Canopy Interception'
    }
    return variableMap[variable] || variable.replace(/_/g, ' ')
  }

  function getVariableUnit(variable: string): string {
    const unitMap: { [key: string]: string } = {
      'Tair': '°C', 'temperature': '°C', 'Rainf': 'mm/hr',
      'Wind_Speed': 'm/s', 'wind_speed': 'm/s', 'Wind_E': 'm/s', 'Wind_N': 'm/s',
      'Qair': 'kg/kg', 'Qair_f_inst': 'kg/kg', 'RelHum': '%', 'humidity': '%',
      'SPI': '', 'SPI3': '', 'spi': '',
      'Evap': 'mm/day', 'PotEvap': 'mm/day', 'ECanop': 'mm/day', 'ESoil': 'mm/day',
      'TVeg': 'mm/day', 'Qs': 'mm/day', 'Qsb': 'mm/day', 'Snowf': 'mm/day',
      'SoilM_0_10cm': 'm³/m³', 'SoilM_10_40cm': 'm³/m³', 'SoilM_40_100cm': 'm³/m³',
      'SoilM_100_200cm': 'm³/m³', 'SoilM_root_zone': 'm³/m³','SoilM_root_zone': 'm³/m³',
      'VPD': 'hPa', 'SWE': 'kg/m²', 'SnowDepth': 'cm', 'SnowFrac': '%',
      'AvgSurfT': '°C', 'AvgSurfT_max': '°C', 'AvgSurfT_min': '°C',
      'SoilT_0_10cm': '°C', 'SoilT_10_40cm': '°C', 'SoilT_40_100cm': '°C', 'SoilT_100_200cm': '°C',
      'LAI': '', 'GPP': 'gC/m²/day', 'NEE': 'gC/m²/day', 'NPP': 'gC/m²/day',
      'TWS': 'mm', 'GWS': 'mm', 'WaterTableD': 'm', 'CanopInt': 'kg/m²',
      'LWnet': 'W/m²', 'SWnet': 'W/m²', 'Qh': 'W/m²', 'Qle': 'W/m²', 'Qg': 'W/m²',
      'LWdown': 'W/m²', 'SWdown': 'W/m²', 'PSurf': 'Pa',
      'corn_yield': 'kg/ha'
    }
    return unitMap[variable] || ''
  }

  function getMapBounds(query: string): MapData['bounds'] {
    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes('florida')) return { north: 31.0, south: 24.5, east: -80.0, west: -87.6 }
    if (lowerQuery.includes('california')) return { north: 42.0, south: 32.5, east: -114.1, west: -124.4 }
    if (lowerQuery.includes('maryland')) return { north: 39.7, south: 37.9, east: -75.0, west: -79.5 }
    if (lowerQuery.includes('texas')) return { north: 36.5, south: 25.8, east: -93.5, west: -106.6 }
    if (lowerQuery.includes('michigan')) return { north: 48.3, south: 41.7, east: -82.4, west: -90.4 }
    return { north: 49.0, south: 25.0, east: -66.0, west: -125.0 }
  }

  function extractMarkdownImage(text: string): { imageUrl: string | null, cleanText: string } {
    let markdownImageMatch = text.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
    if (markdownImageMatch) {
      const imageUrl = markdownImageMatch[1]
      const cleanText = text
        .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)/g, '')
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\)/g, '')
        .trim().replace(/\n\s*\n/g, '\n')
      console.log('📷 Detected markdown IMAGE syntax, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    const markdownLinkMatch = text.match(/\[.*?\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*)\)/i)
    if (markdownLinkMatch) {
      const imageUrl = markdownLinkMatch[1]
      const cleanText = text
        .replace(/\[.*?\]\(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*\)/gi, '')
        .trim().replace(/\n\s*\n/g, '\n')
      console.log('📷 Detected markdown LINK to image file, extracted URL:', imageUrl)
      return { imageUrl, cleanText }
    }
    return { imageUrl: null, cleanText: text }
  }

  function isGifUrl(url: string | undefined): boolean {
    if (!url || typeof url !== 'string') return false
    const urlWithoutParams = url.split('?')[0]
    return urlWithoutParams.toLowerCase().endsWith('.gif')
  }

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

  // Process response (extracted for reuse)
  function processResponse(r: any, currentQuery: string): { 
    cleanContent: string, 
    imageUrl: string | null, 
    mapData: MapData | undefined,
    allImageUrls: string[]
  } {
    let cleanContent = ''
    
    if (r?.analysis_data?.result && r?.analysis_data?.status !== 'error') {
      const result = r.analysis_data.result
      if (typeof result === 'string') {
        const hasUrl = /https?:\/\/[^\s]+/.test(result)
        if (!hasUrl) { cleanContent = result; console.log('📝 Using text result:', cleanContent) }
      } 
      else if (typeof result === 'object' && result !== null) {
        const isMapResult = !!(result.static_url || result.overlay_url || result.geojson)
        if (!isMapResult) { cleanContent = formatDataResult(result); console.log('📊 Formatted data result:', cleanContent) }
      }
    }
    if (!cleanContent && r?.agent_response) cleanContent = r.agent_response
    if (!cleanContent && r?.content) cleanContent = typeof r.content === 'string' ? r.content : ''

    if (typeof cleanContent === 'string') {
      cleanContent = cleanContent.replace(/\[.*?\]\(result\.[a-z_]+\)/gi, '')
      cleanContent = cleanContent.replace(/!\[.*?\]\(result\.[a-z_]+\)/gi, '')
      cleanContent = cleanContent.replace(/result\.(static_url|overlay_url|url|image_url)/gi, '')
      cleanContent = cleanContent.replace(/\*\*.*?:\*\*\s*$/gm, '')
      cleanContent = cleanContent.replace(/^\s*-\s*$/gm, '')
      cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n')
      cleanContent = cleanContent.trim()
    }

    let markdownExtractedUrl = null
    if (typeof cleanContent === 'string' && 
        (cleanContent.includes('![') || (cleanContent.includes('[') && cleanContent.includes('](')))) {
      const extracted = extractMarkdownImage(cleanContent)
      if (extracted.imageUrl) { markdownExtractedUrl = extracted.imageUrl; cleanContent = extracted.cleanText }
    }

    if (!markdownExtractedUrl && typeof cleanContent === 'string' && cleanContent) {
      const looksLikeAnswer = /\b(is|are|average|total|maximum|minimum|speed|temperature|value)\b/i.test(cleanContent)
      if (!looksLikeAnswer || cleanContent.includes('Analysis completed')) {
        cleanContent = cleanContent.replace(/^Analysis completed:?.*$/im, '').trim()
        cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').trim()
        cleanContent = cleanContent.replace(/\n\s*\n/g, '\n').trim()
      }
    }

    if (!cleanContent || cleanContent.trim() === '') cleanContent = ''

    const hasStaticUrl = !!(r?.static_url)
    const hasOverlayUrl = !!(r?.overlay_url)
    const hasGeoTiffUrl = !!(r?.geotiff_url)
    let hasGeoJsonData = !!(r?.geojson?.features?.length > 0)

    const isAnimation = (
      r?.type === 'animation' || r?.metadata?.computation_type === 'animation' ||
      r?.media_type === 'gif' || isGifUrl(r?.static_url) || isGifUrl(r?.overlay_url)
    )
    if (isAnimation) console.log('🎞️ Animation/GIF detected via isGifUrl helper')

    if (hasGeoJsonData) {
      r.geojson.features = r.geojson.features
        .filter((f: any) => {
          const lat = f.geometry?.coordinates?.[1]; const lng = f.geometry?.coordinates?.[0]
          const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
          return isFinite(lat) && isFinite(lng) && isFinite(value)
        })
        .map((f: any) => {
          const value = f.properties?.value ?? f.properties?.spi ?? f.properties?.temperature ?? f.properties?.spi_value
          const variable = f.properties?.variable || 'spi'
          return { ...f, properties: { ...f.properties, value, variable, unit: getVariableUnit(variable), displayName: getDisplayName(variable) } }
        })
      hasGeoJsonData = r.geojson.features.length > 0
    }

    const variable = r?.variable || 'temperature'

    const isSimpleVisualization = (
      r?.type === "simple_visualization" || 
      r?.metadata?.computation_type === "comparison" ||
      r?.metadata?.computation_type === "analysis" ||
      r?.use_tiles === false ||
      (!r?.bounds && !r?.map_config && hasStaticUrl) ||
      /recovery|flash drought/i.test(currentQuery)
    )

    let imageUrl = null
    let mapData: MapData | undefined

    if (isAnimation && hasStaticUrl) {
      console.log('🎞️ Animation detected (GIF) — showing static image only, no Azure map')
      imageUrl = r.static_url; mapData = undefined
      if (!cleanContent || cleanContent.length < 10) {
        const region = r?.metadata?.region || r?.region || ''
        const dateRange = r?.metadata?.date || r?.date || ''
        const vRaw = r?.metadata?.variable || r?.variable || 'data'
        const v = Array.isArray(vRaw) ? vRaw.join(', ') : String(vRaw)
        cleanContent = `Here's the visualization${v ? ` of ${v.replace(/_/g, ' ')}` : ''}${region ? ` for ${region.replace(/_/g, ' ')}` : ''}.`
      }
    }
    else if (isSimpleVisualization && hasStaticUrl) {
      console.log('📊 Simple visualization detected — using static image only')
      imageUrl = r.static_url; mapData = undefined
      if (!cleanContent || cleanContent.length < 10) {
        const region = r?.metadata?.region || r?.region || ''
        const vRaw = r?.metadata?.variable || r?.variable || 'data'
        const v = Array.isArray(vRaw) ? vRaw.join(', ') : String(vRaw)
        cleanContent = `Here's the visualization${v ? ` of ${v.replace(/_/g, ' ')}` : ''}${region ? ` for ${region.replace(/_/g, ' ')}` : ''}.`
      }
    }
    else if ((hasStaticUrl || hasOverlayUrl || hasGeoJsonData || hasGeoTiffUrl) && !isSimpleVisualization) {
      let mapBounds = null
      let mapCenter = r.map_config?.center
      
      if (r.bounds && isFinite(r.bounds.north) && isFinite(r.bounds.south) && 
          isFinite(r.bounds.east) && isFinite(r.bounds.west)) {
        mapBounds = r.bounds
      } else if (hasGeoJsonData) {
        const validCoords = r.geojson.features
          .map((f: any) => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }))
          .filter((coord: any) => isFinite(coord.lat) && isFinite(coord.lng))
        if (validCoords.length > 0) {
          const lats = validCoords.map((c: any) => c.lat)
          const lngs = validCoords.map((c: any) => c.lng)
          mapBounds = { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }
        }
      }
      if (!mapBounds) mapBounds = getMapBounds(currentQuery)
      if (!mapCenter && mapBounds) mapCenter = [(mapBounds.west + mapBounds.east) / 2, (mapBounds.north + mapBounds.south) / 2]
      
      const latPadding = mapBounds ? Math.abs(mapBounds.north - mapBounds.south) * 0.02 : 0.5
      const lngPadding = mapBounds ? Math.abs(mapBounds.east - mapBounds.west) * 0.02 : 0.5
      const paddedBounds = mapBounds ? {
        north: mapBounds.north + latPadding, south: mapBounds.south - latPadding,
        east: mapBounds.east + lngPadding, west: mapBounds.west - lngPadding
      } : getMapBounds(currentQuery)
      const center = mapCenter ? { lat: mapCenter[1], lng: mapCenter[0] } : {
        lat: (paddedBounds.north + paddedBounds.south) / 2, lng: (paddedBounds.east + paddedBounds.west) / 2
      }
      
      mapData = {
        map_url: r.overlay_url || r.static_url || '',
        bounds: paddedBounds, center, zoom: r.map_config?.zoom || 9,
        azureData: {
          static_url: r.static_url, overlay_url: r.overlay_url, geotiff_url: r.geotiff_url,
          temperature_data: r.temperature_data || [], geojson: r.geojson,
          bounds: mapBounds, map_config: r.map_config,
          use_tiles: r.use_tiles, tile_config: r.tile_config,
          variable_info: { name: variable, unit: getVariableUnit(variable), displayName: getDisplayName(variable) },
          data_type: 'unified_backend', raw_response: r
        }
      }
      imageUrl = r.static_url
    } else {
      imageUrl = r?.content?.match(/https?:\/\/[^\s]+/)?.[0] || null
    }

    if (markdownExtractedUrl && !r?.static_url) imageUrl = markdownExtractedUrl

    const allViz = r?.all_visualizations
    let allImageUrls: string[] = []
    if (Array.isArray(allViz) && allViz.length > 1) {
      allImageUrls = allViz.map((v: any) => v.static_url).filter((url: string) => url && typeof url === 'string' && url.startsWith('http'))
      console.log(`📊 Multiple visualizations detected: ${allImageUrls.length} images`)
    }

    return { cleanContent, imageUrl, mapData, allImageUrls }
  }

  // ⏱️ Timer badge component
  function TimerBadge({ elapsedMs }: { elapsedMs?: number }) {
    if (!elapsedMs) return null
    const seconds = (elapsedMs / 1000).toFixed(1)
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-xs text-gray-500">⏱️ {seconds}s</span>
      </div>
    )
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return

    const startTime = performance.now()
    const userMsg: Message = { id: String(Date.now()), role: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    const currentQuery = query
    setQuery('')
    setError(null)
    setLoading(true)
    resetSteps()

    try {
      console.log('Sending request to backend with query:', userMsg.text)
      let r: any

      if (USE_STREAMING) {
        console.log('🌊 Using streaming endpoint...')
        try {
          const streamResult = await sendStreamingQuery(currentQuery, userId, threadId)
          r = streamResult?.result || streamResult
          console.log('🌊 Stream result:', r)
        } catch (streamError: any) {
          console.warn('⚠️ Streaming failed, falling back to regular endpoint:', streamError)
          const resp = await callMultiAgentFunction({ action: 'generate', data: { query: userMsg.text, user_id: userId, thread_id: threadId } })
          r = resp.response
        }
      } else {
        const resp = await callMultiAgentFunction({ action: 'generate', data: { query: userMsg.text, user_id: userId, thread_id: threadId } })
        r = resp.response
      }
      
      console.log('Raw backend response:', r)
      if (r?.thread_id) { setThreadId(r.thread_id); console.log('💾 Stored thread_id:', r.thread_id.substring(0, 12) + '...') }

      let hasError = false
      let errorMessage = ''

      if (r?.status === 'error') {
        hasError = true; errorMessage = r?.error || r?.analysis_data?.error || 'An error occurred during analysis'
      } else if (r?.analysis_data?.status === 'error' && !r?.content && !r?.agent_response) {
        hasError = true; errorMessage = r?.analysis_data?.error || 'An error occurred during analysis'
      } else if (r?.analysis_data?.status === 'error' && (r?.content || r?.agent_response)) {
        console.log('⚠️ Analysis had error but agent recovered:', r?.analysis_data?.error)
      }

      if (hasError) {
        const elapsedMs = Math.round(performance.now() - startTime)
        const errorMsg: Message = {
          id: String(Date.now() + 1), role: 'assistant',
          text: `⚠️ Error: ${errorMessage}\n\n${r?.analysis_data?.suggestion ? `💡 Suggestion: ${r.analysis_data.suggestion}` : ''}`,
          elapsedMs
        }
        setMessages((prev) => [...prev, errorMsg])
        setDebug((r?.debug ?? r) || null); setLoading(false)
        console.log(`⏱️ Query failed in ${(elapsedMs / 1000).toFixed(1)}s`)
        return
      }

      const { cleanContent, imageUrl, mapData, allImageUrls } = processResponse(r, currentQuery)
      const elapsedMs = Math.round(performance.now() - startTime)

      const assistantMsg: Message = {
        id: String(Date.now() + 1), role: 'assistant', text: cleanContent,
        imageUrl: allImageUrls && allImageUrls.length > 1 ? undefined : imageUrl,
        mapData, allImageUrls: allImageUrls && allImageUrls.length > 1 ? allImageUrls : undefined,
        elapsedMs
      }

      setMessages((prev) => [...prev, assistantMsg])
      setDebug((r?.debug ?? r) || null)
      console.log(`⏱️ Query completed in ${(elapsedMs / 1000).toFixed(1)}s`)
      
    } catch (err: any) {
      console.error('Query failed:', err)
      const elapsedMs = Math.round(performance.now() - startTime)
      setError(`Connection failed: ${err?.message || 'Unknown error'}`)
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', text: `Request failed: ${err?.message || 'Backend connection error'}`, elapsedMs }])
      console.log(`⏱️ Query errored in ${(elapsedMs / 1000).toFixed(1)}s`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: '#000000' }}>
      {/* Header with integrated logos */}
      <div className="relative w-full overflow-hidden" style={{ height: '220px', background: '#000000' }}>
        <div className="absolute inset-0 z-0" style={{ background: '#000000' }}>
          <img 
            src="/total.svg" 
            alt="Hydrology Cycle with NASA and Microsoft logos" 
            className="w-full h-full object-cover object-left"
            style={{ animation: 'float 6s ease-in-out infinite', background: '#000000' }}
            onError={(e) => { console.error('❌ Failed to load /total.svg'); e.currentTarget.style.display = 'none' }}
            onLoad={() => { console.log('✅ Successfully loaded /total.svg') }}
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
          style={{ minHeight: '350px', maxHeight: 'calc(100vh - 350px)' }}
        >
          <div ref={chatContainerRef} data-export-id="chat" className="max-w-3xl mx-auto space-y-4">
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
                {m.text && !m.mapData && !m.imageUrl && !m.allImageUrls && (
                  <div className={`max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
                  } px-5 py-3`}>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    {m.role === 'assistant' && <TimerBadge elapsedMs={m.elapsedMs} />}
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
                        {m.role === 'assistant' && <TimerBadge elapsedMs={m.elapsedMs} />}
                      </div>
                    )}
                    
                    {m.mapData && (
                      <div className="bg-black border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                        <div className="text-sm font-semibold text-gray-300 mb-2">🗺️ Interactive Map:</div>
                        {/* Interactive map - hidden during PDF export */}
                        <div className="rounded-lg overflow-hidden border border-gray-700" data-export-hide="true">
                          <AzureMapView 
                            mapData={m.mapData} 
                            subscriptionKey={AZURE_MAPS_KEY || ''}
                            clientId={AZURE_MAPS_CLIENT_ID}
                            height="400px"
                          />
                        </div>
                        {/* Static map for PDF export - hidden in browser */}
                        {m.mapData.azureData?.static_url && (
                          <img 
                            src={m.mapData.azureData.static_url}
                            alt="Map export"
                            crossOrigin="anonymous"
                            data-export-show="true"
                            className="rounded-lg w-full"
                            style={{ display: 'none' }}
                          />
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Click points for details
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Multiple visualizations */}
                {m.allImageUrls && m.allImageUrls.length > 1 && !m.mapData && (
                  <div className="w-full">
                    {m.text && (
                      <div className="max-w-[85%] mb-4 bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-5 py-3">
                        <div className="whitespace-pre-wrap">{m.text}</div>
                        <TimerBadge elapsedMs={m.elapsedMs} />
                      </div>
                    )}
                    <div className="bg-black border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-3">
                      <div className="grid grid-cols-1 gap-4">
                        {m.allImageUrls.map((url, idx) => (
                          <img 
                            key={idx} src={url} alt={`Analysis ${idx + 1}`} 
                            className="rounded-lg w-full cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Click any image to view full size</p>
                    </div>
                  </div>
                )}

                {/* Image only message (single) */}
                {m.imageUrl && !m.mapData && !m.allImageUrls && (
                  <div className={`max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-black border border-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
                  } px-5 py-3`}>
                    {m.text && <div className="whitespace-pre-wrap mb-4">{m.text}</div>}
                    <div className="relative">
                      <img src={m.imageUrl} alt="Result" className="rounded-lg w-full" />
                      <a href={m.imageUrl} download target="_blank" rel="noopener noreferrer" title="Download map as PNG" className="absolute top-3 left-3 bg-black/70 hover:bg-black/90 text-white p-2 rounded-md transition-all backdrop-blur-sm border border-white/10 hover:border-white/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    </div>
                    {m.role === 'assistant' && <TimerBadge elapsedMs={m.elapsedMs} />}
                  </div>
                )}
              </div>
            ))}
            
            {/* Progress Steps Display */}
            {(loading || isStreaming) && (
              <div className="flex justify-start">
                <ProgressSteps steps={progressSteps} isLoading={loading || isStreaming} />
              </div>
            )}
            
            {/* Fallback loading indicator */}
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
              onClick={handleExportPDF}
              disabled={messages.length === 0 || exporting}
              className="px-3 py-1.5 text-xs bg-black hover:bg-black text-gray-300 border border-gray-800 rounded-lg transition-all duration-200 hover:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export conversation to PDF"
            >
              {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
            </button>
            
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
                  <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-300">✕</button>
                </div>
                <pre className="text-xs text-gray-300 overflow-auto max-h-48">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Export overlay */}
      {exporting && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-10 py-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Exporting to PDF...</p>
            <p className="text-gray-400 text-sm mt-2">Capturing maps and conversation</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}