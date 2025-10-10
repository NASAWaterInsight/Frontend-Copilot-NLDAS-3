declare module 'azure-maps-control' {
  export namespace atlas {
    export class Map {
      constructor(container: HTMLElement | string, options: MapOptions)
      events: {
        add(eventType: string, target: any, callback: (e: any) => void): void
        add(eventType: string, callback: (e: any) => void): void
      }
      sources: {
        add(source: any): void
      }
      layers: {
        add(layer: any, beforeLayer?: string): void
      }
      setCamera(options: CameraOptions): void
      dispose(): void
    }

    export interface MapOptions {
      center?: [number, number]
      zoom?: number
      style?: string
      authOptions: {
        authType: AuthenticationType
        subscriptionKey: string
      }
      interactive?: boolean
      showLogo?: boolean
      showFeedbackLink?: boolean
      enableAccessibility?: boolean
      transformRequest?: any
    }

    export interface CameraOptions {
      bounds?: [number, number, number, number]
      padding?: number
      center?: [number, number]
      zoom?: number
      duration?: number
    }

    export enum AuthenticationType {
      subscriptionKey = 'subscriptionKey'
    }

    export namespace source {
      export class DataSource {
        constructor(id?: string, options?: any)
        add(data: any): void
      }
    }

    export namespace layer {
      export class ImageLayer {
        constructor(options: {
          url: string
          coordinates: number[][]
          opacity?: number
        })
      }

      export class SymbolLayer {
        constructor(source: any, id?: string, options?: any)
      }

      export class HeatMapLayer {
        constructor(source: any, id?: string, options?: any)
      }
    }

    export namespace data {
      export class Polygon {
        constructor(coordinates: number[][][])
      }

      export class Point {
        constructor(coordinates: [number, number])
      }

      export class Feature {
        constructor(geometry: any, properties?: any, id?: string | number)
        getProperties(): any
      }
    }

    export class Shape {
      constructor(geometry: any, id?: string | number, properties?: any)
      getProperties(): any
    }

    export class Popup {
      constructor(options?: {
        pixelOffset?: [number, number]
        closeButton?: boolean
        content?: string
        position?: [number, number]
      })
      setOptions(options: {
        content?: string
        position?: [number, number]
      }): void
      open(map: Map): void
      close(): void
    }
  }
}
