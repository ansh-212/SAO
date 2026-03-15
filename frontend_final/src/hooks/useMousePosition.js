import { useState, useEffect, useCallback } from 'react'

/**
 * Tracks raw mouse {x, y} and normalized {nX, nY} (-1..1) coords.
 * Used by WebGLCanvas, CustomCursor, BentoGrid spotlight, MagneticButton.
 */
export function useMousePosition() {
    const [mouse, setMouse] = useState({ x: 0, y: 0, nX: 0, nY: 0 })

    const onMove = useCallback((e) => {
        const x = e.clientX
        const y = e.clientY
        const nX = (x / window.innerWidth) * 2 - 1
        const nY = -((y / window.innerHeight) * 2 - 1)
        setMouse({ x, y, nX, nY })
    }, [])

    useEffect(() => {
        window.addEventListener('mousemove', onMove, { passive: true })
        return () => window.removeEventListener('mousemove', onMove)
    }, [onMove])

    return mouse
}
