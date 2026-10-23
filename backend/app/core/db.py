import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

logger = logging.getLogger("glyph-backend")

client = None
db = None

async def get_database():
    global client, db
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if client is not None:
        try:
            client_loop = client.get_io_loop()
            if client_loop.is_closed() or (current_loop is not None and client_loop is not current_loop):
                client.close()
                client = None
                db = None
        except Exception:
            client = None
            db = None

    if db is not None:
        return db

    try:
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL[:30]}...")
        test_client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        await test_client.admin.command('ping')
        client = test_client
        db = client[settings.DB_NAME]
        logger.info("Successfully connected to live MongoDB cluster.")
    except Exception as e:
        logger.error(f"FATAL: Could not connect to live MongoDB cluster: {e}")
        raise RuntimeError(f"Failed to connect to MongoDB: {e}") from e

    return db

async def close_database():
    global client, db
    if client:
        try:
            client.close()
        except Exception:
            pass
        client = None
        db = None
