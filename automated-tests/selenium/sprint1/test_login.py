"""
Sprint 1 - Login (all roles)
Covers: US-01 login, role-based redirect, validation, disabled account,
IT Admin's separate /admin login route.

Run: python test_login.py
(servers must already be running -- see helpers.py)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, ACCOUNTS, PASSWORD, GENERIC_LOGIN_ERROR, EMPTY_FIELDS_ERROR,
    ROLE_LANDING_PATH, check_servers_are_up, new_driver, wait_visible,
    wait_url_contains, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402


def test_valid_login_hr():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["HR"])
        driver.find_element(By.ID, "password").send_keys(PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        wait_url_contains(driver, ROLE_LANDING_PATH["HR"])
        ok = ROLE_LANDING_PATH["HR"] in driver.current_url
        return report("test_valid_login_hr", ok, driver.current_url)
    finally:
        safe_quit(driver)


def test_valid_login_all_roles_redirect_correctly():
    """
    One fresh browser per role rather than reusing a single session across
    5 logins in a loop -- besides matching every other test's pattern, it
    avoids a stale auth token from the previous role's login still being in
    localStorage when the next role's login page loads, and isolates a
    browser crash to one role instead of losing the whole test.
    """
    all_ok = True
    for role, path in ROLE_LANDING_PATH.items():
        driver = new_driver()
        try:
            driver.get(f"{BASE_URL}/login")
            wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS[role])
            driver.find_element(By.ID, "password").send_keys(PASSWORD)
            driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
            wait_url_contains(driver, path)
            ok = path in driver.current_url
            if not ok:
                all_ok = False
            print(f"    {role} -> {driver.current_url} ({'ok' if ok else 'WRONG'})")
        finally:
            safe_quit(driver)
    return report("test_valid_login_all_roles_redirect_correctly", all_ok)


def test_invalid_password_shows_generic_error():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["HR"])
        driver.find_element(By.ID, "password").send_keys("wrong-password")
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        alert = wait_visible(driver, By.CSS_SELECTOR, ".login-alert")
        ok = alert.text.strip() == GENERIC_LOGIN_ERROR
        return report("test_invalid_password_shows_generic_error", ok, alert.text)
    finally:
        safe_quit(driver)


def test_empty_fields_shows_required_error():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email")
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        alert = wait_visible(driver, By.CSS_SELECTOR, ".login-alert")
        ok = alert.text.strip() == EMPTY_FIELDS_ERROR
        return report("test_empty_fields_shows_required_error", ok, alert.text)
    finally:
        safe_quit(driver)


def test_disabled_account_shows_generic_error_not_a_hint():
    """Priya Fernando (disabled@altrium.com) has isActive=false. The app must
    show the same generic message as a wrong password -- not "account disabled"
    -- so a caller can't use the error to enumerate which accounts exist."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["DISABLED"])
        driver.find_element(By.ID, "password").send_keys(PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        alert = wait_visible(driver, By.CSS_SELECTOR, ".login-alert")
        ok = alert.text.strip() == GENERIC_LOGIN_ERROR
        return report("test_disabled_account_shows_generic_error_not_a_hint", ok, alert.text)
    finally:
        safe_quit(driver)


def test_it_admin_cannot_use_regular_login():
    """IT_ADMIN must sign in via /admin, not /login -- regular login should
    reject it with the same generic error (anti-enumeration)."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["IT_ADMIN"])
        driver.find_element(By.ID, "password").send_keys(PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        alert = wait_visible(driver, By.CSS_SELECTOR, ".login-alert")
        ok = alert.text.strip() == GENERIC_LOGIN_ERROR
        return report("test_it_admin_cannot_use_regular_login", ok, alert.text)
    finally:
        safe_quit(driver)


def test_it_admin_login_via_admin_route():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/admin")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["IT_ADMIN"])
        driver.find_element(By.ID, "password").send_keys(PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        wait_url_contains(driver, "/admin/users")
        ok = "/admin/users" in driver.current_url
        return report("test_it_admin_login_via_admin_route", ok, driver.current_url)
    finally:
        safe_quit(driver)


def test_non_admin_rejected_at_admin_route():
    """A regular HR account must not be able to sign in via /admin."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/admin")
        wait_visible(driver, By.ID, "email").send_keys(ACCOUNTS["HR"])
        driver.find_element(By.ID, "password").send_keys(PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        alert = wait_visible(driver, By.CSS_SELECTOR, ".login-alert")
        ok = alert.text.strip() == GENERIC_LOGIN_ERROR
        return report("test_non_admin_rejected_at_admin_route", ok, alert.text)
    finally:
        safe_quit(driver)


def test_forgot_password_shows_notice():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.CSS_SELECTOR, "button.login-forgot").click()
        notice = wait_visible(driver, By.CSS_SELECTOR, ".login-forgot-notice")
        ok = "IT Administrator" in notice.text
        return report("test_forgot_password_shows_notice", ok, notice.text)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_valid_login_hr,
        test_valid_login_all_roles_redirect_correctly,
        test_invalid_password_shows_generic_error,
        test_empty_fields_shows_required_error,
        test_disabled_account_shows_generic_error_not_a_hint,
        test_it_admin_cannot_use_regular_login,
        test_it_admin_login_via_admin_route,
        test_non_admin_rejected_at_admin_route,
        test_forgot_password_shows_notice,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
