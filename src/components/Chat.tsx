import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction } from '../api/multiAgent'

type Role = 'user' | 'assistant'
type Message = {
  id: string
  role: Role
  text?: string
  imageUrl?: string
}

export default function Chat() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [debug, setDebug] = useState<any>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return

    const userMsg: Message = { id: String(Date.now()), role: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    setQuery('')
    setError(null)
    setLoading(true)

    try {
      const resp = await callMultiAgentFunction({ action: 'generate', data: { query: userMsg.text } })
      const r = resp.response
      
      // Extract image URL from multiple possible locations
      let imageUrl = r?.analysis_data?.result?.map_url || null
      
      // Check if the result field directly contains a URL (your current backend format)
      if (!imageUrl && r?.result && typeof r.result === 'string' && r.result.startsWith('http')) {
        imageUrl = r.result
      }
      
      // Fallback: extract URL from content if not in proper structure
      if (!imageUrl && r?.content) {
        const urlMatch = r.content.match(/https?:\/\/[^\s]+/)
        imageUrl = urlMatch ? urlMatch[0] : null
      }
      
      // Clean the content text to remove URLs and unwanted patterns
      let cleanContent = r?.content || ''
      // Always clean URLs if they exist
      cleanContent = cleanContent.replace(/https?:\/\/[^\s]+/g, '').replace(/Result:\s*$/, '').trim()
      // Remove common prefixes that might be added by the backend
      cleanContent = cleanContent.replace(/^(Temperature map created:|Analysis completed[\.!]*\s*Result:\s*)/i, '').trim()

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: cleanContent || 'Analysis completed.',
        imageUrl: imageUrl,
      }

      setMessages((prev) => [...prev, assistantMsg])
      setDebug(r?.debug ?? r?.analysis_data ?? null)
    } catch (err: any) {
      setError(err?.message ?? String(err))
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', text: 'Request failed.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-container px-4">
      <div className="mx-auto max-w-3xl bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">HC</div>
            <div>
              <div className="text-lg font-semibold">Hydrology Copilot</div>
              <div className="text-xs text-gray-500">Ask a question and get a visualization</div>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-auto bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500">Type a query to generate a visualization</div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-xl rounded-tr-none' : 'bg-white text-gray-900 rounded-xl rounded-tl-none shadow'} p-4` }>
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                {m.imageUrl && (
                  <div className="mt-3">
                    <img src={m.imageUrl} alt="visualization" className="w-full rounded-md border" />
                    <div className="mt-2 text-sm text-gray-500">
                      <a 
                        href={m.imageUrl} 
                        download="visualization.png"
                        className="inline-flex items-center gap-1 underline hover:text-gray-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={endRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask for a map, e.g. max temperature Indiana Jan 1 2023"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Send'}
          </button>
        </form>

        {error && <div className="p-3 text-red-600">Error: {error}</div>}

        {debug && (
          <details className="p-4 text-xs text-gray-600 border-t">
            <summary className="cursor-pointer">Debug info</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(debug, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}