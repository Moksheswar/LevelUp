export const getWeekdayGoalTotal = (goals = []) => (
  goals
    .filter((goal) => goal.active)
    .reduce((total, goal) => total + Number(goal.score || 0), 0)
)

export const createGoalSnapshot = (goals = []) => (
  goals
    .filter((goal) => goal.active)
    .map(({ id, name, score }) => ({
      id,
      name,
      score: Number(score || 0),
    }))
)

export const calculateDayScore = (goalSnapshot = [], completedGoals = []) => (
  goalSnapshot.reduce((total, goal) => {
    if (!completedGoals.includes(goal.id)) {
      return total
    }

    return total + Number(goal.score || 0)
  }, 0)
)

export const getScoreColor = (score, activeDay = true) => {
  if (!activeDay) {
    return 'muted'
  }

  if (score >= 90) {
    return 'green'
  }

  if (score >= 70) {
    return 'yellow'
  }

  if (score >= 50) {
    return 'orange'
  }

  return 'red'
}
