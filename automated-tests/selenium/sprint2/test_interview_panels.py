"""
Sprint 2 - Interview Panels: named, reusable panels created via "Assign
Interview Panel", excluding Hiring Managers from the assignable staff list,
and reused later in "Schedule Interview".

Covers gaps from Selenium_Automation_Coverage_Gaps.md, "Interview Panels"
section (the "double-booked panelist at the identical timestamp" scenario is
NOT covered here -- it needs an existing scheduled interview as a fixture and
wasn't grounded against real source in this pass).

Uses the seeded demo accounts directly by name (Marcus Feldman = Interviewer,
Victor Adeyemi = Hiring Manager) rather than assuming any particular ordering,
since InterviewsPage.tsx sorts the staff checklist by role then name.

NOTE: written from reading the actual current source (InterviewsPage.tsx:
AssignPanelModal, ScheduleInterviewModal) so selectors match what's really
rendered. Not yet executed against a live server -- run it and fix whatever
Selenium actually finds before trusting the PASS/FAIL output.

Run: python test_interview_panels.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit, debug_dump,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    wait_visible, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402

TEST_DEPARTMENT = "IT"
HM_NAME = "Victor Adeyemi"       # seeded HIRING_MANAGER -- must be absent from panel staff list
INTERVIEWER_NAME = "Marcus Feldman"  # seeded INTERVIEWER -- used to build panels


def _create_vacancy(driver, title):
    driver.get(f"{BASE_URL}/hr/vacancies")
    wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
    wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn").click()
    wait_visible(driver, By.ID, "vac-title-input").send_keys(title)
    driver.find_element(By.ID, "vac-description-input").send_keys("Selenium-created vacancy for panel tests.")
    driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".vac-modal-close").click()
    return title


def _open_assign_panel_modal(driver):
    driver.get(f"{BASE_URL}/hr/interviews")
    wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
    wait_visible(driver, By.XPATH, "//button[contains(text(),'Assign Interview Panel')]").click()
    wait_visible(driver, By.CSS_SELECTOR, ".ivw-modal")


def _create_panel(driver, vacancy_title, panel_name, member_names):
    _open_assign_panel_modal(driver)
    driver.find_element(By.CSS_SELECTOR, ".ivw-modal input[placeholder='e.g. Panel 1']").send_keys(panel_name)
    vac_select = Select(driver.find_element(By.CSS_SELECTOR, ".ivw-modal select"))
    vac_select.select_by_visible_text(
        next(o.text for o in vac_select.options if o.text.startswith(vacancy_title))
    )
    for member_name in member_names:
        wait_visible(
            driver, By.XPATH,
            f"//label[contains(@class,'ivw-check-row')][contains(.,'{member_name}')]//input[@type='checkbox']",
        ).click()
    driver.find_element(By.CSS_SELECTOR, "button.ivw-save-btn").click()


def test_create_named_panel_and_reuse_in_schedule_flow():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Panel {int(time.time())}")
        panel_name = f"Selenium Panel Alpha {int(time.time())}"

        _create_panel(driver, vac, panel_name, [INTERVIEWER_NAME])
        # Modal closes back to the interviews page on success.
        wait_visible(driver, By.CSS_SELECTOR, ".ivw-title", timeout=10)

        # Now open Schedule Interview for the same vacancy and confirm the
        # panel is offered for reuse.
        driver.get(f"{BASE_URL}/hr/interviews")
        wait_visible(driver, By.CSS_SELECTOR, "button.ivw-plus-btn").click()
        wait_visible(driver, By.XPATH, "//button[contains(text(),'Schedule Interview')]").click()
        modal = wait_visible(driver, By.CSS_SELECTOR, ".ivw-modal")
        vac_select = Select(modal.find_element(By.TAG_NAME, "select"))
        vac_select.select_by_visible_text(
            next(o.text for o in vac_select.options if o.text.startswith(vac))
        )
        panel_row = wait_visible(
            driver, By.XPATH, f"//div[contains(@class,'ivw-panel-summary')][contains(.,'{panel_name}')]", timeout=10,
        )
        ok = panel_row.is_displayed()
        return report("test_create_named_panel_and_reuse_in_schedule_flow", ok, panel_row.text)
    except Exception:
        debug_dump(driver, "test_create_named_panel_and_reuse_in_schedule_flow")
        raise
    finally:
        safe_quit(driver)


def test_hiring_managers_excluded_from_panel_staff_list():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium PanelHM {int(time.time())}")

        _open_assign_panel_modal(driver)
        vac_select = Select(driver.find_element(By.CSS_SELECTOR, ".ivw-modal select"))
        vac_select.select_by_visible_text(
            next(o.text for o in vac_select.options if o.text.startswith(vac))
        )
        wait_visible(driver, By.CSS_SELECTOR, ".ivw-checklist")
        checklist_text = driver.find_element(By.CSS_SELECTOR, ".ivw-checklist").text
        ok = HM_NAME not in checklist_text
        return report("test_hiring_managers_excluded_from_panel_staff_list", ok, checklist_text)
    except Exception:
        debug_dump(driver, "test_hiring_managers_excluded_from_panel_staff_list")
        raise
    finally:
        safe_quit(driver)


def test_same_staff_addable_to_two_different_panels():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium PanelReuse {int(time.time())}")
        panel_a = f"Selenium Panel A {int(time.time())}"
        panel_b = f"Selenium Panel B {int(time.time())}"

        _create_panel(driver, vac, panel_a, [INTERVIEWER_NAME])
        wait_visible(driver, By.CSS_SELECTOR, ".ivw-title", timeout=10)
        _create_panel(driver, vac, panel_b, [INTERVIEWER_NAME])
        wait_visible(driver, By.CSS_SELECTOR, ".ivw-title", timeout=10)

        # Re-open the modal for this vacancy: both panel names should be
        # listed as "existing panels", proving the second save wasn't
        # rejected for reusing the same staff member.
        _open_assign_panel_modal(driver)
        vac_select = Select(driver.find_element(By.CSS_SELECTOR, ".ivw-modal select"))
        vac_select.select_by_visible_text(
            next(o.text for o in vac_select.options if o.text.startswith(vac))
        )
        existing_text = wait_visible(driver, By.CSS_SELECTOR, ".ivw-muted", timeout=10).text
        ok = panel_a in existing_text and panel_b in existing_text
        return report("test_same_staff_addable_to_two_different_panels", ok, existing_text)
    except Exception:
        debug_dump(driver, "test_same_staff_addable_to_two_different_panels")
        raise
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_create_named_panel_and_reuse_in_schedule_flow,
        test_hiring_managers_excluded_from_panel_staff_list,
        test_same_staff_addable_to_two_different_panels,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
