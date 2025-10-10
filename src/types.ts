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
    type?: string // 'azure_maps' or undefined
    agent_id?: string
    thread_id?: string
    debug?: any
    analysis_data?: any
    result?: string | MapData
    data?: any // Azure Maps JSON data when type === 'azure_maps'
  }
}

export interface MapData {
  map_url: string
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
  center?: {
    lat: number
    lng: number
  }
  zoom?: number
  azureData?: any // Azure Maps specific data from backend
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text?: string
  imageUrl?: string
  mapData?: MapData
}