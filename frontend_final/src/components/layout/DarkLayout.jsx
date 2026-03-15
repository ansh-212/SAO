import React, { useRef, useEffect } from 'react'
import { useMousePosition } from '../../hooks/useMousePosition'
import WebGLCanvas from '../landing/WebGLCanvas'
import DarkSidebar from './DarkSidebar'
import '../../styles/dashboard-dark.css'

/**
 * DarkLayout — global wrapper for all authenticated dashboard pages.
 * Provides:
 *  • Three.js particle canvas (fixed, behind everything, low particle count)
 *  • Dark glassmorphic sidebar
 *  • Main content pane with backdrop-filter glass panel
 *
 * Usage:
 *   <DarkLayout>
 *     <YourPageContent />
 *   </DarkLayout>
 */
export default function DarkLayout({ children }) {
    const mouse = useMousePosition()
    const mouseRef = useRef({ nX: 0, nY: 0 })

    useEffect(() => {
        mouseRef.current = { nX: mouse.nX, nY: mouse.nY }
    }, [mouse.nX, mouse.nY])

    return (
        <div
            className="dark-app"
            style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}
        >
            {/* WebGL particle field — subtle, fewer particles for perf */}
            <WebGLCanvas mouseRef={mouseRef} particleCount={900} />

            {/* Dark Sidebar */}
            <DarkSidebar />

            {/* Main content — glass panel */}
            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '32px',
                    overflowY: 'auto',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Frosted glass surface behind content */}
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        left: 240, /* sidebar width */
                        background: 'rgba(5, 5, 10, 0.55)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        zIndex: 0,
                        pointerEvents: 'none',
                    }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    )
}
