"""
Celery worker configuration and background tasks.
Tasks run independently from the FastAPI request cycle.
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "gaticharge",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.sync_stations": {"queue": "sync"},
        "app.workers.tasks.update_trust_scores": {"queue": "analytics"},
        "app.workers.tasks.recalculate_queue_stats": {"queue": "realtime"},
    },
    beat_schedule={
        "sync-stations-every-30min": {
            "task": "app.workers.tasks.sync_stations",
            "schedule": 1800.0,  # 30 minutes
        },
        "update-trust-scores-every-hour": {
            "task": "app.workers.tasks.update_trust_scores",
            "schedule": 3600.0,
        },
        "recalculate-queue-every-60s": {
            "task": "app.workers.tasks.recalculate_queue_stats",
            "schedule": 60.0,
        },
    },
)
