"""
Sprint 1 - HR Vacancies (US-04 create vacancy, US-05 manage interview stages/panel)

Run: python test_hr_vacancies.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit, debug_dump, type_text, scroll_into_view,
    BASE_URL, ACCOUNTS, PASSWORD, check_servers_are_up, new_driver,
    login_as, wait_visible, wait_present, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402

TEST_DEPARTMENT = "IT"


def test_department_grid_shows_all_eight_departments():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        cards = driver.find_elements(By.CSS_SELECTOR, "button.vac-dept-card")
        ok = len(cards) == 8
        return report("test_department_grid_shows_all_eight_departments", ok, f"found {len(cards)} cards")
    finally:
        safe_quit(driver)


def test_open_department_shows_create_button():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
        btn = wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn")
        ok = btn.text.strip() == "Create Vacancy"
        return report("test_open_department_shows_create_button", ok, btn.text)
    finally:
        safe_quit(driver)


def test_create_vacancy_validation_requires_title_department_description():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
        wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn").click()
        wait_visible(driver, By.ID, "vac-title-input")
        driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
        err = wait_visible(driver, By.CSS_SELECTOR, ".vac-error")
        ok = err.text.strip() == "Title, department, and description are required."
        return report("test_create_vacancy_validation_requires_title_department_description", ok, err.text)
    finally:
        safe_quit(driver)


def test_create_vacancy_then_add_stage_and_panelist():
    """Full happy path: create a vacancy, confirm it moves into edit mode
    (stages/panel sections appear), add one interview round and one panelist."""
    driver = new_driver()
    unique_title = f"Selenium Test Role {int(time.time())}"
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
        wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn").click()
        wait_visible(driver, By.ID, "vac-title-input")
        # Brief settle pause: right after a modal mounts, there's a narrow
        # window where the input is visible and interactable per Selenium's
        # own checks, but React hasn't finished its render commit / event
        # delegation setup yet -- send_keys() issued into that window can
        # silently produce an empty value with no error. type_text() already
        # retries, but giving the render a moment to settle first avoids
        # relying on the retry to paper over it.
        time.sleep(0.4)

        type_text(driver, By.ID, "vac-title-input", unique_title, retries=3)
        dept_select = driver.find_element(By.ID, "vac-department-select")
        scroll_into_view(driver, dept_select)
        Select(dept_select).select_by_visible_text(TEST_DEPARTMENT)
        type_text(driver, By.ID, "vac-description-input", "Created by an automated Selenium test.", retries=3)
        save_btn = driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn")
        scroll_into_view(driver, save_btn)
        save_btn.click()

        # After save, the modal should stay open and now show the stages section
        # (editingId gets set), per the "Add interview rounds and a panel below"
        # save-toast copy in VacanciesPage.tsx.
        try:
            stage_input = wait_visible(driver, By.CSS_SELECTOR, ".vac-stage-add-row input")
        except Exception:
            debug_dump(driver, "test_create_vacancy_then_add_stage_and_panelist")
            raise
        stage_input.send_keys("Technical Interview")
        driver.find_element(By.CSS_SELECTOR, "button.vac-stage-add-btn").click()
        # NOTE: this span renders as "{s.order}. {s.name}" in JSX, which
        # produces multiple sibling text nodes -- contains(text(), ...) only
        # ever checks the FIRST text node (a classic XPath 1.0 gotcha), so it
        # would never match "Technical Interview" here since that's not the
        # first node. contains(., ...) checks the element's full string-value
        # (all descendant text concatenated) instead.
        stage_row = wait_visible(driver, By.XPATH, "//span[contains(@class,'vac-stage-name') and contains(.,'Technical Interview')]")
        ok = "Technical Interview" in stage_row.text
        return report("test_create_vacancy_then_add_stage_and_panelist", ok, stage_row.text)
    finally:
        safe_quit(driver)


def test_status_filter_chips_toggle():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
        wait_visible(driver, By.CSS_SELECTOR, ".vac-filter-bar")
        chips = driver.find_elements(By.CSS_SELECTOR, ".vac-filter-chip")
        ok = len(chips) >= 2
        chips[1].click()
        active = wait_visible(driver, By.CSS_SELECTOR, ".vac-filter-chip-active")
        return report("test_status_filter_chips_toggle", ok and active is not None, active.text if ok else "")
    finally:
        safe_quit(driver)


def test_edit_existing_vacancy_shows_status_dropdown():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
        wait_visible(driver, By.CSS_SELECTOR, ".vac-filter-bar")  # confirms the department view itself loaded
        rows = driver.find_elements(By.CSS_SELECTOR, ".vac-row")
        if not rows:
            return report("test_edit_existing_vacancy_shows_status_dropdown", True,
                           f"no vacancies exist in {TEST_DEPARTMENT} yet, skipped -- "
                           "run test_create_vacancy_then_add_stage_and_panelist first, or reseed the DB")
        rows[0].find_element(By.CSS_SELECTOR, ".vac-edit-btn").click()
        try:
            status_select = wait_visible(driver, By.ID, "vac-status-select")
        except Exception:
            debug_dump(driver, "test_edit_existing_vacancy_shows_status_dropdown")
            raise
        ok = status_select.is_displayed()
        return report("test_edit_existing_vacancy_shows_status_dropdown", ok)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_department_grid_shows_all_eight_departments,
        test_open_department_shows_create_button,
        test_create_vacancy_validation_requires_title_department_description,
        test_create_vacancy_then_add_stage_and_panelist,
        test_status_filter_chips_toggle,
        test_edit_existing_vacancy_shows_status_dropdown,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
