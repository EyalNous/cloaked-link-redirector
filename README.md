# Traffic Parameter Redirector & Mapping Service (POC)

This project is a Proof of Concept (POC) for a Node.js/TypeScript service that processes incoming web traffic, replaces specific source parameters with an internally generated, reversible parameter, and redirects the user to a configurable affiliate link. It also provides an API to retrieve the original parameters and a mechanism to refresh the internal parameter for a given set of inputs.

Built with Node.js, TypeScript, Express.js, Redis, and Dockerized for easy setup and deployment.

## Features


*  **Traffic Redirection:** Accepts requests with `keyword`, `src`, and `creative` query parameters.

*  **Parameter Encapsulation:** Replaces the source parameters with a single `our_param`.

*  **Consistent Mapping:** The same input triplet (`keyword`, `src`, `creative`) consistently maps to the same `our_param` unless refreshed.

*  **Reversibility:** API endpoint to retrieve original `keyword`, `src`, `creative` from an `our_param`.

*  **Mapping Refresh:** API endpoint to force a new `our_param` for an existing triplet.

*  **Resilience:** Implements retry and circuit breaker patterns for Redis interactions.

*  **Rate Limiting:** Basic rate limiting on API endpoints.

*  **Structured Logging:** Uses Winston for detailed JSON logging.

*  **Configuration Driven:** Key settings managed via environment variables.

## Project Structure

The project follows a standard Node.js/TypeScript application structure:
<pre> 
traffic-redirector-ts/
├── dist/ # Compiled JavaScript output (used inside Docker image)
├── logs/ # Application log files (can be volume-mounted from Docker)
├── src/ # TypeScript source code
│ ├── app.ts
│ ├── config/
│ ├── controllers/
│ ├── lib/
│ ├── middleware/
│ ├── routes/
│ ├── services/
│ └── utils/
├── .env.example # Example environment variables
├── .gitignore
├── Dockerfile # Defines the Node.js application image
├── docker-compose.yml # Defines and runs the application and Redis services
├── nodemon.json
├── package.json
├── package-lock.json
└── tsconfig.json
 </pre>

## Prerequisites

*  **Node.js & npm:** v18.x or later (LTS recommended). Required for `npm` commands and local development if not using Docker for the Node.js app.

*  **Docker Desktop:** Essential for building and running the containerized application (Node.js app and Redis service) using `docker-compose`. Download from [docker.com](https://www.docker.com/products/docker-desktop/).

## Getting Started

The primary and recommended way to run this project is using Docker Compose,

which orchestrates both the Node.js application and the Redis data store in isolated containers.

### 1. Clone the Repository

    git  clone https://github.com/EyalNous/cloaked-link-redirector.git
    cd  traffic-redirector-ts
  

### 2. Set  Up  Environment  Variables
The  application  and  Docker  Compose  setup  use  environment  variables  for  configuration.
Copy  the  example  environment  file  to  create  your  local  configuration:

    cp  .env.example  .env

Open  the  newly  created  .env  file  in  your  project  root.
Review  and  customize  the  variables  as  needed.  For  the  Docker  Compose  setup:
PORT (e.g., 3000) will be the port your Node.js application listens on inside its container.
REDIS_URL  is  set  to  redis://redis:6379  within  docker-compose.yml  for  inter-container  communication.  Your  .env  file  primarily  provides  other  configurations  like  AFFILIATE_BASE_URL,  LOG_LEVEL,  and  resilience/rate-limit  parameters  if  you  wish  to  override  defaults.

AFFILIATE_BASE_URL  should  be  set  to  your  target  affiliate  network.

### 3.  Build  and  Run  with  Docker  Compose
Ensure  Docker  Desktop  is  running  on  your  machine.
Navigate  to  the  project's root directory in your terminal.
Execute the following command:

    docker-compose up --build -d

--build: This flag instructs Docker Compose to build the Node.js application image using the Dockerfile if the image doesn't  exist  or  if  there  have  been  changes  to  the  Dockerfile  or  application  source  code.

-d (detached mode): Runs the containers in the background. You can omit -d to see logs directly in your terminal (press  Ctrl+C  to  stop).

Verification:

Once  the  command  completes,  the  Node.js  application  service  and  the  Redis  service  should  be  running.

The  application  will  typically  be  accessible  on  your  host  machine  at  http://localhost:3000 (or the  host  port  mapped  in  docker-compose.yml).

To  check  the  status  of  your  containers:  docker-compose  ps  or  docker  ps.

### 4.  Viewing  Application  Logs
If  running  in  detached  mode (-d):
To  view  logs  for  the  Node.js  application:

    docker-compose  logs  -f  app

To  view  logs  for  the  Redis  service:

    docker-compose  logs  -f  redis

(Use  -f  to  follow  the  log  output  in  real-time.)

### 5.  Stopping  the  Application
To  stop  and  remove  the  containers,  network,  and  volumes  defined  in  docker-compose.yml:

    docker-compose  down

If  you  want  to  also  remove  the  named  volume  used  by  Redis (which contains  persisted  Redis  data), use:

    docker-compose  down  -v

(Optional) Running  the  Node.js  App  Locally (Outside Docker)

For  development  or  debugging,  you  might  want  to  run  the  Node.js  application  directly  on  your  host  machine  while  still  using  Docker  for  the  Redis  instance.

Ensure  Redis  is  Running  via  Docker:

If  Redis  is  not  already  running  from  a  full  docker-compose  up,  you  can  start  just  the  Redis  service:

    docker-compose  up  -d  redis

Make  sure  the  ports  section  in  your  docker-compose.yml  for  the  redis  service  maps  port  6379  to  your  host (e.g., 6379:6379). Your .env file's REDIS_URL should then be redis://localhost:6379.

Install Project Dependencies (if not already done):
     npm install

Build TypeScript Code:

    npm run build

Run the Application:

For development with automatic restarts on code changes:

    npm run dev

For a production-like start using compiled code:

    npm start

The application will connect to the Redis instance running in Docker.

API Endpoints

All API endpoints are prefixed with /api/v1.

Health Check

GET /health

Description: Verifies the operational status of the service, including its connection to Redis.

    Success Response (200 OK):
    {
    "status": "UP",
    "timestamp": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "redis": "connected"
    }

Redirect Traffic

GET /redirect

Description: Processes incoming traffic parameters, generates or retrieves an internal our_param, and issues a 302 redirect to the configured affiliate link, including our_param.

Query Parameters:

keyword (string, required): The traffic keyword.

src (string, required): The traffic source.

creative (string, required): The creative ID.

Example Request:

GET http://localhost:3000/api/v1/redirect?keyword=productX&src=campaignY&creative=bannerZ

Success Response:

Status: 302 Found

Location Header: https://your-affiliate-network.com/?our_param=generatedUniqueValue

Error Responses: 400 Bad Request, 500 Internal Server Error, 503 Service Unavailable.

Refresh Internal Parameter

POST /refresh

Description: Assigns a new our_param to an existing combination of keyword, src, and creative. This makes the triplet appear as a new entity for subsequent redirects.

Request Body (JSON):

    {
    "keyword": "productX",
    "src": "campaignY",
    "creative": "bannerZ"
    }
    
Example Request (using curl):

    curl -X POST -H "Content-Type: application/json" \
    -d '{"keyword":"productX","src":"campaignY","creative":"bannerZ"}' \
    http://localhost:3000/api/v1/refresh

Success Response (200 OK):

    {
    "message": "Parameter refreshed successfully",
    "our_param": "newlyGeneratedUniqueValue"
    }
    
Error Responses: 400 Bad Request, 429 Too Many Requests, 500 Internal Server Error, 503 Service Unavailable.

Retrieve Original Parameters

GET /retrieve_original

Description: Fetches the original keyword, src, and creative values associated with a given our_param.

Query Parameters:

our_param (string, required): The internal parameter value.

Example Request:

GET http://localhost:3000/api/v1/retrieve_original?our_param=generatedUniqueValue

Success Response (200 OK):

    {
    "keyword": "productX",
    "src": "campaignY",
    "creative": "bannerZ"
    }

Error Responses: 400 Bad Request, 404 Not Found, 500 Internal Server Error, 503 Service Unavailable.

##Logging

The application uses Winston for structured JSON logging.

When running with docker-compose, logs can be viewed using docker-compose logs app.

If the logs/ directory is volume-mounted from the Docker container (as configured in docker-compose.yml), log files will also be available on the host machine:

logs/combined.log: All general application logs (respecting LOG_LEVEL).

logs/error.log: Critical error messages.

During local development (npm run dev), logs are also output to the console.

##Configuration

Application behavior is primarily configured through environment variables, documented in .env.example. Key variables include:

NODE_ENV: Sets the application environment (e.g., development, production).

PORT: The port on which the application server listens.

REDIS_URL: The connection URL for the Redis instance.

AFFILIATE_BASE_URL: The base URL for constructing redirect links to the affiliate network.

LOG_LEVEL: Controls the verbosity of application logging.

Parameters for rate limiting and Redis client resilience (retries, circuit breaker) can also be set via environment variables.

Running Tests (Placeholder)

    npm test

This command is a placeholder. Comprehensive unit, integration, and end-to-end tests should be implemented for a production-grade application.

##Future Enhancements / Real-World Considerations

Link health checker: Periodically scan a sample of ptk:* keys in Redis.

Comprehensive Automated Testing: Implement a full suite of tests (unit, integration, e2e) using frameworks like Jest, Mocha, Chai, Supertest.

Advanced Input Validation: Utilize a dedicated library (e.g., Joi, Zod, class-validator) for more robust and declarative validation of API request inputs.

##Security Hardening:

Implement authentication and authorization for sensitive endpoints like /refresh and potentially /retrieve_original (e.g., API keys, JWT).

Employ security-focused middleware like Helmet.js.

Conduct regular security audits and dependency vulnerability scans (npm audit fix).

CI/CD Pipeline: Establish an automated pipeline (e.g., GitHub Actions, GitLab CI, Jenkins) for building Docker images, running tests, and deploying to various environments.

Monitoring & Alerting: Integrate with monitoring solutions (e.g., Prometheus/Grafana, Datadog, Sentry) for application performance metrics, error tracking, and operational alerts.

Asynchronous Link Health Checker: (As discussed previously) A background service to validate the health of generated affiliate links.

Data Management: Define strategies for Redis data eviction, backup, and potential archival of very old ptk: mappings if storage becomes a concern.

API Documentation: Generate and host interactive API documentation using OpenAPI/Swagger specifications.

