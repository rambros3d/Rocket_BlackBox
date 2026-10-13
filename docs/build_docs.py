#!/usr/bin/env python3
"""
Compiles docs/index.md into static docs/index.html with GitHub Primer CSS styling.
This ensures GitHub Pages serves the documentation homepage at root (/) when .nojekyll is enabled.
"""

import os
import re
import sys

try:
    import markdown
except ImportError:
    print("Error: 'markdown' package not installed. Run: pip install markdown", file=sys.stderr)
    sys.exit(1)

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_MD = os.path.join(DOCS_DIR, "index.md")
OUTPUT_HTML = os.path.join(DOCS_DIR, "index.html")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Rocket BLACKBOX — Avionics & Flight Data Recorder</title>
    <!-- GitHub Pages / Primer Light CSS (Locked to Light Mode) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
    <style>
      :root {{
        color-scheme: light;
      }}
      body {{
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        background-color: #ffffff !important;
        color: #24292f !important;
        color-scheme: light !important;
      }}
      .container-lg {{
        max-width: 1012px;
        margin-right: auto;
        margin-left: auto;
      }}
      .px-3 {{
        padding-right: 16px !important;
        padding-left: 16px !important;
      }}
      .my-5 {{
        margin-top: 32px !important;
        margin-bottom: 32px !important;
      }}
      .markdown-body {{
        font-size: 16px;
        line-height: 1.5;
        word-wrap: break-word;
        background-color: #ffffff !important;
        color: #24292f !important;
        color-scheme: light !important;
      }}
      /* Responsive image constraint */
      .markdown-body img {{
        max-height: 400px;
        max-width: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        display: block;
        margin: 12px 0 16px 0;
        border: 1px solid #d0d7de;
        border-radius: 6px;
      }}
      /* Dashboard Banner CTA */
      .dashboard-banner {{
        background: linear-gradient(135deg, #0969da 0%, #054da7 100%);
        color: #ffffff !important;
        padding: 16px 20px;
        border-radius: 8px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        box-shadow: 0 4px 12px rgba(9, 105, 218, 0.2);
      }}
      .dashboard-banner a.cta-btn {{
        background-color: #ffffff;
        color: #0969da !important;
        font-weight: 600;
        text-decoration: none;
        padding: 8px 18px;
        border-radius: 6px;
        white-space: nowrap;
        transition: transform 0.15s ease, background-color 0.15s ease;
      }}
      .dashboard-banner a.cta-btn:hover {{
        background-color: #f6f8fa;
        transform: translateY(-1px);
      }}
      /* Callout styling */
      .markdown-body blockquote {{
        border-left: 4px solid #0969da;
        background-color: #f6f8fa;
        padding: 12px 16px;
        border-radius: 0 6px 6px 0;
      }}
    </style>
  </head>
  <body>
    <div class="container-lg px-3 my-5 markdown-body">
      <div class="dashboard-banner">
        <div>
          <div style="font-size: 1.1rem; font-weight: 700;">🚀 Live Ground Station Telemetry Dashboard</div>
          <div style="font-size: 0.9rem; opacity: 0.95;">Direct Web Serial connection for LoRa ground receiver and flight payload</div>
        </div>
        <a href="/dashboard/" class="cta-btn">Launch Dashboard &rarr;</a>
      </div>
      <h1><a href="/" style="text-decoration:none; color:inherit;">Rocket BLACKBOX — Avionics &amp; Flight Data Recorder</a></h1>
      {content}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/anchor-js/4.1.0/anchor.min.js"></script>
    <script>anchors.add();</script>
  </body>
</html>
"""

def build():
    if not os.path.exists(INPUT_MD):
        print(f"Error: {INPUT_MD} not found.", file=sys.stderr)
        sys.exit(1)

    with open(INPUT_MD, "r", encoding="utf-8") as f:
        md_text = f.read()

    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc"]
    )

    full_html = HTML_TEMPLATE.format(content=html_body)

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(full_html)

    print(f"Successfully generated: {OUTPUT_HTML} ({len(full_html.encode('utf-8'))} bytes)")

if __name__ == "__main__":
    build()
