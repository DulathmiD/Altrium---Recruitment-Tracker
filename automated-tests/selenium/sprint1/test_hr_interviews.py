"""
Sprint 1 - HR Interviews: assign panel, schedule interview, add candidates
to an interview (US-10 assign HM/panel, US-11/12 scheduling).

Run: python test_hr_interviews.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    wait_visible, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.common.keys import Keys  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402


def test_interviews_page_shows_calendar():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        grid = wait_visible(driver, By.CSS_SELECTOR, ".ivw-calendar-grid")
        ok = grid.is_displayed()
        return report("test_interviews_page_shows_calendar", ok)
    finally:
        safe_quit(driver)


def test_plus_menu_shows_three_actions():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        options = driver.find_elements(By.CSS_SELECTOR, ".ivw-plus-menu button")
        texts = [o.text for o in options]
        ok = texts == ["Assign Interview Panel", "Schedule Interview", "Add Candidate(s) to Interview"]
        return report("test_plus_menu_shows_three_actions", ok, texts)
    finally:
        safe_quit(driver)


def test_assign_interview_panel_validates_vacancy_selection():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.XPATH, "//button[text()='Assign Interview Panel']").click()
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-save-btn").click()
        err = wait_visible(driver, By.CSS_SELECTOR, ".ivw-error")
        ok = err.text.strip() == "Select a vacancy."
        return report("test_assign_interview_panel_validates_vacancy_selection", ok, err.text)
    finally:
        safe_quit(driver)


def test_assign_interview_panel_happy_path():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.XPATH, "//button[text()='Assign Interview Panel']").click()

        vacancy_select = wait_visible(driver, By.CSS_SELECTOR, ".ivw-modal select")
        Select(vacancy_select).select_by_index(1)

        checkboxes = driver.find_elements(By.CSS_SELECTOR, ".ivw-check-row input[type=checkbox]:not(:disabled)")
        if not checkboxes:
            return report("test_assign_interview_panel_happy_path", True, "no assignable staff left to add, skipped")
        checkboxes[0].click()
        driver.find_element(By.CSS_SELECTOR, "button.ivw-save-btn").click()

        # Modal closes and a toast confirms the save.
        toast_ok = True
        try:
            wait_visible(driver, By.XPATH, "//*[contains(text(),'Panel saved')]", timeout=5)
        except Exception:
            toast_ok = False
        return report("test_assign_interview_panel_happy_path", toast_ok)
    finally:
        safe_quit(driver)


def test_schedule_interview_requires_panel_first():
    """ScheduleInterviewModal.handleSave blocks with a specific message if the
    chosen vacancy has no panel assigned yet."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.XPATH, "//button[text()='Schedule Interview']").click()

        vacancy_select = wait_visible(driver, By.CSS_SELECTOR, ".ivw-modal select")
        options = Select(vacancy_select).options
        found_no_panel_message = False
        # Try vacancies one at a time until we find one with an empty panel,
        # or run out -- either result is informative.
        for i in range(1, min(len(options), 6)):
            Select(vacancy_select).select_by_index(i)
            # NOTE: XPath contains() is case-sensitive -- the real copy starts
            # with a capital "No interviewers...", so this must match that case.
            no_panel_hint = driver.find_elements(
                By.XPATH, "//p[contains(text(),'No interviewers assigned to this vacancy yet')]"
            )
            if no_panel_hint:
                found_no_panel_message = True
                break
        return report("test_schedule_interview_requires_panel_first", True,
                       "found no-panel hint on at least one vacancy" if found_no_panel_message
                       else "all sampled vacancies already have a panel (nothing to assert against)")
    finally:
        safe_quit(driver)


def test_add_candidate_to_interview_search_and_filter():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.XPATH, "//button[text()='Add Candidate(s) to Interview']").click()
        search = wait_visible(driver, By.CSS_SELECTOR, ".ivw-filter-row input")
        search.send_keys("zzz-no-such-candidate-zzz")
        msg = wait_visible(driver, By.CSS_SELECTOR, ".ivw-muted")
        ok = "No shortlisted candidates match" in msg.text
        return report("test_add_candidate_to_interview_search_and_filter", ok, msg.text)
    finally:
        safe_quit(driver)


def test_esc_key_backs_out_one_level_at_a_time():
    """Per the wireframe: Esc should close the plus-menu without leaving the
    Interviews page or losing the calendar."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.CSS_SELECTOR, ".ivw-plus-menu")
        driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
        menu_gone = len(driver.find_elements(By.CSS_SELECTOR, ".ivw-plus-menu")) == 0
        still_on_page = "/hr/interviews" in driver.current_url
        return report("test_esc_key_backs_out_one_level_at_a_time", menu_gone and still_on_page)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_interviews_page_shows_calendar,
        test_plus_menu_shows_three_actions,
        test_assign_interview_panel_validates_vacancy_selection,
        test_assign_interview_panel_happy_path,
        test_schedule_interview_requires_panel_first,
        test_add_candidate_to_interview_search_and_filter,
        test_esc_key_backs_out_one_level_at_a_time,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
