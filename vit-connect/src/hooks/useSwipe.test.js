import { describe, expect, it } from 'vitest'
import { swipeIntent } from './useSwipe'

describe('swipeIntent', () => {
  it('detects horizontal swipes', () => {
    expect(swipeIntent(120, 10)).toBe('right')   // left→right = Home
    expect(swipeIntent(-120, 10)).toBe('left')   // right→left = Profile
  })
  it('ignores short or vertical-ish gestures (scrolling)', () => {
    expect(swipeIntent(40, 0)).toBeNull()
    expect(swipeIntent(100, 90)).toBeNull()
    expect(swipeIntent(0, 200)).toBeNull()
  })
})
