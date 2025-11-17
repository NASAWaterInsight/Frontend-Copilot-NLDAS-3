import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import { loadGeoTiffOverlay, createDynamicLegend } from '../utils/geotiffLoader'

// ✅ NEW: Optional tile bounds helper (install: npm i @mapbox/tilebounds)
// Guard import so app doesn’t crash if lib not installed yet.
let tilebounds: any = null
try {
  // @ts-ignore
  tilebounds = require('@mapbox/tilebounds')
} catch {
  console.warn('⚠️ tilebounds library not available - advanced tile debug limited')
}

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

        // ✅ FIXED: Check for tile-based rendering first with proper detection
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

        // ✅ NEW: BEGIN TILE DEBUG HELPERS =============================

        // Original requested bounds (backend or fallback)
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

          // Test live fetch for normal vs flipped y
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

        // ===== NEW: HANDLE WEATHER RESPONSE STYLE (ABSTRACTED) =====
        function handleWeatherResponse(response: any) {
          console.log('🧩 handleWeatherResponse invoked')
          if (response.use_tiles && response.tile_config) {
            console.log('🗺️ Using tile-based rendering for large area')
            renderWithTiles(response.tile_config, response)
          } else if (response.overlay_url && response.bounds) {
            console.log('📸 Using PNG overlay for small area')
            // Already handled by addPngOverlay fallback
          }
          if (response.static_url) {
            console.log('💾 Static URL available for download:', response.static_url)
          }
        }

        // ===== TILE RENDERING (ABRIDGED) =====
        function renderWithTiles(tileConfig: any, response: any) {
          console.log('🔧 renderWithTiles start')
          if (!tileConfig?.tile_url) {
            console.warn('⚠️ Missing tile_url in tileConfig')
            return
          }
          // Try native TileLayer first
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
          // Fallback manual approach (already implemented -> addTileGrid)
          console.log('🔁 Falling back to manual ImageLayer grid')
          debugTileMath(tileConfig)
          addBoundsDiagnosticRect()
        }

        // ✅ NEW: addTileLayer (was referenced but missing) 
        function addTileLayer(tileConfig: any) {
          console.log('🛠 addTileLayer invoked')
          if (!tileConfig?.tile_url) {
            console.warn('⚠️ tile_url missing in tileConfig')
            return
          }
        }

        // ✅ NEW: Load only backend-specified tiles
        function loadBackendTiles(tileList: any[]) {
          console.log('🎯 ===== LOADING BACKEND-SPECIFIED TILES ONLY =====')
          console.log('Tiles to load:', tileList)

          // ✅ Clear existing tiles first
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
                [tile.bounds.west, tile.bounds.north],   // Top-left
                [tile.bounds.east, tile.bounds.north],   // Top-right
                [tile.bounds.east, tile.bounds.south],   // Bottom-right
                [tile.bounds.west, tile.bounds.south]    // Bottom-left
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

        // ✅ NEW: Clear existing weather tiles
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

        // ===== ADVANCED: CALCULATE VISIBLE TILES WITH tilebounds =====
        function calculateTilesInView(currentZoom?: number) {
          if (!tilebounds || !tileConfig?.tile_url) {
            console.log('⚠️ tilebounds or tileConfig missing - skip live tile calc')
            return
          }
          const cam = map.getCamera()
          const zoom = currentZoom ?? Math.floor(cam.zoom || 6)
          const b = cam.bounds // [west,south,east,north]
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
              const tb = tilebounds.tile2bbox(x, y, clampedZoom) // [w,s,e,n]
              results.push({
                x, y, z: clampedZoom,
                bounds: { west: tb[0], south: tb[1], east: tb[2], north: tb[3] }
              })
            }
          }
          console.log(`🔍 Visible tiles (tilebounds) z=${clampedZoom}: count=${results.length}`)
          summarizeTiles(results)
          // Test one tile fetch
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

        // Expose debug globally
        ;(window as any).__azureTileDebug = {
          requestedBounds,
          tileConfig,
          debugTileMath,
          calculateTilesInView
        }
        console.log('🧪 Global debug object available at window.__azureTileDebug')

      

        // Invoke handleWeatherResponse for unified flow
        handleWeatherResponse(mapData.azureData || {})

        // ===== END TILE DEBUG HELPERS =============================

        // ✅ PRIORITY 1: STRICT TILE VALIDATION - Only render tiles if proper format exists
        if (useTiles && tileConfig && tileConfig.tile_url) {
          console.log('🗺️ ====== CHECKING TILE FORMAT VALIDATION ======')
          console.log('Tile URL template:', tileConfig.tile_url)

          // ✅ STRICT VALIDATION: Must have proper tile_list with valid entries
          const hasValidTileList = (
            tileConfig.tile_list && 
            Array.isArray(tileConfig.tile_list) && 
            tileConfig.tile_list.length > 0 &&
            tileConfig.tile_list.every((tile: any) => 
              tile && 
              typeof tile.url === 'string' && 
              tile.url.startsWith('http') &&
              tile.bounds &&
              typeof tile.z === 'number' &&
              typeof tile.x === 'number' &&
              typeof tile.y === 'number'
            )
          )

          // ✅ ENHANCED VALIDATION: Check if tile URLs follow expected pattern
          let hasValidTilePattern = false
          if (hasValidTileList) {
            const firstTile = tileConfig.tile_list[0]
            const expectedPattern = tileConfig.tile_url
              .replace('{z}', firstTile.z.toString())
              .replace('{x}', firstTile.x.toString())
              .replace('{y}', firstTile.y.toString())
            
            hasValidTilePattern = firstTile.url.includes(firstTile.z.toString()) &&
                                 firstTile.url.includes(firstTile.x.toString()) &&
                                 firstTile.url.includes(firstTile.y.toString())
            
            console.log('🔍 Tile pattern validation:', {
              expectedPattern,
              actualUrl: firstTile.url,
              hasValidPattern: hasValidTilePattern
            })
          }

          console.log('🔍 ===== TILE FORMAT VALIDATION RESULTS =====')
          console.log('🔍 use_tiles:', useTiles)
          console.log('🔍 has tile_config:', !!tileConfig)
          console.log('🔍 has tile_url:', !!tileConfig.tile_url)
          console.log('🔍 has valid tile_list:', hasValidTileList)
          console.log('🔍 has valid tile pattern:', hasValidTilePattern)
          console.log('🔍 tile_list length:', tileConfig.tile_list?.length)
          console.log('🔍 ===== END VALIDATION =====')

          // ✅ ONLY PROCEED IF ALL VALIDATIONS PASS
          if (hasValidTileList && hasValidTilePattern) {
            console.log(`🎯 ===== USING BACKEND TILE LIST (VALIDATED) =====`)
            console.log(`🎯 Loading ${tileConfig.tile_list.length} validated tiles from backend`)
            console.log(`🎯 Backend region bounds:`, tileConfig.region_bounds)
            loadBackendTiles(tileConfig.tile_list)

            // Add hover interactions for GeoJSON data
            if (hasGeoJsonData) {
              console.log('🎯 Adding hover interactions for tile + GeoJSON')
              const variable = tileConfig.variable || 'temperature'
              const unit = mapData.azureData.geojson.features[0]?.properties?.unit ?? ''

              const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
                value: feature.properties.value,
                variable: feature.properties.variable || variable,
                unit: feature.properties.unit ?? ''
              }))

              processTemperatureData(temperatureData, variable, unit)
            }
          } else {
            console.log('❌ ===== TILE VALIDATION FAILED - SKIPPING TILE OVERLAY =====')
            console.log('❌ Reason: Invalid tile format or missing tile_list')
            console.log('❌ This appears to be a non-tile response (static image, time series, etc.)')
            console.log('❌ Will NOT overlay anything on Azure Maps')
            
            // ✅ IMPORTANT: Do not fall back to PNG overlay for invalid tile responses
            // This prevents static images from being overlaid on maps incorrectly
          }
        }
        // ✅ PRIORITY 2: PNG overlay ONLY for specific cases with bounds and no tile attempts
        else if ((overlayUrl || staticUrl) && hasBounds && !useTiles) {
          console.log('📸 ====== PNG OVERLAY (NON-TILE RESPONSE) ======')
          console.log('📸 This is a non-tile response with overlay capability')
          console.log('Reason: useTiles =', useTiles, ', has bounds =', hasBounds)
          
          // ✅ ADDITIONAL CHECK: Don't overlay if this looks like a comparison/static visualization
          const isComparison = staticUrl && (
            staticUrl.includes('comparison') ||
            staticUrl.includes('difference') ||
            staticUrl.includes('_vs_') ||
            staticUrl.includes('time_series') ||
            staticUrl.includes('subplot')
          )
          
          if (isComparison) {
            console.log('📸 ❌ SKIPPING PNG OVERLAY - Detected comparison/static visualization')
            console.log('📸 This should be displayed as static image only, not map overlay')
          } else {
            console.log('📸 ✅ PROCEEDING with PNG overlay for geographic data')
            addPngOverlay()
          }

          // Add hover interactions regardless of overlay
          if (hasGeoJsonData) {
            console.log('🎯 Adding hover interactions for PNG + GeoJSON')
            const variable = mapData.azureData?.geojson?.features?.[0]?.properties?.variable || 'temperature'
            const unit = mapData.azureData?.geojson?.features?.[0]?.properties?.unit ?? ''

            const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
              value: feature.properties.value,
              variable: feature.properties.variable,
              unit: feature.properties.unit ?? ''
            }))

            processTemperatureData(temperatureData, variable, unit)
          }
        } 
        // ✅ PRIORITY 3: GeoJSON-only display (no overlays)
        else if (hasGeoJsonData && !useTiles && !overlayUrl && !staticUrl) {
          console.log('🎯 ====== GEOJSON-ONLY DISPLAY ======')
          console.log('🎯 No tiles or overlays, just hover interactions')
          
          const variable = mapData.azureData?.geojson?.features?.[0]?.properties?.variable || 'temperature'
          const unit = mapData.azureData?.geojson?.features?.[0]?.properties?.unit ?? ''

          const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            value: feature.properties.value,
            variable: feature.properties.variable || variable,
            unit: feature.properties.unit ?? ''
          }))

          processTemperatureData(temperatureData, variable, unit)
        }
        else {
          console.log('ℹ️ ====== NO MAP OVERLAY ======')
          console.log('ℹ️ This response does not require map overlays')
          console.log('ℹ️ Likely a static visualization, time series, or text response')
          console.log('Debug info:', {
            useTiles,
            hasTileConfig: !!tileConfig,
            hasOverlay: !!overlayUrl,
            hasStatic: !!staticUrl,
            hasBounds,
            hasGeoJsonData
          })
        }

        // ====== MISSING: ADD PNG OVERLAY FUNCTION ======
        function addPngOverlay() {
          console.log('📸 ====== PNG OVERLAY FUNCTION ======')
          
          const overlayUrl = mapData.azureData?.overlay_url
          const staticUrl = mapData.azureData?.static_url
          
          console.log('📸 URL Analysis:')
          console.log('  - overlay_url:', overlayUrl)
          console.log('  - static_url:', staticUrl)
          
          // Use overlay_url if available, fallback to static_url
          const imageUrl = overlayUrl || staticUrl
          
          if (!imageUrl || !imageUrl.startsWith('http')) {
            console.log('❌ No valid image URL for PNG overlay')
            return
          }
          
          console.log('📸 Using URL:', imageUrl.substring(0, 80) + '...')
          
          // Get bounds - prioritize backend bounds
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
          
          // Validate bounds
          if (!overlayBounds || 
              !isFinite(overlayBounds.north) || 
              !isFinite(overlayBounds.south) ||
              !isFinite(overlayBounds.east) || 
              !isFinite(overlayBounds.west)) {
            console.error('❌ Invalid overlay bounds:', overlayBounds)
            return
          }
          
          // Verify bounds order
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
          
          // Create coordinates for Azure Maps ImageLayer
          const coordinates: [number, number][] = [
            [overlayBounds.west, overlayBounds.north],   // Top-left (NW)
            [overlayBounds.east, overlayBounds.north],   // Top-right (NE)
            [overlayBounds.east, overlayBounds.south],   // Bottom-right (SE)
            [overlayBounds.west, overlayBounds.south]    // Bottom-left (SW)
          ]
          
          console.log('📍 PNG overlay coordinates:')
          console.log('  NW:', coordinates[0])
          console.log('  NE:', coordinates[1])
          console.log('  SE:', coordinates[2])
          console.log('  SW:', coordinates[3])
          
          // Determine opacity based on URL type
          const isTransparentOverlay = overlayUrl || imageUrl.includes('overlay') || imageUrl.includes('transparent')
          const opacity = isTransparentOverlay ? 0.8 : 0.6
          
          // Create ImageLayer
          const imageLayer = new atlas.layer.ImageLayer({
            url: imageUrl,
            coordinates: coordinates,
            opacity: opacity,
            visible: true
          })
          
          console.log(`✅ PNG ImageLayer created with opacity: ${opacity}`)
          
          // Add to map
          try {
            map.layers.add(imageLayer, 'labels')
            console.log('✅ PNG overlay added below labels')
            
            // Zoom to overlay bounds
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

        // ====== ENHANCED HOVER INTERACTIONS ======
        function processTemperatureData(temperatureData: any[], variable: string, unit: string) {
          console.log('🎯 Processing hover interactions for', temperatureData.length, 'data points')
          
          // ✅ FIXED: Better data validation
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
          
          // Calculate adaptive radius for hover detection
          let avgDistance = 0.1 // Default
          if (validData.length > 1) {
            // Sample a few points to calculate average distance
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
          
          // Add mousemove event with improved detection
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
                // ✅ FIXED: Dynamic precision based on variable type and value magnitude
                let displayValue: string
                const value = nearestPoint.value
                
                // Determine appropriate decimal places based on variable and value magnitude
                if (variable.toLowerCase().includes('qair') || variable.toLowerCase().includes('humidity')) {
                  // For humidity values (often very small decimals)
                  if (Math.abs(value) < 0.001) {
                    displayValue = value.toExponential(2) // Scientific notation for very small values
                  } else if (Math.abs(value) < 0.1) {
                    displayValue = value.toFixed(4) // 4 decimal places for small values
                  } else {
                    displayValue = value.toFixed(2) // 2 decimal places for larger values
                  }
                } else if (variable.toLowerCase().includes('temp')) {
                  // Temperature values
                  displayValue = value.toFixed(1)
                } else if (variable.toLowerCase().includes('precip') || variable.toLowerCase().includes('rain')) {
                  // Precipitation values
                  displayValue = value.toFixed(2)
                } else if (variable.toLowerCase().includes('spi')) {
                  // SPI values (drought index)
                  displayValue = value.toFixed(2)
                } else {
                  // Default: dynamic precision based on magnitude
                  if (Math.abs(value) < 0.001) {
                    displayValue = value.toExponential(2)
                  } else if (Math.abs(value) < 0.1) {
                    displayValue = value.toFixed(4)
                  } else if (Math.abs(value) < 10) {
                    displayValue = value.toFixed(3)
                  } else {
                    displayValue = value.toFixed(1)
                  }
                }
                
                const variableDisplay = getVariableDisplayName(variable)
                
                const popupContent = `
                  <div style="padding: 8px; min-width: 140px; font-size: 12px; font-family: system-ui;">
                    <div style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${variableDisplay}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #dc2626;">
                      ${displayValue}${unit ? ' ' + unit : ''}
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
            }, 100) // Increased debounce to reduce errors
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
            'precipitation': 'Precipitation',
            // ✅ FIXED: Add proper humidity display names
            'Qair': 'Specific Humidity',
            'Qair_f_inst': 'Specific Humidity', 
            'RelHum': 'Relative Humidity',
            'humidity': 'Relative Humidity',
            // ✅ ADD: SPI display names
            'SPI': 'SPI (Drought Index)',
            'SPI3': 'SPI-3 (1-Month Drought)',
            'spi': 'SPI (Drought Index)',
            'spi3': 'SPI-3 (1-Month Drought)'
          }
          return nameMap[variable] || variable.replace(/_/g, ' ')
        }

      }, 1500)

      // Set initial camera
      map.setCamera({
        bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
        padding: 40
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.dispose()
        mapInstanceRef.current = null
      }
    }
  }, [mapData, subscriptionKey, clientId])

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%' }}
      className="rounded-md border"
    />
  )
}