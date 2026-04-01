# Voci Flashcards

This project is ready to publish on GitHub Pages as a static website.

## Update the vocabulary list

1. Replace or edit `voci.xlsx`.
2. Run:

```bash
python3 build_vocabulary.py
```

This refreshes `vocabulary.json`, which is the file the website reads on GitHub Pages.

## Preview locally

```bash
python3 server.py
```

Then open <http://127.0.0.1:8000>.

## Publish to GitHub Pages

Push these files to a GitHub repository and enable GitHub Pages for the branch.
The site will serve `index.html` and load `vocabulary.json` automatically.
