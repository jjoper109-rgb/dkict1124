import argparse
import getpass
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


LOGIN_URL = "http://gw.e-dk.co.kr/LoginInfo/"
CONFIG_PATH = Path(__file__).with_name("gw_login_config.json")
EDGE_PROFILE_DIR = Path(__file__).with_name("edge-automation-profile")


def load_config():
    if not CONFIG_PATH.exists():
        return {}

    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_args():
    parser = argparse.ArgumentParser(description="DK groupware login automation")
    parser.add_argument("--employee-no", help="Groupware employee number")
    parser.add_argument("--password", help="Groupware password")
    parser.add_argument("--headless", action="store_true", help="Run without showing the browser")
    parser.add_argument("--timeout", type=int, default=30, help="Login timeout in seconds")
    return parser.parse_args()


def resolve_credentials(args, config):
    employee_no = args.employee_no or config.get("employee_no") or input("사번: ").strip()
    password = args.password or config.get("password") or getpass.getpass("비밀번호: ")

    if not employee_no:
        raise ValueError("사번이 비어 있습니다.")
    if not password:
        raise ValueError("비밀번호가 비어 있습니다.")

    return employee_no, password


def click_login(page):
    button = page.locator("#btnLogin")
    if button.count() != 1:
        raise RuntimeError("로그인 버튼(#btnLogin)을 찾지 못했습니다.")

    button.click()


def wait_for_login_result(page, timeout_seconds):
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        url = page.url.lower()
        if "/gwindex" in url or "/gwmain" in url:
            return True

        body_text = ""
        try:
            body_text = page.locator("body").inner_text(timeout=1000)
        except PlaywrightTimeoutError:
            pass

        if "사번과 비밀번호를 확인" in body_text:
            raise RuntimeError("로그인 실패: 사번 또는 비밀번호를 확인해야 합니다.")
        if "리캡챠" in body_text or "recaptcha" in body_text.lower():
            raise RuntimeError("로그인 실패: 리캡챠 확인이 필요합니다.")
        if "googleotp" in url:
            raise RuntimeError("로그인 실패: Google OTP 확인이 필요합니다.")
        if "accessip" in url:
            raise RuntimeError("로그인 실패: 접속 IP 확인이 필요합니다.")
        if "password.aspx" in url:
            raise RuntimeError("로그인 실패: 비밀번호 변경 화면으로 이동했습니다.")

        page.wait_for_timeout(300)

    raise TimeoutError(f"{timeout_seconds}초 안에 로그인 완료 화면으로 이동하지 않았습니다. 현재 URL: {page.url}")


def find_edge_executable():
    candidates = [
        Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
        Path("C:/Program Files/Microsoft/Edge/Application/msedge.exe"),
        Path.home() / "AppData/Local/Microsoft/Edge/Application/msedge.exe",
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    return "msedge"


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_cdp(port, timeout_seconds=10):
    deadline = time.time() + timeout_seconds
    url = f"http://127.0.0.1:{port}/json/version"

    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1):
                return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.2)

    raise TimeoutError("Edge 원격 제어 연결 준비 시간이 초과되었습니다.")


def launch_detached_edge(port):
    EDGE_PROFILE_DIR.mkdir(exist_ok=True)
    command = [
        find_edge_executable(),
        f"--remote-debugging-port={port}",
        f"--user-data-dir={EDGE_PROFILE_DIR}",
        "--new-window",
        "about:blank",
    ]

    creation_flags = 0
    if sys.platform.startswith("win"):
        creation_flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=creation_flags,
    )
    wait_for_cdp(port)


def fill_login_form(page, employee_no, password, timeout_seconds):
    print("[1/4] 그룹웨어 로그인 페이지 접속")
    page.goto(LOGIN_URL, wait_until="domcontentloaded")

    print("[2/4] 사번/비밀번호 입력")
    page.locator("#txtID").fill(employee_no)
    page.locator("#txtPW").fill(password)

    print("[3/4] 로그인 버튼 클릭")
    click_login(page)

    print("[4/4] 로그인 결과 대기")
    wait_for_login_result(page, timeout_seconds)

    print(f"로그인 완료: {page.url}")


def login(employee_no, password, headless=False, timeout_seconds=30):
    with sync_playwright() as playwright:
        if headless:
            browser = playwright.chromium.launch(channel="msedge", headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            fill_login_form(page, employee_no, password, timeout_seconds)
            context.close()
            browser.close()
            return

        port = find_free_port()
        launch_detached_edge(port)
        browser = playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
        context = browser.contexts[0] if browser.contexts else browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        fill_login_form(page, employee_no, password, timeout_seconds)
        print("자동로그인은 끝났고 Edge는 독립 실행 상태로 남겨둡니다.")


def main():
    args = build_args()
    config = load_config()

    try:
        employee_no, password = resolve_credentials(args, config)
        login(employee_no, password, headless=args.headless, timeout_seconds=args.timeout)
    except Exception as error:
        print(f"오류: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
