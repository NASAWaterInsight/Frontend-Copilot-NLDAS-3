import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import { loadGeoTiffOverlay, createDynamicLegend } from '../utils/geotiffLoader'

// ✅ REMOVED: @mapbox/tilebounds import to fix build error
// Instead using simple tile calculation functions below

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

// ✅ Simple tile calculation functions (replaces @mapbox/tilebounds)
function lonLatToTile(lon: number, lat: number, zoom: number) {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
  return { x, y, z: zoom }
}

function tileToBounds(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const west = x / n * 360 - 180
  const east = (x + 1) / n * 360 - 180
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI
  return { north, south, east, west }
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

    // ✅ CRITICAL FIX: Validate bounds before using them
    let bounds = mapData.bounds || defaultBounds
    
    // Validate bounds values
    if (!bounds || 
        !isFinite(bounds.north) || !isFinite(bounds.south) || 
        !isFinite(bounds.east) || !isFinite(bounds.west) ||
        bounds.north <= bounds.south || bounds.east <= bounds.west) {
      
      console.warn('❌ Invalid bounds detected, using default:', bounds)
      bounds = defaultBounds
    }

    // ✅ CRITICAL FIX: Validate center coordinates
    let center = mapData.center
    
    if (!center || !isFinite(center.lat) || !isFinite(center.lng)) {
      // Calculate center from valid bounds
      center = {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2
      }
      console.warn('❌ Invalid center detected, calculated from bounds:', center)
    }

    // ✅ FINAL VALIDATION: Ensure center coordinates are valid
    if (!isFinite(center.lat) || !isFinite(center.lng)) {
      console.error('❌ Center coordinates are still invalid, using default US center')
      center = { lat: 39.5, lng: -98.35 } // Geographic center of US
    }

    console.log('✅ Validated Azure Maps initialization:', { 
      bounds, 
      center, 
      azureData: mapData.azureData,
      originalBounds: mapData.bounds,
      originalCenter: mapData.center
    })

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
          overlayUrl: overlayUrl,
          staticUrl: staticUrl,
          hasGeoJsonData,
          hasBounds,
          responseKeys: mapData.azureData ? Object.keys(mapData.azureData) : []
        })

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

          corners.forEach(c => {
            const tile = lonLatToTile(c.lon, c.lat, zTest)
            console.log(`🔬 Corner ${c.name}: lon=${c.lon}, lat=${c.lat} -> tile x=${tile.x}, y=${tile.y}, z=${tile.z}`)
          })

          // Test live fetch for tile availability
          const testTile = lonLatToTile(requestedBounds.west, requestedBounds.north, zTest)
          const testUrl = tileConfig.tile_url
            .replace('{z}', zTest.toString())
            .replace('{x}', testTile.x.toString())
            .replace('{y}', testTile.y.toString())
          
          console.log('🔬 Testing tile URL:', testUrl)
          fetch(testUrl, { method: 'HEAD' })
            .then(r => console.log('🔬 HEAD status:', r.status))
            .catch(e => console.log('🔬 HEAD error:', e.message))

          console.log('🔬 ===== END TILE MATH DEBUG =====')
        }

        // ✅ SIMPLIFIED: Calculate visible tiles without external library
        function calculateTilesInView(currentZoom?: number) {
          if (!tileConfig?.tile_url) {
            console.log('⚠️ tileConfig missing - skip tile calc')
            return
          }
          
          const cam = map.getCamera()
          const zoom = currentZoom ?? Math.floor(cam.zoom || 6)
          const clampedZoom = Math.max(tileConfig.min_zoom || 3, Math.min(tileConfig.max_zoom || 10, zoom))
          
          // Calculate tiles for current bounds
          const nwTile = lonLatToTile(requestedBounds.west, requestedBounds.north, clampedZoom)
          const seTile = lonLatToTile(requestedBounds.east, requestedBounds.south, clampedZoom)
          
          const results: any[] = []
          for (let x = nwTile.x; x <= seTile.x; x++) {
            for (let y = nwTile.y; y <= seTile.y; y++) {
              const bounds = tileToBounds(x, y, clampedZoom)
              results.push({
                x, y, z: clampedZoom,
                bounds: bounds
              })
            }
          }
          
          console.log(`🔍 Calculated tiles z=${clampedZoom}: count=${results.length}`)
          
          // Test one tile fetch
          if (results[0]) {
            const testUrl = tileConfig.tile_url
              .replace('{z}', clampedZoom.toString())
              .replace('{x}', results[0].x.toString())
              .replace('{y}', results[0].y.toString())
            fetch(testUrl, { method: 'HEAD' })
              .then(r => console.log('🔍 HEAD test tile:', testUrl, 'status=', r.status))
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

        // ====== MISSING FUNCTIONS: Add the missing helper functions
        function handleWeatherResponse(response: any) {
          console.log('🧩 handleWeatherResponse invoked')
          if (response.use_tiles && response.tile_config) {
            console.log('🗺️ Using tile-based rendering for large area')
            renderWithTiles(response.tile_config, response)
          } else if (response.overlay_url && response.bounds) {
            console.log('📸 Using PNG overlay for small area')
            addPngOverlay()
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
          
          debugTileMath(tileConfig)
          
          // Check if backend provided specific tile list
          if (tileConfig.tile_list && Array.isArray(tileConfig.tile_list)) {
            console.log(`🎯 Loading ${tileConfig.tile_list.length} specific tiles from backend`)
            loadBackendTiles(tileConfig.tile_list)
          } else {
            console.log('🔧 No tile_list from backend, skipping tile rendering')
          }
        }

        function loadBackendTiles(tileList: any[]) {
          console.log('🎯 ===== LOADING BACKEND-SPECIFIED TILES ONLY =====')
          console.log('Tiles to load:', tileList)

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
              // ✅ CRITICAL FIX: Convert all values to numbers explicitly
              const tileBounds = tile.bounds
              if (!tileBounds) {
                console.error(`❌ No bounds for tile ${idx}`)
                errorCount++
                return
              }

              // ✅ FORCE NUMERIC CONVERSION
              const north = Number(tileBounds.north)
              const south = Number(tileBounds.south)
              const east = Number(tileBounds.east)
              const west = Number(tileBounds.west)

              // ✅ VALIDATE after conversion
              if (!isFinite(north) || !isFinite(south) || !isFinite(east) || !isFinite(west)) {
                console.error(`❌ Invalid numeric bounds for tile ${idx}:`, {
                  original: tileBounds,
                  converted: { north, south, east, west }
                })
                errorCount++
                return
              }

              console.log(`🔍 Tile ${idx} bounds converted:`, { north, south, east, west })

              // ✅ ENSURE COORDINATES ARE NUMBERS
              const coordinates: [number, number][] = [
                [west, north],   // Top-left
                [east, north],   // Top-right
                [east, south],   // Bottom-right
                [west, south]    // Bottom-left
              ]

              console.log(`🔍 Tile ${idx} coordinates:`, coordinates)

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
              console.error(`❌ Tile data:`, tile)
              errorCount++
            }
          })

          console.log(`🎯 Backend tiles complete: ${successCount} success, ${errorCount} errors`)
        }

        // Invoke handleWeatherResponse for unified flow
        handleWeatherResponse(mapData.azureData || {})

      }, 1500)

      // ✅ SAFE CAMERA SETTING: Set initial camera with validated bounds
      try {
        map.setCamera({
          bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
          padding: 40
        })
        console.log('✅ Camera set successfully to bounds:', bounds)
      } catch (cameraError) {
        console.error('❌ Failed to set camera bounds, using center instead:', cameraError)
        map.setCamera({
          center: [center.lng, center.lat],
          zoom: mapData.zoom || 6
        })
      }
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