import type { TemplateSpec } from '../types'
import { urbanFriday } from './urban-friday'
import { steampunk } from './steampunk'
import { executive } from './executive'
import { profileResume } from './profile-resume'
import { neonCyber } from './neon-cyber'
import { glassmorphism } from './glassmorphism'
import { watercolor } from './watercolor'
import { chalkboard } from './chalkboard'
import { artDeco } from './art-deco'
import { medicalJournal } from './medical-journal'
import { legalBrief } from './legal-brief'
import { commercialPro } from './commercial-pro'
import { comicBook } from './comic-book'
import { marbleGold } from './marble-gold'
import { neubrutalism } from './neubrutalism'
import { terminal } from './terminal'

export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  'urban-friday': urbanFriday,
  'steampunk': steampunk,
  'executive': executive,
  'profile-resume': profileResume,
  'neon-cyber': neonCyber,
  'glassmorphism': glassmorphism,
  'watercolor': watercolor,
  'chalkboard': chalkboard,
  'chalkboard-v2': chalkboard,
  'art-deco': artDeco,
  'medical-journal': medicalJournal,
  'legal-brief': legalBrief,
  'commercial-pro': commercialPro,
  'comic-book': comicBook,
  'marble-gold': marbleGold,
  'neubrutalism': neubrutalism,
  'terminal': terminal,
}

export function getTemplateSpec(id: string): TemplateSpec {
  return TEMPLATE_SPECS[id] || TEMPLATE_SPECS['executive']
}
