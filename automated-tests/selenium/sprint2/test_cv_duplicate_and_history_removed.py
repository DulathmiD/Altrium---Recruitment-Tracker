"""
Sprint 2 (post-revert) - CV duplicate detection via email, and confirming the
rolled-back CV History / Review Notes History UI is actually gone.

Covers gaps from Selenium_Automation_Coverage_Gaps.md, "CV upload / duplicate
detection" section:
  - Same-vacancy re-upload shows the plain "existing candidate found" modal
    with a working profile link, and does NOT change the existing
    application's stage.
  - Cross-vacancy re-upload of the same email is still flagged in that modal,
    but with no profile link (a new application is silently created instead
    of being blocked).
  - A previously-REJECTED candidate re-uploaded to the same vacancy stays
    REJECTED (no auto-reconsider).
  - Candidate detail page has no CV History / Review Notes History elements.

NOTE: written from reading the actual current source (candidate.controller.ts
confirmCvUpload, CandidatesPage.tsx, CandidateDetailPage.tsx) so selectors and
flow match what's really in the app. Not yet executed against a live
server -- run it and fix whatever Selenium actually finds before trusting the
PASS/FAIL output.

Run: python test_cv_duplicate_and_history_removed.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit, debug_dump,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    make_test_pdf, wait_visible, wait_present, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402

TEST_DEPARTMENT = "IT"


def _create_vacancy(driver, title):
    """Creates a fresh, minimal OPEN vacancy in TEST_DEPARTMENT and returns
    its title (vacancies aren't deletable from the UI, so every test that
    needs a clean vacancy makes its own uniquely-named one)."""
    driver.get(f"{BASE_URL}/hr/vacancies")
    wait_visible(driver, By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{TEST_DEPARTMENT}']").click()
    wait_visible(driver, By.CSS_SELECTOR, "button.vac-create-btn").click()
    wait_visible(driver, By.ID, "vac-title-input").send_keys(title)
    driver.find_element(By.ID, "vac-description-input").send_keys("Selenium-created vacancy for duplicate-detection tests.")
    driver.find_element(By.CSS_SELECTOR, "button.vac-save-btn").click()
    wait_visible(driver, By.CSS_SELECTOR, ".vac-modal-close").click()
    return title


def _upload_cv(driver, vacancy_title, name, email, pdf_filename):
    """Runs the Upload CV -> Extract -> Review -> Confirm & Apply flow for a
    single candidate applying to vacancy_title. Returns True if the flow
    completed (either onto the candidates list, or a duplicate modal)."""
    driver.get(f"{BASE_URL}/hr/candidates")
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-upload-btn").click()
    vacancy_select = Select(wait_visible(driver, By.ID, "cnd-vacancy-select"))
    vacancy_select.select_by_visible_text(
        next(o.text for o in vacancy_select.options if o.text.startswith(vacancy_title))
    )

    pdf_path = make_test_pdf(pdf_filename, [name, email, "+44 7900 000000"])
    driver.find_element(By.ID, "cnd-file-input").send_keys(pdf_path)
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-save-btn").click()

    wait_visible(driver, By.CSS_SELECTOR, ".cnd-review-row", timeout=20)
    driver.find_element(
        By.XPATH, "//button[contains(@class,'cnd-save-btn') and contains(text(),'Confirm')]"
    ).click()


def test_same_vacancy_reupload_shows_duplicate_modal_with_link():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Dup Same {int(time.time())}")
        email = f"selenium.dup.{int(time.time())}@example.com"

        _upload_cv(driver, vac, "Dana Duplicate", email, "selenium_dup_1.pdf")
        # First upload is brand new -- no duplicate modal expected, just the
        # upload modal closing back onto the candidates list.
        wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

        # Re-upload the SAME email to the SAME vacancy.
        _upload_cv(driver, vac, "Dana Duplicate", email, "selenium_dup_2.pdf")
        modal = wait_visible(driver, By.CSS_SELECTOR, ".cnd-duplicate-modal", timeout=10)
        link = modal.find_element(By.CSS_SELECTOR, ".cnd-duplicate-link")
        ok = link.is_displayed() and "View their profile" in link.text
        return report("test_same_vacancy_reupload_shows_duplicate_modal_with_link", ok, link.text)
    except Exception:
        debug_dump(driver, "test_same_vacancy_reupload_shows_duplicate_modal_with_link")
        raise
    finally:
        safe_quit(driver)


def test_cross_vacancy_reupload_shows_duplicate_modal_linking_new_application():
    """Corrected after actually running this against the live app: the
    backend leaves applicationId null for the cross-vacancy case (see its own
    comment in candidate.controller.ts), but CandidatesPage.tsx's
    handleConfirmAndApply() fills it back in from applicationIdByCandidateId
    (built from that same batch's `created` applications) before rendering
    the modal -- so a link IS shown here too, it just points at the new
    application for vac_b, not the original one on vac_a. The originally
    written version of this test asserted no link at all and failed on first
    run; this is the fixed assertion."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac_a = _create_vacancy(driver, f"Selenium Dup CrossA {int(time.time())}")
        vac_b = _create_vacancy(driver, f"Selenium Dup CrossB {int(time.time())}")
        email = f"selenium.cross.{int(time.time())}@example.com"

        _upload_cv(driver, vac_a, "Cross Vacancy", email, "selenium_cross_1.pdf")
        wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

        # Same email, DIFFERENT vacancy -- matched AND a second application
        # is created, so the modal should show one link pointing at the NEW
        # (vac_b) application, distinct from the one on vac_a.
        _upload_cv(driver, vac_b, "Cross Vacancy", email, "selenium_cross_2.pdf")
        modal = wait_visible(driver, By.CSS_SELECTOR, ".cnd-duplicate-modal", timeout=10)
        links = modal.find_elements(By.CSS_SELECTOR, ".cnd-duplicate-link")
        if not links:
            return report("test_cross_vacancy_reupload_shows_duplicate_modal_linking_new_application", False, "no link rendered")
        href_before_click = links[0].get_attribute("href")
        links[0].click()
        wait_visible(driver, By.CSS_SELECTOR, ".cnd-detail-section", timeout=10)
        second_application_url = driver.current_url

        ok = (
            len(links) == 1
            and href_before_click is not None
            and "/hr/candidates/" in second_application_url
        )
        return report(
            "test_cross_vacancy_reupload_shows_duplicate_modal_linking_new_application", ok, second_application_url,
        )
    except Exception:
        debug_dump(driver, "test_cross_vacancy_reupload_shows_duplicate_modal_linking_new_application")
        raise
    finally:
        safe_quit(driver)


def test_rejected_candidate_reupload_stays_rejected():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium Dup Rejected {int(time.time())}")
        email = f"selenium.rejected.{int(time.time())}@example.com"
        name = "Rex Rejected"

        _upload_cv(driver, vac, name, email, "selenium_reject_1.pdf")
        wait_visible(driver, By.CSS_SELECTOR, "h1.cnd-title", timeout=10)

        # Reject the freshly-created candidate: write a review note, then Reject.
        driver.get(f"{BASE_URL}/hr/candidates")
        search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
        search.send_keys(email)
        time.sleep(1)
        wait_visible(
            driver, By.XPATH,
            f"//button[contains(@class,'cnd-candidate-link')][.//div[contains(@class,'cnd-candidate-name') and contains(text(),'{name}')]]",
        ).click()
        note_input = wait_visible(driver, By.ID, "cnd-review-note")
        note_input.send_keys("Not a fit for this role.")
        # CandidateDetailPage.tsx has THREE buttons sharing class
        # "cnd-save-btn" on this page: "View CV" (renders first, above this
        # section), "Save Note" (the one we want), and later "Assign"
        # (Hiring Manager section, not rendered for an APPLIED-stage
        # candidate anyway). A plain find_element(By.CSS_SELECTOR,
        # "button.cnd-save-btn") silently grabs "View CV" instead -- that's
        # what actually broke this test on first run (no exception, just a
        # note that never got saved). Locating it relative to the textarea
        # (the next cnd-save-btn *after* it in document order) is unambiguous.
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
        time.sleep(1)  # decision toast / stage refresh

        # Re-upload the same email to the same (still-open) vacancy.
        _upload_cv(driver, vac, name, email, "selenium_reject_2.pdf")
        modal = wait_visible(driver, By.CSS_SELECTOR, ".cnd-duplicate-modal", timeout=10)
        modal.find_element(By.CSS_SELECTOR, ".cnd-duplicate-link").click()

        # Assert THIS candidate's own stage subtitle (right under the h1
        # name), not a bare ".cnd-stage-rejected" lookup -- that class is
        # only ever used inside "Applicant History" rows for a DIFFERENT
        # application of the same person, so on a single-application
        # candidate it doesn't exist at all and a page-wide find_element for
        # it can silently match an unrelated element left over from other
        # seeded data. The first run of this test passed by accident this
        # way (captured text was "Role Play Interview - Rejected", which
        # isn't even this test's vacancy name).
        subtitle = wait_visible(
            driver, By.XPATH, "//h1[contains(@class,'cnd-title')]/following-sibling::p[contains(@class,'cnd-muted')][1]",
            timeout=10,
        )
        ok = subtitle.text.strip().endswith("Rejected")
        return report("test_rejected_candidate_reupload_stays_rejected", ok, subtitle.text)
    except Exception:
        debug_dump(driver, "test_rejected_candidate_reupload_stays_rejected")
        raise
    finally:
        safe_quit(driver)


def test_candidate_detail_has_no_cv_or_review_history_sections():
    """Regression test for the SCRUM2-30 revert: CV History and Review Notes
    History were removed from CandidateDetailPage entirely -- this asserts
    neither section, nor the old pending-CV banner, is present in the DOM."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        vac = _create_vacancy(driver, f"Selenium NoHistory {int(time.time())}")
        email = f"selenium.nohistory.{int(time.time())}@example.com"
        name = "No History"
        _upload_cv(driver, vac, name, email, "selenium_nohistory.pdf")
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

        page_text = driver.find_element(By.TAG_NAME, "body").text
        forbidden_phrases = ["CV History", "Review Notes History", "View CV History", "View Review Notes History"]
        found = [p for p in forbidden_phrases if p in page_text]
        ok = len(found) == 0
        return report("test_candidate_detail_has_no_cv_or_review_history_sections", ok, f"found: {found}")
    except Exception:
        debug_dump(driver, "test_candidate_detail_has_no_cv_or_review_history_sections")
        raise
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_same_vacancy_reupload_shows_duplicate_modal_with_link,
        test_cross_vacancy_reupload_shows_duplicate_modal_linking_new_application,
        test_rejected_candidate_reupload_stays_rejected,
        test_candidate_detail_has_no_cv_or_review_history_sections,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
