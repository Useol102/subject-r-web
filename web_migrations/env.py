"""기존 PostGIS 마이그레이션과 분리된 SQLite 웹 마이그레이션."""
import os
from alembic import context
from sqlalchemy import create_engine
from web_api.models import Base

config = context.config
url = config.attributes.get("database_url") or os.getenv("WEB_DATABASE_URL") or config.get_main_option("sqlalchemy.url")
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
