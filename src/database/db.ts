import Dexie, { type Table } from 'dexie'
import type { Task } from '../types/task'

class FocusMatrixDatabase extends Dexie {
  tasks!: Table<Task, string>

  constructor() {
    super('focus-matrix')
    this.version(1).stores({ tasks: 'id, quadrant, completed, dueDate, createdAt' })
    this.version(2).stores({ tasks: 'id, quadrant, completed, dueDate, reminderAt, createdAt' })
  }
}

export const db = new FocusMatrixDatabase()