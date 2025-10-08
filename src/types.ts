export interface MultiAgentRequest {
  action: string
  data: {
    query: string
    [key: string]: any
  }
}

export interface MultiAgentResponse {
  response: {
    status: string
    content?: string
    type?: string
    agent_id?: string
    thread_id?: string
    debug?: any
    analysis_data?: any
  }
}