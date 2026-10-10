import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import clsx from 'clsx'
import { Crosshair, Layers } from 'lucide-react'
import type { TrackPoint } from '../../lib/types'
import { useSettings } from '../../store/settings'
import { clock12 } from '../../lib/format'

export type MarkerStyle = 'pin' | 'dot' | 'labelled'

interface Props {
  track: TrackPoint[]
  position: { lat: number; lon: number; t?: number } | null
  markerStyle?: MarkerStyle
  showPath?: boolean
  timeLabels?: boolean
  scale?: boolean
  layersButton?: boolean
  locateButton?: boolean
  zoom?: number
  className?: string
}

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]

const pinIcon = (color: string) =>
  L.divIcon({
    className: '',
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))">
      <path d="M15 1C7.3 1 1.5 6.9 1.5 14.3 1.5 24.6 15 39 15 39s13.5-14.4 13.5-24.7C28.5 6.9 22.7 1 15 1z" fill="${color}" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/>
      <circle cx="15" cy="14.5" r="5.2" fill="#0b2231"/></svg>`,
  })

const dotIcon = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: `<div style="position:relative;width:26px;height:26px">
    <span class="pulse-ring" style="position:absolute;inset:0;border-radius:999px;background:rgba(59,130,246,.45)"></span>
    <span style="position:absolute;inset:4px;border-radius:999px;background:#3b82f6;border:3px solid #dbeafe;box-shadow:0 0 14px rgba(59,130,246,.9)"></span>
  </div>`,
})

const labelledIcon = (time: string) =>
  L.divIcon({
    className: '',
    iconSize: [112, 34],
    iconAnchor: [17, 17],
    html: `<div class="map-label current" style="display:flex;align-items:center;gap:8px;padding:5px 9px 5px 5px">
      <span style="display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#10b981;box-shadow:0 0 12px rgba(16,185,129,.8)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#052e24" stroke-width="3"><path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z"/><circle cx="12" cy="9" r="2.5" fill="#052e24"/></svg>
      </span>${time}</div>`,
  })

const timeLabelIcon = (time: string) =>
  L.divIcon({ className: '', iconSize: [80, 22], iconAnchor: [-10, 11], html: `<div class="map-label">${time}</div>` })

function lerpColor(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + ((((pb >> shift) & 255) - ((pa >> shift) & 255)) * t))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

function Follow({ position, follow, onUserMove, zoom }: { position: Props['position']; follow: boolean; onUserMove: () => void; zoom: number }) {
  const map = useMap()
  const [initialised, setInitialised] = useState(false)
  useMapEvents({ dragstart: onUserMove })
  useEffect(() => {
    if (!position) return
    if (!initialised) {
      map.setView([position.lat, position.lon], zoom, { animate: false })
      setInitialised(true)
    } else if (follow) {
      map.panTo([position.lat, position.lon], { animate: true, duration: 0.6 })
    }
  }, [map, position, follow, initialised, zoom])
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function TelemetryMap({
  track, position, markerStyle = 'pin', showPath = false, timeLabels = false,
  scale = false, layersButton = false, locateButton = false, zoom = 14, className,
}: Props) {
  const mapLayer = useSettings((s) => s.mapLayer)
  const update = useSettings((s) => s.update)
  const [follow, setFollow] = useState(true)

  const segments = useMemo(() => {
    if (!showPath || track.length < 2) return []
    const count = Math.min(80, track.length - 1)
    const step = (track.length - 1) / count
    const out: Array<{ pts: [number, number][]; color: string }> = []
    for (let s = 0; s < count; s++) {
      const a = Math.floor(s * step)
      const b = Math.min(track.length - 1, Math.floor((s + 1) * step))
      const pts = track.slice(a, b + 1).map((p) => [p.lat, p.lon] as [number, number])
      out.push({ pts, color: lerpColor('#22d3ee', '#34d399', s / count) })
    }
    return out
  }, [track, showPath])

  const labels = useMemo(() => {
    if (!timeLabels || track.length < 2) return []
    const span = track[track.length - 1].t - track[0].t
    const stepMs = Math.max(5, Math.ceil(span / 4 / 300_000) * 5) * 60_000
    const out: TrackPoint[] = [track[0]]
    let next = Math.ceil(track[0].t / stepMs) * stepMs
    for (const p of track) {
      if (p.t >= next) {
        const prev = out[out.length - 1]
        if (track[track.length - 1].t - p.t > stepMs / 2 && p.t - prev.t > stepMs / 2) out.push(p)
        next += stepMs
      }
    }
    return out
  }, [track, timeLabels])

  const icon = useMemo(() => {
    if (markerStyle === 'dot') return dotIcon
    if (markerStyle === 'labelled') return labelledIcon(position?.t ? clock12(position.t, false) : '--')
    return pinIcon('#3b82f6')
  }, [markerStyle, position?.t])

  return (
    <div className={clsx('absolute inset-0 isolate overflow-hidden', className)}>
      <MapContainer center={DEFAULT_CENTER} zoom={zoom} zoomControl attributionControl className="h-full w-full" scrollWheelZoom>
        {mapLayer === 'satellite' ? (
          <>
            <TileLayer
              key="sat"
              className="tiles-satellite"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Imagery &copy; Esri"
              maxZoom={19}
            />
            <TileLayer
              key="roads"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              opacity={0.3}
              maxZoom={19}
            />
            <TileLayer
              key="labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution="Labels &copy; Esri"
              maxZoom={19}
            />
          </>
        ) : (
          <>
            <TileLayer
              key="dark"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
              maxNativeZoom={16}
              maxZoom={19}
            />
            <TileLayer
              key="dark-ref"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={16}
              maxZoom={19}
            />
          </>
        )}
        {scale && <ScaleControl position="bottomleft" imperial metric />}

        {segments.map((s, i) => (
          <Polyline key={i} positions={s.pts} pathOptions={{ color: s.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {segments.length > 0 && (
          <CircleMarker center={[track[0].lat, track[0].lon]} radius={6} pathOptions={{ color: '#cffafe', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 }} />
        )}
        {labels.map((p) => (
          <Marker key={p.t} position={[p.lat, p.lon]} icon={timeLabelIcon(clock12(p.t, false))} interactive={false} />
        ))}
        {labels.slice(1).map((p) => (
          <CircleMarker key={`d${p.t}`} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: '#cffafe', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 }} />
        ))}
        {position && <Marker position={[position.lat, position.lon]} icon={icon} zIndexOffset={1000} />}

        <Follow position={position} follow={follow} onUserMove={() => setFollow(false)} zoom={zoom} />
      </MapContainer>

      {locateButton && (
        <button
          type="button"
          title="Re-centre on payload"
          onClick={() => setFollow(true)}
          className={clsx('absolute top-[82px] left-[10px] z-[500] grid size-[32px] place-items-center rounded-lg border border-white/15 bg-ink-850/90 text-slate-200 shadow-lg hover:bg-ink-700', follow && 'text-sky-300')}
        >
          <Crosshair className="size-4" />
        </button>
      )}
      {layersButton && (
        <button
          type="button"
          title={mapLayer === 'satellite' ? 'Switch to dark streets' : 'Switch to satellite'}
          onClick={() => update({ mapLayer: mapLayer === 'satellite' ? 'dark' : 'satellite' })}
          className="absolute right-3 bottom-8 z-[500] grid size-11 place-items-center rounded-lg border border-white/15 bg-ink-850/90 text-slate-100 shadow-lg hover:bg-ink-700"
        >
          <Layers className="size-5" />
        </button>
      )}
      {!follow && !locateButton && position && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 rounded-lg border border-white/15 bg-ink-850/90 px-2.5 py-1.5 text-xs text-slate-200 shadow-lg hover:bg-ink-700"
        >
          <Crosshair className="size-3.5" /> Follow
        </button>
      )}
    </div>
  )
}
