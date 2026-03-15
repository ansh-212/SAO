import React from 'react'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    background: '#05050a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 32,
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                }}>
                    <div style={{
                        maxWidth: 480,
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.035)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        borderRadius: 24,
                        padding: '48px 36px',
                        backdropFilter: 'blur(20px)',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
                        <h2 style={{
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            color: '#f1f5f9',
                            marginBottom: 8,
                            letterSpacing: '-0.03em',
                        }}>
                            Something went wrong
                        </h2>
                        <p style={{
                            fontSize: '0.88rem',
                            color: '#64748b',
                            lineHeight: 1.6,
                            marginBottom: 28,
                        }}>
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.reload()
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 12,
                                padding: '12px 28px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 8px 40px rgba(99,102,241,0.5)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.35)'
                            }}
                        >
                            🔄 Refresh Page
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
