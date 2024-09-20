Assignment 1 - Web Server - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Jack Dunlop
- **Student number:** N11431415
- **Application name:** Video Transcoding (on ec2 says socialmediaplatform, changed ideas later)
- **Two line description:** Simple video transcoding platform with unique users via a mysql database and the ability to stream videos.


Core criteria
------------------------------------------------

### Docker image

- **ECR Repository name:** it is n11431415 and url is901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11431415:latest
- **Video timestamp:** 0:01:47
- **Relevant files:**
    - backend/Dockerfile
    - frontend/Dockerfile

### Docker image running on EC2

- **EC2 instance ID:** i-0a1cf7ecefafd443b (n11431415-assignment)
- **Video timestamp:** 0:02:06

### User login functionality

- **One line description:** Mysql database unique storing and login, also using JWT tokens.
- **Video timestamp:** 0:00:06-0:00:19
- **Relevant files:**
    - backend/routes/users.ts

### User dependent functionality

- **One line description:** User can only access the videos that they have uploaded.
- **Video timestamp:** 0:04:30
- **Relevant files:**
    - backend/routes/users.ts

### Web client

- **One line description:** Single page application using React
- **Video timestamp:** All throughout video
- **Relevant files:**
    - frontend/src/ (everything in there)

### REST API

- **One line description:** REST API with endpoints, and HTTP methods (GET, POST, PUT, DELETE), and appropriate status codes.
- **Video timestamp:** All throughout video see 0:00:29 for looking at terminal with some.
- **Relevant files:**
    - backend/routes/  (everything in there)

### Two kinds of data

#### First kind

- **One line description:** Video files
- **Type:** unstructured (unqiue files for each user)
- **Rationale:** Videos are too large for database so I store them in file structure.
- **Video timestamp:** 0:00:24
- **Relevant files:**
    - backend/routes/upload.ts
    - backend/database.sql
    - backend/route/database.ts
    - backend/route/databasetypes.ts

#### Second kind

- **One line description:** Uploaded Video metadata.
- **Type:** Structured, no ACID requirements
- **Rationale:** Need for querying and users to select a video to transcode with relevant metadata.
- **Video timestamp:** 0:00:24
- **Relevant files:**
    - backend/routes/upload.ts
    - backend/database.sql
    - backend/route/database.ts
    - backend/route/databasetypes.ts

#### Third kind

- **One line description:** Transcoded Video Metadata.
- **Type:** Structured, no ACID requirements
- **Rationale:** Need video transcoding metadata for users to see what they have transcoded and it is used from streaming the video.
- **Video timestamp:** 0:00:36
- **Relevant files:**
  - backend/routes/transcode.ts
  - backend/database.sql
  - backend/route/database.ts
  - backend/route/databasetypes.ts

### CPU intensive task

- **One line description:** Video Transcoding using FFMPEG, user can upload a video after creating a account and transcode a video then stream it.
- **Video timestamp:** 0:00:36
- **Relevant files:**
    - backend/routes/transcode.ts

### CPU load testing method

- **One line description:**
- **Video timestamp:** 0:01:30 and 0:04:42
- **Relevant files:**
    - backend\loadtesting.py

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Use of middleware, CORS and JWT
- **Video timestamp:** 0:00:12
- **Relevant files:**
    - backend/middleware


### Use of external API(s)

- **One line description:** Youtube API for recommending videos based on the uploaded file name.
- **Video timestamp:**
- **Relevant files:**
    - frontend\src\pages\Stream.jsx


### Extensive web client features

- **One line description:** Single page application via react, video streaming, video recommendations, good simple design with tables that use pagenation.
- **Video timestamp:** Video Stream at 0:04:17 and good design and extra features all throughout 
- **Relevant files:**
    - frontend\src\


### Sophisticated data visualisations

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Additional kinds of data 

- **One line description:** Transcoded Video Metadata.
- **Type:** Structured, no ACID requirements
- **Rationale:** Need video transcoding metadata for users to see what they have transcoded and it is used from streaming the video.
- **Video timestamp:**
- **Relevant files:**
  - backend/routes/transcode.ts
  - backend/database.sql
  - backend/route/database.ts
  - backend/route/databasetypes.ts



### Significant custom processing

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Live progress indication

- **One line description:** Simple polling route.
- **Video timestamp:**  0:00:49
- **Relevant files:** 
    - transcode.ts


### Infrastructure as code

- **One line description:** Docker-compose working for front-end, back-end and mysql database.
- **Video timestamp:** 0:01:13
- **Relevant files:** 
    - docker-compose.yml


### Other

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 
