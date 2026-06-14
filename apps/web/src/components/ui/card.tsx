import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`bg-slate-800/50 text-slate-100 border border-slate-700 rounded-lg shadow ${className}`}>
      {children}
    </div>
  )
}

export const CardHeader = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`px-6 py-4 border-b border-slate-700 ${className}`}>
      {children}
    </div>
  )
}

export const CardTitle = ({ children, className = '' }: CardProps) => {
  return (
    <h3 className={`text-lg font-semibold text-slate-100 ${className}`}>
      {children}
    </h3>
  )
}

export const CardDescription = ({ children, className = '' }: CardProps) => {
  return (
    <p className={`text-sm text-slate-400 mt-1 ${className}`}>
      {children}
    </p>
  )
}

export const CardContent = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}
