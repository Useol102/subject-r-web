"""Alembic 환경 설정.

핵심 두 가지:
1. DB 주소를 .env에서 읽는다 (alembic.ini에 비밀번호를 쓰지 않는다)
2. PostGIS가 만든 내부 테이블을 autogenerate에서 제외한다
   — 안 그러면 마이그레이션이 spatial_ref_sys를 DROP 하려 든다
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# PostGIS가 자동 생성하는 것들. 우리 스키마가 아니므로 건드리면 안 된다.
EXCLUDE_TABLES = {"spatial_ref_sys", "geometry_columns", "geography_columns",
                  "raster_columns", "raster_overviews"}


def compare_geometry(ctx, inspected_col, meta_col, inspected_type, meta_type):
    """geometry 컬럼끼리는 타입 비교를 건너뛴다.

    GeoAlchemy2가 DB에서 읽어온 타입에는 srid가 안 붙어 있어서,
    모델의 srid=0과 매번 '타입이 바뀌었다'는 가짜 diff가 생긴다.
    좌표계를 진짜로 바꿀 일이 생기면 그때 손으로 마이그레이션을 쓴다.
    """
    from geoalchemy2 import Geometry
    if isinstance(inspected_type, Geometry) and isinstance(meta_type, Geometry):
        return False
    return None   # None = Alembic 기본 판단에 맡긴다


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table" and name in EXCLUDE_TABLES:
        return False
    # PostGIS가 만든 공간 인덱스도 제외
    if type_ == "index" and name and name.startswith("idx_") and "geom" in name:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
        compare_type=compare_geometry,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=compare_geometry,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
