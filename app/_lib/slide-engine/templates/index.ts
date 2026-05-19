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
import { socialGrid } from './social-grid'
import { blueSteps, isometric, flatVector, doodle, lineArt, vintageCraft, flatCartoon } from './batch-styles-1'
import { colorfulSteps, timeline, animePop, feltCraft, botanicalWarm, vintageEditorial, tornCollage } from './batch-styles-2'
import { inventorBox, cafeRealistic, oldNewspaper, paperLayers, streetGraffiti, urbanChaos, urbanCanvas } from './batch-styles-3'
import { neonNightclub, brickBlocks, cinematicHud, americanaPoster, blackLabel, fireVibes, summerFest } from './batch-styles-4'
import { indieZine, redNeon, editorial, rockPoster, streetGrunge, stockCertificate, vintageBond } from './batch-styles-5'
import { nightclubFlyer, concertPoster, moviePoster, festival, scientificPaper, collageScrapbook, gradientMesh, newspaper, travelMagazine } from './batch-styles-6'

export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  'executive': executive,
  'steampunk': steampunk,
  'urban-friday': urbanFriday,
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
  'social-grid': socialGrid,
  'blue-steps': blueSteps,
  'isometric': isometric,
  'flat-vector': flatVector,
  'doodle': doodle,
  'line-art': lineArt,
  'vintage-craft': vintageCraft,
  'flat-cartoon': flatCartoon,
  'colorful-steps': colorfulSteps,
  'timeline': timeline,
  'anime-pop': animePop,
  'felt-craft': feltCraft,
  'botanical-warm': botanicalWarm,
  'vintage-editorial': vintageEditorial,
  'torn-collage': tornCollage,
  'inventor-box': inventorBox,
  'cafe-realistic': cafeRealistic,
  'old-newspaper': oldNewspaper,
  'paper-layers': paperLayers,
  'street-graffiti': streetGraffiti,
  'urban-chaos': urbanChaos,
  'urban-canvas': urbanCanvas,
  'neon-nightclub': neonNightclub,
  'brick-blocks': brickBlocks,
  'cinematic-hud': cinematicHud,
  'americana-poster': americanaPoster,
  'black-label': blackLabel,
  'fire-vibes': fireVibes,
  'summer-fest': summerFest,
  'indie-zine': indieZine,
  'red-neon': redNeon,
  'editorial': editorial,
  'rock-poster': rockPoster,
  'street-grunge': streetGrunge,
  'stock-certificate': stockCertificate,
  'vintage-bond': vintageBond,
  'nightclub-flyer': nightclubFlyer,
  'concert-poster': concertPoster,
  'movie-poster': moviePoster,
  'festival': festival,
  'scientific-paper': scientificPaper,
  'collage-scrapbook': collageScrapbook,
  'gradient-mesh': gradientMesh,
  'newspaper': newspaper,
  'travel-magazine': travelMagazine,
}

export function getTemplateSpec(id: string): TemplateSpec {
  return TEMPLATE_SPECS[id] || TEMPLATE_SPECS['executive']
}
