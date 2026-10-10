import { DemoSource } from './demo'
import { Command, COMMAND_LABEL, encodeCommand, JsonLineParser, LoRaStreamParser } from './protocol'
import { encodeKiss, KissParser, KISS_DATA, KISS_HARDWARE, radioConfig } from './kiss'
import { FLAG, type LinkMode } from './types'
import { useSettings, type DongleConfig } from '../store/settings'
import { useTelemetry } from '../store/telemetry'
import { toast } from '../components/ui/Toast'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const USB_VENDORS: Record<number, string> = {
  0x1a86: 'WCH CH34x',
  0x303a: 'Espressif ESP32-S3',
  0x10c4: 'Silicon Labs CP210x',
  0x0403: 'FTDI',
}

export const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator

/** Identifies whether a SerialPort matches the LoRa receiver hardware (Waveshare CH343 / WCH). */
export function isLoraPort(port: SerialPort): boolean {
  const info = port.getInfo()
  return info.usbVendorId === 0x1a86
}

/**
 * Finds the most suitable LoRa receiver port among granted serial ports.
 * Prioritizes Waveshare CH343 (1A86:55D3 / 55D4), then any WCH CH34x,
 * and falls back to a single attached non-payload port. Never picks the Espressif payload (0x303A).
 */
export function findLoraPort(ports: SerialPort[]): SerialPort | null {
  if (!ports.length) return null

  // 1. Exact match: Waveshare USB-TO-LoRa-HF (CH343 with PID 0x55D3 or 0x55D4)
  const ch343 = ports.find((p) => {
    const info = p.getInfo()
    return info.usbVendorId === 0x1a86 && (info.usbProductId === 0x55d3 || info.usbProductId === 0x55d4)
  })
  if (ch343) return ch343

  // 2. Any WCH CH34x adapter (vendor 0x1A86)
  const wch = ports.find((p) => p.getInfo().usbVendorId === 0x1a86)
  if (wch) return wch

  // 3. Exactly one non-payload port available (excluding Espressif payload 0x303A)
  const nonPayload = ports.filter((p) => p.getInfo().usbVendorId !== 0x303a)
  if (nonPayload.length === 1 && ports.length <= 2) {
    return nonPayload[0]
  }

  return null
}

/**
 * Owns the Web Serial port. In 'lora' mode the port is the Waveshare USB-TO-LoRa-HF dongle
 * (custom KISS firmware); in 'usb' mode it is the payload itself (JSON lines).
 */
class LinkController {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private keepReading = false
  private readLoop: Promise<void> | null = null
  private writeChain: Promise<void> = Promise.resolve()
  private loraParser = new LoRaStreamParser()
  private kissParser = new KissParser()
  private hardwareWaiter: { match: (body: Uint8Array) => boolean; resolve: (body: Uint8Array) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null
  private jsonParser = new JsonLineParser()
  private demo = new DemoSource()
  private mode: LinkMode | null = null
  private sawDiagnosticMenu = false
  private connecting = false
  private disconnecting = false
  private userDisconnected = false
  private autoConnectTimer: ReturnType<typeof setInterval> | null = null
  private autoConnectListenerAttached = false
  private lastAutoConnectError = 0
  busy = false

  get isDemo() {
    return this.demo.running
  }

  get isConnected() {
    return this.port !== null
  }

  resetUserDisconnected() {
    this.userDisconnected = false
    this.lastAutoConnectError = 0
  }

  startDemo() {
    const t = useTelemetry.getState()
    if (this.port) return
    t.resetSession()
    this.mode = 'demo'
    t.setConn({ status: 'connected', mode: 'demo', label: 'Simulated payload', connectedAt: Date.now(), lastFrameAt: null })
    t.log('sys', 'Demo data started')
    this.demo.start((f) => useTelemetry.getState().ingest(f))
  }

  stopDemo() {
    if (!this.demo.running) return
    this.demo.stop()
    const t = useTelemetry.getState()
    t.setConn({ status: 'disconnected', mode: null, label: '', connectedAt: null })
    t.log('sys', 'Demo data stopped')
  }

  async connect(mode: 'lora' | 'usb', existingPort?: SerialPort) {
    if (!serialSupported) throw new Error('Web Serial is not supported in this browser (use Chrome or Edge).')
    this.userDisconnected = false
    const port = existingPort ?? (await navigator.serial.requestPort())
    if (this.port === port && this.mode === mode && useTelemetry.getState().conn.status === 'connected') {
      return
    }
    await this.disconnect(false)
    this.demo.stop()

    // Reset writeChain and waiter state for the new port
    this.writeChain = Promise.resolve()
    this.busy = false
    this.hardwareWaiter = null

    const t = useTelemetry.getState()
    const settings = useSettings.getState()
    t.resetSession()
    t.setConn({ status: 'connecting', mode, label: '' })

    try {
      await port.open({ baudRate: settings.baud, bufferSize: 8192 })
    } catch (err) {
      t.setConn({ status: 'disconnected', mode: null })
      throw err
    }

    const info = port.getInfo()
    const vendor = info.usbVendorId !== undefined ? USB_VENDORS[info.usbVendorId] ?? `USB ${info.usbVendorId.toString(16)}` : 'Serial'
    const label = mode === 'lora' ? `USB-TO-LoRa-HF (${vendor})` : `Payload USB (${vendor})`

    this.port = port
    this.mode = mode
    this.sawDiagnosticMenu = false
    this.loraParser.reset()
    this.loraParser.rssiByteEnabled = false
    this.kissParser.reset()
    this.jsonParser.reset()
    t.setConn({ status: 'connected', mode, label, connectedAt: Date.now(), lastFrameAt: null, lastRxAt: null })
    t.log('sys', `Connected: ${label} @ ${settings.baud} baud`)

    port.addEventListener('disconnect', () => {
      useTelemetry.getState().log('sys', 'Device unplugged')
      void this.disconnect(false)
    })

    this.keepReading = true
    this.readLoop = this.runReadLoop(port)

    try {
      if (mode === 'lora' && settings.autoConfigureDongle) {
        // Wait 350ms for USB bridge and GD32F103 MCU to finish power-up handshake
        await sleep(350)
        try {
          await this.configureDongle(settings.dongle)
        } catch (cfgErr) {
          useTelemetry.getState().log('sys', `Receiver config notice: ${(cfgErr as Error).message}; listening on current modem settings`)
        }
      } else if (mode === 'usb') {
        await sleep(350)
        await this.write('i\n')
      }
    } catch (error) {
      if (!this.port?.readable) {
        await this.disconnect(false)
        throw error
      }
    }
  }

  async disconnect(manual = false) {
    if (manual) this.userDisconnected = true
    if (this.disconnecting) return
    this.disconnecting = true

    try {
      this.keepReading = false
      this.busy = false
      this.writeChain = Promise.resolve()

      if (this.hardwareWaiter) {
        clearTimeout(this.hardwareWaiter.timer)
        this.hardwareWaiter.reject(new Error('Receiver disconnected'))
        this.hardwareWaiter = null
      }

      const port = this.port
      this.port = null

      const reader = this.reader
      this.reader = null
      if (reader) {
        try {
          await reader.cancel()
        } catch {
          /* already closed */
        }
        try {
          reader.releaseLock()
        } catch {
          /* already released */
        }
      }

      if (this.readLoop) {
        await this.readLoop.catch(() => undefined)
        this.readLoop = null
      }

      if (port) {
        try {
          await port.close()
        } catch {
          /* port already gone */
        }
      }

      this.mode = null
      const t = useTelemetry.getState()
      t.setConn({ status: 'disconnected', mode: null, label: '', connectedAt: null })
      t.log('sys', 'Disconnected')
    } finally {
      this.disconnecting = false
    }
  }

  async autoConnectLora(targetPort?: SerialPort): Promise<boolean> {
    if (!serialSupported) return false
    if (this.port || this.connecting || this.demo.running) return false
    const settings = useSettings.getState()
    if (!settings.autoConnectLora) return false
    if (this.userDisconnected) return false

    // Back off repeated poll attempts only when polling blindly without a targeted port
    if (!targetPort && Date.now() - this.lastAutoConnectError < 2500) return false

    this.connecting = true
    try {
      const ports = await navigator.serial.getPorts()
      const candidates: SerialPort[] = []

      if (targetPort) {
        candidates.push(targetPort)
      }

      // Check ports in reverse order so the most recently attached port is tried first
      const reversed = [...ports].reverse()
      for (const p of reversed) {
        if (!candidates.includes(p)) {
          const info = p.getInfo()
          if (info.usbVendorId === 0x1a86) {
            candidates.push(p)
          }
        }
      }

      // Fallback: exactly one non-payload port available
      if (candidates.length === 0) {
        const nonPayload = reversed.filter((p) => p.getInfo().usbVendorId !== 0x303a)
        if (nonPayload.length === 1) {
          candidates.push(nonPayload[0])
        }
      }

      if (candidates.length === 0) return false

      let connected = false
      let lastErr: Error | null = null

      for (const cand of candidates) {
        try {
          await this.connect('lora', cand)
          connected = true
          toast('LoRa receiver connected', 'success')
          break
        } catch (err) {
          lastErr = err as Error
          // If this port candidate failed (e.g. stale handle), try next candidate
          continue
        }
      }

      if (!connected && lastErr) {
        this.lastAutoConnectError = Date.now()
        useTelemetry.getState().log('sys', `LoRa auto-connect: ${lastErr.message || 'could not open port'}`)
        return false
      }

      return connected
    } finally {
      this.connecting = false
    }
  }

  startAutoConnect() {
    if (!serialSupported) return

    if (!this.autoConnectListenerAttached) {
      this.autoConnectListenerAttached = true

      // Clean up cleanly on USB device removal
      navigator.serial.addEventListener('disconnect', (event) => {
        const port = (event as { port?: SerialPort }).port
        if (!port || port === this.port) {
          useTelemetry.getState().log('sys', 'Device unplugged')
          void this.disconnect(false)
        }
      })

      // Auto-connect as soon as device is plugged in
      navigator.serial.addEventListener('connect', async (event) => {
        this.userDisconnected = false
        this.lastAutoConnectError = 0
        // Settle delay for USB enumeration
        await sleep(350)
        const port = (event as { port?: SerialPort }).port
        if (port && isLoraPort(port)) {
          void this.autoConnectLora(port)
        } else {
          void this.autoConnectLora()
        }
      })

      window.addEventListener('focus', () => {
        if (!this.port && !this.userDisconnected && !this.connecting) {
          void this.autoConnectLora()
        }
      })
    }

    if (!this.autoConnectTimer) {
      this.autoConnectTimer = setInterval(() => {
        if (!this.port && !this.userDisconnected && !this.connecting && !this.demo.running) {
          void this.autoConnectLora()
        }
      }, 2000)
    }

    // Trigger initial check
    void this.autoConnectLora()
  }

  stopAutoConnect() {
    if (this.autoConnectTimer) {
      clearInterval(this.autoConnectTimer)
      this.autoConnectTimer = null
    }
  }

  private async runReadLoop(port: SerialPort) {
    while (this.keepReading && port.readable) {
      this.reader = port.readable.getReader()
      try {
        for (;;) {
          const { value, done } = await this.reader.read()
          if (done) break
          if (value) this.handleBytes(value)
        }
      } catch (err) {
        if (this.keepReading) useTelemetry.getState().log('sys', `Read error: ${(err as Error).message}`)
      } finally {
        this.reader.releaseLock()
        this.reader = null
      }
    }
  }

  private handleBytes(chunk: Uint8Array) {
    const t = useTelemetry.getState()
    const now = Date.now()
    t.setConn({ lastRxAt: now })

    if (this.mode === 'lora') {
      for (const packet of this.kissParser.push(chunk)) {
        if (packet.command === KISS_DATA) {
          this.loraParser.reset()
          const events = this.loraParser.push(packet.body, now)
          const hasBinaryFrame = events.some((ev) => ev.kind === 'frame' || ev.kind === 'ack')
          for (const ev of events) {
            if (ev.kind === 'frame') t.ingest(ev.frame)
            else if (ev.kind === 'text' && !hasBinaryFrame) t.log('rx', ev.text)
            else if (ev.kind === 'ack') {
              t.noteAck(ev.cmd, ev.status)
              t.log('rx', `ACK ${COMMAND_LABEL[ev.cmd] ?? `0x${ev.cmd.toString(16)}`} from ${ev.dev}: ${ev.status === 0 ? 'OK' : 'rejected'}`)
            }
          }
        } else if (packet.command === KISS_HARDWARE) {
          const body = packet.body
          if (body[0] === 0xf9 && body.length >= 3) {
            const rssi = (body[2] << 24) >> 24
            const snr = ((body[1] << 24) >> 24) / 4
            // Current dongle firmware can report invalid positive RSSI.
            if (rssi < 0) t.applyLinkMetrics(rssi, snr)
          }
          const waiter = this.hardwareWaiter
          if (waiter && body[0] === 0xf1) {
            clearTimeout(waiter.timer)
            this.hardwareWaiter = null
            waiter.reject(new Error(`Receiver rejected KISS command (code ${body[1] ?? '?'})`))
          } else if (waiter?.match(body)) {
            clearTimeout(waiter.timer)
            this.hardwareWaiter = null
            waiter.resolve(body)
          }
        }
      }
      return
    }

    for (const ev of this.jsonParser.push(chunk, now)) {
      if (ev.kind === 'frame') t.ingest(ev.frame)
      else if (ev.kind === 'info') t.setPayloadInfo(ev.info)
      else if (ev.kind === 'text') {
        t.log('rx', ev.text)
        // v1 diagnostic firmware: switch on its [j] dashboard JSON stream automatically
        if (!this.sawDiagnosticMenu && ev.text.includes('DIAGNOSTIC CONSOLE')) {
          this.sawDiagnosticMenu = true
          setTimeout(() => {
            if (!useTelemetry.getState().conn.lastFrameAt) void this.write('j')
          }, 1500)
        }
      }
    }
  }

  write(data: string | Uint8Array): Promise<void> {
    const port = this.port
    if (!port?.writable) return Promise.reject(new Error('Not connected'))
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    this.writeChain = this.writeChain
      .catch(() => undefined) // Prevent rejection in previous writes from breaking subsequent writes
      .then(async () => {
        if (!this.port?.writable) throw new Error('Not connected')
        const writer = this.port.writable.getWriter()
        try {
          await writer.write(bytes)
        } finally {
          writer.releaseLock()
        }
      })
    return this.writeChain
  }

  async sendConsole(text: string) {
    const t = useTelemetry.getState()
    t.log('tx', text)
    await this.write(this.mode === 'lora' ? encodeKiss(KISS_DATA, new TextEncoder().encode(text)) : text)
  }

  private async hardwareRequest(body: Uint8Array, match: (reply: Uint8Array) => boolean, retries = 2): Promise<Uint8Array> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (this.hardwareWaiter) {
        clearTimeout(this.hardwareWaiter.timer)
        this.hardwareWaiter = null
      }
      try {
        return await new Promise<Uint8Array>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (this.hardwareWaiter?.timer === timer) this.hardwareWaiter = null
            reject(new Error('Receiver did not answer KISS configuration command'))
          }, 1500)
          this.hardwareWaiter = { match, resolve, reject, timer }
          this.write(encodeKiss(KISS_HARDWARE, body)).catch((err) => {
            clearTimeout(timer)
            if (this.hardwareWaiter?.timer === timer) this.hardwareWaiter = null
            reject(err)
          })
        })
      } catch (error) {
        if (attempt === retries || !this.port) throw error
        await sleep(150)
      }
    }
    throw new Error('Receiver did not answer KISS configuration command')
  }

  /** Configures the custom KISS receiver and verifies the radio readback. */
  async configureDongle(cfg: DongleConfig) {
    if (this.mode !== 'lora') throw new Error('Connect the USB-TO-LoRa-HF receiver first')
    const t = useTelemetry.getState()
    this.busy = true
    try {
      const radio = radioConfig(cfg.channel, [125, 250, 500][cfg.bw], cfg.sf, cfg.cr + 4)
      t.log('sys', `Configuring KISS receiver: ${850 + cfg.channel} MHz, SF${cfg.sf}, BW${[125, 250, 500][cfg.bw]}k, CR4/${cfg.cr + 4}`)
      await this.hardwareRequest(Uint8Array.of(0x09, ...radio), (body) => body[0] === 0xf0)
      const readback = await this.hardwareRequest(Uint8Array.of(0x0b), (body) => body[0] === 0x8b)
      if (readback.length !== 11 || !radio.every((byte, i) => byte === readback[i + 1])) {
        throw new Error('Receiver radio settings did not match the requested configuration')
      }
      await this.hardwareRequest(Uint8Array.of(0x0a, cfg.power), (body) => body[0] === 0xf0)
      const power = await this.hardwareRequest(Uint8Array.of(0x0c), (body) => body[0] === 0x8c)
      if (power[1] !== cfg.power) throw new Error('Receiver TX power readback differs')
      const signal = await this.hardwareRequest(Uint8Array.of(0x19, cfg.rssiOutput ? 1 : 0), (body) => body[0] === 0x99)
      if (signal[1] !== (cfg.rssiOutput ? 1 : 0)) throw new Error('Receiver signal report setting differs')
      t.log('sys', 'KISS receiver configured and radio settings verified; listening for telemetry')
    } finally {
      this.busy = false
    }
  }

  async queryDongle() {
    if (this.mode !== 'lora') throw new Error('Connect the USB-TO-LoRa-HF receiver first')
    this.busy = true
    try {
      const reply = await this.hardwareRequest(Uint8Array.of(0x11), (body) => body[0] === 0x91)
      useTelemetry.getState().log('rx', `KISS receiver firmware version ${reply[1] ?? '?'} (${Array.from(reply.slice(1)).map((b) => b.toString(16).padStart(2, '0')).join(' ')})`)
    } finally {
      this.busy = false
    }
  }

  /** Sends an uplink command to the payload, retrying until it is acknowledged. */
  async sendCommand(cmd: number) {
    const t = useTelemetry.getState()
    const label = COMMAND_LABEL[cmd] ?? `0x${cmd.toString(16)}`

    if (this.mode === 'demo') {
      t.log('tx', `${label} (demo)`)
      t.setCommand({ cmd, sentAt: Date.now(), attempts: 1, status: 'acked', result: 0 })
      return
    }
    if (this.mode === 'usb') {
      const logging = ((t.live.latest?.flags ?? 0) & FLAG.LOGGING) !== 0
      const ascii = cmd === Command.PING ? 'i' : (cmd === Command.LOG_START) !== logging ? 'l' : ''
      t.log('tx', `${label} (USB)`)
      if (ascii) await this.write(ascii)
      t.setCommand({ cmd, sentAt: Date.now(), attempts: 1, status: 'acked', result: 0 })
      return
    }
    if (this.mode !== 'lora') throw new Error('Not connected')

    const packet = encodeCommand(cmd)
    for (let attempt = 1; attempt <= 3; attempt++) {
      t.setCommand({ cmd, sentAt: Date.now(), attempts: attempt, status: 'pending' })
      t.log('tx', `${label} over LoRa (attempt ${attempt})`)
      await this.write(encodeKiss(KISS_DATA, packet))
      t.noteCommandSent()
      const deadline = Date.now() + 3000
      while (Date.now() < deadline) {
        await sleep(100)
        const c = useTelemetry.getState().command
        if (c?.cmd === cmd && c.status === 'acked') return
      }
    }
    useTelemetry.getState().setCommand({ cmd, sentAt: Date.now(), attempts: 3, status: 'failed' })
    t.log('sys', `${label}: no acknowledgement from payload`)
  }
}

export const link = new LinkController()
