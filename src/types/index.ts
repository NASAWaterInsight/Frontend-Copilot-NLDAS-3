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
      // Primary data sources
      geotiff_url?: string  // ✅ ADD THIS - Direct GeoTIFF URL
      static_url?: string   // PNG with legend
      overlay_url?: string  // Legacy overlay
      
      // Data arrays
      geojson?: {
        type: string
        features: Array<{
          type: string
          geometry: {
            type: string
            coordinates: [number, number]
          }
          properties: {
            value?: number
            spi?: number  // ✅ ADD THIS for SPI data
            variable?: string
            unit?: string
            [key: string]: any
          }
        }>
      }
      temperature_data?: Array<{
        latitude: number
        longitude: number
        value?: number
        spi?: number  // ✅ ADD THIS
        variable?: string
        unit?: string
      }>
      
      // Metadata
      variable_info?: {
        name: string
        unit: string
        displayName: string
      }
      bounds?: {
        north: number
        south: number
        east: number
        west: number
      }
      
      // Analysis results
      extreme_regions?: Array<{
        latitude: number
        longitude: number
        value: number
        rank?: number
        severity?: string
        location?: string
      }>
      analysis_type?: string
      
      // Backend response
      colormap?: any
      data_type?: string
      raw_response?: any
      
      // Legacy compatibility
      map_config?: any
      weather_data?: any
      legend?: any
    }
  }
  
  export interface Message {
    id: string
    role: 'user' | 'assistant'
    text: string
    imageUrl?: string
    mapData?: MapData
  }