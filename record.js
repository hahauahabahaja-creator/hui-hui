name: Secure Cloud Meet Recorder

on:
  workflow_dispatch:
    inputs:
      meet_url:
        description: 'Target Meeting URL'
        required: true
        type: string

jobs:
  Recording-Engine:
    runs-on: ubuntu-latest
    timeout-minutes: 350
    
    permissions:
      contents: read
      actions: write

    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 🛠️ Install Core Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb ffmpeg chromium-browser jq pulseaudio xdotool scrot
          pip install requests
          if [ -f package.json ]; then npm install; fi

      - name: 🎥 Start Engine (HQ Video Mode)
        env:
          MEET_URL: ${{ github.event.inputs.meet_url }}
          GITHUB_TOKEN: ${{ secrets.PAT_TOKEN }}
          REPO_NAME: ${{ github.repository }}
          BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          GOOGLE_COOKIES: ${{ secrets.GOOGLE_COOKIES }}
        run: |
          # Start audio
          pulseaudio -D --exit-idle-time=-1
          
          # Start display server
          Xvfb :99 -screen 0 1366x768x24 &
          export DISPLAY=:99
          
          # Start recording
          node record.js "$MEET_URL" & 
          MEET_PID=$!
          
          # Enhanced video capture with timestamp
          ffmpeg -y -f x11grab -video_size 1366x768 -framerate 30 -i :99 \
                 -f pulse -i default \
                 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
                 -c:a aac -b:a 192k -movflags +faststart \
                 -vf "drawtext=text='Recording %Y-%m-%d %H\:%M\:%S':x=10:y=10:fontcolor=white:fontsize=12:box=1:boxcolor=black@0.5" \
                 output.mp4 > /dev/null 2>&1 &
          FFMPEG_PID=$!

          # Monitoring loop with enhanced features
          while true; do
            # Check stop flag
            FLAG=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/$REPO_NAME/actions/variables/STOP_FLAG | jq -r .value)
            if [ "$FLAG" == "1" ]; then
              echo "🛑 Stop signal received, terminating..."
              kill -SIGINT $FFMPEG_PID
              wait $FFMPEG_PID 2>/dev/null
              kill -SIGINT $MEET_PID 2>/dev/null
              break
            fi

            # View flag with enhanced screenshot
            VIEW=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/$REPO_NAME/actions/variables/VIEW_FLAG | jq -r .value)
            if [ "$VIEW" == "1" ]; then
              echo "📸 Capturing screenshot..."
              scrot /tmp/live.png
              curl -s -F chat_id="$CHAT_ID" -F photo="@/tmp/live.png" -F caption="📸 **Live Class Status**\n⏰ $(date '+%H:%M:%S')" "https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto"
              curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/$REPO_NAME/actions/variables/VIEW_FLAG -d '{"name":"VIEW_FLAG","value":"0"}'
            fi

            # Full screen toggle
            FULL=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/$REPO_NAME/actions/variables/FULL_FLAG | jq -r .value)
            if [ "$FULL" == "1" ]; then
              echo "📺 Toggling full screen..."
              xdotool key f
              curl -s -d chat_id="$CHAT_ID" -d text="📺 **Display Update:** Full Screen Mode Activated!" "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"
              curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/$REPO_NAME/actions/variables/FULL_FLAG -d '{"name":"FULL_FLAG","value":"0"}'
            fi

            # Check if meet process died
            if ! kill -0 $MEET_PID 2>/dev/null; then
              echo "⚠️ Meeting process died, stopping recording..."
              kill -SIGINT $FFMPEG_PID
              wait $FFMPEG_PID 2>/dev/null
              break
            fi
            
            sleep 5
          done

      - name: 🚀 Smart Upload Handler
        if: always()
        env:
          BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          cat << 'EOF' > upload.py
          import os
          import time
          import requests
          from datetime import datetime
          
          bot_token = os.environ.get("BOT_TOKEN", "").strip()
          chat_id = os.environ.get("CHAT_ID", "").replace("'", "").replace('"', "").strip()
          date_str = datetime.now().strftime("%d-%b-%Y %H:%M")

          if os.path.exists("output.mp4"):
              size_mb = os.path.getsize("output.mp4") / (1024 * 1024)
              print(f"📊 File size: {size_mb:.2f} MB")
              
              if size_mb < 45:
                  cap = f"🎥 **Recording Complete**\n📅 {date_str}\n📊 Size: {size_mb:.1f} MB\n✅ Status: Ready"
                  with open("output.mp4", 'rb') as f:
                      response = requests.post(
                          f"https://api.telegram.org/bot{bot_token}/sendDocument",
                          data={'chat_id': chat_id, 'caption': cap, 'parse_mode': 'Markdown'},
                          files={'document': f},
                          timeout=120
                      )
                  print(f"✅ Upload complete: {response.status_code}")
              else:
                  print("📦 File large, splitting into parts...")
                  os.system('ffmpeg -i output.mp4 -c copy -map 0 -segment_time 1200 -f segment part_%03d.mp4')
                  parts = sorted([f for f in os.listdir() if f.startswith('part_') and f.endswith('.mp4')])
                  print(f"📦 Split into {len(parts)} parts")
                  
                  for i, part in enumerate(parts):
                      cap = f"🎥 **Recording Part {i+1}/{len(parts)}**\n📅 {date_str}"
                      with open(part, 'rb') as f:
                          requests.post(
                              f"https://api.telegram.org/bot{bot_token}/sendDocument",
                              data={'chat_id': chat_id, 'caption': cap, 'parse_mode': 'Markdown'},
                              files={'document': f},
                              timeout=120
                          )
                      time.sleep(3)
          else:
              print("⚠️ No output file found!")
          EOF
          
          python upload.py

      - name: 🧹 Cleanup & Self-Destruct
        if: always()
        env:
          GITHUB_TOKEN: ${{ secrets.PAT_TOKEN }}
          REPO: ${{ github.repository }}
          RUN_ID: ${{ github.run_id }}
        run: |
          echo "🧹 Cleaning up files..."
          rm -rf output.mp4 *.png part_*.mp4 /tmp/live.png upload.py recording.log
          echo "✅ Cleanup complete"
          
          # Self-destruct workflow
          curl -X DELETE \
            -s \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            https://api.github.com/repos/$REPO/actions/runs/$RUN_ID || true
