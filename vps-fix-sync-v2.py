import re,sys
f=open('/root/server-backup.js','r')
c=f.read()
f.close()
changes=0
if 'probeAudioDuration' not in c:
    ri=c.find("app.post('/generate'")
    if ri>-1:
        fn="function probeAudioDuration(p){return new Promise(r=>{execFile('ffmpeg',['-i',p,'-f','null','-'],{timeout:10000},(_,__,se)=>{const m=se.match(/Duration: (\\d+):(\\d+):(\\d+)\\.(\\d+)/);r(m?parseInt(m[1])*3600+parseInt(m[2])*60+parseInt(m[3])+parseInt(m[4])*10/1000:0)})})}\n\n"
        c=c[:ri]+fn+c[ri:]
        changes+=1
        print('1. Added probeAudioDuration')
c2=re.sub(r"'-af',\s*'adelay=\d+\|\d+',\s*'-shortest',\s*'-y',\s*clipPath\]","'-t', String(clipDur), '-y', clipPath]",c)
c2=re.sub(r"'-shortest',\s*'-y',\s*clipPath\]","'-t', String(clipDur), '-y', clipPath]",c2)
if c2!=c:
    c=c2
    changes+=1
    print('2. Replaced -shortest with -t clipDur')
def add_probe(m):
    indent=m.group(1)
    cmd=m.group(2)
    return indent+'const realDur=await probeAudioDuration(audioPath);\n'+indent+'const clipDur=realDur>0?realDur+0.8:Math.ceil(audioBuffers[i].length/16000)+1;\n'+indent+cmd
c2=re.sub(r"([ \t]+)(await runFfmpeg\(\['-loop'[^\n]*String\(clipDur\)[^\n]*\]\))",add_probe,c)
if c2!=c:
    c=c2
    changes+=1
    print('3. Added duration probing')
if 'Audio-slide count mismatch' not in c:
    guard='    if(audioBuffers.length!==slideBuffers.length){console.warn(`[${videoId}] Audio-slide count mismatch: ${audioBuffers.length} audio vs ${slideBuffers.length} slides`);while(audioBuffers.length<slideBuffers.length)audioBuffers.push(Buffer.alloc(0));if(audioBuffers.length>slideBuffers.length)audioBuffers.length=slideBuffers.length;}\n\n    // Create clips'
    c=c.replace('    // Create clips',guard,1)
    changes+=1
    print('4. Added array guard')
rem=len(re.findall(r"'-shortest'",c))
print('5. Remaining -shortest: '+str(rem))
f=open('/root/server-fixed.js','w')
f.write(c)
f.close()
print('Done! '+str(changes)+' fixes written to /root/server-fixed.js')
