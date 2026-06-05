#!/usr/bin/env python3
"""
drive.py — Live click-sequence drive for the Cash Radar demo.
Runs Playwright in HEADED mode (visible browser window) and walks the full
demo sequence, asserting state at each step. Reports PASS/FAIL.

Sequence:
  1. Load index.html
  2. Confirm scrubber sits on 14 Aug 2024 (default)
  3. Click Apply A -- verify green banner, remedy A active, new_min visible
  4. Click Apply B -- verify green banner, remedy B active (A no longer active)
  5. Click "Drill into SKUs --" -- verify navigated to stocksense.html?ids=…
  6. On StockSense: verify filter banner shows correct count
  7. Click "Clear filter — show all 645" -- verify cleared, URL no longer has ?ids=
  8. Click "← Cash Radar" -- back to index.html
  9. Verify scrubber sits on 14 Aug 2024 again (state reset)
 10. Click Apply C -- verify green banner with positive new_min
 11. Click Apply A -- verify green banner (remedy C swapped out cleanly)

Run:  python .harness/drive.py
"""
import sys
import time
from playwright.sync_api import sync_playwright, expect, TimeoutError

BASE = "http://127.0.0.1:8765"

results = []
def record(step: str, ok: bool, note: str = ""):
    results.append((step, ok, note))
    icon = "PASS" if ok else "FAIL"
    print(f"  [{icon}] {step}" + (f"   — {note}" if note else ""))

def main():
    with sync_playwright() as p:
        # Visible browser so the user can watch. slow_mo gives time to observe.
        browser = p.chromium.launch(headless=False, slow_mo=350,
                                    args=["--window-size=1500,1100"])
        ctx = browser.new_context(viewport={"width": 1500, "height": 1100})
        page = ctx.new_page()
        try:
            run_sequence(page)
        except Exception as e:
            record("UNCAUGHT", False, f"{type(e).__name__}: {e}")
        finally:
            time.sleep(2)
            browser.close()

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"  {passed}/{total} steps passed")
    for step, ok, note in results:
        icon = "PASS" if ok else "FAIL"
        print(f"   [{icon}] {step}" + (f" — {note}" if note else ""))
    sys.exit(0 if passed == total else 1)


def run_sequence(page):
    # ── 1. Load ──
    page.goto(f"{BASE}/index.html", wait_until="networkidle")
    page.wait_for_function("window.CASH_RADAR != null", timeout=5000)
    record("1. Load index.html", True, "CASH_RADAR loaded")

    # Wait for default scrubber + render to complete
    page.wait_for_function("document.getElementById('scrub-date').textContent !== '—'",
                          timeout=3000)

    # ── 2. Confirm scrubber on 14 Aug 2024 ──
    scrub_date = page.locator("#scrub-date").inner_text().strip()
    ok = "14 Aug 2024" in scrub_date
    record("2. Scrubber default = 14 Aug 2024", ok, f"got '{scrub_date}'")

    # Hero figure should show actual nadir
    hero_num = page.locator("#hero-nadir").inner_text().strip()
    ok = "274" in hero_num
    record("2a. Hero shows actual nadir (-£274K)", ok, f"got '{hero_num}'")

    # Danger banner visible
    banner_visible = page.locator("#danger-banner.show").count() > 0
    record("2b. Danger banner visible at default state", banner_visible)

    # ── 3. Click Apply A ──
    page.locator("button:has-text('Apply A')").first.click()
    page.wait_for_timeout(300)

    # Verify: green banner, remedy A has 'active' class
    banner_is_ok = "ok" in (page.locator("#danger-banner").get_attribute("class") or "")
    record("3. Apply A -- banner flips green", banner_is_ok)

    a_active = "active" in (page.locator("#rem-A").get_attribute("class") or "")
    record("3a. Remedy A card marked active", a_active)

    db_title = page.locator("#db-title").inner_text()
    record("3b. Banner title shows ✓ Remedy A applied", "Remedy A applied" in db_title,
           f"title: '{db_title[:60]}…'")

    # ── 4. Click Apply B ──
    page.locator("button:has-text('Apply B')").first.click()
    page.wait_for_timeout(300)

    a_still_active = "active" in (page.locator("#rem-A").get_attribute("class") or "")
    b_active = "active" in (page.locator("#rem-B").get_attribute("class") or "")
    record("4. Apply B -- A no longer active", not a_still_active)
    record("4a. Apply B -- B card marked active", b_active)

    db_title2 = page.locator("#db-title").inner_text()
    record("4b. Banner title shows ✓ Remedy B applied", "Remedy B applied" in db_title2,
           f"title: '{db_title2[:60]}…'")

    # Source notes present and contain formula text
    for letter, formula_marker in [("A", "defer scheduled PO"),
                                    ("B", "discounted price"),
                                    ("C", "APR")]:
        src = page.locator(f"#r{letter}-source").inner_text()
        record(f"4c. Source note Remedy {letter} contains formula",
               formula_marker in src,
               f"first 60 chars: '{src[:60]}…'")

    # ── 5. Drill into SKUs ──
    drill_btn = page.locator("#rB-drill")
    drill_btn.click()
    # Wait for navigation to complete
    page.wait_for_url("**/stocksense.html?ids=*", timeout=5000)
    record("5. Drill button navigated to stocksense.html?ids=…", True,
           f"url: '{page.url[:80]}…'")

    # Wait for stocksense_data to load
    page.wait_for_function("window.STOCKSENSE_DATA != null", timeout=5000)
    page.wait_for_timeout(500)

    # ── 6. Filter banner visible with correct count ──
    fb = page.locator("#filter-banner")
    fb_visible = fb.is_visible()
    record("6. StockSense filter banner visible", fb_visible)

    fb_text = page.locator("#fb-text").inner_text()
    ok = "20 overstock SKUs" in fb_text or "Remedy B" in fb_text
    record("6a. Filter banner mentions 20 SKUs / Remedy B", ok,
           f"text: '{fb_text[:80]}…'")

    # Count actual cards rendered
    grid_cards = page.locator(".pcard").count()
    record("6b. Grid shows ≤ 20 filtered cards (not all 645)", grid_cards <= 20,
           f"cards rendered: {grid_cards}")

    # ── 7. Clear filter ──
    page.locator("button:has-text('Clear filter')").click()
    page.wait_for_timeout(500)

    fb_visible_after = fb.is_visible()
    record("7. Clear filter -- banner hidden", not fb_visible_after)

    # URL should no longer have ?ids=
    cleared_url = page.url
    record("7a. URL stripped of ?ids= param", "?ids=" not in cleared_url,
           f"url now: '{cleared_url[-60:]}'")

    # Should now show many more cards
    grid_cards_after = page.locator(".pcard").count()
    record("7b. Grid now shows many cards (>= 100)", grid_cards_after >= 100,
           f"cards: {grid_cards_after}")

    # ── 8. Back to Cash Radar ──
    page.locator("a:has-text('Cash Radar')").first.click()
    page.wait_for_url("**/index.html", timeout=5000)
    page.wait_for_function("window.CASH_RADAR != null", timeout=5000)
    page.wait_for_function("document.getElementById('scrub-date').textContent !== '—'",
                          timeout=3000)
    record("8. Back link navigated to index.html", True, f"url: '{page.url[-40:]}'")

    # ── 9. State reset check ──
    scrub_date_back = page.locator("#scrub-date").inner_text().strip()
    record("9. State reset -- scrubber back on 14 Aug 2024", "14 Aug 2024" in scrub_date_back,
           f"got '{scrub_date_back}'")

    # No remedy should be active after fresh load
    any_active = page.locator(".remedy.active").count()
    record("9a. State reset -- no remedy card active",
           any_active == 0, f"active count: {any_active}")

    # Banner should be back to RED (not green) since no remedy applied
    banner_class = page.locator("#danger-banner").get_attribute("class") or ""
    record("9b. Danger banner back to red state (no .ok class)", "ok" not in banner_class)

    # ── 10. Apply C ──
    page.locator("button:has-text('Apply C')").first.click()
    page.wait_for_timeout(300)

    banner_class_c = page.locator("#danger-banner").get_attribute("class") or ""
    record("10. Apply C -- banner flips green", "ok" in banner_class_c)

    db_title_c = page.locator("#db-title").inner_text()
    record("10a. Banner title shows ✓ Remedy C applied",
           "Remedy C applied" in db_title_c, f"title: '{db_title_c[:60]}…'")

    # New min from C should be POSITIVE (Wayflyer pushes balance above 0)
    rC_newmin = page.locator("#rC-newmin").inner_text()
    record("10b. Remedy C new_min is positive (≥ £19K)",
           "£19" in rC_newmin or "£20" in rC_newmin,
           f"got '{rC_newmin}'")

    # ── 11. Switch from C to A ──
    page.locator("button:has-text('Apply A')").first.click()
    page.wait_for_timeout(300)

    c_active = "active" in (page.locator("#rem-C").get_attribute("class") or "")
    a_active2 = "active" in (page.locator("#rem-A").get_attribute("class") or "")
    record("11. Apply A again -- C no longer active", not c_active)
    record("11a. Apply A again -- A active", a_active2)

    banner_class_a2 = page.locator("#danger-banner").get_attribute("class") or ""
    record("11b. Banner still green (A applied)", "ok" in banner_class_a2)

    db_title_a2 = page.locator("#db-title").inner_text()
    record("11c. Banner title shows ✓ Remedy A applied",
           "Remedy A applied" in db_title_a2,
           f"title: '{db_title_a2[:60]}…'")

    # Reset button works?
    page.locator("button:has-text('Reset')").first.click()
    page.wait_for_timeout(300)
    any_active_after_reset = page.locator(".remedy.active").count()
    banner_after_reset = page.locator("#danger-banner").get_attribute("class") or ""
    record("11d. Reset button clears remedy state",
           any_active_after_reset == 0 and "ok" not in banner_after_reset,
           f"active: {any_active_after_reset}, banner: '{banner_after_reset}'")


if __name__ == "__main__":
    main()
