"""
Sprint 2 additions - forgot/reset password (US-01 adjacent) and the matching
Login <-> IT Admin login cross-links.

What this file CANNOT test end to end: actually completing a password reset.
The reset link is only ever delivered by real email (or the "DEV EMAIL"
backend console log when SMTP isn't configured) -- Selenium has no way to
read either from here. So this covers everything reachable purely through
the browser: the login page's forgot-password UI toggle, the generic
success message (which the backend deliberately returns identically whether
or not the account exists -- see auth.controller.ts), and the standalone
reset-password page's form validation with a token that can never be valid.
A real end-to-end reset (request link -> open it -> set new password -> log
in with it) has to stay a manual test case -- see the Manual Test Cases doc.

Run: python test_login_forgot_password.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, check_servers_are_up, new_driver,
    wait_visible, report, run_safely, element_exists,
)
from selenium.webdriver.common.by import By  # noqa: E402


def test_forgot_password_hides_password_field_and_login_button():
    """Clicking "Forgot Password?" should switch to request-a-link mode --
    no Password field, no Log in button, since neither makes sense once
    you've said you don't know your password."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email")
        driver.find_element(By.CSS_SELECTOR, "button.login-forgot").click()

        password_gone = not element_exists(driver, By.ID, "password")
        login_btn_gone = not element_exists(driver, By.CSS_SELECTOR, "button.login-button")
        send_btn = wait_visible(driver, By.CSS_SELECTOR, "button.login-forgot-send")
        cancel_btn = driver.find_element(By.CSS_SELECTOR, "button.login-forgot-cancel")

        ok = password_gone and login_btn_gone and send_btn.is_displayed() and cancel_btn.is_displayed()
        return report("test_forgot_password_hides_password_field_and_login_button", ok)
    finally:
        safe_quit(driver)


def test_forgot_password_cancel_restores_login_form():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email")
        driver.find_element(By.CSS_SELECTOR, "button.login-forgot").click()
        wait_visible(driver, By.CSS_SELECTOR, "button.login-forgot-cancel").click()

        password_back = wait_visible(driver, By.ID, "password")
        login_btn_back = driver.find_element(By.CSS_SELECTOR, "button.login-button")
        ok = password_back.is_displayed() and login_btn_back.is_displayed()
        return report("test_forgot_password_cancel_restores_login_form", ok)
    finally:
        safe_quit(driver)


def test_forgot_password_shows_generic_message_for_unknown_email():
    """Backend responds identically whether or not the account exists (so
    this endpoint can't be used to check who has an account) -- confirm the
    frontend just displays that message verbatim rather than inferring
    success/failure and showing something different."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        wait_visible(driver, By.ID, "email").send_keys("definitely-not-a-real-account@altrium.com")
        driver.find_element(By.CSS_SELECTOR, "button.login-forgot").click()
        wait_visible(driver, By.CSS_SELECTOR, "button.login-forgot-send").click()

        notice = wait_visible(driver, By.CSS_SELECTOR, ".login-forgot-notice", timeout=10)
        ok = "reset link has been sent" in notice.text.lower()
        return report("test_forgot_password_shows_generic_message_for_unknown_email", ok, notice.text)
    finally:
        safe_quit(driver)


def test_login_links_to_admin_login_and_back():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        link = wait_visible(driver, By.CSS_SELECTOR, ".login-footer a")
        ok = "admin" in link.get_attribute("href")
        link.click()

        back_link = wait_visible(driver, By.CSS_SELECTOR, ".login-footer a")
        subtitle = driver.find_element(By.CSS_SELECTOR, ".login-brand-subtitle")
        ok = ok and "IT Admin sign in" in subtitle.text and "login" in back_link.get_attribute("href")
        return report("test_login_links_to_admin_login_and_back", ok)
    finally:
        safe_quit(driver)


def test_show_hide_password_toggle_on_regular_login():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        pwd = wait_visible(driver, By.ID, "password")
        pwd.send_keys("whatever123")
        before = pwd.get_attribute("type")
        driver.find_element(By.CSS_SELECTOR, "button.login-toggle").click()
        after = driver.find_element(By.ID, "password").get_attribute("type")
        ok = before == "password" and after == "text"
        return report("test_show_hide_password_toggle_on_regular_login", ok, f"{before} -> {after}")
    finally:
        safe_quit(driver)


def test_show_hide_password_toggle_on_admin_login():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/admin")
        pwd = wait_visible(driver, By.ID, "password")
        pwd.send_keys("whatever123")
        before = pwd.get_attribute("type")
        driver.find_element(By.CSS_SELECTOR, "button.login-toggle").click()
        after = driver.find_element(By.ID, "password").get_attribute("type")
        ok = before == "password" and after == "text"
        return report("test_show_hide_password_toggle_on_admin_login", ok, f"{before} -> {after}")
    finally:
        safe_quit(driver)


def test_reset_password_page_rejects_invalid_token():
    """Can't get a real token here (see module docstring), but a token that
    is well-formed-looking and guaranteed not to exist should still take the
    user through the real form and come back with the real backend error,
    not a frontend crash."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/reset-password?token=selenium-test-token-that-does-not-exist")
        wait_visible(driver, By.ID, "new-password").send_keys("BrandNewPassword123")
        driver.find_element(By.ID, "confirm-password").send_keys("BrandNewPassword123")
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()

        error = wait_visible(driver, By.CSS_SELECTOR, ".login-alert", timeout=10)
        ok = "invalid" in error.text.lower() or "expired" in error.text.lower()
        return report("test_reset_password_page_rejects_invalid_token", ok, error.text)
    finally:
        safe_quit(driver)


def test_reset_password_page_validates_password_match_client_side():
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/reset-password?token=doesnt-matter-for-this-check")
        wait_visible(driver, By.ID, "new-password").send_keys("BrandNewPassword123")
        driver.find_element(By.ID, "confirm-password").send_keys("SomethingElse123")
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()

        error = wait_visible(driver, By.CSS_SELECTOR, ".login-alert", timeout=10)
        ok = "match" in error.text.lower()
        return report("test_reset_password_page_validates_password_match_client_side", ok, error.text)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_forgot_password_hides_password_field_and_login_button,
        test_forgot_password_cancel_restores_login_form,
        test_forgot_password_shows_generic_message_for_unknown_email,
        test_login_links_to_admin_login_and_back,
        test_show_hide_password_toggle_on_regular_login,
        test_show_hide_password_toggle_on_admin_login,
        test_reset_password_page_rejects_invalid_token,
        test_reset_password_page_validates_password_match_client_side,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
