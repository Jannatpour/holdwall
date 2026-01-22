/**
 * Unit Tests
 * Example test file
 */

import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('handles Tailwind conflicts', () => {
    expect(cn('p-2 p-4')).toBe('p-4') // Last one wins
  })
})
