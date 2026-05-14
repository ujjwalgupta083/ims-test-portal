import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">IMS Test Portal</h1>
        <p className="text-gray-400 mb-8">Daily tests. Real results.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/login"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold">
            Student Login
          </Link>
          <Link href="/admin"
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold">
            Admin Login
          </Link>
        </div>
      </div>
    </main>
  )
}