/** KISS framing used by the custom Waveshare USB dongle firmware. */
const FEND = 0xc0
const FESC = 0xdb
const TFEND = 0xdc
const TFESC = 0xdd

export const KISS_DATA = 0x00
export const KISS_HARDWARE = 0x06

export interface KissFrame {
  command: number
  body: Uint8Array
}

export function encodeKiss(command: number, body: Uint8Array = new Uint8Array()): Uint8Array {
  const out = [FEND, command]
  for (const byte of body) {
    if (byte === FEND) out.push(FESC, TFEND)
    else if (byte === FESC) out.push(FESC, TFESC)
    else out.push(byte)
  }
  out.push(FEND)
  return Uint8Array.from(out)
}

export class KissParser {
  private command: number | null = null
  private body: number[] = []
  private escaping = false

  push(chunk: Uint8Array): KissFrame[] {
    const frames: KissFrame[] = []
    for (let byte of chunk) {
      if (this.escaping) {
        this.escaping = false
        if (byte === TFEND) byte = FEND
        else if (byte === TFESC) byte = FESC
        else {
          this.command = null
          this.body = []
          continue
        }
      } else if (byte === FESC) {
        this.escaping = true
        continue
      } else if (byte === FEND) {
        if (this.command !== null) frames.push({ command: this.command, body: Uint8Array.from(this.body) })
        this.command = null
        this.body = []
        continue
      }

      if (this.command === null) this.command = byte
      else if (this.body.length < 1024) this.body.push(byte)
      else {
        this.command = null
        this.body = []
      }
    }
    return frames
  }

  reset() {
    this.command = null
    this.body = []
    this.escaping = false
  }
}

export function radioConfig(channel: number, bandwidth: number, sf: number, codingRate: number): Uint8Array {
  const out = new Uint8Array(10)
  const view = new DataView(out.buffer)
  view.setUint32(0, (850 + channel) * 1_000_000, true)
  view.setUint32(4, bandwidth * 1000, true)
  out[8] = sf
  out[9] = codingRate
  return out
}
