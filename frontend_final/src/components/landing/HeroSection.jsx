import React from 'react'
import { motion } from 'framer-motion'
import MagneticButton from './MagneticButton'
import TextType from './TextType'

/**
 * HeroSection — Properly centered full-screen hero.
 *
 * Layout: position:relative, min-height:100vh, display:flex,
 * flex-direction:column, align-items:center, justify-content:center.
 * The WebGLCanvas sits behind via position:fixed/z-index:-1 in Landing.jsx,
 * so it does NOT participate in this flex flow at all.
 *
 * Headline: static first line + TextType cycling dynamic suffix.
 */

const easeOutExpo = [0.16, 1, 0.3, 1]

const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, ease: easeOutExpo, delay },
    }),
}

const TYPEWRITER_PHRASES = [
    'with AI-Powered Depth.',
    'beyond Rote Memory.',
    'using Bloom\'s Taxonomy.',
    'not just what you Memorized.',
]

const STATS = [
    { value: '10+', label: 'Question Types' },
    { value: '100%', label: 'AI Evaluated' },
    { value: '3', label: 'Languages' },
    { value: 'Free', label: 'Forever' },
]

export default function HeroSection() {
    return (
        <section
            style={{
                position: 'relative',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '80px 24px 60px',
                overflow: 'hidden',
                /* No transform, no absolute children that shift flow */
            }}
        >
            {/* Ambient glow orbs — purely decorative, pointer-events:none */}
            <div className="lp-orb lp-orb-1" />
            <div className="lp-orb lp-orb-2" />
            <div className="lp-orb lp-orb-3" />

            {/* ── Content stack ── */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    maxWidth: '900px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0,
                }}
            >
                {/* Badge */}
                <motion.div
                    className="lp-hero-badge"
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: easeOutExpo }}
                >
                    <span className="lp-hero-badge-dot" />
                    Adaptive Interview Prep Platform
                </motion.div>

                {/* ── Headline row 1: static animated words ── */}
                <motion.h1
                    className="lp-hero-title"
                    style={{ marginBottom: 0, marginTop: 24 }}
                    initial={{ opacity: 0, y: 36 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.75, ease: easeOutExpo, delay: 0.15 }}
                >
                    Measure{' '}
                    <span className="lp-grad-text">Real Skills</span>
                </motion.h1>

                {/* ── Headline row 2: typewriter cycling suffix ── */}
                <motion.div
                    style={{
                        fontSize: 'clamp(2rem, 5.5vw, 5rem)',
                        fontWeight: 700,
                        letterSpacing: '-0.04em',
                        lineHeight: 1.05,
                        minHeight: '1.15em',  /* prevents layout shift while cycling */
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 28,
                        color: 'var(--lp-text)',
                        fontFamily: 'var(--lp-font)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55, duration: 0.5 }}
                >
                    <TextType
                        text={TYPEWRITER_PHRASES}
                        typingSpeed={65}
                        deletingSpeed={35}
                        pauseDuration={2400}
                        showCursor
                        cursorCharacter="_"
                        cursorBlinkDuration={0.5}
                        loop
                        className="lp-grad-text"
                    />
                </motion.div>

                {/* Subtitle */}
                <motion.p
                    className="lp-hero-subtitle"
                    variants={fadeUp}
                    custom={0.65}
                    initial="hidden"
                    animate="visible"
                    style={{ maxWidth: 600, margin: '0 auto 40px' }}
                >
                    Upload any PDF chapter — InterviewVault instantly generates{' '}
                    <strong>higher-order assessments</strong> aligned with Bloom's
                    Taxonomy. We evaluate critical thinking and synthesis, not rote memory.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    className="lp-hero-cta"
                    variants={fadeUp}
                    custom={0.8}
                    initial="hidden"
                    animate="visible"
                >
                    <MagneticButton variant="primary" size="lg" href="/register">
                        🚀 Start Free Assessment
                    </MagneticButton>
                    <MagneticButton variant="ghost" size="lg" href="/login">
                        📊 View Demo Dashboard
                    </MagneticButton>
                </motion.div>

                {/* Stats strip */}
                <motion.div
                    className="lp-stats-strip"
                    style={{ width: '100%' }}
                    variants={fadeUp}
                    custom={0.98}
                    initial="hidden"
                    animate="visible"
                >
                    {STATS.map((s) => (
                        <div key={s.value} className="lp-stat-item">
                            <div className="lp-stat-number lp-grad-text">{s.value}</div>
                            <div className="lp-stat-label">{s.label}</div>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Scroll hint */}
            <motion.div
                className="lp-hero-scroll-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8, duration: 0.8 }}
            >
                <div className="lp-scroll-mouse">
                    <div className="lp-scroll-wheel" />
                </div>
                <span>Scroll</span>
            </motion.div>
        </section>
    )
}
