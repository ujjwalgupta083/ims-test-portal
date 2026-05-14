'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (password === 'ims2025') { localStorage.setItem('admin', 'true'); router.push('/admin/dashboard') }
    else setError('Incorrect password')
  }

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>IMS</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Faculty Login</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Admin access only</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Admin Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter password" className="input" />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '10px', borderRadius: '8px' }}>{error}</p>}
            <button onClick={handleLogin} className="btn-primary" style={{ padding: '13px', fontSize: '15px' }}>Login →</button>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}><a href="/." style={{ color: 'var(--primary)', textDecoration: 'none' }}>Go Back to Home Page</a>
        </p>
      </div>
    </main>
  )
}