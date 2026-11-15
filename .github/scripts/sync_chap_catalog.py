#!/usr/bin/env python3
"""Import the current-year official student textbook catalog from chap.sch.ir.

The site currently serves its Drupal catalog over HTTP; HTTPS responds with an
obsolete one-byte document. Only public catalog metadata is fetched.
"""
import concurrent.futures
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "http://chap.sch.ir"
USER_AGENT = "Mozilla/5.0 (compatible; STUNER-official-catalog-import/1.0)"
GRADE_MAP = {
    "اول": ("اول ابتدایی", "elementary"),
    "دوم": ("دوم ابتدایی", "elementary"),
    "سوم": ("سوم ابتدایی", "elementary"),
    "چهارم": ("چهارم ابتدایی", "elementary"),
    "پنجم": ("پنجم ابتدایی", "elementary"),
    "ششم": ("ششم ابتدایی", "elementary"),
    "هفتم": ("هفتم", "middle"),
    "هشتم": ("هشتم", "middle"),
    "نهم": ("نهم", "middle"),
    "دهم": ("دهم", "secondary"),
    "یازدهم": ("یازدهم", "secondary"),
    "دوازدهم": ("دوازدهم", "secondary"),
}
EXCLUDED_TITLE = re.compile(r"راهنمای\s*(?:عمل\s*)?معلم|کتاب\s*معلم|راهنمای\s*تدریس|راهنمای\s*ارزشیابی|استاندارد\s*بسته", re.I)

def fetch(url, attempts=3):
    last = None
    for n in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
            with urllib.request.urlopen(req, timeout=45) as response:
                return response.read().decode("utf-8", "replace")
        except Exception as exc:
            last = exc
            time.sleep(0.7 * (n + 1))
    raise last

class SelectParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.select_name = None
        self.option = None
        self.selects = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "select":
            self.select_name = attrs.get("name")
            if self.select_name:
                self.selects.setdefault(self.select_name, [])
        elif tag == "option" and self.select_name:
            self.option = {"value": attrs.get("value", ""), "text": ""}
    def handle_data(self, data):
        if self.option is not None:
            self.option["text"] += data
    def handle_endtag(self, tag):
        if tag == "option" and self.option is not None and self.select_name:
            self.selects[self.select_name].append(self.option)
            self.option = None
        elif tag == "select":
            self.select_name = None
            self.option = None

class ResultsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_search_grid = False
        self.card = None
        self.capture_title = False
        self.in_code_container = False
        self.code_depth = 0
        self.rows = []
        self.pages = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        cls = attrs.get("class", "")
        if tag == "table" and "views-view-grid" in cls:
            self.in_search_grid = True
        elif tag == "td" and self.in_search_grid and re.search(r"\bcol-\d+\b", cls):
            self.card = {"id": "", "title": "", "code": ""}
        elif self.card is not None and tag == "div" and "views-field-title" in cls:
            self.capture_title = True
        elif self.card is not None and tag == "span" and "views-field-field-book-code" in cls:
            self.in_code_container = True
            self.code_depth = 1
        elif self.in_code_container and tag == "span":
            self.code_depth += 1
        elif self.card is not None and tag == "a" and self.capture_title:
            match = re.search(r"/books/(\d+)", attrs.get("href", ""))
            if match:
                self.card["id"] = match.group(1)
        if tag == "a":
            match = re.search(r"(?:\?|&)page=(\d+)", attrs.get("href", ""))
            if match:
                self.pages.add(int(match.group(1)))
    def handle_data(self, data):
        if self.card is not None:
            if self.capture_title:
                self.card["title"] += data
            if self.in_code_container:
                self.card["code"] += data
    def handle_endtag(self, tag):
        if tag == "span" and self.in_code_container:
            self.code_depth -= 1
            if self.code_depth <= 0:
                self.in_code_container = False
                self.code_depth = 0
        elif tag == "div" and self.capture_title:
            self.capture_title = False
        elif tag == "td" and self.card is not None:
            self.card["title"] = re.sub(r"\s+", " ", html.unescape(self.card["title"])).strip()
            code_matches = re.findall(r"\d+", self.card["code"])
            self.card["code"] = code_matches[-1] if code_matches else ""
            if self.card["id"] and self.card["title"]:
                self.rows.append(self.card)
            self.card = None
            self.capture_title = False
            self.in_code_container = False
            self.code_depth = 0
        elif tag == "table" and self.in_search_grid:
            self.in_search_grid = False

def get_year_id(home_html, target_year):
    parser = SelectParser()
    parser.feed(home_html)
    for option in parser.selects.get("field_year_tid", []):
        if option["text"].strip().replace(" ", "") == target_year.replace(" ", ""):
            return option["value"]
    raise RuntimeError(f"Publication year {target_year} was not found in chap.sch.ir")

def grade_term_options(home_html):
    parser = SelectParser()
    parser.feed(home_html)
    options = parser.selects.get("tid", [])
    stack = []
    terms = []
    for option in options:
        value = option["value"]
        raw = option["text"].strip()
        if not value or value == "All" or not raw:
            continue
        depth = len(raw) - len(raw.lstrip("-"))
        label = raw[depth:].strip()
        stack = stack[:depth]
        stack.append(label)
        match = re.fullmatch(r"پایه\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم)", label)
        if not match:
            continue
        grade_word = match.group(1)
        grade_key, level = GRADE_MAP[grade_word]
        path = list(stack)
        meta = classify_path(path, grade_key, level)
        if meta:
            terms.append({"termId": value, "grade": grade_key, "educationLevel": level, "path": path, **meta})
    # Keep distinct taxonomy term IDs only.
    unique = {}
    for term in terms:
        unique[term["termId"]] = term
    return list(unique.values())

def classify_path(path, grade, level):
    names = [re.sub(r"\s+", " ", x).strip() for x in path]
    if level in ("elementary", "middle"):
        if level == "elementary" and "دوره آموزش ابتدایی" not in names:
            return None
        if level == "middle" and not any("دوره اول آموزش متوسطه" in x for x in names):
            return None
        return {"track": "", "fieldGroup": "", "major": ""}
    if any("متوسطه نظری" in x for x in names):
        i = next(i for i,x in enumerate(names) if "متوسطه نظری" in x)
        major = next((x for x in names[i+1:] if x not in ("پایه دهم","پایه یازدهم","پایه دوازدهم")), "")
        aliases = {"علوم انسانی": "ادبیات و علوم انسانی"}
        return {"track": "نظری", "fieldGroup": "", "major": aliases.get(major, major)}
    track = "فنی‌وحرفه‌ای" if any("فنی" in x and "حرفه" in x for x in names) else ("کاردانش" if any("کاردانش" in x or "کار دانش" in x for x in names) else "")
    if not track:
        return None
    if any("دروس مشترك فنی" in x or "دروس مشترک فنی" in x for x in names):
        return {"track": track, "fieldGroup": "مشترک", "major": "__common__"}
    group = ""
    for x in names:
        if "صنعت" in x:
            group = "صنعت"; break
        if "کشاورزی" in x or "غذا" in x:
            group = "کشاورزی"; break
        if "خدمات" in x:
            group = "مدیریت و خدمات"; break
        if "هنر" in x or "معماری" in x:
            group = "هنر"; break
    if not group and track == "کاردانش":
        return {"track": track, "fieldGroup": "مشترک", "major": "__common__"}
    if not group:
        return None
    ignored = {"صنعت","هنر","خدمات","کشاورزی","فنی حرفه ای","فنی‌وحرفه‌ای","کاردانش","کار دانش","گروه صنعت","گروه هنر","گروه خدمات","گروه کشاورزی","معماری و ساختمان","گروه معماری و ساختمان"}
    candidates = [x for x in names if x not in ignored and not x.startswith("پایه ") and not x.startswith("گروه ")]
    # The most specific non-grade item is the specialty. Common group labels are not majors.
    major = candidates[-1] if candidates else ""
    if not major:
        return None
    return {"track": track, "fieldGroup": group, "major": major}

def fetch_term(term, year_id):
    records = []
    pages = [0]
    seen_pages = set()
    while pages:
        page = pages.pop(0)
        if page in seen_pages:
            continue
        seen_pages.add(page)
        params = {"tid": term["termId"], "field_year_tid": year_id}
        if page:
            params["page"] = str(page)
        url = BASE + "/advanced_search?" + urllib.parse.urlencode(params)
        parser = ResultsParser()
        parser.feed(fetch(url))
        for row in parser.rows:
            if EXCLUDED_TITLE.search(row["title"]):
                continue
            records.append({
                "id": row["id"],
                "title": row["title"],
                "code": row["code"],
                "url": BASE + "/books/" + row["id"]
            })
        for next_page in sorted(parser.pages):
            if next_page not in seen_pages and next_page not in pages:
                pages.append(next_page)
        if len(seen_pages) > 20:
            break
    # Deduplicate rows returned by pagers.
    unique = {}
    for book in records:
        unique[(book["id"], book["code"], book["title"])] = book
    return {**term, "books": list(unique.values())}


def fetch_full_title(book):
    try:
        page = fetch(book["url"], attempts=2)
        match = re.search(r'<h1[^>]*id="page-title"[^>]*>(.*?)</h1>', page, re.S | re.I)
        if match:
            title = re.sub(r"\\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", match.group(1)))).strip()
            if title:
                return book["id"], title
    except Exception:
        pass
    return book["id"], book["title"]

def main():
    target_year = "1405-1406"
    home = fetch(BASE + "/")
    year_id = get_year_id(home, target_year)
    terms = grade_term_options(home)
    if not terms:
        raise RuntimeError("No grade taxonomy terms were found in the official catalog")
    print(f"Official year: {target_year} (term {year_id})")
    print(f"Grade taxonomy terms: {len(terms)}")
    results = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(fetch_term, term, year_id): term for term in terms}
        for future in concurrent.futures.as_completed(futures):
            term = futures[future]
            try:
                results.append(future.result())
            except Exception as exc:
                errors.append((term["termId"], term["path"], str(exc)))
    results.sort(key=lambda x: (x["educationLevel"], x["grade"], x["track"], x["fieldGroup"], x["major"], int(x["termId"])))
    # Search result cards visually truncate long titles. Read the official
    # detail page for every truncated title so the app stores the full title.
    unique_books = {}
    for category in results:
        for book in category["books"]:
            unique_books[book["id"]] = book
    truncated = [b for b in unique_books.values() if "..." in b["title"] or "…" in b["title"]]
    full_titles = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(fetch_full_title, book) for book in truncated]
        for future in concurrent.futures.as_completed(futures):
            book_id, title = future.result()
            full_titles[book_id] = title
    for category in results:
        for book in category["books"]:
            if book["id"] in full_titles:
                book["title"] = full_titles[book["id"]]
    print(f"Full official titles resolved: {sum(1 for b in full_titles.values() if b)} / {len(truncated)} truncated titles")
    book_count = sum(len(x["books"]) for x in results)
    empty_count = sum(1 for x in results if not x["books"])
    print(f"Categories processed: {len(results)}; book associations: {book_count}; empty categories: {empty_count}; request errors: {len(errors)}")
    for error in errors[:25]:
        print("FETCH_ERROR", error)
    if len(errors) > max(5, len(terms) // 20):
        raise RuntimeError("Too many catalog requests failed; refusing to commit an incomplete catalog")
    payload = {
        "schemaVersion": 1,
        "source": BASE,
        "academicYear": target_year,
        "yearTermId": year_id,
        "categories": results
    }
    js = "/* Official student textbook catalog imported from chap.sch.ir. */\nwindow.STUNER_CHAP_CATALOG = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    Path("chap-catalog.js").write_text(js, encoding="utf-8")
    print(f"Wrote chap-catalog.js ({len(js)} chars)")
    if not book_count:
        raise RuntimeError("No official book records were returned; refusing to commit an empty catalog")

if __name__ == "__main__":
    main()
