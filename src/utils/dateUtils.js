const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})
const readableFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export const toDateKey = (date = new Date()) => {
  const value = new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const fromDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(year, month - 1, day)
}

export const getDayName = (date) => dayFormatter.format(date)

export const isWeekend = (date) => {
  const day = date.getDay()

  return day === 0 || day === 6
}

export const getMonthLabel = (date) => monthFormatter.format(date)

export const getReadableDate = (dateKey) => readableFormatter.format(fromDateKey(dateKey))

export const addMonths = (date, amount) => (
  new Date(date.getFullYear(), date.getMonth() + amount, 1)
)

export const getCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const startDate = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)

    return {
      date,
      dateKey: toDateKey(date),
      inMonth: date.getMonth() === month,
      isToday: toDateKey(date) === toDateKey(new Date()),
      isWeekend: isWeekend(date),
      dayName: getDayName(date),
    }
  })
}
