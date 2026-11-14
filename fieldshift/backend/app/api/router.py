from fastapi import APIRouter

from app.api.routes import calendar, climate, crops, forecast, export, fields, health, priorities, rotations, satellite, scenarios, terrain

api_router = APIRouter()
for module in (health, crops, fields, priorities, climate, satellite, rotations, scenarios, calendar, terrain, forecast, export):
    api_router.include_router(module.router)
