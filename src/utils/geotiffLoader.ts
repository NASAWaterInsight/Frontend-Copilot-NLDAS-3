import * as atlas from 'azure-maps-control'

// Load required libraries for GeoTIFF processing
export async function loadGeoTiffLibraries() {
  const scripts = [
    'https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js',
    'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.min.js',
    'https://cdn.jsdelivr.net/npm/geotiff-geokeys-to-proj4@2022.9.7/main-dist.min.js'
  ]
  
  for (const src of scripts) {
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement('script')
      script.src = src
      document.head.appendChild(script)
      await new Promise(resolve => { script.onload = resolve })
    }
  }
}

// Load GeoTIFF overlay using Microsoft's official method
export async function loadGeoTiffOverlay(
  geotiffUrl: string, 
  map: atlas.Map,
  variable: string = 'spi',
  colormap?: any
): Promise<atlas.layer.ImageLayer | null> {
  console.log('🔧 ====== Microsoft Method with Projection Fix ======')
  console.log('GeoTIFF URL:', geotiffUrl)
  
  try {
    // Step 1: Load all required libraries
    console.log('Step 1: Loading libraries...')
    await loadGeoTiffLibraries()
    
    const GeoTIFF = (window as any).GeoTIFF
    const proj4 = (window as any).proj4
    const geokeysToProj4 = (window as any).geokeysToProj4
    
    if (!GeoTIFF) {
      console.error('❌ GeoTIFF library not loaded')
      return null
    }
    console.log('✅ Libraries loaded')
    
    // Step 2: Fetch GeoTIFF
    console.log('Step 2: Fetching GeoTIFF...')
    const response = await fetch(geotiffUrl)
    
    if (!response.ok) {
      console.error('❌ Failed to fetch GeoTIFF:', response.status)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    console.log('✅ Fetched:', (arrayBuffer.byteLength / 1024).toFixed(2), 'KB')
    
    // Step 3: Parse GeoTIFF
    console.log('Step 3: Parsing GeoTIFF...')
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    
    const width = image.getWidth()
    const height = image.getHeight()
    const samplesPerPixel = image.getSamplesPerPixel()
    
    console.log('✅ Parsed - Dimensions:', { width, height, samplesPerPixel })
    
    // Step 4: Get bounding box
    console.log('Step 4: Extracting bounding box...')
    const bounds = image.getBoundingBox()
    
    if (!bounds || bounds.length !== 4) {
      console.error('❌ No valid bounding box found')
      return null
    }
    
    console.log('📍 Raw bounds (original projection):', bounds)
    
    // Step 5: CRITICAL - Convert projection to WGS84
    console.log('Step 5: Converting projection to WGS84...')
    let minXY: number[]
    let maxXY: number[]
    
    if (proj4 && geokeysToProj4) {
      try {
        const geoKeys = image.getGeoKeys()
        console.log('🗺️ GeoKeys:', geoKeys)
        
        const projObj = geokeysToProj4.toProj4(geoKeys)
        console.log('🗺️ Source projection:', projObj.proj4)
        
        // Create projection transformer
        const projection = proj4('WGS84', projObj.proj4)
        
        // Transform corners from source projection to WGS84
        minXY = projection.inverse([bounds[0], bounds[1]])
        maxXY = projection.inverse([bounds[2], bounds[3]])
        
        console.log('✅ Converted to WGS84:')
        console.log('  - SW corner (min):', minXY)
        console.log('  - NE corner (max):', maxXY)
      } catch (projError) {
        console.warn('⚠️ Projection conversion failed, assuming already WGS84:', projError)
        minXY = [bounds[0], bounds[1]]
        maxXY = [bounds[2], bounds[3]]
      }
    } else {
      console.warn('⚠️ proj4 libraries not available, assuming WGS84')
      minXY = [bounds[0], bounds[1]]
      maxXY = [bounds[2], bounds[3]]
    }
    
    // Validate converted coordinates
    if (!minXY.every(isFinite) || !maxXY.every(isFinite)) {
      console.error('❌ Invalid projected coordinates:', { minXY, maxXY })
      return null
    }
    
    const bbox = [minXY[0], minXY[1], maxXY[0], maxXY[1]]
    console.log('📍 Final bbox for camera:', bbox)
    
    // Step 6: Read image data and convert to PNG
    console.log('Step 6: Converting to PNG...')
    let canvas: HTMLCanvasElement
    let pngUrl: string
    
    if (samplesPerPixel >= 3) {
      // GeoTIFF has RGB bands - use them directly
      console.log('📊 GeoTIFF has RGB bands, reading...')
      
      const pool = new GeoTIFF.Pool()
      const rgb = await image.readRGB({ pool })
      
      console.log('✅ RGB data loaded:', rgb.length, 'bytes')
      
      // Create canvas
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')!
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data
      
      // Copy RGB data to canvas
      let j = 0
      for (let i = 0; i < rgb.length; i += 3) {
        data[j] = rgb[i]       // Red
        data[j + 1] = rgb[i + 1] // Green
        data[j + 2] = rgb[i + 2] // Blue
        data[j + 3] = 255        // Alpha (fully opaque)
        j += 4
      }
      
      ctx.putImageData(imageData, 0, 0)
      pngUrl = canvas.toDataURL('image/png', 1.0)
      
      console.log('✅ RGB canvas created')
      
    } else {
      // Single band - apply colormap
      console.log('📊 Single band GeoTIFF, applying colormap...')
      
      const rasters = await image.readRasters()
      const values = rasters[0] as Float32Array
      
      console.log('✅ Raster data loaded:', values.length, 'values')
      
      // Find min/max for normalization
      let min = Infinity
      let max = -Infinity
      
      for (let i = 0; i < values.length; i++) {
        if (isFinite(values[i])) {
          min = Math.min(min, values[i])
          max = Math.max(max, values[i])
        }
      }
      
      console.log('📊 Value range:', { min, max })
      
      // Create canvas with colormap
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')!
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data
      
      // Apply colormap based on variable type
      for (let i = 0; i < values.length; i++) {
        const value = values[i]
        let r: number, g: number, b: number, a: number
        
        if (!isFinite(value)) {
          // Transparent for NaN/Infinity
          r = g = b = a = 0
        } else {
          // Normalize to 0-1
          const normalized = (value - min) / (max - min)
          
          // Apply colormap based on variable
          if (variable.toLowerCase().includes('temp')) {
            // Temperature: blue (cold) to red (hot)
            r = Math.floor(normalized * 255)
            g = Math.floor((1 - Math.abs(normalized - 0.5) * 2) * 255)
            b = Math.floor((1 - normalized) * 255)
            a = 204 // 80% opacity
          } else if (variable.toLowerCase().includes('precip') || variable.toLowerCase().includes('rain')) {
            // Precipitation: white to blue
            r = Math.floor((1 - normalized) * 255)
            g = Math.floor((1 - normalized) * 255)
            b = 255
            a = 204
          } else {
            // Default: simple gradient
            r = Math.floor(normalized * 255)
            g = Math.floor((1 - normalized) * 128)
            b = 128
            a = 204
          }
        }
        
        const pixelIndex = i * 4
        data[pixelIndex] = r
        data[pixelIndex + 1] = g
        data[pixelIndex + 2] = b
        data[pixelIndex + 3] = a
      }
      
      ctx.putImageData(imageData, 0, 0)
      pngUrl = canvas.toDataURL('image/png', 1.0)
      
      console.log('✅ Single-band canvas created with colormap')
    }
    
    // Step 7: Create corner coordinates (Microsoft's order)
    console.log('Step 7: Creating corner coordinates...')
    
    // CRITICAL: Must use exact order from Microsoft example
    const corners: [number, number][] = [
      [minXY[0], maxXY[1]],  // Top-left (Northwest)
      maxXY,                 // Top-right (Northeast) 
      [maxXY[0], minXY[1]],  // Bottom-right (Southeast)
      minXY                  // Bottom-left (Southwest)
    ]
    
    console.log('📍 Image corners (WGS84):', corners)
    
    // Step 8: Create ImageLayer with PNG
    console.log('Step 8: Creating ImageLayer...')
    
    const imageLayer = new atlas.layer.ImageLayer({
      url: pngUrl,
      coordinates: corners,
      opacity: 0.75,
      visible: true
    })
    
    console.log('✅ ImageLayer created')
    
    // Step 9: Add to map
    console.log('Step 9: Adding layer to map...')
    
    try {
      map.layers.add(imageLayer, 'labels')
      console.log('✅ Layer added below labels')
    } catch (err) {
      map.layers.add(imageLayer)
      console.log('✅ Layer added to top')
    }
    
    // Step 10: Zoom to bounds
    console.log('Step 10: Zooming to data...')
    map.setCamera({
      bounds: bbox,
      padding: 40
    })
    
    console.log('✅ ====== GEOTIFF OVERLAY COMPLETE ======')
    return imageLayer
    
  } catch (error: any) {
    console.error('❌ ====== GEOTIFF LOADING FAILED ======')
    console.error('Error:', error?.message)
    console.error('Stack:', error?.stack)
    return null
  }
}

// Create legend for the overlay
export function createDynamicLegend(variable: string, colormap?: any, unit?: string): HTMLElement {
  const legend = document.createElement('div')
  legend.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 12px;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 200px;
    border: 1px solid #ddd;
  `
  
  const title = document.createElement('div')
  const displayName = getVariableDisplayName(variable)
  title.textContent = `${displayName} ${unit ? `(${unit})` : ''}`
  title.style.fontWeight = 'bold'
  title.style.marginBottom = '8px'
  title.style.color = '#333'
  legend.appendChild(title)
  
  const info = document.createElement('div')
  info.style.fontSize = '11px'
  info.style.color = '#666'
  info.textContent = 'Converted GeoTIFF overlay'
  legend.appendChild(info)
  
  return legend
}

// Helper: Get display name for variable
function getVariableDisplayName(variable: string): string {
  const varMap: { [key: string]: string } = {
    'spi': 'SPI (Drought Index)',
    'temperature': 'Temperature',
    'temp': 'Temperature',
    'tair': 'Air Temperature',
    'precipitation': 'Precipitation',
    'precip': 'Precipitation',
    'rainf': 'Rainfall'
  }
  
  const key = variable.toLowerCase().replace(/[_\d]/g, '')
  return varMap[key] || variable.replace(/_/g, ' ')
}