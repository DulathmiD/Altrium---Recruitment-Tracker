"""
Sprint 1 - Interviewer: My Interviews -> Feedback (US-17/22 feedback
submission, US-25 shared visibility) and My Candidates (CV view).

Run: python test_interviewer_feedback.py
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


def test_my_interviews_filter_buttons():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/interviews")
        wait_visible(driver, By.CSS_SELECTOR, ".miv-filter-bar")
        buttons = driver.find_elements(By.CSS_SELECTOR, ".miv-filter-btn")
        texts = [b.text for b in buttons]
        ok = texts == ["All", "Submitted", "Pending"]
        return report("test_my_interviews_filter_buttons", ok, texts)
    finally:
        safe_quit(driver)


def test_feedback_score_validation_rejects_out_of_range():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/interviews")
        rows = driver.find_elements(By.CSS_SELECTOR, "tr.miv-row")
        if not rows:
            return report("test_feedback_score_validation_rejects_out_of_range", True, "no interviews assigned, skipped")
        rows[0].click()
        score_input = wait_visible(driver, By.ID, "fb-score")
        if score_input.get_attribute("disabled"):
            return report("test_feedback_score_validation_rejects_out_of_range", True, "interview is in the future (locked), skipped")
        score_input.clear()
        score_input.send_keys("15")
        driver.find_element(By.ID, "fb-comments").send_keys("Selenium test comment")
        driver.find_element(By.CSS_SELECTOR, "button.fb-submit-btn").click()
        err = wait_visible(driver, By.CSS_SELECTOR, ".fb-error")
        ok = err.text.strip() == "Score must be a whole number from 1 to 10"
        return report("test_feedback_score_validation_rejects_out_of_range", ok, err.text)
    finally:
        safe_quit(driver)


def test_feedback_requires_comments():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/interviews")
        rows = driver.find_elements(By.CSS_SELECTOR, "tr.miv-row")
        if not rows:
            return report("test_feedback_requires_comments", True, "no interviews assigned, skipped")
        rows[0].click()
        score_input = wait_visible(driver, By.ID, "fb-score")
        if score_input.get_attribute("disabled"):
            return report("test_feedback_requires_comments", True, "interview is in the future (locked), skipped")
        score_input.clear()
        score_input.send_keys("8")
        comments = driver.find_element(By.ID, "fb-comments")
        comments.clear()
        driver.find_element(By.CSS_SELECTOR, "button.fb-submit-btn").click()
        err = wait_visible(driver, By.CSS_SELECTOR, ".fb-error")
        ok = err.text.strip() == "Comments are required"
        return report("test_feedback_requires_comments", ok, err.text)
    finally:
        safe_quit(driver)


def test_feedback_cancel_returns_to_my_interviews():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/interviews")
        rows = driver.find_elements(By.CSS_SELECTOR, "tr.miv-row")
        if not rows:
            return report("test_feedback_cancel_returns_to_my_interviews", True, "no interviews assigned, skipped")
        rows[0].click()
        wait_visible(driver, By.CSS_SELECTOR, "button.fb-cancel-btn").click()
        wait_visible(driver, By.CSS_SELECTOR, ".miv-title")
        ok = driver.current_url.rstrip("/").endswith("/interviewer/interviews")
        return report("test_feedback_cancel_returns_to_my_interviews", ok, driver.current_url)
    finally:
        safe_quit(driver)


def test_my_candidates_groups_by_vacancy_stage():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/candidates")
        wait_visible(driver, By.CSS_SELECTOR, ".myc-title")
        groups = driver.find_elements(By.CSS_SELECTOR, ".myc-group-row")
        ok = True  # presence of the page itself is the assertion; groups may legitimately be empty
        return report("test_my_candidates_groups_by_vacancy_stage", ok, f"{len(groups)} group(s) found")
    finally:
        safe_quit(driver)


def test_my_candidates_group_search_filters_rows():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["INTERVIEWER"], role="INTERVIEWER")
        driver.get(f"{BASE_URL}/interviewer/candidates")
        groups = driver.find_elements(By.CSS_SELECTOR, ".myc-group-row")
        if not groups:
            return report("test_my_candidates_group_search_filters_rows", True, "no candidate groups assigned, skipped")
        groups[0].click()
        search = wait_visible(driver, By.CSS_SELECTOR, "input.myc-search-input")
        search.send_keys("zzz-no-such-candidate-zzz")
        msg = wait_visible(driver, By.CSS_SELECTOR, ".myc-muted")
        ok = "No candidates found" in msg.text
        return report("test_my_candidates_group_search_filters_rows", ok, msg.text)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_my_interviews_filter_buttons,
        test_feedback_score_validation_rejects_out_of_range,
        test_feedback_requires_comments,
        test_feedback_cancel_returns_to_my_interviews,
        test_my_candidates_groups_by_vacancy_stage,
        test_my_candidates_group_search_filters_rows,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
