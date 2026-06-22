import asyncio
import httpx
import sys

async def test_vulnascan_api():
    print("Testing VulnaScan API endpoints...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Start a scan on OWASP/NodeGoat with a branch and diff-only enabled
        payload = {
            "repo_url": "https://github.com/OWASP/NodeGoat",
            "branch": "master",
            "scan_diff_only": True
        }
        print(f"Starting scan with payload: {payload}")
        try:
            res = await client.post("http://localhost:8000/api/scan", json=payload)
            if res.status_code != 200:
                print(f"FAIL: Start scan failed with status {res.status_code}: {res.text}")
                sys.exit(1)
            
            scan_data = res.json()
            scan_id = scan_data["scan_id"]
            print(f"SUCCESS: Scan started. ID: {scan_id}, Initial Status: {scan_data['status']}")
            
            # 2. Poll for scan completion
            while True:
                poll_res = await client.get(f"http://localhost:8000/api/scan/{scan_id}")
                if poll_res.status_code != 200:
                    print(f"FAIL: Poll failed: {poll_res.text}")
                    sys.exit(1)
                
                status_data = poll_res.json()
                print(f"Status: {status_data['status']} - {status_data['progress_message']}")
                
                if status_data["status"] == "complete":
                    print("SUCCESS: Scan completed successfully!")
                    result = status_data["result"]
                    findings = result["findings"]
                    print(f"Total findings: {len(findings)}")
                    
                    # Verify branch, pr_number, scan_diff_only are in the response
                    print(f"Response details: branch={result.get('branch')}, pr_number={result.get('pr_number')}, scan_diff_only={result.get('scan_diff_only')}")
                    
                    # Verify triage fields in findings
                    if findings:
                        sample = findings[0]
                        print("\nSample Finding Details:")
                        print(f"  File: {sample['file_path']}:{sample['start_line']}")
                        print(f"  Scanner: {sample['scanner']}")
                        print(f"  Severity: {sample['severity']}")
                        print(f"  AI Triage: {sample.get('triage_status')}")
                        print(f"  AI Reason: {sample.get('triage_reason')}")
                        print(f"  AI Explanation: {sample.get('explanation')[:100]}...")
                        
                        # 3. Test the single-finding retry explanation endpoint
                        print("\nTesting single-finding explain retry endpoint...")
                        retry_res = await client.post("http://localhost:8000/api/findings/explain", json=sample)
                        if retry_res.status_code == 200:
                            retried_finding = retry_res.json()
                            print(f"SUCCESS: Single-finding explanation retry endpoint returned status 200.")
                            print(f"  Retried Triage Status: {retried_finding.get('triage_status')}")
                            print(f"  Retried Explanation: {retried_finding.get('explanation')[:100]}...")
                        else:
                            print(f"FAIL: Single-finding retry endpoint failed: {retry_res.status_code} - {retry_res.text}")
                    else:
                        print("No findings returned (which is expected if no matching modified lines were found in the master branch comparison).")
                    break
                
                if status_data["status"] == "failed":
                    print(f"FAIL: Scan failed: {status_data['error']}")
                    sys.exit(1)
                
                await asyncio.sleep(2)
        except Exception as e:
            print(f"Error during API testing: {e}")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_vulnascan_api())
