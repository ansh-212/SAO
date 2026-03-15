import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/client'

/**
 * ClassroomCard — shows classroom info, code chip, member count.
 * Admin variant: shows "Copy Code" + member count + real-time submission count.
 * Student variant: shows classroom name + a "View Assessments" toggle.
 */
export default function ClassroomCard({ classroom, variant = 'student', onCopyCode }) {
    const [copied, setCopied] = useState(false)

    const copyCode = () => {
        navigator.clipboard.writeText(classroom.class_code)
        setCopied(true)
        onCopyCode?.()
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <motion.div
            className="dk-card dk-card-accent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--dk-primary-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                        {variant === 'admin' ? '👑 Your Classroom' : '🎓 Enrolled'}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dk-text)', letterSpacing: '-0.02em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {classroom.name}
                    </h3>
                    {classroom.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)', lineHeight: 1.5 }}>
                            {classroom.description}
                        </p>
                    )}
                </div>
                {/* Active badge */}
                <span className="badge badge-success" style={{ flexShrink: 0, fontSize: '0.7rem' }}>
                    {classroom.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {classroom.member_count !== undefined && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--dk-text)' }}>{classroom.member_count}</span> member{classroom.member_count !== 1 ? 's' : ''}
                    </div>
                )}
                {classroom.assessment_count !== undefined && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--dk-text)' }}>{classroom.assessment_count}</span> assessments
                    </div>
                )}
                {classroom.submission_count !== undefined && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--dk-text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--dk-green)' }}>{classroom.submission_count}</span> submissions
                    </div>
                )}
            </div>

            {/* Class code chip (admin only) */}
            {variant === 'admin' && classroom.class_code && (
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', marginBottom: 7 }}>Share this code with students:</div>
                    <div
                        className="dk-code-chip"
                        onClick={copyCode}
                        title="Click to copy"
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && copyCode()}
                    >
                        {classroom.class_code}
                        <span style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', fontFamily: 'inherit', letterSpacing: 0 }}>
                            {copied ? '✓ Copied!' : '📋 Copy'}
                        </span>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
