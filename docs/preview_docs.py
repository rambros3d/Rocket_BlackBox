#!/usr/bin/env python3
"""
Lightweight local HTTP preview server for docs/index.md using GitHub Primer CSS.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import markdown

PORT = 8088
DOCS_DIR = os.path.dirname(os.path.abspath(__file__))

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rocket BLACKBOX — Local Preview</title>
  <!-- GitHub Primer Markdown CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css">
  <style>
    body {{
      background-color: #f6f8fa;
      margin: 0;
      padding: 30px 15px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }}
    .markdown-body {{
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
      background-color: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }}
    /* EXACT CSS RULE BEING TESTED (max-height: 400px, max-width: 100%) */
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
    .preview-banner {{
      max-width: 980px;
      margin: 0 auto 20px auto;
      padding: 10px 16px;
      background: #ddf4ff;
      border: 1px solid #54aeff;
      border-radius: 6px;
      color: #0969da;
      font-size: 14px;
      font-weight: 500;
    }}
  </style>
</head>
<body>
  <div class="preview-banner">
    🚀 <strong>Local Documentation Preview</strong> — Testing <code>max-height: 400px</code> &amp; <code>max-width: 100%</code> image constraint.
  </div>
  <article class="markdown-body">
    {content}
  </article>
</body>
</html>
"""

class DocsHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOCS_DIR, **kwargs)

    def do_GET(self):
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
                self.end_headers()
                self.wfile.write(full_html)
                return
        return super().do_GET()

def main():
    server = HTTPServer(("0.0.0.0", PORT), DocsHandler)
    print(f"Serving local docs preview at: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
