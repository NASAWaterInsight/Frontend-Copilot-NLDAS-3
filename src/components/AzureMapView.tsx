import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'

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
      
      // Wait a bit for all base layers to load
      setTimeout(() => {
        console.log('=== IMAGE OVERLAY ATTEMPT ===')
        console.log('Checking mapData.map_url:', mapData.map_url)
        console.log('Is valid URL?', mapData.map_url && mapData.map_url.startsWith('http'))
        
        // Add your actual backend overlay
        if (mapData.map_url && mapData.map_url.startsWith('http')) {
          console.log('=== COMPREHENSIVE BACKEND OVERLAY DEBUG ===')
          console.log('✅ Adding YOUR backend overlay:', mapData.map_url)
          console.log('Using precise bounds:', [bounds.west, bounds.north, bounds.east, bounds.south])
          
          // Test 1: Check if URL is accessible
          console.log('🔍 Step 1: Testing URL accessibility...')
          fetch(mapData.map_url, { method: 'HEAD' })
            .then(response => {
              console.log('📊 Backend URL test results:')
              console.log('- Status:', response.status)
              console.log('- OK:', response.ok)
              console.log('- Content-Type:', response.headers.get('content-type'))
              
              if (response.ok) {
                console.log('✅ URL is accessible, proceeding with overlay creation...')
                
                // Create the image layer
                const imageLayer = new atlas.layer.ImageLayer({
                  url: mapData.map_url,
                  coordinates: [
                    [bounds.west, bounds.north],
                    [bounds.east, bounds.north],
                    [bounds.east, bounds.south],
                    [bounds.west, bounds.south]
                  ],
                  opacity: 0.6 // Reduced opacity to see labels better
                })
                
                console.log('✅ ImageLayer object created successfully')
                
                // Add to map with proper layer ordering
                try {
                  // Add your overlay BELOW the labels layer so city names stay visible
                  map.layers.add(imageLayer, 'labels')
                  console.log('✅ Backend overlay successfully added below labels!')
                } catch (error) {
                  console.error('❌ Failed to add backend overlay to map:', error)
                  // Fallback: try other layer positions
                  try {
                    map.layers.add(imageLayer, 'road-labels')
                    console.log('✅ Backend overlay added below road labels')
                  } catch (fallbackError) {
                    // Last resort: add to top (labels will be hidden)
                    map.layers.add(imageLayer)
                    console.log('⚠️ Backend overlay added to top - labels may be hidden')
                  }
                }
                
              } else {
                console.error('❌ Backend URL returned error:', response.status, response.statusText)
              }
            })
            .catch(error => {
              console.error('❌ Backend URL completely inaccessible:', error)
            })
        } else {
          console.log('❌ No valid backend URL found')
          console.log('📊 mapData.map_url value:', mapData.map_url)
        }
        
        console.log('=== END COMPREHENSIVE DEBUG ===')
        
        // Check azureData overlay (backup)
        if (mapData.azureData && mapData.azureData.overlay_url && mapData.azureData.overlay_url.startsWith('http')) {
          console.log('✅ Adding overlay from azureData:', mapData.azureData.overlay_url)
          
          const azureImageLayer = new atlas.layer.ImageLayer({
            url: mapData.azureData.overlay_url,
            coordinates: [
              [bounds.west, bounds.north],
              [bounds.east, bounds.north],
              [bounds.east, bounds.south],
              [bounds.west, bounds.south]
            ],
            opacity: 0.6
          })
          
          try {
            // Also add below labels
            map.layers.add(azureImageLayer, 'labels')
            console.log('✅ Azure overlay added below labels')
          } catch (error) {
            console.error('❌ Failed to add Azure overlay:', error)
            // Fallback: add to top
            map.layers.add(azureImageLayer)
          }
        }
        
        // DEBUG: Show all available layer IDs after map loads
        setTimeout(() => {
          console.log('=== LAYER ORDER DEBUG ===')
          const layers = map.layers.getLayers()
          console.log('Available Azure Maps layers (bottom to top):')
          layers.forEach((layer, index) => {
            const layerId = layer.getId ? layer.getId() : 'No ID'
            console.log(`${index}: ${layerId}`)
          })
          console.log('=== END LAYER ORDER ===')
        }, 3000)
        
      }, 1000) // Wait 1 second for base layers to load
      
      // Rest of your existing code (temperature data points, etc.)
      if (mapData.azureData && mapData.azureData.temperature_data) {
        console.log('Adding temperature data to map:', mapData.azureData.temperature_data)
        
        // Create data source for temperature points (for interaction only)
        const dataSource = new atlas.source.DataSource()
        map.sources.add(dataSource)
        
        // Add temperature data points to the map (invisible, for clicking)
        mapData.azureData.temperature_data.forEach((point: any) => {
          const temperaturePoint = new atlas.data.Feature(
            new atlas.data.Point([point.longitude, point.latitude]),
            {
              value: point.value,
              originalValue: point.originalValue,
              location: point.location || 'Unknown'
            }
          )
          dataSource.add(temperaturePoint)
        })
        
        // Add small invisible markers for interaction
        const symbolLayer = new atlas.layer.SymbolLayer(dataSource, null, {
          iconOptions: {
            image: 'none',
            allowOverlap: true
          },
          textOptions: {
            textField: '',
            size: 0
          }
        })
        
        map.layers.add(symbolLayer)
        
        // Add interactive popup for temperature readings
        const popup = new atlas.Popup({
          pixelOffset: [0, -18],
          closeButton: true
        })
        
        // Show popup when clicking near data points
        map.events.add('click', (e: any) => {
          const clickPoint = e.position
          let nearestPoint = null
          let minDistance = Infinity
          
          // Find nearest temperature point
          mapData.azureData.temperature_data.forEach((point: any) => {
            const distance = Math.sqrt(
              Math.pow(point.longitude - clickPoint[0], 2) + 
              Math.pow(point.latitude - clickPoint[1], 2)
            )
            if (distance < minDistance) {
              minDistance = distance
              nearestPoint = point
            }
          })
          
          // Show popup if clicked near a data point (within ~5km)
          if (nearestPoint && minDistance < 0.05) {
            // Get variable information from azureData
            const variableInfo = mapData.azureData.variable_info || {
              name: 'Unknown',
              unit: '',
              displayName: 'Data'
            }
            
            // Format the value based on variable type
            let displayValue = nearestPoint.originalValue?.toFixed(2) || nearestPoint.value?.toFixed(2) || 'N/A'
            let unitDisplay = variableInfo.unit
            
            // Special formatting for different variables with proper units
            if (variableInfo.name === 'Tair' || variableInfo.name === 'Tair_f_inst') {
              displayValue = nearestPoint.originalValue?.toFixed(2) || 'N/A'
              unitDisplay = '°C'
            } else if (variableInfo.name === 'Rainf_f_tavg' || variableInfo.name === 'Rainf') {
              displayValue = (nearestPoint.originalValue * 3600)?.toFixed(3) || 'N/A' // Convert from kg/m²/s to mm/hr
              unitDisplay = 'mm/hr'
            } else if (variableInfo.name === 'Psurf' || variableInfo.name === 'Psurf_f_inst') {
              displayValue = (nearestPoint.originalValue / 1000)?.toFixed(2) || 'N/A' // Convert Pa to kPa
              unitDisplay = 'kPa'
            } else if (variableInfo.name.includes('Wind')) {
              displayValue = nearestPoint.originalValue?.toFixed(2) || 'N/A'
              unitDisplay = 'm/s'
            } else if (variableInfo.name.includes('Qair') || variableInfo.name.includes('Humidity')) {
              displayValue = nearestPoint.originalValue?.toFixed(4) || 'N/A'
              unitDisplay = 'kg/kg'
            } else if (variableInfo.name.includes('SWdown') || variableInfo.name.includes('LWdown')) {
              displayValue = nearestPoint.originalValue?.toFixed(1) || 'N/A'
              unitDisplay = 'W/m²'
            } else if (variableInfo.name.includes('SoilMoi')) {
              displayValue = nearestPoint.originalValue?.toFixed(3) || 'N/A'
              unitDisplay = 'm³/m³'
            } else if (variableInfo.name.includes('SoilTemp')) {
              displayValue = nearestPoint.originalValue?.toFixed(2) || 'N/A'
              unitDisplay = '°C'
            } else if (variableInfo.name.includes('Runoff') || variableInfo.name.includes('flow')) {
              displayValue = (nearestPoint.originalValue * 3600)?.toFixed(3) || 'N/A' // Convert to mm/hr
              unitDisplay = 'mm/hr'
            }
            
            popup.setOptions({
              content: `<div style="padding: 15px;">
                <h4 style="margin: 0 0 10px 0;">Environmental Data</h4>
                <strong>${variableInfo.displayName}: ${displayValue} ${unitDisplay}</strong><br/>
                <strong>Coordinates:</strong><br/>
                Lat: ${clickPoint[1].toFixed(6)}<br/>
                Lng: ${clickPoint[0].toFixed(6)}<br/>
                <small>Distance: ${(minDistance * 111).toFixed(1)}km from nearest data point</small>
              </div>`,
              position: clickPoint
            })
            popup.open(map)
          }
        })
      }

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