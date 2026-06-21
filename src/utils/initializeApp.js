import defaultConfig from '../data/defaultConfig'
import { getAppData, saveAppData } from '../services/localStorageService'
import { getWeekdayGoalTotal } from '../services/scoringService'

export const initializeApp = () => {
  const existingData = getAppData()
  const hasRecords = (
    Object.keys(existingData.dayRecords || {}).length > 0
    || Object.keys(existingData.weekendRecords || {}).length > 0
  )

  if (!existingData.goals?.length || (!hasRecords && getWeekdayGoalTotal(existingData.goals) !== 100)) {
    saveAppData(defaultConfig)
    return defaultConfig
  }

  const mergedData = {
    ...defaultConfig,
    ...existingData,
    settings: {
      ...defaultConfig.settings,
      ...existingData.settings,
    },
    dayRecords: existingData.dayRecords || {},
    weekendRecords: existingData.weekendRecords || {},
  }

  saveAppData(mergedData)
  return mergedData
}
