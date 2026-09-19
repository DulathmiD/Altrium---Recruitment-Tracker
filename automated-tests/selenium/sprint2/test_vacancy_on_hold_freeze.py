"""
Sprint 2 - ON_HOLD vacancy freeze: while a vacancy is on hold, HR can't
shortlist/reject/reconsider its candidates or assign a Hiring Manager, and
the vacancy drops out of the Upload CV "Apply to Vacancy" dropdown.
Reopening to OPEN restores all of that.

Covers gaps from Selenium_Automation_Coverage_Gaps.md, "ON_HOLD vacancy
freeze" section.

NOTE: written from reading the actual current source
(CandidateDetailPage.tsx: isVacancyOnHold, the .cnd-locked-hint paragraphs
guarding Shortlist/Reject and the Hiring Manager section; VacanciesPage.tsx:
vac-status-select / vac-edit-btn) so selectors match what's really rendered.
Not yet executed against a live server -- run it and fix whatever Selenium
actually finds before trusting the PASS/FAIL output.

Run: python test_vacancy_on_hold_freeze.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit, debug_dump,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    make_test_pdf, wait_visible, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402

TEST_DEPARTMENT = "IT"


def _create_vacancy(driver, title):
    driver.get(f"{BASE_URL}/hr/vacancies")
    wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
    wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn").click()
    wait_visible(driver, By.ID, "vac-title-input").send_keys(title)
    driver.find_element(By.ID, "vac-description-input").send_keys("Selenium-created vacancy for on-hold tests.")
    driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".vac-modal-close").click()
    return title


def _set_vacancy_status(driver, title, status_visible_text):
    driver.get(f"{BASE_URL}/hr/vacancies")
    wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
    wait_visible(
        driver, By.XPATH,
        f"//div[contains(@class,'vac-row')][.//span[contains(@class,'vac-row-title') and contains(text(),'{title}')]]//button[contains(@class,'vac-edit-btn')]",
    ).click()
    status_select = Select(wait_visible(driver, By.ID, "vac-status-select"))
    status_select.select_by_visible_text(status_visible_text)
    driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
    # Unlike the CREATE flow (which flips into a "Vacancy Created" state and
    # keeps the modal open so stages can be added, only closable via
    # .vac-modal-close), VacanciesPage.tsx's handleSave() calls
    # setFormOpen(false) directly for an EDIT save (editingId already set) --
    # the modal just closes on its own. Waiting to click a close button that
    # no longer exists is what timed out here; wait for the backdrop to
    # actually disappear instead.
    for _ in range(20):
        if len(driver.find_elements(By.CSS_SELECTOR, ".vac-modal-backdrop")) == 0:
            break
        time.sleep(0.5)


def _upload_and_open_candidate(driver, vac, name, email, pdf_filename):
    driver.get(f"{BASE_URL}/hr/candidates")
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-upload-btn").click()
    vacancy_select = Select(wait_visible(driver, By.ID, "cnd-vacancy-select"))
    vacancy_select.select_by_visible_text(
        next(o.text for o in vacancy_select.options if o.text.startswith(vac))
    )
    pdf_path = make_test_pdf(pdf_filename, [name, email, "+44 7900 000002"])
    driver.find_element(By.ID, "cnd-file-input").send_keys(pdf_path)
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-save-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".cnd-review-row", timeout=20)
    driver.find_element(
        By.XPATH, "//button[contains(@class,'cnd-save-btn') and contains(text(),'Confirm')]"
    ).click()
    wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

    driver.get(f"{BASE_URL}/hr/candidates")
    search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
    search.send_keys(email)
    time.sleep(1)
    wait_visible(
        driver, By.XPATH,
        f"//button[contains(@class,'cnd-candidate-link')][.//div[contains(@class,'cnd-candidate-name') and contains(text(),'{name}')]]",
    ).click()
    wait_visible(driver, By.CSS_SELECTOR, ".cnd-detail-section")


def _apply_dropdown_titles(driver):
    driver.get(f"{BASE_URL}/hr/candidates")
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-upload-btn").click()
    select = Select(wait_visible(driver, By.ID, "cnd-vacancy-select"))
    titles = [o.text for o in select.options]
    driver.find_element(By.CSS_SELECTOR, "button.cnd-cancel-btn").click()
    return titles


def test_on_hold_freezes_candidate_actions_and_hides_from_upload_dropdown():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium OnHold {int(time.time())}")
        email = f"selenium.onhold.{int(time.time())}@example.com"
        name = "On Hold Candidate"

        # Apply while OPEN (an ON_HOLD vacancy shouldn't even be selectable).
        _upload_and_open_candidate(driver, vac, name, email, "selenium_onhold.pdf")

        _set_vacancy_status(driver, vac, "On Hold")

        # Re-open the candidate and check the freeze.
        driver.get(f"{BASE_URL}/hr/candidates")
        search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
        search.send_keys(email)
        time.sleep(1)
        wait_visible(
            driver, By.XPATH,
            f"//button[contains(@class,'cnd-candidate-link')][.//div[contains(@class,'cnd-candidate-name') and contains(text(),'{name}')]]",
        ).click()
        reject_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-reject")
        shortlist_btn = driver.find_element(By.CSS_SELECTOR, "button.cnd-action-shortlist")
        actions_frozen = reject_btn.get_attribute("disabled") is not None and shortlist_btn.get_attribute("disabled") is not None

        hm_hint = driver.find_element(By.XPATH, "//p[contains(@class,'cnd-locked-hint') and contains(text(),'on hold')]")
        hm_frozen = hm_hint.is_displayed()

        dropdown_titles = _apply_dropdown_titles(driver)
        hidden_from_dropdown = not any(t.startswith(vac) for t in dropdown_titles)

        ok = actions_frozen and hm_frozen and hidden_from_dropdown
        return report(
            "test_on_hold_freezes_candidate_actions_and_hides_from_upload_dropdown", ok,
            f"actions_frozen={actions_frozen} hm_frozen={hm_frozen} hidden_from_dropdown={hidden_from_dropdown}",
        )
    except Exception:
        debug_dump(driver, "test_on_hold_freezes_candidate_actions_and_hides_from_upload_dropdown")
        raise
    finally:
        safe_quit(driver)


def test_reopening_vacancy_restores_actions_and_dropdown_visibility():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Reopen {int(time.time())}")
        email = f"selenium.reopen.{int(time.time())}@example.com"
        name = "Reopen Candidate"

        _upload_and_open_candidate(driver, vac, name, email, "selenium_reopen.pdf")
        _set_vacancy_status(driver, vac, "On Hold")
        _set_vacancy_status(driver, vac, "Open")

        dropdown_titles = _apply_dropdown_titles(driver)
        visible_again = any(t.startswith(vac) for t in dropdown_titles)

        driver.get(f"{BASE_URL}/hr/candidates")
        search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
        search.send_keys(email)
        time.sleep(1)
        wait_visible(
            driver, By.XPATH,
            f"//button[contains(@class,'cnd-candidate-link')][.//div[contains(@class,'cnd-candidate-name') and contains(text(),'{name}')]]",
        ).click()
        # Actions are still gated on a saved review note, but should no
        # longer be gated by ON_HOLD -- write the note and confirm they enable.
        note_input = wait_visible(driver, By.ID, "cnd-review-note")
        note_input.send_keys("Reopened vacancy, reviewing now.")
        # CandidateDetailPage.tsx has three buttons sharing class
        # "cnd-save-btn" ("View CV" renders first, then "Save Note", then
        # "Assign" in the Hiring Manager section) -- a plain
        # find_element(By.CSS_SELECTOR, "button.cnd-save-btn") silently grabs
        # "View CV" instead of Save Note. Locating it relative to the
        # textarea (the next cnd-save-btn *after* it) is unambiguous. It also
        # stays disabled until candidateDetail's own async fetch resolves,
        # so wait for the button itself, not just the textarea.
        save_note_btn = note_input.find_element(By.XPATH, "./following::button[contains(@class,'cnd-save-btn')][1]")
        for _ in range(20):
            if save_note_btn.get_attribute("disabled") is None:
                break
            time.sleep(0.5)
        save_note_btn.click()
        reject_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-reject")
        actions_restored = False
        for _ in range(20):
            if reject_btn.get_attribute("disabled") is None:
                actions_restored = True
                break
            time.sleep(0.5)

        ok = visible_again and actions_restored
        return report(
            "test_reopening_vacancy_restores_actions_and_dropdown_visibility", ok,
            f"visible_again={visible_again} actions_restored={actions_restored}",
        )
    except Exception:
        debug_dump(driver, "test_reopening_vacancy_restores_actions_and_dropdown_visibility")
        raise
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_on_hold_freezes_candidate_actions_and_hides_from_upload_dropdown,
        test_reopening_vacancy_restores_actions_and_dropdown_visibility,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
