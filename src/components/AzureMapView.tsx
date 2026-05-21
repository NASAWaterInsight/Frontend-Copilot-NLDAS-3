import React, { useEffect, useRef, useState } from 'react'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import { loadGeoTiffOverlay, createDynamicLegend } from '../utils/geotiffLoader'
import ColorbarLegend from './ColorbarLegend'

interface AzureMapViewProps {
  mapData: {
    map_url?: string
    bounds?: {
      north: number
      south: number
      east: number
      west: number
    }
    center?: {
      lat: number
      lng: number
    }
    zoom?: number
    azureData?: any
  }
  subscriptionKey: string
  clientId?: string
  height?: string
}

export default function AzureMapView({ mapData, subscriptionKey, clientId, height = '400px' }: AzureMapViewProps) {
  // ═══ ALL HOOKS FIRST — before any conditional returns ═══
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<atlas.Map | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Compute rendering conditions (no side effects, no returns)
  const hasRealMapData = !!(
    mapData?.azureData &&
    (mapData.azureData.use_tiles === true ||
     mapData.azureData.overlay_url ||
     mapData.azureData.static_url)
  )

  const isGif = (
    typeof mapData?.azureData?.static_url === 'string' && mapData.azureData.static_url.split('?')[0].toLowerCase().endsWith('.gif')
  ) || (
    typeof mapData?.azureData?.overlay_url === 'string' && mapData.azureData.overlay_url.split('?')[0].toLowerCase().endsWith('.gif')
  )

  const useTilesFlag = mapData?.azureData?.use_tiles === true
  const staticUrl = mapData?.azureData?.static_url
  const hasValidTileConfig = !!(mapData?.azureData?.tile_config?.tile_url)
  const hasGeoJsonPoints = !!(mapData?.azureData?.geojson?.features?.length > 0)

  // Should we attempt Azure Maps initialization?
  // Init when we have tiles OR when we have GeoJSON hover points
  const shouldInitMap = (
    hasRealMapData &&
    !isGif &&
    ((useTilesFlag && hasValidTileConfig) || hasGeoJsonPoints) &&
    !!subscriptionKey
  )

  // Should we show static image directly (no map needed)?
  // Only when no tiles AND no GeoJSON points
  const shouldShowStatic = (
    hasRealMapData &&
    !isGif &&
    !useTilesFlag &&
    !hasGeoJsonPoints &&
    typeof staticUrl === 'string' &&
    staticUrl.startsWith('http')
  )

  // ═══ useEffect — always called, guards internally ═══
  useEffect(() => {
    if (!shouldInitMap || !mapRef.current) {
      console.log('🚫 Azure Maps init skipped:', {
        shouldInitMap,
        hasMapRef: !!mapRef.current,
        hasKey: !!subscriptionKey,
        useTiles: useTilesFlag,
        hasTileConfig: hasValidTileConfig
      })
      return
    }

    const defaultBounds = {
      north: 49.0, south: 25.0, east: -66.0, west: -125.0
    }

    const bounds = mapData.bounds || defaultBounds
    const center = mapData.center || {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    }

    console.log('Initializing Azure Maps with:', { bounds, center, azureData: mapData.azureData })

    let map: atlas.Map
    try {
      map = new atlas.Map(mapRef.current, {
        center: [center.lng, center.lat],
        zoom: mapData.zoom || 6,
        style: 'satellite_road_labels',
        interactive: true,
        showLogo: false,
        showFeedbackLink: false,
        authOptions: {
          authType: atlas.AuthenticationType.subscriptionKey,
          subscriptionKey: subscriptionKey
        }
      })
    } catch (initErr) {
      console.error('❌ Azure Maps constructor failed:', initErr)
      setMapError('Map failed to initialize')
      return
    }

    mapInstanceRef.current = map

    // Timeout: if map doesn't become ready in 10s, show fallback
    const readyTimeout = setTimeout(() => {
      if (!mapReady) {
        console.warn('⏰ Azure Maps did not become ready within 10s — showing static fallback')
        setMapError('Map loading timed out')
      }
    }, 10000)

    map.events.add('ready', () => {
      clearTimeout(readyTimeout)
      console.log('🗺️ Azure Maps Ready')
      setMapReady(true)

      setTimeout(() => {
        const tileConfig = mapData.azureData?.tile_config
        const overlayUrl = mapData.azureData?.overlay_url
        const hasGeoJsonData = !!(mapData.azureData?.geojson?.features?.length > 0)
        const requestedBounds = mapData.azureData?.bounds || mapData.bounds || bounds

        // Always add static overlay first as background
        if (useTilesFlag && tileConfig && tileConfig.tile_list && Array.isArray(tileConfig.tile_list)) {
          console.log(`🎯 Loading ${tileConfig.tile_list.length} backend tiles`)
          loadBackendTiles(map, tileConfig.tile_list)
        } else if (useTilesFlag && tileConfig && tileConfig.tile_url) {
          console.log('🗺️ Using TileLayer with URL template')
          addTileLayer(map, tileConfig)
        } else if ((overlayUrl || staticUrl) && requestedBounds) {
          console.log('📸 Using PNG overlay')
          addPngOverlay(map, mapData.azureData, requestedBounds, bounds)
        } else {
          console.warn('⚠️ No valid rendering method available')
        }

        // Add hover interactions if GeoJSON data exists
        if (hasGeoJsonData) {
          const variable = tileConfig?.variable || 'temperature'
          const unit = mapData.azureData.geojson.features[0]?.properties?.unit ?? ''
          const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            value: feature.properties.value,
            variable: feature.properties.variable || variable,
            unit: feature.properties.unit ?? unit
          }))
          processTemperatureData(map, temperatureData, variable, unit)
        }
      }, 1500)

      map.setCamera({
        bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
        padding: 40
      })
    })

    map.events.add('error', (error: any) => {
      clearTimeout(readyTimeout)
      console.error('❌ Azure Map error:', error)
      setMapError('Map failed to load')
    })

    return () => {
      clearTimeout(readyTimeout)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.dispose()
        mapInstanceRef.current = null
      }
    }
  }, [shouldInitMap, subscriptionKey, clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ CONDITIONAL RENDERING — after all hooks ═══

  // No data at all
  if (!hasRealMapData || isGif) {
    console.log('🚫 AzureMapView: Skipping (no map data or GIF)')
    return null
  }

  // Static image mode (no tiles requested)
  if (shouldShowStatic) {
    console.log('📸 AzureMapView: Static image mode (use_tiles not true)')
    return (
      <div className="flex justify-center items-center w-full" style={{ height }}>
        <img
          src={staticUrl!}
          alt="Weather analysis map"
          style={{
            maxHeight: height,
            maxWidth: '100%',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
          onError={(e) => {
            console.error('❌ Static image failed:', staticUrl)
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
    )
  }

  // Map error — fall back to static image
  if (mapError && staticUrl) {
    console.log('⚠️ AzureMapView: Map error, showing static fallback')
    return (
      <div className="flex justify-center items-center w-full" style={{ height }}>
        <img
          src={staticUrl}
          alt="Weather analysis map (static fallback)"
          style={{
            maxHeight: height,
            maxWidth: '100%',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
      </div>
    )
  }

  // No subscription key — fall back to static image
  if (!subscriptionKey && staticUrl) {
    console.log('⚠️ AzureMapView: No Azure Maps key, showing static fallback')
    return (
      <div className="flex justify-center items-center w-full" style={{ height }}>
        <img
          src={staticUrl}
          alt="Weather analysis map"
          style={{
            maxHeight: height,
            maxWidth: '100%',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
      </div>
    )
  }

  // Colorbar validation
  const tileConfig = mapData?.azureData?.tile_config
  const hasValidColorScale = !!(
    tileConfig?.color_scale &&
    typeof tileConfig.color_scale.vmin === 'number' &&
    typeof tileConfig.color_scale.vmax === 'number' &&
    isFinite(tileConfig.color_scale.vmin) &&
    isFinite(tileConfig.color_scale.vmax) &&
    tileConfig.color_scale.vmax > tileConfig.color_scale.vmin
  )

  const showColorbar = hasValidColorScale && useTilesFlag && mapReady
  // ═══ TILE MAP RENDERING ═══
  return (
    <div className="flex w-full relative" style={{ height }}>
      {/* Map container — always rendered, Azure Maps attaches here */}
      <div
        ref={mapRef}
        className="rounded-md border"
        style={{
          height,
          width: showColorbar ? 'calc(100% - 140px)' : '100%',
          display: mapReady ? 'block' : 'none'
        }}
      />
      {/* Download static map button — overlays interactive map, clear of colorbar */}
      {staticUrl && mapReady && (
        <a href={staticUrl} download target="_blank" rel="noopener noreferrer" title="Download static map (PNG)" className="absolute top-3 left-3 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-md transition-all backdrop-blur-sm border border-white/10 hover:border-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      )}

      {/* Loading spinner — shown while map is loading */}
      {!mapReady && !mapError && (
        <div className="flex justify-center items-center w-full absolute inset-0" style={{ height }}>
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="text-gray-400 text-xs">Loading interactive map...</span>
          </div>
        </div>
      )}

      {/* Colorbar */}
      {showColorbar && hasValidColorScale && (
        <div style={{ width: '140px', height }}>
          <ColorbarLegend
            vmin={tileConfig.color_scale.vmin}
            vmax={tileConfig.color_scale.vmax}
            cmap={tileConfig.color_scale.cmap || 'viridis'}
            variable={tileConfig.color_scale.variable || 'value'}
            unit={tileConfig.color_scale.unit || ''}
            colors={tileConfig.color_scale.colors}
            colorbarLabel={
              // Prefer backend's explicit colorbar_label, fall back to legacy fields
              mapData?.azureData?.metadata?.colorbar_label
              || tileConfig.color_scale?.colorbar_label
              || undefined
            }
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// HELPER FUNCTIONS (extracted from useEffect)
// ═══════════════════════════════════════════

function loadBackendTiles(map: atlas.Map, tileList: any[]) {
  if (!Array.isArray(tileList) || tileList.length === 0) {
    console.error('❌ Invalid or empty tile list')
    return
  }

  let successCount = 0
  let errorCount = 0

  tileList.forEach((tile, idx) => {
    if (!tile.url || !tile.bounds) {
      console.error(`❌ Invalid tile ${idx}:`, tile)
      errorCount++
      return
    }

    try {
      const coordinates: [number, number][] = [
        [tile.bounds.west, tile.bounds.north],
        [tile.bounds.east, tile.bounds.north],
        [tile.bounds.east, tile.bounds.south],
        [tile.bounds.west, tile.bounds.south]
      ]

      const imageLayer = new atlas.layer.ImageLayer({
        url: tile.url,
        coordinates: coordinates,
        opacity: 0.75,
        visible: true
      })

      map.layers.add(imageLayer, 'labels')
      successCount++
    } catch (e) {
      console.error(`❌ Tile ${idx} failed:`, (e as any)?.message)
      errorCount++
    }
  })

  console.log(`🎯 Tiles loaded: ${successCount} success, ${errorCount} errors`)
}

function addTileLayer(map: atlas.Map, tileConfig: any) {
  if (!tileConfig?.tile_url) return

  try {
    if ((atlas as any).source?.TileSource && (atlas as any).layer?.TileLayer) {
      const source = new (atlas as any).source.TileSource('weather-tiles', {
        tileUrl: tileConfig.tile_url,
        tileSize: tileConfig.tile_size || 256,
        maxZoom: tileConfig.max_zoom || 10,
        minZoom: tileConfig.min_zoom || 3
      })
      map.sources.add(source)
      const layer = new (atlas as any).layer.TileLayer({
        source: source,
        opacity: 0.7
      }, 'labels')
      map.layers.add(layer)
      console.log('✅ Native TileLayer added')
    }
  } catch (e) {
    console.warn('⚠️ TileLayer failed:', (e as any)?.message)
  }
}

function addPngOverlay(map: atlas.Map, azureData: any, requestedBounds: any, fallbackBounds: any) {
  const imageUrl = azureData?.overlay_url || azureData?.static_url
  if (!imageUrl || !imageUrl.startsWith('http')) return

  const overlayBounds = azureData?.bounds || requestedBounds || fallbackBounds
  if (!overlayBounds ||
      !isFinite(overlayBounds.north) || !isFinite(overlayBounds.south) ||
      !isFinite(overlayBounds.east) || !isFinite(overlayBounds.west) ||
      overlayBounds.north <= overlayBounds.south ||
      overlayBounds.west >= overlayBounds.east) {
    console.error('❌ Invalid overlay bounds:', overlayBounds)
    return
  }

  const coordinates: [number, number][] = [
    [overlayBounds.west, overlayBounds.north],
    [overlayBounds.east, overlayBounds.north],
    [overlayBounds.east, overlayBounds.south],
    [overlayBounds.west, overlayBounds.south]
  ]

  const isTransparent = imageUrl.includes('overlay') || imageUrl.includes('transparent')
  const imageLayer = new atlas.layer.ImageLayer({
    url: imageUrl,
    coordinates: coordinates,
    opacity: isTransparent ? 0.8 : 0.6,
    visible: true
  })

  try {
    map.layers.add(imageLayer, 'labels')
    console.log('✅ PNG overlay added')
    map.setCamera({
      bounds: [overlayBounds.west, overlayBounds.south, overlayBounds.east, overlayBounds.north],
      padding: 40
    })
  } catch (e) {
    console.error('❌ PNG overlay failed:', e)
    try { map.layers.add(imageLayer) } catch {}
  }
}

function processTemperatureData(map: atlas.Map, temperatureData: any[], variable: string, unit: string) {
  const validData = temperatureData.filter((point: any) => {
    const { latitude: lat, longitude: lng, value: val } = point
    return (
      typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
      typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180 &&
      typeof val === 'number' && isFinite(val)
    )
  })

  if (validData.length === 0) return

  let avgDistance = 0.1
  if (validData.length > 1) {
    const sampleSize = Math.min(10, validData.length - 1)
    let totalDistance = 0
    for (let i = 0; i < sampleSize; i++) {
      const p1 = validData[i], p2 = validData[i + 1]
      totalDistance += Math.sqrt(
        Math.pow(p2.longitude - p1.longitude, 2) +
        Math.pow(p2.latitude - p1.latitude, 2)
      )
    }
    avgDistance = totalDistance / sampleSize
  }

  const adaptiveRadius = Math.max(0.05, Math.min(0.5, avgDistance * 2))

  const popup = new atlas.Popup({ pixelOffset: [0, -18], closeButton: false })
  let hoverTimeout: NodeJS.Timeout | null = null

  const nameMap: { [k: string]: string } = {
    'Tair': 'Air Temperature', 'temperature': 'Temperature', 'Rainf': 'Precipitation',
    'SPI3': 'Drought Index', 'Wind_Speed': 'Wind Speed', 'VPD': 'VPD',
    'SoilM_0_10cm': 'Soil Moisture (0-10cm)', 'Evap': 'Evapotranspiration'
  }

  map.events.add('mousemove', (e: any) => {
    if (hoverTimeout) clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      const pos = e.position
      if (!pos || !Array.isArray(pos) || pos.length !== 2) return

      let nearest: any = null, minDist = Infinity
      validData.forEach((pt: any) => {
        const d = Math.sqrt(Math.pow(pt.longitude - pos[0], 2) + Math.pow(pt.latitude - pos[1], 2))
        if (d < minDist) { minDist = d; nearest = pt }
      })

      if (nearest && minDist < adaptiveRadius) {
        popup.setOptions({
          content: `<div style="padding:8px;min-width:140px;font-size:12px;font-family:system-ui;">
            <div style="font-weight:bold;color:#2563eb;margin-bottom:4px;">${nameMap[variable] || variable}</div>
            <div style="font-size:14px;font-weight:bold;color:#dc2626;">${nearest.value.toFixed(2)} ${unit}</div>
            <div style="font-size:10px;color:#6b7280;margin-top:4px;">${nearest.latitude.toFixed(3)}°, ${nearest.longitude.toFixed(3)}°</div>
          </div>`,
          position: [nearest.longitude, nearest.latitude]
        })
        popup.open(map)
      } else {
        popup.close()
      }
    }, 100)
  })

  map.events.add('mouseleave', () => {
    if (hoverTimeout) clearTimeout(hoverTimeout)
    popup.close()
  })

  map.getCanvasContainer().style.cursor = 'crosshair'
  console.log('✅ Hover interactions ready for', validData.length, 'points')
}