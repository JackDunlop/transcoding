import requests
import json
from faker import Faker
import random
import string
import time
# done via chatgpt
# Configuration
TARGET = "http://ec2-13-210-63-62.ap-southeast-2.compute.amazonaws.com:3001"
MEDIUM_VIDEO_PATH = "../backend/SquattingontheSquatter.mp4"
# LARGE_VIDEO_PATH = "../backend/Large.mp4"

# Initialize Faker
fake = Faker()

def generate_unique_username(existing_usernames):
    username = fake.user_name()
    while username in existing_usernames:
        username = fake.user_name()
    return username

def generate_unique_email(existing_emails):
    email = fake.email()
    while email in existing_emails:
        email = fake.email()
    return email

def generate_dob():
    return fake.date_of_birth(minimum_age=18, maximum_age=70).strftime('%Y-%m-%d')

def generate_fullname():
    return fake.name()

def generate_password():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=12))

def generate_user_data(existing_usernames, existing_emails):
    username = generate_unique_username(existing_usernames)
    email = generate_unique_email(existing_emails)
    dob = generate_dob()
    fullname = generate_fullname()
    password = generate_password()

    return {
        'username': username,
        'email': email,
        'dob': dob,
        'fullname': fullname,
        'password': password
    }

def add_auth_header(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}

def RequestVideoTranscoding(video_path):
    existing_usernames = set()
    existing_emails = set()

    # Generate user data
    user_data = generate_user_data(existing_usernames, existing_emails)
    existing_usernames.add(user_data['username'])
    existing_emails.add(user_data['email'])

    # Register user
    register_response = requests.post(
        f"{TARGET}/users/register",
        headers={"Content-Type": "application/json"},
        data=json.dumps(user_data)
    )

    # Login user
    login_response = requests.post(
        f"{TARGET}/users/login",
        headers={"Content-Type": "application/json"},
        data=json.dumps({
            'username': user_data['username'],
            'password': user_data['password']
        })
    )
    login_response_data = login_response.json()
    jwt_token = login_response_data.get('jwtToken')

    if not jwt_token:
        print("Failed to get JWT token from login response.")
        return

    # Add Authorization header
    auth_header = add_auth_header(jwt_token)

    # Upload video
    with open(video_path, 'rb') as video_file:
        files = {
            'video': (video_path.split('/')[-1], video_file, 'video/mp4')
        }
        upload_response = requests.post(
            f"{TARGET}/upload/new",
            headers=auth_header,
            files=files
        )
    
    upload_response_data = upload_response.json()
    #print("Upload response:", upload_response_data)
    filename = upload_response_data.get('MetaData', {}).get('newFilename')
    #print(filename)
    if not filename:
        print("Failed to get filename from upload response.")
        return

    # Transcode video
    transcode_response = requests.post(
        f"{TARGET}/transcode/video/{filename}",
        headers=auth_header,
        json={
            "width": 180,
            "bitrate": 200000,
            "codec": "libx264",
            "format": "mp4",
            "framerate": 24,
            "height": 320
        }
    )
    transcode_response_data = transcode_response.json()
   # print(transcode_response_data)
    transcode_id = transcode_response_data.get('transcodeID')

    if not transcode_id:
        print("Failed to get transcode ID from transcoding response.")
        return

    # Poll for status
    while True:
        time.sleep(2)  # Wait for 5 seconds before polling
        poll_response = requests.get(
            f"{TARGET}/transcode/poll/{transcode_id}",
            headers=auth_header
        )
        # print(f"Status Code: {poll_response.status_code}")
        # print(f"Response Content: {poll_response.text}")
        poll_response_data = poll_response.json()
        #print(poll_response_data)
        progress = poll_response_data.get('progress')
        status = poll_response_data.get('status')
        
        print(f"Current progress: {progress}%")

        if status == 'finished' and progress == 100:
            print("Transcoding finished successfully.")
            break
        elif status == 'failed':
            print("Transcoding failed.")
            break

def main():
    # Call for medium video
    start_time_total = time.time()
    for i in range(2):
        start_time_medium = time.time()
        RequestVideoTranscoding(MEDIUM_VIDEO_PATH)
        end_time_medium = time.time()
        print(f' Time for {i}: {end_time_medium - start_time_medium}')
        # # Call for large video
    # start_time_large = time.time()
    # RequestVideoTranscoding(LARGE_VIDEO_PATH)
    end_time_total = time.time()
    print(f' Large Time: {end_time_total - start_time_total}')

if __name__ == "__main__":
    main()
