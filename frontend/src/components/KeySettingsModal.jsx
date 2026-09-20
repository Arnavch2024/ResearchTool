import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { testGroqApiKey, fetchKeyUsage } from '../services/api'
import { useToast } from './Toast'
import {
  IcoClose,
  IcoCheck,
  IcoKey,
  IcoShield,
  IcoGauge,
  IcoCpu,
  IcoClock,
  IcoRefresh,
  IcoAlert,
  IcoActivity,
} from './Icons'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

function getMeterColor(pct) {
  if (pct >= 40) return { bar: 'linear-gradient(90deg, #10b981, #34d399)', glow: 'rgba(16, 185, 129, 0.35)', text: '#34d399' }
  if (pct >= 15) return { bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)', glow: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' }
  return { bar: 'linear-gradient(90deg, #ef4444, #f87171)', glow: 'rgba(239, 68, 68, 0.35)', text: '#f87171' }
}

export default function KeySettingsModal({ isOpen, onClose }) {
  const { apiKey, updateApiKey } = useAuth()
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetchingUsage, setFetchingUsage] = useState(false)
  const [usageData, setUsageData] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (isOpen) {
      const active = apiKey || ''
      setInputKey(active)
      setShowKey(false)
      setTestResult(null)
      if (active.trim()) {
        loadQuotaTelemetry(active.trim())
      } else {
        setUsageData(null)
      }
    }
  }, [isOpen, apiKey])

  async function loadQuotaTelemetry(keyToQuery) {
    setFetchingUsage(true)
    try {
      const res = await fetchKeyUsage(keyToQuery)
      if (res?.usage) {
        setUsageData(res)
      }
    } catch {
      // Non-blocking telemetry load
    } finally {
      setFetchingUsage(false)
    }
  }

  if (!isOpen) return null

  async function handleTestKey() {
    const keyToTest = inputKey.trim()
    if (!keyToTest) {
      setTestResult({ ok: false, message: 'Please enter a Groq API key to test.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testGroqApiKey(keyToTest)
      setTestResult({ ok: true, message: `Key verified. Connected to ${res.model || 'Groq'}.` })
      if (res.usage) {
        setUsageData(res)
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Verification failed. Please check your key.' })
      setUsageData(null)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const clean = inputKey.trim()
      await updateApiKey(clean)
      if (clean) {
        toast('Groq API Key saved in encrypted IndexedDB vault', 'success', 'Key Saved')
      } else {
        toast('API Key removed from IndexedDB', 'info', 'Key Cleared')
      }
      onClose()
    } catch {
      toast('Failed to save key in IndexedDB', 'error', 'Storage Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setInputKey('')
    setUsageData(null)
    await updateApiKey('')
    setTestResult(null)
    toast('API Key cleared from IndexedDB', 'info', 'Key Cleared')
  }

  const usage = usageData?.usage
  const reqPct = usage?.requests_pct ?? 100
  const tokenPct = usage?.tokens_pct ?? 100
  const reqTheme = getMeterColor(reqPct)
  const tokenTheme = getMeterColor(tokenPct)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box key-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="key-icon-badge">
              <IcoKey size={16} />
            </div>
            <div>
              <h2 className="modal-title">API Key &amp; Rate Limits</h2>
              <span className="modal-subtitle">Bring Your Own Key (BYOK) • AES-256 IndexedDB Vault</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <IcoClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="key-modal-body">
          {/* Privacy Security Banner */}
          <div className="key-security-banner">
            <div className="banner-title">
              <IcoShield size={14} />
              <span>Client-Side AES-GCM Encrypted Storage</span>
            </div>
            <p className="banner-text">
              Your key stays isolated in your browser’s IndexedDB vault. It is decrypted only in-memory during active requests and dropped on logout.
            </p>
          </div>

          {/* API Key Input Field */}
          <div className="form-group">
            <div className="key-label-row">
              <label htmlFor="groq-key-input">Groq API Key</label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="get-key-link"
              >
                Get Key at console.groq.com
              </a>
            </div>

            <div className="key-input-wrap">
              <input
                id="groq-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                value={inputKey}
                onChange={e => {
                  setInputKey(e.target.value)
                  setTestResult(null)
                }}
                className="key-input"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="key-toggle-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div className={`key-test-banner ${testResult.ok ? 'is-success' : 'is-error'}`}>
              <span className="test-icon">
                {testResult.ok ? <IcoCheck size={14} /> : <IcoAlert size={14} />}
              </span>
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Live Quota & Usage Monitor */}
          {usage && (
            <div className="quota-monitor-card">
              <div className="quota-header">
                <div className="quota-header-title">
                  <IcoGauge size={14} />
                  <span>Real-Time Quota &amp; Rate Limits</span>
                </div>
                <div className="quota-header-actions">
                  <span className="quota-model-tag">
                    <IcoCpu size={12} />
                    {usageData.model || 'Groq LPU'}
                  </span>
                  <button
                    type="button"
                    className="btn-refresh-quota"
                    onClick={() => inputKey.trim() && loadQuotaTelemetry(inputKey.trim())}
                    disabled={fetchingUsage}
                    title="Refresh quota metrics"
                  >
                    <IcoRefresh size={12} className={fetchingUsage ? 'spin-anim' : ''} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              <div className="quota-grid">
                {/* Metric 1: Daily Requests */}
                <div className="quota-metric-box">
                  <div className="metric-top-row">
                    <span className="metric-label">Daily Requests</span>
                    <span className="metric-pct" style={{ color: reqTheme.text }}>
                      {reqPct}% Left
                    </span>
                  </div>
                  <div className="metric-values">
                    <span className="val-remaining">{formatNumber(usage.remaining_requests)}</span>
                    <span className="val-total">/ {formatNumber(usage.limit_requests)} RPD</span>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(Math.max(reqPct, 0), 100)}%`,
                        background: reqTheme.bar,
                        boxShadow: `0 0 10px ${reqTheme.glow}`,
                      }}
                    />
                  </div>
                  <div className="metric-reset-row">
                    <IcoClock size={11} />
                    <span>Resets in {usage.reset_requests || '24h'}</span>
                  </div>
                </div>

                {/* Metric 2: Token Throughput */}
                <div className="quota-metric-box">
                  <div className="metric-top-row">
                    <span className="metric-label">Tokens / Minute</span>
                    <span className="metric-pct" style={{ color: tokenTheme.text }}>
                      {tokenPct}% Left
                    </span>
                  </div>
                  <div className="metric-values">
                    <span className="val-remaining">{formatNumber(usage.remaining_tokens)}</span>
                    <span className="val-total">/ {formatNumber(usage.limit_tokens)} TPM</span>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(Math.max(tokenPct, 0), 100)}%`,
                        background: tokenTheme.bar,
                        boxShadow: `0 0 10px ${tokenTheme.glow}`,
                      }}
                    />
                  </div>
                  <div className="metric-reset-row">
                    <IcoClock size={11} />
                    <span>Resets in {usage.reset_tokens || '1m'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="key-modal-actions">
            <button
              type="button"
              className="btn-secondary btn-test-key"
              onClick={handleTestKey}
              disabled={testing || !inputKey.trim()}
            >
              {testing ? (
                <span className="btn-loading-spinner" />
              ) : (
                <>
                  <IcoActivity size={13} />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {apiKey && (
              <button
                type="button"
                className="btn-clear-key"
                onClick={handleClear}
                title="Remove key from IndexedDB"
              >
                Clear Key
              </button>
            )}

            <button
              type="submit"
              className="btn-primary btn-save-key"
              disabled={saving}
            >
              {saving ? <span className="btn-loading-spinner" /> : 'Save Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
