export const getNextReminderTime = (now = new Date()) => {
  const nextReminder = new Date(now)
  nextReminder.setHours(22, 0, 0, 0)

  if (nextReminder <= now) {
    nextReminder.setDate(nextReminder.getDate() + 1)
    nextReminder.setHours(22, 0, 0, 0)
  }

  return nextReminder
}

export const getReminderDelayMs = (now = new Date(), targetTime = getNextReminderTime(now)) => {
  return Math.max(0, targetTime.getTime() - now.getTime())
}
