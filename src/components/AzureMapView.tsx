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
      
      // === DIAGNOSTIC TEST: Add bright test markers at known coordinates ===
      console.log('🔬 DIAGNOSTIC: Adding test markers at known locations...')
      
      const diagnosticMarkers = [
        { pos: [-77.25, 39.3], color: 'red', label: 'TEST-MD' },
        { pos: [-79.45, 38.92], color: 'lime', label: 'TEST-1' },
        { pos: [-79.41, 38.93], color: 'yellow', label: 'TEST-2' },
        { pos: [-79.41, 38.92], color: 'orange', label: 'TEST-3' }
      ]
      
      diagnosticMarkers.forEach((test, idx) => {
        console.log(`🔬 Creating diagnostic marker ${idx + 1} at [${test.pos[0]}, ${test.pos[1]}]`)
        
        const diagnosticMarker = new atlas.HtmlMarker({
          position: test.pos,
          zIndex: 5000,
          htmlContent: `
            <div style="
              width: 60px;
              height: 60px;
              background: ${test.color};
              border: 5px solid black;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: black;
              font-weight: 900;
              font-size: 12px;
              font-family: monospace;
              box-shadow: 0 8px 20px rgba(0,0,0,0.8);
              cursor: pointer;
              ">
              ${test.label}
            </div>
          `
        })
        
        try {
          map.markers.add(diagnosticMarker)
          console.log(`✅ DIAGNOSTIC: Marker ${idx + 1} (${test.label}) added successfully`)
        } catch (error) {
          console.error(`❌ DIAGNOSTIC: Marker ${idx + 1} failed:`, error)
        }
      })
      
      // Force immediate zoom to Maryland area
      console.log('🎯 DIAGNOSTIC: Forcing zoom to Maryland area...')
      map.setCamera({
        center: [-77.25, 39.3],
        zoom: 8
      })
      
      // Check marker count immediately
      setTimeout(() => {
        const markerCount = map.markers.getMarkers().length
        console.log(`🔬 DIAGNOSTIC: Total markers in map: ${markerCount}`)
        
        if (markerCount === 0) {
          console.error('🚨 CRITICAL: NO MARKERS AT ALL! Azure Maps marker system may be broken!')
        } else {
          console.log('✅ DIAGNOSTIC: Markers are working! Issue is with data processing.')
          
          // List all markers
          map.markers.getMarkers().forEach((marker: any, idx: number) => {
            const options = marker.getOptions()
            console.log(`- Diagnostic marker ${idx + 1}:`, {
              position: options.position,
              zIndex: options.zIndex,
              visible: marker.isVisible ? marker.isVisible() : 'unknown'
            })
          })
        }
      }, 1000)
      
      // === END DIAGNOSTIC SECTION ===
      
      setTimeout(() => {
        console.log('🔍 DATA PROCESSING DEBUG:')
        console.log('- mapData exists:', !!mapData)
        console.log('- azureData exists:', !!mapData.azureData)
        console.log('- azureData keys:', mapData.azureData ? Object.keys(mapData.azureData) : 'none')
        console.log('- extreme_regions exists:', !!mapData.azureData?.extreme_regions)
        console.log('- extreme_regions type:', typeof mapData.azureData?.extreme_regions)
        console.log('- extreme_regions length:', mapData.azureData?.extreme_regions?.length)
        console.log('- extreme_regions content:', mapData.azureData?.extreme_regions)
        console.log('- geojson exists:', !!mapData.azureData?.geojson)
        console.log('- geojson features:', mapData.azureData?.geojson?.features?.length)
        console.log('- raw_response exists:', !!mapData.azureData?.raw_response)
        
        if (mapData.azureData?.raw_response) {
          console.log('- raw_response keys:', Object.keys(mapData.azureData.raw_response))
          console.log('- raw_response analysis_data:', mapData.azureData.raw_response.analysis_data)
          console.log('- raw_response regions:', mapData.azureData.raw_response.regions)
          console.log('- raw_response.analysis_data?.result:', mapData.azureData.raw_response.analysis_data?.result)
        }

        // Try multiple paths for finding region data
        const possibleRegionPaths = [
          { path: 'extreme_regions', data: mapData.azureData?.extreme_regions },
          { path: 'geojson.features', data: mapData.azureData?.geojson?.features },
          { path: 'raw_response.regions', data: mapData.azureData?.raw_response?.regions },
          { path: 'raw_response.analysis_data.result.regions', data: mapData.azureData?.raw_response?.analysis_data?.result?.regions },
          { path: 'temperature_data', data: mapData.azureData?.temperature_data }
        ]
        
        console.log('🔍 REGION DATA PATHS:')
        possibleRegionPaths.forEach(path => {
          console.log(`- ${path.path}:`, {
            exists: !!path.data,
            type: typeof path.data,
            isArray: Array.isArray(path.data),
            length: path.data?.length,
            sample: Array.isArray(path.data) ? path.data[0] : path.data
          })
        })
        
        // Find the best data source
        const validRegionSource = possibleRegionPaths.find(path => 
          Array.isArray(path.data) && path.data.length > 0
        )
        
        if (validRegionSource) {
          console.log(`🎯 FOUND VALID REGION DATA in: ${validRegionSource.path}`)
          console.log('Sample region:', validRegionSource.data[0])
          
          // Try to create markers from this data
          console.log('🔨 ATTEMPTING TO CREATE MARKERS FROM FOUND DATA...')
          
          validRegionSource.data.forEach((region: any, index: number) => {
            const lat = region.latitude
            const lng = region.longitude || region.coords?.[0]
            const value = region.value || region.spi || 'N/A'
            
            console.log(`🔨 Processing region ${index + 1}:`, {
              lat, lng, value,
              latValid: isFinite(lat),
              lngValid: isFinite(lng),
              originalRegion: region
            })
            
            if (isFinite(lat) && isFinite(lng)) {
              console.log(`🔨 Creating emergency marker ${index + 1} at [${lng}, ${lat}]`)
              
              const emergencyMarker = new atlas.HtmlMarker({
                position: [lng, lat],
                zIndex: 4000,
                htmlContent: `
                  <div style="
                    width: 50px;
                    height: 50px;
                    background: purple;
                    border: 4px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 6px 12px rgba(0,0,0,0.5);
                    ">
                    E${index + 1}
                  </div>
                `
              })
              
              try {
                map.markers.add(emergencyMarker)
                console.log(`✅ Emergency marker E${index + 1} added successfully`)
              } catch (error) {
                console.error(`❌ Emergency marker E${index + 1} failed:`, error)
              }
            } else {
              console.error(`❌ Invalid coordinates for region ${index + 1}:`, { lat, lng, region })
            }
          })
          
          // Set camera to these emergency markers
          const validCoords = validRegionSource.data
            .filter((r: any) => isFinite(r.latitude) && isFinite(r.longitude || r.coords?.[0]))
            .map((r: any) => ({ lat: r.latitude, lng: r.longitude || r.coords?.[0] }))
          
          if (validCoords.length > 0) {
            const lats = validCoords.map(c => c.lat)
            const lngs = validCoords.map(c => c.lng)
            
            setTimeout(() => {
              map.setCamera({
                bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
                padding: 80
              })
              console.log('🎯 Camera set to emergency markers')
            }, 2000)
          }
          
        } else {
          console.error('🚨 NO VALID REGION DATA FOUND IN ANY PATH!')
        }

        // Continue with original logic but with more debugging...
        if (mapData.azureData?.extreme_regions && Array.isArray(mapData.azureData.extreme_regions) && mapData.azureData.extreme_regions.length > 0) {
          console.log('🌡️ ORIGINAL: Rendering extreme region markers:', mapData.azureData.extreme_regions.length)
          renderExtremeRegionMarkers()
        } else {
          console.log('⚠️ ORIGINAL: No extreme_regions found, trying geojson fallback...')
          
          if (mapData.azureData?.geojson?.features && mapData.azureData.geojson.features.length > 0) {
            console.log('🔄 ORIGINAL: Extracting markers from geojson features')
            const features = mapData.azureData.geojson.features
            
            const extractedRegions = features.map((feature: any, index: number) => ({
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0], 
              value: feature.properties.value,
              rank: feature.properties.rank || (index + 1),
              severity: feature.properties.severity || 'coldest',
              location: `${feature.geometry.coordinates[1].toFixed(2)}, ${feature.geometry.coordinates[0].toFixed(2)}`
            }))
            
            console.log('🎯 ORIGINAL: Extracted regions from geojson:', extractedRegions)
            
            mapData.azureData.extreme_regions = extractedRegions
            if (!mapData.azureData.analysis_type) {
              mapData.azureData.analysis_type = 'extreme temperature regions'
            }
            
            renderExtremeRegionMarkers()
          }
        }

        function renderExtremeRegionMarkers() {
          console.log('🎨 RENDER: Starting extreme region marker rendering...')
          
          const extremeRegions = mapData.azureData!.extreme_regions!
          console.log('🎨 RENDER: Extreme regions data:', extremeRegions)
          
          if (!Array.isArray(extremeRegions)) {
            console.error('🚨 RENDER: extremeRegions is not an array!', typeof extremeRegions)
            return
          }
          
          if (extremeRegions.length === 0) {
            console.error('🚨 RENDER: extremeRegions array is empty!')
            return
          }
          
          const analysisType = mapData.azureData!.analysis_type || 'extreme'
          console.log('🎨 RENDER: Analysis type:', analysisType)

          const markers: atlas.HtmlMarker[] = []

          extremeRegions.forEach((r: any, index: number) => {
            console.log(`🎨 RENDER: Processing region ${index + 1}:`, r)
            
            if (!r) {
              console.error(`🚨 RENDER: Region ${index + 1} is null/undefined`)
              return
            }
            
            const lat = r.latitude
            const lng = r.longitude
            
            console.log(`🎨 RENDER: Coordinates for region ${index + 1}:`, { lat, lng })
            
            if (!isFinite(lat) || !isFinite(lng)) {
              console.error(`🚨 RENDER: Invalid coordinates for region ${index + 1}:`, { lat, lng, region: r })
              return
            }

            const marker = new atlas.HtmlMarker({
              position: [lng, lat],
              zIndex: 6000,
              htmlContent: `
                <div style="
                  width: 45px;
                  height: 45px;
                  border-radius: 50%;
                  background: cyan;
                  border: 4px solid navy;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: navy;
                  font-weight: 900;
                  font-size: 16px;
                  box-shadow: 0 6px 15px rgba(0,0,0,0.7);
                  cursor: pointer;
                  font-family: system-ui;
                  ">
                  R${index + 1}
                </div>
              `
            })

            try {
              map.markers.add(marker)
              markers.push(marker)
              console.log(`✅ RENDER: Marker R${index + 1} added successfully at [${lng}, ${lat}]`)
            } catch (error) {
              console.error(`❌ RENDER: Failed to add marker R${index + 1}:`, error)
            }
          })

          console.log(`🎨 RENDER: Completed. Total markers created: ${markers.length}`)
        }

        // Final marker count after all processing
        setTimeout(() => {
          const finalCount = map.markers.getMarkers().length
          console.log(`🏁 FINAL MARKER COUNT: ${finalCount}`)
          
          if (finalCount === 0) {
            console.error('🚨 CRITICAL FAILURE: Still no markers after all attempts!')
          } else {
            console.log('🎉 SUCCESS: Markers are present in the map!')
            
            // List all final markers
            map.markers.getMarkers().forEach((marker: any, idx: number) => {
              const options = marker.getOptions()
              console.log(`🏁 Final marker ${idx + 1}:`, {
                position: options.position,
                zIndex: options.zIndex,
                htmlContent: options.htmlContent?.substring(0, 50) + '...'
              })
            })
          }
        }, 5000)

      }, 1500)

      setTimeout(() => {
        console.log('🎯 AzureMapView processing data:', {
          'azureData keys': mapData.azureData ? Object.keys(mapData.azureData) : 'none',
          'extreme_regions exists': !!mapData.azureData?.extreme_regions,
          'extreme_regions length': mapData.azureData?.extreme_regions?.length,
          'geojson exists': !!mapData.azureData?.geojson,
          'geojson features': mapData.azureData?.geojson?.features?.length,
          'data_type': mapData.azureData?.data_type
        })

        // Process extreme regions (temperature, wettest, etc.) - FIRST PRIORITY
        if (mapData.azureData?.extreme_regions && Array.isArray(mapData.azureData.extreme_regions) && mapData.azureData.extreme_regions.length > 0) {
          console.log('🌡️ Rendering extreme region markers:', mapData.azureData.extreme_regions.length)
          renderExtremeRegionMarkers()
        } 
        // Fallback: Try to extract from geojson if extreme_regions missing
        else if (mapData.azureData?.geojson?.features && mapData.azureData.geojson.features.length > 0) {
          console.log('🔄 Fallback: Extracting markers from geojson features')
          const features = mapData.azureData.geojson.features
          
          // Convert geojson features to extreme regions format
          const extractedRegions = features.map((feature: any, index: number) => ({
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0], 
            value: feature.properties.value,
            rank: feature.properties.rank || (index + 1),
            severity: feature.properties.severity || 'coldest',
            location: `${feature.geometry.coordinates[1].toFixed(2)}, ${feature.geometry.coordinates[0].toFixed(2)}`
          }))
          
          console.log('🎯 Extracted regions from geojson:', extractedRegions)
          
          // Temporarily add to azureData and render
          mapData.azureData.extreme_regions = extractedRegions
          if (!mapData.azureData.analysis_type) {
            mapData.azureData.analysis_type = 'extreme temperature regions'
          }
          
          renderExtremeRegionMarkers()
        } else {
          console.log('❌ No extreme regions or geojson features found')
          
          // FORCE ADD markers from backend response coordinates if available
          console.log('🚨 EMERGENCY: Trying to add markers directly from backend response...')
          
          // Check multiple possible locations for region data
          const possibleRegions = [
            mapData.azureData?.raw_response?.analysis_data?.result?.regions,
            mapData.azureData?.raw_response?.regions,
            mapData.azureData?.temperature_data
          ].find(regions => Array.isArray(regions) && regions.length > 0)
          
          if (possibleRegions) {
            console.log('🎯 Found regions in alternative location:', possibleRegions)
            
            possibleRegions.forEach((region: any, index: number) => {
              const lat = region.latitude
              const lng = region.longitude
              
              if (isFinite(lat) && isFinite(lng)) {
                console.log(`🚨 EMERGENCY: Adding marker ${index + 1} at [${lng}, ${lat}]`)
                
                const emergencyMarker = new atlas.HtmlMarker({
                  position: [lng, lat],
                  htmlContent: `<div style="width:40px;height:40px;background:orange;border-radius:50%;border:4px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;box-shadow:0 4px 8px rgba(0,0,0,0.3);">${index + 1}</div>`
                })
                
                try {
                  map.markers.add(emergencyMarker)
                  console.log(`✅ Emergency marker ${index + 1} added`)
                } catch (error) {
                  console.error(`❌ Emergency marker ${index + 1} failed:`, error)
                }
              }
            })
            
            // Set camera to these points
            const validCoords = possibleRegions.filter((r: any) => isFinite(r.latitude) && isFinite(r.longitude))
            if (validCoords.length > 0) {
              const lats = validCoords.map((r: any) => r.latitude)
              const lngs = validCoords.map((r: any) => r.longitude)
              
              map.setCamera({
                bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
                padding: 100
              })
              console.log('🎯 Camera set to emergency marker bounds')
            }
          }
        }

        function renderExtremeRegionMarkers() {
          const extremeRegions = mapData.azureData!.extreme_regions!
          const analysisType = mapData.azureData!.analysis_type || 'extreme'
          
          console.log('🌡️ Analysis type:', analysisType)
          console.log('🌡️ Sample region data:', extremeRegions[0])
          console.log('🌡️ All regions:', extremeRegions)

          const markers: atlas.HtmlMarker[] = []
          const popup = new atlas.Popup({ pixelOffset: [0, -40] })

          function getExtremeColor(severity: string, analysisType: string): string {
            if (analysisType.includes('temperature')) {
              if (severity === 'coldest') return '#0066CC'  // Blue for coldest
              if (severity === 'hottest') return '#FF3300'  // Red for hottest
              return '#FF8C00'  // Orange for other temp
            }
            if (analysisType.includes('wet')) return '#0066FF'  // Blue for wettest
            if (analysisType.includes('dry')) return '#CC6600'  // Brown for driest
            // Drought colors (from existing logic)
            if (severity === 'extreme drought') return '#8B0000'
            if (severity === 'severe drought') return '#FF0000'
            if (severity === 'moderate drought') return '#FF4500'
            return '#1D4ED8'  // Default blue
          }

          extremeRegions.forEach((r: any, index: number) => {
            const color = getExtremeColor(r.severity, analysisType)
            console.log(`🎯 Creating marker ${index + 1}:`, {
              position: [r.longitude, r.latitude],
              rank: r.rank,
              color: color,
              severity: r.severity,
              coordinates_valid: isFinite(r.longitude) && isFinite(r.latitude)
            })

            // EXTRA VALIDATION
            if (!isFinite(r.longitude) || !isFinite(r.latitude)) {
              console.error(`❌ Invalid coordinates for marker ${index + 1}:`, r)
              return
            }

            const marker = new atlas.HtmlMarker({
              position: [r.longitude, r.latitude],
              zIndex: 3000, // Even higher z-index
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
                  position: relative;
                  ">
                  ${r.rank || (index + 1)}
                </div>
              `
            })

            marker.addEventListener('click', () => {
              const variable = mapData.azureData?.variable_info?.name || 'Value'
              const unit = mapData.azureData?.variable_info?.unit || ''
              
              console.log(`🖱️ Marker ${r.rank} clicked`)
              
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
              console.log(`✅ Marker ${index + 1} added successfully at [${r.longitude}, ${r.latitude}]`)
            } catch (error) {
              console.error(`❌ Failed to add marker ${index + 1}:`, error)
            }
          })

          console.log(`📍 Total markers added: ${markers.length}`)

          // FORCE camera to region bounds
          const lats = extremeRegions.map((d: any) => d.latitude).filter(lat => isFinite(lat))
          const lngs = extremeRegions.map((d: any) => d.longitude).filter(lng => isFinite(lng))
          
          if (lats.length > 0 && lngs.length > 0) {
            console.log('📱 FORCING map bounds to regions:', {
              bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
              center: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2],
              zoom: 9
            })
            
            // Force immediate camera change
            map.setCamera({
              bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
              padding: 100
            })
          }

          // Debug: Verify marker positions after 3 seconds
          setTimeout(() => {
            console.log('🔍 FINAL Marker verification:')
            console.log('- Map ready:', map.isReady())
            console.log('- Total markers in map:', map.markers.getMarkers().length)
            console.log('- Map center:', map.getCamera().center)
            console.log('- Map zoom:', map.getCamera().zoom)
            
            const mapMarkers = map.markers.getMarkers()
            mapMarkers.forEach((marker: any, idx: number) => {
              console.log(`- Marker ${idx + 1} position:`, marker.getOptions().position)
            })

            if (mapMarkers.length <= 1) { // Only test marker
              console.error('🚨 STILL NO MARKERS! Last resort attempt...')
              
              // Add giant visible test markers at exact coordinates from your response
              const testCoords = [
                [-79.45499420166016, 38.92499923706055],
                [-79.41500091552734, 38.93499755859375],
                [-79.41500091552734, 38.92499923706055]
              ]
              
              testCoords.forEach((coord, idx) => {
                const lastResortMarker = new atlas.HtmlMarker({
                  position: coord,
                  htmlContent: `<div style="width:60px;height:60px;background:lime;border:5px solid red;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:black;">${idx + 1}</div>`
                })
                map.markers.add(lastResortMarker)
                console.log(`🚨 Last resort marker ${idx + 1} added at`, coord)
              })
            }
          }, 3000)

          // Cleanup
          map.events.addOnce('remove', () => {
            console.log('🧹 Cleaning up markers')
            markers.forEach(m => map.markers.remove(m))
          })
        }

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