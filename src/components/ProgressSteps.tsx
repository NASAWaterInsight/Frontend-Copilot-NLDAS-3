// src/components/ProgressSteps.tsx
import React from 'react'

interface ProgressStep {
  event: string
  message: string
  timestamp: number
  completed?: boolean
}

interface ProgressStepsProps {
  steps: ProgressStep[]
  isLoading: boolean
}

export default function ProgressSteps({ steps, isLoading }: ProgressStepsProps) {
  if (steps.length === 0 && !isLoading) return null

  return (
    <div className="bg-black border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 min-w-[320px] max-w-md">
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isCurrentStep = index === steps.length - 1 && isLoading
          const isCompleted = !isCurrentStep

          return (
            <div 
              key={`${step.event}-${step.timestamp}`}
              className={`flex items-center gap-3 ${
                isCompleted ? 'text-gray-400' : 'text-gray-200'
              }`}
            >
              {/* Icon/Status indicator */}
              {isCurrentStep ? (
                <div className="w-4 h-4 flex-shrink-0">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <span className="text-green-400 flex-shrink-0">✓</span>
              )}

              {/* Message */}
              <span className={`text-sm ${isCurrentStep ? 'font-medium' : ''}`}>
                {step.message}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      {isLoading && (
        <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ 
              width: `${Math.min(95, (steps.length / 10) * 100)}%`,
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
        </div>
      )}
    </div>
  )
}