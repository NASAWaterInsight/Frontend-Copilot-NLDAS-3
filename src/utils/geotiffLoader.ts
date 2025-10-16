import * as atlas from 'azure-maps-control'

// Load GeoTIFF libraries dynamically
export async function loadGeoTiffLibraries() {
  if (!(window as any).GeoTIFF) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js'
    document.head.appendChild(script)
    
    return new Promise((resolve) => {
      script.onload = resolve
    })
  }
}

// Dynamic color mapping based on variable type and backend metadata
export function getVariableColor(value: number, variable: string, colormap?: any): [number, number, number] {
  // Handle NaN/null values
  if (isNaN(value) || value === null || value === undefined) {
    return [255, 255, 255] // White for no data
  }

  // Use backend-provided colormap if available
  if (colormap && colormap.colors && colormap.values) {
    return interpolateColormap(value, colormap.colors, colormap.values)
  }

  // Fallback to variable-specific color schemes
  const variableType = detectVariableType(variable)
  
  switch (variableType) {
    case 'spi':
    case 'drought':
      return getSPIColor(value)
    case 'temperature':
      return getTemperatureColor(value)
    case 'precipitation':
      return getPrecipitationColor(value) 
    case 'pressure':
      return getPressureColor(value)
    case 'wind':
      return getWindColor(value)
    case 'humidity':
      return getHumidityColor(value)
    case 'radiation':
      return getRadiationColor(value)
    case 'soil':
      return getSoilColor(value)
    default:
      return getGenericColor(value)
  }
}

// Interpolate backend-provided colormap
function interpolateColormap(value: number, colors: string[], values: number[]): [number, number, number] {
  if (values.length !== colors.length) {
    return [128, 128, 128] // Gray fallback
  }

  // Find position in colormap
  for (let i = 0; i < values.length - 1; i++) {
    if (value >= values[i] && value <= values[i + 1]) {
      const ratio = (value - values[i]) / (values[i + 1] - values[i])
      const color1 = hexToRgb(colors[i])
      const color2 = hexToRgb(colors[i + 1])
      
      return [
        Math.round(color1[0] + (color2[0] - color1[0]) * ratio),
        Math.round(color1[1] + (color2[1] - color1[1]) * ratio),
        Math.round(color1[2] + (color2[2] - color1[2]) * ratio)
      ]
    }
  }
  
  // Outside range - use nearest color
  if (value < values[0]) return hexToRgb(colors[0])
  return hexToRgb(colors[colors.length - 1])
}

// Convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [128, 128, 128]
}

// Detect variable type from name
function detectVariableType(variable: string): string {
  const varLower = variable.toLowerCase()
  
  if (varLower.includes('spi') || varLower.includes('drought')) return 'spi'
  if (varLower.includes('temp') || varLower.includes('tair')) return 'temperature'
  if (varLower.includes('rain') || varLower.includes('precip')) return 'precipitation'
  if (varLower.includes('press') || varLower.includes('psurf')) return 'pressure'
  if (varLower.includes('wind') || varLower.includes('uwind') || varLower.includes('vwind')) return 'wind'
  if (varLower.includes('humid') || varLower.includes('qair')) return 'humidity'
  if (varLower.includes('radiation') || varLower.includes('swdown') || varLower.includes('lwdown')) return 'radiation'
  if (varLower.includes('soil')) return 'soil'
  
  return 'generic'
}

// SPI-specific color mapping (existing)
function getSPIColor(spiValue: number): [number, number, number] {
  if (spiValue <= -2.0) return [139, 0, 0]        // Dark red (extreme drought)
  if (spiValue <= -1.5) return [255, 0, 0]        // Red (severe drought)
  if (spiValue <= -1.0) return [255, 140, 0]      // Orange (moderate drought)
  if (spiValue <= -0.5) return [255, 255, 0]      // Yellow (mild drought)
  if (spiValue <= 0.5) return [144, 238, 144]     // Light green (near normal)
  if (spiValue <= 1.0) return [0, 191, 255]       // Light blue (wet)
  if (spiValue <= 1.5) return [0, 0, 255]         // Blue (very wet)
  return [0, 0, 139]                               // Dark blue (extremely wet)
}

// Temperature color mapping (blue to red)
function getTemperatureColor(temp: number): [number, number, number] {
  // Assuming temp range -40°C to 50°C
  const normalized = Math.max(0, Math.min(1, (temp + 40) / 90))
  const r = Math.round(255 * normalized)
  const b = Math.round(255 * (1 - normalized))
  const g = Math.round(128 * Math.sin(normalized * Math.PI))
  return [r, g, b]
}

// Precipitation color mapping (white to blue)
function getPrecipitationColor(precip: number): [number, number, number] {
  // Assuming precip range 0 to 100 mm
  const normalized = Math.max(0, Math.min(1, precip / 100))
  const r = Math.round(255 * (1 - normalized))
  const g = Math.round(255 * (1 - normalized * 0.5))
  const b = 255
  return [r, g, b]
}

// Pressure color mapping (purple to yellow)
function getPressureColor(pressure: number): [number, number, number] {
  // Assuming pressure range 980 to 1040 hPa
  const normalized = Math.max(0, Math.min(1, (pressure - 980) / 60))
  const r = Math.round(128 + 127 * normalized)
  const g = Math.round(0 + 255 * normalized)
  const b = Math.round(128 * (1 - normalized))
  return [r, g, b]
}

// Wind color mapping (green to red)
function getWindColor(wind: number): [number, number, number] {
  // Assuming wind range 0 to 50 m/s
  const normalized = Math.max(0, Math.min(1, wind / 50))
  const r = Math.round(255 * normalized)
  const g = Math.round(255 * (1 - normalized))
  const b = 0
  return [r, g, b]
}

// Humidity color mapping (brown to cyan)
function getHumidityColor(humidity: number): [number, number, number] {
  // Assuming humidity range 0 to 1
  const normalized = Math.max(0, Math.min(1, humidity))
  const r = Math.round(139 * (1 - normalized))
  const g = Math.round(69 + 186 * normalized)
  const b = Math.round(19 + 236 * normalized)
  return [r, g, b]
}

// Radiation color mapping (black to yellow)
function getRadiationColor(radiation: number): [number, number, number] {
  // Assuming radiation range 0 to 1000 W/m²
  const normalized = Math.max(0, Math.min(1, radiation / 1000))
  const r = Math.round(255 * normalized)
  const g = Math.round(255 * normalized)
  const b = Math.round(100 * normalized)
  return [r, g, b]
}

// Soil color mapping (yellow to brown)
function getSoilColor(soil: number): [number, number, number] {
  // Assuming soil moisture 0 to 1
  const normalized = Math.max(0, Math.min(1, soil))
  const r = Math.round(255 - 100 * normalized)
  const g = Math.round(255 - 155 * normalized)
  const b = Math.round(0 + 139 * normalized)
  return [r, g, b]
}

// Generic color mapping (grayscale with color hints)
function getGenericColor(value: number): [number, number, number] {
  // Normalize assuming range -2 to 2
  const normalized = Math.max(0, Math.min(1, (value + 2) / 4))
  const base = Math.round(255 * normalized)
  return [base, base, Math.max(100, base)]
}

// Process GeoTIFF for Azure Maps overlay
export async function loadGeoTiffOverlay(
  geotiffUrl: string, 
  map: atlas.Map,
  variable: string = 'spi',
  colormap?: any
): Promise<atlas.layer.ImageLayer | null> {
  try {
    console.log('🗺️ Loading GeoTIFF overlay:', geotiffUrl)
    console.log('🎨 Variable:', variable, 'Colormap:', colormap)
    
    // Load GeoTIFF library
    await loadGeoTiffLibraries()
    const GeoTIFF = (window as any).GeoTIFF
    
    // Fetch GeoTIFF data
    const response = await fetch(geotiffUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoTIFF: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    
    // Get image dimensions and bounds
    const width = image.getWidth()
    const height = image.getHeight()
    const [west, south, east, north] = image.getBoundingBox()
    
    console.log('📊 GeoTIFF Info:', { width, height, bounds: [west, south, east, north] })
    
    // Read raster data (single band)
    const rasterData = await image.readRasters({ samples: [0] })
    const values = rasterData[0] // First band
    
    // Create canvas for visualization
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    
    // Color mapping based on variable type and backend colormap
    console.log('🎨 Applying dynamic color mapping for variable:', variable)
    
    let pixelIndex = 0
    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      const color = getVariableColor(value, variable, colormap)
      
      // Set RGBA values
      data[pixelIndex] = color[0]     // Red
      data[pixelIndex + 1] = color[1] // Green  
      data[pixelIndex + 2] = color[2] // Blue
      data[pixelIndex + 3] = isNaN(value) ? 0 : 200 // Alpha
      
      pixelIndex += 4
    }
    
    // Apply processed image data
    ctx.putImageData(imageData, 0, 0)
    const pngDataUrl = canvas.toDataURL('image/png')
    
    console.log('✅ GeoTIFF processed to PNG canvas with dynamic colors')
    
    // Create precise corner coordinates for Azure Maps
    const coordinates: [number, number][] = [
      [west, north],  // Top-left
      [east, north],  // Top-right  
      [east, south],  // Bottom-right
      [west, south]   // Bottom-left
    ]
    
    console.log('📍 Azure Maps coordinates:', coordinates)
    
    // Create image layer
    const imageLayer = new atlas.layer.ImageLayer({
      url: pngDataUrl,
      coordinates: coordinates,
      opacity: 0.7
    })
    
    // Add layer to map (below labels for visibility)
    try {
      map.layers.add(imageLayer, 'labels')
      console.log('✅ GeoTIFF overlay added to Azure Maps')
    } catch (error) {
      console.warn('⚠️ Adding below labels failed, adding to top:', error)
      map.layers.add(imageLayer)
    }
    
    return imageLayer
    
  } catch (error) {
    console.error('❌ GeoTIFF overlay failed:', error)
    return null
  }
}

// Create dynamic legend based on variable type and backend metadata
export function createDynamicLegend(variable: string, colormap?: any, unit?: string): HTMLElement {
  const legend = document.createElement('div')
  legend.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.9);
    padding: 10px;
    border-radius: 5px;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    z-index: 1000;
  `
  
  const title = document.createElement('div')
  title.textContent = `${getVariableDisplayName(variable)} ${unit ? `(${unit})` : ''}`
  title.style.fontWeight = 'bold'
  title.style.marginBottom = '5px'
  legend.appendChild(title)
  
  // Use backend colormap if available, otherwise use variable-specific legend
  const categories = colormap ? createColormapLegend(colormap) : getVariableLegendCategories(variable)
  
  categories.forEach(cat => {
    const item = document.createElement('div')
    item.style.cssText = 'display: flex; align-items: center; margin: 2px 0;'
    
    const colorBox = document.createElement('div')
    colorBox.style.cssText = `
      width: 15px; height: 15px; 
      background: ${cat.color}; 
      margin-right: 8px; 
      border: 1px solid #ccc;
    `
    
    const text = document.createElement('span')
    text.textContent = `${cat.label} ${cat.range ? `(${cat.range})` : ''}`
    text.style.fontSize = '11px'
    
    item.appendChild(colorBox)
    item.appendChild(text)
    legend.appendChild(item)
  })
  
  return legend
}

// Create legend from backend colormap
function createColormapLegend(colormap: any): Array<{label: string, color: string, range?: string}> {
  if (!colormap.colors || !colormap.values) return []
  
  return colormap.colors.map((color: string, index: number) => ({
    label: colormap.labels?.[index] || `Level ${index + 1}`,
    color: color,
    range: colormap.values[index]?.toString()
  }))
}

// Get variable-specific legend categories
function getVariableLegendCategories(variable: string): Array<{label: string, color: string, range?: string}> {
  const varType = detectVariableType(variable)
  
  switch (varType) {
    case 'spi':
      return [
        { label: 'Extreme Drought', color: '#8B0000', range: '≤ -2.0' },
        { label: 'Severe Drought', color: '#FF0000', range: '-1.5 to -2.0' },
        { label: 'Moderate Drought', color: '#FF8C00', range: '-1.0 to -1.5' },
        { label: 'Mild Drought', color: '#FFFF00', range: '-0.5 to -1.0' },
        { label: 'Near Normal', color: '#90EE90', range: '-0.5 to 0.5' },
        { label: 'Wet', color: '#00BFFF', range: '0.5 to 1.0' },
        { label: 'Very Wet', color: '#0000FF', range: '> 1.0' }
      ]
    case 'temperature':
      return [
        { label: 'Very Cold', color: '#0000FF', range: '< -20°C' },
        { label: 'Cold', color: '#4080FF', range: '-20 to 0°C' },
        { label: 'Cool', color: '#80C0FF', range: '0 to 15°C' },
        { label: 'Warm', color: '#FFE080', range: '15 to 30°C' },
        { label: 'Hot', color: '#FF8040', range: '30 to 40°C' },
        { label: 'Very Hot', color: '#FF0000', range: '> 40°C' }
      ]
    case 'precipitation':
      return [
        { label: 'No Rain', color: '#FFFFFF', range: '0 mm' },
        { label: 'Light Rain', color: '#C0E0FF', range: '0-5 mm' },
        { label: 'Moderate Rain', color: '#8080FF', range: '5-20 mm' },
        { label: 'Heavy Rain', color: '#4040FF', range: '20-50 mm' },
        { label: 'Very Heavy', color: '#0000FF', range: '> 50 mm' }
      ]
    default:
      return [
        { label: 'Low', color: '#404080', range: 'Min' },
        { label: 'Medium', color: '#8080C0', range: 'Mid' },
        { label: 'High', color: '#C0C0FF', range: 'Max' }
      ]
  }
}

// Get display name for variable
function getVariableDisplayName(variable: string): string {
  const varMap: { [key: string]: string } = {
    'spi': 'SPI (Drought Index)',
    'spi3': 'SPI-3 (3-Month Drought)',
    'tair': 'Air Temperature',
    'rainf': 'Precipitation',
    'psurf': 'Surface Pressure',
    'wind': 'Wind Speed',
    'qair': 'Humidity',
    'swdown': 'Solar Radiation',
    'soilmoi': 'Soil Moisture'
  }
  
  const key = variable.toLowerCase().replace(/[_\d]/g, '')
  return varMap[key] || variable.replace(/_/g, ' ').replace(/\d+/g, '').trim()
}
