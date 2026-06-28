import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { defaultGoals, defaultWeekendTargets } from './data/defaultConfig'
import { saveAppData } from './services/localStorageService'
import {
  calculateDayScore,
  createGoalSnapshot,
  getScoreColor,
  getWeekdayGoalTotal,
} from './services/scoringService'
import {
  addMonths,
  fromDateKey,
  getCalendarDays,
  getMonthLabel,
  getReadableDate,
  isWeekend,
  toDateKey,
} from './utils/dateUtils'
import { initializeApp } from './utils/initializeApp'

const tabs = ['Calendar', 'Goals', 'Analytics', 'Settings']

const emptyWeekendGoal = () => ({
  id: crypto.randomUUID(),
  title: '',
  completed: false,
})

const emptyTask = () => ({
  id: crypto.randomUUID(),
  title: '',
  completed: false,
})

const draftTask = {
  id: 'draft_task',
  title: '',
  completed: false,
}

const createEmptyDayRecord = (dateKey, goals) => {
  const goalSnapshot = createGoalSnapshot(goals)
  const score = calculateDayScore(goalSnapshot, [])

  return {
    date: dateKey,
    activeDay: true,
    score,
    color: getScoreColor(score, true),
    completedGoals: [],
    temporaryTasks: [emptyTask()],
    notes: '',
    goalSnapshot,
  }
}

const createEmptyWeekendRecord = (dateKey) => ({
  date: dateKey,
  completedTargets: [],
  customGoals: [emptyWeekendGoal()],
  notes: '',
})

const getTaskKey = (name = '') => name.trim().toLowerCase()

const dayRecordHasTracking = (record) => {
  if (!record) {
    return false
  }

  return (
    !record.activeDay
    || (record.completedGoals || []).length > 0
    || (record.temporaryTasks || []).some((task) => task.title?.trim() || task.completed)
    || Boolean(record.notes?.trim())
  )
}

const weekendRecordHasTracking = (record) => {
  if (!record) {
    return false
  }

  return (
    (record.completedTargets || []).length > 0
    || (record.customGoals || []).some((goal) => goal.title?.trim() || goal.completed)
    || Boolean(record.notes?.trim())
  )
}

const prepareNotifications = (data) => {
  const now = new Date()
  const todayKey = toDateKey(now)
  const isSunday = now.getDay() === 0
  const todayIsWeekend = isWeekend(now)
  const todayRecord = todayIsWeekend
    ? data.weekendRecords?.[todayKey]
    : data.dayRecords?.[todayKey]
  const hasTrackedToday = todayIsWeekend
    ? weekendRecordHasTracking(todayRecord)
    : dayRecordHasTracking(todayRecord)
  let notifications = data.notifications || []

  if (isSunday) {
    const weeklyNotifications = notifications.filter((notification) => notification.date === todayKey)

    if (weeklyNotifications.length !== notifications.length) {
      notifications = weeklyNotifications
    }
  }

  if (now.getHours() >= 22 && !hasTrackedToday) {
    const reminderExists = notifications.some((notification) => notification.date === todayKey)

    if (!reminderExists) {
      notifications = [
        ...notifications,
        {
          id: `track_${todayKey}`,
          date: todayKey,
          message: `Track ${getReadableDate(todayKey)} before the day ends.`,
          createdAt: now.toISOString(),
          read: false,
        },
      ]

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('LevelUp Reminder', {
          body: `Track ${getReadableDate(todayKey)} before the day ends.`,
        })
      }
    }
  }

  return {
    ...data,
    notifications,
  }
}

const normalizeGoal = (goal) => ({
  ...goal,
  score: goal.score === '' ? '' : Number(goal.score || 0),
  applicableDays: goal.applicableDays?.length
    ? goal.applicableDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
})

const normalizeWeekendTarget = (target) => ({
  id: target.id || `weekend_target_${Date.now()}`,
  name: target.name || 'New Weekend Target',
})

const syncDayRecordsFromToday = (dayRecords = {}, nextGoals = []) => {
  const todayKey = toDateKey(new Date())
  const goalSnapshot = createGoalSnapshot(nextGoals)
  const goalIds = new Set(goalSnapshot.map((goal) => goal.id))

  return Object.entries(dayRecords).reduce((records, [dateKey, record]) => {
    if (dateKey < todayKey || isWeekend(fromDateKey(dateKey))) {
      records[dateKey] = record
      return records
    }

    const completedGoals = (record.completedGoals || []).filter((goalId) => goalIds.has(goalId))
    const score = calculateDayScore(goalSnapshot, completedGoals)

    records[dateKey] = {
      ...record,
      goalSnapshot,
      completedGoals,
      score,
      color: getScoreColor(score, record.activeDay),
    }

    return records
  }, {})
}

function App() {
  const [appData, setAppData] = useState(() => prepareNotifications(initializeApp()))
  const [activeTab, setActiveTab] = useState('Calendar')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [currentDateKey, setCurrentDateKey] = useState(() => toDateKey(new Date()))
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [selectedAnalyticsGoalId, setSelectedAnalyticsGoalId] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)
  const notificationMenuRef = useRef(null)

  const goals = useMemo(() => appData.goals || [], [appData.goals])
  const weekendTargets = useMemo(() => (
    appData.weekendTargets?.length ? appData.weekendTargets : defaultWeekendTargets
  ), [appData.weekendTargets])
  const weekendTargetHistory = useMemo(() => (
    appData.weekendTargetHistory?.length ? appData.weekendTargetHistory : defaultWeekendTargets
  ), [appData.weekendTargetHistory])
  const settings = appData.settings || {}
  const selectedDate = fromDateKey(selectedDateKey)
  const selectedIsWeekend = isWeekend(selectedDate)
  const selectedCanTrack = selectedDateKey <= currentDateKey
  const weekdayTotal = getWeekdayGoalTotal(goals)
  const notifications = appData.notifications || []
  const unreadNotifications = notifications.filter((notification) => !notification.read).length
  const analyticsGoalOptions = useMemo(() => {
    const options = new Map()

    goals.forEach((goal) => {
      options.set(getTaskKey(goal.name), goal.name)
    })

    defaultWeekendTargets.forEach((target) => {
      options.set(getTaskKey(target.name), target.name)
    })

    weekendTargets.forEach((target) => {
      options.set(getTaskKey(target.name), target.name)
    })

    weekendTargetHistory.forEach((target) => {
      options.set(getTaskKey(target.name), target.name)
    })

    Object.values(appData.dayRecords || {}).forEach((record) => {
      ;(record.goalSnapshot || []).forEach((goal) => {
        const key = getTaskKey(goal.name)

        if (!options.has(key)) {
          options.set(key, goal.name)
        }
      })
    })

    return Array.from(options, ([key, name]) => ({ key, name }))
      .filter((goal) => goal.key)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [appData.dayRecords, goals, weekendTargetHistory, weekendTargets])
  const activeAnalyticsGoalKey = selectedAnalyticsGoalId || analyticsGoalOptions[0]?.key || ''
  const selectedAnalyticsGoalName = analyticsGoalOptions.find((goal) => (
    goal.key === activeAnalyticsGoalKey
  ))?.name || 'Selected task'

  const selectedDayRecord = useMemo(() => {
    return appData.dayRecords?.[selectedDateKey]
      || createEmptyDayRecord(selectedDateKey, goals)
  }, [appData.dayRecords, goals, selectedDateKey])
  const selectedDayColor = selectedDayRecord.activeDay && selectedDayRecord.completedGoals?.length
    ? selectedDayRecord.color
    : 'muted'

  const selectedWeekendRecord = useMemo(() => {
    return appData.weekendRecords?.[selectedDateKey]
      || createEmptyWeekendRecord(selectedDateKey)
  }, [appData.weekendRecords, selectedDateKey])

  const monthDays = useMemo(() => getCalendarDays(monthDate), [monthDate])

  const analytics = useMemo(() => {
    const records = Object.values(appData.dayRecords || {})
      .filter((record) => record.activeDay)
      .sort((a, b) => a.date.localeCompare(b.date))
    const monthPrefix = toDateKey(monthDate).slice(0, 7)
    const monthRecords = records.filter((record) => record.date.startsWith(monthPrefix))
    const completedDays = monthRecords.length
    const averageScore = completedDays
      ? Math.round(monthRecords.reduce((total, record) => total + record.score, 0) / completedDays)
      : 0
    const bestScore = completedDays
      ? Math.max(...monthRecords.map((record) => record.score))
      : 0
    const greenDays = monthRecords.filter((record) => record.score >= 90).length
    const weekendTargetNames = new Map()

    defaultWeekendTargets.forEach((target) => {
      weekendTargetNames.set(target.id, target.name)
    })

    weekendTargets.forEach((target) => {
      weekendTargetNames.set(target.id, target.name)
    })

    weekendTargetHistory.forEach((target) => {
      weekendTargetNames.set(target.id, target.name)
    })

    const weekdaySelectedCount = activeAnalyticsGoalKey
      ? monthRecords.filter((record) => {
        const snapshotNames = new Map((record.goalSnapshot || []).map((goal) => [goal.id, goal.name]))

        return (record.completedGoals || []).some((goalId) => (
          getTaskKey(snapshotNames.get(goalId)) === activeAnalyticsGoalKey
        ))
      }).length
      : 0
    const weekendSelectedCount = activeAnalyticsGoalKey
      ? Object.values(appData.weekendRecords || {}).filter((record) => (
        record.date?.startsWith(monthPrefix)
        && (record.completedTargets || []).some((targetId) => (
          getTaskKey(weekendTargetNames.get(targetId)) === activeAnalyticsGoalKey
        ))
      )).length
      : 0
    const selectedGoalCount = weekdaySelectedCount + weekendSelectedCount
    let streak = 0
    let cursor = new Date()

    while (true) {
      if (isWeekend(cursor)) {
        cursor.setDate(cursor.getDate() - 1)
        continue
      }

      const key = toDateKey(cursor)
      const record = appData.dayRecords?.[key]

      if (!record || !record.activeDay || record.score < 90) {
        break
      }

      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    let bestStreak = 0
    let runningStreak = 0
    let previousRecordDate = null

    records.forEach((record) => {
      const recordDate = fromDateKey(record.date)
      const reachedGreen = record.score >= 90
      const expectedDate = previousRecordDate ? new Date(previousRecordDate) : null

      if (expectedDate) {
        do {
          expectedDate.setDate(expectedDate.getDate() + 1)
        } while (isWeekend(expectedDate))
      }

      if (reachedGreen && (!expectedDate || toDateKey(expectedDate) === record.date)) {
        runningStreak += 1
      } else if (reachedGreen) {
        runningStreak = 1
      } else {
        runningStreak = 0
      }

      bestStreak = Math.max(bestStreak, runningStreak)
      previousRecordDate = recordDate
    })

    return {
      averageScore,
      bestStreak,
      bestScore,
      completedDays,
      greenDays,
      selectedGoalCount,
      streak,
    }
  }, [activeAnalyticsGoalKey, appData.dayRecords, appData.weekendRecords, monthDate, weekendTargetHistory, weekendTargets])

  const persistData = (nextData) => {
    const preparedData = prepareNotifications(nextData)

    setAppData(preparedData)
    saveAppData(preparedData)
  }

  useEffect(() => {
    const reminderTimer = window.setInterval(() => {
      setCurrentDateKey(toDateKey(new Date()))
      setAppData((currentData) => {
        const preparedData = prepareNotifications(currentData)

        if (preparedData.notifications === currentData.notifications) {
          return currentData
        }

        saveAppData(preparedData)
        return preparedData
      })
    }, 60000)

    return () => window.clearInterval(reminderTimer)
  }, [])

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!notificationMenuRef.current) {
        return
      }

      if (!notificationMenuRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handleOutsideClick)

    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [notificationsOpen])

  const goToToday = () => {
    const today = new Date()

    setActiveTab('Calendar')
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDateKey(toDateKey(today))
  }

  const toggleNotifications = () => {
    setNotificationsOpen((isOpen) => !isOpen)

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if (unreadNotifications > 0) {
      persistData({
        ...appData,
        notifications: notifications.map((notification) => ({
          ...notification,
          read: true,
        })),
      })
    }
  }

  const persistGoalTemplate = (nextGoals) => {
    persistData({
      ...appData,
      goals: nextGoals,
      dayRecords: syncDayRecordsFromToday(appData.dayRecords, nextGoals),
    })
  }

  const updateDayRecord = (updater) => {
    const currentRecord = appData.dayRecords?.[selectedDateKey]
      || createEmptyDayRecord(selectedDateKey, goals)
    const nextRecordBase = updater(currentRecord)
    const score = calculateDayScore(
      nextRecordBase.goalSnapshot,
      nextRecordBase.completedGoals,
    )
    const nextRecord = {
      ...nextRecordBase,
      score,
      color: getScoreColor(score, nextRecordBase.activeDay),
    }

    persistData({
      ...appData,
      dayRecords: {
        ...appData.dayRecords,
        [selectedDateKey]: nextRecord,
      },
    })
  }

  const updateWeekendRecord = (updater) => {
    const currentRecord = appData.weekendRecords?.[selectedDateKey]
      || createEmptyWeekendRecord(selectedDateKey)
    const nextRecord = updater(currentRecord)

    persistData({
      ...appData,
      weekendRecords: {
        ...appData.weekendRecords,
        [selectedDateKey]: nextRecord,
      },
    })
  }

  const toggleGoalCompletion = (goalId) => {
    updateDayRecord((record) => {
      const completedGoals = record.completedGoals.includes(goalId)
        ? record.completedGoals.filter((id) => id !== goalId)
        : [...record.completedGoals, goalId]

      return {
        ...record,
        completedGoals,
      }
    })
  }

  const updateGoal = (goalId, patch) => {
    const nextGoals = goals.map((goal) => (
      goal.id === goalId ? normalizeGoal({ ...goal, ...patch }) : goal
    ))

    persistGoalTemplate(nextGoals)
  }

  const addGoal = () => {
    const nextGoals = [
      ...goals,
      {
        id: `goal_${Date.now()}`,
        name: 'New Goal',
        score: 5,
        active: true,
        applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      },
    ]

    persistGoalTemplate(nextGoals)
  }

  const deleteGoal = (goalId) => {
    persistGoalTemplate(goals.filter((goal) => goal.id !== goalId))
  }

  const resetDefaultGoals = () => {
    persistGoalTemplate(defaultGoals)
  }

  const updateWeekendTarget = (targetId, patch) => {
    const nextTarget = (target) => normalizeWeekendTarget({ ...target, ...patch })
    const targetExistsInHistory = weekendTargetHistory.some((target) => target.id === targetId)

    persistData({
      ...appData,
      weekendTargets: weekendTargets.map((target) => (
        target.id === targetId ? nextTarget(target) : target
      )),
      weekendTargetHistory: targetExistsInHistory
        ? weekendTargetHistory.map((target) => (
          target.id === targetId ? nextTarget(target) : target
        ))
        : [
          ...weekendTargetHistory,
          ...weekendTargets
            .filter((target) => target.id === targetId)
            .map(nextTarget),
        ],
    })
  }

  const addWeekendTarget = () => {
    const nextTarget = {
      id: `weekend_target_${Date.now()}`,
      name: 'New Weekend Target',
    }

    persistData({
      ...appData,
      weekendTargets: [
        ...weekendTargets,
        nextTarget,
      ],
      weekendTargetHistory: [
        ...weekendTargetHistory,
        nextTarget,
      ],
    })
  }

  const deleteWeekendTarget = (targetId) => {
    persistData({
      ...appData,
      weekendTargets: weekendTargets.filter((target) => target.id !== targetId),
    })
  }

  const resetDefaultWeekendTargets = () => {
    const historyIds = new Set(weekendTargetHistory.map((target) => target.id))

    persistData({
      ...appData,
      weekendTargets: defaultWeekendTargets,
      weekendTargetHistory: [
        ...weekendTargetHistory,
        ...defaultWeekendTargets.filter((target) => !historyIds.has(target.id)),
      ],
    })
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `levelup-backup-${toDateKey(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)

        if (!parsed || !Array.isArray(parsed.goals)) {
          throw new Error('Invalid LevelUp backup file')
        }

        const nextData = {
          ...appData,
          ...parsed,
          settings: {
            ...settings,
            ...parsed.settings,
          },
          goals: parsed.goals.map(normalizeGoal),
          weekendTargets: (parsed.weekendTargets || defaultWeekendTargets).map(normalizeWeekendTarget),
          weekendTargetHistory: (
            parsed.weekendTargetHistory
            || parsed.weekendTargets
            || defaultWeekendTargets
          ).map(normalizeWeekendTarget),
          dayRecords: parsed.dayRecords || {},
          weekendRecords: parsed.weekendRecords || {},
        }

        persistData(nextData)
        setImportError('')
      } catch (error) {
        setImportError(error.message)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const dayCellClass = (day) => {
    if (day.isWeekend) {
      return 'calendar-cell weekend'
    }

    const record = appData.dayRecords?.[day.dateKey]

    if (!record) {
      return 'calendar-cell'
    }

    if (record.activeDay && !record.completedGoals?.length) {
      return 'calendar-cell'
    }

    return `calendar-cell ${record.color}`
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-First Habit Scorecard</p>
          <h1>{settings.appName || 'LevelUp'}</h1>
        </div>
        <div className="topbar-actions">
          <div className="notification-menu" ref={notificationMenuRef}>
            <button
              type="button"
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={toggleNotifications}
            >
              <BellIcon />
              {unreadNotifications > 0 && (
                <span className="notification-badge">{unreadNotifications}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notification-panel">
                <strong>Notifications</strong>
                {notifications.length ? (
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className="notification-item"
                        onClick={() => {
                          setSelectedDateKey(notification.date)
                          setMonthDate(new Date(
                            fromDateKey(notification.date).getFullYear(),
                            fromDateKey(notification.date).getMonth(),
                            1,
                          ))
                          setActiveTab('Calendar')
                          setNotificationsOpen(false)
                        }}
                      >
                        <span>{notification.message}</span>
                        <small>{getReadableDate(notification.date)}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>No Notifications</p>
                )}
              </div>
            )}
          </div>
          <button type="button" className="primary-button" onClick={goToToday}>
            Today
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="LevelUp Sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Calendar' && (
        <main className="workspace">
          <section className="calendar-panel">
            <div className="panel-header">
              <button type="button" className="icon-button" aria-label="Previous Month" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
                &lt;
              </button>
              <h2>{getMonthLabel(monthDate)}</h2>
              <button type="button" className="icon-button" aria-label="Next Month" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                &gt;
              </button>
            </div>

            <div className="weekday-row">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {monthDays.map((day) => {
                const record = appData.dayRecords?.[day.dateKey]
                const weekendRecord = appData.weekendRecords?.[day.dateKey]

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={`${dayCellClass(day)} ${day.inMonth ? '' : 'outside'} ${day.isToday ? 'today' : ''} ${selectedDateKey === day.dateKey ? 'selected' : ''}`}
                    onClick={() => setSelectedDateKey(day.dateKey)}
                  >
                    <span className="day-number">{day.date.getDate()}</span>
                    {!day.isWeekend && record && (
                      <span className="day-score">{record.activeDay ? record.score : 'Off'}</span>
                    )}
                    {day.isWeekend && weekendRecord && (
                      <span className="day-score">Plan</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="day-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">{selectedIsWeekend ? 'Weekend Mode' : 'Weekday Score'}</p>
                <h2>{getReadableDate(selectedDateKey)}</h2>
              </div>
              {!selectedIsWeekend && (
                <strong className={`score-pill ${selectedDayColor}`}>
                  {selectedDayRecord.activeDay ? selectedDayRecord.score : 'Off'}
                </strong>
              )}
            </div>

            {selectedIsWeekend ? (
              <WeekendEditor
                record={selectedWeekendRecord}
                weekendTargets={weekendTargets}
                canTrack={selectedCanTrack}
                onChange={updateWeekendRecord}
              />
            ) : (
              <DayEditor
                record={selectedDayRecord}
                canTrack={selectedCanTrack}
                onChange={updateDayRecord}
                onToggleGoal={toggleGoalCompletion}
              />
            )}
          </aside>
        </main>
      )}

      {activeTab === 'Goals' && (
        <main className="single-panel">
          <section className="goal-manager">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Weekday Template</p>
                <h2>Goal Manager</h2>
              </div>
              <strong className={weekdayTotal === settings.scoreLimit ? 'total-ok' : 'total-warning'}>
                {weekdayTotal}/{settings.scoreLimit}
              </strong>
            </div>

            <div className="goal-list">
              {goals.map((goal) => (
                <div className="goal-row" key={goal.id}>
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={goal.active}
                      onChange={(event) => updateGoal(goal.id, { active: event.target.checked })}
                    />
                    Active
                  </label>
                  <RequiredInput
                    key={`goal-name-${goal.id}-${goal.name}`}
                    value={goal.name}
                    aria-label="Goal Name"
                    onCommit={(value) => updateGoal(goal.id, { name: value })}
                  />
                  <RequiredInput
                    key={`goal-score-${goal.id}-${goal.score}`}
                    type="number"
                    min="0"
                    max="100"
                    value={goal.score}
                    fallbackValue="0"
                    aria-label="Goal Score"
                    onCommit={(value) => updateGoal(goal.id, { score: Number(value) })}
                  />
                  <button type="button" className="danger-button" onClick={() => deleteGoal(goal.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="button-row">
              <button type="button" className="primary-button" onClick={addGoal}>
                Add Goal
              </button>
              <button type="button" className="ghost-button" onClick={resetDefaultGoals}>
                Reset Template
              </button>
            </div>

            {weekdayTotal !== settings.scoreLimit && (
              <p className="notice">
                Active weekday goals should total {settings.scoreLimit}. Existing day records keep their snapshots, so old scores stay stable.
              </p>
            )}

            <div className="template-divider" />

            <div className="panel-title">
              <div>
                <p className="eyebrow">Weekend Template</p>
                <h2>Weekend Targets</h2>
              </div>
            </div>

            <div className="goal-list">
              {weekendTargets.map((target) => (
                <div className="weekend-template-row" key={target.id}>
                  <RequiredInput
                    key={`weekend-target-${target.id}-${target.name}`}
                    value={target.name}
                    aria-label="Weekend Target Name"
                    onCommit={(value) => updateWeekendTarget(target.id, { name: value })}
                  />
                  <button type="button" className="danger-button" onClick={() => deleteWeekendTarget(target.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="button-row template-actions">
              <button type="button" className="primary-button" onClick={addWeekendTarget}>
                Add Weekend Target
              </button>
              <button type="button" className="ghost-button" onClick={resetDefaultWeekendTargets}>
                Reset Weekend Template
              </button>
            </div>
          </section>
        </main>
      )}

      {activeTab === 'Analytics' && (
        <main className="single-panel">
          <section className="analytics-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Monthly Analytics</p>
                <h2>{getMonthLabel(monthDate)}</h2>
              </div>
            </div>

            <div className="analytics-focus">
              <label className="analytics-selector">
                Goal Tracker
                <select
                  value={activeAnalyticsGoalKey}
                  onChange={(event) => setSelectedAnalyticsGoalId(event.target.value)}
                >
                  {analyticsGoalOptions.map((goal) => (
                    <option key={goal.key} value={goal.key}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="analytics-count">
                <span>{selectedAnalyticsGoalName}</span>
                <strong>{analytics.selectedGoalCount}</strong>
              </div>
            </div>

            <div className="analytics-grid">
              <StatCard label="Average Score" value={analytics.averageScore} />
              <StatCard label="Best Score" value={analytics.bestScore} />
              <StatCard label="Logged Weekdays" value={analytics.completedDays} />
              <StatCard label="Green Days" value={analytics.greenDays} />
              <StatCard label="Current Streak" value={analytics.streak} />
              <StatCard label="Best Streak" value={analytics.bestStreak} />
            </div>
          </section>
        </main>
      )}

      {activeTab === 'Settings' && (
        <main className="single-panel">
          <section className="settings-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Backup And Preferences</p>
                <h2>Settings</h2>
              </div>
            </div>

            <label>
              App Name
              <RequiredInput
                key={`app-name-${settings.appName || 'LevelUp'}`}
                value={settings.appName || ''}
                fallbackValue="LevelUp"
                onCommit={(value) => persistData({
                  ...appData,
                  settings: {
                    ...settings,
                    appName: value,
                  },
                })}
              />
            </label>

            <label>
              Weekday Score Limit
              <RequiredInput
                key={`score-limit-${settings.scoreLimit || 100}`}
                type="number"
                min="1"
                value={settings.scoreLimit || 100}
                fallbackValue="100"
                onCommit={(value) => persistData({
                  ...appData,
                  settings: {
                    ...settings,
                    scoreLimit: Number(value),
                  },
                })}
              />
            </label>

            <div className="button-row">
              <button type="button" className="primary-button" onClick={exportData}>
                Export JSON
              </button>
              <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
                Import JSON
              </button>
              <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importData} />
            </div>

            {importError && <p className="notice error">{importError}</p>}
          </section>
        </main>
      )}
    </div>
  )
}

function DayEditor({ canTrack, record, onChange, onToggleGoal }) {
  const tasks = record.temporaryTasks?.length ? record.temporaryTasks : [draftTask]
  const removeTask = (taskId) => {
    onChange((current) => ({
      ...current,
      temporaryTasks: (current.temporaryTasks || []).filter((item) => item.id !== taskId),
    }))
  }
  const updateTask = (taskId, patch) => {
    onChange((current) => {
      const currentTasks = current.temporaryTasks || []

      if (taskId === draftTask.id && currentTasks.length === 0) {
        return {
          ...current,
          temporaryTasks: [{ ...emptyTask(), ...patch }],
        }
      }

      return {
        ...current,
        temporaryTasks: currentTasks.map((item) => (
          item.id === taskId ? { ...item, ...patch } : item
        )),
      }
    })
  }

  return (
    <div className="editor-stack">
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={record.activeDay}
          disabled={!canTrack}
          onChange={(event) => onChange((current) => ({
            ...current,
            activeDay: event.target.checked,
          }))}
        />
        Active Day
      </label>

      {!canTrack && (
        <p className="notice muted">Tracking unlocks when this date arrives.</p>
      )}

      <div className="checklist">
        {record.goalSnapshot.map((goal) => (
          <label className="check-row" key={goal.id}>
            <input
              type="checkbox"
              checked={record.completedGoals.includes(goal.id)}
              disabled={!canTrack || !record.activeDay}
              onChange={() => onToggleGoal(goal.id)}
            />
            <span>{goal.name}</span>
            <strong>{goal.score}</strong>
          </label>
        ))}
      </div>

      <div className="task-section">
        <div className="weekend-goals">
          {tasks.map((task) => (
            <div className="weekend-goal-row" key={task.id}>
              <input
                type="checkbox"
                checked={task.completed}
                aria-label="Task Completed"
                disabled={!canTrack || !record.activeDay}
                onChange={(event) => updateTask(task.id, { completed: event.target.checked })}
              />
              <input
                value={task.title}
                placeholder="Task"
                disabled={!canTrack || !record.activeDay}
                onChange={(event) => updateTask(task.id, { title: event.target.value })}
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove Task"
                disabled={!canTrack || !record.activeDay}
                onClick={() => removeTask(task.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost-button"
          disabled={!canTrack || !record.activeDay}
          onClick={() => onChange((current) => ({
            ...current,
            temporaryTasks: [...(current.temporaryTasks || []), emptyTask()],
          }))}
        >
          Add Task
        </button>
      </div>

      <label>
        Notes
        <textarea
          value={record.notes}
          disabled={!canTrack}
          onChange={(event) => onChange((current) => ({
            ...current,
            notes: event.target.value,
          }))}
        />
      </label>
    </div>
  )
}

function WeekendEditor({ canTrack, record, weekendTargets, onChange }) {
  return (
    <div className="editor-stack">
      {!canTrack && (
        <p className="notice muted">Tracking unlocks when this date arrives.</p>
      )}

      <div className="checklist">
        {weekendTargets.map((target) => (
          <label className="check-row" key={target.id}>
            <input
              type="checkbox"
              checked={(record.completedTargets || []).includes(target.id)}
              disabled={!canTrack}
              onChange={(event) => onChange((current) => {
                const completedTargets = current.completedTargets || []

                return {
                  ...current,
                  completedTargets: event.target.checked
                    ? [...completedTargets, target.id]
                    : completedTargets.filter((id) => id !== target.id),
                }
              })}
            />
            <span>{target.name}</span>
          </label>
        ))}
      </div>

      <div className="weekend-goals">
        {(record.customGoals || []).map((goal) => (
          <div className="weekend-goal-row" key={goal.id}>
            <input
              type="checkbox"
              checked={goal.completed}
              aria-label="Task Completed"
              disabled={!canTrack}
              onChange={(event) => onChange((current) => ({
                ...current,
                customGoals: (current.customGoals || []).map((item) => (
                  item.id === goal.id ? { ...item, completed: event.target.checked } : item
                )),
              }))}
            />
            <input
              value={goal.title}
              placeholder="Task"
              disabled={!canTrack}
              onChange={(event) => onChange((current) => ({
                ...current,
                customGoals: (current.customGoals || []).map((item) => (
                  item.id === goal.id ? { ...item, title: event.target.value } : item
                )),
              }))}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Remove Task"
              disabled={!canTrack}
              onClick={() => onChange((current) => ({
                ...current,
                customGoals: (current.customGoals || []).filter((item) => item.id !== goal.id),
              }))}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ghost-button"
        disabled={!canTrack}
        onClick={() => onChange((current) => ({
          ...current,
          customGoals: [...(current.customGoals || []), emptyWeekendGoal()],
        }))}
      >
        Add Task
      </button>

      <label>
        Notes
        <textarea
          value={record.notes}
          disabled={!canTrack}
          onChange={(event) => onChange((current) => ({
            ...current,
            notes: event.target.value,
          }))}
        />
      </label>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M13.7 21a2 2 0 0 1-3.4 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function RequiredInput({
  fallbackValue,
  onCommit,
  value,
  ...props
}) {
  const [draftValue, setDraftValue] = useState(String(value ?? ''))

  const handleBlur = () => {
    const trimmedValue = draftValue.trim()

    if (!trimmedValue) {
      setDraftValue(String(value || fallbackValue || ''))
      return
    }

    onCommit(trimmedValue)
  }

  return (
    <input
      {...props}
      value={draftValue}
      onBlur={handleBlur}
      onChange={(event) => setDraftValue(event.target.value)}
    />
  )
}

export default App
