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
        self.row = None
        self.cell = None
        self.in_title_link = False
        self.rows = []
        self.pages = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.row = {"id": "", "title": "", "code": ""}
        elif tag == "td" and self.row is not None:
            cls = attrs.get("class", "")
            if "views-field-title" in cls:
                self.cell = "title"
            elif "views-field-field-book-code" in cls:
                self.cell = "code"
        elif tag == "a":
            href = attrs.get("href", "")
            if self.row is not None and self.cell == "title":
                match = re.search(r"/books/(\d+)", href)
                if match:
                    self.row["id"] = match.group(1)
        if tag == "a":
            href = attrs.get("href", "")
            match = re.search(r"(?:\?|&)page=(\d+)", href)
            if match:
                self.pages.add(int(match.group(1)))
    def handle_data(self, data):
        if self.row is not None and self.cell:
            self.row[self.cell] += data
    def handle_endtag(self, tag):
        if tag == "td":
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.row["title"] = re.sub(r"\s+", " ", html.unescape(self.row["title"])).strip()
            self.row["code"] = re.sub(r"\s+", " ", html.unescape(self.row["code"])).strip()
            if self.row["id"] and self.row["title"]:
                self.rows.append(self.row)
            self.row = None

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
    track = "فنی‌وحرفه‌ای" if any("فنی" in x and "حرفه" in x for x in names) else ("کاردانش" if any("کاردانش" in x for x in names) else "")
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
    if not group:
        return None
    ignored = {"صنعت","هنر","خدمات","کشاورزی","فنی حرفه ای","فنی‌وحرفه‌ای","کاردانش","گروه صنعت","گروه هنر","گروه خدمات","گروه کشاورزی","معماری و ساختمان","گروه معماری و ساختمان"}
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
