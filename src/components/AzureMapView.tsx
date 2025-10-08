
import React, { useEffect, useRef } from 'react'
import * as atlas from 'azure-maps-control'

interface AzureMapViewProps {
  mapData: {
    map_url: string
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
  }
  subscriptionKey: string
  height?: string
}

export default function AzureMapView({ mapData, subscriptionKey, height = '400px' }: AzureMapViewProps) {
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

    // Initialize the map
    const map = new atlas.Map(mapRef.current, {
      center: [center.lng, center.lat],
      zoom: mapData.zoom || 6,
      style: 'satellite_road_labels', // You can change this to 'road', 'satellite', etc.
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: subscriptionKey
      }
    })

    mapInstanceRef.current = map

    map.events.add('ready', () => {
      // Create data source for the image overlay
      const dataSource = new atlas.source.DataSource()
      map.sources.add(dataSource)

      // Add the image overlay
      if (mapData.map_url) {
        const imageCoordinates = [
          [bounds.west, bounds.north], // top-left
          [bounds.east, bounds.north], // top-right
          [bounds.east, bounds.south], // bottom-right
          [bounds.west, bounds.south]  // bottom-left
        ]

        const imageOverlay = new atlas.Shape(new atlas.data.Polygon([imageCoordinates]))
        dataSource.add(imageOverlay)

        // Add image layer
        const imageLayer = new atlas.layer.ImageLayer({
          url: mapData.map_url,
          coordinates: imageCoordinates,
          opacity: 0.8
        })

        map.layers.add(imageLayer)
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
  }, [mapData, subscriptionKey])

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%' }}
      className="rounded-md border"
    />
  )
}