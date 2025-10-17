import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css' // Ensure marker CSS is loaded
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
      console.log('🗺️ ====== AZURE MAP READY - DETAILED DEBUG ======')
      console.log('Map instance created:', !!map)
      console.log('Map container:', mapRef.current)
      console.log('Map camera:', map.getCamera())
      
      setTimeout(() => {
        console.log('📊 ====== RECEIVED DATA ANALYSIS ======')
        console.log('Full mapData object:', JSON.stringify(mapData, null, 2))
        console.log('azureData keys:', mapData.azureData ? Object.keys(mapData.azureData) : 'NONE')
        
        // Check each data source
        console.log('\n🔍 DATA SOURCE CHECK:')
        console.log('1. geotiff_url:', {
          exists: !!mapData.azureData?.geotiff_url,
          value: mapData.azureData?.geotiff_url,
          type: typeof mapData.azureData?.geotiff_url,
          length: mapData.azureData?.geotiff_url?.length,
          startsWithHttp: mapData.azureData?.geotiff_url?.startsWith('http')
        })
        
        console.log('2. static_url:', {
          exists: !!mapData.azureData?.static_url,
          value: mapData.azureData?.static_url?.substring(0, 100),
          type: typeof mapData.azureData?.static_url
        })
        
        console.log('3. geojson:', {
          exists: !!mapData.azureData?.geojson,
          features: mapData.azureData?.geojson?.features?.length,
          sampleFeature: mapData.azureData?.geojson?.features?.[0]
        })
        
        console.log('4. temperature_data:', {
          exists: !!mapData.azureData?.temperature_data,
          count: mapData.azureData?.temperature_data?.length,
          sample: mapData.azureData?.temperature_data?.[0]
        })
        
        console.log('5. bounds:', {
          provided: mapData.bounds,
          valid: mapData.bounds && 
                 isFinite(mapData.bounds.north) && 
                 isFinite(mapData.bounds.south) && 
                 isFinite(mapData.bounds.east) && 
                 isFinite(mapData.bounds.west)
        })

        // Determine what to render
        const hasGeoTiffUrl = !!(mapData.azureData?.geotiff_url || mapData.azureData?.raw_response?.geotiff_url)
        const hasGeoJsonData = !!(mapData.azureData?.geojson?.features && mapData.azureData.geojson.features.length > 0)
        const hasExtremeRegions = !!(mapData.azureData?.extreme_regions && Array.isArray(mapData.azureData.extreme_regions) && mapData.azureData.extreme_regions.length > 0)

        console.log('\n🎯 RENDERING DECISION:')
        console.log('hasGeoTiffUrl:', hasGeoTiffUrl)
        console.log('hasGeoJsonData:', hasGeoJsonData)
        console.log('hasExtremeRegions:', hasExtremeRegions)

        // Priority 1: Try GeoTIFF overlay first
        if (hasGeoTiffUrl) {
          const geotiffUrl = mapData.azureData?.geotiff_url || mapData.azureData?.raw_response?.geotiff_url
          console.log('\n🗺️ ====== ATTEMPTING GEOTIFF LOAD ======')
          console.log('GeoTIFF URL:', geotiffUrl)
          console.log('URL validation:', {
            isDefined: !!geotiffUrl,
            isString: typeof geotiffUrl === 'string',
            startsWithHttp: geotiffUrl?.startsWith('http'),
            length: geotiffUrl?.length,
            hasSAS: geotiffUrl?.includes('?')
          })
          
          // Test URL accessibility FIRST
          console.log('🔍 Testing GeoTIFF URL accessibility...')
          const testStartTime = performance.now()
          
          fetch(geotiffUrl, { method: 'HEAD' })
            .then(response => {
              const testEndTime = performance.now()
              console.log('✅ GeoTIFF URL TEST RESULT:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: {
                  contentType: response.headers.get('content-type'),
                  contentLength: response.headers.get('content-length'),
                  cacheControl: response.headers.get('cache-control'),
                  accessControlAllowOrigin: response.headers.get('access-control-allow-origin')
                },
                timeTaken: `${(testEndTime - testStartTime).toFixed(2)}ms`
              })
              
              if (!response.ok) {
                console.error('❌ GeoTIFF URL returned error status:', response.status)
                console.error('Response details:', response)
                addPngOverlay()
                return
              }
              
              // Check CORS
              const corsHeader = response.headers.get('access-control-allow-origin')
              if (!corsHeader || (corsHeader !== '*' && corsHeader !== window.location.origin)) {
                console.warn('⚠️ CORS WARNING: access-control-allow-origin =', corsHeader)
                console.warn('Current origin:', window.location.origin)
                console.warn('This might cause issues loading the GeoTIFF')
              }
              
              // Detect variable and colormap
              let variable = 'SPI'  // Default
              if (mapData.azureData?.variable_info?.name) {
                variable = mapData.azureData.variable_info.name
              } else if (mapData.azureData?.raw_response?.variable) {
                variable = mapData.azureData.raw_response.variable
              } else if (mapData.azureData?.geojson?.features?.[0]?.properties) {
                const props = mapData.azureData.geojson.features[0].properties
                if (props.spi !== undefined) variable = 'SPI'
                else if (props.variable) variable = props.variable
              }
              
              console.log('🎯 Detected variable:', variable)
              
              const colormap = mapData.azureData?.raw_response?.colormap
              const unit = mapData.azureData?.variable_info?.unit || getVariableUnit(variable)
              
              console.log('🎨 Color configuration:', {
                hasColormap: !!colormap,
                colormap: colormap,
                unit: unit
              })
              
              console.log('🚀 Calling loadGeoTiffOverlay...')
              loadGeoTiffOverlay(geotiffUrl, map, variable, colormap)
                .then(layer => {
                  console.log('📥 loadGeoTiffOverlay returned:', {
                    success: !!layer,
                    layerType: layer?.constructor?.name
                  })
                  
                  if (layer) {
                    console.log('✅ ====== GEOTIFF LOADED SUCCESSFULLY ======')
                    console.log('Layer options:', layer.getOptions())
                    
                    // Verify layer is in map
                    setTimeout(() => {
                      const allLayers = map.layers.getLayers()
                      console.log('🔍 Total map layers:', allLayers.length)
                      const foundLayer = allLayers.find((l: any) => l === layer)
                      console.log('🔍 Our layer found in map:', !!foundLayer)
                      
                      if (foundLayer) {
                        const opts = foundLayer.getOptions()
                        console.log('✅ Layer is active with options:', {
                          visible: opts.visible,
                          opacity: opts.opacity,
                          hasUrl: !!opts.url,
                          urlPreview: opts.url?.substring(0, 100),
                          coordinatesCount: opts.coordinates?.length
                        })
                      } else {
                        console.error('❌ Layer NOT found in map after adding!')
                      }
                    }, 2000)
                    
                    // Add legend
                    const legend = createDynamicLegend(variable, colormap, unit)
                    mapRef.current?.appendChild(legend)
                    console.log('✅ Legend added to map')
                    
                    // Add hover interactions if we have data
                    if (hasGeoJsonData) {
                      console.log('🎯 Adding hover interactions for GeoTIFF + GeoJSON data')
                      const temperatureData = mapData.azureData.geojson.features.map((feature: any) => ({
                        latitude: feature.geometry.coordinates[1],
                        longitude: feature.geometry.coordinates[0],
                        spi: feature.properties.spi,
                        value: feature.properties.spi,
                        variable: variable,
                        unit: getVariableUnit(variable)
                      }))
                      processTemperatureData(temperatureData)
                    }
                  } else {
                    console.log('⚠️ ====== GEOTIFF RETURNED NULL ======')
                    console.log('Falling back to PNG overlay')
                    addPngOverlay()
                  }
                })
                .catch(error => {
                  console.error('❌ ====== GEOTIFF LOAD FAILED ======')
                  console.error('Error type:', error?.constructor?.name)
                  console.error('Error message:', error?.message)
                  console.error('Error stack:', error?.stack)
                  console.error('Full error object:', error)
                  addPngOverlay()
                })
            })
            .catch(urlError => {
              console.error('❌ ====== GEOTIFF URL TEST FAILED ======')
              console.error('Error type:', urlError?.constructor?.name)
              console.error('Error message:', urlError?.message)
              console.error('This usually means:', [
                '1. Network issue',
                '2. CORS blocking',
                '3. Invalid URL',
                '4. SAS token expired'
              ])
              addPngOverlay()
            })
        } 
        // Priority 2: If no GeoTIFF but have GeoJSON, show circle markers
        else if (hasGeoJsonData) {
          console.log('📍 ====== NO GEOTIFF - SHOWING GEOJSON MARKERS ======')
          addPngOverlay()
          const features = mapData.azureData.geojson.features
          addCircleMarkers(features)
          
          const temperatureData = features.map((feature: any) => ({
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            spi: feature.properties.spi,
            value: feature.properties.spi || feature.properties.value,
            variable: feature.properties.variable || 'SPI',
            unit: ''
          }))
          processTemperatureData(temperatureData)
        }
        // Priority 3: Extreme regions analysis
        else if (hasExtremeRegions) {
          console.log('🌡️ ====== SHOWING EXTREME REGION MARKERS ======')
          renderExtremeRegionMarkers()
        }
        else {
          console.log('📸 ====== NO DATA - PNG OVERLAY ONLY ======')
          addPngOverlay()
        }

        // Function to add circle markers for GeoJSON data
        function addCircleMarkers(features: any[]) {
          console.log('📍 Adding circle markers for', features.length, 'GeoJSON features')
          
          const markers: atlas.HtmlMarker[] = []
          
          features.forEach((feature: any, index: number) => {
            const lat = feature.geometry.coordinates[1]
            const lng = feature.geometry.coordinates[0]
            const value = feature.properties.spi || feature.properties.value || 0
            
            if (!isFinite(lat) || !isFinite(lng)) {
              console.warn(`❌ Invalid coordinates for feature ${index + 1}:`, { lat, lng })
              return
            }
            
            // Simple neutral circle markers - no manual coloring since backend provides colors
            const marker = new atlas.HtmlMarker({
              position: [lng, lat],
              zIndex: 1000,
              htmlContent: `
                <div style="
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: #4A90E2;
                  border: 1px solid white;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
                  cursor: pointer;
                  ">
                </div>
              `
            })
            
            try {
              map.markers.add(marker)
              markers.push(marker)
              console.log(`✅ Circle marker ${index + 1} added at [${lng}, ${lat}] with value ${value.toFixed(2)}`)
            } catch (error) {
              console.error(`❌ Failed to add circle marker ${index + 1}:`, error)
            }
          })
          
          console.log(`📍 Total circle markers added: ${markers.length}`)
          
          // Cleanup function
          map.events.addOnce('remove', () => {
            markers.forEach(m => map.markers.remove(m))
          })
        }

        function addPngOverlay() {
          console.log('📸 ATTEMPTING PNG OVERLAY')
          console.log('- static_url exists:', !!mapData.azureData?.static_url)
          console.log('- static_url value:', mapData.azureData?.static_url)
          
          if (mapData.azureData?.static_url && mapData.azureData.static_url.startsWith('http')) {
            console.log('📸 Adding static PNG overlay:', mapData.azureData.static_url)
            
            // FIXED: Use proper bounds priority
            let overlayBounds = bounds  // Default
            if (mapData.azureData.bounds) {
              overlayBounds = mapData.azureData.bounds
              console.log('📍 Using azureData.bounds:', overlayBounds)
            } else if (mapData.bounds) {
              overlayBounds = mapData.bounds
              console.log('📍 Using mapData.bounds:', overlayBounds)
            } else {
              console.log('📍 Using default bounds:', overlayBounds)
            }
            
            // Create coordinates for the overlay
            const coordinates = [
              [overlayBounds.west, overlayBounds.north],
              [overlayBounds.east, overlayBounds.north],
              [overlayBounds.east, overlayBounds.south],
              [overlayBounds.west, overlayBounds.south]
            ]
            
            console.log('📍 Image coordinates:', coordinates)
            
            const imageLayer = new atlas.layer.ImageLayer({
              url: mapData.azureData.static_url,
              coordinates: coordinates,
              opacity: 0.9,
              visible: true
            })
            
            try {
              map.layers.add(imageLayer, 'labels')
              console.log('✅ Static overlay added below labels')
            } catch (error) {
              console.error('❌ Failed to add static overlay below labels:', error)
              try {
                map.layers.add(imageLayer)
                console.log('✅ Static overlay added to top')
              } catch (error2) {
                console.error('❌ Failed to add static overlay at all:', error2)
              }
            }
          } else {
            console.log('❌ No valid static_url for PNG overlay')
          }
        }

        // Keep extreme regions function for cases without overlay data
        function renderExtremeRegionMarkers() {
          const extremeRegions = mapData.azureData!.extreme_regions!
          const analysisType = mapData.azureData!.analysis_type || 'extreme'
          
          console.log('🌡️ Rendering extreme region markers:', extremeRegions.length)

          const markers: atlas.HtmlMarker[] = []
          const popup = new atlas.Popup({ pixelOffset: [0, -40] })

          function getExtremeColor(severity: string, analysisType: string): string {
            if (analysisType.includes('temperature')) {
              if (severity === 'coldest') return '#0066CC'
              if (severity === 'hottest') return '#FF3300'
              return '#FF8C00'
            }
            if (analysisType.includes('wet')) return '#0066FF'
            if (analysisType.includes('dry')) return '#CC6600'
            if (severity === 'extreme drought') return '#8B0000'
            if (severity === 'severe drought') return '#FF0000'
            if (severity === 'moderate drought') return '#FF4500'
            return '#1D4ED8'
          }

          extremeRegions.forEach((r: any, index: number) => {
            if (!isFinite(r.longitude) || !isFinite(r.latitude)) {
              console.error(`❌ Invalid coordinates for marker ${index + 1}:`, r)
              return
            }

            const color = getExtremeColor(r.severity, analysisType)
            
            const marker = new atlas.HtmlMarker({
              position: [r.longitude, r.latitude],
              zIndex: 3000,
              htmlContent: `
                <div style="
                  width: 50px;
                  height: 50px;
                  border-radius: 50%;
                  background: ${color};
                  border: 5px solid #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #ffffff;
                  font-weight: 900;
                  font-size: 18px;
                  box-shadow: 0 6px 15px rgba(0,0,0,0.6);
                  cursor: pointer;
                  font-family: system-ui;
                  ">
                  ${r.rank || (index + 1)}
                </div>
              `
            })

            marker.addEventListener('click', () => {
              const variable = mapData.azureData?.variable_info?.name || 'Value'
              const unit = mapData.azureData?.variable_info?.unit || ''
              
              popup.setOptions({
                content: `
                  <div style="padding:15px;min-width:240px;font-size:14px;font-family:system-ui;">
                    <h4 style="margin:0 0 12px 0;color:${color};font-size:16px;">
                      ${analysisType.replace('_', ' ')} #${r.rank}
                    </h4>
                    <div style="margin:6px 0;"><strong>${variable}:</strong> ${Number(r.value).toFixed(3)} ${unit}</div>
                    <div style="margin:6px 0;"><strong>Category:</strong> ${r.severity}</div>
                    <div style="margin:6px 0;color:#666;"><strong>Coordinates:</strong><br/>${r.latitude.toFixed(4)}°, ${r.longitude.toFixed(4)}°</div>
                  </div>
                `,
                position: [r.longitude, r.latitude]
              })
              popup.open(map)
            })

            try {
              map.markers.add(marker)
              markers.push(marker)
              console.log(`✅ Extreme region marker ${index + 1} added at [${r.longitude}, ${r.latitude}]`)
            } catch (error) {
              console.error(`❌ Failed to add extreme region marker ${index + 1}:`, error)
            }
          })

          // Cleanup
          map.events.addOnce('remove', () => {
            markers.forEach(m => map.markers.remove(m))
          })
        }

        // FIXED: Better variable detection for hover data
        function processTemperatureData(temperatureData: any[]) {
          console.log('🎯 Processing hover interactions for', temperatureData.length, 'data points')
          
          // Detect the actual variable from the data
          let detectedVariable = 'SPI'
          let unitDisplay = ''
          
          if (temperatureData.length > 0) {
            const sample = temperatureData[0]
            if (sample.spi !== undefined) {
              detectedVariable = 'SPI'
              unitDisplay = ''
            } else if (sample.variable) {
              detectedVariable = sample.variable
              unitDisplay = sample.unit || getVariableUnit(sample.variable)
            }
          }
          
          console.log('🎯 Detected variable for hover:', detectedVariable, 'Unit:', unitDisplay)
          
          const avgDistance = temperatureData.length > 1 ? 
            Math.sqrt((temperatureData[1].longitude - temperatureData[0].longitude) ** 2 + 
                     (temperatureData[1].latitude - temperatureData[0].latitude) ** 2) : 0.1
          
          const adaptiveRadius = Math.max(0.1, Math.min(0.5, avgDistance * 2))
          console.log('🎯 Hover detection radius:', adaptiveRadius, '(≈', (adaptiveRadius * 111).toFixed(1), 'km)')

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
              
              if (nearestPoint && minDistance < adaptiveRadius) {
                let displayValue = 'N/A'
                let variableDisplayName = getVariableDisplayName(detectedVariable)
                
                // Check multiple value sources
                if (nearestPoint.spi !== undefined) {
                  displayValue = nearestPoint.spi.toFixed(2)
                  variableDisplayName = 'SPI (Drought Index)'
                } else if (nearestPoint.value !== undefined) {
                  displayValue = nearestPoint.value.toFixed(2)
                } else if (nearestPoint.originalValue !== undefined) {
                  displayValue = nearestPoint.originalValue.toFixed(2)
                }
                
                const popupContent = `
                  <div style="padding: 8px; min-width: 140px; font-size: 12px;">
                    <div style="font-weight: bold; color: #2563eb; margin-bottom: 4px;">${variableDisplayName}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #dc2626;">
                      ${displayValue} ${unitDisplay}
                    </div>
                    <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">
                      ${nearestPoint.latitude?.toFixed(3)}°, ${nearestPoint.longitude?.toFixed(3)}°
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
            }, 50)
          })
          
          map.events.add('mouseleave', () => {
            if (hoverTimeout) {
              clearTimeout(hoverTimeout)
            }
            popup.close()
          })
          
          map.getCanvasContainer().style.cursor = 'crosshair'
          
          console.log('✅ Hover interactions ready for', temperatureData.length, 'points')
        }

        // Helper functions
        function getVariableUnit(variable: string): string {
          const unitMap: { [key: string]: string } = {
            'SPI': '', 'spi': '',
            'Tair': '°C', 'temperature': '°C',
            'Rainf': 'mm/hr', 'precipitation': 'mm/hr'
          }
          return unitMap[variable] || ''
        }

        function getVariableDisplayName(variable: string): string {
          const nameMap: { [key: string]: string } = {
            'SPI': 'SPI (Drought Index)',
            'spi': 'SPI (Drought Index)',
            'Tair': 'Air Temperature',
            'temperature': 'Air Temperature',
            'Rainf': 'Precipitation'
          }
          return nameMap[variable] || variable.replace(/_/g, ' ')
        }

      }, 1500)

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