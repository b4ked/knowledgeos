#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_html, to_json, to_obsidian

LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def slug_for(path: Path, root: Path) -> str:
    return path.relative_to(root).with_suffix("").as_posix()


def label_for(slug: str) -> str:
    return slug.split("/")[-1] or slug


def normalize_target(raw: str) -> str:
    target = raw.split("|", 1)[0].split("#", 1)[0].strip()
    return target[:-3] if target.lower().endswith(".md") else target


def build_extraction(wiki_dir: Path) -> dict:
    files = sorted(p for p in wiki_dir.rglob("*.md") if ".knowx" not in p.parts)
    by_slug = {slug_for(path, wiki_dir): path for path in files}
    by_basename = {path.stem: slug_for(path, wiki_dir) for path in files}
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_nodes: set[str] = set()

    for file_path in files:
        slug = slug_for(file_path, wiki_dir)
        text = file_path.read_text(encoding="utf-8", errors="replace")
        if slug not in seen_nodes:
            seen_nodes.add(slug)
            nodes.append({
                "id": slug,
                "label": label_for(slug),
                "file_type": "document",
                "source_file": str(file_path.relative_to(wiki_dir)),
                "source_location": None,
            })

        for match in LINK_RE.finditer(text):
            raw_target = normalize_target(match.group(1))
            if not raw_target:
                continue
            target = raw_target if raw_target in by_slug else by_basename.get(raw_target, raw_target)
            if target not in seen_nodes:
                seen_nodes.add(target)
                nodes.append({
                    "id": target,
                    "label": label_for(target),
                    "file_type": "stub",
                    "source_file": None,
                    "source_location": None,
                })
            edges.append({
                "source": slug,
                "target": target,
                "relation": "wikilink",
                "confidence": "EXTRACTED",
                "confidence_score": 1.0,
                "source_file": str(file_path.relative_to(wiki_dir)),
                "source_location": None,
                "weight": 1.0,
            })

    return {"nodes": nodes, "edges": edges, "hyperedges": [], "input_tokens": 0, "output_tokens": 0}


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: run_graphify_markdown.py <wiki_dir> <output_dir>", file=sys.stderr)
        return 2

    wiki_dir = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    if not wiki_dir.is_dir():
        print(f"wiki_dir not found: {wiki_dir}", file=sys.stderr)
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    extraction = build_extraction(wiki_dir)
    (output_dir / "extraction.json").write_text(json.dumps(extraction, indent=2), encoding="utf-8")
    graph = build_from_json(extraction, directed=True)
    communities = cluster(graph)
    to_json(graph, communities, str(output_dir / "graph.json"), force=True)
    to_html(graph, communities, str(output_dir / "graph.html"))
    try:
        to_obsidian(graph, communities, str(output_dir / "obsidian"))
    except Exception:
        pass

    (output_dir / "GRAPH_REPORT.md").write_text(
        "# Graphify Markdown Report\n\n"
        f"- Nodes: {graph.number_of_nodes()}\n"
        f"- Edges: {graph.number_of_edges()}\n"
        f"- Communities: {len(communities)}\n"
        f"- Source: `{wiki_dir}`\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "nodes": graph.number_of_nodes(),
        "edges": graph.number_of_edges(),
        "communities": len(communities),
        "wikiDir": str(wiki_dir),
        "outputDir": str(output_dir),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

