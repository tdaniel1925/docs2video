import re
f=open('/root/server-backup.js','r')
c=f.read()
f.close()

# First apply all v2 fixes
changes=0
if 'probeAudioDuration' not in c:
    ri=c.find("app.post('/generate'")
    if ri>-1:
        fn="function probeAudioDuration(p){return new Promise(r=>{execFile('ffmpeg',['-i',p,'-f','null','-'],{timeout:10000},(_,__,se)=>{const m=se.match(/Duration: (\\d+):(\\d+):(\\d+)\\.(\\d+)/);r(m?parseInt(m[1])*3600+parseInt(m[2])*60+parseInt(m[3])+parseInt(m[4])*10/1000:0)})})}\n\n"
        c=c[:ri]+fn+c[ri:]
        changes+=1
        print('1. Added probeAudioDuration')

# Remove all -shortest
c=c.replace("          '-shortest',\n","")
c=c.replace("'-shortest', ","")
c=c.replace("'-shortest',","")
if "shortest" not in c:
    print('2. Removed all -shortest')
    changes+=1

# Fix the MAIN clip assembly (the one without -t)
# Find the block: if (audios[i]) { await runFfmpeg([...]) }
# Replace it to probe duration and add -t
old_block="""      if (audios[i]) {
        await runFfmpeg([
          '-loop', '1',
          '-i', slidePath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-y',
          clipPath,
        ])"""

new_block="""      if (audios[i]) {
        const rd=await probeAudioDuration(audioPath);
        const cd=rd>0?rd+1.0:10;
        console.log(`[${videoId}] Slide ${i+1}: audio=${rd.toFixed(1)}s clip=${cd.toFixed(1)}s`);
        await runFfmpeg([
          '-loop', '1',
          '-i', slidePath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-t', String(cd),
          '-y',
          clipPath,
        ])"""

if old_block in c:
    c=c.replace(old_block, new_block)
    changes+=1
    print('3. Fixed MAIN clip assembly with probed -t duration + 1s padding')
else:
    print('3. WARNING: Main clip block not found (may already be fixed)')

# Also fix the secondary clip assembly if it still has no -t
old2="'-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-y', clipPath"
if old2 in c:
    new2="'-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(clipDur), '-y', clipPath"
    c=c.replace(old2, new2)
    changes+=1
    print('4. Fixed secondary clip assembly')

# Array guard
if 'Audio-slide count mismatch' not in c:
    guard='    if(audioBuffers.length!==slideBuffers.length){console.warn(`[${videoId}] Audio-slide count mismatch: ${audioBuffers.length} audio vs ${slideBuffers.length} slides`);while(audioBuffers.length<slideBuffers.length)audioBuffers.push(Buffer.alloc(0));if(audioBuffers.length>slideBuffers.length)audioBuffers.length=slideBuffers.length;}\n\n    // Create clips'
    c=c.replace('    // Create clips',guard,1)
    changes+=1
    print('5. Added array guard')

rem=c.count('-shortest')
print('6. Remaining -shortest: '+str(rem))
f=open('/root/server-fixed.js','w')
f.write(c)
f.close()
print('Done! '+str(changes)+' fixes written to /root/server-fixed.js')
