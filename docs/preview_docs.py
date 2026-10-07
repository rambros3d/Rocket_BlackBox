#!/usr/bin/env python3
"""
1:1 Pixel-Perfect Local Preview Server for docs/index.md.
Includes live auto-reload: automatically refreshes your browser tab when docs/ files change!
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import markdown

PORT = 8088
DOCS_DIR = os.path.dirname(os.path.abspath(__file__))

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
    </style>
  </head>
  <body>
    <div class="container-lg px-3 my-5 markdown-body">
      <h1><a href="/" style="text-decoration:none; color:inherit;">Rocket BLACKBOX — Avionics &amp; Flight Data Recorder</a></h1>
      {content}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/anchor-js/4.1.0/anchor.min.js"></script>
    <script>anchors.add();</script>
    <!-- Live Auto-Reload Script -->
    <script>
      (function() {{
        let lastVersion = null;
        setInterval(async () => {{
          try {{
            const res = await fetch('/__version__');
            if (res.ok) {{
              const data = await res.json();
              if (lastVersion === null) {{
                lastVersion = data.mtime;
              }} else if (data.mtime !== lastVersion) {{
                console.log("File change detected, auto-reloading...");
                window.location.reload();
              }}
            }}
          }} catch (e) {{}}
        }}, 500);
      }})();
    </script>
  </body>
</html>
"""

def get_latest_mtime():
    """Returns the latest modification time of any file in DOCS_DIR."""
    latest = 0
    for root, _, files in os.walk(DOCS_DIR):
        for f in files:
            if f.endswith(('.md', '.scss', '.css', '.html')):
                p = os.path.join(root, f)
                try:
                    m = os.path.getmtime(p)
                    if m > latest:
                        latest = m
                except OSError:
                    pass
    return latest

class DocsHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOCS_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/__version__":
            data = json.dumps({"mtime": get_latest_mtime()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(data)
            return

        if self.path in ("/", "/index.html"):
            md_path = os.path.join(DOCS_DIR, "index.md")
            if os.path.exists(md_path):
                with open(md_path, "r", encoding="utf-8") as f:
                    text = f.read()
                html_body = markdown.markdown(text, extensions=["tables", "fenced_code"])
                full_html = HTML_TEMPLATE.format(content=html_body).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(full_html)))
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.end_headers()
                self.wfile.write(full_html)
                return

        return super().do_GET()

def main():
    server = HTTPServer(("0.0.0.0", PORT), DocsHandler)
    print(f"Serving auto-refreshing GitHub Pages preview at: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
