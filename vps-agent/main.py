import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

API_KEY = os.getenv("API_KEY", "")

app = FastAPI(title="OpsCore VPS Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path in ("/", "/docs", "/openapi.json", "/redoc"):
        return await call_next(request)
    if API_KEY:
        key = request.headers.get("X-API-Key", "")
        if key != API_KEY:
            return JSONResponse(status_code=401, content={"detail": "Invalid API key"})
    return await call_next(request)


from routers import health, containers, agents, tokens, costs

app.include_router(health.router)
app.include_router(containers.router)
app.include_router(agents.router)
app.include_router(tokens.router)
app.include_router(costs.router)


@app.get("/")
async def root():
    return {"service": "OpsCore VPS Agent", "version": "1.0.0"}
