#!/usr/bin/env python3
"""Tiny HTTP wrapper around LibreOffice headless conversion (M13.1).

POST /convert with a multipart file field -> converts to PDF, returns the PDF
bytes with Content-Type application/pdf. 500 with a JSON error on failure.
Used by eDMS only inside the docker-compose network; do not expose publicly.
"""
import io
import json
import shutil
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 8100


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def do_GET(self):
        if urlparse(self.path).path != "/health":
            self.send_error(404)
            return

        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != "/convert":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            self.send_json(400, {"error": "empty body"})
            return

        content_type = self.headers.get("Content-Type", "")
        boundary = content_type.split("boundary=", 1)[1] if "boundary=" in content_type else None
        if not boundary:
            self.send_json(400, {"error": "multipart body required"})
            return

        body = self.rfile.read(length)
        filename, data = extract_file(body, boundary.encode())
        if filename is None:
            self.send_json(400, {"error": "file field required"})
            return

        with tempfile.TemporaryDirectory() as workdir:
            source = tempfile.mktemp(suffix=filename, dir=workdir)
            with open(source, "wb") as handle:
                handle.write(data)

            try:
                result = subprocess.run(
                    [
                        "libreoffice",
                        "--headless",
                        "--norestore",
                        "--convert-to",
                        "pdf",
                        "--outdir",
                        workdir,
                        source,
                    ],
                    capture_output=True,
                    timeout=120,
                )
            except subprocess.TimeoutExpired:
                self.send_json(500, {"error": "conversion timed out"})
                return

            pdf_name = filename.rsplit(".", 1)[0] + ".pdf"
            pdf_path = workdir + "/" + pdf_name
            if result.returncode != 0 or not __import__("os").path.exists(pdf_path):
                self.send_json(500, {"error": result.stderr.decode(errors="replace")[:500]})
                return

            with open(pdf_path, "rb") as handle:
                pdf = handle.read()

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def extract_file(body, boundary):
    """Parse a multipart body and return (filename, bytes) of the first file field."""
    marker = b"--" + boundary
    parts = body.split(marker)
    for part in parts:
        if part in (b"", b"--\r\n", b"--\r"):
            continue
        header, _, content = part.partition(b"\r\n\r\n")
        if b'name="file"' not in header:
            continue
        content = content.rstrip(b"\r\n")
        filename = None
        for line in header.split(b"\r\n"):
            if b"filename=" in line:
                filename = line.split(b'filename="', 1)[1].split(b'"', 1)[0].decode(errors="replace")
        return filename, content
    return None, None


if __name__ == "__main__":
    if not shutil.which("libreoffice"):
        raise SystemExit("libreoffice not found in image")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
