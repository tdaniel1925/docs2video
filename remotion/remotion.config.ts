import { Config } from '@remotion/cli/config'

Config.setEntryPoint('./src/index.ts')
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setConcurrency(null) // auto
// h264 1080p output by default
Config.setCodec('h264')
