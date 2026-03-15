import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import '../styles/page-animations.css'

/**
 * Portfolio page — dark glassmorphic redesign.
 * Submissions tab + Certificates tab with blockchain hash display.
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
    <div ref={ref} className={`dk-spotlight-card ${className} dk-submission-row`} onMouseMove={onMove} style={style}>
      {children}
    </div>
  )
}

const scoreColor = (s) => s >= 70 ? 'var(--dk-green)' : s >= 50 ? 'var(--dk-amber)' : 'var(--dk-red)'
const riskColor = (r) => ({ low: 'var(--dk-green)', medium: 'var(--dk-amber)', high: 'var(--dk-red)' }[r] || 'var(--dk-text-muted)')

export default function Portfolio() {
  const [submissions, setSubmissions] = useState([])
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('submissions')
  const [certGenerating, setCertGenerating] = useState(null)
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const loadData = () => {
    setLoading(true)
    Promise.all([api.get('/submissions/mine'), api.get('/certificates/mine')])
      .then(([subRes, certRes]) => { setSubmissions(subRes.data); setCertificates(certRes.data) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [])

  const handleGenerateCert = async (submissionId) => {
    setCertGenerating(submissionId)
    try {
      await api.post(`/certificates/generate/${submissionId}`)
      loadData(); setActiveTab('certificates')
    } catch (err) {
      alert(err.response?.data?.detail || 'Certificate generation failed')
    }
    setCertGenerating(null)
  }

  const avgScore = submissions.length > 0
    ? (submissions.reduce((a, s) => a + s.total_score, 0) / submissions.length).toFixed(0)
    : null

  if (loading) return (
    <DarkLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="dk-spinner" />
        <p style={{ color: 'var(--dk-text-muted)' }}>Loading portfolio...</p>
      </div>
    </DarkLayout>
  )

  return (
    <DarkLayout>
      <div className="dk-page">
        {/* Header */}
        <div className="dk-page-header">
          <h1>🗂 {user?.name?.split(' ')[0]}'s Portfolio</h1>
          <p>Your assessment history and verified certificates.</p>
        </div>

        {/* Summary stats */}
        <div className="dk-stagger-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { icon: '📝', iconClass: 'indigo', val: submissions.length, lbl: 'Assessments' },
            { icon: '🏅', iconClass: 'green', val: certificates.length, lbl: 'Certificates' },
            { icon: '📊', iconClass: 'amber', val: avgScore ? `${avgScore}%` : '—', lbl: 'Avg Score' },
          ].map(s => (
            <div key={s.lbl} className="dk-stat-card">
              <div className={`dk-stat-icon ${s.iconClass}`}>{s.icon}</div>
              <div className="dk-stat-info"><h3>{s.val}</h3><p>{s.lbl}</p></div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="dk-tab-bar">
          {[
            { key: 'submissions', label: `📝 Assessments (${submissions.length})` },
            { key: 'certificates', label: `🏅 Certificates (${certificates.length})` },
          ].map(tab => (
            <button key={tab.key} className={`dk-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Submissions */}
        <AnimatePresence mode="wait">
          {activeTab === 'submissions' && (
            <motion.div key="subs"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {submissions.length === 0 ? (
                <div className="dk-card" style={{ textAlign: 'center', padding: '52px 32px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>📭</div>
                  <p style={{ color: 'var(--dk-text-muted)', marginBottom: 20 }}>No assessments taken yet.</p>
                  <button className="dk-btn-glow" onClick={() => navigate('/student/dashboard')}>
                    🎓 Take Your First Assessment
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="dk-stagger-grid">
                  {submissions.map(s => (
                    <SpotlightCard key={s.id} style={{ gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '2rem' }}>{s.assessment_emoji || '📝'}</div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontWeight: 700, color: 'var(--dk-text)', marginBottom: 6 }}>{s.assessment_title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                            {new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: riskColor(s.risk_level) }}>
                            🛡 {s.risk_level} risk
                          </span>
                          {s.has_certificate && <span className="badge badge-success">🏅 Certified</span>}
                        </div>
                      </div>
                      <div className="dk-score-badge">
                        <div className="val" style={{ color: scoreColor(s.total_score) }}>{s.total_score.toFixed(0)}%</div>
                        <div className="lbl">Score</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                        <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => navigate(`/result/${s.id}`)}>
                          {t('viewResults')}
                        </button>
                        {!s.has_certificate && s.total_score >= 40 && (
                          <button className="dk-btn dk-btn-primary dk-btn-sm"
                            onClick={() => handleGenerateCert(s.id)} disabled={certGenerating === s.id}>
                            {certGenerating === s.id ? '⏳...' : `🏅 ${t('generateCert')}`}
                          </button>
                        )}
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Certificates */}
          {activeTab === 'certificates' && (
            <motion.div key="certs"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {certificates.length === 0 ? (
                <div className="dk-card" style={{ textAlign: 'center', padding: '52px 32px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>🏅</div>
                  <p style={{ color: 'var(--dk-text-muted)', marginBottom: 20 }}>No certificates generated yet.</p>
                  <button className="dk-btn dk-btn-primary" onClick={() => setActiveTab('submissions')}>
                    View Submissions
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="dk-stagger-grid">
                  {certificates.map(c => (
                    <div key={c.id} className="dk-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div className="dk-cert-header">
                        <div>
                          <h4 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>{c.assessment_title}</h4>
                          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                            🔗 Blockchain Verified — SHA-256
                          </p>
                        </div>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔗</div>
                      </div>
                      <div style={{ padding: '20px 24px' }}>
                        <div className="dk-hash-block">
                          <div style={{ fontSize: 10, color: 'var(--dk-text-muted)', marginBottom: 3 }}>Certificate Hash (SHA-256)</div>
                          <div style={{ fontSize: 12, color: 'var(--dk-primary-light)', wordBreak: 'break-all', fontWeight: 600 }}>
                            0x{c.qr_hash}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                          {[{ k: 'Issued', v: new Date(c.issued_at).toLocaleDateString('en-IN') }, { k: 'Score', v: `${c.score?.toFixed(0)}%`, accent: true }, { k: 'Holder', v: user?.name }].map(f => (
                            <div key={f.k} className="dk-card" style={{ flex: 1, minWidth: 90, padding: '10px 14px', borderRadius: 12 }}>
                              <div style={{ fontSize: 10, color: 'var(--dk-text-muted)', marginBottom: 3 }}>{f.k}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: f.accent ? 'var(--dk-green)' : 'var(--dk-text)' }}>{f.v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <a href={c.cert_url} target="_blank" rel="noopener noreferrer"
                            className="dk-btn dk-btn-primary" style={{ flex: 1, textDecoration: 'none', minWidth: 130, justifyContent: 'center' }}>
                            📥 {t('downloadCert')}
                          </a>
                          <a href={`/api/certificates/verify/${c.qr_hash}`} target="_blank" rel="noopener noreferrer"
                            className="dk-btn dk-btn-ghost" style={{ flex: 1, textDecoration: 'none', minWidth: 130, justifyContent: 'center' }}>
                            🔍 {t('verifyOn')}
                          </a>
                        </div>
                        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, border: '1px dashed rgba(99,102,241,0.2)', fontSize: 11, color: 'var(--dk-text-muted)' }}>
                          Secured with SHA-256 hash + QR verification. Any modification invalidates the hash.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DarkLayout>
  )
}
