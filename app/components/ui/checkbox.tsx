

import React from 'react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

export function Checkbox({ onCheckedChange, onChange, className = '', ...props }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e)
    if (onCheckedChange) onCheckedChange(e.target.checked)
  }

  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${className}`}
      onChange={handleChange}
      {...props}
    />
  )
}
