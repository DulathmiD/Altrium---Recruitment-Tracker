"""
Automated UI tests for the HR Vacancies screen (department grid, list,
create, edit), Recruitment Tracker.

Same requirements as test_login.py:
  1. Backend running:  cd backend  && npm run dev   (http://localhost:4000)
  2. Frontend running: cd frontend && npm run dev   (http://localhost:5173)
  3. python -m pip install selenium

Run with:  python test_vacancies.py
"""

import sys
import time
import urllib.request
import urllib.error
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

BASE_URL = "http://localhost:5173"


def check_servers_are_up():
    """Ping backend + frontend before opening any browser, so a down server
    fails with a clear message instead of a confusing Selenium stack trace."""
    problems = []
    try:
        urllib.request.urlopen("http://localhost:4000/api/health", timeout=3)
    except (urllib.error.URLError, ConnectionError):
        problems.append("Backend is NOT reachable at http://localhost:4000 -- start it: cd backend && npm run dev")
    try:
        urllib.request.urlopen("http://localhost:5173", timeout=3)
    except (urllib.error.URLError, ConnectionError):
        problems.append("Frontend is NOT reachable at http://localhost:5173 -- start it: cd frontend && npm run dev")

    if problems:
        print("\nCan't run tests -- fix this first:\n")
        for p in problems:
            print(f"  - {p}")
        print()
        sys.exit(1)
    print("Backend and frontend are both up. Starting tests...\n")
PAUSE_SECONDS = 3  # how long to leave the browser open after each test


def new_driver():
    driver = webdriver.Chrome()
    driver.maximize_window()
    return driver


def login_as_hr(driver):
    driver.get(f"{BASE_URL}/login")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "email")))
    driver.find_element(By.ID, "email").send_keys("hr@altrium.test")
    driver.find_element(By.ID, "password").send_keys("password123")
    driver.find_element(By.CSS_SELECTOR, "button.login-button").click()
    WebDriverWait(driver, 5).until(EC.url_contains("/hr/vacancies"))


def open_department(driver, department_name):
    card = WebDriverWait(driver, 5).until(
        EC.element_to_be_clickable((By.XPATH, f"//button[contains(@class,'vac-dept-card') and text()='{department_name}']"))
    )
    card.click()


def report(name, passed, detail=""):
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] {name}" + (f" -- {detail}" if detail else ""))


def test_department_grid_shows_all_departments():
    driver = new_driver()
    try:
        login_as_hr(driver)
        cards = driver.find_elements(By.CSS_SELECTOR, ".vac-dept-card")
        names = [c.text for c in cards]
        expected = ["HR", "Finance and Accounting", "Operations", "Marketing", "Sales", "IT", "Customer Service", "Legal"]
        ok = all(dept in names for dept in expected)
        report("Vacancies.1 department grid shows all 8 departments", ok, names)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_open_department_shows_list_and_create_button():
    driver = new_driver()
    try:
        login_as_hr(driver)
        open_department(driver, "IT")
        heading = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".vac-title")))
        create_btn = driver.find_element(By.CSS_SELECTOR, ".vac-create-btn")
        ok = heading.text == "IT" and create_btn.is_displayed()
        report("Vacancies.2 opening a department shows its heading + Create Vacancy button", ok, heading.text)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_create_vacancy_validation_blocks_empty_form():
    driver = new_driver()
    try:
        login_as_hr(driver)
        open_department(driver, "IT")
        driver.find_element(By.CSS_SELECTOR, ".vac-create-btn").click()
        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".vac-modal")))
        driver.find_element(By.CSS_SELECTOR, ".vac-save-btn").click()
        error = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".vac-modal .vac-error")))
        ok = "required" in error.text.lower()
        report("Vacancies.3 saving an empty vacancy form shows a validation error", ok, error.text)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_create_vacancy_appears_in_list():
    driver = new_driver()
    title = f"Selenium Test Role {int(time.time())}"
    try:
        login_as_hr(driver)
        open_department(driver, "IT")
        driver.find_element(By.CSS_SELECTOR, ".vac-create-btn").click()
        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "vac-title-input")))
        driver.find_element(By.ID, "vac-title-input").send_keys(title)
        driver.find_element(By.ID, "vac-description-input").send_keys("Created by an automated Selenium test.")
        driver.find_element(By.CSS_SELECTOR, ".vac-save-btn").click()
        WebDriverWait(driver, 5).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".vac-modal")))
        rows = driver.find_elements(By.CSS_SELECTOR, ".vac-row-title")
        ok = any(r.text == title for r in rows)
        report("Vacancies.4 creating a vacancy adds it to the department's list", ok, title)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_edit_vacancy_updates_title():
    driver = new_driver()
    original_title = f"Selenium Edit Me {int(time.time())}"
    updated_title = original_title + " (edited)"
    try:
        login_as_hr(driver)
        open_department(driver, "IT")

        # create one to edit
        driver.find_element(By.CSS_SELECTOR, ".vac-create-btn").click()
        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "vac-title-input")))
        driver.find_element(By.ID, "vac-title-input").send_keys(original_title)
        driver.find_element(By.ID, "vac-description-input").send_keys("Will be edited by Selenium.")
        driver.find_element(By.CSS_SELECTOR, ".vac-save-btn").click()
        WebDriverWait(driver, 5).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".vac-modal")))

        # find its row and click the edit pencil
        row = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, f"//div[@data-testid='vac-row'][.//span[text()='{original_title}']]"))
        )
        row.find_element(By.CSS_SELECTOR, ".vac-edit-btn").click()

        title_input = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "vac-title-input")))
        title_input.clear()
        title_input.send_keys(updated_title)
        driver.find_element(By.CSS_SELECTOR, ".vac-save-btn").click()
        WebDriverWait(driver, 5).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".vac-modal")))

        rows = driver.find_elements(By.CSS_SELECTOR, ".vac-row-title")
        ok = any(r.text == updated_title for r in rows)
        report("Vacancies.5 editing a vacancy updates its title in the list", ok, updated_title)
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


def test_back_button_returns_to_department_grid():
    driver = new_driver()
    try:
        login_as_hr(driver)
        open_department(driver, "IT")
        driver.find_element(By.CSS_SELECTOR, ".vac-back").click()
        cards = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".vac-dept-card"))
        )
        ok = len(cards) == 8
        report("Vacancies.6 back button returns to the department grid", ok, f"{len(cards)} cards shown")
    finally:
        time.sleep(PAUSE_SECONDS)
        driver.quit()


if __name__ == "__main__":
    check_servers_are_up()
    test_department_grid_shows_all_departments()
    test_open_department_shows_list_and_create_button()
    test_create_vacancy_validation_blocks_empty_form()
    test_create_vacancy_appears_in_list()
    test_edit_vacancy_updates_title()
    test_back_button_returns_to_department_grid()
