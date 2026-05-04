from fastapi import APIRouter

from app.api.routes import (
    auth,
    clients,
    employees,
    orders,
    outsourcers,
    products,
    settings,
    services,
    sizes,
    stock,
    weekly_closings,
    work_logs,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(sizes.router, prefix="/sizes", tags=["sizes"])
api_router.include_router(services.router, prefix="/services", tags=["services"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(outsourcers.router, prefix="/outsourcers", tags=["outsourcers"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(work_logs.router, prefix="/work-logs", tags=["work-logs"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(stock.router, prefix="/stock", tags=["stock"])
api_router.include_router(
    weekly_closings.router, prefix="/weekly-closings", tags=["weekly-closings"]
)
