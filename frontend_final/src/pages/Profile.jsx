import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'
import '../styles/page-animations.css'

/**
 * Profile page — dark glassmorphic redesign.
 * Wraps in DarkLayout for WebGL background + dark sidebar.
 */

function SpotlightCard({ children, style = {}, className = '' }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    ref.current.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`)
    ref.current.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div ref={ref} className={`dk-spotlight-card ${className}`} onMouseMove={onMove} style={style}>
      {children}
    </div>
  )
}

export default function Profile() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', college: '', phone: '', bio: '', preferred_language: 'en' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/users/me').then(r => {
      setForm({
        name: r.data.name || '',
        college: r.data.college || '',
        phone: r.data.phone || '',
        bio: r.data.bio || '',
        preferred_language: r.data.preferred_language || 'en',
      })
    }).catch(() => { })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.put('/users/profile', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile')
    }
    setSaving(false)
  }

  const fields = [
    { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your full name', required: true },
    { label: 'Phone Number', key: 'phone', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
    { label: 'College / Institution', key: 'college', type: 'text', placeholder: 'e.g. AISSMS College of Engineering', full: true },
  ]

  return (
    <DarkLayout>
      <div className="dk-page" style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div className="dk-page-header">
          <h1>👤 My Profile</h1>
          <p>Manage your personal information and preferences.</p>
        </div>

        {/* Avatar card */}
        <SpotlightCard style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="dk-avatar-ring">
            {(form.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 4 }}>
              {form.name || 'User'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--dk-text-muted)', marginBottom: 10 }}>
              {user?.email} · {user?.role === 'admin' ? 'Administrator' : 'Student'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-primary">⚡ {user?.xp_points || 0} XP</span>
              <span className="badge badge-success">🔥 {user?.streak_days || 0} day streak</span>
            </div>
          </div>
        </SpotlightCard>

        <form onSubmit={handleSave}>
          {/* Personal info */}
          <SpotlightCard style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 20 }}>
              Personal Information
            </h4>
            <div className="dk-stagger-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {fields.slice(0, 2).map(f => (
                <div key={f.key} className="dk-form-group">
                  <label className="dk-label">{f.label}</label>
                  <input
                    type={f.type}
                    className="dk-input"
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            <div className="dk-form-group" style={{ marginBottom: 14 }}>
              <label className="dk-label">College / Institution</label>
              <input className="dk-input" value={form.college}
                onChange={e => setForm(p => ({ ...p, college: e.target.value }))}
                placeholder="e.g. AISSMS College of Engineering" />
            </div>
            <div className="dk-form-group" style={{ marginBottom: 14 }}>
              <label className="dk-label">Bio</label>
              <textarea className="dk-input" value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                placeholder="Tell us about yourself..." rows={3}
                style={{ resize: 'vertical', minHeight: 80 }} />
            </div>
            <div className="dk-form-group">
              <label className="dk-label">Preferred Language</label>
              <select className="dk-input" value={form.preferred_language}
                onChange={e => setForm(p => ({ ...p, preferred_language: e.target.value }))}
                style={{ cursor: 'pointer' }}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
            </div>
          </SpotlightCard>

          {/* Account info (read-only) */}
          <SpotlightCard style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>
              Account Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[{ label: 'Email Address', val: user?.email }, { label: 'Role', val: user?.role === 'admin' ? 'Administrator' : 'Student' }].map(f => (
                <div key={f.label} className="dk-form-group">
                  <label className="dk-label">{f.label}</label>
                  <input className="dk-input" value={f.val || ''} disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginTop: 10 }}>
              Contact support to update your email address or role.
            </p>
          </SpotlightCard>

          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div className="dk-alert dk-alert-error" style={{ marginBottom: 14 }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ⚠️ {error}
              </motion.div>
            )}
            {saved && (
              <motion.div className="dk-alert dk-alert-success" style={{ marginBottom: 14 }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ✅ Profile updated successfully!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="dk-btn dk-btn-ghost"
              onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="dk-btn-glow" disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </DarkLayout>
  )
}
