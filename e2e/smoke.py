"""Browser tests for a built copy of penny-split.

    npm run build                      # creates dist/
    pip install playwright && playwright install chromium
    python e2e/smoke.py dist           # or any folder containing a build
"""

from __future__ import annotations

import functools
import re
import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        pass


def serve(directory: Path) -> tuple[socketserver.TCPServer, str]:
    handler = functools.partial(QuietHandler, directory=str(directory))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/"


def owes(page: Page, name: str):
    return page.get_by_role("list", name="What each person owes").locator("summary", has_text=name).locator(".amount")


def test_empty_state(page: Page, url: str) -> None:
    page.goto(url)
    expect(page.get_by_role("heading", name="Split the bill to the cent.")).to_be_visible()
    expect(page.get_by_text("Add the people at the table to see who owes what.")).to_be_visible()


def test_split_a_bill(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_label("Add a person").fill("Ana, Ben")
    page.get_by_label("Add a person").press("Enter")
    page.get_by_role("button", name="Add item").click()
    page.get_by_label("Item 1 name").fill("Pizza")
    page.get_by_label("Price").fill("30")
    expect(owes(page, "Ana")).to_have_text("$15.00")
    expect(owes(page, "Ben")).to_have_text("$15.00")
    page.get_by_role("group", name="Who had Pizza").get_by_role("button", name="Ana").click()
    expect(owes(page, "Ana")).to_have_text("$30.00")
    expect(owes(page, "Ben")).to_have_text("$0.00")
    page.get_by_role("button", name="+ Tip").click()
    expect(owes(page, "Ana")).to_have_text("$33.00")


def test_uneven_portions(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_label("Add a person").fill("Ana, Ben")
    page.get_by_label("Add a person").press("Enter")
    page.get_by_role("button", name="Add item").click()
    page.get_by_label("Item 1 name").fill("Cake")
    page.get_by_label("Price").fill("12")
    group = page.get_by_role("group", name="Who had Cake")
    group.get_by_role("button", name="Ana", exact=True).click()
    group.get_by_role("button", name="Ben", exact=True).click()
    group.get_by_role("button", name="More portions for Ana").click()
    expect(owes(page, "Ana")).to_have_text("$8.00")
    expect(owes(page, "Ben")).to_have_text("$4.00")


def test_invalid_price(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_label("Add a person").fill("Ana")
    page.get_by_label("Add a person").press("Enter")
    page.get_by_role("button", name="Add item").click()
    page.get_by_label("Price").fill("1.2.3")
    expect(page.get_by_role("alert")).to_have_text("Enter an amount like 12.50")
    expect(page.get_by_label("Price")).to_have_attribute("aria-invalid", "true")


def test_example_receipt_and_settle_up(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_role("button", name="Try an example bill").click()
    expect(page.locator(".sums .grand dd")).to_have_text("$174.49")
    total = sum(
        float(t.replace("$", "").replace(",", ""))
        for t in page.get_by_role("list", name="What each person owes").locator(".amount").all_inner_texts()
    )
    assert round(total, 2) == 174.49, f"shares add up to {total}"
    page.get_by_label("Total printed on the receipt").fill("174.49")
    expect(page.get_by_text("Matches the receipt to the cent.")).to_be_visible()
    page.get_by_label("Total printed on the receipt").fill("170")
    expect(page.get_by_text("more than the receipt")).to_be_visible()
    expect(page.get_by_role("list", name="Who owes the payer").get_by_role("listitem")).to_have_count(3)


def test_undo_remove(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_role("button", name="Try an example bill").click()
    page.get_by_role("button", name="Remove Ben").click()
    expect(page.get_by_label("Name for Ben")).to_have_count(0)
    page.get_by_role("button", name="Undo").click()
    expect(page.get_by_label("Name for Ben")).to_have_count(1)


def test_share_link_round_trip(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_role("button", name="Try an example bill").click()
    page.get_by_role("button", name="Share link").click()
    expect(page.locator(".toast")).to_contain_text("Link copied")
    link = page.evaluate("navigator.clipboard.readText()")
    assert "#b=1." in link, link
    page.evaluate("localStorage.clear()")
    page.goto("about:blank")
    page.goto(link)
    expect(page.get_by_label("Bill name")).to_have_value("Friday dinner at Lucia's")
    expect(page.locator(".toast")).to_contain_text("Opened a shared bill")
    assert page.evaluate("location.hash") == ""


def test_broken_link(page: Page, url: str) -> None:
    page.goto(url + "#b=1.broken!!")
    expect(page.locator(".toast")).to_contain_text("looks incomplete")


def test_remembers_bill(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_label("Bill name").fill("Brunch")
    page.reload()
    expect(page.get_by_label("Bill name")).to_have_value("Brunch")


def test_currency_without_cents(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_role("button", name="Try an example bill").click()
    page.get_by_label("Currency").select_option("JPY")
    # Yen has no minor unit: 24.00 becomes 24, with no decimals (the symbol depends on the locale).
    expect(page.get_by_label("Line total for Margherita pizza")).to_have_text(re.compile(r"^\D*24$"))


def test_keyboard_only_add_item(page: Page, url: str) -> None:
    page.goto(url)
    page.get_by_label("Add a person").fill("Ana")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="Add item").focus()
    page.keyboard.press("Enter")
    expect(page.get_by_label("Item 1 name")).to_be_focused()
    page.keyboard.type("Soup")
    page.get_by_label("Price").fill("9")
    page.get_by_label("Price").press("Enter")  # Enter in the last price adds another row
    expect(page.get_by_label("Item 2 name")).to_be_focused()


def test_mobile_no_sideways_scroll(page: Page, url: str) -> None:
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(url)
    page.get_by_role("button", name="Try an example bill").click()
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 0, f"page scrolls sideways by {overflow}px"
    expect(page.locator(".mobile-total")).to_be_visible()


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    server, url = serve(Path(sys.argv[1]))
    tests = [obj for name, obj in globals().items() if name.startswith("test_")]
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for test in tests:
            context = browser.new_context(
                locale="en-AU",
                timezone_id="Australia/Sydney",
                permissions=["clipboard-read", "clipboard-write"],
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            try:
                test(page, url)
                assert not errors, f"console errors: {errors}"
                print(f"ok   {test.__name__}")
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"FAIL {test.__name__}: {str(exc).splitlines()[0]}")
            finally:
                context.close()
        browser.close()
    server.shutdown()
    print(f"\n{len(tests) - failures} passed, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
