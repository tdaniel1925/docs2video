#!/bin/bash
# VPS patch: Upload music separately instead of mixing into MP4
# Run this on the VPS via: bash vps-music-patch.sh
# Then restart: docker restart docs2video-service

CONTAINER=docs2video-service
FILE=/app/server.js

# Step 1: Replace the music mixing block (lines 736-758) with upload-separately logic
# Old: Mix music into video with FFmpeg amix
# New: Upload music MP3 to Supabase storage, save URL for frontend playback
docker exec $CONTAINER sed -i '
/Mix music under narration/,/Music mixed successfully/{
  /Mix music under narration/c\
            // Upload music separately for frontend playback\
            await updateStatus('\''assembling'\'', '\''Uploading background music...'\'', 91)\
            const musicStoragePath = `${userId}/${videoId}_music.mp3`\
            const musicBuffer = await readFile(musicPath)\
            await supabase.storage.from('\''videos'\'').upload(musicStoragePath, musicBuffer, { contentType: '\''audio/mpeg'\'', upsert: true })\
            const { data: musicUrlData } = supabase.storage.from('\''videos'\'').getPublicUrl(musicStoragePath)\
            musicPublicUrl = musicUrlData.publicUrl\
            console.log(`[${videoId}] Music uploaded separately: ${musicPublicUrl}`)
  /Mix music under narration/!{
    /Music mixed successfully/!d
    /Music mixed successfully/d
  }
}
' $FILE

echo "Step 1 done: replaced music mixing with upload"

# Step 2: Add musicPublicUrl variable declaration before the music generation block
docker exec $CONTAINER sed -i '/let musicSaved = false/i\    let musicPublicUrl = null' $FILE

echo "Step 2 done: added musicPublicUrl variable"

# Step 3: Remove the 'finalPath = mixedPath' line (no longer mixing)
docker exec $CONTAINER sed -i '/finalPath = mixedPath/d' $FILE

echo "Step 3 done: removed finalPath reassignment"

# Step 4: Add music_url to the DB update
docker exec $CONTAINER sed -i 's/slide_urls: slideUrls,/slide_urls: slideUrls,\n        music_url: musicPublicUrl,/' $FILE

echo "Step 4 done: added music_url to DB update"

echo ""
echo "All patches applied. Now restart the container:"
echo "  docker restart docs2video-service"
