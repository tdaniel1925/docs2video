/**
 * VPS: Cover/closing are now regular slides with narration.
 * Detect COVER_SLIDE: and CLOSING_SLIDE: prefixes in slidePrompts
 * and use generateCover for those, generateOneSlide for everything else.
 * No more separate cover/closing in batch loop — everything is 1:1.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Find the batch loop dispatch line
const oldDispatch = "if (j === 0) {"
const batchIdx = c.indexOf('const BATCH_SIZE')
if (batchIdx === -1) { console.log('ERROR: BATCH_SIZE not found'); process.exit(1) }

// Find the dispatch logic inside the batch loop
const dispatchIdx = c.indexOf(oldDispatch, batchIdx)
if (dispatchIdx === -1) { console.log('ERROR: dispatch not found after BATCH_SIZE'); process.exit(1) }

// Find the end of the dispatch block — ends with batch.push(promise.then(
const dispatchEnd = c.indexOf('batch.push(promise.then(', dispatchIdx)
if (dispatchEnd === -1) { console.log('ERROR: batch.push not found'); process.exit(1) }

// Replace the dispatch logic
const oldBlock = c.substring(dispatchIdx, dispatchEnd)
const newBlock = `const promptStr = typeof slidePrompts[j] === 'string' ? slidePrompts[j] : ''
        let promise
        if (promptStr.startsWith('COVER_SLIDE:')) {
          const parts = promptStr.split(':')
          promise = generateCover('cover').catch(err => { console.error('[' + videoId + '] Cover failed:', err.message?.slice(0, 80)); return generateOneSlide(j) })
        } else if (promptStr.startsWith('CLOSING_SLIDE:')) {
          promise = generateCover('closing').catch(err => { console.error('[' + videoId + '] Closing failed:', err.message?.slice(0, 80)); return generateOneSlide(j) })
        } else {
          promise = generateOneSlide(j)
        }
        `

c = c.substring(0, dispatchIdx) + newBlock + c.substring(dispatchEnd)

fs.writeFileSync(serverPath, c)
console.log('Updated batch dispatch — cover/closing detected by COVER_SLIDE:/CLOSING_SLIDE: prefix')
console.log('Restart: docker restart docs2video-service')
