import requests
import json

def test_create_invite():
    base_url = "http://127.0.0.1:8000/api/interviews"
    
    # 1. Login
    login_res = requests.post(f"{base_url}/admin/login", data={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 2. Get Jobs to get a valid job_id
    jobs_res = requests.get(f"{base_url}/admin/jobs", headers=headers)
    jobs = jobs_res.json()
    if not jobs:
        print("No jobs found")
        return
    job_id = jobs[0]["id"]
    
    # 3. Create Invitation
    payload = {
        "candidate_name": "Test Candidate New",
        "candidate_email": "new.test@example.com",
        "job_id": job_id
    }
    create_res = requests.post(f"{base_url}/admin/interviews/create", headers=headers, json=payload)
    print(f"Create Status: {create_res.status_code}")
    print(json.dumps(create_res.json(), indent=2))

if __name__ == "__main__":
    test_create_invite()
