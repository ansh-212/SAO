import React, { useRef, useCallback } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

/**
 * MagneticButton — wraps children in a magnetic hover zone.
 * The button body subtly levitates toward the cursor (max 10px).
 * Accepts variant="primary" | "ghost", size="md" | "lg".
 */
export default function MagneticButton({
    children,
    variant = 'primary',
    size = 'md',
    href,
    onClick,
    className = '',
    style = {},
}) {
    const ref = useRef(null)

    const springCfg = { stiffness: 200, damping: 20, mass: 0.5 }
    const x = useSpring(0, springCfg)
    const y = useSpring(0, springCfg)

    const handleMouseMove = useCallback((e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = (e.clientX - cx) * 0.35
        const dy = (e.clientY - cy) * 0.35
        x.set(dx)
        y.set(dy)
    }, [x, y])

    const handleMouseLeave = useCallback(() => {
        x.set(0)
        y.set(0)
    }, [x, y])

    const cls = [
        'lp-btn',
        variant === 'primary' ? 'lp-btn-primary' : 'lp-btn-ghost',
        size === 'lg' ? 'lp-btn-lg' : '',
        className,
    ].filter(Boolean).join(' ')

    const Tag = href ? 'a' : 'button'

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'inline-block' }}
        >
            <motion.div style={{ x, y, display: 'inline-block' }}>
                <Tag
                    href={href}
                    onClick={onClick}
                    className={cls}
                    style={style}
                >
                    {children}
                </Tag>
            </motion.div>
        </motion.div>
    )
}
