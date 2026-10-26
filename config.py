"""
config.py
step 3 This module contains configuration settings for the application/chatbot.
"""

import os

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs):
        return False

# Read the hidden .env file and load environment variables
load_dotenv()

# 1. Gemini settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

# 2. Chatbot personality (this is called a "system prompt" in the Gemini API)
SYSTEM_PROMPT = (
    "You are a friendly AI assistant for students. "
    "Answer clearly in simple English. "
    "Use short sentences and small examples with helpful. "
)

# 3. Where we save our files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR,"data")
LOG_FILE = os.path.join(DATA_DIR,"chat_history.csv")
CHARTS_DIR = os.path.join(BASE_DIR,"charts")