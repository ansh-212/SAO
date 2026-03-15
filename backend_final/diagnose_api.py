"""
Diagnostic script: Simulates exactly what the backend server does
when loading SkillSync via importlib and calling the Gemini API.
"""
import os
import sys
import traceback

print("=" * 60)
print("STEP 1: Environment Setup")
print("=" * 60)

# Simulate what backend_final/config.py does
from dotenv import load_dotenv
load_dotenv()  # Loads backend_final/.env

api_key = os.getenv("GEMINI_API_KEY")
print(f"  API Key from env: {api_key[:20] if api_key else 'NONE'}...")
print(f"  CWD: {os.getcwd()}")
print(f"  Python: {sys.executable}")

print("\n" + "=" * 60)
print("STEP 2: Test google.genai directly")
print("=" * 60)
try:
    from google import genai
    from google.genai import types
    print(f"  genai module: {genai.__file__ if hasattr(genai, '__file__') else 'OK'}")
    
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say hello",
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    print(f"  Direct Gemini call: SUCCESS - {response.text[:100]}")
except Exception as e:
    print(f"  Direct Gemini call: FAILED - {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("STEP 3: Load SkillSync via importlib (same as main.py)")
print("=" * 60)
SKILLSYNC_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skillsync-backend")
print(f"  SkillSync dir: {SKILLSYNC_BACKEND_DIR}")
print(f"  Exists: {os.path.isdir(SKILLSYNC_BACKEND_DIR)}")

if os.path.isdir(SKILLSYNC_BACKEND_DIR):
    sys.path.insert(0, SKILLSYNC_BACKEND_DIR)

import importlib.util
skillsync_main_path = os.path.join(SKILLSYNC_BACKEND_DIR, "main.py")
print(f"  SkillSync main.py: {skillsync_main_path}")
print(f"  File exists: {os.path.isfile(skillsync_main_path)}")

try:
    spec = importlib.util.spec_from_file_location("skillsync_main", skillsync_main_path)
    skillsync_mod = importlib.util.module_from_spec(spec)
    sys.modules["skillsync_main"] = skillsync_mod
    spec.loader.exec_module(skillsync_mod)
    print(f"  Module loaded: OK")
    print(f"  Routes: {[r.path for r in skillsync_mod.app.routes if hasattr(r, 'path')]}")
except Exception as e:
    print(f"  Module load FAILED: {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(1)

# Check env after SkillSync load_dotenv runs
api_key_after = os.getenv("GEMINI_API_KEY")
print(f"  API Key after module load: {api_key_after[:20] if api_key_after else 'NONE'}...")
print(f"  Keys match: {api_key == api_key_after}")

print("\n" + "=" * 60)
print("STEP 4: Test extract_text_from_url")
print("=" * 60)
try:
    text = skillsync_mod.extract_text_from_url("https://en.wikipedia.org/wiki/Binary_search_tree")
    print(f"  Extracted text: {len(text)} chars")
    print(f"  First 200 chars: {text[:200]}")
except Exception as e:
    print(f"  URL extraction FAILED: {type(e).__name__}: {e}")
    traceback.print_exc()
    text = "Binary search tree is a data structure that stores items in memory."

print("\n" + "=" * 60)
print("STEP 5: Test generate_batch_assessment")
print("=" * 60)
try:
    result = skillsync_mod.generate_batch_assessment(text, "Web URL: test")
    print(f"  Result keys: {list(result.keys())}")
    print(f"  is_fallback: {result.get('is_fallback', 'NOT PRESENT')}")
    print(f"  topic: {result.get('topic')}")
    print(f"  questions count: {len(result.get('questions', []))}")
    if result.get('is_fallback'):
        print("  >>> FALLBACK RESPONSE - AI CALL FAILED!")
    else:
        print("  >>> SUCCESS - AI GENERATED REAL RESPONSE!")
        for i, q in enumerate(result.get('questions', [])):
            print(f"    Q{i+1}: [{q.get('question_type')}] {q.get('title')}")
except Exception as e:
    print(f"  generate_batch_assessment FAILED: {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("DIAGNOSIS COMPLETE")
print("=" * 60)
