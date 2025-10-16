import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'
import { loadGeoTiffOverlay, createDynamicLegend } from '../utils/geotiffLoader'

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
    azureData?: any // Backend JSON data for Azure Maps
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

    // Default bounds for continental US if not provided
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
    console.log('=== AZURE MAPS VIEW DEBUG ===')
    console.log('mapData.map_url:', mapData.map_url)
    console.log('mapData keys:', Object.keys(mapData))
    console.log('azureData keys:', mapData.azureData ? Object.keys(mapData.azureData) : 'none')
    console.log('azureData.overlay_url:', mapData.azureData?.overlay_url)
    console.log('=== END AZURE MAPS VIEW DEBUG ===')

    // Initialize the map
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
      console.log('Azure Maps ready, processing data...')
      
      setTimeout(() => {
        // Priority 1: Try GeoTIFF overlay (new preferred method)
        if (mapData.azureData?.raw_response?.geotiff_url) {
          console.log('🗺️ Loading GeoTIFF overlay:', mapData.azureData.raw_response.geotiff_url)
          
          // Extract variable info and colormap from backend
          const variable = mapData.azureData?.variable_info?.name || 
                          mapData.azureData?.raw_response?.variable || 
                          'unknown'
          const colormap = mapData.azureData?.raw_response?.colormap || 
                          mapData.azureData?.colormap
          const unit = mapData.azureData?.variable_info?.unit || 
                      mapData.azureData?.raw_response?.unit || ''
          
          console.log('🎨 Variable metadata:', { variable, colormap, unit })
          
          loadGeoTiffOverlay(
            mapData.azureData.raw_response.geotiff_url, 
            map, 
            variable,
            colormap
          ).then(layer => {
            if (layer) {
              console.log('✅ GeoTIFF overlay loaded successfully')
              
              // Add dynamic legend based on variable type and backend metadata
              const legend = createDynamicLegend(variable, colormap, unit)
              mapRef.current?.appendChild(legend)
            } else {
              console.log('⚠️ GeoTIFF failed, falling back to PNG overlay')
              addPngOverlay()
            }
          }).catch(error => {
            console.error('GeoTIFF error, using PNG fallback:', error)
            addPngOverlay()
          })
        } else {
          // Fallback to PNG overlay
          addPngOverlay()
        }
        
        function addPngOverlay() {
          // Priority 2: Standard PNG overlay (existing logic)
          if (mapData.azureData?.overlay_url && mapData.azureData.overlay_url.startsWith('http')) {
            console.log('📸 Adding PNG overlay:', mapData.azureData.overlay_url)
            
            let overlayBounds = bounds
            if (mapData.azureData.bounds) {
              overlayBounds = mapData.azureData.bounds
            }
            
            const imageLayer = new atlas.layer.ImageLayer({
              url: mapData.azureData.overlay_url,
              coordinates: [
                [overlayBounds.west, overlayBounds.north],
                [overlayBounds.east, overlayBounds.north],
                [overlayBounds.east, overlayBounds.south],
                [overlayBounds.west, overlayBounds.south]
              ],
              opacity: 0.7
            })
            
            try {
              map.layers.add(imageLayer, 'labels')
              console.log('✅ PNG overlay added successfully')
            } catch (error) {
              console.error('❌ Failed to add PNG overlay:', error)
              map.layers.add(imageLayer)
            }
          }
        }
        
        // Process temperature_data (preferred) or fallback to geojson
        if (mapData.azureData?.temperature_data && mapData.azureData.temperature_data.length > 0) {
          console.log('✅ Using backend temperature_data (unified format)')
          console.log('Temperature data count:', mapData.azureData.temperature_data.length)
          console.log('Sample temperature point:', mapData.azureData.temperature_data[0])
          
          processTemperatureData(mapData.azureData.temperature_data)
          
        } else if (mapData.azureData?.geojson?.features && mapData.azureData.geojson.features.length > 0) {
          console.log('🔄 Fallback: Converting geojson to temperature_data format')
          
          const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            value: feature.properties.value,
            originalValue: feature.properties.value,
            variable: feature.properties.variable,
            unit: feature.properties.unit,
            location: `${feature.geometry.coordinates[1].toFixed(2)}, ${feature.geometry.coordinates[0].toFixed(2)}`
          }))
          
          console.log('✅ Converted geojson to temperature_data:', temperatureData.length, 'points')
          processTemperatureData(temperatureData)
          
        } else {
          console.log('❌ No temperature_data or geojson available for interaction')
        }
        
        // Helper function to process temperature data
        function processTemperatureData(temperatureData: any[]) {
          console.log('Processing', temperatureData.length, 'temperature data points')
          console.log('🎯 Backend data spacing - adjust detection radius based on data density')
          
          // Calculate data density to adjust detection radius
          const avgDistance = temperatureData.length > 1 ? 
            Math.sqrt((temperatureData[1].longitude - temperatureData[0].longitude) ** 2 + 
                     (temperatureData[1].latitude - temperatureData[0].latitude) ** 2) : 0.1
          
          const adaptiveRadius = Math.max(0.1, Math.min(0.5, avgDistance * 2)) // Adaptive radius
          console.log('Adaptive detection radius:', adaptiveRadius, '(≈', (adaptiveRadius * 111).toFixed(1), 'km)')

          // Add interactive popup
          const popup = new atlas.Popup({
            pixelOffset: [0, -18],
            closeButton: false
          })
          
          let hoverTimeout: NodeJS.Timeout | null = null
          
          // HOVER handler to find nearest data point
          map.events.add('mousemove', (e: any) => {
            // Clear previous timeout
            if (hoverTimeout) {
              clearTimeout(hoverTimeout)
            }
            
            // Add small delay to avoid flickering
            hoverTimeout = setTimeout(() => {
              const hoverPosition = e.position // [longitude, latitude]
              
              // Find the nearest data point to the cursor
              let nearestPoint = null
              let minDistance = Infinity
              
              temperatureData.forEach((point: any) => {
                if (point.latitude != null && point.longitude != null) {
                  const distance = Math.sqrt(
                    Math.pow(point.longitude - hoverPosition[0], 2) + 
                    Math.pow(point.latitude - hoverPosition[1], 2)
                  )
                  
                  if (distance < minDistance) {
                    minDistance = distance
                    nearestPoint = point
                  }
                }
              })
              
              // Use adaptive detection area based on data density
              const maxDistance = adaptiveRadius
              if (nearestPoint && minDistance < maxDistance) {
                const variableInfo = mapData.azureData.variable_info || {
                  name: 'Unknown',
                  unit: '',
                  displayName: 'Data'
                }
                
                let displayValue = nearestPoint.originalValue?.toFixed(2) || nearestPoint.value?.toFixed(2) || 'N/A'
                let unitDisplay = variableInfo.unit || '°C'
                
                // Format based on variable type
                if (variableInfo.name === 'temperature') {
                  displayValue = nearestPoint.value?.toFixed(1) || 'N/A'
                  unitDisplay = '°C'
                }
                
                // Show the actual data point location, not cursor location
                const popupContent = `
                  <div style="padding: 8px; min-width: 140px; font-size: 12px;">
                    <div style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${variableInfo.displayName || 'Temperature'}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #dc2626;">
                      ${displayValue} ${unitDisplay}
                    </div>
                    <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">
                      Data Point: ${nearestPoint.latitude?.toFixed(3)}°, ${nearestPoint.longitude?.toFixed(3)}°
                    </div>
                    <div style="font-size: 9px; color: #9ca3af;">
                      ${(minDistance * 111).toFixed(1)}km from your cursor
                    </div>
                  </div>
                `
                
                // Position popup at the ACTUAL data point location, not cursor
                popup.setOptions({
                  content: popupContent,
                  position: [nearestPoint.longitude, nearestPoint.latitude] // Show at data point
                })
                popup.open(map)
              } else {
                // Hide popup when not near any data point
                popup.close()
              }
            }, 50) // Reduced delay for better responsiveness
          })
          
          // Hide popup when mouse leaves the map
          map.events.add('mouseleave', () => {
            if (hoverTimeout) {
              clearTimeout(hoverTimeout)
            }
            popup.close()
          })
          
          // Change cursor to indicate hoverable area
          map.getCanvasContainer().style.cursor = 'crosshair'
          
          console.log('✅ Unified backend processing complete with', temperatureData.length, 'interactive points')
          console.log('🎯 Hover-only interaction: detection radius', adaptiveRadius.toFixed(2), '° (≈', (adaptiveRadius * 111).toFixed(1), 'km)')
        }

      }, 1000)

      // Fit map to bounds
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