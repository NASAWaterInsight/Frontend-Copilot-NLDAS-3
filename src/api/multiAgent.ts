import type { MultiAgentRequest, MultiAgentResponse } from '../types'

const ENDPOINT = import.meta.env.VITE_MULTI_AGENT_URL ?? 'http://localhost:7071/multi_agent_function'
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'

export async function callMultiAgentFunction(req: MultiAgentRequest): Promise<MultiAgentResponse> {
  if (USE_MOCK) {
    // Simple mocked response that matches the expected shape
    await new Promise((r) => setTimeout(r, 700))
    const mock: MultiAgentResponse = {
      response: {
        status: 'success',
        content:
          'Analysis completed. Result:',
        type: 'early_return_success',
        agent_id: 'asst_6B8fh2hv2xy6NeKLTiZ4xCPr',
        thread_id: 'thread_PUYmogOTA36ifjAdHFQrqSQW',
        debug: { iterations: 8, custom_code_executed: true, early_return: true },
        analysis_data: {
          status: 'success',
          result:
            '',
          python_code: '# ... omitted for brevity',
          user_request: req.data.query,
        },
      },
    }

    return mock
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return json as MultiAgentResponse
}
