import React, { useRef, useCallback } from 'react'
import { motion, useSpring } from 'framer-motion'

/**
 * DkMagneticButton — dark-themed magnetic hover button for dashboard action items.
 * The button body subtly levitates toward the cursor (max ~10px).
 * Uses dk-btn classes from dashboard-dark.css.
 */
export default function DkMagneticButton({
    children,
    onClick,
    disabled = false,
    variant = 'primary',
    size = '',
    className = '',
    style = {},
    type = 'button',
}) {
    const ref = useRef(null)
    const springCfg = { stiffness: 250, damping: 22, mass: 0.4 }
    const x = useSpring(0, springCfg)
    const y = useSpring(0, springCfg)

    const handleMouseMove = useCallback((e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        x.set((e.clientX - cx) * 0.3)
        y.set((e.clientY - cy) * 0.3)
    }, [x, y])

    const handleMouseLeave = useCallback(() => {
        x.set(0)
        y.set(0)
    }, [x, y])

    const cls = [
        'dk-btn',
        `dk-btn-${variant}`,
        'dk-btn-magnetic',
        size ? `dk-btn-${size}` : '',
        className,
    ].filter(Boolean).join(' ')

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'inline-flex' }}
        >
            <motion.button
                type={type}
                onClick={onClick}
                disabled={disabled}
                className={cls}
                style={{ ...style, x, y }}
            >
                {children}
            </motion.button>
        </motion.div>
    )
}
