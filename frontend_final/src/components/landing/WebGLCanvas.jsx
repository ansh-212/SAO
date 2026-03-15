import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdditiveBlending } from 'three'
import * as THREE from 'three'

/**
 * WebGLCanvas — fixed Three.js galaxy particle field.
 * Accepts optional `particleCount` prop (default 2500 desktop, 600 mobile).
 * Hides on touch/mobile for performance. Context-loss safe.
 */

function seededRandom(seed) {
    let s = seed
    return function () {
        s = (s * 16807 + 0) % 2147483647
        return (s - 1) / 2147483646
    }
}

function ParticleField({ mouseRef, count }) {
    const meshRef = useRef()

    const { positions, colors, sizes } = useMemo(() => {
        const rand = seededRandom(42)
        const pos = new Float32Array(count * 3)
        const col = new Float32Array(count * 3)
        const sz = new Float32Array(count)
        const palette = [
            new THREE.Color('#6366f1'),
            new THREE.Color('#a855f7'),
            new THREE.Color('#22d3ee'),
            new THREE.Color('#818cf8'),
        ]
        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            const radius = rand() * 8 + 0.5
            const arm = Math.floor(rand() * 3) * ((Math.PI * 2) / 3)
            const spiralAngle = rand() * Math.PI * 2 + arm + radius * 0.15
            const spread = (rand() - 0.5) * 1.2
            pos[i3] = Math.cos(spiralAngle) * radius + (rand() - 0.5) * spread
            pos[i3 + 1] = (rand() - 0.5) * 2.5
            pos[i3 + 2] = Math.sin(spiralAngle) * radius + (rand() - 0.5) * spread
            const base = palette[Math.floor(rand() * palette.length)].clone()
            base.r += (rand() - 0.5) * 0.15
            base.g += (rand() - 0.5) * 0.15
            base.b += (rand() - 0.5) * 0.15
            col[i3] = base.r; col[i3 + 1] = base.g; col[i3 + 2] = base.b
            sz[i] = rand() < 0.05 ? rand() * 6 + 3 : rand() * 2.5 + 0.5
        }
        return { positions: pos, colors: col, sizes: sz }
    }, [count])

    const origPos = useMemo(() => new Float32Array(positions), [positions])
    const time = useRef(0)
    const lerped = useRef({ x: 0, y: 0 })

    useFrame((_, delta) => {
        if (!meshRef.current) return
        time.current += delta * 0.12

        const tm = mouseRef?.current ?? { nX: 0, nY: 0 }
        lerped.current.x += (tm.nX * 2.5 - lerped.current.x) * 0.04
        lerped.current.y += (tm.nY * 1.5 - lerped.current.y) * 0.04

        const pos = meshRef.current.geometry.attributes.position.array
        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            const ox = origPos[i3], oy = origPos[i3 + 1], oz = origPos[i3 + 2]
            const d = time.current + i * 0.002
            pos[i3] = ox + Math.sin(d * 0.7 + i) * 0.08
            pos[i3 + 1] = oy + Math.cos(d * 0.5 + i) * 0.06
            pos[i3 + 2] = oz + Math.sin(d * 0.6 + i * 0.5) * 0.07
            const dx = lerped.current.x - ox, dy = lerped.current.y - oy
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 3) {
                const f = (1 - dist / 3) * 0.3
                pos[i3] += dx * f * delta
                pos[i3 + 1] += dy * f * delta
            }
        }
        meshRef.current.geometry.attributes.position.needsUpdate = true
        meshRef.current.rotation.y = time.current * 0.06
        meshRef.current.rotation.x = Math.sin(time.current * 0.04) * 0.08
    })

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
                <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={count} itemSize={1} />
            </bufferGeometry>
            <pointsMaterial
                size={0.06} sizeAttenuation vertexColors transparent opacity={0.75}
                blending={AdditiveBlending} depthWrite={false}
            />
        </points>
    )
}

export default function WebGLCanvas({ mouseRef, particleCount }) {
    if (typeof window === 'undefined') return null
    if (window.matchMedia('(pointer: coarse)').matches) return null

    const count = particleCount ?? (window.innerWidth < 768 ? 600 : 2500)

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
            aria-hidden
        >
            <Canvas
                camera={{ position: [0, 0, 12], fov: 55, near: 0.1, far: 100 }}
                gl={{ antialias: false, alpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false }}
                dpr={Math.min(window.devicePixelRatio, 1.5)}
                style={{ width: '100%', height: '100%' }}
                onCreated={({ gl }) => {
                    // Handle context loss gracefully — don't throw
                    gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false)
                }}
            >
                <ParticleField mouseRef={mouseRef} count={count} />
            </Canvas>
        </div>
    )
}
