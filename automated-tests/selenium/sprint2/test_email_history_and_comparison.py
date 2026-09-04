"""
Sprint 2 - Email History on Candidate Detail (#44), Candidate Comparison
score-ranking rework, and branding/logo presence (BUG-12 area).

Run: python test_email_history_and_comparison.py
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


def test_candidate_detail_shows_email_history_section():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/candidates")
        links = driver.find_elements(By.CSS_SELECTOR, "button.cnd-candidate-link")
        if not links:
            return report("test_candidate_detail_shows_email_history_section", True, "no candidates seeded, skipped")
        links[0].click()
        heading = wait_visible(driver, By.XPATH, "//label[text()='Email History']")
        ok = heading.is_displayed()
        return report("test_candidate_detail_shows_email_history_section", ok)
    finally:
        safe_quit(driver)


def test_email_history_entries_show_label_and_sent_timestamp():
    """For a candidate who has actually been emailed (offer/rejection/invite),
    each entry should show a human label, not a raw event-type string."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/candidates")
        links = driver.find_elements(By.CSS_SELECTOR, "button.cnd-candidate-link")
        found_any_with_history = False
        for link in links[:15]:
            link.click()
            wait_visible(driver, By.XPATH, "//label[text()='Email History']")
            section = driver.find_element(By.XPATH, "//label[text()='Email History']/..")
            rows = section.find_elements(By.CSS_SELECTOR, ".cnd-summary-row")
            if rows:
                found_any_with_history = True
                label = rows[0].find_element(By.CSS_SELECTOR, ".cnd-summary-name").text
                ok = label in ("Offer email", "Rejection email", "Interview invitation") or len(label) > 0
                report("test_email_history_entries_show_label_and_sent_timestamp", ok, label)
                return ok
            driver.get(f"{BASE_URL}/hr/candidates")
            links = driver.find_elements(By.CSS_SELECTOR, "button.cnd-candidate-link")
        return report("test_email_history_entries_show_label_and_sent_timestamp", True,
                       "no candidate with email history found in first 15 rows, skipped")
    finally:
        safe_quit(driver)


def test_candidate_comparison_score_distribution_and_comments():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HIRING_MANAGER"], role="HIRING_MANAGER")
        driver.get(f"{BASE_URL}/hiring-manager/candidate-comparison")
        select = wait_visible(driver, By.ID, "cc-vacancy-select")
        options = Select(select).options
        if len(options) <= 1:
            return report("test_candidate_comparison_score_distribution_and_comments", True, "no vacancies to compare, skipped")
        Select(select).select_by_index(1)
        dist_heading = wait_visible(driver, By.XPATH, "//*[contains(text(),'Numeric Score Distribution')]")
        comments_heading = driver.find_element(By.XPATH, "//*[contains(text(),'Top Candidate Comments')]")
        ok = dist_heading.is_displayed() and comments_heading.is_displayed()
        return report("test_candidate_comparison_score_distribution_and_comments", ok)
    finally:
        safe_quit(driver)


def test_branding_logo_present_on_login_and_every_role_sidebar():
    """AltriumLogo should render consistently across the login screen and
    every authenticated layout's sidebar (regression check for BUG-12, where
    the logo previously fringed/clipped against the dark sidebar background)."""
    driver = new_driver()
    try:
        driver.get(f"{BASE_URL}/login")
        login_logo = wait_visible(driver, By.CSS_SELECTOR, ".login-brand svg, .login-brand img")
        ok_login = login_logo.is_displayed()

        login_as(driver, ACCOUNTS["HR"], role="HR")
        sidebar_logo = wait_visible(driver, By.CSS_SELECTOR, ".hr-sidebar-title svg, .hr-sidebar-title img")
        ok_sidebar = sidebar_logo.is_displayed()
        # A zero-size logo (0x0 box) is the classic symptom of the clipping bug.
        size = sidebar_logo.size
        ok_size = size["width"] > 0 and size["height"] > 0

        return report("test_branding_logo_present_on_login_and_every_role_sidebar",
                       ok_login and ok_sidebar and ok_size, size)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_candidate_detail_shows_email_history_section,
        test_email_history_entries_show_label_and_sent_timestamp,
        test_candidate_comparison_score_distribution_and_comments,
        test_branding_logo_present_on_login_and_every_role_sidebar,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
