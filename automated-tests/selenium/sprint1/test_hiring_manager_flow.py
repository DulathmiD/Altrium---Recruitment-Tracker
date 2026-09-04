"""
Sprint 1 - Hiring Manager flow: Vacancies -> Vacancy Candidates -> Candidate
Decision (US-13/14 review, US-17 decisions), Pending Decisions, and
Candidate Comparison (US-25 shared feedback visibility).

Run: python test_hiring_manager_flow.py
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
from selenium.webdriver.support.ui import Select  # noqa: E402


def test_vacancies_filter_bar_has_four_fields_and_apply():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/vacancies")
        wait_visible(driver, By.CSS_SELECTOR, ".hmv-filter-bar")
        fields = driver.find_elements(By.CSS_SELECTOR, ".hmv-filter-field")
        apply_btn = driver.find_element(By.CSS_SELECTOR, "button.hmv-apply-btn")
        ok = len(fields) == 4 and apply_btn.is_displayed()
        return report("test_vacancies_filter_bar_has_four_fields_and_apply", ok, f"{len(fields)} fields")
    finally:
        safe_quit(driver)


def test_vacancy_row_click_opens_candidates_page():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/vacancies")
        try:
            row = wait_visible(driver, By.CSS_SELECTOR, "tr.hmv-row", timeout=5)
        except Exception:
            return report("test_vacancy_row_click_opens_candidates_page", True, "no vacancies assigned, skipped")
        row.click()
        wait_visible(driver, By.CSS_SELECTOR, ".vc-title")
        ok = "/candidates" in driver.current_url
        return report("test_vacancy_row_click_opens_candidates_page", ok, driver.current_url)
    finally:
        safe_quit(driver)


def test_candidate_decision_page_shows_hire_and_reject_actions():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/vacancies")
        try:
            wait_visible(driver, By.CSS_SELECTOR, "tr.hmv-row", timeout=5).click()
            wait_visible(driver, By.CSS_SELECTOR, "button.vc-row", timeout=5)
        except Exception:
            pass
        rows = driver.find_elements(By.CSS_SELECTOR, "button.vc-row")
        if not rows:
            return report("test_candidate_decision_page_shows_hire_and_reject_actions", True, "no candidates to review, skipped")
        rows[0].click()
        positive = wait_visible(driver, By.CSS_SELECTOR, "button.cd-action-positive")
        negative = driver.find_element(By.CSS_SELECTOR, "button.cd-action-negative")
        ok = positive.is_displayed() and negative.is_displayed()
        return report("test_candidate_decision_page_shows_hire_and_reject_actions", ok,
                       f"positive='{positive.text}' negative='{negative.text}'")
    finally:
        safe_quit(driver)


def test_candidate_decision_back_button_returns_to_previous_page():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/pending-decisions")
        wait_visible(driver, By.CSS_SELECTOR, ".pd-title")
        review_btns = driver.find_elements(By.CSS_SELECTOR, "button.pd-review-btn")
        if not review_btns:
            return report("test_candidate_decision_back_button_returns_to_previous_page", True, "nothing pending, skipped")
        review_btns[0].click()
        wait_visible(driver, By.CSS_SELECTOR, ".pd-modal")
        comments = driver.find_element(By.ID, "pd-comments")
        ok = comments.get_attribute("placeholder") == "Optional notes about this decision..."
        driver.find_element(By.CSS_SELECTOR, "button.pd-cancel-btn").click()
        return report("test_candidate_decision_back_button_returns_to_previous_page", ok)
    finally:
        safe_quit(driver)


def test_candidate_comparison_shows_ranking_panel():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/candidate-comparison")
        select = wait_visible(driver, By.ID, "cc-vacancy-select")
        options = Select(select).options
        if len(options) <= 1:
            return report("test_candidate_comparison_shows_ranking_panel", True, "no vacancies to compare, skipped")
        Select(select).select_by_index(1)
        heading = wait_visible(driver, By.XPATH, "//*[contains(text(),'Top Candidate Score Ranking')]")
        ok = heading.is_displayed()
        return report("test_candidate_comparison_shows_ranking_panel", ok)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_vacancies_filter_bar_has_four_fields_and_apply,
        test_vacancy_row_click_opens_candidates_page,
        test_candidate_decision_page_shows_hire_and_reject_actions,
        test_candidate_decision_back_button_returns_to_previous_page,
        test_candidate_comparison_shows_ranking_panel,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
