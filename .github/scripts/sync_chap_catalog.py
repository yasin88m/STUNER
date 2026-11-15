#!/usr/bin/env python3
"""Import the current official student textbook catalogue from chap.sch.ir."""
import concurrent.futures
import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "http://chap.sch.ir"
TARGET_YEAR = "1405-1406"
UA = "Mozilla/5.0 (compatible; STUNER-Curriculum-Sync/1.0)"
GRADE_WORDS = {
    "اول": "اول ابتدایی", "دوم": "دوم ابتدایی", "سوم": "سوم ابتدایی",
    "چهارم": "چهارم ابتدایی", "پنجم": "پنجم ابتدایی", "ششم": "ششم ابتدایی",
    "هفتم": "هفتم", "هشتم": "هشتم", "نهم": "نهم",
    "دهم": "دهم", "یازدهم": "یازدهم", "دوازدهم": "دوازدهم",
}
GRADE_RE = re.compile(r"پایه\s*(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم)")
NON_STUDENT_BOOK = re.compile(r"راهنمای\s*(?:تدریس|معلم|اولیا)|کتاب\s*معلم", re.I)

def clean(value):
    value = html.unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", value).strip()

def fetch(url, attempts=3):
    last = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
            })
            with urllib.request.urlopen(request, timeout=55) as response:
                return response.read().decode("utf-8", "replace")
        except Exception as exc:
            last = exc
            time.sleep(0.5 * (attempt + 1))
    raise last

class SelectParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.select = None
        self.option = None
        self.selects = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "select":
            self.select = attrs.get("name")
            if self.select:
                self.selects.setdefault(self.select, [])
        elif tag == "option" and self.select:
            self.option = {"value": attrs.get("value", ""), "text": ""}
    def handle_data(self, data):
        if self.option is not None:
            self.option["text"] += data
    def handle_endtag(self, tag):
        if tag == "option" and self.option is not None and self.select:
            self.selects[self.select].append(self.option)
            self.option = None
        elif tag == "select":
            self.select = None
            self.option = None

class PagerParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "")
            if "page=" in href:
                self.hrefs.append(html.unescape(href))

class DetailParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_h1 = False
        self.title = ""
        self.pdfs = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self.in_h1 = True
        if tag == "a":
            href = html.unescape(attrs.get("href", ""))
            if ".pdf" in href.lower():
                self.pdfs.append(urllib.parse.urljoin(BASE + "/", href))
    def handle_data(self, data):
        if self.in_h1:
            self.title += data
    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_h1 = False

def get_year_id(home):
    parser = SelectParser()
    parser.feed(home)
    for option in parser.selects.get("field_year_tid", []):
        if option["text"].strip().replace(" ", "") == TARGET_YEAR:
            return option["value"]
    raise RuntimeError("Official publication year " + TARGET_YEAR + " not found")

def parse_taxonomy(home):
    parser = SelectParser()
    parser.feed(home)
    options = parser.selects.get("tid", [])
    if not options:
        raise RuntimeError("Official taxonomy filter 'tid' not found")
    stack = []
    categories = []
    for option in options:
        raw = option["text"].strip()
        term_id = option["value"]
        if not term_id or term_id == "All" or not raw:
            continue
        depth = len(raw) - len(raw.lstrip("-"))
        label = raw[depth:].strip()
        stack = stack[:depth]
        stack.append(label)
        match = GRADE_RE.fullmatch(label)
        if not match:
            continue
        word = match.group(1)
        path = list(stack)
        item = classify(path, word, term_id)
        if item:
            categories.append(item)
    unique = {}
    for item in categories:
        unique[item["termId"]] = item
    return list(unique.values())

def canonical_group(source_group):
    n = normalize(source_group)
    if n == "صنعت": return "صنعت"
    if n == "هنر": return "هنر"
    if n in ("خدمات", "مدیریت و خدمات"): return "مدیریت و خدمات"
    if n == "کشاورزی": return "کشاورزی"
    return source_group

def normalize(value):
    value = str(value or "").replace("\u200c", "").replace("\u200f", "")
    value = value.replace("ي", "ی").replace("ك", "ک")
    return re.sub(r"[\s‌ـ\-–_]+", "", value).lower()

def classify(path, grade_word, term_id):
    root = path[0] if path else ""
    grade = GRADE_WORDS[grade_word]
    if root == "دوره آموزش ابتدایی":
        return {"termId": term_id, "educationLevel": "elementary", "grade": grade,
                "track": "", "fieldGroup": "", "major": "", "path": path}
    if root == "دوره اول آموزش متوسطه":
        return {"termId": term_id, "educationLevel": "middle", "grade": grade,
                "track": "", "fieldGroup": "", "major": "", "path": path}
    if root != "دوره دوم آموزش متوسطه":
        return None
    if "متوسطه نظری" in path:
        major = path[path.index("متوسطه نظری") + 1] if len(path) > path.index("متوسطه نظری") + 1 else ""
        if major.startswith("پایه "):
            return None
        if normalize(major) == normalize("علوم انسانی"):
            major = "ادبیات و علوم انسانی"
        return {"termId": term_id, "educationLevel": "secondary", "grade": grade,
                "track": "نظری", "fieldGroup": "", "major": major, "path": path}
    if "فنی حرفه ای" in path:
        index = path.index("فنی حرفه ای")
        group_source = path[index + 1] if len(path) > index + 1 else ""
        if "مشترک" in normalize(group_source):
            return {"termId": term_id, "educationLevel": "secondary", "grade": grade,
                    "track": "فنی‌وحرفه‌ای", "fieldGroup": "مشترک", "major": "__common__", "path": path}
        candidates = [x for x in path[index + 1:-1] if not normalize(x).startswith("گروه")]
        major = candidates[-1] if candidates else ""
        if not major:
            return None
        return {"termId": term_id, "educationLevel": "secondary", "grade": grade,
                "track": "فنی‌وحرفه‌ای", "fieldGroup": canonical_group(group_source),
                "major": major, "path": path}
    if "کار دانش" in path or "کاردانش" in path:
        index = path.index("کار دانش") if "کار دانش" in path else path.index("کاردانش")
        group_source = path[index + 1] if len(path) > index + 1 else ""
        if "مشترک" in normalize(group_source):
            return {"termId": term_id, "educationLevel": "secondary", "grade": grade,
                    "track": "کاردانش", "fieldGroup": "مشترک", "major": "__common__", "path": path}
        candidates = [x for x in path[index + 1:-1] if not normalize(x).startswith("گروه")]
        major = candidates[-1] if candidates else ""
        if not major:
            return None
        return {"termId": term_id, "educationLevel": "secondary", "grade": grade,
                "track": "کاردانش", "fieldGroup": canonical_group(group_source),
                "major": major, "path": path}
    return None

def parse_grid(page_html):
    match = re.search(r'<table class="views-view-grid">(.*?)</table>', page_html, re.S)
    if not match:
        return [], []
    grid = match.group(1)
    cells = re.findall(r'<td class="col-[^"]+"[^>]*>(.*?)</td>', grid, re.S)
    books = []
    for cell in cells:
        link = re.search(r'<div class="views-field views-field-title".*?<a[^>]+href="([^"]*/books/(\d+))"[^>]*>(.*?)</a>', cell, re.S)
        if not link:
            continue
        title = clean(link.group(3))
        code_match = re.search(r'<span class="views-field views-field-field-book-code".*?<span class="field-content">\s*(.*?)\s*</span>', cell, re.S)
        code = clean(code_match.group(1)) if code_match else ""
        if not title or NON_STUDENT_BOOK.search(title):
            continue
        books.append({
            "id": link.group(2),
            "title": title,
            "code": code,
            "url": BASE + "/books/" + link.group(2),
        })
    pager = PagerParser()
    pager.feed(page_html)
    pages = set()
    for href in pager.hrefs:
        parsed = urllib.parse.urlparse(urllib.parse.urljoin(BASE + "/", href))
        query = urllib.parse.parse_qs(parsed.query)
        page_values = query.get("page", [])
        for page_value in page_values:
            parts = page_value.split(",")
            if parts and parts[-1].isdigit():
                pages.add(int(parts[-1]))
    return books, sorted(p for p in pages if p > 0)

def fetch_category(category, year_id):
    params = {"tid": category["termId"], "field_year_tid": year_id}
    url = BASE + "/advanced_search?" + urllib.parse.urlencode(params)
    first_html = fetch(url)
    first_books, pages = parse_grid(first_html)
    books = list(first_books)
    # Drupal's multi-view pager stores the target result page in the last slot.
    for page_number in pages:
        page_param = ",".join(["0"] * 13 + [str(page_number)])
        page_url = BASE + "/advanced_search?" + urllib.parse.urlencode({
            **params, "page": page_param
        })
        page_html = fetch(page_url)
        page_books, _ = parse_grid(page_html)
        books.extend(page_books)
    unique = {}
    for book in books:
        unique[book["id"]] = book
    return {**category, "bookIds": list(unique.keys()), "bookRecords": list(unique.values())}

def enrich_book(book):
    detail = fetch(book["url"])
    parser = DetailParser()
    parser.feed(detail)
    title = clean(parser.title) or book["title"]
    # Prefer the full title on the book's own official page over the truncated card title.
    pdfs = list(dict.fromkeys(parser.pdfs))
    return {
        **book,
        "title": title,
        "pdfUrl": pdfs[0] if pdfs else "",
        "pdfUrls": pdfs,
        "sourceYear": TARGET_YEAR,
    }

def main():
    home = fetch(BASE + "/")
    year_id = get_year_id(home)
    categories = parse_taxonomy(home)
    print("OFFICIAL_YEAR", TARGET_YEAR, "YEAR_TERM", year_id)
    print("TAXONOMY_GRADE_CATEGORIES", len(categories))
    if len(categories) < 100:
        raise RuntimeError("Taxonomy coverage unexpectedly small; refusing to publish")

    results = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=18) as pool:
        futures = {pool.submit(fetch_category, item, year_id): item for item in categories}
        for future in concurrent.futures.as_completed(futures):
            item = futures[future]
            try:
                results.append(future.result())
            except Exception as exc:
                errors.append((item["termId"], item["path"], repr(exc)))
    results.sort(key=lambda x: (x["educationLevel"], x["grade"], x["track"], x["fieldGroup"], x["major"], int(x["termId"])))
    book_cards = {}
    for category in results:
        for book in category.get("bookRecords", []):
            book_cards[book["id"]] = book
    book_ids = sorted(book_cards, key=lambda x: int(x))
    print("CATEGORY_RESULTS", len(results), "CATEGORIES_WITH_BOOKS", sum(bool(x["bookIds"]) for x in results))
    print("UNIQUE_BOOKS", len(book_ids), "BOOK_ASSOCIATIONS", sum(len(x["bookIds"]) for x in results))
    print("CATEGORY_FETCH_ERRORS", len(errors))
    for error in errors[:20]:
        print("CATEGORY_ERROR", error)
    if len(errors) > max(15, len(categories) // 12):
        raise RuntimeError("Too many catalogue category requests failed; refusing incomplete import")

    # Fetch full title and the official PDF URL from each book's own detail page.
    books_by_id = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=18) as pool:
        futures = {pool.submit(enrich_book, book_cards[book_id]): book_id for book_id in book_ids}
        for future in concurrent.futures.as_completed(futures):
            book_id = futures[future]
            try:
                books_by_id[book_id] = future.result()
            except Exception as exc:
                # Keep a record from the category card if detail metadata is temporarily unavailable.
                books_by_id[book_id] = {
                    **book_cards[book_id], "pdfUrl": "", "pdfUrls": [],
                    "sourceYear": TARGET_YEAR, "detailFetchError": str(exc),
                }

    ready_categories = []
    for category in results:
        valid_ids = [book_id for book_id in category["bookIds"] if book_id in books_by_id]
        if not valid_ids:
            continue
        ready_categories.append({k: v for k, v in category.items() if k != "bookIds"} | {"bookIds": valid_ids})

    # Do not keep old/teacher/special-education categories, only standard public-school grades.
    data = {
        "schemaVersion": 2,
        "source": BASE,
        "academicYear": TARGET_YEAR,
        "yearTermId": year_id,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "categories": ready_categories,
        "books": books_by_id,
    }
    output = "/* Generated from the official chap.sch.ir catalogue. Do not edit by hand. */\nwindow.STUNER_CHAP_CATALOG = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    if not books_by_id or not ready_categories:
        raise RuntimeError("No official books were imported; refusing to publish an empty catalogue")
    Path("chap-catalog.js").write_text(output, encoding="utf-8")
    print("OUTPUT_BYTES", len(output), "READY_CATEGORIES", len(ready_categories), "BOOKS", len(books_by_id))
    print("BY_TRACK", json.dumps({
        key: sum(1 for c in ready_categories if c.get("track") == key)
        for key in ["نظری", "فنی‌وحرفه‌ای", "کاردانش", ""]
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
