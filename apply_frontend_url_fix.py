#!/usr/bin/env python3
"""
FIX: static_url should take priority over markdown-extracted URLs.
Run from Frontend project root: python apply_url_priority_fix.py

Problem: Agent puts literal "ACCOUNT_NAME" in markdown links. 
extractMarkdownImage picks up the broken URL and overrides the
correct static_url from the result dict.
"""

FILEPATH = "src/components/HydrologyDarkChat.tsx"

with open(FILEPATH, "r") as f:
    content = f.read()

original = content

# Fix: only use markdownExtractedUrl if there's no static_url already
OLD = """    if (markdownExtractedUrl) {
      imageUrl = markdownExtractedUrl
    }"""

NEW = """    // Only use markdown-extracted URL if no static_url from backend
    // static_url is always more reliable than URLs parsed from agent text
    if (markdownExtractedUrl && !r?.static_url) {
      imageUrl = markdownExtractedUrl
    }"""

if OLD in content:
    content = content.replace(OLD, NEW)
    print("✅ PATCH applied: static_url takes priority over markdown URLs")
else:
    print("❌ PATCH failed: could not find markdownExtractedUrl override")
    for i, line in enumerate(content.split('\n')):
        if 'markdownExtractedUrl' in line:
            print(f"   Line {i+1}: {line.strip()}")

if content != original:
    with open(FILEPATH, "w") as f:
        f.write(content)
    print(f"\n✅ Written to {FILEPATH}")
else:
    print(f"\n⚠️ No changes made")