"""
Sprint 2 (post-revert) - CV review gate (Shortlist/Reject require a saved
review note first) and the manual Reconsider banner.

Covers gaps from Selenium_Automation_Coverage_Gaps.md, "CV review gate &
Reconsider" section:
  - Shortlist/Reject buttons are disabled on a fresh Unreviewed candidate
    with no note.
  - Saving a note via the textarea + Save Note enables both buttons.
  - Reconsider banner only renders when stage === REJECTED &&
    hiringDecision === null, and clicking it returns the candidate to
    Unreviewed (not Shortlisted).

NOTE: written from reading the actual current source
(CandidateDetailPage.tsx: isCvReviewLocked, hasSavedReviewNote,
handleReconsider, the .cnd-reconsider-banner block) so selectors match what's
really rendered. Not yet executed against a live server -- run it and fix
whatever Selenium actually finds before trusting the PASS/FAIL output.

Run: python test_cv_review_gate_and_reconsider.py
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
    driver.find_element(By.ID, "vac-description-input").send_keys("Selenium-created vacancy for review-gate tests.")
    driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".vac-modal-close").click()
    return title


def _upload_and_open_candidate(driver, vac, name, email, pdf_filename):
    driver.get(f"{BASE_URL}/hr/candidates")
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-upload-btn").click()
    vacancy_select = Select(wait_visible(driver, By.ID, "cnd-vacancy-select"))
    vacancy_select.select_by_visible_text(
        next(o.text for o in vacancy_select.options if o.text.startswith(vac))
    )
    pdf_path = make_test_pdf(pdf_filename, [name, email, "+44 7900 000001"])
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


def test_shortlist_reject_disabled_without_review_note():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Gate {int(time.time())}")
        email = f"selenium.gate.{int(time.time())}@example.com"
        _upload_and_open_candidate(driver, vac, "Gate Candidate", email, "selenium_gate.pdf")

        reject_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-reject")
        shortlist_btn = driver.find_element(By.CSS_SELECTOR, "button.cnd-action-shortlist")
        ok = reject_btn.get_attribute("disabled") is not None and shortlist_btn.get_attribute("disabled") is not None
        return report("test_shortlist_reject_disabled_without_review_note", ok)
    except Exception:
        debug_dump(driver, "test_shortlist_reject_disabled_without_review_note")
        raise
    finally:
        safe_quit(driver)


def test_saving_review_note_enables_decision_buttons():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Gate2 {int(time.time())}")
        email = f"selenium.gate2.{int(time.time())}@example.com"
        _upload_and_open_candidate(driver, vac, "Gate Candidate Two", email, "selenium_gate2.pdf")

        note_input = wait_visible(driver, By.ID, "cnd-review-note")
        note_input.send_keys("Solid CV, worth a first-round interview.")
        # CandidateDetailPage.tsx has THREE buttons sharing class
        # "cnd-save-btn": "View CV" (renders first, above this section),
        # "Save Note" (the one we want), and "Assign" (Hiring Manager
        # section). A plain find_element(By.CSS_SELECTOR,
        # "button.cnd-save-btn") silently grabbed "View CV" instead -- that
        # was the real cause of this test's first-run failure (no exception,
        # the note just never got saved). Locating it relative to the
        # textarea (the next cnd-save-btn *after* it in document order) is
        # unambiguous. Waiting for it to actually be enabled still matters
        # too, since it stays disabled until candidateDetail's own async
        # fetch resolves.
        save_note_btn = note_input.find_element(By.XPATH, "./following::button[contains(@class,'cnd-save-btn')][1]")
        for _ in range(20):
            if save_note_btn.get_attribute("disabled") is None:
                break
            time.sleep(0.5)
        save_note_btn.click()

        reject_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-reject")
        shortlist_btn = driver.find_element(By.CSS_SELECTOR, "button.cnd-action-shortlist")
        ok = False
        for _ in range(20):
            if reject_btn.get_attribute("disabled") is None and shortlist_btn.get_attribute("disabled") is None:
                ok = True
                break
            time.sleep(0.5)
        return report("test_saving_review_note_enables_decision_buttons", ok)
    except Exception:
        debug_dump(driver, "test_saving_review_note_enables_decision_buttons")
        raise
    finally:
        safe_quit(driver)


def _open_candidate_by_email(driver, name, email):
    """CandidateDetailPage.tsx's handleReject/handleShortlist/handleReconsider
    all navigate("/hr/candidates", ...) on success -- they don't stay on the
    detail page. Any assertion about what the detail page looks like AFTER
    one of those actions has to re-navigate back into it first (this is what
    the first real run of this test got wrong: it checked for the Reconsider
    banner immediately after clicking Reject without ever leaving the now-
    stale /hr/candidates list page)."""
    driver.get(f"{BASE_URL}/hr/candidates")
    search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
    search.clear()
    search.send_keys(email)
    time.sleep(1)
    wait_visible(
        driver, By.XPATH,
        f"//button[contains(@class,'cnd-candidate-link')][.//div[contains(@class,'cnd-candidate-name') and contains(text(),'{name}')]]",
    ).click()
    wait_visible(driver, By.CSS_SELECTOR, ".cnd-detail-section")


def test_reject_then_reconsider_returns_to_unreviewed():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Reconsider {int(time.time())}")
        email = f"selenium.reconsider.{int(time.time())}@example.com"
        name = "Reconsider Candidate"
        _upload_and_open_candidate(driver, vac, name, email, "selenium_reconsider.pdf")

        note_input = wait_visible(driver, By.ID, "cnd-review-note")
        note_input.send_keys("Not enough relevant experience.")
        # See the comment in test_saving_review_note_enables_decision_buttons
        # above -- "button.cnd-save-btn" alone matches "View CV" first.
        save_note_btn = note_input.find_element(By.XPATH, "./following::button[contains(@class,'cnd-save-btn')][1]")
        for _ in range(20):
            if save_note_btn.get_attribute("disabled") is None:
                break
            time.sleep(0.5)
        save_note_btn.click()
        reject_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-reject")
        for _ in range(20):
            if reject_btn.get_attribute("disabled") is None:
                break
            time.sleep(0.5)
        reject_btn.click()
        # handleReject navigates to /hr/candidates on success.
        wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

        # Re-open the candidate: hiringDecision is still null (this was a
        # CV-screening reject, not a post-interview decision), so the
        # Reconsider banner should appear.
        _open_candidate_by_email(driver, name, email)
        banner = wait_visible(driver, By.CSS_SELECTOR, ".cnd-reconsider-banner", timeout=10)
        banner.find_element(By.XPATH, ".//button[contains(text(),'Reconsider')]").click()
        # handleReconsider also navigates to /hr/candidates on success.
        wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

        # Re-open the candidate again: back to Unreviewed means the
        # Shortlist/Reject row (only rendered for stage === APPLIED) should
        # be there once more.
        _open_candidate_by_email(driver, name, email)
        shortlist_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-action-shortlist", timeout=10)
        ok = shortlist_btn.is_displayed()
        return report("test_reject_then_reconsider_returns_to_unreviewed", ok)
    except Exception:
        debug_dump(driver, "test_reject_then_reconsider_returns_to_unreviewed")
        raise
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_shortlist_reject_disabled_without_review_note,
        test_saving_review_note_enables_decision_buttons,
        test_reject_then_reconsider_returns_to_unreviewed,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
