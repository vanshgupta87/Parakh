import os
import sys

os.environ['PARAKH_TEST_MODE'] = '1'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from starlette.requests import Request
from starlette.responses import Response
from routers.auth_router import login, LoginRequest, get_current_user_profile
from auth.dependencies import get_current_user

def test_role(email, password, expected_role):
    req_login = Request({'type': 'http', 'client': ('127.0.0.1', 12345), 'headers': []})
    resp_login = Response()
    res = login(LoginRequest(email=email, password=password), req_login, resp_login)
    token = res['session_token']
    assert token, f"No session token returned for {email}"

    # Verify via Bearer header
    req_bearer = Request({'type': 'http', 'headers': [(b'authorization', f'Bearer {token}'.encode())]})
    user = get_current_user(req_bearer)
    profile = get_current_user_profile(user)
    assert profile['user']['role'] == expected_role, f"Expected {expected_role}, got {profile['user']['role']}"
    
    # Verify via Cookie
    req_cookie = Request({'type': 'http', 'headers': [(b'cookie', f'parakh_session={token}'.encode())]})
    user_c = get_current_user(req_cookie)
    profile_c = get_current_user_profile(user_c)
    assert profile_c['user']['role'] == expected_role
    
    print(f"[PASS] {expected_role.upper()} auth verified via both Bearer and Cookie: {email}")

if __name__ == '__main__':
    test_role('patient@parakh.org', 'Patient@Parakh2026!', 'patient')
    test_role('doctor@parakh.org', 'Doctor@Parakh2026!', 'doctor')
    test_role('admin@parakh.org', 'Admin@Parakh2026!', 'admin')
    print("ALL ROLES AUTHENTICATION VERIFIED SUCCESSFULLY!")
