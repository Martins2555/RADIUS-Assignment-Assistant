import { useEffect, useRef } from 'react'
import { styles } from './styles.js'
import { LoaderMark } from './motion.jsx'

const HERO_PARTICLES = [
  { left: '8%', top: '30%', size: 5, delay: '0s' },
  { left: '88%', top: '24%', size: 4, delay: '1.2s' },
  { left: '16%', top: '78%', size: 6, delay: '2.1s' },
  { left: '82%', top: '74%', size: 5, delay: '0.6s' },
  { left: '50%', top: '4%', size: 4, delay: '1.8s' },
  { left: '60%', top: '94%', size: 4, delay: '2.6s' },
  { left: '30%', top: '10%', size: 3, delay: '3.1s' },
]

// 3D hero: orbiting rings around the floating logo. The whole scene tilts
// with your finger or mouse, and with the phone itself on Android.
export function Hero3D({ size = 230 }) {
  const stageRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const el = stageRef.current
    if (!el) return undefined
    let raf = 0
    const apply = (rx, ry) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', `${rx}deg`)
        el.style.setProperty('--tilt-y', `${ry}deg`)
      })
    }
    const onPointer = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      apply(-ny * 26, nx * 34)
    }
    const onOrient = (e) => {
      if (e.gamma == null) return
      const ry = Math.max(-25, Math.min(25, e.gamma)) * 0.9
      const rx = Math.max(-25, Math.min(25, (e.beta || 45) - 45)) * -0.9
      apply(rx, ry)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [])

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <div className="r3d-scene" style={{ transform: `scale(${size / 230})`, transformOrigin: 'top left' }}>
        <div className="r3d-glow" />
        <div className="r3d-stage" ref={stageRef}>
          <span className="r3d-ring r3d-ring-a" />
          <span className="r3d-ring r3d-ring-b" />
          <span className="r3d-ring r3d-ring-c" />
          {HERO_PARTICLES.map((d, i) => (
            <span key={i} className="r3d-dot" style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay }} />
          ))}
          <div className="r3d-core">
            <img src="/logo.png" alt="RADIUS" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Loading indicator. It used to be a spinning cube; it is now the Voxel Wave
// (see motion.jsx). The name stays Cube3D so every place that uses it keeps working.
export function Cube3D({ size = 20 }) {
  return <LoaderMark size={size} />
}

export function Logo({ small }) {
  if (!small) return <Hero3D />
  return (
    <div style={styles.logoWrapperSmall}>
      <img src="/logo.png" alt="RADIUS" style={styles.logo} />
    </div>
  )
}
