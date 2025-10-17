declare module 'azure-maps-control' {
  export namespace atlas {
    export class Map {
      constructor(container: HTMLElement | string, options: MapOptions)
      events: {
        add(eventType: string, target: any, callback: (e: any) => void): void
        add(eventType: string, callback: (e: any) => void): void
        addOnce(eventType: string, callback: (e: any) => void): void
      }
      sources: {
        add(source: any): void
        getById(id: string): any
        remove(source: any): void
      }
      layers: {
        add(layer: any, beforeLayer?: string): void
        getLayers(): any[]
        remove(layer: any): void
      }
      markers: {
        add(marker: HtmlMarker | HtmlMarker[]): void
        remove(marker: HtmlMarker | HtmlMarker[]): void
        clear(): void
        getMarkers(): HtmlMarker[]
      }
      setCamera(options: CameraOptions): void
      getCamera(): { center: [number, number], zoom: number }
      getCanvasContainer(): HTMLElement
      getMapContainer(): HTMLElement
      isReady(): boolean
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

    export class HtmlMarker {
      constructor(options?: HtmlMarkerOptions)
      setOptions(options: HtmlMarkerOptions): void
      getOptions(): HtmlMarkerOptions
      addEventListener(type: string, listener: (e: any) => void): void
      removeEventListener(type: string, listener: (e: any) => void): void
      isVisible(): boolean
      getId(): string
    }

    export interface HtmlMarkerOptions {
      position?: [number, number]
      htmlContent?: string
      text?: string
      color?: string
      pixelOffset?: [number, number]
      anchor?: string
      popup?: Popup
      draggable?: boolean
      visible?: boolean
      zIndex?: number
    }

    export namespace source {
      export class DataSource {
        constructor(id?: string, options?: any)
        add(data: any): void
        clear(): void
        remove(data: any): void
      }
    }

    export namespace layer {
      export class ImageLayer {
        constructor(options: ImageLayerOptions)
        getOptions(): ImageLayerOptions
        getId(): string
      }

      export interface ImageLayerOptions {
        url: string
        coordinates: number[][]
        opacity?: number
        visible?: boolean
        minZoom?: number
        maxZoom?: number
      }

      export class SymbolLayer {
        constructor(source: any, id?: string, options?: any)
        getOptions(): any
        getId(): string
      }

      export class HeatMapLayer {
        constructor(source: any, id?: string, options?: any)
        getOptions(): any
        getId(): string
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
      constructor(options?: PopupOptions)
      setOptions(options: PopupOptions): void
      open(map: Map): void
      close(): void
    }

    export interface PopupOptions {
      pixelOffset?: [number, number]
      closeButton?: boolean
      content?: string
      position?: [number, number]
    }
  }
}
