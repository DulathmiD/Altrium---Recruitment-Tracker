"""
Sprint 2 - IT Admin creates a user with a temporary password; that user is
forced to change it before reaching any other route, and is NOT forced again
on a later login.

Covers gaps from Selenium_Automation_Coverage_Gaps.md, "IT Admin" section
(forced-password-change rows only -- System Monitoring KPI styling, Active
Users timestamps, and the Backups table are not covered here since they
weren't grounded against real source in this pass).

NOTE: written from reading the actual current source (ChangePasswordPage.tsx,
ProtectedRoute.tsx's `user.mustChangePassword` check, and the existing
test_it_admin_users.py create-user flow) so selectors match what's really
rendered. Not yet executed against a live server -- run it and fix whatever
Selenium actually finds before trusting the PASS/FAIL output.

Run: python test_forced_password_change.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit, debug_dump,
    BASE_URL, ACCOUNTS, ACCOUNT_PASSWORDS, check_servers_are_up, new_driver,
    login_as, logout_as, wait_visible, wait_url_contains, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402

IT_ADMIN_PASSWORD = ACCOUNT_PASSWORDS[ACCOUNTS["IT_ADMIN"]]
TEMP_PASSWORD = "password123"
NEW_PASSWORD = "SeleniumNew@2026"


def _create_user(driver, email):
    login_as(driver, ACCOUNTS["IT_ADMIN"], admin=True)
    wait_visible(driver, By.CSS_SELECTOR, ".usr-title")
    driver.get(f"{BASE_URL}/admin/users")
    wait_visible(driver, By.CSS_SELECTOR, "button.usr-create-btn").click()
    wait_visible(driver, By.ID, "pwc-password").send_keys(IT_ADMIN_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button.pwc-confirm-btn").click()

    wait_visible(driver, By.ID, "cru-name").send_keys("Selenium Forced Change")
    driver.find_element(By.ID, "cru-phone").send_keys("0771234999")
    driver.find_element(By.ID, "cru-email").send_keys(email)
    Select(driver.find_element(By.ID, "cru-role")).select_by_visible_text("Interviewer")
    driver.find_element(By.ID, "cru-department").send_keys("IT")
    driver.find_element(By.ID, "cru-password").send_keys(TEMP_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button.cru-primary-btn").click()
    wait_visible(driver, By.ID, "pwc-password").send_keys(IT_ADMIN_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button.pwc-confirm-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".cru-success-title", timeout=8)
    logout_as(driver, "IT_ADMIN")


def test_new_user_redirected_to_change_password_on_first_login():
    driver = new_driver()
    email = f"selenium.forced.{int(time.time())}@altrium.com"
    try:
        _create_user(driver, email)

        login_as(driver, email, password=TEMP_PASSWORD, expect_success=False)
        wait_url_contains(driver, "/change-password", timeout=10)
        form_visible = wait_visible(driver, By.ID, "current-password").is_displayed()
        ok = "/change-password" in driver.current_url and form_visible
        return report("test_new_user_redirected_to_change_password_on_first_login", ok, driver.current_url)
    except Exception:
        debug_dump(driver, "test_new_user_redirected_to_change_password_on_first_login")
        raise
    finally:
        safe_quit(driver)


def test_no_forced_redirect_after_password_changed():
    driver = new_driver()
    email = f"selenium.forced2.{int(time.time())}@altrium.com"
    try:
        _create_user(driver, email)

        login_as(driver, email, password=TEMP_PASSWORD, expect_success=False)
        wait_url_contains(driver, "/change-password", timeout=10)
        driver.find_element(By.ID, "current-password").send_keys(TEMP_PASSWORD)
        driver.find_element(By.ID, "new-password").send_keys(NEW_PASSWORD)
        driver.find_element(By.ID, "confirm-password").send_keys(NEW_PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
        # ChangePasswordPage logs the user out and sends them back to /login
        # on success.
        wait_url_contains(driver, "/login", timeout=10)

        # Log back in with the NEW password -- this account is an
        # Interviewer, so a normal (non-redirected) login lands on
        # /interviewer/interviews.
        login_as(driver, email, password=NEW_PASSWORD, role="INTERVIEWER")
        ok = "/change-password" not in driver.current_url and "/interviewer/interviews" in driver.current_url
        return report("test_no_forced_redirect_after_password_changed", ok, driver.current_url)
    except Exception:
        debug_dump(driver, "test_no_forced_redirect_after_password_changed")
        raise
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_new_user_redirected_to_change_password_on_first_login,
        test_no_forced_redirect_after_password_changed,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
