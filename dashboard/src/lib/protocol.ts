import type { Frame, SourceName } from './types'

// Binary protocol shared with firmware/src/telemetry_packet.{h,cpp}
export const MAGIC_R = 0x52 // 'R'
export const MAGIC_B = 0x42 // 'B' telemetry frame
export const MAGIC_A = 0x41 // 'A' command acknowledgement
export const MAGIC_C = 0x43 // 'C' uplink command
export const PROTOCOL_VERSION = 1
export const FRAME_SIZE = 88
export const ACK_SIZE = 9

export const Command = {
  PING: 0x01,
  LOG_START: 0x02,
  LOG_STOP: 0x03,
} as const
export type CommandCode = (typeof Command)[keyof typeof Command]

export const COMMAND_LABEL: Record<number, string> = {
  [Command.PING]: 'Ping',
  [Command.LOG_START]: 'Start flash logging',
  [Command.LOG_STOP]: 'Stop flash logging',
}

/** CRC-16/CCITT-FALSE, identical to Telemetry::crc16 in firmware */
export function crc16(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffff
  for (let i = start; i < end; i++) {
    crc ^= bytes[i] << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

const SOURCES: SourceName[] = ['NONE', 'MS5607', 'BME680', 'SCD40']
const pad = (n: number) => String(n).padStart(2, '0')

export function formatDeviceId(id: number): string {
  return `RBB-${id.toString(16).toUpperCase().padStart(4, '0')}`
}

export function decodeFrame(buf: Uint8Array, off: number, t = Date.now()): Frame | null {
  if (off + FRAME_SIZE > buf.length) return null
  if (buf[off] !== MAGIC_R || buf[off + 1] !== MAGIC_B || buf[off + 2] !== PROTOCOL_VERSION) return null
  const dv = new DataView(buf.buffer, buf.byteOffset + off, FRAME_SIZE)
  if (crc16(buf, off, off + FRAME_SIZE - 2) !== dv.getUint16(86, true)) return null

  const flags = dv.getUint16(11, true)
  const sources = dv.getUint8(50)
  const hasTime = (flags & (1 << 12)) !== 0
  return {
    t,
    source: 'lora',
    dev: formatDeviceId(dv.getUint16(3, true)),
    seq: dv.getUint16(5, true),
    up: dv.getUint32(7, true),
    flags,
    gps: {
      fix: dv.getUint8(13),
      sats: dv.getUint8(14),
      hdop: dv.getUint16(15, true) / 10,
      lat: dv.getInt32(17, true) / 1e7,
      lon: dv.getInt32(21, true) / 1e7,
      alt: dv.getInt32(25, true) / 100,
      spd: dv.getUint16(29, true) / 10,
      hdg: dv.getUint16(31, true) / 100,
      utc: hasTime ? `${pad(dv.getUint8(33))}:${pad(dv.getUint8(34))}:${pad(dv.getUint8(35))}` : null,
    },
    baro: {
      alt: dv.getInt32(36, true) / 100,
      vs: dv.getInt16(40, true) / 10,
      p: dv.getUint32(42, true) / 100,
    },
    env: {
      t: dv.getInt16(46, true) / 100,
      h: dv.getUint16(48, true) / 100,
      p: dv.getUint32(42, true) / 100,
      tSrc: SOURCES[(sources >> 4) & 3],
      hSrc: SOURCES[(sources >> 2) & 3],
      pSrc: SOURCES[sources & 3],
      co2: dv.getUint16(51, true),
      voc: dv.getUint16(53, true),
      nox: dv.getUint16(55, true),
      lux: dv.getFloat32(57, true),
      ir: dv.getUint16(61, true),
    },
    imu: {
      roll: dv.getInt16(63, true) / 10,
      pitch: dv.getInt16(65, true) / 10,
      yaw: dv.getUint16(67, true) / 10,
      ax: dv.getInt16(69, true) / 100,
      ay: dv.getInt16(71, true) / 100,
      az: dv.getInt16(73, true) / 100,
      gx: dv.getInt16(75, true) / 10,
      gy: dv.getInt16(77, true) / 10,
      gz: dv.getInt16(79, true) / 10,
      cal: [(dv.getUint8(81) >> 6) & 3, (dv.getUint8(81) >> 4) & 3, (dv.getUint8(81) >> 2) & 3, dv.getUint8(81) & 3],
    },
    sys: {
      bat: dv.getUint16(82, true) / 1000,
      batPct: dv.getUint8(84),
      mcuT: dv.getInt8(85),
    },
    link: { rssi: null, snr: null },
  }
}

export function encodeCommand(cmd: number, arg = 0): Uint8Array {
  const out = new Uint8Array(8)
  const dv = new DataView(out.buffer)
  out[0] = MAGIC_R
  out[1] = MAGIC_C
  out[2] = PROTOCOL_VERSION
  out[3] = cmd
  dv.setUint16(4, arg, true)
  dv.setUint16(6, crc16(out, 0, 6), true)
  return out
}

export type StreamEvent =
  | { kind: 'frame'; frame: Frame }
  | { kind: 'ack'; cmd: number; status: number; dev: string }
  | { kind: 'rssi'; rssi: number }
  | { kind: 'text'; text: string }

/**
 * Parser for raw LoRa payload bytes (possibly with the payload's DTU header).
 * The custom KISS serial layer is decoded separately in kiss.ts; frame magic
 * and CRC allow this parser to recover telemetry within each KISS data packet.
 */
export class LoRaStreamParser {
  private buf = new Uint8Array(0)
  private text = ''
  private expectRssi = false
  rssiByteEnabled = true

  push(chunk: Uint8Array, now = Date.now()): StreamEvent[] {
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf)
    merged.set(chunk, this.buf.length)
    const b = merged
    const events: StreamEvent[] = []
    let i = 0

    while (i < b.length) {
      if (this.expectRssi) {
        this.expectRssi = false
        // E22/DTU convention: RSSI(dBm) = -(256 - value)
        events.push({ kind: 'rssi', rssi: b[i] - 256 })
        i++
        continue
      }

      if (b[i] === MAGIC_R && i + 1 < b.length && (b[i + 1] === MAGIC_B || b[i + 1] === MAGIC_A)) {
        const isFrame = b[i + 1] === MAGIC_B
        const size = isFrame ? FRAME_SIZE : ACK_SIZE
        if (i + 2 < b.length && b[i + 2] === PROTOCOL_VERSION) {
          if (i + size > b.length) break // wait for the rest of the packet
          if (isFrame) {
            const frame = decodeFrame(b, i, now)
            if (frame) {
              this.flushText(events)
              events.push({ kind: 'frame', frame })
              i += size
              this.expectRssi = this.rssiByteEnabled
              continue
            }
          } else if (crc16(b, i, i + ACK_SIZE - 2) === (b[i + 7] | (b[i + 8] << 8))) {
            this.flushText(events)
            events.push({ kind: 'ack', cmd: b[i + 3], status: b[i + 4], dev: formatDeviceId(b[i + 5] | (b[i + 6] << 8)) })
            i += size
            this.expectRssi = this.rssiByteEnabled
            continue
          }
        } else if (i + 2 >= b.length) {
          break
        }
      }

      const c = b[i]
      if (c === 0x0a) {
        this.flushText(events)
      } else if (c >= 0x20 && c < 0x7f) {
        this.text += String.fromCharCode(c)
        if (this.text.length > 240) this.flushText(events)
      }
      i++
    }

    this.buf = b.slice(i)
    if (this.buf.length > 4096) this.buf = new Uint8Array(0)
    return events
  }

  private flushText(events: StreamEvent[]) {
    const line = this.text.trim()
    this.text = ''
    if (line) events.push({ kind: 'text', text: line })
  }

  reset() {
    this.buf = new Uint8Array(0)
    this.text = ''
    this.expectRssi = false
  }
}

/** Line-oriented JSON parser for a payload connected directly over USB CDC */
export class JsonLineParser {
  private decoder = new TextDecoder()
  private pending = ''

  push(chunk: Uint8Array, now = Date.now()): Array<StreamEvent | { kind: 'info'; info: Record<string, unknown> }> {
    this.pending += this.decoder.decode(chunk, { stream: true })
    const lines = this.pending.split(/\r?\n/)
    this.pending = lines.pop() ?? ''
    const out: Array<StreamEvent | { kind: 'info'; info: Record<string, unknown> }> = []
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('{')) {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>
          if (obj.type === 'telemetry') out.push({ kind: 'frame', frame: fromJson(obj, now) })
          else if (obj.type === 'info') out.push({ kind: 'info', info: obj })
          continue
        } catch {
          /* fall through to text */
        }
      }
      out.push({ kind: 'text', text: line.replace(/^#\s?/, '') })
    }
    return out
  }

  reset() {
    this.pending = ''
  }
}

type Json = Record<string, any>
const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const src = (v: unknown): SourceName => (SOURCES.includes(v as SourceName) ? (v as SourceName) : 'NONE')

export function fromJson(o: Json, t = Date.now()): Frame {
  const g = o.gps ?? {}
  const b = o.baro ?? {}
  const e = o.env ?? {}
  const m = o.imu ?? {}
  const s = o.sys ?? {}
  const cal = Array.isArray(m.cal) ? m.cal : [0, 0, 0, 0]
  return {
    t,
    source: 'usb',
    dev: String(o.dev ?? 'RBB-????'),
    fw: typeof o.fw === 'string' ? o.fw : undefined,
    seq: n(o.seq),
    up: n(o.up),
    flags: n(o.flags),
    gps: {
      fix: n(g.fix), sats: n(g.sats), hdop: n(g.hdop, 99.9), lat: n(g.lat), lon: n(g.lon),
      alt: n(g.alt), spd: n(g.spd), hdg: n(g.hdg), utc: typeof g.utc === 'string' ? g.utc : null,
    },
    baro: { alt: n(b.alt), vs: n(b.vs), p: n(b.p) },
    env: {
      t: n(e.t), h: n(e.h), p: n(e.p), tSrc: src(e.t_src), hSrc: src(e.h_src), pSrc: src(e.p_src),
      co2: n(e.co2), voc: n(e.voc), nox: n(e.nox), lux: n(e.lux), ir: n(e.ir),
    },
    imu: {
      roll: n(m.roll), pitch: n(m.pitch), yaw: n(m.yaw), ax: n(m.ax), ay: n(m.ay), az: n(m.az),
      gx: n(m.gx), gy: n(m.gy), gz: n(m.gz), cal: [n(cal[0]), n(cal[1]), n(cal[2]), n(cal[3])],
    },
    sys: { bat: n(s.bat), batPct: n(s.bat_pct), mcuT: n(s.mcu_t) },
    link: { rssi: null, snr: null },
  }
}
