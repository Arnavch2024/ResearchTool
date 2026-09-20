import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { testGroqApiKey } from '../services/api'
import { useToast } from './Toast'
import { IcoClose, IcoCheck } from './Icons'

export default function KeySettingsModal({ isOpen, onClose }) {
  const { apiKey, updateApiKey, user } = useAuth()
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (isOpen) {
      setInputKey(apiKey || '')
      setShowKey(false)
      setTestResult(null)
    }
  }, [isOpen, apiKey])

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
      setTestResult({ ok: true, message: `Key verified! Connected to ${res.model || 'Groq'}.` })
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Verification failed. Please check your key.' })
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
        toast('Groq API Key saved securely in browser IndexedDB', 'success', 'Key Saved')
      } else {
        toast('API Key removed from IndexedDB', 'info', 'Key Cleared')
      }
      onClose()
    } catch (err) {
      toast('Failed to save key in IndexedDB', 'error', 'Storage Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setInputKey('')
    await updateApiKey('')
    setTestResult(null)
    toast('API Key cleared from IndexedDB', 'info', 'Key Cleared')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box key-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="key-icon-badge">🔑</span>
            <div>
              <h2 className="modal-title">API Key Settings</h2>
              <span className="modal-subtitle">Bring Your Own Key (BYOK) • IndexedDB Vault</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <IcoClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="key-modal-body">
          <div className="key-security-banner">
            <div className="banner-title">
              <span className="shield-dot" /> Stored locally in your browser’s IndexedDB
            </div>
            <p className="banner-text">
              Your API key is never written to disk on our servers or stored in MongoDB. It stays safely in your local IndexedDB vault and is automatically dropped when you sign out.
            </p>
          </div>

          <div className="form-group">
            <div className="key-label-row">
              <label htmlFor="groq-key-input">Groq API Key</label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="get-key-link"
              >
                Get free key at console.groq.com ↗
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

          {testResult && (
            <div className={`key-test-banner ${testResult.ok ? 'is-success' : 'is-error'}`}>
              <span className="test-icon">{testResult.ok ? '✓' : '⚠'}</span>
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="key-modal-actions">
            <button
              type="button"
              className="btn-secondary btn-test-key"
              onClick={handleTestKey}
              disabled={testing || !inputKey.trim()}
            >
              {testing ? <span className="btn-loading-spinner" /> : '⚡ Test Connection'}
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
              {saving ? <span className="btn-loading-spinner" /> : 'Save in IndexedDB'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
