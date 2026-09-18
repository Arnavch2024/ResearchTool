import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Mark, IcoPaper, IcoNodes, IcoSearch, IcoWrench, IcoBox, IcoCode } from './Icons'

export default function LandingPage() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your name')
        if (!email.trim()) throw new Error('Please enter your email')
        if (password.length < 8) throw new Error('Password must be at least 8 characters')
        await register(name.trim(), email.trim(), password)
      } else {
        if (!email.trim() || !password) throw new Error('Please enter email and password')
        await login(email.trim(), password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  function handleQuickDemo() {
    setName('Research Scholar')
    setEmail('demo@research.ai')
    setPassword('demoPass1234')
  }

  return (
    <div className="landing-container">
      {/* Background ambient lighting */}
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="nav-mark"><Mark /></div>
          <div className="nav-wordmark">Research<em>RAG</em></div>
          <span className="landing-tag">v2.0 • Hybrid Intelligence</span>
        </div>
        <div className="landing-nav-links">
          <span className="privacy-pill">
            <span className="status-dot-pulse" /> Private & Encrypted
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="landing-hero">
        <div className="hero-left">
          <div className="hero-badge">
            <span className="badge-spark">✦</span> Enterprise-Grade Research Assistant
          </div>
          <h1 className="hero-title">
            Deep academic discovery, <br />
            <em>visualized</em> and secured.
          </h1>
          <p className="hero-subtitle">
            Upload complex technical papers. Query with <strong>Hybrid Vector & Visual PageTree RAG</strong>,
            synthesize live ecosystems via <strong>ArXiv, GitHub & HuggingFace</strong>, and automatically map architectures.
          </p>

          <div className="hero-capabilities">
            <div className="cap-item">
              <span className="cap-icon"><IcoPaper /></span>
              <div>
                <strong>Hybrid Visual RAG</strong>
                <p>Vector FAISS + PageTree for visual charts</p>
              </div>
            </div>
            <div className="cap-item">
              <span className="cap-icon"><IcoNodes /></span>
              <div>
                <strong>Architecture Studio</strong>
                <p>Auto-generate dynamic node diagrams</p>
              </div>
            </div>
            <div className="cap-item">
              <span className="cap-icon"><IcoSearch /></span>
              <div>
                <strong>Ecosystem MCP</strong>
                <p>Live ArXiv, GitHub & HuggingFace search</p>
              </div>
            </div>
            <div className="cap-item">
              <span className="cap-icon"><IcoWrench /></span>
              <div>
                <strong>Privacy & Persistence</strong>
                <p>Zero training data, MongoDB encrypted storage</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="hero-right">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${!isRegister ? 'is-active' : ''}`}
                  onClick={() => { setIsRegister(false); setError(null) }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-tab ${isRegister ? 'is-active' : ''}`}
                  onClick={() => { setIsRegister(true); setError(null) }}
                >
                  Create Account
                </button>
              </div>
              <p className="auth-subtext">
                {isRegister
                  ? 'Join Research RAG to persist your studies and diagrams'
                  : 'Welcome back. Access your saved research workspace'}
              </p>
            </div>

            {error && (
              <div className="auth-error-banner">
                <span className="error-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {isRegister && (
                <div className="form-group">
                  <label htmlFor="name-input">Full Name</label>
                  <input
                    id="name-input"
                    type="text"
                    placeholder="Dr. Alan Turing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email-input">Work / Academic Email</label>
                <input
                  id="email-input"
                  type="email"
                  placeholder="alan@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password-input">Password</label>
                <input
                  id="password-input"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="btn-loading-spinner" />
                ) : isRegister ? (
                  'Create Workspace Account →'
                ) : (
                  'Sign In to Workspace →'
                )}
              </button>

              <div className="auth-footer-helper">
                <button
                  type="button"
                  className="quick-demo-btn"
                  onClick={handleQuickDemo}
                >
                  Fill Sample Credentials
                </button>
              </div>
            </form>

            <div className="auth-security-notice">
              🔒 Protected with bcrypt password encryption and stateless JWT session keys.
            </div>
          </div>
        </div>
      </main>

      {/* Feature Grid section */}
      <section className="landing-features">
        <h2 className="features-headline">Engineered for Rigorous Technical Synthesis</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="f-icon"><IcoPaper /></div>
            <h3>Vectorless + FAISS RAG</h3>
            <p>Smart multi-tier retrieval. Text is vectorized with FAISS & BM25, while complex visual figures utilize PageTree hierarchical indexing.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><IcoNodes /></div>
            <h3>Architecture Diagramming</h3>
            <p>Convert paper methodologies directly into interactive ReactFlow node diagrams, ready to export as SVG or JSON blueprints.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><IcoSearch /></div>
            <h3>Multi-Ecosystem Search</h3>
            <p>Agentic intent classifier automatically queries ArXiv for citations, GitHub for implementations, and HuggingFace for weights.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><IcoBox /></div>
            <h3>Persistent MongoDB Memory</h3>
            <p>All your past discussions, diagrams, and research sessions are organized and preserved with indexed MongoDB collections.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span>Research RAG • Local-First Intelligence</span>
          <span className="footer-divider">•</span>
          <span>Zero User-Prompt Training Guarantee</span>
          <span className="footer-divider">•</span>
          <span>Open Architecture</span>
        </div>
      </footer>
    </div>
  )
}
