import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextReminderTime, getReminderDelayMs } from './reminderUtils.js'

test('getNextReminderTime returns today at 10 PM when current time is earlier', () => {
  const now = new Date('2026-07-01T21:30:00')
  const next = getNextReminderTime(now)

  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 6)
  assert.equal(next.getDate(), 1)
  assert.equal(next.getHours(), 22)
  assert.equal(next.getMinutes(), 0)
  assert.equal(next.getSeconds(), 0)
})

test('getNextReminderTime returns tomorrow at 10 PM when current time is after 10 PM', () => {
  const now = new Date('2026-07-01T22:30:00')
  const next = getNextReminderTime(now)

  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 6)
  assert.equal(next.getDate(), 2)
  assert.equal(next.getHours(), 22)
})

test('getReminderDelayMs returns a positive delay for future reminders', () => {
  const now = new Date('2026-07-01T21:30:00')
  const next = getNextReminderTime(now)
  const delay = getReminderDelayMs(now, next)

  assert.equal(delay, 30 * 60 * 1000)
})
