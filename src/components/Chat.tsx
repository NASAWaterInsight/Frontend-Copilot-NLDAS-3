import React, { useState, useRef, useEffect } from 'react'
import { callMultiAgentFunction } from '../api/multiAgent'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

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
              <div className={`max-w-[75%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-xl rounded-tr-none' : 'bg-white text-gray-900 rounded-xl rounded-tl-none shadow'} p-4`}>
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                {m.imageUrl && (
                  <div className="mt-3">
                    <div className="border rounded-md overflow-hidden bg-white" style={{ height: '400px' }}>
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={4}
                        centerOnInit={true}
                        wheel={{ step: 0.1 }}
                        pinch={{ step: 5 }}
                        doubleClick={{ mode: 'toggle', step: 0.7 }}
                      >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                          <>
                            {/* Zoom Controls */}
                            <div className="absolute top-2 left-2 z-10 flex gap-1">
                              <button
                                onClick={() => zoomIn()}
                                className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm"
                                title="Zoom In"
                              >
                                +
                              </button>
                              <button
                                onClick={() => zoomOut()}
                                className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm"
                                title="Zoom Out"
                              >
                                −
                              </button>
                              <button
                                onClick={() => resetTransform()}
                                className="bg-white/90 hover:bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-sm shadow-sm"
                                title="Reset"
                              >
                                ⌂
                              </button>
                            </div>
                            <TransformComponent
                              wrapperStyle={{ width: '100%', height: '100%' }}
                              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <img 
                                src={m.imageUrl} 
                                alt="visualization" 
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                draggable={false}
                              />
                            </TransformComponent>
                          </>
                        )}
                      </TransformWrapper>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                      <span className="text-xs">💡 Scroll to zoom, drag to pan, double-click to toggle zoom</span>
                      <a 
                        href={m.imageUrl}
                        download="visualization.png"
                        className="text-indigo-600 hover:text-indigo-800 text-xs"
                      >
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
        <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about hydrology data..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Send'}
            </button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </form>

        {debug && (
          <details className="p-4 border-t bg-gray-50">
            <summary className="cursor-pointer text-sm text-gray-600">Debug Info</summary>
            <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(debug, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}