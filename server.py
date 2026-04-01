from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def run() -> None:
    host = "127.0.0.1"
    port = 8000
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))

    with ThreadingHTTPServer((host, port), handler) as server:
        print(f"Serving static files on http://{host}:{port}")
        server.serve_forever()


if __name__ == "__main__":
    run()
