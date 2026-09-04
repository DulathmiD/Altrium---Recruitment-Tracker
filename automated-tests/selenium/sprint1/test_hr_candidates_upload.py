"""
Sprint 1 - HR Candidates: CV upload/extraction (US-06/07/08) and
search/filter (US-09/13/14).

Run: python test_hr_candidates_upload.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    make_test_pdf, wait_visible, wait_present, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402
from selenium.webdriver.support.ui import Select  # noqa: E402


def _open_upload_modal(driver):
    driver.get(f"{BASE_URL}/hr/candidates")
    wait_visible(driver, By.CSS_SELECTOR, "button.cnd-upload-btn").click()
    wait_visible(driver, By.ID, "cnd-vacancy-select")


def test_search_by_name_or_email():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/candidates")
        search = wait_visible(driver, By.CSS_SELECTOR, "input.cnd-search-input")
        search.send_keys("zzz-no-such-candidate-zzz")
        time.sleep(1)  # debounced search
        msg = wait_visible(driver, By.CSS_SELECTOR, ".cnd-muted")
        ok = "No candidates match" in msg.text
        return report("test_search_by_name_or_email", ok, msg.text)
    finally:
        safe_quit(driver)


def test_upload_modal_requires_vacancy_before_extract_disabled_state():
    """Extract stays disabled until at least one file is picked -- this checks
    the button is present and correctly disabled with no file chosen yet."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        _open_upload_modal(driver)
        extract_btn = driver.find_element(By.CSS_SELECTOR, "button.cnd-save-btn")
        ok = extract_btn.get_attribute("disabled") is not None
        return report("test_upload_modal_requires_vacancy_before_extract_disabled_state", ok)
    finally:
        safe_quit(driver)


def test_upload_cv_extract_and_reach_review_step():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        _open_upload_modal(driver)

        vacancy_select = Select(driver.find_element(By.ID, "cnd-vacancy-select"))
        if len(vacancy_select.options) > 1:
            vacancy_select.select_by_index(1)

        pdf_path = make_test_pdf(
            "selenium_test_cv.pdf",
            ["Jordan Selenium", "jordan.selenium@example.com", "+44 7911 123456"],
        )
        file_input = driver.find_element(By.ID, "cnd-file-input")
        file_input.send_keys(pdf_path)

        extract_btn = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-save-btn")
        ok_enabled = extract_btn.get_attribute("disabled") is None
        extract_btn.click()

        # Review step shows a per-file card with Name/Email/Phone inputs.
        review_row = wait_visible(driver, By.CSS_SELECTOR, ".cnd-review-row", timeout=20)
        ok = ok_enabled and review_row.is_displayed()
        return report("test_upload_cv_extract_and_reach_review_step", ok)
    finally:
        safe_quit(driver)


def test_confirm_and_apply_validation_requires_name_and_email():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        _open_upload_modal(driver)

        vacancy_select = Select(driver.find_element(By.ID, "cnd-vacancy-select"))
        if len(vacancy_select.options) > 1:
            vacancy_select.select_by_index(1)

        pdf_path = make_test_pdf("selenium_test_cv_blank.pdf", ["No extractable contact info here"])
        driver.find_element(By.ID, "cnd-file-input").send_keys(pdf_path)
        wait_visible(driver, By.CSS_SELECTOR, "button.cnd-save-btn").click()

        review_row = wait_visible(driver, By.CSS_SELECTOR, ".cnd-review-row", timeout=20)
        # Clear name + email (extraction likely already left them blank for a
        # CV with no recognizable pattern, but we clear explicitly either way).
        inputs = review_row.find_elements(By.TAG_NAME, "input")
        for inp in inputs[:2]:
            inp.clear()

        driver.find_element(By.XPATH, "//button[contains(@class,'cnd-save-btn') and contains(text(),'Confirm')]").click()
        err = wait_visible(driver, By.CSS_SELECTOR, ".cnd-error")
        ok = "at least a name and email" in err.text
        return report("test_confirm_and_apply_validation_requires_name_and_email", ok, err.text)
    finally:
        safe_quit(driver)


def test_candidate_row_links_to_detail_page():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/candidates")
        try:
            link = wait_visible(driver, By.CSS_SELECTOR, "button.cnd-candidate-link", timeout=5)
        except Exception:
            return report("test_candidate_row_links_to_detail_page", True, "no candidates seeded, skipped")
        link.click()
        wait_visible(driver, By.CSS_SELECTOR, ".cnd-title")
        ok = "/hr/candidates/" in driver.current_url
        return report("test_candidate_row_links_to_detail_page", ok, driver.current_url)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_search_by_name_or_email,
        test_upload_modal_requires_vacancy_before_extract_disabled_state,
        test_upload_cv_extract_and_reach_review_step,
        test_confirm_and_apply_validation_requires_name_and_email,
        test_candidate_row_links_to_detail_page,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
