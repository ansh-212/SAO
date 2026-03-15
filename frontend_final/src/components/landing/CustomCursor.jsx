import React, { useEffect, useRef } from 'react'
import { motion, useSpring } from 'framer-motion'

/**
 * CustomCursor — replaces the OS cursor on desktop (pointer devices only).
 * Uses framer-motion spring for the trailing ring.
 * On hover over interactive elements, it expands with a mix-blend-mode effect.
 */
export default function CustomCursor() {
    const dotX = useRef(0)
    const dotY = useRef(0)
    const dotRef = useRef(null)
    const ringRef = useRef(null)

    const springCfg = { stiffness: 120, damping: 22, mass: 0.6 }
    const ringXSpring = useSpring(0, springCfg)
    const ringYSpring = useSpring(0, springCfg)
    const ringScale = useSpring(1, { stiffness: 200, damping: 25 })

    useEffect(() => {
        // Only activate on non-touch devices
        if (window.matchMedia('(pointer: coarse)').matches) return

        let animId

        const onMouseMove = (e) => {
            dotX.current = e.clientX
            dotY.current = e.clientY
            ringXSpring.set(e.clientX)
            ringYSpring.set(e.clientY)

            // Snap dot immediately via RAF
            cancelAnimationFrame(animId)
            animId = requestAnimationFrame(() => {
                if (dotRef.current) {
                    dotRef.current.style.transform = `translate(${dotX.current}px, ${dotY.current}px) translate(-50%, -50%)`
                }
            })
        }

        const onMouseEnterInteractive = () => ringScale.set(2.5)
        const onMouseLeaveInteractive = () => ringScale.set(1)
        const onMouseDown = () => ringScale.set(0.85)
        const onMouseUp = () => ringScale.set(1)

        window.addEventListener('mousemove', onMouseMove, { passive: true })
        window.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mouseup', onMouseUp)

        // Attach to all interactive elements
        const interactives = document.querySelectorAll('a, button, [data-cursor-expand]')
        interactives.forEach((el) => {
            el.addEventListener('mouseenter', onMouseEnterInteractive)
            el.addEventListener('mouseleave', onMouseLeaveInteractive)
        })

        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mouseup', onMouseUp)
            cancelAnimationFrame(animId)
        }
    }, [ringXSpring, ringYSpring, ringScale])

    return (
        <div className="lp-cursor" aria-hidden>
            {/* Dot — snaps instantly */}
            <div
                ref={dotRef}
                className="lp-cursor-dot"
                style={{ position: 'fixed', top: 0, left: 0, willChange: 'transform' }}
            />
            {/* Ring — springs behind */}
            <motion.div
                className="lp-cursor-ring"
                style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    x: ringXSpring,
                    y: ringYSpring,
                    scale: ringScale,
                    willChange: 'transform',
                }}
            />
        </div>
    )
}
