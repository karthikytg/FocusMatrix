# FocusMatrix User Guide

## What FocusMatrix does

FocusMatrix is a local-first Eisenhower task manager. Tasks are classified into four quadrants using urgency and importance:

| Quadrant | Meaning |
| --- | --- |
| Do first | Urgent and important |
| Schedule | Important but not urgent |
| Delegate | Urgent but not important |
| Eliminate | Neither urgent nor important |

## Create a task

1. Select **New task**.
2. Enter a title.
3. Set the urgency and importance checkboxes.
4. Confirm or change the due date. The current date is selected by default.
5. Optionally enable a reminder and choose a time.
6. Optionally repeat the reminder daily, weekly, or monthly.
7. Select **Create task**.

The task is stored in the browser's local IndexedDB database and appears in its calculated quadrant.

## Complete and reopen tasks

Select the circle beside an open task, or select the task in a quadrant, to complete it. Completed tasks move to **Closed tasks**. Select **Reopen** to return a task to the active list.

## Dates and reminders

Task dates are displayed in the matrix and task list with visual states:

- **Overdue**: the date has passed and the task is open.
- **Today**: the task is due today.
- **Upcoming**: the due date is later.

Reminders are optional. Tasks without reminders are never processed by the reminder scheduler. Local notifications require browser permission and FocusMatrix to be open; the current implementation does not run a background operating-system service.

## Navigation

- **Dashboard**: summary, quadrants, upcoming tasks, daily thought, and closed tasks.
- **Matrix**: all four quadrants with open tasks.
- **Tasks**: open tasks in a list.
- **Calendar**: open tasks that have due dates.
- **Analytics**: total, completed, and completion-rate metrics.
- **Habits**, **Settings**, and **Help center**: navigation destinations reserved for future feature expansion.

## Profile name

Select the initials button in the top-right corner, edit the display name, and save. The name is stored locally in browser storage and is independent of cloud authentication.

## Daily thought

The Today's focus card selects a deterministic thought from a built-in list using the calendar date. It works offline and changes on the next day. No external quote API is used.

## Offline and hosted use

The application works locally without an account. Hosted deployments still store task data in IndexedDB in the user's browser. Signing in with Supabase does not currently synchronize tasks between devices.
