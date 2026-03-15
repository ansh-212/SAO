import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ─── Demo data ────────────────────────────────────────── */
const DEMO_TRACKS = [
    {
        id: 'frontend_dev', title: 'Frontend Developer', icon: '🎨',
        description: 'Master UI/UX, React, JavaScript, and Web Performance.',
        milestones: [
            { id: 'fe_1', title: 'Internet Fundamentals', topics: ['HTTP', 'DNS', 'Browsers'] },
            { id: 'fe_2', title: 'HTML, CSS & JS Core', topics: ['DOM', 'CSS Grid', 'ES6+'] },
            { id: 'fe_3', title: 'Frontend Frameworks', topics: ['React', 'State Management', 'Routing'] },
            { id: 'fe_4', title: 'Web Performance', topics: ['Optimization', 'Caching', 'Lighthouse'] },
            { id: 'fe_5', title: 'System Design (UI)', topics: ['Component Design', 'Scalability'] },
        ]
    },
    {
        id: 'backend_dev', title: 'Backend Developer', icon: '⚙️',
        description: 'Architect robust servers, APIs, and databases.',
        milestones: [
            { id: 'be_1', title: 'Language Core', topics: ['Python/Java', 'Data Structures', 'OOP'] },
            { id: 'be_2', title: 'Databases', topics: ['SQL', 'NoSQL', 'Indexing', 'ACID'] },
            { id: 'be_3', title: 'APIs & Communication', topics: ['REST', 'GraphQL', 'gRPC', 'WebSockets'] },
            { id: 'be_4', title: 'System Architecture', topics: ['Microservices', 'Message Queues', 'Caching'] },
            { id: 'be_5', title: 'Security & DevOps', topics: ['Auth', 'Docker', 'CI/CD'] },
        ]
    },
    {
        id: 'data_science', title: 'Data Scientist', icon: '📊',
        description: 'Discover insights through data modeling and machine learning.',
        milestones: [
            { id: 'ds_1', title: 'Math & Stats', topics: ['Linear Algebra', 'Probability', 'Calculus'] },
            { id: 'ds_2', title: 'Data Manipulation', topics: ['Pandas', 'NumPy', 'SQL'] },
            { id: 'ds_3', title: 'Machine Learning', topics: ['Regression', 'Classification', 'Clustering'] },
            { id: 'ds_4', title: 'Deep Learning', topics: ['Neural Networks', 'NLP', 'Computer Vision'] },
            { id: 'ds_5', title: 'Deployment', topics: ['Model Serving', 'MLOps'] },
        ]
    }
]

const DEMO_PROGRESS = {
    frontend_dev: {
        overall_progress: 40, milestones: [
            { id: 'fe_1', completed_topics: 3, total_topics: 3, percent_complete: 100, is_completed: true },
            { id: 'fe_2', completed_topics: 2, total_topics: 3, percent_complete: 66, is_completed: false },
            { id: 'fe_3', completed_topics: 1, total_topics: 3, percent_complete: 33, is_completed: false },
            { id: 'fe_4', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
            { id: 'fe_5', completed_topics: 0, total_topics: 2, percent_complete: 0, is_completed: false },
        ]
    },
    backend_dev: {
        overall_progress: 20, milestones: [
            { id: 'be_1', completed_topics: 2, total_topics: 3, percent_complete: 66, is_completed: false },
            { id: 'be_2', completed_topics: 1, total_topics: 4, percent_complete: 25, is_completed: false },
            { id: 'be_3', completed_topics: 0, total_topics: 4, percent_complete: 0, is_completed: false },
            { id: 'be_4', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
            { id: 'be_5', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
        ]
    },
    data_science: {
        overall_progress: 10, milestones: [
            { id: 'ds_1', completed_topics: 1, total_topics: 3, percent_complete: 33, is_completed: false },
            { id: 'ds_2', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
            { id: 'ds_3', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
            { id: 'ds_4', completed_topics: 0, total_topics: 3, percent_complete: 0, is_completed: false },
            { id: 'ds_5', completed_topics: 0, total_topics: 2, percent_complete: 0, is_completed: false },
        ]
    }
}

export default function Tracks() {
    const { isDemoMode } = useAuth()
    const [tracks, setTracks] = useState([])
    const [selectedTrack, setSelectedTrack] = useState(null)
    const [progress, setProgress] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (isDemoMode) {
            setTracks(DEMO_TRACKS)
            setLoading(false)
            return
        }
        api.get('/tracks').then(r => setTracks(r.data)).catch(() => setTracks(DEMO_TRACKS)).finally(() => setLoading(false))
    }, [isDemoMode])

    const openTrack = async (track) => {
        setSelectedTrack(track)
        if (isDemoMode) {
            setProgress(DEMO_PROGRESS[track.id] || { overall_progress: 0, milestones: [] })
            return
        }
        try {
            const r = await api.get(`/tracks/${track.id}/progress`)
            setProgress(r.data)
        } catch {
            setProgress(DEMO_PROGRESS[track.id] || { overall_progress: 0, milestones: [] })
        }
    }

    const milestoneColors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981']

    return (
        <DarkLayout>
            <div style={{ padding: '40px 32px', maxWidth: 1000, margin: '0 auto' }}>
                <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--dk-text)', marginBottom: 6, letterSpacing: '-0.03em' }}>
                    🛤️ Learning Tracks
                </motion.h1>
                <p style={{ fontSize: '0.88rem', color: 'var(--dk-text-muted)', marginBottom: 32 }}>
                    Choose a role-based roadmap and track your mastery of each milestone.
                </p>

                {/* Track Cards */}
                {!selectedTrack && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                        {tracks.map((track, i) => (
                            <motion.div
                                key={track.id}
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                onClick={() => openTrack(track)}
                                style={{
                                    padding: '28px 24px', borderRadius: 16, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    transition: 'all 0.25s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                            >
                                <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>{track.icon}</div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 6 }}>{track.title}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)', lineHeight: 1.5, marginBottom: 14 }}>{track.description}</p>
                                <div style={{ fontSize: '0.72rem', color: 'var(--dk-primary-light)', fontWeight: 600 }}>
                                    {track.milestones.length} milestones →
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Roadmap Detail */}
                <AnimatePresence>
                    {selectedTrack && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <button
                                onClick={() => { setSelectedTrack(null); setProgress(null) }}
                                style={{
                                    background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--dk-text-muted)',
                                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem', marginBottom: 24,
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--dk-primary)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                            >
                                ← Back to Tracks
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                                <span style={{ fontSize: '2.2rem' }}>{selectedTrack.icon}</span>
                                <div>
                                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--dk-text)' }}>{selectedTrack.title}</h2>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)' }}>{selectedTrack.description}</p>
                                </div>
                                {progress && (
                                    <div style={{
                                        marginLeft: 'auto', width: 56, height: 56, borderRadius: '50%',
                                        background: `conic-gradient(#6366f1 ${progress.overall_progress * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%', background: 'var(--dk-bg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--dk-text)',
                                        }}>
                                            {progress.overall_progress}%
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Roadmap Milestones */}
                            <div style={{ position: 'relative', paddingLeft: 24 }}>
                                {/* Connecting line */}
                                <div style={{
                                    position: 'absolute', left: 11, top: 12, bottom: 12, width: 2,
                                    background: 'linear-gradient(to bottom, #6366f1, #a855f7, #ec4899)',
                                    borderRadius: 2, opacity: 0.3,
                                }} />

                                {selectedTrack.milestones.map((ms, i) => {
                                    const msProgress = progress?.milestones?.find(m => m.id === ms.id)
                                    const isCompleted = msProgress?.is_completed
                                    const pct = msProgress?.percent_complete || 0
                                    const color = milestoneColors[i % milestoneColors.length]

                                    return (
                                        <motion.div
                                            key={ms.id}
                                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            style={{ position: 'relative', marginBottom: 20, paddingLeft: 28 }}
                                        >
                                            {/* Dot on line */}
                                            <div style={{
                                                position: 'absolute', left: -2, top: 14, width: 14, height: 14, borderRadius: '50%',
                                                background: isCompleted ? color : 'var(--dk-bg)',
                                                border: `3px solid ${isCompleted ? color : 'rgba(255,255,255,0.15)'}`,
                                                zIndex: 2, boxShadow: isCompleted ? `0 0 12px ${color}55` : 'none',
                                                transition: 'all 0.3s ease',
                                            }} />

                                            <div style={{
                                                padding: '18px 20px', borderRadius: 14,
                                                background: isCompleted ? `${color}08` : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${isCompleted ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>
                                                        {isCompleted ? '✅ ' : ''}{ms.title}
                                                    </h4>
                                                    <span style={{
                                                        fontSize: '0.68rem', padding: '3px 10px', borderRadius: 99,
                                                        background: `${color}15`, color: color, fontWeight: 600,
                                                    }}>
                                                        {pct}%
                                                    </span>
                                                </div>

                                                {/* Progress bar */}
                                                <div style={{
                                                    height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
                                                    marginBottom: 10, overflow: 'hidden',
                                                }}>
                                                    <motion.div
                                                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 0.8, delay: i * 0.12 }}
                                                        style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                                                    />
                                                </div>

                                                {/* Topic tags */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {ms.topics.map(topic => (
                                                        <span key={topic} style={{
                                                            fontSize: '0.7rem', padding: '3px 10px', borderRadius: 8,
                                                            background: 'rgba(255,255,255,0.04)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                            color: 'var(--dk-text-muted)',
                                                        }}>{topic}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DarkLayout>
    )
}
