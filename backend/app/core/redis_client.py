"""
Redis client and caching utilities.
"""
import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings

redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get or create Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
    return redis_client


async def cache_set(key: str, value: Any, ttl: int = settings.CACHE_TTL) -> None:
    """Set a value in Redis cache with TTL (seconds)."""
    r = await get_redis()
    serialized = json.dumps(value, default=str)
    await r.setex(key, ttl, serialized)


async def cache_get(key: str) -> Optional[Any]:
    """Get a cached value from Redis. Returns None if not found."""
    r = await get_redis()
    data = await r.get(key)
    if data:
        return json.loads(data)
    return None


async def cache_delete(key: str) -> None:
    """Delete a key from Redis cache."""
    r = await get_redis()
    await r.delete(key)


async def cache_invalidate_pattern(pattern: str) -> None:
    """Invalidate all keys matching a pattern."""
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)


async def increment_counter(key: str, ttl: int = 60) -> int:
    """Atomic increment counter for rate limiting."""
    r = await get_redis()
    pipe = r.pipeline()
    await pipe.incr(key)
    await pipe.expire(key, ttl)
    results = await pipe.execute()
    return results[0]
