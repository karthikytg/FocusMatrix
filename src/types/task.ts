export type Quadrant = "DO_FIRST" | "SCHEDULE" | "DELEGATE" | "ELIMINATE";
export type ReminderRecurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type TaskStatus =
  | "Inbox"
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Closed"
  | "Cancelled"
  | "Deferred";

export type FollowUp = {
  id: string;
  date: string;
  remarks: string;
  nextAction?: string;
  status: "Active" | "Completed";
  createdAt: string;
};

export type AuditPlan = {
  id: string;
  auditDate: string;
  status: "Planned" | "Completed" | "Cancelled";
  remarks: string;
  nextAuditDate?: string;
  responsiblePerson: string;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  urgent: boolean;
  important: boolean;
  quadrant: Quadrant;
  completed: boolean;
  status?: TaskStatus;
  estimatedMinutes?: number;
  closureRemarks?: string;
  followUps?: FollowUp[];
  audits?: AuditPlan[];
  dueDate?: string;
  reminderAt?: string;
  reminderRecurrence?: ReminderRecurrence;
  reminderLastTriggeredAt?: string;
  createdAt: string;
  completedAt?: string;
};

export type LearningStatus =
  "Planned" | "In Progress" | "Completed" | "Postponed" | "Missed";

export type LearningSession = {
  id: string;
  topic: string;
  goal: string;
  date: string;
  startTime?: string;
  plannedMinutes: number;
  actualMinutes: number;
  status: LearningStatus;
  notes?: string;
  followUp?: string;
  nextSessionDate?: string;
  reminderAt?: string;
  reminderRecurrence?: ReminderRecurrence;
  reminderLastTriggeredAt?: string;
  createdAt: string;
  completedAt?: string;
};

export type LearningNodeType = "subject" | "day" | "topic";
export type LearningNode = {
  id: string;
  parentId?: string;
  type: LearningNodeType;
  name: string;
  goal?: string;
  plannedMinutes: number;
  actualMinutes: number;
  status: LearningStatus;
  notes?: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  dailyTargetMinutes?: number;
  weeklyTargetMinutes?: number;
  priority?: "Low" | "Medium" | "High";
  roadmapStatus?:
    "Not Started" | "In Progress" | "On Hold" | "Completed" | "Overdue";
  progressPercent?: number;
  milestones?: string[];
  reminderAt?: string;
  createdAt: string;
};

export type StudySession = {
  id: string;
  subjectId: string;
  dayId?: string;
  topicId?: string;
  startAt: string;
  endAt?: string;
  plannedMinutes: number;
  actualMinutes: number;
  status: "Running" | "Completed" | "Stopped";
  notes?: string;
};
