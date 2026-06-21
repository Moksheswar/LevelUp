import { useMemo, useRef, useState } from 'react'
import './App.css'
import { defaultGoals } from './data/defaultConfig'
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

const createEmptyDayRecord = (dateKey, goals) => {
  const goalSnapshot = createGoalSnapshot(goals)
  const score = calculateDayScore(goalSnapshot, [])

  return {
    date: dateKey,
    activeDay: true,
    score,
    color: getScoreColor(score, true),
    completedGoals: [],
    notes: '',
    goalSnapshot,
  }
}

const createEmptyWeekendRecord = (dateKey) => ({
  date: dateKey,
  customGoals: [emptyWeekendGoal()],
  water: 0,
  sleep: 0,
  proteinLocked: false,
  notes: '',
})

const normalizeGoal = (goal) => ({
  ...goal,
  score: Number(goal.score || 0),
  applicableDays: goal.applicableDays?.length
    ? goal.applicableDays
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
})

function App() {
  const [appData, setAppData] = useState(() => initializeApp())
  const [activeTab, setActiveTab] = useState('Calendar')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  const goals = useMemo(() => appData.goals || [], [appData.goals])
  const settings = appData.settings || {}
  const selectedDate = fromDateKey(selectedDateKey)
  const selectedIsWeekend = isWeekend(selectedDate)
  const weekdayTotal = getWeekdayGoalTotal(goals)

  const selectedDayRecord = useMemo(() => {
    return appData.dayRecords?.[selectedDateKey]
      || createEmptyDayRecord(selectedDateKey, goals)
  }, [appData.dayRecords, goals, selectedDateKey])

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

    return {
      averageScore,
      bestScore,
      completedDays,
      greenDays,
      streak,
    }
  }, [appData.dayRecords, monthDate])

  const persistData = (nextData) => {
    setAppData(nextData)
    saveAppData(nextData)
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
    persistData({
      ...appData,
      goals: goals.map((goal) => (
        goal.id === goalId ? normalizeGoal({ ...goal, ...patch }) : goal
      )),
    })
  }

  const addGoal = () => {
    persistData({
      ...appData,
      goals: [
        ...goals,
        {
          id: `goal_${Date.now()}`,
          name: 'New Goal',
          score: 5,
          active: true,
          applicableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        },
      ],
    })
  }

  const deleteGoal = (goalId) => {
    persistData({
      ...appData,
      goals: goals.filter((goal) => goal.id !== goalId),
    })
  }

  const resetDefaultGoals = () => {
    persistData({
      ...appData,
      goals: defaultGoals,
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

    return `calendar-cell ${record.color}`
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-first habit scorecard</p>
          <h1>{settings.appName || 'LevelUp'}</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={exportData}>
            Export
          </button>
          <button type="button" className="primary-button" onClick={() => setSelectedDateKey(toDateKey(new Date()))}>
            Today
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="LevelUp sections">
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
              <button type="button" className="icon-button" aria-label="Previous month" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
                &lt;
              </button>
              <h2>{getMonthLabel(monthDate)}</h2>
              <button type="button" className="icon-button" aria-label="Next month" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
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
                <p className="eyebrow">{selectedIsWeekend ? 'Weekend mode' : 'Weekday score'}</p>
                <h2>{getReadableDate(selectedDateKey)}</h2>
              </div>
              {!selectedIsWeekend && (
                <strong className={`score-pill ${selectedDayRecord.color}`}>
                  {selectedDayRecord.activeDay ? selectedDayRecord.score : 'Off'}
                </strong>
              )}
            </div>

            {selectedIsWeekend ? (
              <WeekendEditor
                record={selectedWeekendRecord}
                onChange={updateWeekendRecord}
              />
            ) : (
              <DayEditor
                record={selectedDayRecord}
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
                <p className="eyebrow">Weekday template</p>
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
                  <input
                    value={goal.name}
                    aria-label="Goal name"
                    onChange={(event) => updateGoal(goal.id, { name: event.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goal.score}
                    aria-label="Goal score"
                    onChange={(event) => updateGoal(goal.id, { score: event.target.value })}
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
          </section>
        </main>
      )}

      {activeTab === 'Analytics' && (
        <main className="single-panel">
          <section className="analytics-grid">
            <StatCard label="Average score" value={analytics.averageScore} />
            <StatCard label="Best score" value={analytics.bestScore} />
            <StatCard label="Logged weekdays" value={analytics.completedDays} />
            <StatCard label="Green days" value={analytics.greenDays} />
            <StatCard label="Current 90+ streak" value={analytics.streak} />
          </section>
        </main>
      )}

      {activeTab === 'Settings' && (
        <main className="single-panel">
          <section className="settings-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Backup and preferences</p>
                <h2>Settings</h2>
              </div>
            </div>

            <label>
              App name
              <input
                value={settings.appName || ''}
                onChange={(event) => persistData({
                  ...appData,
                  settings: {
                    ...settings,
                    appName: event.target.value,
                  },
                })}
              />
            </label>

            <label>
              Weekday score limit
              <input
                type="number"
                min="1"
                value={settings.scoreLimit || 100}
                onChange={(event) => persistData({
                  ...appData,
                  settings: {
                    ...settings,
                    scoreLimit: Number(event.target.value || 100),
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

function DayEditor({ record, onChange, onToggleGoal }) {
  return (
    <div className="editor-stack">
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={record.activeDay}
          onChange={(event) => onChange((current) => ({
            ...current,
            activeDay: event.target.checked,
          }))}
        />
        Active day
      </label>

      <div className="checklist">
        {record.goalSnapshot.map((goal) => (
          <label className="check-row" key={goal.id}>
            <input
              type="checkbox"
              checked={record.completedGoals.includes(goal.id)}
              disabled={!record.activeDay}
              onChange={() => onToggleGoal(goal.id)}
            />
            <span>{goal.name}</span>
            <strong>{goal.score}</strong>
          </label>
        ))}
      </div>

      <label>
        Notes
        <textarea
          value={record.notes}
          onChange={(event) => onChange((current) => ({
            ...current,
            notes: event.target.value,
          }))}
        />
      </label>
    </div>
  )
}

function WeekendEditor({ record, onChange }) {
  return (
    <div className="editor-stack">
      <div className="weekend-goals">
        {record.customGoals.map((goal) => (
          <div className="weekend-goal-row" key={goal.id}>
            <input
              type="checkbox"
              checked={goal.completed}
              aria-label="Weekend goal completed"
              onChange={(event) => onChange((current) => ({
                ...current,
                customGoals: current.customGoals.map((item) => (
                  item.id === goal.id ? { ...item, completed: event.target.checked } : item
                )),
              }))}
            />
            <input
              value={goal.title}
              placeholder="Weekend goal"
              onChange={(event) => onChange((current) => ({
                ...current,
                customGoals: current.customGoals.map((item) => (
                  item.id === goal.id ? { ...item, title: event.target.value } : item
                )),
              }))}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Remove weekend goal"
              onClick={() => onChange((current) => ({
                ...current,
                customGoals: current.customGoals.filter((item) => item.id !== goal.id),
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
        onClick={() => onChange((current) => ({
          ...current,
          customGoals: [...current.customGoals, emptyWeekendGoal()],
        }))}
      >
        Add Weekend Goal
      </button>

      <div className="metric-grid">
        <label>
          Water
          <input
            type="number"
            min="0"
            value={record.water}
            onChange={(event) => onChange((current) => ({
              ...current,
              water: Number(event.target.value || 0),
            }))}
          />
        </label>
        <label>
          Sleep
          <input
            type="number"
            min="0"
            step="0.5"
            value={record.sleep}
            onChange={(event) => onChange((current) => ({
              ...current,
              sleep: Number(event.target.value || 0),
            }))}
          />
        </label>
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={record.proteinLocked}
          onChange={(event) => onChange((current) => ({
            ...current,
            proteinLocked: event.target.checked,
          }))}
        />
        Protein lock
      </label>

      <label>
        Notes
        <textarea
          value={record.notes}
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

export default App
