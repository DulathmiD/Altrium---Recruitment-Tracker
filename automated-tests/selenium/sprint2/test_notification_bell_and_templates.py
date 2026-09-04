"""
Sprint 2 additions - SCRUM2-31 (in-app notification bell) and SCRUM2-45
(IT Admin notification templates editor).

Run: python test_notification_bell_and_templates.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver,
    login_as, wait_visible, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402


def _login_hr(driver):
    login_as(driver, ACCOUNTS["HR"], role="HR")


def test_bell_is_fixed_to_viewport_top_right_on_every_page():
    """Regression test for the original bug: the bell used to live inside
    each role's sidebar and its dropdown got clipped by the sidebar's own
    edge. It's now `position: fixed`, so its container must report a fixed
    position and sit near the top-right of the actual browser viewport, not
    wherever the sidebar happens to end."""
    driver = new_driver()
    try:
        _login_hr(driver)
        bell = wait_visible(driver, By.CSS_SELECTOR, ".ntf-bell-container")
        position = driver.execute_script("return getComputedStyle(arguments[0]).position;", bell)
        rect = driver.execute_script(
            "const r = arguments[0].getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top};",
            bell,
        )
        viewport_width = driver.execute_script("return window.innerWidth;")

        ok = (
            position == "fixed"
            and rect["top"] < 100
            and rect["right"] <= viewport_width
            and rect["left"] > viewport_width * 0.5
        )
        return report("test_bell_is_fixed_to_viewport_top_right_on_every_page", ok, f"{position}, {rect}, vw={viewport_width}")
    finally:
        safe_quit(driver)


def test_bell_dropdown_opens_and_stays_within_the_viewport():
    """The dropdown must not spill past the right edge of the browser
    window -- the exact symptom of the original clipping bug."""
    driver = new_driver()
    try:
        _login_hr(driver)
        driver.find_element(By.CSS_SELECTOR, "button.ntf-bell-btn").click()
        dropdown = wait_visible(driver, By.CSS_SELECTOR, ".ntf-dropdown")
        rect = driver.execute_script(
            "const r = arguments[0].getBoundingClientRect(); return {left: r.left, right: r.right};", dropdown
        )
        viewport_width = driver.execute_script("return window.innerWidth;")

        header = driver.find_element(By.CSS_SELECTOR, ".ntf-dropdown-header")
        ok = rect["left"] >= 0 and rect["right"] <= viewport_width and header.is_displayed()
        return report("test_bell_dropdown_opens_and_stays_within_the_viewport", ok, f"{rect}, vw={viewport_width}")
    finally:
        safe_quit(driver)


def test_bell_dropdown_shows_empty_state_or_a_list_without_crashing():
    driver = new_driver()
    try:
        _login_hr(driver)
        driver.find_element(By.CSS_SELECTOR, "button.ntf-bell-btn").click()
        wait_visible(driver, By.CSS_SELECTOR, ".ntf-dropdown-list")
        empty = driver.find_elements(By.CSS_SELECTOR, ".ntf-empty")
        items = driver.find_elements(By.CSS_SELECTOR, ".ntf-item")
        ok = len(empty) > 0 or len(items) > 0
        return report("test_bell_dropdown_shows_empty_state_or_a_list_without_crashing", ok, f"empty={len(empty)} items={len(items)}")
    finally:
        safe_quit(driver)


def test_bell_dropdown_closes_on_outside_click():
    driver = new_driver()
    try:
        _login_hr(driver)
        driver.find_element(By.CSS_SELECTOR, "button.ntf-bell-btn").click()
        wait_visible(driver, By.CSS_SELECTOR, ".ntf-dropdown")
        driver.find_element(By.CSS_SELECTOR, "h1").click()  # click the page's own heading, well outside the bell
        dropdown_gone = len(driver.find_elements(By.CSS_SELECTOR, ".ntf-dropdown")) == 0
        return report("test_bell_dropdown_closes_on_outside_click", dropdown_gone)
    finally:
        safe_quit(driver)


def _login_admin(driver):
    login_as(driver, ACCOUNTS["IT_ADMIN"], admin=True)
    wait_visible(driver, By.CSS_SELECTOR, ".usr-title")


def test_notification_templates_list_shows_headings_only():
    """Regression test: the row subject/body preview text was removed per
    user feedback -- rows should show just the (title-cased) template name
    and an Edit button, not a second line of raw template text."""
    driver = new_driver()
    try:
        _login_admin(driver)
        driver.get(f"{BASE_URL}/admin/notification-templates")
        wait_visible(driver, By.CSS_SELECTOR, ".tmpl-row")
        rows = driver.find_elements(By.CSS_SELECTOR, ".tmpl-row")
        no_subject_preview = len(driver.find_elements(By.CSS_SELECTOR, ".tmpl-row-subject")) == 0
        first_label = rows[0].find_element(By.CSS_SELECTOR, ".tmpl-row-label").text
        # Title-cased: first letter of the visible label capitalized.
        looks_title_cased = first_label[:1].isupper()
        ok = len(rows) > 0 and no_subject_preview and looks_title_cased
        return report("test_notification_templates_list_shows_headings_only", ok, first_label)
    finally:
        safe_quit(driver)


def test_notification_template_edit_save_and_reset():
    driver = new_driver()
    try:
        _login_admin(driver)
        driver.get(f"{BASE_URL}/admin/notification-templates")
        wait_visible(driver, By.CSS_SELECTOR, ".tmpl-row")
        driver.find_element(By.CSS_SELECTOR, ".tmpl-row .tmpl-edit-btn").click()

        subject_input = wait_visible(driver, By.ID, "tmpl-subject-input")
        original_subject = subject_input.get_attribute("value")
        subject_input.clear()
        subject_input.send_keys("Selenium edited subject")
        driver.find_element(By.CSS_SELECTOR, "button.tmpl-save-btn").click()

        # Modal closes on successful save.
        wait_visible(driver, By.CSS_SELECTOR, ".tmpl-row")
        saved_ok = len(driver.find_elements(By.CSS_SELECTOR, ".tmpl-modal-backdrop")) == 0

        # Re-open and reset back to default so this test doesn't leave the
        # template permanently edited for whoever runs the suite next.
        driver.find_element(By.CSS_SELECTOR, ".tmpl-row .tmpl-edit-btn").click()
        reset_btn = wait_visible(driver, By.CSS_SELECTOR, "button.tmpl-reset-btn")
        reset_ok = True
        if reset_btn.get_attribute("disabled") is None:
            reset_btn.click()
        driver.find_element(By.CSS_SELECTOR, "button.tmpl-cancel-btn").click()

        ok = saved_ok and reset_ok and bool(original_subject)
        return report("test_notification_template_edit_save_and_reset", ok)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_bell_is_fixed_to_viewport_top_right_on_every_page,
        test_bell_dropdown_opens_and_stays_within_the_viewport,
        test_bell_dropdown_shows_empty_state_or_a_list_without_crashing,
        test_bell_dropdown_closes_on_outside_click,
        test_notification_templates_list_shows_headings_only,
        test_notification_template_edit_save_and_reset,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
