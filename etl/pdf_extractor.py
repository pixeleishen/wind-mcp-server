"""
Extract text from PDF files.
Usage: python etl/pdf_extractor.py --pdf <path>
Outputs JSON: {"ok": true, "text": "..."}
"""
import argparse
import json
import sys

try:
    from pypdf import PdfReader
except ImportError:
    print(json.dumps({"ok": False, "error": "pypdf not installed"}))
    sys.exit(1)

def extract_text(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    text_parts = []
    for page in reader.pages:
        text_parts.append(page.extract_text())
    return "\n\n".join(text_parts)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    args = parser.parse_args()

    try:
        text = extract_text(args.pdf)
        print(json.dumps({"ok": True, "text": text}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
