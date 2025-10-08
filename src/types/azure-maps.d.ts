declare module 'azure-maps-control' {
  export namespace atlas {
    export class Map {
      constructor(container: HTMLElement | string, options: MapOptions)
      events: {
        add(eventType: string, callback: () => void): void
      }
      sources: {
        add(source: any): void
      }
      layers: {
        add(layer: any): void
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
    }

    export interface CameraOptions {
      bounds?: [number, number, number, number]
      padding?: number
    }

    export enum AuthenticationType {
      subscriptionKey = 'subscriptionKey'
    }

    export namespace source {
      export class DataSource {
        constructor()
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
    }

    export namespace data {
      export class Polygon {
        constructor(coordinates: number[][][])
      }
    }

    export class Shape {
      constructor(geometry: any)
    }
  }
}
