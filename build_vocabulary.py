from __future__ import annotations

import json
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent
WORKBOOK = ROOT / "voci.xlsx"
OUTPUT = ROOT / "vocabulary.json"
XML_NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
SUPPORTED_LANGUAGES = {
    "en": "english",
    "fr": "french",
}


def parse_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    tree = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.iterfind(".//main:t", XML_NS))
        for item in tree.findall("main:si", XML_NS)
    ]


def column_name(cell_reference: str) -> str:
    return "".join(character for character in cell_reference if character.isalpha())


def read_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("main:v", XML_NS)

    if value_node is None or value_node.text is None:
        return "".join(node.text or "" for node in cell.iterfind(".//main:t", XML_NS)).strip()

    raw_value = value_node.text.strip()
    if cell_type == "s":
        return shared_strings[int(raw_value)].strip()

    return raw_value


def load_sheet_rows(
    archive: zipfile.ZipFile,
    shared_strings: list[str],
    relationship_map: dict[str, str],
    sheet: ET.Element,
) -> list[dict[str, str]]:
    relationship_id = sheet.attrib.get(f"{{{OFFICE_DOC_REL}}}id")
    if relationship_id is None or relationship_id not in relationship_map:
        raise ValueError("Unable to locate the worksheet inside the workbook.")

    worksheet = ET.fromstring(archive.read(f"xl/{relationship_map[relationship_id]}"))
    sheet_data = worksheet.find("main:sheetData", XML_NS)
    if sheet_data is None:
        return []

    rows: list[dict[str, str]] = []
    for row in sheet_data.findall("main:row", XML_NS):
        row_values: dict[str, str] = {}
        for cell in row.findall("main:c", XML_NS):
            row_values[column_name(cell.attrib.get("r", ""))] = read_cell_value(cell, shared_strings)
        if row_values:
            rows.append(row_values)

    return rows


def parse_sheet(rows: list[dict[str, str]], sheet_name: str) -> dict[str, object] | None:
    if not rows:
        return None

    header_row = rows[0]
    column_lookup = {value.strip().lower(): key for key, value in header_row.items()}
    german_column = column_lookup.get("de")
    if not german_column:
        raise ValueError(f"Das Blatt '{sheet_name}' braucht in der ersten Zeile eine Spalte 'DE'.")

    available_languages = [
        language_code
        for language_code in SUPPORTED_LANGUAGES
        if column_lookup.get(language_code)
    ]

    if not available_languages:
        raise ValueError(f"Das Blatt '{sheet_name}' braucht mindestens eine Spalte 'EN' oder 'FR'.")

    items: list[dict[str, object]] = []

    for row in rows[1:]:
        german = row.get(german_column, "").strip()
        if not german:
            continue

        translations = {
            language_code: row.get(column_lookup[language_code], "").strip()
            for language_code in available_languages
            if row.get(column_lookup[language_code], "").strip()
        }

        if translations:
            items.append({"german": german, "translations": translations})

    if not items:
        return None

    return {"name": sheet_name, "languages": available_languages, "items": items}


def load_vocabulary() -> list[dict[str, object]]:
    if not WORKBOOK.exists():
        raise FileNotFoundError(f"Workbook not found: {WORKBOOK}")

    with zipfile.ZipFile(WORKBOOK) as archive:
        shared_strings = parse_shared_strings(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in relationships.findall("rel:Relationship", REL_NS)
        }

        sheets = workbook.find("main:sheets", XML_NS)
        if sheets is None or not list(sheets):
            return []

        parsed_lists: list[dict[str, object]] = []

        for sheet in list(sheets):
            rows = load_sheet_rows(archive, shared_strings, relationship_map, sheet)
            parsed_sheet = parse_sheet(rows, sheet.attrib["name"])
            if parsed_sheet is not None:
                parsed_lists.append(parsed_sheet)

    return parsed_lists


def main() -> None:
    lists = load_vocabulary()
    payload = {"lists": lists}
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total_items = sum(len(item["items"]) for item in lists)
    print(f"Wrote {len(lists)} lists with {total_items} vocabulary items to {OUTPUT.name}")


if __name__ == "__main__":
    main()
