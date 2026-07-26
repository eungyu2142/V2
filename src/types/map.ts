export type NaverMapApi = {
  maps: {
    LatLng: new (latitude: number, longitude: number) => unknown
    Point: new (x: number, y: number) => unknown
    Map: new (element: HTMLElement, options: { center: unknown; zoom: number }) => {
      setCenter: (center: unknown) => void
      setZoom: (zoom: number) => void
      panTo?: (center: unknown, options?: { duration?: number }) => void
      morph?: (center: unknown, zoom?: number, options?: { duration?: number }) => void
    }
    Marker: new (options: { position: unknown; map: unknown; title?: string; icon?: string | { content: string } }) => { setMap: (map: unknown | null) => void }
    Event: { addListener: (target: unknown, eventName: string, listener: () => void) => void }
    TransCoord?: { fromTM128ToLatLng: (point: unknown) => { lat: () => number; lng: () => number } }
  }
}

declare global {
  interface Window { naver?: NaverMapApi }
}
