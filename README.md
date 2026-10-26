# AI Chatbot Web App

A Flask + HTML/CSS/JS front end for a Gemini-powered chatbot, with chat history
(pandas), statistics (NumPy) and charts (Matplotlib + Seaborn).

## Setup

1. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   ```
2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
3. **Add your Gemini API key** (free key: https://aistudio.google.com/apikey)
   Copy `.env.example` to `.env` and edit it:
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-flash-latest
   ```
4. **Run**
   ```bash
   python app.py
   ```
5. Open **http://127.0.0.1:5000**

(The original terminal version still works: `python chatbot.py`.)

## Features
- **Chat**: typing indicator and formatted answers
- **New chat**: clears Gemini's memory of the conversation
- **Insights**: stat cards and 3 generated charts
- **History**: last 50 saved chats
- **Models**: list models your key can use
- Light/dark theme, mobile-friendly layout

## Notes
- Chats are stored in `data/chat_history.csv`; charts in `charts/`.
- Single-user local app: all browser tabs share one conversation.
- Never commit `.env` (it is listed in `.gitignore`).

## Troubleshooting
| Problem | Fix |
|---|---|
| "GEMINI_API_KEY not found" | Create `.env` (with the leading dot) containing your key |
| `KeyError: question_words` | Delete the old `data/chat_history.csv` and chat again |
| Gemini API error 429 | Free-tier rate limit; wait a minute |
| Gemini API error 404 (model) | Click **Models** and set `GEMINI_MODEL` in `.env` to one listed |
