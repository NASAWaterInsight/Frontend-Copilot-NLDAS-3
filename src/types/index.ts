export interface MapData {
  map_url: string
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  center: {
    lat: number
    lng: number
  }
  zoom: number
  azureData?: {
    geojson?: {
      type: string
      features: Array<{
        type: string
        geometry: {
          type: string
          coordinates: [number, number]
        }
        properties: {
          value: number
          variable: string
          unit: string
        }
      }>
    }
    overlay_url?: string
    static_url?: string
    variable_info?: {
      name: string
      unit: string
      displayName: string
    }
    data_type?: string
    raw_response?: any
    // Legacy properties for backward compatibility
    map_config?: any
    temperature_data?: any
    weather_data?: any
    legend?: any

    // NEW: bounds supplied by backend for overlay placement (already used)
    bounds?: {
      north: number
      south: number
      east: number
      west: number
    }

    // NEW: drought analysis points (used by Chat/AzureMapView)
    drought_regions?: DroughtRegion[]
  }
}

// NEW: Drought region point schema
export interface DroughtRegion {
  latitude: number
  longitude: number
  spi_value: number
  rank?: number
  severity?: 'extreme drought' | 'severe drought' | 'moderate drought' | 'mild drought' | 'near normal' | string
  location?: string
}
