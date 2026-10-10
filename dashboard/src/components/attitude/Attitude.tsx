import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Attitude {
  roll: number
  pitch: number
  yaw: number
}

type Builder = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => THREE.Object3D

const DEG = Math.PI / 180

// Sensor frame -> three.js: sensor Z (up) = three +Y, sensor X (nose) = three +Z, sensor Y = three +X
function targetQuaternion({ roll, pitch, yaw }: Attitude) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * DEG, -yaw * DEG, roll * DEG, 'YXZ'))
}

function textSprite(text: string, color: string, size = 0.34) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 84px Inter, system-ui, sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 68)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.scale.setScalar(size)
  return sprite
}

function useAttitudeScene(attitude: Attitude | null, build: Builder, cameraPos: [number, number, number]) {
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef(new THREE.Quaternion())

  useEffect(() => {
    if (attitude) target.current.copy(targetQuaternion(attitude))
  }, [attitude])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(...cameraPos)
    camera.lookAt(0, 0, 0)
    const body = build(scene, camera)

    const resize = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${h}px`
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    let raf = 0
    const tick = () => {
      body.quaternion.slerp(target.current, 0.12)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
    // Scene is built once; attitude flows in through the target ref
  }, [])

  return ref
}

function arrow(dir: THREE.Vector3, color: number, length = 1.55) {
  return new THREE.ArrowHelper(dir.normalize(), new THREE.Vector3(0, 0, 0), length, color, 0.16, 0.09)
}

const buildCube: Builder = (scene) => {
  const body = new THREE.Group()
  const box = new THREE.BoxGeometry(1.25, 1.25, 1.25)
  body.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x0f2b3d, transparent: true, opacity: 0.35, depthWrite: false })))
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.75 })))

  const axes: Array<[THREE.Vector3, number, string, string]> = [
    [new THREE.Vector3(0, 0, 1), 0xef4444, 'X', '#f87171'],
    [new THREE.Vector3(1, 0, 0), 0x22c55e, 'Y', '#4ade80'],
    [new THREE.Vector3(0, 1, 0), 0x3b82f6, 'Z', '#60a5fa'],
  ]
  for (const [dir, color, label, css] of axes) {
    body.add(arrow(dir.clone(), color))
    const s = textSprite(label, css)
    s.position.copy(dir.clone().multiplyScalar(1.82))
    body.add(s)
  }
  scene.add(body)
  return body
}

const buildPlane: Builder = (scene) => {
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(3, 5, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x93c5fd, 1.2)
  rim.position.set(-4, 2, -3)
  scene.add(rim)

  const white = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.35, roughness: 0.35 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.35 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.15 })

  const plane = new THREE.Group()
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 1.7, 32), white)
  fuselage.rotation.x = Math.PI / 2
  plane.add(fuselage)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16), white)
  nose.scale.set(1, 1, 2)
  nose.position.z = 0.85
  plane.add(nose)
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12), glass)
  cockpit.scale.set(1, 0.6, 1.6)
  cockpit.position.set(0, 0.09, 0.9)
  plane.add(cockpit)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 32), white)
  tail.rotation.x = -Math.PI / 2
  tail.position.z = -1.12
  plane.add(tail)

  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0.22)
  wingShape.lineTo(1.3, -0.2)
  wingShape.lineTo(1.3, -0.36)
  wingShape.lineTo(0, -0.28)
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.03, bevelEnabled: false })
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, white)
    wing.rotation.x = -Math.PI / 2
    wing.scale.x = side
    wing.position.set(0, -0.03, 0.05)
    plane.add(wing)
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.3, 24), blue)
    engine.rotation.x = Math.PI / 2
    engine.position.set(side * 0.52, -0.1, 0.1)
    plane.add(engine)
    const stab = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.025, 0.2), white)
    stab.position.set(side * 0.24, 0.02, -1.15)
    stab.rotation.y = side * 0.25
    plane.add(stab)
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.3), white)
  fin.position.set(0, 0.24, -1.12)
  fin.rotation.x = 0.35
  plane.add(fin)
  const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), blue)
  finTip.position.set(0, 0.42, -1.2)
  finTip.rotation.x = 0.35
  plane.add(finTip)
  plane.scale.setScalar(1.05)
  scene.add(plane)

  // Fixed gimbal rings (roll = green, pitch = blue, yaw = orange)
  const ring = (color: number, rotate: (m: THREE.Mesh) => void, radius = 1.62) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 12, 160), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }))
    rotate(m)
    scene.add(m)
    return m
  }
  ring(0x84cc16, () => undefined)
  ring(0x3b82f6, (m) => (m.rotation.y = Math.PI / 2))
  ring(0xf59e0b, (m) => (m.rotation.x = Math.PI / 2), 1.72)

  const marker = (color: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color }))
    m.scale.set(1, 1.8, 1)
    m.position.set(...pos)
    scene.add(m)
  }
  marker(0x84cc16, [0, 1.62, 0])
  marker(0x84cc16, [-1.62, 0, 0])
  marker(0x3b82f6, [0, 0, 1.62])
  marker(0x3b82f6, [0, 0, -1.62])
  marker(0xf59e0b, [0, 0, 1.72])
  marker(0xf59e0b, [1.72, 0, 0])
  return plane
}

export function AttitudeCube({ attitude, className }: { attitude: Attitude | null; className?: string }) {
  const ref = useAttitudeScene(attitude, buildCube, [3.7, 2.9, 4.2])
  return <div ref={ref} className={className} aria-label="3D orientation cube" role="img" />
}

export function AttitudePlane({ attitude, className }: { attitude: Attitude | null; className?: string }) {
  const ref = useAttitudeScene(attitude, buildPlane, [2.4, 2.3, 4.4])
  return <div ref={ref} className={className} aria-label="3D attitude model" role="img" />
}
