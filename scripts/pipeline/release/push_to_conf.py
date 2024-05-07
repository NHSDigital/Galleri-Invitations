import json
import os
import requests

CONFLUENCE_URL = "https://nhsd-confluence.digital.nhs.uk"
RELEASE_CONFLUENCE_PARENT_PAGE_ID = "821534639"
CONFLUENCE_SPACE = "~ABQA1"

def create_page_in_confluence(change_log_string, release_id):
    page_string = "<br /><ac:structured-macro ac:name='markdown'><ac:plain-text-body><![CDATA[" + \
        change_log_string + "]]></ac:plain-text-body></ac:structured-macro>\n"
    create_page_api_url = f"{CONFLUENCE_URL}/rest/api/content"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ.get('CONFLUENCE_API_TOKEN')}"
        }
    payload = {
        "type": "page",
        "title": "ABQA1 release page 3",
        "space": {"key": CONFLUENCE_SPACE},
        "ancestors": [{"id": RELEASE_CONFLUENCE_PARENT_PAGE_ID}],
        "body": {
            "storage": {
                "value": page_string,
                "representation": "storage"
            }
        }
    }
    resp = requests.post(url=create_page_api_url, headers=headers, data=json.dumps(payload), timeout=30)
    if resp.status_code == 200:
        return

    raise Exception(
        f"An Error occurred when uploading the changelist to confluence, Status Code: {resp.status_code}, {resp.text}")


if __name__ == "__main__":
    create_page_in_confluence("", "0.1.0")
    print("### Release Page Created ###")