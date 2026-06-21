import os
import time
import requests
import threading
import telebot
from flask import Flask
from datetime import datetime
import logging

# ==========================================
# ⚙️ LOGGING SETUP
# ==========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==========================================
# ⚙️ SECRETS & CONFIGURATION
# ==========================================
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") 
GITHUB_TOKEN = os.environ.get("PAT_TOKEN")
REPO_NAME = os.environ.get("GITHUB_REPO") 
WORKFLOW_NAME = "record.yml" 

# ⭐ IMPORTANT: Set your group ID here
ALLOWED_GROUP_ID = os.environ.get("ALLOWED_GROUP_ID", "")  # Example: -100123456789

if not all([BOT_TOKEN, GITHUB_TOKEN, REPO_NAME, ALLOWED_GROUP_ID]):
    logger.warning("⚠️ Missing Environment Variables!")

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# ==========================================
# 🔒 AUTHORIZATION CHECK
# ==========================================

def is_authorized(message):
    """Check if user is authorized to use the bot"""
    
    # BLOCK: Private chats
    if message.chat.type == 'private':
        bot.reply_to(message, "❌ This bot works ONLY in the authorized group.")
        return False
    
    # BLOCK: Wrong group
    if str(message.chat.id) != str(ALLOWED_GROUP_ID):
        bot.reply_to(message, "❌ This bot is not authorized in this group.")
        return False
    
    # CHECK: Is user admin?
    try:
        chat_admins = bot.get_chat_administrators(message.chat.id)
        admin_ids = [admin.user.id for admin in chat_admins]
        
        if message.from_user.id not in admin_ids:
            bot.reply_to(message, "⛔ **Access Denied!**\nOnly group admins can use this bot.", parse_mode="Markdown")
            return False
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        bot.reply_to(message, "⚠️ Error checking permissions. Please try again.")
        return False
    
    return True

# ==========================================
# 🛠️ HELPER FUNCTIONS
# ==========================================

def update_github_variable(var_name, value):
    """Update GitHub Action variable with retry logic"""
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/variables/{var_name}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            res = requests.patch(url, json={"name": var_name, "value": str(value)}, headers=headers, timeout=10)
            if res.status_code == 204:
                logger.info(f"✅ Variable {var_name} updated to {value}")
                return True
            else:
                logger.warning(f"Attempt {attempt+1} failed: {res.status_code}")
        except Exception as e:
            logger.error(f"Error updating {var_name}: {e}")
        time.sleep(2)
    return False

def is_workflow_running():
    """Advanced check with caching"""
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/workflows/{WORKFLOW_NAME}/runs?status=in_progress"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            total = data.get("total_count", 0)
            if total > 0:
                run = data.get("workflow_runs", [{}])[0]
                run_id = run.get("id", "unknown")
                started_at = run.get("created_at", "unknown")
                logger.info(f"Active run found: {run_id} started at {started_at}")
            return total > 0
    except Exception as e:
        logger.error(f"Error checking workflow status: {e}")
    return False

def get_workflow_status():
    """Get detailed workflow status"""
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/workflows/{WORKFLOW_NAME}/runs?status=in_progress"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            runs = data.get("workflow_runs", [])
            if runs:
                run = runs[0]
                return {
                    "id": run.get("id"),
                    "status": run.get("status"),
                    "created": run.get("created_at"),
                    "url": run.get("html_url")
                }
    except Exception as e:
        logger.error(f"Error getting status: {e}")
    return None

# ==========================================
# 🤖 TELEGRAM BOT COMMANDS
# ==========================================

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    # Allow everyone to see help (but still check)
    if message.chat.type == 'private':
        bot.reply_to(message, "❌ This bot works ONLY in the authorized group.\nPlease contact group admin.")
        return
    
    if str(message.chat.id) != str(ALLOWED_GROUP_ID):
        bot.reply_to(message, "❌ This bot is not authorized in this group.")
        return
    
    # Check if admin
    try:
        chat_admins = bot.get_chat_administrators(message.chat.id)
        admin_ids = [admin.user.id for admin in chat_admins]
        if message.from_user.id not in admin_ids:
            bot.reply_to(message, "⛔ **Access Denied!**\nOnly group admins can use this bot.", parse_mode="Markdown")
            return
    except Exception as e:
        bot.reply_to(message, "⚠️ Error checking permissions.")
        return
    
    user = message.from_user
    welcome_text = (
        "🛡️ **Secure Cloud Recorder**\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 Welcome, {user.first_name}!\n\n"
        "**📋 Available Commands:**\n"
        "🚀 `/go <meet_link>` - Start recording session\n"
        "🛑 `/off` - Stop recording instantly\n"
        "📸 `/vew` - Take live screenshot\n"
        "📺 `/full` - Toggle full screen mode\n"
        "📊 `/status` - Check recording status\n"
        "⚡ `/cancel` - Cancel current operation\n\n"
        "**📌 Example:**\n"
        "`/go https://meet.google.com/abc-xyz`"
    )
    bot.reply_to(message, welcome_text, parse_mode="Markdown")

@bot.message_handler(commands=['status'])
def check_status(message):
    if not is_authorized(message):
        return
    
    status_msg = "🔍 **System Status**\n━━━━━━━━━━━━━━━━━━━━━\n"
    
    if is_workflow_running():
        details = get_workflow_status()
        status_msg += "✅ **Recording in Progress**\n"
        if details:
            status_msg += f"🆔 Run ID: `{details['id']}`\n"
            status_msg += f"⏰ Started: `{details['created']}`\n"
    else:
        status_msg += "💤 **No Active Recording**\n"
        status_msg += "📌 System ready for new sessions."
    
    bot.reply_to(message, status_msg, parse_mode="Markdown")

@bot.message_handler(commands=['go'])
def start_recording(message):
    if not is_authorized(message):
        return
    
    try:
        parts = message.text.split()
        if len(parts) < 2:
            raise ValueError("No URL provided")
        meet_url = parts[1]
        
        # Validate URL
        if not meet_url.startswith(('http://', 'https://')):
            meet_url = 'https://' + meet_url
            
        # Basic URL validation
        if 'meet.google.com' not in meet_url and 'zoom.us' not in meet_url:
            bot.reply_to(message, "⚠️ **Invalid Meeting URL**\nPlease use Google Meet or Zoom links.", parse_mode="Markdown")
            return
            
    except Exception as e:
        bot.reply_to(
            message, 
            "⚠️ **Invalid Format.**\nPlease use:\n`/go https://meet.google.com/xyz`\n`/go https://zoom.us/j/123456789`",
            parse_mode="Markdown"
        )
        return

    # 🔥 SMART CHECK: Prevent double recording
    if is_workflow_running():
        details = get_workflow_status()
        status_msg = (
            "⚠️ **Recording Session Active!**\n━━━━━━━━━━━━━━━━━━━━━\n"
            "A recording is currently in progress.\n\n"
            "**Options:**\n"
            "🔄 Use `/off` to stop current recording\n"
            "📊 Use `/status` for more details\n"
            "⏳ Please wait for completion"
        )
        if details:
            status_msg += f"\n\n🆔 Run ID: `{details['id']}`"
        
        bot.reply_to(message, status_msg, parse_mode="Markdown")
        return

    # Start new recording
    progress_msg = bot.reply_to(
        message, 
        f"⏳ **Initializing Recording**\n━━━━━━━━━━━━━━━━━━━━━\n"
        f"📡 Target URL: `{meet_url}`\n"
        f"⚙️ Allocating cloud resources...\n"
        f"⏱️ Please wait 30-60 seconds.",
        parse_mode="Markdown"
    )
    
    # Reset all flags
    update_github_variable("STOP_FLAG", "0")
    update_github_variable("VIEW_FLAG", "0")
    update_github_variable("FULL_FLAG", "0")

    # Trigger workflow
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/workflows/{WORKFLOW_NAME}/dispatches"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    data = {
        "ref": "main",
        "inputs": {"meet_url": meet_url}
    }
    
    try:
        res = requests.post(url, json=data, headers=headers, timeout=30)
        
        if res.status_code == 204:
            bot.edit_message_text(
                f"✅ **Recording Started Successfully**\n━━━━━━━━━━━━━━━━━━━━━\n"
                f"📡 URL: `{meet_url}`\n"
                f"🟢 Status: Active\n"
                f"⏱️ Session will auto-end after 5 hours\n\n"
                f"**📋 Controls:**\n"
                f"🛑 `/off` - Stop recording\n"
                f"📸 `/vew` - Take screenshot\n"
                f"📺 `/full` - Full screen mode",
                chat_id=message.chat.id,
                message_id=progress_msg.message_id,
                parse_mode="Markdown"
            )
        else:
            bot.edit_message_text(
                f"❌ **System Error**\n━━━━━━━━━━━━━━━━━━━━━\n"
                f"Failed to start cloud server.\n"
                f"Error Code: {res.status_code}\n"
                f"Details: {res.text[:100]}",
                chat_id=message.chat.id,
                message_id=progress_msg.message_id,
                parse_mode="Markdown"
            )
    except Exception as e:
        logger.error(f"Error starting recording: {e}")
        bot.edit_message_text(
            f"❌ **Connection Error**\n━━━━━━━━━━━━━━━━━━━━━\n"
            f"Unable to connect to cloud services.\n"
            f"Please try again later.",
            chat_id=message.chat.id,
            message_id=progress_msg.message_id,
            parse_mode="Markdown"
        )

@bot.message_handler(commands=['off'])
def stop_recording(message):
    if not is_authorized(message):
        return
    
    if not is_workflow_running():
        bot.reply_to(
            message,
            "💤 **No Active Recording**\n━━━━━━━━━━━━━━━━━━━━━\n"
            "There is no recording session running currently.",
            parse_mode="Markdown"
        )
        return
    
    progress_msg = bot.reply_to(
        message,
        "🛑 **Terminating Recording**\n━━━━━━━━━━━━━━━━━━━━━\n"
        "⏳ Stopping session and finalizing video...\n"
        "⏱️ This may take 2-3 minutes.",
        parse_mode="Markdown"
    )
    
    update_github_variable("STOP_FLAG", "1")
    
    time.sleep(5)
    bot.edit_message_text(
        "✅ **Recording Stopped**\n━━━━━━━━━━━━━━━━━━━━━\n"
        "🔄 Video is being processed and uploaded.\n"
        "📥 You will receive the file shortly.",
        chat_id=message.chat.id,
        message_id=progress_msg.message_id,
        parse_mode="Markdown"
    )

@bot.message_handler(commands=['vew'])
def live_view(message):
    if not is_authorized(message):
        return
        
    if not is_workflow_running():
        bot.reply_to(
            message,
            "💤 **No Active Recording**\nCannot capture screenshot without active session.",
            parse_mode="Markdown"
        )
        return
        
    bot.reply_to(
        message,
        "📸 **Capturing Live View**\n━━━━━━━━━━━━━━━━━━━━━\n"
        "⏳ Taking screenshot...\n"
        "📤 You will receive it in 5-10 seconds.",
        parse_mode="Markdown"
    )
    update_github_variable("VIEW_FLAG", "1")

@bot.message_handler(commands=['full'])
def full_screen(message):
    if not is_authorized(message):
        return
        
    if not is_workflow_running():
        bot.reply_to(
            message,
            "💤 **No Active Recording**\nCannot change display mode without active session.",
            parse_mode="Markdown"
        )
        return
        
    bot.reply_to(
        message,
        "📺 **Display Mode Toggled**\n━━━━━━━━━━━━━━━━━━━━━\n"
        "✅ Full screen mode activated.",
        parse_mode="Markdown"
    )
    update_github_variable("FULL_FLAG", "1")

@bot.message_handler(commands=['cancel'])
def cancel_operation(message):
    if not is_authorized(message):
        return
        
    if is_workflow_running():
        bot.reply_to(
            message,
            "⚡ **Emergency Cancel**\n━━━━━━━━━━━━━━━━━━━━━\n"
            "🛑 Terminating all operations...\n"
            "⏳ Please wait for cleanup.",
            parse_mode="Markdown"
        )
        update_github_variable("STOP_FLAG", "1")
    else:
        bot.reply_to(
            message,
            "💤 **No Operation Running**\nNothing to cancel.",
            parse_mode="Markdown"
        )

# ==========================================
# 🌐 FLASK WEB SERVER
# ==========================================

@app.route('/')
def index():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cloud Recorder Status</title>
        <style>
            body { font-family: Arial; background: #0a0a0a; color: #fff; text-align: center; padding: 50px; }
            .status { background: #1a1a1a; padding: 30px; border-radius: 10px; max-width: 500px; margin: auto; }
            .online { color: #00ff88; font-size: 24px; }
            .detail { color: #888; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="status">
            <h1>✅ Cloud Engine Online</h1>
            <div class="online">🟢 System Active</div>
            <div class="detail">Recording Bot Ready</div>
            <div class="detail">📡 Monitor: /status</div>
            <div class="detail">🔒 Only authorized group</div>
        </div>
    </body>
    </html>
    """

@app.route('/health')
def health_check():
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "recording": is_workflow_running(),
        "authorized_group": ALLOWED_GROUP_ID
    }

# ==========================================
# 🚀 BOT RUNNER
# ==========================================

def run_bot():
    while True:
        try:
            logger.info("🤖 Bot started polling...")
            bot.polling(none_stop=True, timeout=60, interval=5)
        except Exception as e:
            logger.error(f"Bot polling error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    logger.info("🚀 Starting Cloud Recorder Bot...")
    logger.info(f"🔒 Authorized Group ID: {ALLOWED_GROUP_ID}")
    
    threading.Thread(target=run_bot, daemon=True).start()
    
    port = int(os.environ.get("PORT", 10000))
    logger.info(f"🌐 Web server running on port {port}")
    app.run(host="0.0.0.0", port=port)
