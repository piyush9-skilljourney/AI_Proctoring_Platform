import requests

def test_api():
    base_url = "http://127.0.0.1:8000/api/interviews"
    
    # 1. Login to get token
    login_res = requests.post(f"{base_url}/admin/login", data={"username": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.text}")
        return
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Fetch Invitations
    inv_res = requests.get(f"{base_url}/admin/interviews", headers=headers)
    print(f"Invitations Status: {inv_res.status_code}")
    print("Invitations Data:")
    import json
    print(json.dumps(inv_res.json(), indent=2))

if __name__ == "__main__":
    test_api()
