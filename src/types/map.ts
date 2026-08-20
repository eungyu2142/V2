export type MapLatLngLiteral = {
  lat: number
  lng: number
}

export type NaverLatLng = {
  lat: () => number
  lng: () => number
}

export type NaverPoint = {
  x: number
  y: number
}

export type NaverMapListener = object

export type NaverMapInstance = {
  setCenter: (center: MapLatLngLiteral | NaverLatLng) => void
  setZoom: (zoom: number, effect?: boolean) => void
  getZoom: () => number
  panTo: (center: MapLatLngLiteral | NaverLatLng, options?: { duration?: number; easing?: string }) => void
  morph?: (center: MapLatLngLiteral | NaverLatLng, zoom: number, options?: { duration?: number; easing?: string }) => void
}

export type NaverMarker = {
  setMap: (map: NaverMapInstance | null) => void
  setZIndex: (zIndex: number) => void
}

export type NaverMapApi = {
  maps: {
    Map: new (element: HTMLElement, options: {
      center: MapLatLngLiteral | NaverLatLng
      zoom: number
      mapTypeControl?: boolean
      scaleControl?: boolean
      logoControl?: boolean
      mapDataControl?: boolean
      zoomControl?: boolean
      zoomControlOptions?: { position: unknown }
    }) => NaverMapInstance
    LatLng: new (latitude: number, longitude: number) => NaverLatLng
    Point: new (x: number, y: number) => NaverPoint
    Marker: new (options: {
      position: MapLatLngLiteral | NaverLatLng
      map: NaverMapInstance
      title?: string
      zIndex?: number
      icon?: {
        content: string
        anchor?: NaverPoint
      }
    }) => NaverMarker
    Event: {
      addListener: (target: object, eventName: string, listener: () => void) => NaverMapListener
      removeListener: (listener: NaverMapListener) => void
    }
    Position: {
      TOP_RIGHT: unknown
    }
  }
}

declare global {
  interface Window {
    naver?: NaverMapApi
  }
}
