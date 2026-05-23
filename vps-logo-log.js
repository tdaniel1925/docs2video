const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

code = code.replace(
  `} catch (e) { /* logo composite failed, use slide without */ }`,
  `console.log(\`[\${videoId}] Logo composited on slide \${idx + 1}\`)
            } catch (e) { console.log(\`[\${videoId}] Logo composite failed on slide \${idx + 1}:\`, e.message) }`
)

fs.writeFileSync('/tmp/server.js', code, 'utf8')
console.log('SUCCESS: Added logo composite logging')
