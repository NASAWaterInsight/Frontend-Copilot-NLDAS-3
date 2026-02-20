import React, { useEffect, useRef, useState } from 'react'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import { loadGeoTiffOverlay, createDynamicLegend } from '../utils/geotiffLoader'
import ColorbarLegend from './ColorbarLegend'

// tilebounds removed - not needed for core functionality
const tilebounds: any = null

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
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<atlas.Map | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  // ✅ CRITICAL FIX: Early validation check
  const hasRealMapData = (
    mapData?.azureData &&
    (mapData.azureData.use_tiles === true || 
     mapData.azureData.overlay_url || 
     mapData.azureData.static_url)
  )

  // ✅ Skip map entirely if static/overlay is a GIF
  const isGif = (
    typeof mapData?.azureData?.static_url === 'string' && mapData.azureData.static_url.toLowerCase().endsWith('.gif')
  ) || (
    typeof mapData?.azureData?.overlay_url === 'string' && mapData.azureData.overlay_url.toLowerCase().endsWith('.gif')
  )

  if (!hasRealMapData || isGif) {
    console.log('🚫 AzureMapView: Skipping map rendering (no map data or GIF)')
    return null
  }

  // ✅ STATIC-ONLY RENDERING: If use_tiles is not true, show static image instead of Azure Map
  const useTilesFlag = mapData?.azureData?.use_tiles === true
  const staticUrl = mapData?.azureData?.static_url
  const hasValidTileConfig = !!(mapData?.azureData?.tile_config?.tile_url)

  if (!useTilesFlag && staticUrl && typeof staticUrl === 'string' && staticUrl.startsWith('http')) {
    console.log('📸 AzureMapView: Rendering static image (use_tiles is not true)')
    console.log('📸 Static URL:', staticUrl)
    console.log('📸 Response type:', mapData?.azureData?.type)
    
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
          onError={(e) => {
            console.error('❌ Static image failed to load:', staticUrl)
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
    )
  }

  useEffect(() => {
    if (!mapRef.current || !subscriptionKey) return

    const defaultBounds = {
      north: 49.0,
      south: 25.0,
      east: -66.0,
      west: -125.0
    }

    const bounds = mapData.bounds || defaultBounds
    const center = mapData.center || {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    }

    console.log('Initializing Azure Maps with:', { bounds, center, azureData: mapData.azureData })

    const map = new atlas.Map(mapRef.current, {
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

    mapInstanceRef.current = map

    map.events.add('ready', () => {
      console.log('🗺️ Azure Maps Ready')

      setTimeout(() => {
        console.log('📊 ====== FASTAPI DATA ANALYSIS ======')
        console.log('azureData keys:', mapData.azureData ? Object.keys(mapData.azureData) : 'NONE')
        console.log('azureData full object:', mapData.azureData)

        const useTiles = mapData.azureData?.use_tiles === true
        const tileConfig = mapData.azureData?.tile_config
        const overlayUrl = mapData.azureData?.overlay_url
        const staticUrl = mapData.azureData?.static_url
        const hasGeoJsonData = !!(mapData.azureData?.geojson?.features?.length > 0)
        const hasBounds = !!(mapData.azureData?.bounds || mapData.bounds)

        console.log('🎯 ENHANCED FASTAPI DATA ANALYSIS:', {
          useTiles: useTiles,
          useTilesType: typeof mapData.azureData?.use_tiles,
          useTilesValue: mapData.azureData?.use_tiles,
          tileConfigExists: !!tileConfig,
          tileConfig: tileConfig,
          overlayUrl: overlayUrl,
          staticUrl: staticUrl,
          hasGeoJsonData,
          hasBounds,
          responseKeys: mapData.azureData ? Object.keys(mapData.azureData) : []
        })

        if (tileConfig?.color_scale) {
          console.log('🎨 Colorbar data available:', {
            vmin: tileConfig.color_scale.vmin,
            vmax: tileConfig.color_scale.vmax,
            cmap: tileConfig.color_scale.cmap,
            variable: tileConfig.color_scale.variable,
            unit: tileConfig.color_scale.unit,
            colors_count: tileConfig.color_scale.colors?.length || 0,
            has_backend_colors: !!tileConfig.color_scale.colors
          })
        }

        const requestedBounds = mapData.azureData?.bounds || mapData.bounds || bounds

        function debugTileMath(tileConfig?: any) {
          console.log('🔬 ===== TILE MATH DEBUG =====')
          if (!tileConfig) {
            console.log('🔬 No tileConfig provided')
            return
          }
          const zTest = 6
          const corners = [
            { name: 'NW', lon: requestedBounds.west, lat: requestedBounds.north },
            { name: 'NE', lon: requestedBounds.east, lat: requestedBounds.north },
            { name: 'SW', lon: requestedBounds.west, lat: requestedBounds.south },
            { name: 'SE', lon: requestedBounds.east, lat: requestedBounds.south }
          ]

          function yLogSec(lat: number, zoom: number) {
            const latRad = lat * Math.PI / 180
            return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom))
          }
          function yAsinh(lat: number, zoom: number) {
            const latRad = lat * Math.PI / 180
            return Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * Math.pow(2, zoom))
          }
          function xLon(lon: number, zoom: number) {
            return Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
          }

          corners.forEach(c => {
            const x = xLon(c.lon, zTest)
            const y1 = yLogSec(c.lat, zTest)
            const y2 = yAsinh(c.lat, zTest)
            const yFlip1 = (Math.pow(2, zTest) - 1) - y1
            const yFlip2 = (Math.pow(2, zTest) - 1) - y2
            console.log(`🔬 Corner ${c.name}: lon=${c.lon}, lat=${c.lat}, z=${zTest} | x=${x}, y(log/sec)=${y1}, y(asinh)=${y2}, yFlip(log/sec)=${yFlip1}, yFlip(asinh)=${yFlip2}`)
          })

          const testX = xLon(requestedBounds.west, zTest)
          const testYLog = yLogSec(requestedBounds.north, zTest)
          const flippedY = (Math.pow(2, zTest) - 1) - testYLog
          const testNormalUrl = tileConfig.tile_url
            .replace('{z}', zTest.toString())
            .replace('{x}', testX.toString())
            .replace('{y}', testYLog.toString())
          const testFlippedUrl = tileConfig.tile_url
            .replace('{z}', zTest.toString())
            .replace('{x}', testX.toString())
            .replace('{y}', flippedY.toString())
          console.log('🔬 Testing tile URL (normal):', testNormalUrl)
          fetch(testNormalUrl, { method: 'HEAD' })
            .then(r => console.log('🔬 Normal HEAD status:', r.status))
            .catch(e => console.log('🔬 Normal HEAD error:', e.message))
          console.log('🔬 Testing tile URL (flipped y):', testFlippedUrl)
          fetch(testFlippedUrl, { method: 'HEAD' })
            .then(r => console.log('🔬 Flipped HEAD status:', r.status))
            .catch(e => console.log('🔬 Flipped HEAD error:', e.message))

          console.log('🔬 ===== END TILE MATH DEBUG =====')
        }

        function addBoundsDiagnosticRect(label = 'Requested Bounds', color = '#ff0000') {
          try {
            const ds = new (atlas as any).source.DataSource()
            map.sources.add(ds)
            const poly = new (atlas as any).data.Polygon([[
              [requestedBounds.west, requestedBounds.north],
              [requestedBounds.east, requestedBounds.north],
              [requestedBounds.east, requestedBounds.south],
              [requestedBounds.west, requestedBounds.south],
              [requestedBounds.west, requestedBounds.north]
            ]])
            ds.add(poly)
            const layer = new (atlas as any).layer.PolygonLayer
              ? new (atlas as any).layer.PolygonLayer(ds, undefined, {
                  fillOpacity: 0.05,
                  fillColor: color,
                  strokeColor: color,
                  strokeWidth: 2
                })
              : null
            if (layer) {
              map.layers.add(layer)
              console.log(`🔲 Added diagnostic rectangle: ${label}`)
            }
          } catch (e) {
            console.warn('⚠️ Could not add diagnostic rectangle:', (e as any)?.message)
          }
        }

        function summarizeTiles(tiles: any[]) {
          if (!tiles || tiles.length === 0) return
          const north = Math.max(...tiles.map(t => t.bounds.north))
          const south = Math.min(...tiles.map(t => t.bounds.south))
          const east = Math.max(...tiles.map(t => t.bounds.east))
          const west = Math.min(...tiles.map(t => t.bounds.west))
          console.log('📐 Tile union bounds:', { north, south, east, west })
          console.log('📐 Requested bounds:', requestedBounds)
          console.log('📐 Overshoot:', {
            north: (north - requestedBounds.north).toFixed(3),
            south: (requestedBounds.south - south).toFixed(3),
            east: (east - requestedBounds.east).toFixed(3),
            west: (requestedBounds.west - west).toFixed(3)
          })
        }

        function handleWeatherResponse(response: any) {
          console.log('🧩 handleWeatherResponse invoked')
          if (response.use_tiles && response.tile_config) {
            console.log('🗺️ Using tile-based rendering for large area')
            renderWithTiles(response.tile_config, response)
          } else if (response.overlay_url && response.bounds) {
            console.log('📸 Using PNG overlay for small area')
          }
          if (response.static_url) {
            console.log('💾 Static URL available for download:', response.static_url)
          }
        }

        function renderWithTiles(tileConfig: any, response: any) {
          console.log('🔧 renderWithTiles start')
          if (!tileConfig?.tile_url) {
            console.warn('⚠️ Missing tile_url in tileConfig')
            return
          }
          if ((atlas as any).source?.TileSource && (atlas as any).layer?.TileLayer) {
            try {
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
              debugTileMath(tileConfig)
              addBoundsDiagnosticRect()
              return
            } catch (e) {
              console.warn('⚠️ Native TileLayer failed, falling back:', (e as any)?.message)
            }
          }
          console.log('🔁 Falling back to manual ImageLayer grid')
          debugTileMath(tileConfig)
          addBoundsDiagnosticRect()
        }

        function addTileLayer(tileConfig: any) {
          console.log('🛠 addTileLayer invoked')
          if (!tileConfig?.tile_url) {
            console.warn('⚠️ tile_url missing in tileConfig')
            return
          }
        }

        function loadBackendTiles(tileList: any[]) {
          console.log('🎯 ===== LOADING BACKEND-SPECIFIED TILES ONLY =====')
          console.log('Tiles to load:', tileList)

          clearExistingWeatherTiles()

          if (!Array.isArray(tileList) || tileList.length === 0) {
            console.error('❌ Invalid or empty tile list from backend')
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

            console.log(`🔧 Loading backend tile ${idx + 1}/${tileList.length}: ${tile.url}`)

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
              console.log(`✅ Backend tile ${idx + 1}/${tileList.length} loaded: ${tile.z}/${tile.x}/${tile.y}`)

            } catch (e) {
              console.error(`❌ Failed to load backend tile ${idx}:`, (e as any)?.message)
              errorCount++
            }
          })

          console.log(`🎯 Backend tiles complete: ${successCount} success, ${errorCount} errors`)
        }

        function clearExistingWeatherTiles() {
          try {
            const layers = map.layers.getLayers()
            layers.forEach(layer => {
              const layerId = layer.getId()
              if (layerId && (layerId.includes('weather') || layerId.includes('tile'))) {
                map.layers.remove(layer)
                console.log('🧹 Removed existing weather layer:', layerId)
              }
            })
            delete (window as any).__weatherTileLayerAdded
          } catch (e) {
            console.warn('⚠️ Error clearing existing tiles:', (e as any)?.message)
          }
        }

        function calculateTilesInView(currentZoom?: number) {
          if (!tilebounds || !tileConfig?.tile_url) {
            console.log('⚠️ tilebounds or tileConfig missing - skip live tile calc')
            return
          }
          const cam = map.getCamera()
          const zoom = currentZoom ?? Math.floor(cam.zoom || 6)
          const b = cam.bounds
          if (!b || b.length !== 4) {
            console.log('⚠️ Camera bounds unavailable for tile calc')
            return
          }
          const clampedZoom = Math.max(tileConfig.min_zoom || 3, Math.min(tileConfig.max_zoom || 10, zoom))
          let tiles
          try {
            tiles = tilebounds.bboxToTile(b[0], b[1], b[2], b[3], clampedZoom)
          } catch (e) {
            console.warn('⚠️ bboxToTile failed:', (e as any)?.message)
            return
          }
          const results: any[] = []
          for (let x = tiles.minX; x <= tiles.maxX; x++) {
            for (let y = tiles.minY; y <= tiles.maxY; y++) {
              const tb = tilebounds.tile2bbox(x, y, clampedZoom)
              results.push({
                x, y, z: clampedZoom,
                bounds: { west: tb[0], south: tb[1], east: tb[2], north: tb[3] }
              })
            }
          }
          console.log(`🔍 Visible tiles (tilebounds) z=${clampedZoom}: count=${results.length}`)
          summarizeTiles(results)
          if (results[0]) {
            const testUrl = tileConfig.tile_url
              .replace('{z}', clampedZoom.toString())
              .replace('{x}', results[0].x.toString())
              .replace('{y}', results[0].y.toString())
            fetch(testUrl, { method: 'HEAD' })
              .then(r => console.log('🔍 HEAD test first visible tile:', testUrl, 'status=', r.status))
              .catch(e => console.log('🔍 HEAD test error:', e.message))
          }
        }

        ;(window as any).__azureTileDebug = {
          requestedBounds,
          tileConfig,
          debugTileMath,
          calculateTilesInView
        }
        console.log('🧪 Global debug object available at window.__azureTileDebug')

        handleWeatherResponse(mapData.azureData || {})

        if (useTiles && tileConfig && tileConfig.tile_url) {
          console.log('🗺️ ====== USING TILE-BASED RENDERING ======')
          console.log('Tile URL template:', tileConfig.tile_url)

          console.log('🔍 ===== COMPREHENSIVE BACKEND DATA DEBUG =====')
          console.log('🔍 Full tileConfig object:', JSON.stringify(tileConfig, null, 2))
          console.log('🔍 Backend tile_list exists:', !!tileConfig.tile_list)
          console.log('🔍 Backend tile_list type:', typeof tileConfig.tile_list)
          console.log('🔍 Backend tile_list is array:', Array.isArray(tileConfig.tile_list))
          console.log('🔍 Backend tile_list length:', tileConfig.tile_list?.length)
          console.log('🔍 Backend tile_list content:', tileConfig.tile_list)
          console.log('🔍 Backend region_bounds:', tileConfig.region_bounds)
          console.log('🔍 Backend tile_count:', tileConfig.tile_count)
          console.log('🔍 Backend color_scale:', tileConfig.color_scale)
          console.log('🔍 Backend min_zoom:', tileConfig.min_zoom)
          console.log('🔍 Backend max_zoom:', tileConfig.max_zoom)
          console.log('🔍 Backend tile_size:', tileConfig.tile_size)
          console.log('🔍 Backend variable:', tileConfig.variable)
          console.log('🔍 Backend date:', tileConfig.date)
          
          if (tileConfig.tile_list && Array.isArray(tileConfig.tile_list) && tileConfig.tile_list.length > 0) {
            console.log('🔍 First tile details:', JSON.stringify(tileConfig.tile_list[0], null, 2))
            console.log('🔍 First tile URL:', tileConfig.tile_list[0]?.url)
            console.log('🔍 First tile bounds:', tileConfig.tile_list[0]?.bounds)
            console.log('🔍 First tile coordinates:', tileConfig.tile_list[0]?.x, tileConfig.tile_list[0]?.y, tileConfig.tile_list[0]?.z)
          }
          console.log('🔍 ===== END COMPREHENSIVE DEBUG =====')

          console.log('🔍 TILE_LIST DEBUG:', {
            tile_list_exists: !!tileConfig.tile_list,
            is_array: Array.isArray(tileConfig.tile_list),
            length: tileConfig.tile_list?.length,
            first_tile: tileConfig.tile_list?.[0]
          })
          
          if (tileConfig.tile_list && Array.isArray(tileConfig.tile_list)) {
            console.log(`🎯 ===== USING BACKEND TILE LIST =====`)
            console.log(`🎯 Loading ${tileConfig.tile_list.length} specific tiles from backend`)
            console.log(`🎯 Backend says we should have ${tileConfig.tile_count} tiles`)
            console.log(`🎯 Backend region bounds:`, tileConfig.region_bounds)
            loadBackendTiles(tileConfig.tile_list)
          } else {
            console.log('🔧 ===== FALLBACK TO MANUAL TILE GENERATION =====')
            console.log('🔧 Reason: No tile_list from backend')
            console.log('🔧 Will attempt to generate tiles manually')
            addTileLayer(tileConfig)
          }

          if (hasGeoJsonData) {
            console.log('🎯 Adding hover interactions for tile + GeoJSON')
            const variable = tileConfig.variable || 'temperature'
            const unit = mapData.azureData.geojson.features[0]?.properties?.unit ?? ''

            const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
              value: feature.properties.value,
              variable: feature.properties.variable || variable,
              unit: feature.properties.unit ?? unit
            }))

            processTemperatureData(temperatureData, variable, unit)
          }
        }
        else if ((overlayUrl || staticUrl) && hasBounds) {
          console.log('📸 ====== FALLING BACK TO PNG OVERLAY ======')
          console.log('Reason: useTiles =', useTiles, ', tileConfig =', !!tileConfig)
          addPngOverlay()

          if (hasGeoJsonData) {
            console.log('🎯 Adding hover interactions for PNG + GeoJSON')
            const variable = mapData.azureData?.geojson?.features?.[0]?.properties?.variable || 'temperature'
            const unit = mapData.azureData?.geojson?.features?.[0]?.properties?.unit ?? ''

            const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
              value: feature.properties.value,
              variable: feature.properties.variable,
              unit: feature.properties.unit
            }))

            processTemperatureData(temperatureData, variable, unit)
          }
        } else {
          console.log('⚠️ No valid rendering method available')
          console.log('Debug info:', {
            useTiles,
            hasTileConfig: !!tileConfig,
            hasOverlay: !!overlayUrl,
            hasStatic: !!staticUrl,
            hasBounds
          })
        }

        function addPngOverlay() {
          console.log('📸 ====== PNG OVERLAY FUNCTION ======')
          
          const overlayUrl = mapData.azureData?.overlay_url
          const staticUrl = mapData.azureData?.static_url
          
          console.log('📸 URL Analysis:')
          console.log('  - overlay_url:', overlayUrl)
          console.log('  - static_url:', staticUrl)
          
          const imageUrl = overlayUrl || staticUrl
          
          if (!imageUrl || !imageUrl.startsWith('http')) {
            console.log('❌ No valid image URL for PNG overlay')
            return
          }
          
          console.log('📸 Using URL:', imageUrl.substring(0, 80) + '...')
          
          let overlayBounds
          if (mapData.azureData?.bounds) {
            overlayBounds = mapData.azureData.bounds
            console.log('✅ Using backend bounds:', overlayBounds)
          } else if (mapData.bounds) {
            overlayBounds = mapData.bounds
            console.log('⚠️ Using mapData bounds:', overlayBounds)
          } else {
            overlayBounds = bounds
            console.log('⚠️ Using default bounds:', overlayBounds)
          }
          
          if (!overlayBounds || 
              !isFinite(overlayBounds.north) || 
              !isFinite(overlayBounds.south) ||
              !isFinite(overlayBounds.east) || 
              !isFinite(overlayBounds.west)) {
            console.error('❌ Invalid overlay bounds:', overlayBounds)
            return
          }
          
          if (overlayBounds.north <= overlayBounds.south) {
            console.error('❌ North must be > South:', {
              north: overlayBounds.north,
              south: overlayBounds.south
            })
            return
          }
          
          if (overlayBounds.west >= overlayBounds.east) {
            console.error('❌ West must be < East:', {
              west: overlayBounds.west,
              east: overlayBounds.east
            })
            return
          }
          
          console.log('✅ Bounds validated:', overlayBounds)
          
          const coordinates: [number, number][] = [
            [overlayBounds.west, overlayBounds.north],
            [overlayBounds.east, overlayBounds.north],
            [overlayBounds.east, overlayBounds.south],
            [overlayBounds.west, overlayBounds.south]
          ]
          
          console.log('📍 PNG overlay coordinates:')
          console.log('  NW:', coordinates[0])
          console.log('  NE:', coordinates[1])
          console.log('  SE:', coordinates[2])
          console.log('  SW:', coordinates[3])
          
          const isTransparentOverlay = overlayUrl || imageUrl.includes('overlay') || imageUrl.includes('transparent')
          const opacity = isTransparentOverlay ? 0.8 : 0.6
          
          const imageLayer = new atlas.layer.ImageLayer({
            url: imageUrl,
            coordinates: coordinates,
            opacity: opacity,
            visible: true
          })
          
          console.log(`✅ PNG ImageLayer created with opacity: ${opacity}`)
          
          try {
            map.layers.add(imageLayer, 'labels')
            console.log('✅ PNG overlay added below labels')
            
            map.setCamera({
              bounds: [overlayBounds.west, overlayBounds.south, overlayBounds.east, overlayBounds.north],
              padding: 40
            })
            console.log('✅ Camera set to overlay bounds')
            
          } catch (error) {
            console.error('❌ Failed to add PNG overlay below labels:', error)
            try {
              map.layers.add(imageLayer)
              console.log('✅ PNG overlay added to top')
            } catch (error2) {
              console.error('❌ Failed to add PNG overlay at all:', error2)
            }
          }
        }

        function processTemperatureData(temperatureData: any[], variable: string, unit: string) {
          console.log('🎯 Processing hover interactions for', temperatureData.length, 'data points')
          
          const validData = temperatureData.filter((point: any) => {
            const lat = point.latitude
            const lng = point.longitude  
            const val = point.value
            
            const isValid = (
              point && 
              typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
              typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180 &&
              typeof val === 'number' && isFinite(val)
            )
            
            if (!isValid) {
              console.warn('❌ Invalid hover point filtered:', { 
                latitude: lat, 
                longitude: lng, 
                value: val,
                types: { 
                  lat: typeof lat, 
                  lng: typeof lng, 
                  val: typeof val 
                }
              })
            }
            
            return isValid
          })
          
          console.log(`✅ Valid hover data: ${validData.length} / ${temperatureData.length}`)
          
          if (validData.length === 0) {
            console.error('❌ No valid data for hover interactions')
            return
          }
          
          let avgDistance = 0.1
          if (validData.length > 1) {
            const sampleSize = Math.min(10, validData.length - 1)
            let totalDistance = 0
            
            for (let i = 0; i < sampleSize; i++) {
              const p1 = validData[i]
              const p2 = validData[i + 1]
              const dist = Math.sqrt(
                Math.pow(p2.longitude - p1.longitude, 2) + 
                Math.pow(p2.latitude - p1.latitude, 2)
              )
              totalDistance += dist
            }
            
            avgDistance = totalDistance / sampleSize
          }
          
          const adaptiveRadius = Math.max(0.05, Math.min(0.5, avgDistance * 2))
          console.log('🎯 Hover detection radius:', adaptiveRadius.toFixed(4), '(≈', (adaptiveRadius * 111).toFixed(1), 'km)')

          const popup = new atlas.Popup({
            pixelOffset: [0, -18],
            closeButton: false
          })
          
          let hoverTimeout: NodeJS.Timeout | null = null
          
          map.events.add('mousemove', (e: any) => {
            if (hoverTimeout) {
              clearTimeout(hoverTimeout)
            }
            
            hoverTimeout = setTimeout(() => {
              const hoverPosition = e.position
              
              if (!hoverPosition || !Array.isArray(hoverPosition) || hoverPosition.length !== 2) {
                return
              }
              
              let nearestPoint = null
              let minDistance = Infinity
              
              validData.forEach((point: any) => {
                const distance = Math.sqrt(
                  Math.pow(point.longitude - hoverPosition[0], 2) + 
                  Math.pow(point.latitude - hoverPosition[1], 2)
                )
                
                if (distance < minDistance) {
                  minDistance = distance
                  nearestPoint = point
                }
              })
              
              if (nearestPoint && minDistance < adaptiveRadius) {
                const displayValue = nearestPoint.value.toFixed(2)
                const variableDisplay = getVariableDisplayName(variable)
                
                const popupContent = `
                  <div style="padding: 8px; min-width: 140px; font-size: 12px; font-family: system-ui;">
                    <div style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${variableDisplay}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #dc2626;">
                      ${displayValue} ${unit}
                    </div>
                    <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">
                      ${nearestPoint.latitude.toFixed(3)}°, ${nearestPoint.longitude.toFixed(3)}°
                    </div>
                  </div>
                `
                
                popup.setOptions({
                  content: popupContent,
                  position: [nearestPoint.longitude, nearestPoint.latitude]
                })
                popup.open(map)
              } else {
                popup.close()
              }
            }, 100)
          })
          
          map.events.add('mouseleave', () => {
            if (hoverTimeout) {
              clearTimeout(hoverTimeout)
            }
            popup.close()
          })
          
          map.getCanvasContainer().style.cursor = 'crosshair'
          console.log('✅ Hover interactions ready for', validData.length, 'points')
        }

        function getVariableDisplayName(variable: string): string {
          const nameMap: { [key: string]: string } = {
            'Tair': 'Air Temperature',
            'temperature': 'Temperature',
            'temp': 'Temperature',
            'Rainf': 'Precipitation',
            'precipitation': 'Precipitation'
          }
          return nameMap[variable] || variable.replace(/_/g, ' ')
        }

      }, 1500)

      map.setCamera({
        bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
        padding: 40
      })
    })

    map.events.add('error', (error: any) => {
      console.error('❌ Azure Map error:', error)
      setMapError('Map failed to load')
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.dispose()
        mapInstanceRef.current = null
      }
    }
  }, [mapData, subscriptionKey, clientId])

  // ✅ STRICT COLORBAR VALIDATION
  const hasValidColorScale = (
    mapData?.azureData?.tile_config?.color_scale &&
    typeof mapData.azureData.tile_config.color_scale.vmin === 'number' &&
    typeof mapData.azureData.tile_config.color_scale.vmax === 'number' &&
    !isNaN(mapData.azureData.tile_config.color_scale.vmin) &&
    !isNaN(mapData.azureData.tile_config.color_scale.vmax) &&
    isFinite(mapData.azureData.tile_config.color_scale.vmin) &&
    isFinite(mapData.azureData.tile_config.color_scale.vmax) &&
    mapData.azureData.tile_config.color_scale.vmax > mapData.azureData.tile_config.color_scale.vmin
  )

  const showColorbar = (
    hasValidColorScale &&
    mapData?.azureData?.use_tiles === true &&
    typeof mapData?.azureData?.tile_config?.tile_url === 'string' &&
    mapData.azureData.tile_config.tile_url.length > 10
  )

  console.log('🎨 Colorbar decision:', {
    hasValidColorScale,
    use_tiles: mapData?.azureData?.use_tiles,
    has_tile_url: !!mapData?.azureData?.tile_config?.tile_url,
    SHOW_COLORBAR: showColorbar
  })

  if (mapError) {
    return (
      <div className="flex items-center justify-center bg-gray-900 text-red-400" style={{ height }}>
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div>{mapError}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full" style={{ height }}>
      <div 
        ref={mapRef} 
        className="rounded-md border"
        style={{ 
          height,
          width: showColorbar ? 'calc(100% - 140px)' : '100%'
        }}
      />
      
      {showColorbar && hasValidColorScale && (
        <div style={{ width: '140px', height }}>
          <ColorbarLegend
            vmin={mapData.azureData.tile_config.color_scale.vmin}
            vmax={mapData.azureData.tile_config.color_scale.vmax}
            cmap={mapData.azureData.tile_config.color_scale.cmap || 'viridis'}
            variable={mapData.azureData.tile_config.color_scale.variable || 'value'}
            unit={mapData.azureData.tile_config.color_scale.unit || ''}
            colors={mapData.azureData.tile_config.color_scale.colors}
          />
        </div>
      )}
    </div>
  )
}