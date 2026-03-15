"""Minimal diagnostic: test generate_batch_assessment via importlib"""
import os, sys, traceback

# Setup like the backend does
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skillsync-backend"))
from dotenv import load_dotenv
load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print(f"KEY: {key[:20] if key else 'NONE'}")

# Load SkillSync module exactly like main.py does
import importlib.util
skillsync_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skillsync-backend", "main.py")
spec = importlib.util.spec_from_file_location("skillsync_main", skillsync_path)
mod = importlib.util.module_from_spec(spec)
sys.modules["skillsync_main"] = mod
spec.loader.exec_module(mod)

print("Module loaded. Testing generate_batch_assessment...")
print("=" * 50)

# This is the SAME call the server makes
result = mod.generate_batch_assessment("Binary search tree data structure", "test")

print("=" * 50)
print(f"is_fallback: {result.get('is_fallback', 'NOT PRESENT')}")
print(f"topic: {result.get('topic')}")
print(f"questions: {len(result.get('questions', []))}")

if result.get('is_fallback'):
    print("RESULT: FALLBACK - Gemini call failed!")
else:
    print("RESULT: SUCCESS - Gemini generated real questions!")
    for i, q in enumerate(result.get('questions', [])):
        print(f"  Q{i+1}: [{q.get('question_type')}] {q.get('title')}")
