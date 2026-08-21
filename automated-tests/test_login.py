"""
Automated UI tests for US-01 (Secure login), Recruitment Tracker.

Requirements before running:
  1. Backend running:  cd backend  && npm run dev   (http://localhost:4000)
  2. Frontend running: cd frontend && npm run dev   (http://localhost:5173)
  3. pip install selenium --break-system-packages
     (Selenium 4.6+ auto-downloads the right chromedriver, as long as
     Google Chrome itself is installed on this machine.)

Run with:  python test_login.py
"""

import sys
import time
import urllib.request
import urllib.error
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

BASE_URL = "http://localhost:5173/login"


def check_servers_are_up():
    """Ping backend + frontend before opening any browser, so a down server
    fails with a clear message instead of a confusing Selenium stack trace."""
    problems = []
    try:
        urllib.request.urlopen("http://localhost:4000/api/health", timeout=3)
    except (urllib.error.URLError, ConnectionError):
        problems.append("Backend is NOT reachable at http://localhost:4000 -- start it: cd backend && npm run dev")
    try:
        urllib.request.urlopen("http://localhost:5173", timeout=3)
    except (urllib.error.URLError, ConnectionError):
        problems.append("Frontend is NOT reachable at http://localhost:5173 -- start it: cd frontend && npm run dev")

    if problems:
        print("\nCan't run tests -- fix this first:\n")
        for p in problems:
            print(f"  - {p}")
        print()
        sys.exit(1)
    print("Backend and frontend are both up. Starting tests...\n")

# How many seconds to leave the browser window open after each test so you
# can actually see the result before it closes. Change this one number to
# slow everything down or speed it back up.
PAUSE_SECONDS = 30


def new_driver():
    driver = webdriver.Chrome()
    driver.maximize_window()
    return driver


def login(driver, email, password):
    driver.get(BASE_URL)
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "email")))
    driver.find_element(By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button.login-button").click()


def wait_for_url_contains(driver, fragment, timeout=5):
    try:
        WebDriverWait(driver, timeout).until(EC.url_contains(fragment))
        return True
    except TimeoutException:
        return False


def get_error_text(driver, timeout=5):
    try:
        el = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".login-alert"))
        )
        return el.text
    except TimeoutException:
        return None


def report(name, passed, detail=""):
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] {name}" + (f" -- {detail}" if detail else ""))


def test_valid_login_hr():
    driver = new_driver()
    try:
        login(driver, "hr@altrium.test", "password123")
        ok = wait_for_url_contains(driver, "/hr/vacancies")
        report("US-01.1 valid HR login -> redirected to /hr/vacancies", ok, driver.current_url)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_valid_login_interviewer_redirect():
    driver = new_driver()
    try:
        login(driver, "interviewer@altrium.test", "password123")
        ok = wait_for_url_contains(driver, "/interviewer/dashboard")
        report("US-01.2 valid Interviewer login -> redirected to /interviewer/dashboard", ok, driver.current_url)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_wrong_password():
    driver = new_driver()
    try:
        login(driver, "hr@altrium.test", "totallyWrongPassword")
        error = get_error_text(driver)
        ok = error is not None and "invalid" in error.lower()
        report("US-01.3 wrong password -> shows invalid credentials error", ok, error)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_empty_fields():
    driver = new_driver()
    try:
        login(driver, "", "")
        error = get_error_text(driver)
        ok = error is not None and "required" in error.lower()
        report("US-01.4 empty email/password -> shows required-fields error", ok, error)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_disabled_account():
    driver = new_driver()
    try:
        login(driver, "disabled@altrium.test", "password123")
        error = get_error_text(driver)
        ok = error is not None and "invalid" in error.lower()
        report("US-01.5 disabled account -> shows invalid credentials error (not 'account disabled')", ok, error)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_it_admin_blocked_from_regular_login():
    driver = new_driver()
    try:
        login(driver, "itadmin@altrium.test", "password123")
        error = get_error_text(driver)
        ok = error is not None and "invalid" in error.lower()
        report("US-01.6 IT Admin via regular login -> rejected", ok, error)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


if __name__ == "__main__":
    check_servers_are_up()
    test_valid_login_hr()
    test_valid_login_interviewer_redirect()
    test_wrong_password()
    test_empty_fields()
    test_disabled_account()
    test_it_admin_blocked_from_regular_login()
