import {
  BarChart3,
  Bell,
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Focus,
  Grid2X2,
  ListTodo,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from './database/db'
import type { Quadrant, ReminderRecurrence, Task } from './types/task'
import { calculateQuadrant } from './utils/quadrant'
import { dueStatus, localDateInputValue, nextReminderTime, reminderLabel } from './utils/taskDates'
import { authConfigured, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail, subscribeToAuth } from './services/auth'
import './App.css'

const navigation = [
  { label: 'Dashboard', icon: Target },
  { label: 'Matrix', icon: Grid2X2 },
  { label: 'Tasks', icon: ListTodo },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Analytics', icon: BarChart3 },
]

const focusAreas: Array<{ label: string; quadrant: Quadrant; accent: string; hint: string }> = [
  { label: 'Do first', quadrant: 'DO_FIRST', accent: 'coral', hint: 'Urgent + important' },
  { label: 'Schedule', quadrant: 'SCHEDULE', accent: 'blue', hint: 'Important + not urgent' },
  { label: 'Delegate', quadrant: 'DELEGATE', accent: 'amber', hint: 'Urgent + not important' },
  { label: 'Eliminate', quadrant: 'ELIMINATE', accent: 'slate', hint: 'Not urgent + not important' },
]

function App() {
  const [activeSection, setActiveSection] = useState('Dashboard')
  const [selectedQuadrant, setSelectedQuadrant] = useState<Quadrant | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('focusmatrix-display-name') ?? 'Jordan')
  const [profileName, setProfileName] = useState(displayName)
  const [isProfileOpen, setProfileOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [isAuthBusy, setAuthBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isTaskModalOpen, setTaskModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [important, setImportant] = useState(false)
  const [dueDate, setDueDate] = useState(localDateInputValue())
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderRecurrence, setReminderRecurrence] = useState<ReminderRecurrence>('NONE')

  useEffect(() => {
    void db.tasks.orderBy('createdAt').reverse().toArray().then(setTasks)
  }, [])

  useEffect(() => subscribeToAuth((session) => setUserEmail(session?.user.email ?? null)), [])

  useEffect(() => {
    const checkReminders = async () => {
      const now = new Date()
      const dueReminders = tasks.filter((task) => task.reminderAt && !task.completed && new Date(task.reminderAt) <= now && (!task.reminderLastTriggeredAt || new Date(task.reminderLastTriggeredAt) < new Date(task.reminderAt)))
      for (const task of dueReminders) {
        if ('Notification' in window && Notification.permission === 'granted') new Notification(`FocusMatrix reminder: ${task.title}`, { body: task.dueDate ? `Due ${task.dueDate}` : 'Your task is ready.' })
        const next = nextReminderTime(task.reminderAt!, task.reminderRecurrence ?? 'NONE')
        const update = next ? { reminderAt: next, reminderLastTriggeredAt: new Date().toISOString() } : { reminderLastTriggeredAt: new Date().toISOString() }
        await db.tasks.update(task.id, update)
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...update } : item))
      }
    }
    void checkReminders()
    const timer = window.setInterval(() => void checkReminders(), 30_000)
    return () => window.clearInterval(timer)
  }, [tasks])

  const completedCount = tasks.filter((task) => task.completed).length
  const completionRate = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100)
  const openTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks])
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks])

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskTitle.trim()
    if (!title) return
    const now = new Date().toISOString()
    const reminderAt = reminderEnabled ? new Date(`${dueDate}T${reminderTime}`).toISOString() : undefined
    const task: Task = {
      id: crypto.randomUUID(), title, urgent, important,
      quadrant: calculateQuadrant(urgent, important), completed: false, dueDate, reminderAt, reminderRecurrence: reminderEnabled ? reminderRecurrence : 'NONE', createdAt: now,
    }
    if (reminderAt && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    await db.tasks.add(task)
    setTasks((current) => [task, ...current])
    setTaskTitle(''); setUrgent(false); setImportant(false); setDueDate(localDateInputValue()); setReminderEnabled(false); setReminderTime('09:00'); setReminderRecurrence('NONE'); setTaskModalOpen(false)
  }

  async function completeTask(task: Task) {
    const completedAt = task.completed ? undefined : new Date().toISOString()
    await db.tasks.update(task.id, { completed: !task.completed, completedAt })
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed, completedAt } : item))
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = profileName.trim()
    if (!name) return
    localStorage.setItem('focusmatrix-display-name', name)
    setDisplayName(name)
    setProfileOpen(false)
  }

  async function handleGoogleSignIn() {
    setAuthBusy(true); setAuthMessage('')
    try { await signInWithGoogle() } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'Unable to start Google sign-in.') } finally { setAuthBusy(false) }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthMessage('')
    try {
      const result = authMode === 'signin' ? await signInWithEmail(authEmail, authPassword) : await signUpWithEmail(authEmail, authPassword)
      if (result.error) throw result.error
      setAuthMessage(authMode === 'signin' ? 'Signed in successfully.' : 'Account created. Check your email to confirm it.')
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.') } finally { setAuthBusy(false) }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Focus size={19} strokeWidth={2.5} /></div>
          <div>
            <strong>FocusMatrix</strong>
            <span>Personal command center</span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="section-label">Workspace</span>
          <nav aria-label="Primary navigation" className="primary-nav">
            {navigation.map(({ label, icon: Icon }) => (
              <button className={activeSection === label ? 'nav-item active' : 'nav-item'} key={label} type="button" onClick={() => { setActiveSection(label); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                <Icon size={18} />
                <span>{label}</span>
                {activeSection === label && <span className="nav-pip" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-section sidebar-bottom">
          <span className="section-label">Personal</span>
          <button className={activeSection === 'Habits' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setActiveSection('Habits')}><Clock3 size={18} /><span>Habits</span></button>
          <button className={activeSection === 'Settings' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setActiveSection('Settings')}><Settings size={18} /><span>Settings</span></button>
          <button className={activeSection === 'Help center' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setActiveSection('Help center')}><CircleHelp size={18} /><span>Help center</span></button>
          <div className="privacy-note"><span className="privacy-dot" />Local-first workspace</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeSection}</strong></div>
          <div className="topbar-actions">
            <span className="offline-status"><span className="privacy-dot" />Offline ready</span>
            <button className="avatar" type="button" aria-label="Open profile and account" onClick={() => { setProfileName(displayName); setProfileOpen(true) }}>{displayName.slice(0, 2).toUpperCase()}</button>
          </div>
        </header>

        <div className="content-wrap">
          {activeSection === 'Dashboard' ? <>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">Tuesday, September 8, 2026</p>
              <h1>Good morning, {displayName}<span className="title-dot">.</span></h1>
              <p className="welcome-copy">Make room for what matters. Your day starts here.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setTaskModalOpen(true)}><Plus size={18} />New task <kbd>N</kbd></button>
          </section>

          <section className="stats-grid" aria-label="Today's summary">
            <div className="stat-card stat-highlight"><div className="stat-label">Today's focus</div><div className="stat-value">{openTasks.length} <span>tasks</span></div><div className="stat-meta"><Sparkles size={14} />{openTasks.length ? 'Ready to focus' : 'A clear slate'}</div></div>
            <div className="stat-card"><div className="stat-label">Completion rate</div><div className="stat-value">{completionRate}<span>%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${completionRate}%` }} /></div></div>
            <div className="stat-card"><div className="stat-label">Tasks completed</div><div className="stat-value">{completedCount} <span>total</span></div><div className="stat-meta muted">Keep the momentum going</div></div>
          </section>

          <section className="section-heading"><div><p className="eyebrow">Your decision framework</p><h2>Focus by quadrant</h2></div><button className="text-button" type="button" onClick={() => document.querySelector('.quadrant-grid')?.scrollIntoView({ behavior: 'smooth' })}>Open matrix <ChevronRight size={16} /></button></section>
          <section className="quadrant-grid">
            {focusAreas.map((area) => { const quadrantTasks = openTasks.filter((task) => task.quadrant === area.quadrant); const isSelected = selectedQuadrant === area.quadrant; return <article className={`quadrant-card ${area.accent} ${isSelected ? 'selected' : ''}`} key={area.label} role="button" tabIndex={0} aria-pressed={isSelected} onClick={() => setSelectedQuadrant(area.quadrant)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedQuadrant(area.quadrant) } }}><div className="quadrant-top"><span className="quadrant-dot" /><span>{area.hint}</span><span className="quadrant-count">{quadrantTasks.length}</span></div><h3>{area.label}</h3><p>{quadrantTasks.length ? `${quadrantTasks.length} task${quadrantTasks.length === 1 ? '' : 's'} to work through.` : 'No tasks here. A quiet quadrant is useful.'}</p>{quadrantTasks.slice(0, 2).map((task) => <button className="quadrant-task" key={task.id} type="button" onClick={(event) => { event.stopPropagation(); void completeTask(task) }}><span className="task-check" /><span className="task-name">{task.title}</span><span className={`task-date ${dueStatus(task)}`}>{task.dueDate ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</span>{task.reminderAt && <Bell size={12} aria-label={`Reminder ${reminderLabel(task)}`} />}</button>)}<button className="add-quiet" type="button" onClick={(event) => { event.stopPropagation(); setUrgent(area.quadrant === 'DO_FIRST' || area.quadrant === 'DELEGATE'); setImportant(area.quadrant === 'DO_FIRST' || area.quadrant === 'SCHEDULE'); setTaskModalOpen(true) }}><Plus size={15} />Add task</button></article> })}
          </section>

          <section className="upcoming-section">
            <div className="panel-heading"><div><p className="eyebrow">Today</p><h2>Upcoming tasks</h2></div><ListTodo size={19} /></div>
            {selectedQuadrant ? <div className="quadrant-detail"><div className="detail-heading"><div><p className="eyebrow">Selected quadrant</p><h3>{focusAreas.find((area) => area.quadrant === selectedQuadrant)?.label}</h3></div><button className="secondary-button" type="button" onClick={() => setSelectedQuadrant(null)}><ChevronRight size={15} className="back-icon" />Back to overview</button></div><div className="task-table-wrap"><table className="task-table"><thead><tr><th>Sl. No.</th><th>Task</th><th>Quadrant</th><th>Date</th><th>Closed Date</th></tr></thead><tbody>{tasks.filter((task) => task.quadrant === selectedQuadrant).map((task, index) => <tr key={task.id}><td>{index + 1}</td><td><button className="table-task" type="button" onClick={() => void completeTask(task)}><span className={task.completed ? 'task-check completed' : 'task-check'} />{task.title}</button></td><td>{focusAreas.find((area) => area.quadrant === task.quadrant)?.label}</td><td className={dueStatus(task)}>{task.dueDate ?? 'No date'}</td><td>{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '—'}</td></tr>)}</tbody></table>{tasks.every((task) => task.quadrant !== selectedQuadrant) && <p className="completed-empty">No tasks belong to this quadrant yet.</p>}</div></div> : openTasks.length ? <div className="task-list">{openTasks.slice(0, 5).map((task) => <div className="task-row" key={task.id}><button className="task-row-check" type="button" aria-label={`Complete ${task.title}`} onClick={() => void completeTask(task)}><span /></button><span className="task-name">{task.title}</span><small className={dueStatus(task)}>{task.dueDate ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}{task.reminderAt && <><span className="meta-separator">·</span><Bell size={12} /></>}</small><small>{focusAreas.find((area) => area.quadrant === task.quadrant)?.label}</small></div>)}</div> : <div className="empty-content"><div className="empty-icon"><CheckCircle2 size={22} /></div><h3>Your list is clear</h3><p>Capture a task whenever something important crosses your mind.</p><button className="secondary-button" type="button" onClick={() => setTaskModalOpen(true)}><Plus size={16} />Add your first task</button></div>}
          </section>
          <section className="thoughts-section"><article className="empty-panel focus-panel"><div className="panel-heading"><div><p className="eyebrow">A small ritual</p><h2>Today's focus</h2></div><Target size={19} /></div><div className="focus-quote"><span className="quote-mark">“</span><p>What would make today feel meaningful?</p><span className="quote-line" /></div><div className="focus-footer"><span>Set one intention to begin</span><button className="icon-button" type="button" aria-label="Set intention"><ChevronRight size={18} /></button></div></article></section>
          <section className="completed-panel">
            <div className="panel-heading"><div><p className="eyebrow">History</p><h2>Closed tasks</h2></div><CheckCircle2 size={19} /></div>
            {completedTasks.length ? <div className="completed-list">{completedTasks.slice(0, 10).map((task) => <div className="completed-row" key={task.id}><span className="completed-check"><CheckCircle2 size={16} /></span><span className="completed-title">{task.title}</span><small>{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Completed'}</small><button className="reopen-button" type="button" onClick={() => void completeTask(task)}><RotateCcw size={14} />Reopen</button></div>)}</div> : <p className="completed-empty">Completed tasks will appear here so you can reopen them later.</p>}
          </section>
          </> : <section className="section-view">
            <div className="section-view-heading"><div><p className="eyebrow">Workspace</p><h1>{activeSection}</h1><p className="welcome-copy">Your local {activeSection.toLowerCase()} workspace.</p></div><button className="primary-button" type="button" onClick={() => setTaskModalOpen(true)}><Plus size={18} />New task</button></div>
            {activeSection === 'Matrix' && <div className="quadrant-grid section-view-grid">{focusAreas.map((area) => { const areaTasks = openTasks.filter((task) => task.quadrant === area.quadrant); return <article className={`quadrant-card ${area.accent}`} key={area.label}><div className="quadrant-top"><span className="quadrant-dot" /><span>{area.hint}</span><span className="quadrant-count">{areaTasks.length}</span></div><h3>{area.label}</h3>{areaTasks.length ? areaTasks.map((task) => <button className="quadrant-task" key={task.id} type="button" onClick={() => void completeTask(task)}><span className="task-check" /><span className="task-name">{task.title}</span></button>) : <p>No open tasks here.</p>}</article> })}</div>}
            {activeSection === 'Tasks' && <div className="section-task-list">{openTasks.length ? openTasks.map((task) => <div className="section-task-row" key={task.id}><button className="task-row-check" type="button" aria-label={`Complete ${task.title}`} onClick={() => void completeTask(task)}><span /></button><span className="task-name">{task.title}</span><span className={`task-date ${dueStatus(task)}`}>{task.dueDate ?? 'No due date'}</span><small>{focusAreas.find((area) => area.quadrant === task.quadrant)?.label}</small></div>) : <p className="completed-empty">No open tasks. Create one to get started.</p>}</div>}
            {activeSection === 'Calendar' && <div className="calendar-view"><p className="eyebrow">{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p><h2>Scheduled task dates</h2>{openTasks.filter((task) => task.dueDate).length ? openTasks.filter((task) => task.dueDate).map((task) => <div className="section-task-row" key={task.id}><CalendarDays size={16} /><span className="task-name">{task.title}</span><strong>{task.dueDate}</strong></div>) : <p className="completed-empty">No tasks have a due date yet.</p>}</div>}
            {activeSection === 'Analytics' && <div className="analytics-grid"><div className="stat-card"><div className="stat-label">Total tasks</div><div className="stat-value">{tasks.length}</div></div><div className="stat-card"><div className="stat-label">Completed</div><div className="stat-value">{completedCount}</div></div><div className="stat-card"><div className="stat-label">Completion rate</div><div className="stat-value">{completionRate}<span>%</span></div></div></div>}
          </section>}
        </div>
      </main>
      {isTaskModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTaskModalOpen(false)}><div className="task-modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title"><div className="modal-heading"><div><p className="eyebrow">Capture the next thing</p><h2 id="new-task-title">New task</h2></div><button className="modal-close" type="button" aria-label="Close new task dialog" onClick={() => setTaskModalOpen(false)}>×</button></div><form onSubmit={(event) => void createTask(event)}><label htmlFor="task-title">Task title</label><input id="task-title" autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="What needs your attention?" /><div className="date-fields"><div><label htmlFor="task-due-date">Due date</label><input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div><label htmlFor="task-reminder-time">Reminder time</label><input id="task-reminder-time" type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} disabled={!reminderEnabled} /></div></div><div className="modal-options"><label className="check-option"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />Urgent</label><label className="check-option"><input type="checkbox" checked={important} onChange={(event) => setImportant(event.target.checked)} />Important</label><label className="check-option"><input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} /><Bell size={13} />Reminder</label></div>{reminderEnabled && <div className="recurrence-field"><label htmlFor="reminder-recurrence">Repeat reminder</label><select id="reminder-recurrence" value={reminderRecurrence} onChange={(event) => setReminderRecurrence(event.target.value as ReminderRecurrence)}><option value="NONE">Once</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select><small>Notifications stay local and only run while FocusMatrix is open.</small></div>}<p className="quadrant-preview">This will land in <strong>{focusAreas.find((area) => area.quadrant === calculateQuadrant(urgent, important))?.label}</strong>. Due <strong>{dueDate}</strong>{reminderEnabled && <> with a reminder at <strong>{reminderTime}</strong>.</>}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setTaskModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!taskTitle.trim()}>Create task</button></div></form></div></div>}
      {isProfileOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}><div className="task-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-heading"><div><p className="eyebrow">Personalize your workspace</p><h2 id="profile-title">Edit your name</h2></div><button className="modal-close" type="button" aria-label="Close profile dialog" onClick={() => setProfileOpen(false)}>×</button></div><form onSubmit={saveProfile}><label htmlFor="display-name">Display name</label><input id="display-name" autoFocus value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your name" /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setProfileOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!profileName.trim()}>Save name</button></div></form></div></div>}
      {isProfileOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}><div className="task-modal profile-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><div className="modal-heading"><div><p className="eyebrow">Account</p><h2 id="account-title">Your profile</h2></div><button className="modal-close" type="button" aria-label="Close account dialog" onClick={() => setProfileOpen(false)}>×</button></div><form onSubmit={saveProfile}><label htmlFor="display-name">Display name</label><input id="display-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your name" /><div className="modal-actions"><button className="secondary-button" type="submit"><Check size={15} />Save name</button></div></form><div className="account-divider" /><p className="eyebrow">Cloud account</p>{userEmail ? <div className="account-signed-in"><span>{userEmail}</span><button className="secondary-button" type="button" onClick={() => void signOut()}>Sign out</button></div> : <>{!authConfigured && <p className="auth-note">Offline mode is active. Add Supabase settings to enable sign-in.</p>}<button className="google-button" type="button" disabled={!authConfigured || isAuthBusy} onClick={() => void handleGoogleSignIn()}>Continue with Google</button><div className="auth-switch"><button type="button" onClick={() => setAuthMode('signin')} className={authMode === 'signin' ? 'auth-tab selected' : 'auth-tab'}>Sign in</button><button type="button" onClick={() => setAuthMode('signup')} className={authMode === 'signup' ? 'auth-tab selected' : 'auth-tab'}>Create account</button></div><form onSubmit={(event) => void handleEmailAuth(event)}><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" minLength={6} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" /><button className="primary-button auth-submit" type="submit" disabled={!authConfigured || isAuthBusy}>{authMode === 'signin' ? 'Sign in with email' : 'Create account'}</button></form>{authMessage && <p className="auth-message">{authMessage}</p>}</>}</div></div>}
    </div>
  )
}

export default App
