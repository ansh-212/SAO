import React from 'react'
import { useLang } from '../context/LangContext'

export default function ProctorStats({ proctorData }) {
  const { t } = useLang()
  if (!proctorData) return null

  const {
    faceDetected, multipleFaces, gazeOnScreen, totalViolations, integrity, expression,
    suspicionScore = 0, suspicionTrend = 'stable', objectDetectionActive = false,
    suspicionSignals = [],
  } = proctorData

  const statusColor = !faceDetected ? 'var(--error)'
    : multipleFaces ? 'var(--warning)'
    : !gazeOnScreen ? 'var(--warning)'
    : 'var(--success)'

  const statusText = !faceDetected ? '⚠ No Face'
    : multipleFaces ? '⚠ Multiple Faces'
    : !gazeOnScreen ? '👀 Look at Screen'
    : '✓ OK'

  const expressionEmoji = {
    neutral: '😐', happy: '😊', sad: '😢', angry: '😠',
    fearful: '😨', disgusted: '🤢', surprised: '😲'
  }[expression] || '😐'

  // Suspicion score color (inverted: higher = worse)
  const suspicionColor = suspicionScore <= 20 ? 'var(--success)'
    : suspicionScore <= 50 ? 'var(--warning)'
    : 'var(--error)'

  const trendArrow = suspicionTrend === 'rising' ? '↗' : suspicionTrend === 'falling' ? '↘' : '→'

  return (
    <div style={{
      background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 12, backdropFilter: 'blur(20px)', fontSize: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`, animation: !faceDetected ? 'pulse 1s infinite' : 'none'
        }} />
        <span style={{ fontWeight: 700, color: statusColor, fontSize: 11 }}>{statusText}</span>
        {objectDetectionActive && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--success)', fontWeight: 600 }}>🔍 OD</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div style={{ background: 'var(--glass-bg)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Integrity</div>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: integrity >= 70 ? 'var(--success)' : integrity >= 40 ? 'var(--warning)' : 'var(--error)'
          }}>{integrity}%</div>
        </div>
        <div style={{ background: 'var(--glass-bg)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Suspicion</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: suspicionColor }}>
            {suspicionScore}<span style={{ fontSize: 10 }}>{trendArrow}</span>
          </div>
        </div>
        <div style={{ background: 'var(--glass-bg)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Flags</div>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: totalViolations === 0 ? 'var(--success)' : totalViolations <= 3 ? 'var(--warning)' : 'var(--error)'
          }}>{totalViolations}</div>
        </div>
      </div>

      {/* Active suspicion signals */}
      {suspicionSignals.length > 0 && (
        <div style={{
          marginTop: 6, padding: '4px 8px', borderRadius: 6,
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          fontSize: 9, color: 'var(--error)', lineHeight: 1.4
        }}>
          ⚠ {suspicionSignals.slice(0, 3).join(' · ')}
        </div>
      )}

      <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        {expressionEmoji} {expression || 'neutral'}
      </div>
    </div>
  )
}
