import type { Frame, TrackPoint } from './types'

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)

export const CSV_COLUMNS: Array<[string, (f: Frame) => string | number | null]> = [
  ['time_iso', (f) => new Date(f.t).toISOString()],
  ['source', (f) => f.source],
  ['device', (f) => f.dev],
  ['seq', (f) => f.seq],
  ['uptime_s', (f) => f.up],
  ['flags', (f) => f.flags],
  ['gps_fix', (f) => f.gps.fix],
  ['gps_sats', (f) => f.gps.sats],
  ['gps_hdop', (f) => f.gps.hdop],
  ['lat', (f) => f.gps.lat.toFixed(7)],
  ['lon', (f) => f.gps.lon.toFixed(7)],
  ['gps_alt_m', (f) => f.gps.alt],
  ['speed_kmh', (f) => f.gps.spd],
  ['heading_deg', (f) => f.gps.hdg],
  ['gps_utc', (f) => f.gps.utc],
  ['baro_alt_m', (f) => f.baro.alt],
  ['vspeed_ms', (f) => f.baro.vs],
  ['pressure_hpa', (f) => f.env.p],
  ['temp_c', (f) => f.env.t],
  ['humidity_pct', (f) => f.env.h],
  ['co2_ppm', (f) => f.env.co2],
  ['voc_index', (f) => f.env.voc],
  ['nox_index', (f) => f.env.nox],
  ['lux', (f) => f.env.lux],
  ['ir_raw', (f) => f.env.ir],
  ['roll_deg', (f) => f.imu.roll],
  ['pitch_deg', (f) => f.imu.pitch],
  ['yaw_deg', (f) => f.imu.yaw],
  ['acc_x', (f) => f.imu.ax],
  ['acc_y', (f) => f.imu.ay],
  ['acc_z', (f) => f.imu.az],
  ['gyro_x', (f) => f.imu.gx],
  ['gyro_y', (f) => f.imu.gy],
  ['gyro_z', (f) => f.imu.gz],
  ['battery_v', (f) => f.sys.bat],
  ['battery_pct', (f) => f.sys.batPct],
  ['mcu_temp_c', (f) => f.sys.mcuT],
]

export function exportCsv(frames: Frame[]) {
  const header = CSV_COLUMNS.map(([k]) => k).join(',')
  const rows = frames.map((f) => CSV_COLUMNS.map(([, get]) => {
    const v = get(f)
    return v === null || v === undefined ? '' : typeof v === 'number' ? +v.toFixed(4) : `"${String(v).replace(/"/g, '""')}"`
  }).join(','))
  download(`rbb-telemetry-${stamp()}.csv`, 'text/csv', [header, ...rows].join('\n'))
}

export function exportJson(frames: Frame[]) {
  download(`rbb-telemetry-${stamp()}.json`, 'application/json', JSON.stringify(frames, null, 1))
}

export function exportGpx(track: TrackPoint[], name = 'Rocket BlackBox track') {
  const pts = track
    .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.alt.toFixed(1)}</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n')
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Antariksha India Rocket BlackBox Dashboard" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${xml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
  download(`rbb-track-${stamp()}.gpx`, 'application/gpx+xml', gpx)
}

export function exportKml(track: TrackPoint[], name = 'Rocket BlackBox track') {
  const coords = track.map((p) => `${p.lon.toFixed(7)},${p.lat.toFixed(7)},${p.baroAlt.toFixed(1)}`).join(' ')
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(name)}</name>
    <Style id="track"><LineStyle><color>ffeed322</color><width>4</width></LineStyle></Style>
    <Placemark>
      <name>${xml(name)}</name>
      <styleUrl>#track</styleUrl>
      <LineString><altitudeMode>absolute</altitudeMode><coordinates>${coords}</coordinates></LineString>
    </Placemark>
  </Document>
</kml>
`
  download(`rbb-track-${stamp()}.kml`, 'application/vnd.google-earth.kml+xml', kml)
}
