// src/hooks/useStreamingChat.ts
import { useState, useCallback } from 'react'

interface ProgressStep {
  type: string
  event: string
  message: string
  timestamp: number
}

interface StreamingChatResult {
  steps: ProgressStep[]
  isStreaming: boolean
  result: any | null
  error: string | null
  sendStreamingQuery: (query: string, userId: string, threadId: string | null) => Promise<any>
  resetSteps: () => void
}

// Get API URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export function useStreamingChat(): StreamingChatResult {
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetSteps = useCallback(() => {
    setSteps([])
    setResult(null)
    setError(null)
  }, [])

  const sendStreamingQuery = useCallback(async (
    query: string, 
    userId: string, 
    threadId: string | null
  ): Promise<any> => {
    // Reset state
    setSteps([])
    setIsStreaming(true)
    setResult(null)
    setError(null)

    try {
      console.log('🌊 Starting streaming request to:', `${API_BASE_URL}/api/chat/stream`)
      
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          input: query,
          query: query,
          user_id: userId,
          thread_id: threadId
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: any = null

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('🏁 Stream ended')
          break
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6).trim()
              if (!data) continue
              
              const event = JSON.parse(data)
              console.log('📨 SSE Event:', event)

              if (event.type === 'progress') {
                setSteps(prev => {
                  // Avoid duplicate events
                  const exists = prev.some(
                    s => s.event === event.event && s.timestamp === event.timestamp
                  )
                  if (exists) return prev
                  return [...prev, event]
                })
              } else if (event.type === 'heartbeat') {
                console.log('💓 Heartbeat received')
              } else if (event.type === 'done') {
                console.log('✅ Stream complete, result:', event)
                finalResult = event.result || event
                setResult(finalResult)
                setIsStreaming(false)
              } else if (event.type === 'error') {
                console.error('❌ Stream error:', event.message)
                setError(event.message)
                setIsStreaming(false)
                throw new Error(event.message)
              }
            } catch (parseError) {
              console.warn('⚠️ Failed to parse SSE data:', line, parseError)
            }
          }
        }
      }

      setIsStreaming(false)
      return finalResult

    } catch (err: any) {
      console.error('❌ Streaming error:', err)
      setError(err.message || 'Streaming failed')
      setIsStreaming(false)
      throw err
    }
  }, [])

  return {
    steps,
    isStreaming,
    result,
    error,
    sendStreamingQuery,
    resetSteps
  }
}
