'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CENTERS = ['IMS Surat', 'IMS Ahmedabad', 'IMS Mumbai', 'IMS Delhi', 'IMS Pune']
const BATCHES = ['CAT 2025', 'CAT 2026', 'SNAP 2025', 'NMAT 2025', 'IPMAT 2025']

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', center: '', batch: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.center || !form.batch) { setError('Please fill all fields'); return }
    if (form.phone.length !== 10) { setError('Enter a valid 10-digit phone number'); return }
    setLoading(true); setError('')

    const { data: existing } = await supabase.from('students').select('*').eq('phone', form.phone).single()
    if (existing) {
      localStorage.setItem('student', JSON.stringify(existing))
      router.push('/dashboard')
    } else {
      const { data, error: err } = await supabase.from('students').insert([form]).select().single()
      if (err) setError('Something went wrong. Try again.')
      else { localStorage.setItem('student', JSON.stringify(data)); router.push('/dashboard') }
    }
    setLoading(false)
  }

  return (
    <main style={{ background: 'var(--bg-secondary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>IMS</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700 }}>Test Portal</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Enter your details to continue</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label className="label">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" className="input" />
            </div>

            <div>
              <label className="label">Mobile Number</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" maxLength={10} className="input" />
            </div>

            <div>
              <label className="label">IMS Center</label>
              <select name="center" value={form.center} onChange={handleChange} className="input">
                <option value="">Select your center</option>
                {CENTERS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Batch</label>
              <select name="batch" value={form.batch} onChange={handleChange} className="input">
                <option value="">Select your batch</option>
                {BATCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-light)', padding: '10px 14px', borderRadius: '8px' }}>{error}</p>}

            <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: '13px', fontSize: '15px', marginTop: '4px' }}>
              {loading ? 'Please wait...' : 'Enter Portal →'}
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}