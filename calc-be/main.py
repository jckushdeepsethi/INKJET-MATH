from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from apps.calculator.route import router as calculator_router
from constants import SERVER_URL, PORT, ENV

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.include_router(calculator_router, prefix="/calculate", tags=["calculate"])

# Detect static build (either ./dist inside container or ../calc-fe/dist locally)
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "dist"))
if not os.path.exists(dist_dir):
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../calc-fe/dist"))

if os.path.exists(dist_dir):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
else:
    @app.get('/')
    async def root():
        return {"message": "Server is running"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=(ENV == "dev"))