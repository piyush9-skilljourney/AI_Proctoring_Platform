from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.endpoints import router as api_router
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient
import os

app = FastAPI(title=settings.APP_NAME)

# Ensure upload directory exists
if not os.path.exists(settings.UPLOAD_DIR):
    os.makedirs(settings.UPLOAD_DIR)

# Serve static videos
app.mount("/evidence", StaticFiles(directory=settings.UPLOAD_DIR), name="evidence")

# Setup CORS to allow Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to MongoDB
client = AsyncIOMotorClient(settings.MONGO_DETAILS)

@app.on_event("startup")
async def startup_db_client():
    try:
        await client.server_info()
        print("Connected to MongoDB successfully!")
    except Exception as e:
        print("Could not connect to MongoDB:", e)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Include Modularized Endpoints
app.include_router(api_router, prefix="/api/interviews")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
