export type GoogleLatLngLiteral = {
  lat: number
  lng: number
}

export type GoogleMapsListener = {
  remove: () => void
}

export type GoogleMapInstance = {
  setCenter: (center: GoogleLatLngLiteral) => void
  setZoom: (zoom: number) => void
  getZoom: () => number | undefined
  panTo: (center: GoogleLatLngLiteral) => void
  addListener: (eventName: string, listener: () => void) => GoogleMapsListener
}

export type GoogleOverlayViewInstance = {
  setMap: (map: GoogleMapInstance | null) => void
  getPanes: () => { overlayMouseTarget: Element } | null
  getProjection: () => {
    fromLatLngToDivPixel: (position: GoogleLatLng) => { x: number; y: number } | null
  } | null
}

export type GoogleLatLng = {
  lat: () => number
  lng: () => number
}

export type GoogleMapApi = {
  maps: {
    Map: new (element: HTMLElement, options: {
      center: GoogleLatLngLiteral
      zoom: number
      clickableIcons?: boolean
      disableDefaultUI?: boolean
      fullscreenControl?: boolean
      gestureHandling?: string
      mapTypeControl?: boolean
      streetViewControl?: boolean
      zoomControl?: boolean
    }) => GoogleMapInstance
    LatLng: new (latitude: number, longitude: number) => GoogleLatLng
    OverlayView: new () => GoogleOverlayViewInstance
  }
}

export type GoogleHtmlMarker = {
  setMap: (map: GoogleMapInstance | null) => void
  setZIndex: (zIndex: number) => void
}

declare global {
  interface Window {
    google?: GoogleMapApi
    __exoGoogleMapsReady?: () => void
    gm_authFailure?: () => void
  }
}
