
/**
 * Tile coordinate utilities for Azure Maps integration
 * Based on Mercantile library (same as backend)
 */

export interface TileCoordinate {
  x: number
  y: number
  z: number
}

export interface TileBounds {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Convert latitude/longitude to tile coordinates
 */
export function lonLatToTile(lon: number, lat: number, zoom: number): TileCoordinate {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
  
  return { x, y, z: zoom }
}

/**
 * Convert tile coordinates to lat/lng bounds
 */
export function tileToBounds(x: number, y: number, zoom: number): TileBounds {
  const n = Math.pow(2, zoom)
  const west = x / n * 360 - 180
  const east = (x + 1) / n * 360 - 180
  
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI
  
  return { north, south, east, west }
}

/**
 * Generate tile URLs for a given bounds and zoom level
 */
export function getTilesForBounds(
  bounds: TileBounds, 
  zoom: number, 
  tileUrlTemplate: string
): string[] {
  const nwTile = lonLatToTile(bounds.west, bounds.north, zoom)
  const seTile = lonLatToTile(bounds.east, bounds.south, zoom)
  
  const tiles: string[] = []
  
  for (let x = nwTile.x; x <= seTile.x; x++) {
    for (let y = nwTile.y; y <= seTile.y; y++) {
      const tileUrl = tileUrlTemplate
        .replace('{z}', zoom.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString())
      
      tiles.push(tileUrl)
    }
  }
  
  return tiles
}

/**
 * Test if a tile URL is accessible
 */
export async function testTileExists(tileUrl: string): Promise<boolean> {
  try {
    const response = await fetch(tileUrl, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get zoom level recommendation based on bounds size
 */
export function recommendZoomLevel(bounds: TileBounds): number {
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const maxSpan = Math.max(latSpan, lngSpan)
  
  if (maxSpan > 50) return 3      // Continental scale
  if (maxSpan > 20) return 4      // Multi-state
  if (maxSpan > 10) return 5      // State scale
  if (maxSpan > 5) return 6       // Regional
  if (maxSpan > 2) return 7       // Metropolitan
  if (maxSpan > 1) return 8       // City scale
  return 9                        // Local scale
}