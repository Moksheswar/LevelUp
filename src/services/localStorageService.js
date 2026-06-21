const STORAGE_KEY = 'levelup_data'

export const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('save error', e)
  }
}

export const load = (key, defaultValue = null) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : defaultValue
  } catch (e) {
    console.error('load error', e)
    return defaultValue
  }
}

export const getAppData = () => load(STORAGE_KEY, {
  settings: {},
  goals: [],
  dayRecords: {},
  weekendRecords: {},
})

export const saveAppData = (data) => {
  save(STORAGE_KEY, data)
}

export { STORAGE_KEY }
