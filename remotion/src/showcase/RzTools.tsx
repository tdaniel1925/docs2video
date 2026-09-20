import { makeTool, makeTour, type ToolData, type ToolSpec } from './RzTool'
import { SIZES, DECK, PPTX, EDIT, LIBRARY } from './rzspecs'
import sizesVo from '../../public/showcase/rzsizes/vo.json'
import sizesGrid from '../../public/showcase/rzsizes/beatgrid.json'
import sizesBoxes from '../../public/showcase/rzsizes/boxes.json'
import deckVo from '../../public/showcase/rzdeck/vo.json'
import deckGrid from '../../public/showcase/rzdeck/beatgrid.json'
import deckBoxes from '../../public/showcase/rzdeck/boxes.json'
import pptxVo from '../../public/showcase/rzpptx/vo.json'
import pptxGrid from '../../public/showcase/rzpptx/beatgrid.json'
import pptxBoxes from '../../public/showcase/rzpptx/boxes.json'
import editVo from '../../public/showcase/rzedit/vo.json'
import editGrid from '../../public/showcase/rzedit/beatgrid.json'
import editBoxes from '../../public/showcase/rzedit/boxes.json'
import libVo from '../../public/showcase/rzlibrary/vo.json'
import libGrid from '../../public/showcase/rzlibrary/beatgrid.json'
import libBoxes from '../../public/showcase/rzlibrary/boxes.json'

export const RzSizes = makeTool({ spec: SIZES, vo: sizesVo as any, grid: sizesGrid as any, boxes: sizesBoxes as any })
export const RzDeck = makeTool({ spec: DECK, vo: deckVo as any, grid: deckGrid as any, boxes: deckBoxes as any })
export const RzPptx = makeTool({ spec: PPTX, vo: pptxVo as any, grid: pptxGrid as any, boxes: pptxBoxes as any })
export const RzEdit = makeTool({ spec: EDIT, vo: editVo as any, grid: editGrid as any, boxes: editBoxes as any })
export const RzLibrary = makeTool({ spec: LIBRARY, vo: libVo as any, grid: libGrid as any, boxes: libBoxes as any })

import makeVo from '../../public/showcase/rzmake/vo.json'
import makeGrid from '../../public/showcase/rzmake/beatgrid.json'
import makeBoxes from '../../public/showcase/rzmake/boxes.json'
import tourVo from '../../public/showcase/rztour/vo.json'
import tourGrid from '../../public/showcase/rztour/beatgrid.json'
const MAKE: ToolSpec = { id: 'rzmake', url: 'restylez.app/make', beats: [], cta: { head: '', url: '' } }
const makeData: ToolData = { spec: MAKE, vo: makeVo as any, grid: makeGrid as any, boxes: makeBoxes as any }
const sizesData: ToolData = { spec: SIZES, vo: sizesVo as any, grid: sizesGrid as any, boxes: sizesBoxes as any }
const deckData: ToolData = { spec: DECK, vo: deckVo as any, grid: deckGrid as any, boxes: deckBoxes as any }
const pptxData: ToolData = { spec: PPTX, vo: pptxVo as any, grid: pptxGrid as any, boxes: pptxBoxes as any }
const editData: ToolData = { spec: EDIT, vo: editVo as any, grid: editGrid as any, boxes: editBoxes as any }
const libData: ToolData = { spec: LIBRARY, vo: libVo as any, grid: libGrid as any, boxes: libBoxes as any }
export const RzTour = makeTour('rztour', [
  { data: makeData, beat: { shot: '1-empty', focus: 'page_top', kicker: 'The 90-second tour', head: 'The first AI graphic designer *in a box.*', url: 'restylez.app/make' } },
  { data: makeData, beat: { shot: '6-result', focus: 'remade', bias: 0, zoom: 1.08, kicker: 'Remake', head: 'Say what to change — *nothing else moves.*', stamp: 'About a minute', stampColor: '#14161a', url: 'restylez.app/make' } },
  { data: editData, beat: { shot: '5-result', focus: 'result', bias: 60, zoom: 1.06, kicker: 'The Editor', head: 'Fix a detail — *only that changes.*', stamp: 'Every version saved', stampColor: '#2e6be6', url: 'restylez.app/edit' } },
  { data: sizesData, beat: { shot: '5-result', focus: 'results', bias: 120, zoom: 1.08, kicker: 'Sizes', head: 'Every size — *in one go.*', stamp: 'Print · social · event', stampColor: '#14161a', url: 'restylez.app/sizes' } },
  { data: deckData, beat: { shot: '6-result', focus: 'deck', bias: 260, zoom: 1.05, kicker: 'Slide Decks', head: 'A whole deck — *in any look.*', stamp: 'Numbers stay exact', url: 'restylez.app/deck' } },
  { data: pptxData, beat: { shot: '5-result', focus: 'download', bias: 0, zoom: 1.1, cursor: 'download', click: true, clickAt: 0.6, kicker: 'PowerPoint', head: 'Edit a PowerPoint — *still editable.*', stamp: 'Real .pptx', stampColor: '#2e6be6', url: 'restylez.app/pptx' } },
  { data: libData, beat: { shot: '4-account', focus: 'add50', bias: -60, zoom: 1.06, kicker: 'Library & Account', head: 'Your work, *your balance,* one place.', stamp: 'From $20', stampColor: '#2e6be6', url: 'restylez.app/account' } },
  { data: libData, beat: { kind: 'cta', head: '' } },
], tourVo as any, tourGrid as any, { head: 'One design in. Anything out.', url: 'restylez.app' })
