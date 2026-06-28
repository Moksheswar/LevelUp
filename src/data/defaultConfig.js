export const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export const defaultGoals = [
  {
    id: 'wake_up',
    name: 'Wake Up',
    score: 5,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'meditation',
    name: 'Meditation / Relaxation',
    score: 5,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'eye_face',
    name: 'Eye & Face Exercise',
    score: 3,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'gym_workout',
    name: 'Gym Workout',
    score: 15,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'deep_work',
    name: 'Deep Work / Study',
    score: 20,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'career_progress',
    name: 'Career Progress',
    score: 20,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'nutrition',
    name: 'Nutrition / Protein',
    score: 12,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'water',
    name: 'Water Target',
    score: 5,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'sleep',
    name: 'Sleep Routine',
    score: 10,
    active: true,
    applicableDays: weekdayNames,
  },
  {
    id: 'planning',
    name: 'Plan Tomorrow',
    score: 5,
    active: true,
    applicableDays: weekdayNames,
  },
]

export const defaultSettings = {
  appName: 'LevelUp',
  scoreLimit: 100,
  weekendColor: 'blue',
  weeksStartOn: 1,
}

export const defaultWeekendTargets = [
  { id: 'career_progress', name: 'Career Progress' },
  { id: 'water_target', name: 'Water Target' },
  { id: 'sleep_routine', name: 'Sleep Routine' },
  { id: 'semen_retention', name: 'Semen Retention' },
  { id: 'bing_points', name: 'Bing Points' },
]

const defaultConfig = {
  settings: defaultSettings,
  goals: defaultGoals,
  weekendTargets: defaultWeekendTargets,
  weekendTargetHistory: defaultWeekendTargets,
  dayRecords: {},
  weekendRecords: {},
  notifications: [],
}

export default defaultConfig
