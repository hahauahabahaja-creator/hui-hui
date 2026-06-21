import time
import os
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

# ============================================
# CONFIGURATION
# ============================================
MEET_URL = os.environ.get("MEET_URL", "")
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
CHAT_ID = os.environ.get("CHAT_ID", "")

# ============================================
# LOGGING FUNCTION
# ============================================
def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

# ============================================
# TELEGRAM NOTIFICATION
# ============================================
def send_telegram(message, photo_path=None):
    if not BOT_TOKEN or not CHAT_ID:
        return
    
    try:
        if photo_path and os.path.exists(photo_path):
            with open(photo_path, 'rb') as f:
                requests.post(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto",
                    data={'chat_id': CHAT_ID, 'caption': message},
                    files={'photo': f},
                    timeout=30
                )
        else:
            requests.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                data={'chat_id': CHAT_ID, 'text': message},
                timeout=30
            )
        log("✅ Telegram notification sent")
    except Exception as e:
        log(f"⚠️ Failed to send Telegram: {e}")

# ============================================
# MAIN BOT FUNCTION
# ============================================
def run_meet_bot():
    log("🚀 Starting Meet Bot...")
    
    if not MEET_URL:
        log("❌ MEET_URL not set!")
        return
    
    send_telegram("🚀 **Bot Starting**\n📡 Target: " + MEET_URL)
    
    with sync_playwright() as p:
        # Chrome Profile Setup
        user_data_dir = "./chrome_profile"
        
        if not os.path.exists(user_data_dir):
            os.makedirs(user_data_dir)
            log("📁 Created new Chrome profile")
        
        log("🔐 Using persistent Chrome profile...")
        
        # Launch Browser
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
                "--mute-audio",
                "--window-size=1366,768",
                "--start-maximized"
            ]
        )
        
        page = context.new_page()
        
        # Navigate to Google First
        log("🌐 Going to Google...")
        page.goto('https://accounts.google.com', wait_until='networkidle')
        time.sleep(3)
        
        # Check if logged in
        is_logged_in = page.evaluate("""
            () => {
                return document.querySelector('a[href*="accounts.google.com"]') !== null;
            }
        """)
        
        if is_logged_in:
            log("✅ Already logged in!")
        else:
            log("⚠️ Manual login required! Please login in the browser window.")
            send_telegram("⚠️ **Manual Login Required!**\nPlease login to Google in the browser window.\nYou have 60 seconds.")
            time.sleep(60)
        
        # Navigate to Meet
        log(f"📡 Navigating to: {MEET_URL}")
        page.goto(MEET_URL, wait_until='networkidle')
        time.sleep(5)
        
        # Handle Popups
        log("🔄 Handling popups...")
        try:
            page.evaluate("""
                () => {
                    document.querySelectorAll('button').forEach(btn => {
                        const text = btn.innerText || '';
                        if (text.includes('Got it') || text.includes('Dismiss') || 
                            text.includes('Skip') || text.includes('Not now')) {
                            btn.click();
                        }
                    });
                }
            """)
        except Exception as e:
            log(f"⚠️ Popup error: {e}")
        
        # Turn Off Camera & Mic
        log("🔇 Turning off Camera and Microphone...")
        try:
            page.keyboard.press("Control+d")
            time.sleep(0.5)
            page.keyboard.press("Control+e")
            time.sleep(1)
        except Exception as e:
            log(f"⚠️ Media error: {e}")
        
        # Enter Name
        try:
            name_input = page.query_selector('input[type="text"]')
            if name_input:
                random_name = "Student " + str(time.time()).split('.')[0][-4:]
                name_input.fill(random_name)
                log(f"✅ Name entered: {random_name}")
        except Exception as e:
            log(f"⚠️ Name error: {e}")
        
        # Click Join Button
        log("👋 Joining meeting...")
        
        join_selectors = [
            "text=Join now",
            "text=Ask to join",
            "[aria-label='Join now']",
            "button:has-text('Join')",
            "button:has-text('Continue')"
        ]
        
        joined = False
        for selector in join_selectors:
            try:
                if page.is_visible(selector):
                    page.click(selector)
                    log(f"✅ Joined using: {selector}")
                    joined = True
                    break
            except:
                continue
        
        if not joined:
            log("⚠️ Trying JavaScript click...")
            try:
                page.evaluate("""
                    () => {
                        document.querySelectorAll('button').forEach(btn => {
                            const text = btn.innerText || '';
                            if (text.includes('Join') || text.includes('Continue')) {
                                btn.click();
                            }
                        });
                    }
                """)
                joined = True
            except:
                pass
        
        if not joined:
            log("❌ Could not join meeting!")
            send_telegram("❌ **Failed to join meeting!**")
            context.close()
            return
        
        # Wait & Take Screenshot
        log("⏳ Waiting for join confirmation...")
        time.sleep(10)
        
        page.screenshot(path="joined.png")
        log("📸 Screenshot saved")
        
        send_telegram(
            "✅ **Joined Meeting!**\n"
            f"📡 {MEET_URL}\n"
            f"⏰ {datetime.now().strftime('%H:%M:%S')}",
            "joined.png"
        )
        
        log("🎥 Bot is in meeting! Recording in progress...")
        
        # Keep Alive
        try:
            while True:
                time.sleep(10)
        except KeyboardInterrupt:
            log("🛑 Bot stopped")
        finally:
            context.close()
            log("✅ Bot finished")

# ============================================
# ENTRY POINT
# ============================================
if __name__ == "__main__":
    run_meet_bot()
