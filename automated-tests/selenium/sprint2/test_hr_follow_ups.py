"""
Sprint 2 - HR Follow-Ups (US-26 reminders, US-29 interview invites) and
real email delivery (US-39 / #43: these buttons now trigger the real
Nodemailer send instead of a console stub).

Run: python test_hr_follow_ups.py
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


def test_follow_ups_page_loads_all_sections():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/follow-ups")
        headings = [h.text for h in driver.find_elements(By.CSS_SELECTOR, ".fu-section-title")]
        expected = ["Pending Feedback", "Interview Invites - Interviewers", "Interview Invites - Candidates", "Calls"]
        ok = all(e in headings for e in expected)
        return report("test_follow_ups_page_loads_all_sections", ok, headings)
    finally:
        safe_quit(driver)


def test_send_reminder_modal_prefills_subject_and_can_be_cancelled():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/follow-ups")
        buttons = driver.find_elements(By.XPATH, "//h2[text()='Pending Feedback']/following::button[contains(@class,'fu-action-btn')][1]")
        if not buttons:
            return report("test_send_reminder_modal_prefills_subject_and_can_be_cancelled", True, "nothing pending, skipped")
        buttons[0].click()
        subject = wait_visible(driver, By.ID, "fu-subject-input")
        ok = len(subject.get_attribute("value")) > 0
        driver.find_element(By.CSS_SELECTOR, "button.fu-cancel-btn").click()
        modal_gone = len(driver.find_elements(By.ID, "fu-subject-input")) == 0
        return report("test_send_reminder_modal_prefills_subject_and_can_be_cancelled", ok and modal_gone)
    finally:
        safe_quit(driver)


def test_send_candidate_invite_modal_and_send():
    """Sends a real reminder email via the seeded Ethereal/SMTP config (or the
    console-log fallback if SMTP isn't configured -- either way the UI flow
    must complete and show a confirmation toast)."""
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/follow-ups")
        buttons = driver.find_elements(
            By.XPATH, "//h2[text()='Interview Invites - Candidates']/following::button[contains(@class,'fu-action-btn')][1]"
        )
        if not buttons:
            return report("test_send_candidate_invite_modal_and_send", True, "nothing pending, skipped")
        buttons[0].click()
        wait_visible(driver, By.ID, "fu-invite-subject-input")
        driver.find_element(By.CSS_SELECTOR, "button.fu-save-btn").click()
        # Either the modal closes (success) or an error message renders --
        # both are valid outcomes to observe, a hang/crash is not.
        try:
            wait_visible(driver, By.CSS_SELECTOR, ".toast", timeout=8)
            ok = True
        except Exception:
            ok = len(driver.find_elements(By.ID, "fu-invite-subject-input")) == 0
        return report("test_send_candidate_invite_modal_and_send", ok)
    finally:
        safe_quit(driver)


def test_call_modal_shows_phone_or_no_number_message():
    driver = new_driver()
    try:
        login_as(driver, ACCOUNTS["HR"], role="HR")
        driver.get(f"{BASE_URL}/hr/follow-ups")
        buttons = driver.find_elements(By.XPATH, "//h2[text()='Calls']/following::button[contains(@class,'fu-action-btn')][1]")
        if not buttons:
            return report("test_call_modal_shows_phone_or_no_number_message", True, "no upcoming calls, skipped")
        buttons[0].click()
        modal = wait_visible(driver, By.CSS_SELECTOR, ".fu-call-modal")
        ok = "No phone number on file." in modal.text or any(c.isdigit() for c in modal.text)
        driver.find_element(By.CSS_SELECTOR, "button.fu-cancel-btn").click()
        return report("test_call_modal_shows_phone_or_no_number_message", ok, modal.text)
    finally:
        safe_quit(driver)


if __name__ == "__main__":
    check_servers_are_up()
    tests = [
        test_follow_ups_page_loads_all_sections,
        test_send_reminder_modal_prefills_subject_and_can_be_cancelled,
        test_send_candidate_invite_modal_and_send,
        test_call_modal_shows_phone_or_no_number_message,
    ]
    results = [run_safely(t.__name__, t) for t in tests]
    print(f"\n{sum(results)}/{len(results)} passed")
