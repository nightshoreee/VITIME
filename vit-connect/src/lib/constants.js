export const CATEGORIES = ['Tech', 'Cultural', 'Sports', 'Food', 'Workshop', 'Market', 'Fest', 'Other']
export const GENDERS = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]
export const ACTIVITIES = [
  { value: 'hills', label: 'Hills' }, { value: 'lakes', label: 'Lakes' }, { value: 'restaurants', label: 'Restaurants' },
  { value: 'nightouts', label: 'Night-outs' }, { value: 'cafes', label: 'Cafés' }, { value: 'sports', label: 'Sports' },
  { value: 'movies', label: 'Movies' }, { value: 'games', label: 'Games' }, { value: 'other', label: 'Other' },
]
export const VIBES = ['chill', 'adventurous', 'foodie', 'nerdy', 'party', 'creative', 'sporty'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))
export const SLOTS = [
  { value: 'weekday_morning', label: 'Weekday mornings' }, { value: 'weekday_afternoon', label: 'Weekday afternoons' },
  { value: 'weekday_evening', label: 'Weekday evenings' }, { value: 'weekday_night', label: 'Weekday nights' },
  { value: 'weekend_morning', label: 'Weekend mornings' }, { value: 'weekend_afternoon', label: 'Weekend afternoons' },
  { value: 'weekend_evening', label: 'Weekend evenings' }, { value: 'weekend_night', label: 'Weekend nights' },
]
export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' }, { value: 'harassment', label: 'Harassment' }, { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'fake', label: 'Fake or impersonation' }, { value: 'safety', label: 'Safety concern' }, { value: 'other', label: 'Something else' },
]
export const label = (list, v) => list.find((x) => x.value === v)?.label ?? v
