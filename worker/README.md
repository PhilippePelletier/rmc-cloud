FastAPI worker that processes jobs from the web app.

- POST /jobs/process  { job_id }
- Requires header X-RMC-Secret matching WORKER_SHARED_SECRET
