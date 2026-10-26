"""
app.py - Flask web server for the Gemini chatbot.
Reuses config, gemini_client, chat_logger and analytics unchanged.
"""

import os
import threading
import time

import numpy as np
from flask import Flask, jsonify, render_template, request, send_from_directory
from google.genai import errors

import analytics
import chat_logger
import config
from gemini_client import GeminiChatbot

app = Flask(__name__)

# One shared conversation (single-user, local app).
# Locks keep simultaneous requests from corrupting state:
# the Gemini chat session and matplotlib are not thread-safe.
_bot = None
_bot_lock = threading.Lock()
_chart_lock = threading.Lock()

CHART_FILES = [
    ("Response time distribution", "1_response_time.png"),
    ("Question length vs answer length", "2_question_vs_answer.png"),
    ("Response time per chat", "3_time_per_chat.png"),
]


def get_bot():
    """Create the Gemini bot on first use (raises ValueError if no API key)."""
    global _bot
    if _bot is None:
        _bot = GeminiChatbot()
    return _bot


# ---------- Pages ----------
@app.get("/")
def index():
    return render_template("index.html", model=config.MODEL_NAME)


# ---------- Chat ----------
@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    question = str(data.get("message", "")).strip()
    if not question:
        return jsonify(error="Message is empty."), 400

    try:
        with _bot_lock:
            answer, seconds = get_bot().ask(question)
    except ValueError as err:                      # missing API key
        return jsonify(error=str(err)), 503
    except errors.APIError as err:                 # Gemini-side problem
        return jsonify(error=f"Gemini API error ({err.code}): {err.message}"), 502
    except Exception as err:                       # anything else
        return jsonify(error=f"Unexpected error: {err}"), 500

    chat_logger.save_chat(question, answer, seconds)
    return jsonify(answer=answer, seconds=seconds)


@app.post("/api/reset")
def reset():
    try:
        with _bot_lock:
            get_bot().reset()
    except ValueError as err:
        return jsonify(error=str(err)), 503
    return jsonify(ok=True)


@app.get("/api/models")
def models():
    try:
        with _bot_lock:
            return jsonify(models=get_bot().list_models())
    except ValueError as err:
        return jsonify(error=str(err)), 503
    except Exception as err:
        return jsonify(error=f"Could not list models: {err}"), 500


# ---------- Data / analytics ----------
@app.get("/api/history")
def history():
    df = chat_logger.load_history()
    if df.empty:
        return jsonify(history=[])
    cols = ["chat_no", "timestamp", "question", "answer", "response_time_sec"]
    rows = df[cols].fillna("").tail(50).iloc[::-1]  # newest first
    return jsonify(history=rows.to_dict("records"))


@app.get("/api/stats")
def stats():
    """Same numbers as analytics.show_summary, returned as JSON."""
    df = chat_logger.load_history()
    if df.empty:
        return jsonify(total=0)

    times = df["response_time_sec"].to_numpy(dtype=float)
    q_words = df["question_words"].to_numpy(dtype=float)
    a_words = df["answer_words"].to_numpy(dtype=float)

    prediction = None
    if len(df) >= 3 and np.std(q_words) > 0:
        slope, intercept = np.polyfit(q_words, a_words, 1)
        prediction = max(float(slope * 10 + intercept), 0.0)

    return jsonify(
        total=int(len(df)),
        avg_time=float(np.mean(times)),
        median_time=float(np.median(times)),
        max_time=float(np.max(times)),
        avg_words=float(np.mean(a_words)),
        prediction=prediction,
    )


@app.post("/api/charts")
def charts():
    df = chat_logger.load_history()
    if len(df) < 2:
        return jsonify(error="Ask at least 2 questions before creating charts."), 400

    with _chart_lock:
        analytics.create_charts(df)

    stamp = int(time.time())  # cache-buster so new images show up
    return jsonify(charts=[
        {"title": title, "url": f"/charts/{name}?v={stamp}"}
        for title, name in CHART_FILES
    ])


@app.get("/charts/<path:filename>")
def serve_chart(filename):
    return send_from_directory(config.CHARTS_DIR, filename)


if __name__ == "__main__":
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(config.CHARTS_DIR, exist_ok=True)
    # use_reloader=False avoids creating the Gemini client twice in debug mode
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
