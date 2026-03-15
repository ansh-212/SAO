import requests, json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Test 1: Coding Skills - analyze-url endpoint
print('=== Test 1: Coding Skills analyze-url ===')
try:
    r = requests.post('http://localhost:8000/api/coding/analyze-url', 
        json={'url': 'https://www.geeksforgeeks.org/dsa/bln'},
        timeout=180)
    print('Status:', r.status_code)
    data = r.json()
    is_fallback = data.get('is_fallback', False)
    print('Is Fallback:', is_fallback)
    if 'questions' in data:
        qs = data['questions']
        print('Questions:', len(qs))
        for i, q in enumerate(qs):
            print(f'  Q{i+1} [{q.get("question_type","?")}]: {q.get("title","?")}')
    elif 'category' in data:
        print('Category:', data.get('category'))
        print('Summary:', str(data.get('summary',''))[:100])
    else:
        print('Response keys:', list(data.keys()))
        print('Response (first 300):', json.dumps(data)[:300])
except Exception as e:
    print('Error:', e)

# Test 2: PDF upload endpoint
print()
print('=== Test 2: PDF Upload for Assessment ===')
pdf_id = None
try:
    pdf_path = r'c:\Users\Lenovo\IdeaProjects\AISSMS\backend_final\uploads\3b80d14a-1822-4f5a-951a-d8e1fd0754d6_Ch5-Gravitation.pdf'
    with open(pdf_path, 'rb') as f:
        r2 = requests.post('http://localhost:8000/api/pdf/upload',
            files={'file': ('Ch5-Gravitation.pdf', f, 'application/pdf')},
            timeout=60)
    print('Status:', r2.status_code)
    data2 = r2.json()
    print('Response keys:', list(data2.keys()))
    if 'extracted_text' in data2:
        print('Extracted text length:', len(data2['extracted_text']), 'chars')
    if 'key_terms' in data2:
        kts = data2['key_terms']
        print('Key terms:', kts[:5] if isinstance(kts, list) else str(kts)[:100])
    pdf_id = data2.get('pdf_id', '')
    print('PDF ID:', pdf_id)
except Exception as e:
    print('Error:', e)

# Test 3: Generate assessment from PDF
print()
print('=== Test 3: Generate Assessment from PDF ===')
if pdf_id:
    try:
        r3 = requests.post('http://localhost:8000/api/pdf/generate-assessment',
            json={'pdf_id': pdf_id, 'language': 'en', 'num_questions': 5, 'difficulty': 'intermediate'},
            timeout=120)
        print('Status:', r3.status_code)
        data3 = r3.json()
        if isinstance(data3, list):
            print('Generated', len(data3), 'questions')
            for i, q in enumerate(data3[:3]):
                print(f'  Q{i+1}: [{q.get("type","?")}] {str(q.get("text",""))[:80]}')
        elif isinstance(data3, dict):
            if 'questions' in data3:
                qs = data3['questions']
                print('Generated', len(qs), 'questions')
                for i, q in enumerate(qs[:3]):
                    print(f'  Q{i+1}: [{q.get("type","?")}] {str(q.get("text",""))[:80]}')
            else:
                print('Response keys:', list(data3.keys()))
                print('Response:', json.dumps(data3)[:300])
    except Exception as e:
        print('Error:', e)
else:
    print('Skipped - no PDF ID from upload')
