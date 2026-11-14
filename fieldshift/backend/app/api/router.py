from fastapi import APIRouter

from app.api.routes import climate, crops, export, fields, health, priorities, rotations, scenarios

api_router = APIRouter()
for module in (health, crops, fields, priorities, climate, rotations, scenarios, export):
    api_router.include_router(module.router)
