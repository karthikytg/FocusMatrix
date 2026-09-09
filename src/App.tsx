import {
  BarChart3,
  Bell,
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Focus,
  Grid2X2,
  ListTodo,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { db } from "./database/db";
import type {
  AuditPlan,
  FollowUp,
  Quadrant,
  ReminderRecurrence,
  Task,
  TaskStatus,
  LearningSession,
  LearningStatus,
  LearningNode,
  StudySession,
} from "./types/task";
import { calculateQuadrant } from "./utils/quadrant";
import {
  dueStatus,
  localDateInputValue,
  nextReminderTime,
  reminderLabel,
} from "./utils/taskDates";
import {
  authConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAuth,
} from "./services/auth";
import "./App.css";

const navigation = [
  { label: "Dashboard", icon: Target },
  { label: "Matrix", icon: Grid2X2 },
  { label: "Tasks", icon: ListTodo },
  { label: "Calendar", icon: CalendarDays },
  { label: "Analytics", icon: BarChart3 },
  { label: "Planner", icon: ClipboardList },
];

const focusAreas: Array<{
  label: string;
  quadrant: Quadrant;
  accent: string;
  hint: string;
}> = [
  {
    label: "Do first",
    quadrant: "DO_FIRST",
    accent: "coral",
    hint: "Urgent + important",
  },
  {
    label: "Schedule",
    quadrant: "SCHEDULE",
    accent: "blue",
    hint: "Important + not urgent",
  },
  {
    label: "Delegate",
    quadrant: "DELEGATE",
    accent: "amber",
    hint: "Urgent + not important",
  },
  {
    label: "Eliminate",
    quadrant: "ELIMINATE",
    accent: "slate",
    hint: "Not urgent + not important",
  },
];
const taskStatuses: TaskStatus[] = [
  "Inbox",
  "Pending",
  "In Progress",
  "Completed",
  "Closed",
  "Cancelled",
  "Deferred",
];

function taskStatus(task: Task): TaskStatus {
  return task.status ?? (task.completed ? "Completed" : "Pending");
}

type StudyTimerState = {
  nodeId: string;
  startedAt: string;
  elapsed: number;
  paused: boolean;
};

function renderLearningTree(
  learningNodes: LearningNode[],
  activeTimer: StudyTimerState | null,
  startStudyTimer: (node: LearningNode) => Promise<void>,
  setLearningNodeType: React.Dispatch<
    React.SetStateAction<"subject" | "day" | "topic">
  >,
  setLearningNodeParent: React.Dispatch<
    React.SetStateAction<string | undefined>
  >,
  setNodeModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
  pauseStudyTimer: () => void,
  resumeStudyTimer: () => void,
  stopStudyTimer: () => Promise<void>,
  expandedNodes: Record<string, boolean>,
  toggleNode: (nodeId: string) => void,
  selectedNodeId: string | undefined,
  setSelectedNodeId: (nodeId: string) => void,
) {
  const subjects = learningNodes.filter((node) => node.type === "subject");
  return subjects.length ? (
    subjects.map((subject) => {
      const days = learningNodes.filter(
        (node) => node.parentId === subject.id && node.type === "day",
      );
      return (
        <div
          className={`learning-subject ${selectedNodeId === subject.id ? "selected" : ""}`}
          key={subject.id}
          onClick={() => setSelectedNodeId(subject.id)}
        >
          <div className="learning-node-heading">
            <button
              className="tree-toggle"
              type="button"
              aria-label={`${expandedNodes[subject.id] ? "Collapse" : "Expand"} ${subject.name}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleNode(subject.id);
              }}
            >
              {expandedNodes[subject.id] ? "v" : ">"}
            </button>
            <strong>{subject.name}</strong>
            <span>
              {subject.actualMinutes}/{subject.plannedMinutes} min
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setLearningNodeType("day");
                setLearningNodeParent(subject.id);
                setNodeModalOpen(true);
              }}
            >
              Create Subfolder
            </button>
          </div>
          {expandedNodes[subject.id] &&
            days.map((day) => {
              const topics = learningNodes.filter(
                (node) => node.parentId === day.id && node.type === "topic",
              );
              return (
                <div
                  className={`learning-day ${selectedNodeId === day.id ? "selected" : ""}`}
                  key={day.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(day.id);
                  }}
                >
                  <div className="learning-node-heading">
                    <button
                      className="tree-toggle"
                      type="button"
                      aria-label={`${expandedNodes[day.id] ? "Collapse" : "Expand"} ${day.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleNode(day.id);
                      }}
                    >
                      {expandedNodes[day.id] ? "v" : ">"}
                    </button>
                    <strong>{day.name}</strong>
                    <span>
                      {day.actualMinutes}/{day.plannedMinutes} min
                    </span>
                    {activeTimer?.nodeId === day.id ? (
                      <>
                        <button
                          className="icon-button timer-control"
                          type="button"
                          aria-label={
                            activeTimer.paused ? "Resume timer" : "Pause timer"
                          }
                          onClick={
                            activeTimer.paused
                              ? resumeStudyTimer
                              : pauseStudyTimer
                          }
                        >
                          {activeTimer.paused ? (
                            <Play size={13} />
                          ) : (
                            <Pause size={13} />
                          )}
                        </button>
                        <button
                          className="icon-button timer-control stop"
                          type="button"
                          aria-label="Stop timer"
                          onClick={() => void stopStudyTimer()}
                        >
                          Stop
                        </button>
                      </>
                    ) : (
                      <button
                        className="icon-button timer-control"
                        type="button"
                        aria-label={`Start timer for ${day.name}`}
                        onClick={() => void startStudyTimer(day)}
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setLearningNodeType("topic");
                        setLearningNodeParent(day.id);
                        setNodeModalOpen(true);
                      }}
                    >
                      Add Topic
                    </button>
                  </div>
                  {expandedNodes[day.id] &&
                    topics.map((topic) => (
                      <div
                        className={`learning-topic ${selectedNodeId === topic.id ? "selected" : ""}`}
                        key={topic.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNodeId(topic.id);
                        }}
                      >
                        <span>{topic.name}</span>
                        <small>
                          {topic.actualMinutes}/{topic.plannedMinutes} min -{" "}
                          {topic.status}
                        </small>
                        {activeTimer?.nodeId === topic.id ? (
                          <>
                            <button
                              className="icon-button timer-control"
                              type="button"
                              aria-label={
                                activeTimer.paused
                                  ? "Resume timer"
                                  : "Pause timer"
                              }
                              onClick={
                                activeTimer.paused
                                  ? resumeStudyTimer
                                  : pauseStudyTimer
                              }
                            >
                              {activeTimer.paused ? (
                                <Play size={13} />
                              ) : (
                                <Pause size={13} />
                              )}
                            </button>
                            <button
                              className="icon-button timer-control stop"
                              type="button"
                              aria-label="Stop timer"
                              onClick={() => void stopStudyTimer()}
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            className="icon-button timer-control"
                            type="button"
                            aria-label={`Start timer for ${topic.name}`}
                            onClick={() => void startStudyTimer(topic)}
                          >
                            <Play size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
        </div>
      );
    })
  ) : (
    <div className="empty-content">
      <div className="empty-icon">
        <ClipboardList size={22} />
      </div>
      <h3>Create your first learning folder</h3>
      <p>Start with a subject such as Python, Java, or SQL.</p>
      <button
        className="primary-button"
        type="button"
        onClick={() => {
          setLearningNodeType("subject");
          setLearningNodeParent(undefined);
          setNodeModalOpen(true);
        }}
      >
        Create Folder
      </button>
    </div>
  );
}

function App() {
  const legacyPlannerSection: string = "__legacy-planner__";
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [selectedQuadrant, setSelectedQuadrant] = useState<Quadrant | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [closureTask, setClosureTask] = useState<Task | null>(null);
  const [closureRemarks, setClosureRemarks] = useState("");
  const [followUpDate, setFollowUpDate] = useState(localDateInputValue());
  const [followUpRemarks, setFollowUpRemarks] = useState("");
  const [followUpAction, setFollowUpAction] = useState("");
  const [auditDate, setAuditDate] = useState(localDateInputValue());
  const [nextAuditDate, setNextAuditDate] = useState("");
  const [auditRemarks, setAuditRemarks] = useState("");
  const [auditResponsible, setAuditResponsible] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [learningSessions, setLearningSessions] = useState<LearningSession[]>(
    [],
  );
  const [learningNodes, setLearningNodes] = useState<LearningNode[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [activeTimer, setActiveTimer] = useState<{
    nodeId: string;
    startedAt: string;
    elapsed: number;
    paused: boolean;
  } | null>(() => {
    const raw = localStorage.getItem("focusmatrix-study-timer");
    return raw
      ? (() => {
          const parsed = JSON.parse(raw) as {
            nodeId: string;
            startedAt: string;
            elapsed: number;
            paused?: boolean;
          };
          return { ...parsed, paused: parsed.paused ?? false };
        })()
      : null;
  });
  const [learningNodeParent, setLearningNodeParent] = useState<
    string | undefined
  >();
  const [learningNodeType, setLearningNodeType] = useState<
    "subject" | "day" | "topic"
  >("subject");
  const [learningNodeName, setLearningNodeName] = useState("");
  const [learningNodeGoal, setLearningNodeGoal] = useState("");
  const [learningNodePlanned, setLearningNodePlanned] = useState(60);
  const [roadmapDescription, setRoadmapDescription] = useState("");
  const [roadmapStartDate, setRoadmapStartDate] = useState(
    localDateInputValue(),
  );
  const [roadmapTargetDate, setRoadmapTargetDate] = useState("");
  const [roadmapDailyMinutes, setRoadmapDailyMinutes] = useState(60);
  const [roadmapWeeklyMinutes, setRoadmapWeeklyMinutes] = useState(300);
  const [roadmapPriority, setRoadmapPriority] = useState<
    "Low" | "Medium" | "High"
  >("Medium");
  const [roadmapStatus, setRoadmapStatus] =
    useState<LearningNode["roadmapStatus"]>("Not Started");
  const [roadmapProgress, setRoadmapProgress] = useState(0);
  const [roadmapMilestones, setRoadmapMilestones] = useState("");
  const [isNodeModalOpen, setNodeModalOpen] = useState(false);
  const [expandedLearningNodes, setExpandedLearningNodes] = useState<
    Record<string, boolean>
  >(
    () =>
      JSON.parse(
        localStorage.getItem("focusmatrix-learning-expanded") ?? "{}",
      ) as Record<string, boolean>,
  );
  const [selectedLearningNodeId, setSelectedLearningNodeId] =
    useState<string>();
  const [isLearningModalOpen, setLearningModalOpen] = useState(false);
  const [selectedLearningSession, setSelectedLearningSession] =
    useState<LearningSession | null>(null);
  const [learningTopic, setLearningTopic] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [learningDate, setLearningDate] = useState(localDateInputValue());
  const [learningStartTime, setLearningStartTime] = useState("09:00");
  const [learningPlannedMinutes, setLearningPlannedMinutes] = useState(30);
  const [learningNotes, setLearningNotes] = useState("");
  const [learningReminder, setLearningReminder] = useState(false);
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("focusmatrix-display-name") ?? "Jordan",
  );
  const [profileName, setProfileName] = useState(displayName);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthBusy, setAuthBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState(localDateInputValue());
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderRecurrence, setReminderRecurrence] =
    useState<ReminderRecurrence>("NONE");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [analyticsStartDate, setAnalyticsStartDate] = useState("");
  const [analyticsEndDate, setAnalyticsEndDate] = useState("");
  const [analyticsQuadrant, setAnalyticsQuadrant] = useState<Quadrant | "ALL">(
    "ALL",
  );
  const [analyticsStatus, setAnalyticsStatus] = useState<TaskStatus | "ALL">(
    "ALL",
  );
  const [pageSize, setPageSize] = useState(10);
  const [pageByList, setPageByList] = useState<Record<string, number>>({});

  useEffect(() => {
    void db.tasks.orderBy("createdAt").reverse().toArray().then(setTasks);
    void db.learningSessions
      .orderBy("date")
      .toArray()
      .then(setLearningSessions);
    void db.learningNodes.orderBy("createdAt").toArray().then(setLearningNodes);
    void db.studySessions
      .orderBy("startAt")
      .reverse()
      .toArray()
      .then(setStudySessions);
  }, []);

  function toggleLearningNode(nodeId: string) {
    setExpandedLearningNodes((current) => {
      const next = { ...current, [nodeId]: !current[nodeId] };
      localStorage.setItem(
        "focusmatrix-learning-expanded",
        JSON.stringify(next),
      );
      return next;
    });
  }

  useEffect(() => {
    if (activeTimer)
      localStorage.setItem(
        "focusmatrix-study-timer",
        JSON.stringify(activeTimer),
      );
    else localStorage.removeItem("focusmatrix-study-timer");
  }, [activeTimer]);
  const timerStartedAt = activeTimer?.startedAt;
  useEffect(() => {
    if (!timerStartedAt) return;
    const timer = window.setInterval(
      () =>
        setActiveTimer((current) =>
          current
            ? {
                ...current,
                elapsed: Math.floor(
                  (Date.now() - new Date(current.startedAt).getTime()) / 1000,
                ),
              }
            : null,
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [timerStartedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      learningSessions
        .filter(
          (session) =>
            session.reminderAt &&
            new Date(session.reminderAt) <= now &&
            session.status === "Planned" &&
            (!session.reminderLastTriggeredAt ||
              new Date(session.reminderLastTriggeredAt) <
                new Date(session.reminderAt)),
        )
        .forEach((session) => {
          if ("Notification" in window && Notification.permission === "granted")
            new Notification(`Learning reminder: ${session.topic}`, {
              body: session.goal,
            });
          const nextReminder =
            session.reminderRecurrence === "DAILY"
              ? new Date(
                  new Date(session.reminderAt!).getTime() + 86400000,
                ).toISOString()
              : session.reminderAt;
          const update = {
            reminderAt: nextReminder,
            reminderLastTriggeredAt: now.toISOString(),
          };
          void db.learningSessions.update(session.id, update);
          setLearningSessions((current) =>
            current.map((item) =>
              item.id === session.id ? { ...item, ...update } : item,
            ),
          );
        });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [learningSessions]);

  useEffect(
    () =>
      subscribeToAuth((session) => setUserEmail(session?.user.email ?? null)),
    [],
  );

  useEffect(() => {
    const checkReminders = async () => {
      const now = new Date();
      const dueReminders = tasks.filter(
        (task) =>
          task.reminderAt &&
          !task.completed &&
          new Date(task.reminderAt) <= now &&
          (!task.reminderLastTriggeredAt ||
            new Date(task.reminderLastTriggeredAt) < new Date(task.reminderAt)),
      );
      for (const task of dueReminders) {
        if ("Notification" in window && Notification.permission === "granted")
          new Notification(`FocusMatrix reminder: ${task.title}`, {
            body: task.dueDate ? `Due ${task.dueDate}` : "Your task is ready.",
          });
        const next = nextReminderTime(
          task.reminderAt!,
          task.reminderRecurrence ?? "NONE",
        );
        const update = next
          ? {
              reminderAt: next,
              reminderLastTriggeredAt: new Date().toISOString(),
            }
          : { reminderLastTriggeredAt: new Date().toISOString() };
        await db.tasks.update(task.id, update);
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, ...update } : item,
          ),
        );
      }
    };
    void checkReminders();
    const timer = window.setInterval(() => void checkReminders(), 30_000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const completionRate =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const openTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.completed),
    [tasks],
  );
  const calendarTasks = useMemo(
    () => openTasks.filter((task) => task.dueDate),
    [openTasks],
  );
  const analyticsTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesStart =
          !analyticsStartDate ||
          (task.dueDate ?? task.createdAt.slice(0, 10)) >= analyticsStartDate;
        const matchesEnd =
          !analyticsEndDate ||
          (task.dueDate ?? task.createdAt.slice(0, 10)) <= analyticsEndDate;
        const matchesQuadrant =
          analyticsQuadrant === "ALL" || task.quadrant === analyticsQuadrant;
        const matchesStatus =
          analyticsStatus === "ALL" || taskStatus(task) === analyticsStatus;
        return matchesStart && matchesEnd && matchesQuadrant && matchesStatus;
      }),
    [
      analyticsEndDate,
      analyticsQuadrant,
      analyticsStartDate,
      analyticsStatus,
      tasks,
    ],
  );
  const analyticsCompleted = analyticsTasks.filter(
    (task) => task.completed,
  ).length;
  const analyticsPending = analyticsTasks.filter(
    (task) => !task.completed,
  ).length;
  const analyticsOverdue = analyticsTasks.filter(
    (task) => dueStatus(task) === "overdue",
  ).length;
  const analyticsByQuadrant = focusAreas.map((area) => ({
    label: area.label,
    count: analyticsTasks.filter((task) => task.quadrant === area.quadrant)
      .length,
  }));
  const analyticsByStatus = taskStatuses
    .map((status) => ({
      label: status,
      count: analyticsTasks.filter((task) => taskStatus(task) === status)
        .length,
    }))
    .filter((item) => item.count > 0);
  const analyticsByDate = useMemo(() => {
    const grouped = new Map<string, { total: number; completed: number }>();
    analyticsTasks.forEach((task) => {
      const date = (task.completedAt ?? task.dueDate ?? task.createdAt).slice(
        0,
        10,
      );
      const current = grouped.get(date) ?? { total: 0, completed: 0 };
      grouped.set(date, {
        total: current.total + 1,
        completed: current.completed + (task.completed ? 1 : 0),
      });
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-7)
      .map(([date, values]) => ({ date, ...values }));
  }, [analyticsTasks]);

  function getPage<T>(listKey: string, items: T[]) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const requestedPage = pageByList[listKey] ?? 1;
    const page = Math.min(requestedPage, totalPages);
    return {
      page,
      totalPages,
      pageItems: items.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  function setPage(listKey: string, page: number) {
    setPageByList((current) => ({ ...current, [listKey]: page }));
  }

  function renderPagination(listKey: string, totalItems: number) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(pageByList[listKey] ?? 1, totalPages);
    const pages = Array.from(
      { length: totalPages },
      (_, index) => index + 1,
    ).slice(Math.max(0, currentPage - 3), currentPage + 2);
    return (
      <div className="pagination">
        <span>
          {totalItems} records - Page {currentPage} of {totalPages}
        </span>
        <label>
          Rows
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageByList({});
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setPage(listKey, currentPage - 1)}
        >
          Previous
        </button>
        {pages.map((page) => (
          <button
            className={page === currentPage ? "current" : ""}
            key={page}
            type="button"
            onClick={() => setPage(listKey, page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setPage(listKey, currentPage + 1)}
        >
          Next
        </button>
      </div>
    );
  }

  function exportAnalytics() {
    const rows = analyticsTasks.map((task, index) => ({
      "Sl. No.": index + 1,
      Task: task.title,
      Quadrant:
        focusAreas.find((area) => area.quadrant === task.quadrant)?.label ??
        task.quadrant,
      Date: task.dueDate ?? "",
      "Closed Date": task.completedAt
        ? new Date(task.completedAt).toLocaleDateString()
        : "",
      Status: taskStatus(task),
      "Description / Remarks": task.closureRemarks ?? "",
      "Active Follow-up": task.followUps?.some(
        (followUp) => followUp.status === "Active",
      )
        ? "Yes"
        : "No",
      "Next Audit Date":
        task.audits
          ?.filter((audit) => audit.status === "Planned")
          .sort((left, right) =>
            left.auditDate.localeCompare(right.auditDate),
          )[0]?.auditDate ?? "",
      Reminder: task.reminderAt
        ? new Date(task.reminderAt).toLocaleString()
        : "",
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 34 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 48 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");
    XLSX.writeFile(
      workbook,
      `focusmatrix-analytics-${localDateInputValue()}.xlsx`,
    );
  }

  function exportLearningAnalytics() {
    const rows = studySessions.map((session, index) => ({
      "Sl. No.": index + 1,
      Subject:
        learningNodes.find((node) => node.id === session.subjectId)?.name ?? "",
      Day: session.dayId
        ? (learningNodes.find((node) => node.id === session.dayId)?.name ?? "")
        : "",
      Topic: session.topicId
        ? (learningNodes.find((node) => node.id === session.topicId)?.name ??
          "")
        : "",
      "Start Date & Time": session.startAt,
      "End Date & Time": session.endAt ?? "",
      "Planned Duration": session.plannedMinutes,
      "Actual Duration": session.actualMinutes,
      Status: session.status,
      Notes: session.notes ?? "",
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 24 },
      { wch: 18 },
      { wch: 30 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 48 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Learning Sessions");
    XLSX.writeFile(
      workbook,
      `focusmatrix-learning-${localDateInputValue()}.xlsx`,
    );
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const reminderAt = reminderEnabled
      ? new Date(`${dueDate}T${reminderTime}`).toISOString()
      : undefined;
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      urgent,
      important,
      quadrant: calculateQuadrant(urgent, important),
      completed: false,
      status: "Pending",
      estimatedMinutes,
      dueDate,
      reminderAt,
      reminderRecurrence: reminderEnabled ? reminderRecurrence : "NONE",
      createdAt: now,
    };
    if (
      reminderAt &&
      "Notification" in window &&
      Notification.permission === "default"
    )
      await Notification.requestPermission();
    await db.tasks.add(task);
    setTasks((current) => [task, ...current]);
    setTaskTitle("");
    setUrgent(false);
    setImportant(false);
    setDueDate(localDateInputValue());
    setReminderEnabled(false);
    setReminderTime("09:00");
    setReminderRecurrence("NONE");
    setEstimatedMinutes(30);
    setTaskModalOpen(false);
  }

  async function createLearningSession(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!learningTopic.trim() || !learningGoal.trim()) return;
    const session: LearningSession = {
      id: crypto.randomUUID(),
      topic: learningTopic.trim(),
      goal: learningGoal.trim(),
      date: learningDate,
      startTime: learningStartTime,
      plannedMinutes: learningPlannedMinutes,
      actualMinutes: 0,
      status: "Planned",
      notes: learningNotes.trim() || undefined,
      reminderAt: learningReminder
        ? new Date(`${learningDate}T${learningStartTime}`).toISOString()
        : undefined,
      reminderRecurrence: learningReminder ? "DAILY" : "NONE",
      createdAt: new Date().toISOString(),
    };
    if (
      session.reminderAt &&
      "Notification" in window &&
      Notification.permission === "default"
    )
      await Notification.requestPermission();
    await db.learningSessions.add(session);
    setLearningSessions((current) =>
      [...current, session].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    );
    setLearningTopic("");
    setLearningGoal("");
    setLearningNotes("");
    setLearningDate(localDateInputValue());
    setLearningReminder(false);
    setLearningModalOpen(false);
  }

  async function createLearningNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!learningNodeName.trim()) return;
    const node: LearningNode = {
      id: crypto.randomUUID(),
      parentId: learningNodeParent,
      type: learningNodeType,
      name: learningNodeName.trim(),
      goal: learningNodeGoal.trim() || undefined,
      plannedMinutes: learningNodePlanned,
      actualMinutes: 0,
      status: "Planned",
      description:
        learningNodeType === "subject"
          ? roadmapDescription.trim() || undefined
          : undefined,
      startDate: learningNodeType === "subject" ? roadmapStartDate : undefined,
      targetDate:
        learningNodeType === "subject"
          ? roadmapTargetDate || undefined
          : undefined,
      dailyTargetMinutes:
        learningNodeType === "subject" ? roadmapDailyMinutes : undefined,
      weeklyTargetMinutes:
        learningNodeType === "subject" ? roadmapWeeklyMinutes : undefined,
      priority: learningNodeType === "subject" ? roadmapPriority : undefined,
      roadmapStatus: learningNodeType === "subject" ? roadmapStatus : undefined,
      progressPercent:
        learningNodeType === "subject" ? roadmapProgress : undefined,
      milestones:
        learningNodeType === "subject"
          ? roadmapMilestones
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      createdAt: new Date().toISOString(),
    };
    await db.learningNodes.add(node);
    setLearningNodes((current) => [...current, node]);
    setLearningNodeName("");
    setLearningNodeGoal("");
    setRoadmapDescription("");
    setRoadmapTargetDate("");
    setRoadmapProgress(0);
    setRoadmapMilestones("");
    setNodeModalOpen(false);
  }

  async function startStudyTimer(node: LearningNode) {
    if (activeTimer && activeTimer.nodeId !== node.id) {
      const shouldSwitch = window.confirm(
        "Another study timer is currently running. Do you want to stop it and start this timer?",
      );
      if (!shouldSwitch) return;
      await stopStudyTimer();
    }
    if (!activeTimer)
      setActiveTimer({
        nodeId: node.id,
        startedAt: new Date().toISOString(),
        elapsed: 0,
        paused: false,
      });
  }

  function pauseStudyTimer() {
    if (!activeTimer || activeTimer.paused) return;
    const elapsed = Math.floor(
      (Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000,
    );
    setActiveTimer({ ...activeTimer, elapsed, paused: true });
  }

  function resumeStudyTimer() {
    if (!activeTimer || !activeTimer.paused) return;
    setActiveTimer({
      ...activeTimer,
      startedAt: new Date(
        Date.now() - activeTimer.elapsed * 1000,
      ).toISOString(),
      paused: false,
    });
  }

  async function stopStudyTimer() {
    if (!activeTimer) return;
    const node = learningNodes.find((item) => item.id === activeTimer.nodeId);
    if (!node) {
      setActiveTimer(null);
      return;
    }
    const actualMinutes = Math.max(1, Math.round(activeTimer.elapsed / 60));
    const session: StudySession = {
      id: crypto.randomUUID(),
      subjectId:
        node.type === "subject"
          ? node.id
          : (learningNodes.find(
              (item) => item.id === node.parentId && item.type === "subject",
            )?.id ?? node.id),
      dayId:
        node.type === "day"
          ? node.id
          : learningNodes.find(
              (item) => item.id === node.parentId && item.type === "day",
            )?.id,
      topicId: node.type === "topic" ? node.id : undefined,
      startAt: activeTimer.startedAt,
      endAt: new Date().toISOString(),
      plannedMinutes: node.plannedMinutes,
      actualMinutes,
      status: "Completed",
    };
    await db.studySessions.add(session);
    await db.learningNodes.update(node.id, {
      actualMinutes: node.actualMinutes + actualMinutes,
      status: "In Progress",
    });
    setStudySessions((current) => [session, ...current]);
    setLearningNodes((current) =>
      current.map((item) =>
        item.id === node.id
          ? {
              ...item,
              actualMinutes: item.actualMinutes + actualMinutes,
              status: "In Progress",
            }
          : item,
      ),
    );
    setActiveTimer(null);
  }

  function timerLabel(seconds: number) {
    return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  async function updateLearningSession(
    session: LearningSession,
    update: Partial<LearningSession>,
  ) {
    const updated = { ...session, ...update };
    if (update.status === "Completed" && !updated.completedAt)
      updated.completedAt = new Date().toISOString();
    await db.learningSessions.update(session.id, updated);
    setLearningSessions((current) =>
      current.map((item) => (item.id === session.id ? updated : item)),
    );
  }

  async function completeTask(task: Task) {
    const completedAt = task.completed ? undefined : new Date().toISOString();
    const status = task.completed ? "Pending" : "Completed";
    await db.tasks.update(task.id, {
      completed: !task.completed,
      completedAt,
      status,
    });
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, completed: !item.completed, completedAt, status }
          : item,
      ),
    );
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    if (status === "Closed") {
      setClosureTask(task);
      setClosureRemarks(task.closureRemarks ?? "");
      return;
    }
    const completed = status === "Completed";
    const completedAt = completed
      ? (task.completedAt ?? new Date().toISOString())
      : undefined;
    await db.tasks.update(task.id, { status, completed, completedAt });
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status, completed, completedAt }
          : item,
      ),
    );
  }

  async function closeTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closureTask) return;
    const completedAt = closureTask.completedAt ?? new Date().toISOString();
    const update = {
      status: "Closed" as TaskStatus,
      completed: true,
      completedAt,
      closureRemarks: closureRemarks.trim(),
    };
    await db.tasks.update(closureTask.id, update);
    setTasks((current) =>
      current.map((item) =>
        item.id === closureTask.id ? { ...item, ...update } : item,
      ),
    );
    setClosureTask(null);
    setClosureRemarks("");
  }

  async function addFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !followUpRemarks.trim()) return;
    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      date: followUpDate,
      remarks: followUpRemarks.trim(),
      nextAction: followUpAction.trim() || undefined,
      status: "Active",
      createdAt: new Date().toISOString(),
    };
    const followUps = [...(selectedTask.followUps ?? []), followUp];
    await db.tasks.update(selectedTask.id, { followUps });
    const updated = { ...selectedTask, followUps };
    setTasks((current) =>
      current.map((item) => (item.id === selectedTask.id ? updated : item)),
    );
    setSelectedTask(updated);
    setFollowUpRemarks("");
    setFollowUpAction("");
  }

  async function addAudit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !auditResponsible.trim()) return;
    const audit: AuditPlan = {
      id: crypto.randomUUID(),
      auditDate,
      status: "Planned",
      remarks: auditRemarks.trim(),
      nextAuditDate: nextAuditDate || undefined,
      responsiblePerson: auditResponsible.trim(),
      createdAt: new Date().toISOString(),
    };
    const audits = [...(selectedTask.audits ?? []), audit];
    await db.tasks.update(selectedTask.id, { audits });
    const updated = { ...selectedTask, audits };
    setTasks((current) =>
      current.map((item) => (item.id === selectedTask.id ? updated : item)),
    );
    setSelectedTask(updated);
    setAuditRemarks("");
    setAuditResponsible("");
    setNextAuditDate("");
  }

  async function updateFollowUpStatus(
    followUpId: string,
    status: FollowUp["status"],
  ) {
    if (!selectedTask) return;
    const followUps = (selectedTask.followUps ?? []).map((followUp) =>
      followUp.id === followUpId ? { ...followUp, status } : followUp,
    );
    await db.tasks.update(selectedTask.id, { followUps });
    const updated = { ...selectedTask, followUps };
    setSelectedTask(updated);
    setTasks((current) =>
      current.map((item) => (item.id === selectedTask.id ? updated : item)),
    );
  }

  async function updateAuditStatus(
    auditId: string,
    status: AuditPlan["status"],
  ) {
    if (!selectedTask) return;
    const audits = (selectedTask.audits ?? []).map((audit) =>
      audit.id === auditId ? { ...audit, status } : audit,
    );
    await db.tasks.update(selectedTask.id, { audits });
    const updated = { ...selectedTask, audits };
    setSelectedTask(updated);
    setTasks((current) =>
      current.map((item) => (item.id === selectedTask.id ? updated : item)),
    );
  }

  function renderTaskTable(tableTasks: Task[], listKey = "tasks") {
    const { page, pageItems } = getPage(listKey, tableTasks);
    return (
      <div className="task-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Task</th>
              <th>Quadrant</th>
              <th>Date</th>
              <th>Closed Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((task, index) => (
              <tr key={task.id}>
                <td>{(page - 1) * pageSize + index + 1}</td>
                <td>
                  <button
                    className="table-task"
                    type="button"
                    onClick={() => setSelectedTask(task)}
                  >
                    <span
                      className={
                        task.completed ? "task-check completed" : "task-check"
                      }
                    />
                    {task.title}
                    {task.followUps?.some(
                      (followUp) => followUp.status === "Active",
                    ) && <span className="follow-up-badge">Follow-up</span>}
                    {listKey === "planner" && (
                      <span className="estimate-badge">
                        {task.estimatedMinutes ?? 0} min
                      </span>
                    )}
                    {listKey === "planner" &&
                      task.audits?.some(
                        (audit) => audit.status === "Planned",
                      ) && <span className="audit-badge">Audit</span>}
                    {listKey === "planner" && task.reminderAt && (
                      <span className="reminder-badge">Reminder</span>
                    )}
                  </button>
                </td>
                <td>
                  {
                    focusAreas.find((area) => area.quadrant === task.quadrant)
                      ?.label
                  }
                </td>
                <td className={dueStatus(task)}>{task.dueDate ?? "No date"}</td>
                <td>
                  {task.completedAt
                    ? new Date(task.completedAt).toLocaleDateString()
                    : "-"}
                </td>
                <td>
                  <select
                    className="status-select"
                    aria-label={`Status for ${task.title}`}
                    value={taskStatus(task)}
                    onChange={(event) =>
                      void updateTaskStatus(
                        task,
                        event.target.value as TaskStatus,
                      )
                    }
                  >
                    {taskStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tableTasks.length && (
          <p className="completed-empty">No tasks belong to this view yet.</p>
        )}
        {renderPagination(listKey, tableTasks.length)}
      </div>
    );
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileName.trim();
    if (!name) return;
    localStorage.setItem("focusmatrix-display-name", name);
    setDisplayName(name);
    setProfileOpen(false);
  }

  async function handleGoogleSignIn() {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Unable to start Google sign-in.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const result =
        authMode === "signin"
          ? await signInWithEmail(authEmail, authPassword)
          : await signUpWithEmail(authEmail, authPassword);
      if (result.error) throw result.error;
      setAuthMessage(
        authMode === "signin"
          ? "Signed in successfully."
          : "Account created. Check your email to confirm it.",
      );
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Focus size={19} strokeWidth={2.5} />
          </div>
          <div>
            <strong>FocusMatrix</strong>
            <span>Personal command center</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="section-label">Workspace</span>
          <nav aria-label="Primary navigation" className="primary-nav">
            {navigation.map(({ label, icon: Icon }) => (
              <button
                className={
                  activeSection === label ? "nav-item active" : "nav-item"
                }
                key={label}
                type="button"
                onClick={() => {
                  setActiveSection(label);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {activeSection === label && <span className="nav-pip" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-section sidebar-bottom">
          <span className="section-label">Personal</span>
          <button
            className={
              activeSection === "Habits" ? "nav-item active" : "nav-item"
            }
            type="button"
            onClick={() => setActiveSection("Habits")}
          >
            <Clock3 size={18} />
            <span>Habits</span>
          </button>
          <button
            className={
              activeSection === "Settings" ? "nav-item active" : "nav-item"
            }
            type="button"
            onClick={() => setActiveSection("Settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            className={
              activeSection === "Help center" ? "nav-item active" : "nav-item"
            }
            type="button"
            onClick={() => setActiveSection("Help center")}
          >
            <CircleHelp size={18} />
            <span>Help center</span>
          </button>
          <div className="privacy-note">
            <span className="privacy-dot" />
            Local-first workspace
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{activeSection}</strong>
          </div>
          <div className="topbar-actions">
            <span className="offline-status">
              <span className="privacy-dot" />
              Offline ready
            </span>
            <button
              className="avatar"
              type="button"
              aria-label="Open profile and account"
              onClick={() => {
                setProfileName(displayName);
                setProfileOpen(true);
              }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {activeSection === "Dashboard" ? (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">Tuesday, September 8, 2026</p>
                  <h1>
                    Good morning, {displayName}
                    <span className="title-dot">.</span>
                  </h1>
                  <p className="welcome-copy">
                    Make room for what matters. Your day starts here.
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setTaskModalOpen(true)}
                >
                  <Plus size={18} />
                  New task <kbd>N</kbd>
                </button>
              </section>

              <section className="stats-grid" aria-label="Today's summary">
                <div className="stat-card stat-highlight">
                  <div className="stat-label">Today's focus</div>
                  <div className="stat-value">
                    {openTasks.length} <span>tasks</span>
                  </div>
                  <div className="stat-meta">
                    <Sparkles size={14} />
                    {openTasks.length ? "Ready to focus" : "A clear slate"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Completion rate</div>
                  <div className="stat-value">
                    {completionRate}
                    <span>%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Tasks completed</div>
                  <div className="stat-value">
                    {completedCount} <span>total</span>
                  </div>
                  <div className="stat-meta muted">Keep the momentum going</div>
                </div>
              </section>

              <section className="section-heading">
                <div>
                  <p className="eyebrow">Your decision framework</p>
                  <h2>Focus by quadrant</h2>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    document
                      .querySelector(".quadrant-grid")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Open matrix <ChevronRight size={16} />
                </button>
              </section>
              <section className="quadrant-grid">
                {focusAreas.map((area) => {
                  const quadrantTasks = openTasks.filter(
                    (task) => task.quadrant === area.quadrant,
                  );
                  const isSelected = selectedQuadrant === area.quadrant;
                  return (
                    <article
                      className={`quadrant-card ${area.accent} ${isSelected ? "selected" : ""}`}
                      key={area.label}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedQuadrant(area.quadrant);
                        setPageByList({});
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedQuadrant(area.quadrant);
                          setPageByList({});
                        }
                      }}
                    >
                      <div className="quadrant-top">
                        <span className="quadrant-dot" />
                        <span>{area.hint}</span>
                        <span className="quadrant-count">
                          {quadrantTasks.length}
                        </span>
                      </div>
                      <h3>{area.label}</h3>
                      <p>
                        {quadrantTasks.length
                          ? `${quadrantTasks.length} task${quadrantTasks.length === 1 ? "" : "s"} to work through.`
                          : "No tasks here. A quiet quadrant is useful."}
                      </p>
                      {quadrantTasks.slice(0, 2).map((task) => (
                        <button
                          className="quadrant-task"
                          key={task.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void completeTask(task);
                          }}
                        >
                          <span className="task-check" />
                          <span className="task-name">{task.title}</span>
                          <span className={`task-date ${dueStatus(task)}`}>
                            {task.dueDate
                              ? new Date(
                                  `${task.dueDate}T00:00:00`,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "No date"}
                          </span>
                          {task.reminderAt && (
                            <Bell
                              size={12}
                              aria-label={`Reminder ${reminderLabel(task)}`}
                            />
                          )}
                        </button>
                      ))}
                      <button
                        className="add-quiet"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setUrgent(
                            area.quadrant === "DO_FIRST" ||
                              area.quadrant === "DELEGATE",
                          );
                          setImportant(
                            area.quadrant === "DO_FIRST" ||
                              area.quadrant === "SCHEDULE",
                          );
                          setTaskModalOpen(true);
                        }}
                      >
                        <Plus size={15} />
                        Add task
                      </button>
                    </article>
                  );
                })}
              </section>

              <section className="upcoming-section">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Today</p>
                    <h2>Upcoming tasks</h2>
                  </div>
                  <div className="panel-heading-actions">
                    <ListTodo size={19} />
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setActiveSection("Planner")}
                    >
                      View Planner <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                {selectedQuadrant ? (
                  <div className="quadrant-detail">
                    <div className="detail-heading">
                      <div>
                        <p className="eyebrow">Selected quadrant</p>
                        <h3>
                          {
                            focusAreas.find(
                              (area) => area.quadrant === selectedQuadrant,
                            )?.label
                          }
                        </h3>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setSelectedQuadrant(null)}
                      >
                        <ChevronRight size={15} className="back-icon" />
                        Back to overview
                      </button>
                    </div>
                    {renderTaskTable(
                      tasks.filter(
                        (task) => task.quadrant === selectedQuadrant,
                      ),
                      "drilldown",
                    )}
                  </div>
                ) : (
                  renderTaskTable(tasks, "upcoming")
                )}
              </section>
              <section className="thoughts-section">
                <article className="empty-panel focus-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">A small ritual</p>
                      <h2>Today's focus</h2>
                    </div>
                    <Target size={19} />
                  </div>
                  <div className="focus-quote">
                    <span className="quote-mark">&quot;</span>
                    <p>What would make today feel meaningful?</p>
                    <span className="quote-line" />
                  </div>
                  <div className="focus-footer">
                    <span>Set one intention to begin</span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Set intention"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </article>
              </section>
              <section className="completed-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">History</p>
                    <h2>Closed tasks</h2>
                  </div>
                  <CheckCircle2 size={19} />
                </div>
                {completedTasks.length ? (
                  <div className="completed-list">
                    {getPage("history", completedTasks).pageItems.map(
                      (task) => (
                        <div className="completed-row" key={task.id}>
                          <span className="completed-check">
                            <CheckCircle2 size={16} />
                          </span>
                          <span className="completed-title">{task.title}</span>
                          <small>
                            {task.completedAt
                              ? new Date(task.completedAt).toLocaleDateString()
                              : "Completed"}
                          </small>
                          <button
                            className="reopen-button"
                            type="button"
                            onClick={() => void completeTask(task)}
                          >
                            <RotateCcw size={14} />
                            Reopen
                          </button>
                        </div>
                      ),
                    )}
                    {renderPagination("history", completedTasks.length)}
                  </div>
                ) : (
                  <p className="completed-empty">
                    Completed tasks will appear here so you can reopen them
                    later.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="section-view">
              <div className="section-view-heading">
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h1>{activeSection}</h1>
                  <p className="welcome-copy">
                    Your local {activeSection.toLowerCase()} workspace.
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    activeSection === "Planner"
                      ? setLearningModalOpen(true)
                      : setTaskModalOpen(true)
                  }
                >
                  <Plus size={18} />
                  {activeSection === "Planner"
                    ? "Add learning session"
                    : "New task"}
                </button>
              </div>
              {activeSection === "Planner" &&
                (() => {
                  const activeNode = activeTimer
                    ? learningNodes.find(
                        (node) => node.id === activeTimer.nodeId,
                      )
                    : undefined;
                  const currentPlannerNode =
                    learningNodes.find(
                      (node) => node.id === selectedLearningNodeId,
                    ) ?? activeNode;
                  const roadmapSubject =
                    currentPlannerNode?.type === "subject"
                      ? currentPlannerNode
                      : learningNodes.find(
                          (node) =>
                            node.type === "subject" &&
                            (node.id === currentPlannerNode?.parentId ||
                              learningNodes.find(
                                (parent) =>
                                  parent.id === currentPlannerNode?.parentId,
                              )?.parentId === node.id),
                        );
                  const deadlineDate = roadmapSubject?.targetDate
                    ? new Date(`${roadmapSubject.targetDate}T00:00:00`)
                    : undefined;
                  const daysRemaining = deadlineDate
                    ? Math.ceil(
                        (deadlineDate.getTime() - Date.now()) / 86400000,
                      )
                    : undefined;
                  const roadmapHealth =
                    daysRemaining !== undefined && daysRemaining < 0
                      ? "Overdue"
                      : roadmapSubject?.roadmapStatus === "On Hold"
                        ? "At Risk"
                        : "On Track";
                  const totalPlanned = learningNodes.reduce(
                    (sum, node) => sum + node.plannedMinutes,
                    0,
                  );
                  const totalActual = learningNodes.reduce(
                    (sum, node) => sum + node.actualMinutes,
                    0,
                  );
                  const today = localDateInputValue();
                  const todaySessions = learningSessions.filter(
                    (session) => session.date === today,
                  );
                  const completedSessions = learningSessions.filter(
                    (session) => session.status === "Completed",
                  );
                  const plannedMinutes = todaySessions.reduce(
                    (total, session) => total + session.plannedMinutes,
                    0,
                  );
                  const actualMinutes = todaySessions.reduce(
                    (total, session) => total + session.actualMinutes,
                    0,
                  );
                  const weekMinutes = learningSessions
                    .filter((session) => session.date >= today)
                    .reduce(
                      (total, session) => total + session.actualMinutes,
                      0,
                    );
                  const monthMinutes = learningSessions
                    .filter(
                      (session) =>
                        session.date.slice(0, 7) === today.slice(0, 7),
                    )
                    .reduce(
                      (total, session) => total + session.actualMinutes,
                      0,
                    );
                  const learningPage = getPage(
                    "learning",
                    learningSessions.filter((session) => session.date >= today),
                  );
                  return (
                    <div className="planner-view">
                      <div
                        className={`planner-summary-bar ${roadmapHealth.toLowerCase().replace(" ", "-")}`}
                      >
                        <button
                          className="timer-summary"
                          type="button"
                          onClick={() =>
                            activeNode &&
                            setSelectedLearningNodeId(activeNode.id)
                          }
                        >
                          <span>Timer</span>
                          <strong>
                            {activeTimer
                              ? timerLabel(activeTimer.elapsed)
                              : "00:00:00"}
                          </strong>
                          <small>
                            {activeNode?.name ?? "No active study session"}
                          </small>
                        </button>
                        <button
                          className="deadline-summary"
                          type="button"
                          onClick={() =>
                            roadmapSubject &&
                            setSelectedLearningNodeId(roadmapSubject.id)
                          }
                        >
                          <span>Deadline</span>
                          <strong>
                            {deadlineDate
                              ? deadlineDate.toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "No deadline"}
                          </strong>
                          <small>
                            {daysRemaining === undefined
                              ? "Set a roadmap target"
                              : `${Math.max(0, daysRemaining)} days remaining · ${roadmapHealth}`}
                          </small>
                        </button>
                        <div className="timer-summary-actions">
                          {activeTimer && !activeTimer.paused && (
                            <button
                              className="icon-button"
                              type="button"
                              aria-label="Pause timer"
                              onClick={pauseStudyTimer}
                            >
                              Pause
                            </button>
                          )}
                          {activeTimer?.paused && (
                            <button
                              className="icon-button"
                              type="button"
                              aria-label="Resume timer"
                              onClick={resumeStudyTimer}
                            >
                              Resume
                            </button>
                          )}
                          {activeTimer && (
                            <button
                              className="icon-button stop"
                              type="button"
                              aria-label="Stop timer"
                              onClick={() => void stopStudyTimer()}
                            >
                              Stop
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="learning-dashboard-header">
                        <div>
                          <p className="eyebrow">Independent learning system</p>
                          <h2>Learning Planner & Progress Tracker</h2>
                          <p className="welcome-copy">
                            Subject / Day / Topic / Timer / Session history /
                            Progress
                          </p>
                        </div>
                        <div className="learning-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => {
                              setLearningNodeType("subject");
                              setLearningNodeParent(undefined);
                              setNodeModalOpen(true);
                            }}
                          >
                            Create Folder
                          </button>
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => setLearningModalOpen(true)}
                          >
                            <Plus size={18} />
                            Plan session
                          </button>
                        </div>
                      </div>
                      <div className="learning-summary-grid">
                        <div className="stat-card stat-highlight">
                          <div className="stat-label">Planned study time</div>
                          <div className="stat-value">
                            {Math.round(totalPlanned / 60)}
                            <span>h</span>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Actual study time</div>
                          <div className="stat-value">
                            {Math.round(totalActual / 60)}
                            <span>h</span>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Study sessions</div>
                          <div className="stat-value">
                            {studySessions.length}
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Learning progress</div>
                          <div className="stat-value">
                            {totalPlanned
                              ? Math.round((totalActual / totalPlanned) * 100)
                              : 0}
                            <span>%</span>
                          </div>
                        </div>
                      </div>
                      <div className="learning-tree-panel">
                        <div className="panel-heading">
                          <div>
                            <p className="eyebrow">Learning folders</p>
                            <h2>Subjects, days & topics</h2>
                          </div>
                          <ClipboardList size={19} />
                        </div>
                        {renderLearningTree(
                          learningNodes,
                          activeTimer,
                          startStudyTimer,
                          setLearningNodeType,
                          setLearningNodeParent,
                          setNodeModalOpen,
                          pauseStudyTimer,
                          resumeStudyTimer,
                          stopStudyTimer,
                          expandedLearningNodes,
                          toggleLearningNode,
                          selectedLearningNodeId,
                          setSelectedLearningNodeId,
                        )}
                        {activeNode && (
                          <div className="active-timer-bar">
                            <span>
                              Study timer: <strong>{activeNode.name}</strong>
                            </span>
                            <strong>
                              {timerLabel(activeTimer?.elapsed ?? 0)}
                            </strong>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => void stopStudyTimer()}
                            >
                              Stop & save session
                            </button>
                          </div>
                        )}
                      </div>
                      {activeSection === legacyPlannerSection && (
                        <>
                          <div className="planner-heading">
                            <div>
                              <p className="eyebrow">Learning & progress</p>
                              <h2>Daily Learning Plan</h2>
                              <p className="welcome-copy">
                                Build consistency one focused session at a time.
                              </p>
                            </div>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => setLearningModalOpen(true)}
                            >
                              <Plus size={18} />
                              Add learning session
                            </button>
                          </div>
                          <div className="planner-summary learning-summary">
                            <div className="stat-card stat-highlight">
                              <div className="stat-label">Today's sessions</div>
                              <div className="stat-value">
                                {todaySessions.length}
                              </div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-label">Planned time</div>
                              <div className="stat-value">
                                {plannedMinutes}
                                <span>min</span>
                              </div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-label">
                                Actual focus time
                              </div>
                              <div className="stat-value">
                                {actualMinutes}
                                <span>min</span>
                              </div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-label">
                                Today's completion
                              </div>
                              <div className="stat-value">
                                {todaySessions.length
                                  ? Math.round(
                                      (completedSessions.filter(
                                        (session) => session.date === today,
                                      ).length /
                                        todaySessions.length) *
                                        100,
                                    )
                                  : 0}
                                <span>%</span>
                              </div>
                            </div>
                          </div>
                          <div className="planner-panel">
                            <div className="panel-heading">
                              <div>
                                <p className="eyebrow">Today</p>
                                <h2>Today's Learning Plan</h2>
                              </div>
                              <ClipboardList size={19} />
                            </div>
                            {learningPage.pageItems.length ? (
                              <div className="learning-list">
                                {learningPage.pageItems.map((session) => (
                                  <div
                                    className="learning-row"
                                    key={session.id}
                                  >
                                    <div>
                                      <strong>{session.topic}</strong>
                                      <small>{session.goal}</small>
                                    </div>
                                    <span>
                                      {session.startTime ?? ""} -{" "}
                                      {session.plannedMinutes} min
                                    </span>
                                    <select
                                      value={session.status}
                                      onChange={(event) =>
                                        void updateLearningSession(session, {
                                          status: event.target
                                            .value as LearningStatus,
                                        })
                                      }
                                    >
                                      <option>Planned</option>
                                      <option>In Progress</option>
                                      <option>Completed</option>
                                      <option>Postponed</option>
                                      <option>Missed</option>
                                    </select>
                                    <button
                                      className="secondary-button"
                                      type="button"
                                      onClick={() =>
                                        setSelectedLearningSession(session)
                                      }
                                    >
                                      Details
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="empty-content">
                                <div className="empty-icon">
                                  <ClipboardList size={22} />
                                </div>
                                <h3>No learning sessions planned</h3>
                                <p>
                                  Add a topic and goal to begin building your
                                  learning rhythm.
                                </p>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => setLearningModalOpen(true)}
                                >
                                  <Plus size={16} />
                                  Add session
                                </button>
                              </div>
                            )}
                            {renderPagination(
                              "learning",
                              learningSessions.filter(
                                (session) => session.date >= today,
                              ).length,
                            )}
                          </div>
                          <div className="learning-progress-grid">
                            <div className="analytics-panel">
                              <h3>Progress overview</h3>
                              <div className="metric-row">
                                <span>Today</span>
                                <div className="metric-track">
                                  <span
                                    style={{
                                      width: `${plannedMinutes ? Math.min(100, (actualMinutes / plannedMinutes) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                                <strong>
                                  {actualMinutes}/{plannedMinutes}m
                                </strong>
                              </div>
                              <div className="metric-row">
                                <span>This week</span>
                                <div className="metric-track">
                                  <span
                                    style={{
                                      width: `${Math.min(100, weekMinutes / 6)}%`,
                                    }}
                                  />
                                </div>
                                <strong>{weekMinutes}m</strong>
                              </div>
                              <div className="metric-row">
                                <span>This month</span>
                                <div className="metric-track">
                                  <span
                                    style={{
                                      width: `${Math.min(100, monthMinutes / 20)}%`,
                                    }}
                                  />
                                </div>
                                <strong>{monthMinutes}m</strong>
                              </div>
                            </div>
                            <div className="analytics-panel">
                              <h3>Learning consistency</h3>
                              <div className="learning-stat">
                                <strong>{learningSessions.length}</strong>
                                <span>Total sessions</span>
                              </div>
                              <div className="learning-stat">
                                <strong>{completedSessions.length}</strong>
                                <span>Completed sessions</span>
                              </div>
                              <div className="learning-stat">
                                <strong>
                                  {learningSessions.length
                                    ? Math.round(
                                        (completedSessions.length /
                                          learningSessions.length) *
                                          100,
                                      )
                                    : 0}
                                  %
                                </strong>
                                <span>Overall completion</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              {activeSection === "Matrix" && (
                <div className="quadrant-grid section-view-grid">
                  {focusAreas.map((area) => {
                    const areaTasks = openTasks.filter(
                      (task) => task.quadrant === area.quadrant,
                    );
                    const matrixPage = getPage(
                      `matrix-${area.quadrant}`,
                      areaTasks,
                    );
                    return (
                      <article
                        className={`quadrant-card ${area.accent}`}
                        key={area.label}
                      >
                        <div className="quadrant-top">
                          <span className="quadrant-dot" />
                          <span>{area.hint}</span>
                          <span className="quadrant-count">
                            {areaTasks.length}
                          </span>
                        </div>
                        <h3>{area.label}</h3>
                        {areaTasks.length ? (
                          matrixPage.pageItems.map((task) => (
                            <button
                              className="quadrant-task"
                              key={task.id}
                              type="button"
                              onClick={() => void completeTask(task)}
                            >
                              <span className="task-check" />
                              <span className="task-name">{task.title}</span>
                            </button>
                          ))
                        ) : (
                          <p>No open tasks here.</p>
                        )}
                        {areaTasks.length > pageSize &&
                          renderPagination(
                            `matrix-${area.quadrant}`,
                            areaTasks.length,
                          )}
                      </article>
                    );
                  })}
                </div>
              )}
              {activeSection === "Tasks" && (
                <div className="section-task-list">
                  {renderTaskTable(tasks, "tasks-tab")}
                </div>
              )}
              {activeSection === "Calendar" && (
                <div className="calendar-view">
                  <p className="eyebrow">
                    {new Date().toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h2>Scheduled task dates</h2>
                  {calendarTasks.length ? (
                    getPage("calendar", calendarTasks).pageItems.map((task) => (
                      <div className="section-task-row" key={task.id}>
                        <CalendarDays size={16} />
                        <span className="task-name">{task.title}</span>
                        <strong>{task.dueDate}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="completed-empty">
                      No tasks have a due date yet.
                    </p>
                  )}
                  {calendarTasks.length > 0 &&
                    renderPagination("calendar", calendarTasks.length)}
                </div>
              )}
              {activeSection === "Analytics" && (
                <div className="analytics-view">
                  <div className="analytics-toolbar">
                    <div>
                      <p className="eyebrow">Task intelligence</p>
                      <h2>Analytics overview</h2>
                    </div>
                    <div className="analytics-export-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={exportAnalytics}
                      >
                        Export Tasks XLSX
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={exportLearningAnalytics}
                      >
                        Export Learning XLSX
                      </button>
                    </div>
                  </div>
                  <div className="analytics-panel learning-analytics-summary">
                    <h3>Learning progress</h3>
                    <div className="analytics-grid">
                      <div>
                        <strong>
                          {Math.round(
                            studySessions.reduce(
                              (total, session) => total + session.actualMinutes,
                              0,
                            ) / 60,
                          )}
                          h
                        </strong>
                        <span>Total study time</span>
                      </div>
                      <div>
                        <strong>{studySessions.length}</strong>
                        <span>Study sessions</span>
                      </div>
                      <div>
                        <strong>
                          {
                            learningNodes.filter(
                              (node) =>
                                node.type === "topic" &&
                                node.status === "Completed",
                            ).length
                          }
                        </strong>
                        <span>Completed topics</span>
                      </div>
                      <div>
                        <strong>
                          {learningNodes.length
                            ? Math.round(
                                (learningNodes.reduce(
                                  (total, node) => total + node.actualMinutes,
                                  0,
                                ) /
                                  Math.max(
                                    1,
                                    learningNodes.reduce(
                                      (total, node) =>
                                        total + node.plannedMinutes,
                                      0,
                                    ),
                                  )) *
                                  100,
                              )
                            : 0}
                          %
                        </strong>
                        <span>Learning progress</span>
                      </div>
                    </div>
                  </div>
                  <div className="analytics-filters">
                    <label>
                      From
                      <input
                        type="date"
                        value={analyticsStartDate}
                        onChange={(event) => {
                          setAnalyticsStartDate(event.target.value);
                          setPageByList({});
                        }}
                      />
                    </label>
                    <label>
                      To
                      <input
                        type="date"
                        value={analyticsEndDate}
                        onChange={(event) => {
                          setAnalyticsEndDate(event.target.value);
                          setPageByList({});
                        }}
                      />
                    </label>
                    <label>
                      Quadrant
                      <select
                        value={analyticsQuadrant}
                        onChange={(event) => {
                          setAnalyticsQuadrant(
                            event.target.value as Quadrant | "ALL",
                          );
                          setPageByList({});
                        }}
                      >
                        <option value="ALL">All quadrants</option>
                        {focusAreas.map((area) => (
                          <option key={area.quadrant} value={area.quadrant}>
                            {area.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={analyticsStatus}
                        onChange={(event) => {
                          setAnalyticsStatus(
                            event.target.value as TaskStatus | "ALL",
                          );
                          setPageByList({});
                        }}
                      >
                        <option value="ALL">All statuses</option>
                        {taskStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="analytics-grid">
                    <div className="stat-card">
                      <div className="stat-label">Total tasks</div>
                      <div className="stat-value">{analyticsTasks.length}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Completed tasks</div>
                      <div className="stat-value">{analyticsCompleted}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Pending tasks</div>
                      <div className="stat-value">{analyticsPending}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Overdue tasks</div>
                      <div className="stat-value">{analyticsOverdue}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Completion rate</div>
                      <div className="stat-value">
                        {analyticsTasks.length
                          ? Math.round(
                              (analyticsCompleted / analyticsTasks.length) *
                                100,
                            )
                          : 0}
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                  <div className="analytics-panels">
                    <div className="analytics-panel">
                      <h3>Tasks by quadrant</h3>
                      {analyticsByQuadrant.map((item) => (
                        <div className="metric-row" key={item.label}>
                          <span>{item.label}</span>
                          <div className="metric-track">
                            <span
                              style={{
                                width: `${analyticsTasks.length ? (item.count / analyticsTasks.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="analytics-panel">
                      <h3>Tasks by status</h3>
                      {analyticsByStatus.length ? (
                        analyticsByStatus.map((item) => (
                          <div className="metric-row" key={item.label}>
                            <span>{item.label}</span>
                            <div className="metric-track">
                              <span
                                style={{
                                  width: `${analyticsTasks.length ? (item.count / analyticsTasks.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <strong>{item.count}</strong>
                          </div>
                        ))
                      ) : (
                        <p className="completed-empty">
                          No status data for this filter.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="analytics-panels">
                    <div className="analytics-panel analytics-trend">
                      <h3>Closed vs pending</h3>
                      <div className="trend-bars">
                        <div>
                          <span
                            className="trend-bar closed"
                            style={{
                              height: `${analyticsTasks.length ? Math.max(8, (analyticsCompleted / analyticsTasks.length) * 100) : 8}%`,
                            }}
                          />
                          <small>Closed</small>
                          <strong>{analyticsCompleted}</strong>
                        </div>
                        <div>
                          <span
                            className="trend-bar pending"
                            style={{
                              height: `${analyticsTasks.length ? Math.max(8, (analyticsPending / analyticsTasks.length) * 100) : 8}%`,
                            }}
                          />
                          <small>Pending</small>
                          <strong>{analyticsPending}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="analytics-panel">
                      <h3>Completion trend by date</h3>
                      {analyticsByDate.length ? (
                        analyticsByDate.map((item) => (
                          <div className="metric-row" key={item.date}>
                            <span>{item.date}</span>
                            <div className="metric-track">
                              <span
                                style={{
                                  width: `${item.total ? (item.completed / item.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <strong>
                              {item.completed}/{item.total}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <p className="completed-empty">
                          No date data for this filter.
                        </p>
                      )}
                    </div>
                  </div>
                  {renderTaskTable(analyticsTasks, "analytics")}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      {isNodeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="task-modal learning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Learning folders</p>
                <h2 id="node-title">
                  Create{" "}
                  {learningNodeType === "subject"
                    ? "Folder"
                    : learningNodeType === "day"
                      ? "Subfolder"
                      : "Topic"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setNodeModalOpen(false)}
              >
                X
              </button>
            </div>
            <form onSubmit={(event) => void createLearningNode(event)}>
              <label htmlFor="node-name">Name</label>
              <input
                id="node-name"
                required
                autoFocus
                value={learningNodeName}
                onChange={(event) => setLearningNodeName(event.target.value)}
                placeholder={
                  learningNodeType === "subject"
                    ? "Python"
                    : learningNodeType === "day"
                      ? "Day 1"
                      : "Variables"
                }
              />
              <label htmlFor="node-goal">Goal / notes</label>
              <textarea
                id="node-goal"
                rows={3}
                value={learningNodeGoal}
                onChange={(event) => setLearningNodeGoal(event.target.value)}
                placeholder="What will you learn?"
              />
              <label htmlFor="node-planned">Planned minutes</label>
              <input
                id="node-planned"
                type="number"
                min="5"
                step="5"
                value={learningNodePlanned}
                onChange={(event) =>
                  setLearningNodePlanned(Number(event.target.value) || 5)
                }
              />
              {learningNodeType === "subject" && (
                <div className="roadmap-fields">
                  <label htmlFor="roadmap-description">
                    Roadmap description
                  </label>
                  <textarea
                    id="roadmap-description"
                    rows={2}
                    value={roadmapDescription}
                    onChange={(event) =>
                      setRoadmapDescription(event.target.value)
                    }
                    placeholder="What will this roadmap achieve?"
                  />
                  <div className="date-fields">
                    <div>
                      <label htmlFor="roadmap-start">Start date</label>
                      <input
                        id="roadmap-start"
                        type="date"
                        value={roadmapStartDate}
                        onChange={(event) =>
                          setRoadmapStartDate(event.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="roadmap-target">Target date</label>
                      <input
                        id="roadmap-target"
                        type="date"
                        value={roadmapTargetDate}
                        onChange={(event) =>
                          setRoadmapTargetDate(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="date-fields">
                    <div>
                      <label htmlFor="roadmap-daily">
                        Daily target minutes
                      </label>
                      <input
                        id="roadmap-daily"
                        type="number"
                        min="0"
                        value={roadmapDailyMinutes}
                        onChange={(event) =>
                          setRoadmapDailyMinutes(
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="roadmap-weekly">
                        Weekly target minutes
                      </label>
                      <input
                        id="roadmap-weekly"
                        type="number"
                        min="0"
                        value={roadmapWeeklyMinutes}
                        onChange={(event) =>
                          setRoadmapWeeklyMinutes(
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="date-fields">
                    <div>
                      <label htmlFor="roadmap-priority">Priority</label>
                      <select
                        id="roadmap-priority"
                        value={roadmapPriority}
                        onChange={(event) =>
                          setRoadmapPriority(
                            event.target.value as "Low" | "Medium" | "High",
                          )
                        }
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="roadmap-status">Status</label>
                      <select
                        id="roadmap-status"
                        value={roadmapStatus}
                        onChange={(event) =>
                          setRoadmapStatus(
                            event.target.value as LearningNode["roadmapStatus"],
                          )
                        }
                      >
                        <option>Not Started</option>
                        <option>In Progress</option>
                        <option>On Hold</option>
                        <option>Completed</option>
                        <option>Overdue</option>
                      </select>
                    </div>
                  </div>
                  <label htmlFor="roadmap-progress">Progress percentage</label>
                  <input
                    id="roadmap-progress"
                    type="number"
                    min="0"
                    max="100"
                    value={roadmapProgress}
                    onChange={(event) =>
                      setRoadmapProgress(Number(event.target.value) || 0)
                    }
                  />
                  <label htmlFor="roadmap-milestones">
                    Milestones (comma separated)
                  </label>
                  <input
                    id="roadmap-milestones"
                    value={roadmapMilestones}
                    onChange={(event) =>
                      setRoadmapMilestones(event.target.value)
                    }
                    placeholder="Variables, Loops, Functions"
                  />
                </div>
              )}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setNodeModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isLearningModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="task-modal learning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Learning planner</p>
                <h2 id="learning-title">New learning session</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setLearningModalOpen(false)}
              >
                X
              </button>
            </div>
            <form onSubmit={(event) => void createLearningSession(event)}>
              <label htmlFor="learning-topic">Topic / subject</label>
              <input
                id="learning-topic"
                required
                autoFocus
                value={learningTopic}
                onChange={(event) => setLearningTopic(event.target.value)}
                placeholder="Python basics"
              />
              <label htmlFor="learning-goal">Specific learning goal</label>
              <input
                id="learning-goal"
                required
                value={learningGoal}
                onChange={(event) => setLearningGoal(event.target.value)}
                placeholder="Understand loops and write three examples"
              />
              <div className="date-fields">
                <div>
                  <label htmlFor="learning-date">Date</label>
                  <input
                    id="learning-date"
                    type="date"
                    value={learningDate}
                    onChange={(event) => setLearningDate(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="learning-start">Start time</label>
                  <input
                    id="learning-start"
                    type="time"
                    value={learningStartTime}
                    onChange={(event) =>
                      setLearningStartTime(event.target.value)
                    }
                  />
                </div>
                <div>
                  <label htmlFor="learning-duration">Planned minutes</label>
                  <input
                    id="learning-duration"
                    type="number"
                    min="5"
                    step="5"
                    value={learningPlannedMinutes}
                    onChange={(event) =>
                      setLearningPlannedMinutes(Number(event.target.value) || 5)
                    }
                  />
                </div>
              </div>
              <label htmlFor="learning-notes">Notes / description</label>
              <textarea
                id="learning-notes"
                rows={3}
                value={learningNotes}
                onChange={(event) => setLearningNotes(event.target.value)}
                placeholder="What will you practice?"
              />
              <label className="check-option">
                <input
                  type="checkbox"
                  checked={learningReminder}
                  onChange={(event) =>
                    setLearningReminder(event.target.checked)
                  }
                />
                Remind me daily
              </label>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setLearningModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!learningTopic.trim() || !learningGoal.trim()}
                >
                  Add session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedLearningSession && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="task-modal learning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-detail-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Learning session</p>
                <h2 id="learning-detail-title">
                  {selectedLearningSession.topic}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedLearningSession(null)}
              >
                X
              </button>
            </div>
            <p className="detail-task-title">{selectedLearningSession.goal}</p>
            <div className="detail-summary">
              <span>{selectedLearningSession.date}</span>
              <span>
                {selectedLearningSession.plannedMinutes} planned minutes
              </span>
              <span>
                {selectedLearningSession.actualMinutes} actual minutes
              </span>
            </div>
            <label htmlFor="actual-learning-minutes">Actual time spent</label>
            <input
              id="actual-learning-minutes"
              type="number"
              min="0"
              value={selectedLearningSession.actualMinutes}
              onChange={(event) => {
                const actualMinutes = Number(event.target.value) || 0;
                setSelectedLearningSession({
                  ...selectedLearningSession,
                  actualMinutes,
                });
                void updateLearningSession(selectedLearningSession, {
                  actualMinutes,
                });
              }}
            />
            <label htmlFor="learning-follow-up">
              Continue Learning / follow-up
            </label>
            <textarea
              id="learning-follow-up"
              rows={3}
              defaultValue={selectedLearningSession.followUp ?? ""}
              onBlur={(event) =>
                void updateLearningSession(selectedLearningSession, {
                  followUp: event.target.value,
                })
              }
              placeholder="What should the next session cover?"
            />
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  void updateLearningSession(selectedLearningSession, {
                    status: "Completed",
                    completedAt: new Date().toISOString(),
                  });
                  setSelectedLearningSession(null);
                }}
              >
                Mark completed
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setLearningDate(
                    selectedLearningSession.nextSessionDate ??
                      localDateInputValue(),
                  );
                  setLearningTopic(selectedLearningSession.topic);
                  setLearningGoal(
                    selectedLearningSession.followUp ??
                      selectedLearningSession.goal,
                  );
                  setLearningModalOpen(true);
                  setSelectedLearningSession(null);
                }}
              >
                Continue Learning
              </button>
            </div>
          </div>
        </div>
      )}
      {isTaskModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setTaskModalOpen(false)
          }
        >
          <div
            className="task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Capture the next thing</p>
                <h2 id="new-task-title">New task</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setTaskModalOpen(false)}
              >
                X
              </button>
            </div>
            <form onSubmit={(event) => void createTask(event)}>
              <label htmlFor="task-title">Task title</label>
              <input
                id="task-title"
                autoFocus
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="What needs your attention?"
              />
              <div className="date-fields">
                <div>
                  <label htmlFor="task-due-date">Due date</label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="estimated-minutes">Estimated minutes</label>
                  <input
                    id="estimated-minutes"
                    type="number"
                    min="5"
                    step="5"
                    value={estimatedMinutes}
                    onChange={(event) =>
                      setEstimatedMinutes(Number(event.target.value) || 5)
                    }
                  />
                </div>
                <div>
                  <label htmlFor="task-reminder-time">Reminder time</label>
                  <input
                    id="task-reminder-time"
                    type="time"
                    value={reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                    disabled={!reminderEnabled}
                  />
                </div>
              </div>
              <div className="modal-options">
                <label className="check-option">
                  <input
                    type="checkbox"
                    checked={urgent}
                    onChange={(event) => setUrgent(event.target.checked)}
                  />
                  Urgent
                </label>
                <label className="check-option">
                  <input
                    type="checkbox"
                    checked={important}
                    onChange={(event) => setImportant(event.target.checked)}
                  />
                  Important
                </label>
                <label className="check-option">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(event) =>
                      setReminderEnabled(event.target.checked)
                    }
                  />
                  <Bell size={13} />
                  Reminder
                </label>
              </div>
              {reminderEnabled && (
                <div className="recurrence-field">
                  <label htmlFor="reminder-recurrence">Repeat reminder</label>
                  <select
                    id="reminder-recurrence"
                    value={reminderRecurrence}
                    onChange={(event) =>
                      setReminderRecurrence(
                        event.target.value as ReminderRecurrence,
                      )
                    }
                  >
                    <option value="NONE">Once</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                  <small>
                    Notifications stay local and only run while FocusMatrix is
                    open.
                  </small>
                </div>
              )}
              <p className="quadrant-preview">
                This will land in{" "}
                <strong>
                  {
                    focusAreas.find(
                      (area) =>
                        area.quadrant === calculateQuadrant(urgent, important),
                    )?.label
                  }
                </strong>
                . Due <strong>{dueDate}</strong>
                {reminderEnabled && (
                  <>
                    {" "}
                    with a reminder at <strong>{reminderTime}</strong>.
                  </>
                )}
              </p>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!taskTitle.trim()}
                >
                  Create task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {closureTask && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-task-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Close task</p>
                <h2 id="close-task-title">Add closing remarks</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setClosureTask(null)}
              >
                X
              </button>
            </div>
            <p className="detail-task-title">{closureTask.title}</p>
            <form onSubmit={(event) => void closeTask(event)}>
              <label htmlFor="closure-remarks">Description / Remarks</label>
              <textarea
                id="closure-remarks"
                required
                autoFocus
                value={closureRemarks}
                onChange={(event) => setClosureRemarks(event.target.value)}
                placeholder="What was completed, action taken, outcome, or observations?"
                rows={5}
              />
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setClosureTask(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!closureRemarks.trim()}
                >
                  Close task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedTask && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelectedTask(null)
          }
        >
          <div
            className="task-modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Task details</p>
                <h2 id="task-detail-title">{selectedTask.title}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedTask(null)}
              >
                X
              </button>
            </div>
            <div className="detail-summary">
              <span>
                {
                  focusAreas.find(
                    (area) => area.quadrant === selectedTask.quadrant,
                  )?.label
                }
              </span>
              <span>{taskStatus(selectedTask)}</span>
              {selectedTask.completedAt && (
                <span>
                  Closed{" "}
                  {new Date(selectedTask.completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {selectedTask.closureRemarks && (
              <div className="remarks-box">
                <strong>Description / Remarks</strong>
                <p>{selectedTask.closureRemarks}</p>
              </div>
            )}
            <div className="detail-section">
              <div className="detail-section-title">
                <h3>Follow-up history</h3>
                <span>
                  {selectedTask.followUps?.filter(
                    (followUp) => followUp.status === "Active",
                  ).length ?? 0}{" "}
                  active
                </span>
              </div>
              {selectedTask.followUps?.map((followUp) => (
                <div className="history-row" key={followUp.id}>
                  <strong>{followUp.date}</strong>
                  <span>
                    {followUp.remarks}
                    {followUp.nextAction && ` - Next: ${followUp.nextAction}`}
                  </span>
                  <button
                    className="history-action"
                    type="button"
                    onClick={() =>
                      void updateFollowUpStatus(
                        followUp.id,
                        followUp.status === "Active" ? "Completed" : "Active",
                      )
                    }
                  >
                    {followUp.status === "Active" ? "Mark complete" : "Reopen"}
                  </button>
                </div>
              ))}
              <form
                className="inline-detail-form"
                onSubmit={(event) => void addFollowUp(event)}
              >
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(event) => setFollowUpDate(event.target.value)}
                  aria-label="Follow-up date"
                />
                <input
                  value={followUpRemarks}
                  onChange={(event) => setFollowUpRemarks(event.target.value)}
                  placeholder="Follow-up remarks"
                  aria-label="Follow-up remarks"
                />
                <input
                  value={followUpAction}
                  onChange={(event) => setFollowUpAction(event.target.value)}
                  placeholder="Next action or reminder"
                  aria-label="Next follow-up action"
                />
                <button className="secondary-button" type="submit">
                  Continue Follow-up
                </button>
              </form>
            </div>
            <div className="detail-section">
              <div className="detail-section-title">
                <h3>Audit planning</h3>
                <span>
                  {selectedTask.audits?.filter(
                    (audit) => audit.status === "Planned",
                  ).length ?? 0}{" "}
                  planned
                </span>
              </div>
              {selectedTask.audits?.map((audit) => (
                <div className="history-row" key={audit.id}>
                  <strong
                    className={
                      new Date(`${audit.auditDate}T00:00:00`) < new Date() &&
                      audit.status === "Planned"
                        ? "overdue-text"
                        : ""
                    }
                  >
                    {audit.auditDate}
                  </strong>
                  <span>
                    {audit.remarks || "Review planned"} -{" "}
                    {audit.responsiblePerson}
                    {audit.nextAuditDate && ` - Next: ${audit.nextAuditDate}`}
                  </span>
                  <select
                    className="history-status"
                    value={audit.status}
                    onChange={(event) =>
                      void updateAuditStatus(
                        audit.id,
                        event.target.value as AuditPlan["status"],
                      )
                    }
                    aria-label={`Audit status for ${audit.auditDate}`}
                  >
                    <option value="Planned">Planned</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
              <form
                className="inline-detail-form audit-form"
                onSubmit={(event) => void addAudit(event)}
              >
                <input
                  type="date"
                  value={auditDate}
                  onChange={(event) => setAuditDate(event.target.value)}
                  aria-label="Audit date"
                />
                <input
                  value={auditResponsible}
                  onChange={(event) => setAuditResponsible(event.target.value)}
                  placeholder="Responsible person"
                  aria-label="Responsible person"
                />
                <input
                  type="date"
                  value={nextAuditDate}
                  onChange={(event) => setNextAuditDate(event.target.value)}
                  aria-label="Next audit date"
                />
                <input
                  value={auditRemarks}
                  onChange={(event) => setAuditRemarks(event.target.value)}
                  placeholder="Audit remarks"
                  aria-label="Audit remarks"
                />
                <button className="secondary-button" type="submit">
                  Plan Audit
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {isProfileOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setProfileOpen(false)
          }
        >
          <div
            className="task-modal profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Personalize your workspace</p>
                <h2 id="profile-title">Edit your name</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setProfileOpen(false)}
              >
                X
              </button>
            </div>
            <form onSubmit={saveProfile}>
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                autoFocus
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Your name"
              />
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setProfileOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!profileName.trim()}
                >
                  Save name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isProfileOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setProfileOpen(false)
          }
        >
          <div
            className="task-modal profile-modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Account</p>
                <h2 id="account-title">Your profile</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setProfileOpen(false)}
              >
                X
              </button>
            </div>
            <form onSubmit={saveProfile}>
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Your name"
              />
              <div className="modal-actions">
                <button className="secondary-button" type="submit">
                  <Check size={15} />
                  Save name
                </button>
              </div>
            </form>
            <div className="account-divider" />
            <p className="eyebrow">Cloud account</p>
            {userEmail ? (
              <div className="account-signed-in">
                <span>{userEmail}</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                {!authConfigured && (
                  <p className="auth-note">
                    Offline mode is active. Add Supabase settings to enable
                    sign-in.
                  </p>
                )}
                <button
                  className="google-button"
                  type="button"
                  disabled={!authConfigured || isAuthBusy}
                  onClick={() => void handleGoogleSignIn()}
                >
                  Continue with Google
                </button>
                <div className="auth-switch">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className={
                      authMode === "signin" ? "auth-tab selected" : "auth-tab"
                    }
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={
                      authMode === "signup" ? "auth-tab selected" : "auth-tab"
                    }
                  >
                    Create account
                  </button>
                </div>
                <form onSubmit={(event) => void handleEmailAuth(event)}>
                  <label htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    minLength={6}
                    required
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="At least 6 characters"
                  />
                  <button
                    className="primary-button auth-submit"
                    type="submit"
                    disabled={!authConfigured || isAuthBusy}
                  >
                    {authMode === "signin"
                      ? "Sign in with email"
                      : "Create account"}
                  </button>
                </form>
                {authMessage && <p className="auth-message">{authMessage}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
