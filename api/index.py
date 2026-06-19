import os
import telebot
import requests
from flask import Flask
from threading import Thread

BOT_TOKEN = os.environ.get('BOT_TOKEN')
GITHUB_PAT = os.environ.get('GITHUB_PAT')
GITHUB_USER = os.environ.get('GITHUB_USER')
GITHUB_REPO = os.environ.get('GITHUB_REPO')
ALLOWED_GROUP_ID = os.environ.get('ALLOWED_GROUP_ID')

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

@app.route('/')
def keep_alive():
    return "hui-hui Bot is alive and running!", 200

def run_server():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

def is_authorized(message):
    return str(message.chat.id) == str(ALLOWED_GROUP_ID).strip()

@bot.message_handler(commands=['go'])
def trigger_github(message):
    if not is_authorized(message): return
        
    try:
        raw_input = message.text.split(" ", 1)[1].strip()
        headers = {"Accept": "application/vnd.github.v3+json", "Authorization": f"token {GITHUB_PAT}"}
        meet_link = raw_input if raw_input.startswith("http") else f"https://{raw_input}"

        bot.reply_to(message, "⏳ **[SYSTEM]** Starting Cloud Recording...")
        
        var_url = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/actions/variables/STOP_FLAG"
        requests.patch(var_url, headers=headers, json={"name": "STOP_FLAG", "value": "0"})

        url = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/actions/workflows/record.yml/dispatches"
        res = requests.post(url, headers=headers, json={"ref": "main", "inputs": {"meet_url": meet_link}})

        if res.status_code == 204:
            bot.reply_to(message, f"✅ **[DEPLOYED]** Recording started for:\n`{meet_link}`", parse_mode="Markdown")
        else:
            bot.reply_to(message, f"❌ **[ERROR]** Failed: `{res.text}`")
    except Exception as e:
        bot.reply_to(message, "⚠️ **Syntax Error.** Aise likh: `/go link`", parse_mode="Markdown")

@bot.message_handler(commands=['off'])
def stop_gracefully(message):
    if not is_authorized(message): return
        
    bot.reply_to(message, "🛑 **[SYSTEM]** Sending stop signal...")
    headers = {"Accept": "application/vnd.github.v3+json", "Authorization": f"token {GITHUB_PAT}"}
    var_url = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/actions/variables/STOP_FLAG"
    res = requests.patch(var_url, headers=headers, json={"name": "STOP_FLAG", "value": "1"})

    if res.status_code == 204:
        bot.reply_to(message, "🛑 **[ACCEPTED]** Recording stopping safely. Video process ho rahi hai...", parse_mode="Markdown")

if __name__ == "__main__":
    Thread(target=run_server).start()
    bot.infinity_polling()
