"""
Modular scraper engine with BaseScraper + ServihabitatScraper implementation.
Uses Playwright + playwright-stealth with rate limiting and retry logic.
"""
import asyncio
import logging
import random
from abc import ABC, abstractmethod
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

CAPTCHA_SIGNALS = [
    "captcha", "robot", "verifica", "cloudflare", "access denied",
    "too many requests", "blocked"
]


class BaseScraper(ABC):
    """Abstract base for all portal scrapers."""

    portal_name: str = ""

    def __init__(self):
        self.results: list[dict] = []

    @abstractmethod
    async def search(self, filters: dict) -> list[dict]:
        """Run a search and return list of raw listing dicts."""
        ...

    @abstractmethod
    async def parse_listing(self, page, url: str) -> Optional[dict]:
        """Parse a single listing page and return dict or None."""
        ...

    async def _delay(self):
        delay = random.uniform(settings.scraper_min_delay, settings.scraper_max_delay)
        await asyncio.sleep(delay)

    def _is_blocked(self, content: str) -> bool:
        lower = content.lower()
        return any(signal in lower for signal in CAPTCHA_SIGNALS)

    async def _get_with_retry(self, page, url: str, max_retries: int = 3) -> Optional[str]:
        """Navigate to URL with exponential backoff retry. Returns page content or None."""
        for attempt in range(max_retries):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                content = await page.content()
                if self._is_blocked(content):
                    logger.warning("Blocked/captcha detected at %s, skipping", url)
                    return None
                return content
            except Exception as exc:
                wait = 2 ** attempt
                logger.warning("Attempt %d failed for %s: %s. Retrying in %ds", attempt + 1, url, exc, wait)
                await asyncio.sleep(wait)
        return None


class ServihabitatScraper(BaseScraper):
    """
    Scraper for Servihabitat portal (banco-backed, lower anti-bot protection).
    Searches for commercial properties (locales) in given province.
    """

    portal_name = "servihabitat"
    BASE_URL = "https://www.servihabitat.com"
    SEARCH_URL = "https://www.servihabitat.com/inmuebles/locales-comerciales/alquiler-venta"

    async def search(self, filters: dict) -> list[dict]:
        """
        filters: {"provincia": "Huelva", "max_pages": 5}
        Returns list of raw listing dicts.
        """
        from playwright.async_api import async_playwright
        from playwright_stealth import stealth_async

        provincia = filters.get("provincia", "Huelva")
        max_pages = filters.get("max_pages", 3)
        listings = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1366, "height": 768},
            )
            page = await context.new_page()
            await stealth_async(page)

            search_url = f"{self.SEARCH_URL}?provincia={provincia.lower()}"

            for page_num in range(1, max_pages + 1):
                url = f"{search_url}&pagina={page_num}"
                logger.info("Scraping %s page %d: %s", self.portal_name, page_num, url)

                content = await self._get_with_retry(page, url)
                if not content:
                    break

                page_listings = await self._extract_listing_urls(page)
                if not page_listings:
                    logger.info("No more listings on page %d", page_num)
                    break

                for listing_url in page_listings:
                    await self._delay()
                    full_url = listing_url if listing_url.startswith("http") else f"{self.BASE_URL}{listing_url}"
                    listing_page = await context.new_page()
                    await stealth_async(listing_page)
                    try:
                        result = await self.parse_listing(listing_page, full_url)
                        if result:
                            result["portal"] = self.portal_name
                            listings.append(result)
                    finally:
                        await listing_page.close()

            await browser.close()

        logger.info("Servihabitat scraped %d listings", len(listings))
        return listings

    async def _extract_listing_urls(self, page) -> list[str]:
        """Extract listing URLs from search results page."""
        try:
            links = await page.eval_on_selector_all(
                "a[href*='/inmuebles/']",
                "els => els.map(e => e.getAttribute('href'))"
            )
            return list(set(
                link for link in links
                if link and any(c.isdigit() for c in link) and "locales" in link.lower()
            ))
        except Exception as exc:
            logger.warning("Failed to extract listing URLs: %s", exc)
            return []

    async def parse_listing(self, page, url: str) -> Optional[dict]:
        """Parse a single Servihabitat listing page."""
        content = await self._get_with_retry(page, url)
        if not content:
            return None

        try:
            titulo = await self._safe_text(page, "h1.property-title, h1[class*='title']")
            precio_text = await self._safe_text(page, "[class*='price'], [class*='precio']")
            superficie_text = await self._safe_text(page, "[class*='surface'], [class*='superficie'], [data-label='Superficie']")
            descripcion = await self._safe_text(page, "[class*='description'], [class*='descripcion'], #property-description")
            direccion = await self._safe_text(page, "[class*='address'], [class*='direccion'], [class*='location']")
            imagen_url = await self._safe_attr(page, "img[class*='main'], img[class*='principal'], .property-image img", "src")

            precio = self._parse_number(precio_text)
            superficie = self._parse_number(superficie_text)

            if not titulo and not precio:
                return None

            return {
                "url_origen": url,
                "titulo": titulo,
                "precio": precio,
                "superficie_m2": superficie,
                "descripcion_raw": descripcion,
                "direccion": direccion,
                "imagen_url": imagen_url,
            }
        except Exception as exc:
            logger.warning("Failed to parse listing %s: %s", url, exc)
            return None

    async def _safe_text(self, page, selector: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            if el:
                return (await el.inner_text()).strip() or None
        except Exception:
            pass
        return None

    async def _safe_attr(self, page, selector: str, attr: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            if el:
                return await el.get_attribute(attr)
        except Exception:
            pass
        return None

    def _parse_number(self, text: Optional[str]) -> Optional[float]:
        if not text:
            return None
        import re
        digits = re.sub(r"[^\d,.]", "", text).replace(",", ".")
        try:
            return float(digits)
        except ValueError:
            return None


SCRAPERS = {
    "servihabitat": ServihabitatScraper,
}


def get_scraper(portal: str) -> BaseScraper:
    cls = SCRAPERS.get(portal)
    if not cls:
        raise ValueError(f"Unknown portal: {portal}. Available: {list(SCRAPERS.keys())}")
    return cls()
