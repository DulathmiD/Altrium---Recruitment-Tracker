"""
Sprint 2 - Leadership: Recruitment Overview, org-wide Recruitment Progress
(US-35), Department Performance (US-35), Hiring Trends (US-36), and
Export Reports (US-37/38).

Run: python test_leadership_reports.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from helpers import (  # noqa: E402
    safe_quit,
    BASE_URL, ACCOUNTS, check_servers_are_up, new_driver, login_as,
    wait_visible, report, run_safely,
)
from selenium.webdriver.common.by import By  # noqa: E402


def test_dashboard_redirects_to_recruitment_overview():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        wait_visible(driver, By.CSS_SELECTOR, ".ro-title")
        ok = "/leadership-management/recruitment-overview" in driver.current_url
        return report("test_dashboard_redirects_to_recruitment_overview", ok, driver.current_url)
    finally:
        safe_quit(driver)


def test_recruitment_progress_page_loads():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        driver.get(f"{BASE_URL}/leadership-management/recruitment-progress")
        title = wait_visible(driver, By.CSS_SELECTOR, ".rp-title")
        ok = title.text == "Recruitment Progress"
        return report("test_recruitment_progress_page_loads", ok, title.text)
    finally:
        safe_quit(driver)


def test_department_performance_page_loads():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        driver.get(f"{BASE_URL}/leadership-management/department-performance")
        title = wait_visible(driver, By.CSS_SELECTOR, ".dp-title")
        ok = title.text == "Department Performance"
        return report("test_department_performance_page_loads", ok, title.text)
    finally:
        safe_quit(driver)


def test_hiring_trends_page_loads():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        driver.get(f"{BASE_URL}/leadership-management/hiring-trends")
        title = wait_visible(driver, By.CSS_SELECTOR, ".ht-title")
        ok = title.text == "Hiring Trends"
        return report("test_hiring_trends_page_loads", ok, title.text)
    finally:
        safe_quit(driver)


def test_export_reports_view_report_opens_new_tab():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        driver.get(f"{BASE_URL}/leadership-management/reports")
        wait_visible(driver, By.CSS_SELECTOR, ".er-title")
        rows = driver.find_elements(By.CSS_SELECTOR, ".er-row")
        if not rows:
            return report("test_export_reports_view_report_opens_new_tab", True, "no reports listed, skipped")
        original_handles = driver.window_handles
        driver.find_element(By.CSS_SELECTOR, "button.er-btn").click()
        time.sleep(2)
        ok = len(driver.window_handles) > len(original_handles)
        return report("test_export_reports_view_report_opens_new_tab", ok,
                       f"{len(original_handles)} -> {len(driver.window_handles)} tabs")
    finally:
        safe_quit(driver)


def test_leadership_nav_covers_all_five_sections():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["LEADERSHIP_MANAGEMENT"], role="LEADERSHIP_MANAGEMENT")
        wait_visible(driver, By.CSS_SELECTOR, ".ro-title")
        links = driver.find_elements(By.CSS_SELECTOR, "nav.ld-nav a")
        texts = {l.text.strip() for l in links if l.text.strip()}
        expected = {"Recruitment Overview", "Recruitment Progress", "Department Performance", "Hiring Trends", "Export Reports"}
        ok = expected.issubset(texts)
        return report("test_leadership_nav_covers_all_five_sections", ok, texts)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_dashboard_redirects_to_recruitment_overview,
        test_recruitment_progress_page_loads,
        test_department_performance_page_loads,
        test_hiring_trends_page_loads,
        test_export_reports_view_report_opens_new_tab,
        test_leadership_nav_covers_all_five_sections,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
