'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = 'ims2025'

export default function AdminLogin() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('admin', 'true')
      router.push('/admin/dashboard')
    } else {
      setError('Wrong password')
    }
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="bg-[#16213e] p-8 rounded-2xl w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Login</h1>
        <p className="text-gray-400 text-sm text-center mb-8">Faculty access only</p>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin password"
            className="w-full bg-[#0f3460] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold"
          >
            Login →
          </button>
        </div>
      </div>
    </main>
  )
}