#!/usr/bin/env python3

import json
import sys
from pathlib import Path

TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".rtf",
}


def read_text_fallback(file_path: Path) -> str | None:
    if file_path.suffix.lower() not in TEXT_EXTENSIONS:
        return None

    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return file_path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return None
    return None


def convert(file_path: Path) -> dict[str, object]:
    fallback = read_text_fallback(file_path)
    if fallback and fallback.strip():
        return {"ok": True, "markdown": fallback}

    try:
        from markitdown import MarkItDown
    except Exception as exc:  # pragma: no cover - runtime dependency
        return {"ok": False, "error": f"markitdown is not installed: {exc}"}

    try:
        converter = MarkItDown()
        result = converter.convert(str(file_path))
        markdown = getattr(result, "text_content", None) or getattr(result, "markdown", None)
        if markdown is None:
            markdown = str(result)
        markdown = markdown.strip()
        if not markdown:
            return {"ok": False, "error": "No text could be extracted from this file."}
        return {"ok": True, "markdown": markdown}
    except Exception as exc:  # pragma: no cover - runtime dependency
        return {"ok": False, "error": str(exc)}


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "Usage: markitdown_extract.py <file_path>"}))
        return 1

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(json.dumps({"ok": False, "error": f"File not found: {file_path}"}))
        return 1

    print(json.dumps(convert(file_path)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
