"""Regenerate docs/screenshots from a built copy of the app.

    npm run build && python scripts/screenshots.py dist
"""

from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "e2e"))
from smoke import serve  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "docs" / "screenshots"


def main() -> None:
    build = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
    OUT.mkdir(parents=True, exist_ok=True)
    server, url = serve(build)
    with sync_playwright() as p:
        browser = p.chromium.launch()

        def page_for(width: int, height: int, scheme: str = "light"):
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
                color_scheme=scheme,
                locale="en-AU",
                timezone_id="Australia/Sydney",
                is_mobile=width < 600,
            )
            page = context.new_page()
            page.goto(url)
            page.get_by_role("button", name="Try an example bill").click()
            page.get_by_label("Total printed on the receipt").fill("174.49")
            page.locator(".totals details").first.evaluate("d => d.open = true")
            page.locator(".toast-region").evaluate("el => el.replaceChildren()")
            page.evaluate("window.scrollTo(0, 0)")
            return context, page

        context, page = page_for(1360, 1000)
        page.screenshot(path=OUT / "split-desktop.png", full_page=True)
        page.locator("#check").screenshot(path=OUT / "guest-check.png")
        context.close()

        context, page = page_for(1360, 1000, "dark")
        page.screenshot(path=OUT / "split-dark.png")
        context.close()

        context, page = page_for(390, 844)
        page.locator(".items").scroll_into_view_if_needed()
        page.screenshot(path=OUT / "split-mobile.png")
        context.close()
        browser.close()
    server.shutdown()
    for f in sorted(OUT.glob("*.png")):
        print(f.relative_to(OUT.parent.parent))


if __name__ == "__main__":
    main()
