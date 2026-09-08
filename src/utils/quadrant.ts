import type { Quadrant } from '../types/task'

export function calculateQuadrant(urgent: boolean, important: boolean): Quadrant {
  if (urgent && important) return 'DO_FIRST'
  if (!urgent && important) return 'SCHEDULE'
  if (urgent && !important) return 'DELEGATE'
  return 'ELIMINATE'
}