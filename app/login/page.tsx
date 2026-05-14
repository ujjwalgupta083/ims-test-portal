'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const CENTERS = ['Surat', 'Ahmedabad', 'Mumbai', 'Delhi', 'Pune']
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
    if (!form.name || !form.phone || !form.center || !form.batch) {
      setError('Please fill all fields')
      return
    }
    if (form.phone.length !== 10) {
      setError('Enter a valid 10-digit phone number')
      return
    }

    setLoading(true)
    setError('')

    const { data: existing } = await supabase
      .from('students')
      .select('*')
      .eq('phone', form.phone)
      .single()

    if (existing) {
      localStorage.setItem('student', JSON.stringify(existing))
      router.push('/dashboard')
    } else {
      const { data, error: insertError } = await supabase
        .from('students')
        .insert([form])
        .select()
        .single()

      if (insertError) {
        setError('Something went wrong. Try again.')
      } else {
        localStorage.setItem('student', JSON.stringify(data))
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="bg-[#16213e] p-8 rounded-2xl w-full max-w-md shadow-xl">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">IMS Test Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your details to continue</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Full Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Phone Number</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="10-digit mobile number"
              maxLength={10}
              className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">IMS Center</label>
            <select
              name="center"
              value={form.center}
              onChange={handleChange}
              className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select your center</option>
              {CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Batch</label>
            <select
              name="batch"
              value={form.batch}
              onChange={handleChange}
              className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select your batch</option>
              {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold mt-2 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : 'Enter Portal →'}
          </button>
        </div>

      </div>
    </main>
  )
}