import type { TemplateSpec } from '../types'
import { urbanFriday } from './urban-friday'
import { steampunk } from './steampunk'
import { executive } from './executive'
import { profileResume } from './profile-resume'

export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  'urban-friday': urbanFriday,
  'steampunk': steampunk,
  'executive': executive,
  'profile-resume': profileResume,
}

export function getTemplateSpec(id: string): TemplateSpec {
  return TEMPLATE_SPECS[id] || TEMPLATE_SPECS['executive']
}
