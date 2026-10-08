from dotenv import load_dotenv
import os
load_dotenv(override=True)

SERVER_URL = os.getenv("SERVER_URL", "0.0.0.0")
PORT = os.getenv("PORT", "8900")
ENV = os.getenv("ENV", "dev")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")