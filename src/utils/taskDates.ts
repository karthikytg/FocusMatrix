import { addDays, addMonths, addWeeks, format, isToday, isValid, parseISO, startOfDay } from 'date-fns'
import type { ReminderRecurrence, Task } from '../types/task'

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'none'

export function localDateInputValue(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function dueStatus(task: Task, now = new Date()): DueStatus {
  if (!task.dueDate) return 'none'
  const due = parseISO(task.dueDate)
  if (!isValid(due)) return 'none'
  if (task.completed) return 'none'
  if (due < startOfDay(now)) return 'overdue'
  if (isToday(due)) return 'today'
  return 'upcoming'
}

export function nextReminderTime(reminderAt: string, recurrence: ReminderRecurrence): string | undefined {
  const date = new Date(reminderAt)
  if (!isValid(date) || recurrence === 'NONE') return undefined
  const next = recurrence === 'DAILY' ? addDays(date, 1) : recurrence === 'WEEKLY' ? addWeeks(date, 1) : addMonths(date, 1)
  return next.toISOString()
}

export function reminderLabel(task: Task): string | undefined {
  if (!task.reminderAt) return undefined
  const reminder = new Date(task.reminderAt)
  if (!isValid(reminder)) return undefined
  return `${format(reminder, 'MMM d, h:mm a')}${task.reminderRecurrence && task.reminderRecurrence !== 'NONE' ? ` · ${task.reminderRecurrence.toLowerCase()}` : ''}`
}