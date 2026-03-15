import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/client'

/**
 * JoinClassModal — student's "Join a Classroom" input.
 * Sends the 6-char class_code to POST /api/classrooms/join.
 * On success, calls onJoined(classroom) to update parent state.
 */
export default function JoinClassModal({ onClose, onJoined }) {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [joined, setJoined] = useState(null)

    const handleJoin = async (e) => {
        e.preventDefault()
        if (code.trim().length !== 6) {
            setError('Class code must be exactly 6 characters.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const res = await api.post('/classrooms/join', { class_code: code.trim().toUpperCase() })
            setJoined(res.data.classroom)
            onJoined(res.data.classroom)
        } catch (err) {
            setError(err?.response?.data?.detail || 'Invalid class code or already joined.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                }}
            />

            {/* Modal */}
            <motion.div
                style={{
                    position: 'relative', zIndex: 1,
                    background: 'rgba(8, 8, 18, 0.95)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 24, padding: 36,
                    width: '100%', maxWidth: 420,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.7)',
                }}
                initial={{ y: 32, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 16, scale: 0.97, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
                <h2 style={{
                    fontSize: '1.3rem', fontWeight: 700, color: '#f1f5f9',
                    letterSpacing: '-0.03em', marginBottom: 8,
                }}>
                    🎓 Join a Classroom
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
                    Enter the 6-character code your instructor shared to access their assessments.
                </p>

                <AnimatePresence mode="wait">
                    {joined ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ textAlign: 'center' }}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
                            <div style={{ fontWeight: 700, color: '#4ade80', fontSize: '1.05rem', marginBottom: 8 }}>
                                Joined Successfully!
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 24 }}>
                                You've joined <strong style={{ color: '#f1f5f9' }}>{joined.name}</strong>
                            </div>
                            <button
                                onClick={onClose}
                                className="dk-btn dk-btn-primary dk-btn-full"
                            >
                                View Classroom →
                            </button>
                        </motion.div>
                    ) : (
                        <motion.form key="form" onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="dk-form-group">
                                <label className="dk-label">Class Code</label>
                                <input
                                    className="dk-input"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                                    placeholder="e.g. XK94MZ"
                                    maxLength={6}
                                    style={{
                                        fontFamily: "'Geist Mono', monospace",
                                        fontSize: '1.3rem',
                                        textAlign: 'center',
                                        letterSpacing: '0.25em',
                                        textTransform: 'uppercase',
                                    }}
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="dk-alert dk-alert-error">⚠ {error}</div>
                            )}

                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="dk-btn dk-btn-ghost"
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="dk-btn dk-btn-primary"
                                    style={{ flex: 2 }}
                                    disabled={loading || code.length !== 6}
                                >
                                    {loading ? '⏳ Joining...' : '🎓 Join Classroom'}
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}
