"""
Shared helpers for the Altrium HR Selenium test suite.

Every test_*.py script in sprint1/ and sprint2/ imports from this module so
that login, waiting, and PASS/FAIL reporting are consistent across all of
them (same style as the test_login.py example used in the lecture).

Requirements (see ../requirements.txt):
    pip install selenium

You also need Chrome + a matching chromedriver on PATH (Selenium 4.6+ can
usually fetch the driver automatically via Selenium Manager).

Before running ANY script, both servers must already be running:
    backend:  cd backend  && npm run dev   (http://localhost:4000)
    frontend: cd frontend && npm run dev   (http://localhost:5173)

Every script calls check_servers_are_up() first and will refuse to run
(with a clear message) if either server is down, rather than producing a
wall of confusing element-not-found failures.
"""

import os
import time
import traceback
import urllib.request

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "http://localhost:5173"
API_HEALTH_URL = "http://localhost:4000/api/health"
DEFAULT_TIMEOUT = 15          # seconds, for explicit waits (some flows chain several API calls)
PAUSE_SECONDS = 1.5           # short pause after each test so it's easy to watch run

# Seeded demo accounts (backend/prisma/seed.ts). Password is the same for all.
PASSWORD = "password123"
ACCOUNTS = {
    "HR": "hr@altrium.com",
    "INTERVIEWER": "interviewer@altrium.com",
    "MANAGEMENT": "management@altrium.com",
    "HIRING_MANAGER": "hiringmanager@altrium.com",
    "IT_ADMIN": "itadmin@altrium.com",
    "LEADERSHIP_MANAGEMENT": "leadership@altrium.com",
    "DISABLED": "disabled@altrium.com",  # isActive: false, for negative tests
}

# These are the URL each role actually SETTLES on after login, not
# necessarily the path Login.tsx's own ROLE_ROUTES navigates to first.
# "/leadership-management/dashboard" and "/interviewer/dashboard" are both
# pure <Navigate replace> redirect stubs in App.tsx -- the browser passes
# through them and lands on recruitment-overview / interviews respectively,
# often too fast for WebDriverWait's polling to ever observe the transient
# stub URL. Waiting on the stub path times out; waiting on the real landing
# path (as done here) is what the app actually shows.
ROLE_LANDING_PATH = {
    "HR": "/hr/vacancies",
    "HIRING_MANAGER": "/hiring-manager/dashboard",
    "MANAGEMENT": "/management/dashboard",
    "LEADERSHIP_MANAGEMENT": "/leadership-management/recruitment-overview",
    "INTERVIEWER": "/interviewer/interviews",
}

# Each role layout has its own logout button class.
LOGOUT_SELECTOR = {
    "HR": "button.hr-logout",
    "HIRING_MANAGER": "button.hm-logout",
    "MANAGEMENT": "button.mg-logout",
    "LEADERSHIP_MANAGEMENT": "button.ld-logout",
    "INTERVIEWER": "button.ivr-logout",
    "IT_ADMIN": "button.admin-logout",
}

GENERIC_LOGIN_ERROR = "Invalid email or password"
EMPTY_FIELDS_ERROR = "Email and password are required."


# ---------------------------------------------------------------------------
# Server / driver setup
# ---------------------------------------------------------------------------

def check_servers_are_up():
    """Ping backend + frontend before running any test. Raises if either is down."""
    try:
        urllib.request.urlopen(API_HEALTH_URL, timeout=5)
    except Exception as e:
        raise RuntimeError(
            f"Backend is not reachable at {API_HEALTH_URL}.\n"
            f"Start it first: cd backend && npm run dev\n({e})"
        )
    try:
        urllib.request.urlopen(BASE_URL, timeout=5)
    except Exception as e:
        raise RuntimeError(
            f"Frontend is not reachable at {BASE_URL}.\n"
            f"Start it first: cd frontend && npm run dev\n({e})"
        )
    print("Servers are up. Starting tests...\n")


def new_driver(retries=3):
    """
    Launches a fresh Chrome session. Retries on WebDriverException, because
    starting a new Chrome process immediately after a previous one closed
    (or crashed) is occasionally flaky on Windows -- antivirus scanning the
    freshly-written chromedriver.exe, or the OS not having released the
    previous process's resources yet. A real assertion failure never comes
    from this function, so retrying here can't hide a real bug -- it only
    absorbs environment noise before the actual test logic even starts.
    """
    last_err = None
    for attempt in range(retries):
        try:
            options = webdriver.ChromeOptions()
            options.add_argument("--start-maximized")
            # Stability flags commonly needed on Windows when launching many
            # headed Chrome instances back-to-back in one process -- GPU
            # process churn and background throttling are frequent causes of
            # chromedriver becoming unresponsive after several launches.
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-extensions")
            options.add_argument("--disable-background-timer-throttling")
            options.add_argument("--disable-backgrounding-occluded-windows")
            options.add_argument("--disable-renderer-backgrounding")
            # Capture browser-side console output (console.log/warn/error and
            # uncaught JS exceptions) so failures can be cross-checked against
            # what the page itself reported, not just what Selenium observed
            # from the outside.
            options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
            driver = webdriver.Chrome(options=options)
            driver.get("about:blank")  # confirms the session is actually alive
            return driver
        except WebDriverException as e:
            last_err = e
            time.sleep(3)
    raise last_err


DEBUG_DIR = os.path.join(os.path.dirname(__file__), "debug")


def debug_dump(driver, name):
    """
    Saves a screenshot + the live page HTML to debug/<name>.png / .html.

    Call this right before re-raising an exception from a wait that failed
    for an unclear reason -- when a failure can't be reproduced without a
    real browser, a screenshot of exactly what was on screen at the moment
    of timeout is far more useful than another guess at the selector.
    """
    os.makedirs(DEBUG_DIR, exist_ok=True)
    try:
        driver.save_screenshot(os.path.join(DEBUG_DIR, f"{name}.png"))
        with open(os.path.join(DEBUG_DIR, f"{name}.html"), "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print(f"    (saved debug/{name}.png and debug/{name}.html)")
    except Exception:
        pass


def safe_quit(driver):
    """quit() that won't raise if the session already died mid-test -- a
    crashed browser shouldn't also break the `finally: safe_quit(driver)`
    cleanup line in every test function."""
    try:
        driver.quit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Wait shortcuts
# ---------------------------------------------------------------------------

def wait_visible(driver, by, value, timeout=DEFAULT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def wait_present(driver, by, value, timeout=DEFAULT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))


def wait_clickable(driver, by, value, timeout=DEFAULT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))


def wait_url_contains(driver, fragment, timeout=DEFAULT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(EC.url_contains(fragment))


def wait_text_in(driver, by, value, text, timeout=DEFAULT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(EC.text_to_be_present_in_element((by, value), text))


def scroll_into_view(driver, el):
    """
    Scrolls an element into view via JavaScript rather than relying on
    chromedriver's own native "scroll into view" step before a click/send_keys.
    Elements inside a scrollable container that itself sits inside a
    scrollable page (e.g. a modal with its own overflow-y: auto, like this
    app's .vac-modal) are a known trigger for chromedriver's native scroll
    heuristic to hang or misbehave -- doing it with plain JS sidesteps that
    entirely.
    """
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)


def type_text(driver, by, value, text, retries=2):
    """
    send_keys() that verifies the text actually landed before moving on.

    Scrolls the element into view via JS first (see scroll_into_view) before
    interacting with it, then re-fetches, clears, types, and checks
    get_attribute("value") actually matches what was sent; if not, retries
    from scratch. On a controlled React input, send_keys() issued immediately
    after an action that triggers a re-render can also occasionally lose
    keystrokes -- the retry absorbs that case too.
    """
    last_actual = None
    for attempt in range(retries):
        el = wait_visible(driver, by, value)
        scroll_into_view(driver, el)
        el.clear()
        el.send_keys(text)
        actual = el.get_attribute("value")
        if actual == text:
            return el
        last_actual = actual
        time.sleep(0.5)

    # Diagnostic: get ground truth from the live DOM instead of guessing.
    # Checks readOnly/disabled directly, and whether some other element is
    # actually sitting on top of this one at its own coordinates (which
    # would silently eat real clicks/keystrokes without Selenium raising).
    try:
        info = driver.execute_script(
            """
            const el = arguments[0];
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const topEl = document.elementFromPoint(cx, cy);
            return {
                tagName: el.tagName,
                readOnly: el.readOnly,
                disabled: el.disabled,
                rect: [rect.left, rect.top, rect.width, rect.height],
                topElementTag: topEl ? topEl.tagName : null,
                topElementClass: topEl ? topEl.className : null,
                isSameElement: topEl === el,
                outerHTML: el.outerHTML.slice(0, 300),
            };
            """,
            el,
        )
        print(f"    (type_text diagnostic for {value!r}: {info})")
    except Exception as diag_err:
        print(f"    (type_text diagnostic failed: {diag_err})")

    dump_console_log(driver, label=f"type_text failure on {value!r}")

    raise AssertionError(
        f"type_text: after {retries} attempts, field {by}={value!r} holds {last_actual!r}, expected {text!r}"
    )


def dump_console_log(driver, label=""):
    """
    Prints any browser-side console output (console.log/warn/error, uncaught
    exceptions) captured since the last call. Requires new_driver()'s
    goog:loggingPrefs capability. Used to get ground truth on whether a JS
    error is actually happening in the page during a failure, rather than
    inferring it from DOM state alone.
    """
    try:
        entries = driver.get_log("browser")
    except Exception as e:
        print(f"    (console log unavailable: {e})")
        return
    if not entries:
        print(f"    (console log{f' [{label}]' if label else ''}: empty -- no browser-side errors/warnings)")
        return
    print(f"    (console log{f' [{label}]' if label else ''}: {len(entries)} entries)")
    for entry in entries:
        level = entry.get("level", "?")
        message = entry.get("message", "")
        print(f"      [{level}] {message}")


def element_exists(driver, by, value):
    try:
        driver.find_element(by, value)
        return True
    except NoSuchElementException:
        return False


# ---------------------------------------------------------------------------
# Login / logout
# ---------------------------------------------------------------------------

def login_as(driver, email, password=PASSWORD, admin=False, expect_success=True, role=None):
    """
    Logs in via /login (or /admin for IT Admin) and, if expect_success, waits
    for the redirect to that role's landing page.
    """
    driver.get(f"{BASE_URL}{'/admin' if admin else '/login'}")
    wait_visible(driver, By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
    if expect_success and role:
        wait_url_contains(driver, ROLE_LANDING_PATH[role])


def logout_as(driver, role):
    try:
        driver.find_element(By.CSS_SELECTOR, LOGOUT_SELECTOR[role]).click()
        wait_url_contains(driver, "/login")
    except NoSuchElementException:
        pass


# ---------------------------------------------------------------------------
# Reporting (matches the PASS/FAIL console style used in test_login.py)
# ---------------------------------------------------------------------------

def report(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}" + (f" -- {detail}" if detail else ""))
    time.sleep(PAUSE_SECONDS)
    return passed


FIXTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures"))


def make_test_pdf(filename, lines):
    """
    Writes a minimal, valid single-page PDF into fixtures/<filename> with each
    string in `lines` printed on its own line, and returns the absolute path.

    Selenium's send_keys() on a file <input> needs a real file on disk, and we
    don't want to depend on an external PDF library just to build a CV fixture
    for the upload tests -- so this hand-builds the PDF byte-for-byte
    (including a correct xref table) instead.
    """
    os.makedirs(FIXTURES_DIR, exist_ok=True)
    path = os.path.join(FIXTURES_DIR, filename)

    content_lines = []
    y = 700
    for line in lines:
        escaped = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        content_lines.append(f"BT /F1 12 Tf 50 {y} Td ({escaped}) Tj ET")
        y -= 20
    content_stream = "\n".join(content_lines).encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content_stream)).encode() + b" >>\nstream\n" + content_stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray()
    out += b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_offset = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += b"trailer\n"
    out += f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode()
    out += b"startxref\n"
    out += f"{xref_offset}\n".encode()
    out += b"%%EOF"

    with open(path, "wb") as f:
        f.write(out)
    return path


def run_safely(name, fn, retry_on_crash=True):
    """
    Wraps a test_* function so one crashing test doesn't kill the whole file.

    TimeoutException, NoSuchElementException, and WebDriverException all get
    one automatic retry -- on this environment, a "TimeoutException" often
    turns out to be chromedriver itself stalling under repeated rapid Chrome
    launches (visible as a native chromedriver stacktrace attached to the
    Python exception), not a real "the app didn't render this" failure. This
    retry can't hide a real bug: if the selector/assumption is actually
    wrong, the retry fails too and it's still reported as FAIL, just one
    attempt later. AssertionError (an expected value that didn't match) is
    NOT retried -- the app will return the same wrong value on a second try,
    so retrying it would only slow down reporting a real mismatch.
    """
    try:
        return fn()
    except AssertionError as e:
        print(f"    (raised from: {_last_frame(e)})")
        return report(name, False, f"{type(e).__name__}: {e}")
    except (TimeoutException, NoSuchElementException, WebDriverException) as e:
        print(f"    (raised from: {_last_frame(e)})")
        if retry_on_crash:
            print(f"    ({type(e).__name__} on {name}, retrying once)")
            time.sleep(2)
            return run_safely(name, fn, retry_on_crash=False)
        return report(name, False, f"{type(e).__name__}: {e}")
    except Exception as e:  # noqa: BLE001 - test scripts intentionally broad here
        print(f"    (raised from: {_last_frame(e)})")
        return report(name, False, f"Unexpected error: {type(e).__name__}: {e}")


def _last_frame(exc):
    """Returns the file:line of the last frame in exc's traceback that's
    inside a test_*.py file -- i.e. which line of YOUR test code the error
    actually came from, cutting through Selenium's internal call stack and
    the verbose chromedriver-side stacktrace text."""
    tb = traceback.extract_tb(exc.__traceback__)
    test_frames = [f for f in tb if os.path.basename(f.filename).startswith("test_")]
    frame = test_frames[-1] if test_frames else (tb[-1] if tb else None)
    if not frame:
        return "unknown"
    return f"{os.path.basename(frame.filename)}:{frame.lineno} -- {frame.line}"
