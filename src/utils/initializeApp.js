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
    weekendTargets: existingData.weekendTargets || defaultConfig.weekendTargets,
    weekendTargetHistory: existingData.weekendTargetHistory || defaultConfig.weekendTargetHistory,
    dayRecords: existingData.dayRecords || {},
    weekendRecords: existingData.weekendRecords || {},
    notifications: existingData.notifications || [],
  }

  saveAppData(mergedData)
  return mergedData
}
