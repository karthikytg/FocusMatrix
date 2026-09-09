import Dexie, { type Table } from "dexie";
import type {
  LearningNode,
  LearningSession,
  StudySession,
  Task,
} from "../types/task";

class FocusMatrixDatabase extends Dexie {
  tasks!: Table<Task, string>;
  learningSessions!: Table<LearningSession, string>;
  learningNodes!: Table<LearningNode, string>;
  studySessions!: Table<StudySession, string>;

  constructor() {
    super("focus-matrix");
    this.version(1).stores({
      tasks: "id, quadrant, completed, dueDate, createdAt",
    });
    this.version(2).stores({
      tasks: "id, quadrant, completed, dueDate, reminderAt, createdAt",
    });
    this.version(3).stores({
      tasks: "id, quadrant, completed, status, dueDate, reminderAt, createdAt",
    });
    this.version(4).stores({
      tasks: "id, quadrant, completed, status, dueDate, reminderAt, createdAt",
    });
    this.version(5).stores({
      tasks: "id, quadrant, completed, status, dueDate, reminderAt, createdAt",
      learningSessions: "id, date, status, topic, createdAt, reminderAt",
    });
    this.version(6).stores({
      tasks: "id, quadrant, completed, status, dueDate, reminderAt, createdAt",
      learningSessions: "id, date, status, topic, createdAt, reminderAt",
      learningNodes: "id, parentId, type, name, createdAt",
      studySessions: "id, subjectId, dayId, topicId, startAt, status",
    });
  }
}

export const db = new FocusMatrixDatabase();
