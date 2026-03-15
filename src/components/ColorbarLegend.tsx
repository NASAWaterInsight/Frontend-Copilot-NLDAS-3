import React from 'react'

interface ColorbarLegendProps {
  vmin: number
  vmax: number
  cmap: string
  variable: string
  unit: string
  colors?: string[]
}

export default function ColorbarLegend({ 
  vmin, 
  vmax, 
  cmap, 
  variable, 
  unit,
  colors 
}: ColorbarLegendProps) {

  const getGradientCSS = (colormapName: string, colorArray?: string[]): string => {
    if (colorArray && colorArray.length > 0) {
      console.log(`🎨 Using ${colorArray.length} exact colors from backend for ${colormapName}`)
      const colorStops = colorArray.map((color, index) => {
        const position = (index / (colorArray.length - 1)) * 100
        return `${color} ${position}%`
      })
      return `linear-gradient(to top, ${colorStops.join(', ')})`
    }

    console.warn(`⚠️ No colors from backend, using hardcoded approximation for ${colormapName}`)
    const gradients: { [key: string]: string } = {
      'RdYlBu_r': 'linear-gradient(to top, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43, #d73027, #a50026)',
      'Blues': 'linear-gradient(to top, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)',
      'spi_custom': 'linear-gradient(to top, #8B0000, #CD0000, #FF0000, #FF4500, #FFA500, #FFFF00, #90EE90, #00FF00, #00CED1, #0000FF, #00008B)',
      'viridis': 'linear-gradient(to top, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde724)',
      'BrBG': 'linear-gradient(to top, #543005, #8c510a, #bf812d, #dfc27d, #f6e8c3, #f5f5f5, #c7eae5, #80cdc1, #35978f, #01665e, #003c30)',
      'RdBu': 'linear-gradient(to top, #053061, #2166ac, #4393c3, #92c5de, #d1e5f0, #f7f7f7, #fddbc7, #f4a582, #d6604d, #b2182b, #67001f)'
    }
    return gradients[colormapName] || gradients['viridis']
  }

  const formatValue = (val: number): string => {
    if (Math.abs(val) < 0.01 && val !== 0) {
      return val.toExponential(2)
    }
    return val.toFixed(2)
  }

  const numTicks = 6
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const fraction = i / (numTicks - 1)
    return vmin + fraction * (vmax - vmin)
  })

  const getDisplayName = (): string => {
    const nameMap: { [key: string]: string } = {
      'Tair': 'Temperature',
      'Rainf': 'Precipitation',
      'SPI3': 'Drought Index',
      'Wind_Speed': 'Wind Speed',
      'Qair': 'Humidity',
      'PSurf': 'Pressure',
      'Evap': 'Evapotranspiration',
      'ESoil': 'Soil Evaporation',
      'ECanop': 'Canopy Evap.',
      'TVeg': 'Transpiration',
      'PotEvap': 'Potential ET',
      'SoilM_0_10cm': 'Soil Moisture (0-10cm)',
      'SoilM_10_40cm': 'Soil Moisture (10-40cm)',
      'SoilM_40_100cm': 'Soil Moisture (40-100cm)',
      'SoilM_100_200cm': 'Soil Moisture (100-200cm)',
      'SoilT_0_10cm': 'Soil Temp (0-10cm)',
      'SoilT_10_40cm': 'Soil Temp (10-40cm)',
      'SoilT_40_100cm': 'Soil Temp (40-100cm)',
      'SoilT_100_200cm': 'Soil Temp (100-200cm)',
      'AvgSurfT': 'Surface Temp',
      'Qle': 'Latent Heat',
      'Qh': 'Sensible Heat',
      'Qg': 'Ground Heat',
      'Qs': 'Surface Runoff',
      'Qsb': 'Baseflow',
      'SWE': 'Snow Water Eq.',
      'SnowDepth': 'Snow Depth',
      'TWS': 'Total Water Storage',
      'GWS': 'Groundwater',
      'LAI': 'Leaf Area Index',
      'LWnet': 'Net Longwave',
      'SWnet': 'Net Shortwave',
      'VPD': 'Vapor Pressure Deficit',
      'WaterTableD': 'Water Table Depth',
      'LWdown': 'Longwave Down',
      'SWdown': 'Shortwave Down',
      'Wind_E': 'Wind (East)',
      'Wind_N': 'Wind (North)',
      'corn_yield': 'Corn Yield'
    }
    return nameMap[variable] || variable.replace(/_/g, ' ')
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-3 py-4 bg-black border-l border-gray-700">
      <div className="text-center mb-3">
        <div className="text-xs font-semibold text-gray-300 whitespace-nowrap">
          {getDisplayName()}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {unit && `(${unit})`}
        </div>
      </div>

      <div className="relative flex items-center">
        <div 
          className="w-5 rounded border border-gray-600"
          style={{ 
            height: '280px',
            background: getGradientCSS(cmap, colors)
          }}
        />

        <div className="relative ml-2" style={{ height: '280px' }}>
          {ticks.map((tick, idx) => {
            const position = ((ticks.length - 1 - idx) / (ticks.length - 1)) * 100
            return (
              <div
                key={idx}
                className="absolute flex items-center"
                style={{ 
                  top: `${position}%`,
                  transform: 'translateY(-50%)'
                }}
              >
                {/* Value label only - tick mark removed */}
                <span className="text-xs text-gray-300 whitespace-nowrap font-mono">
                  {formatValue(tick)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}