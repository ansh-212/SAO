"""
InterviewVault QA - Phase 1: Complete Backend Validation Suite
Outputs to qa_output.txt for clean reading
"""
import sys, os, json, time, traceback, io

# Setup paths
BACKEND_DIR = r"c:\Users\Lenovo\IdeaProjects\AISSMS\backend_final"
SKILLSYNC_DIR = r"c:\Users\Lenovo\IdeaProjects\AISSMS\skillsync-backend"
OUTPUT_FILE = r"c:\Users\Lenovo\IdeaProjects\AISSMS\qa_output.txt"
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, SKILLSYNC_DIR)
os.chdir(BACKEND_DIR)
os.environ["GEMINI_API_KEY"] = "AIzaSyAjRxYPt97PMjaIhNst-ScGQk8IFCFSqWU"

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
os.environ["GEMINI_API_KEY"] = "AIzaSyAjRxYPt97PMjaIhNst-ScGQk8IFCFSqWU"

# Tee output to both console and file
out_lines = []

def log(msg=""):
    try:
        print(msg)
    except Exception:
        pass
    out_lines.append(msg)

def save_output():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))

results = {}

def section(title):
    log(f"\n{'='*60}")
    log(f"  {title}")
    log(f"{'='*60}")

def pass_test(name, details=""):
    results[name] = "PASS"
    log(f"  [PASS] {name}{(' -- ' + details) if details else ''}")

def fail_test(name, details=""):
    results[name] = "FAIL"
    log(f"  [FAIL] {name}{(' -- ' + details) if details else ''}")

# ========== 1.2 GEMINI API KEY AUTHENTICATION ==========
section("1.2 GEMINI API KEY AUTHENTICATION")
API_KEY = os.environ["GEMINI_API_KEY"]
try:
    from google import genai
    client = genai.Client(api_key=API_KEY)
    models_list = list(client.models.list())
    gemini_models = [m for m in models_list if "gemini" in m.name.lower()]
    pass_test("Key Active", f"{len(models_list)} models, {len(gemini_models)} Gemini")
    for m in gemini_models[:5]:
        log(f"    . {m.name}")
    resp = client.models.generate_content(model="gemini-2.5-flash", contents="Say PONG")
    pong = resp.text.strip()
    pass_test("Ping", f"Response: '{pong[:40]}'")
except Exception as e:
    fail_test("Auth", str(e))
    traceback.print_exc()

# ========== 1.3 STANDARD QUESTION GENERATION ==========
section("1.3 STANDARD QUESTION GENERATION")
sample_text = """Newton's Law of Universal Gravitation states that every particle attracts every other 
particle in the universe with a force proportional to the product of their masses 
and inversely proportional to the square of the distance between their centers. 
The gravitational constant G = 6.674 x 10^-11. Kepler's Third Law: T^2 proportional to a^3.
Gravitational potential energy U = -GMm/r. Escape velocity v_e = sqrt(2GM/R).
Satellite orbital mechanics requires balancing gravitational and centripetal force."""

questions = None
try:
    import config
    config.settings.GEMINI_API_KEY = API_KEY
    from services.ai_service import generate_questions_from_text

    log("  Generating questions from physics sample text...")
    t0 = time.time()
    questions = generate_questions_from_text(
        sample_text, language="en", num_questions=5, difficulty="intermediate",
        pdf_filename="newton_gravitation.pdf",
        key_terms=["gravitational constant", "Kepler", "orbital", "escape velocity"]
    )
    elapsed = time.time() - t0
    log(f"  Time: {elapsed:.1f}s")

    if not questions or not isinstance(questions, list):
        fail_test("Question Generation", "Empty or non-list response")
    elif len(questions) < 3:
        fail_test("Question Generation", f"Only {len(questions)} questions")
    else:
        pass_test("Question Count", f"{len(questions)} questions generated")
        required_keys = {"text", "type", "bloom_level", "max_score"}
        all_valid = True
        for i, q in enumerate(questions):
            missing = required_keys - set(q.keys())
            if missing:
                fail_test(f"Q{i+1} Structure", f"Missing keys: {missing}")
                all_valid = False
            else:
                log(f"    Q{i+1}: [{q.get('type','?')}/{q.get('bloom_level','?')}] {str(q.get('text',''))[:70]}...")
        if all_valid:
            pass_test("Question Structure", "All have required keys")
        has_rubric = all("rubric" in q for q in questions)
        if has_rubric:
            rk = {"depth", "accuracy", "application", "originality"}
            rv = all(rk.issubset(set(q["rubric"].keys())) for q in questions if isinstance(q.get("rubric"), dict))
            if rv: pass_test("Rubric Structure", "All rubrics valid")
            else: fail_test("Rubric Structure", "Missing sub-keys")
        else:
            fail_test("Rubric Presence", "Some questions lack rubric")
except Exception as e:
    fail_test("Question Generation", str(e))
    traceback.print_exc()

# ========== 1.4 DYNAMIC FOLLOW-UP ==========
section("1.4 DYNAMIC FOLLOW-UP TESTING")
try:
    from services.ai_service import generate_followup_question
    original_q = questions[0]["text"] if questions else "Explain Newton's Law of Gravitation."
    mock_answer = "Gravity pulls things together. The bigger the mass, the stronger. I think the formula has G in it."
    log(f"  Original Q: {str(original_q)[:70]}...")
    log("  Generating follow-up...")
    t0 = time.time()
    followup = generate_followup_question(original_question=original_q, student_answer=mock_answer, pdf_context=sample_text, language="en")
    elapsed = time.time() - t0
    log(f"  Time: {elapsed:.1f}s")
    if not followup:
        fail_test("Follow-up Generation", "Returned None")
    else:
        required = {"text", "type", "probe_reason"}
        missing = required - set(followup.keys())
        if missing:
            fail_test("Follow-up Structure", f"Missing keys: {missing}")
        else:
            pass_test("Follow-up Generated", f"Reason: {str(followup.get('probe_reason','?'))[:50]}")
            log(f"    Follow-up: {str(followup.get('text',''))[:90]}...")
        if followup.get("bloom_level"):
            pass_test("Follow-up Bloom Level", followup["bloom_level"])
        if followup.get("id") == "followup":
            pass_test("Follow-up ID", "Set correctly")
except Exception as e:
    fail_test("Follow-up Test", str(e))
    traceback.print_exc()

# ========== 1.5 CODING CHALLENGE GENERATION ==========
section("1.5 CODING CHALLENGE GENERATION (4 TYPES)")
try:
    import importlib.util as ilu
    skillsync_path = os.path.join(SKILLSYNC_DIR, "main.py")
    spec = ilu.spec_from_file_location("skillsync_main", skillsync_path)
    mod = ilu.module_from_spec(spec)
    sys.modules["skillsync_main"] = mod
    spec.loader.exec_module(mod)

    log("  Generating batch assessment...")
    t0 = time.time()
    batch = mod.generate_batch_assessment("Binary search tree data structure", "test")
    elapsed = time.time() - t0
    log(f"  Time: {elapsed:.1f}s")

    is_fb = batch.get("is_fallback", False)
    if is_fb:
        fail_test("Batch Generation", "FALLBACK returned")
    else:
        pass_test("Batch Generation", f"Topic: {batch.get('topic','?')}")

    bq = batch.get("questions", [])
    if len(bq) == 4:
        pass_test("Question Count", "Exactly 4")
    else:
        fail_test("Question Count", f"Got {len(bq)}")

    expected_types = {"scratch", "logic_bug", "syntax_error", "optimization"}
    actual_types = {q.get("question_type") for q in bq}
    if expected_types == actual_types:
        pass_test("Distinct Types", "All 4 present")
    else:
        fail_test("Distinct Types", f"Missing: {expected_types - actual_types}")

    rqk = {"title", "description", "user_code", "sample_tests", "comprehensive_tests"}
    for i, q in enumerate(bq):
        qt = q.get("question_type", "?")
        missing = rqk - set(q.keys())
        if missing:
            fail_test(f"Q{i+1} [{qt}] Structure", f"Missing: {missing}")
        else:
            pass_test(f"Q{i+1} [{qt}] Structure", f"'{str(q.get('title',''))[:50]}'")
        code = q.get("user_code", "")
        if code.strip():
            try:
                compile(code, f"<q{i+1}>", "exec")
                pass_test(f"Q{i+1} [{qt}] Code Syntax", "Compiles OK")
            except SyntaxError as se:
                fail_test(f"Q{i+1} [{qt}] Code Syntax", f"Line {se.lineno}: {se.msg}")
except Exception as e:
    fail_test("Coding Challenges", str(e))
    traceback.print_exc()

# ========== 1.6 EVALUATION ENGINE STRESS TEST ==========
section("1.6 EVALUATION ENGINE STRESS TEST")
try:
    from services.ai_service import evaluate_submission as eval_sub

    test_q = questions[:3] if questions and len(questions) >= 3 else [
        {"id": 1, "text": "Explain gravitational force", "type": "open_ended", "bloom_level": "analyze", "max_score": 10, "rubric": {"depth":"","accuracy":"","application":"","originality":""}},
        {"id": 2, "text": "Derive escape velocity", "type": "open_ended", "bloom_level": "apply", "max_score": 10, "rubric": {"depth":"","accuracy":"","application":"","originality":""}},
        {"id": 3, "text": "Compare Kepler's laws", "type": "open_ended", "bloom_level": "evaluate", "max_score": 10, "rubric": {"depth":"","accuracy":"","application":"","originality":""}},
    ]

    optimal = {
        "0": "Newton's Law F = GMm/r^2 with G = 6.674e-11. In my physics lab we measured g=9.78 using a pendulum. Gravitational potential energy U=-GMm/r shows work against gravity. Earth-Moon orbits because gravity provides centripetal acceleration.",
        "1": "Equating KE=0.5mv^2 to PE=GMm/r gives v_e=sqrt(2GM/R). For Earth M=5.97e24 R=6.37e6 so v_e=11.2 km/s. Independent of escaping mass. I calculated Mars escape velocity as 5 km/s in our project.",
        "2": "Kepler's 1st Law: elliptical orbits overturned circular assumptions. 3rd Law T^2 proportional a^3. I plotted this for all planets and saw perfect linearity. Kepler is descriptive; Newton provides the causal explanation."
    }
    suboptimal = {
        "0": "Gravity makes things fall. Heavy things have more gravity. There's some constant.",
        "1": "Escape velocity means going fast enough. Depends on mass. About 11 km/s I think.",
        "2": "Kepler had 3 laws. One about ellipses. Related to Newton."
    }
    incorrect = {
        "0": "Gravitational force increases with distance. No gravity in space. Moon has no pull.",
        "1": "Escape velocity = speed of light. v_e = mc^2. Heavy objects escape faster.",
        "2": "Kepler proved circular orbits. Closer planets are slower. Newton disagreed."
    }

    results_eval = {}
    for label, answers in [("Optimal", optimal), ("Sub-optimal", suboptimal), ("Incorrect", incorrect)]:
        log(f"\n  Evaluating {label} answers...")
        t0 = time.time()
        scores, feedback, total = eval_sub(test_q, answers, pdf_text=sample_text, language="en")
        elapsed = time.time() - t0
        results_eval[label] = {"total": total, "time": elapsed}
        log(f"  Time: {elapsed:.1f}s | Total Score: {total}%")
        
        if isinstance(scores, dict) and isinstance(feedback, dict):
            pass_test(f"{label} Structure", f"Score: {total}%")
        else:
            fail_test(f"{label} Structure", "Invalid types")

        empty_fb = [k for k, v in feedback.items() if not v or len(str(v).strip()) < 5]
        if empty_fb:
            fail_test(f"{label} Feedback", f"Empty for: {empty_fb}")
        else:
            pass_test(f"{label} Feedback", "All non-empty")

    ot = results_eval.get("Optimal", {}).get("total", 0)
    st = results_eval.get("Sub-optimal", {}).get("total", 0)
    it = results_eval.get("Incorrect", {}).get("total", 0)
    log(f"\n  Scores: Optimal={ot}% | Sub-optimal={st}% | Incorrect={it}%")
    
    if ot > st > it:
        pass_test("Score Ordering", f"{ot}% > {st}% > {it}%")
    elif ot > it:
        pass_test("Score Ordering (partial)", f"Opt({ot}%) > Inc({it}%), Sub={st}%")
    else:
        fail_test("Score Ordering", f"{ot} / {st} / {it}")
except Exception as e:
    fail_test("Evaluation Stress", str(e))
    traceback.print_exc()

# ========== FINAL SUMMARY ==========
section("FINAL RESULTS SUMMARY")
passed = sum(1 for v in results.values() if v == "PASS")
failed = sum(1 for v in results.values() if v == "FAIL")
total_tests = passed + failed
log(f"\n  Total: {total_tests} | PASSED: {passed} | FAILED: {failed}")
if total_tests > 0:
    log(f"  Pass Rate: {passed/total_tests*100:.0f}%")
if failed > 0:
    log("\n  Failed tests:")
    for name, status in results.items():
        if status == "FAIL":
            log(f"    X {name}")
log(f"\n{'='*60}")
log(f"  PHASE 1 {'PASSED' if failed == 0 else 'COMPLETED WITH ISSUES'}")
log(f"{'='*60}")

save_output()
log(f"\nResults saved to: {OUTPUT_FILE}")
