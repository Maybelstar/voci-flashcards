# Voci Flashcards

This project is ready to publish on GitHub Pages as a static website.

## Update the lists

The website reads its lists directly from the shared Google Sheet.
Use the `Listen aktualisieren` link on the page to open and edit it.

## Preview locally

```bash
python3 server.py
```

Then open <http://127.0.0.1:8000>.

## Publish to GitHub Pages

Push these files to a GitHub repository and enable GitHub Pages for the branch.
The site will serve `index.html` and load the lists from Google Sheets automatically.
