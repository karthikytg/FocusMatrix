export type Quadrant = 'DO_FIRST' | 'SCHEDULE' | 'DELEGATE' | 'ELIMINATE'
export type ReminderRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type Task = {
  id: string
  title: string
  urgent: boolean
  important: boolean
  quadrant: Quadrant
  completed: boolean
  dueDate?: string
  reminderAt?: string
  reminderRecurrence?: ReminderRecurrence
  reminderLastTriggeredAt?: string
  createdAt: string
  completedAt?: string
}