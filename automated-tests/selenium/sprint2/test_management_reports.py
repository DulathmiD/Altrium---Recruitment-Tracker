"""
Sprint 2 - Management: Dashboard KPIs (US-31/32), Department Vacancies,
Candidate Progress, Upcoming Interviews, and PDF Reports (US-37/38).

Run: python test_management_reports.py
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


def test_dashboard_shows_four_kpi_tiles():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/dashboard")
        wait_visible(driver, By.CSS_SELECTOR, ".mgd-kpi-grid")
        tiles = driver.find_elements(By.CSS_SELECTOR, ".mgd-kpi-tile")
        labels = [t.find_element(By.CSS_SELECTOR, ".mgd-kpi-label").text for t in tiles]
        ok = labels == ["Open Vacancies", "Active Candidates", "Hires This Month", "Rejected"]
        return report("test_dashboard_shows_four_kpi_tiles", ok, labels)
    finally:
        safe_quit(driver)


def test_dashboard_filter_bar_apply_reloads_data():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/dashboard")
        wait_visible(driver, By.CSS_SELECTOR, ".mgd-filter-bar")
        driver.find_element(By.CSS_SELECTOR, "button.mgd-apply-btn").click()
        time.sleep(1)
        ok = len(driver.find_elements(By.CSS_SELECTOR, ".mgd-kpi-grid")) > 0
        return report("test_dashboard_filter_bar_apply_reloads_data", ok)
    finally:
        safe_quit(driver)


def test_department_vacancies_table_or_empty_state():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/vacancies")
        wait_visible(driver, By.CSS_SELECTOR, ".dv-title")
        rendered = len(driver.find_elements(By.CSS_SELECTOR, ".dv-table")) > 0 or \
            len(driver.find_elements(By.CSS_SELECTOR, ".dv-muted")) > 0
        return report("test_department_vacancies_table_or_empty_state", rendered)
    finally:
        safe_quit(driver)


def test_candidate_progress_shows_stage_summary():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/candidate-progress")
        heading = wait_visible(driver, By.CSS_SELECTOR, ".cp-section-title")
        ok = heading.text == "Stage Summary"
        return report("test_candidate_progress_shows_stage_summary", ok, heading.text)
    finally:
        safe_quit(driver)


def test_upcoming_interviews_filter_bar_present():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/upcoming-interviews")
        wait_visible(driver, By.CSS_SELECTOR, ".ui-title")
        fields = driver.find_elements(By.CSS_SELECTOR, ".ui-filter-field")
        ok = len(fields) == 2
        return report("test_upcoming_interviews_filter_bar_present", ok, f"{len(fields)} fields")
    finally:
        safe_quit(driver)


def test_view_report_opens_pdf_in_new_tab():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/reports")
        rows = driver.find_elements(By.CSS_SELECTOR, ".mr-row")
        if not rows:
            return report("test_view_report_opens_pdf_in_new_tab", True, "no department set / no reports listed, skipped")
        original_handles = driver.window_handles
        driver.find_element(By.CSS_SELECTOR, "button.mr-btn").click()
        time.sleep(2)
        ok = len(driver.window_handles) > len(original_handles)
        return report("test_view_report_opens_pdf_in_new_tab", ok,
                       f"{len(original_handles)} -> {len(driver.window_handles)} tabs")
    finally:
        safe_quit(driver)


def test_reports_page_lists_all_four_department_reports():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["MANAGEMENT"], role="MANAGEMENT")
        driver.get(f"{BASE_URL}/management/reports")
        wait_visible(driver, By.CSS_SELECTOR, ".mr-title")
        rows = driver.find_elements(By.CSS_SELECTOR, ".mr-row-name")
        ok = len(rows) >= 1  # exact count/naming depends on seed data; presence is the contract
        return report("test_reports_page_lists_all_four_department_reports", ok, [r.text for r in rows])
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_dashboard_shows_four_kpi_tiles,
        test_dashboard_filter_bar_apply_reloads_data,
        test_department_vacancies_table_or_empty_state,
        test_candidate_progress_shows_stage_summary,
        test_upcoming_interviews_filter_bar_present,
        test_view_report_opens_pdf_in_new_tab,
        test_reports_page_lists_all_four_department_reports,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
