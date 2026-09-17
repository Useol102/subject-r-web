"""웹에서 관리하는 프로그램·장소와 데모 연동 기록."""
from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, JSON, MetaData, String, UniqueConstraint, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s", "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


class Place(Base):
    __tablename__ = "place"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    floor: Mapped[int]
    category: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(500), default="")
    directions: Mapped[list[str]] = mapped_column(JSON, default=list)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Program(Base):
    __tablename__ = "program"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(30))
    place_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    starts_at: Mapped[str] = mapped_column(String(40))
    ends_at: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(String(1000), default="")
    instructor: Mapped[str] = mapped_column(String(100), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Robot(Base):
    __tablename__ = "robot"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    home_place_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    current_place_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Trip(Base):
    __tablename__ = "trip"
    __table_args__ = (
        CheckConstraint("status IN ('requested','moving','arrived','canceled','failed')", name="status"),
        Index("uq_trip_robot_active", "robot_id", unique=True,
              sqlite_where=text("status IN ('requested','moving')")),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    robot_id: Mapped[str] = mapped_column(ForeignKey("robot.id"))
    destination_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    status: Mapped[str] = mapped_column(String(30), default="requested")
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("program_id", "code_hash", "day_kst"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("program.id"))
    code_hash: Mapped[str] = mapped_column(String(64))
    day_kst: Mapped[str] = mapped_column(String(10))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
