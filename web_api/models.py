"""웹에서 관리하는 프로그램·장소와 데모 연동 기록."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, JSON, MetaData, String, UniqueConstraint, text

KST = timezone(timedelta(hours=9))
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def iso_z(moment: datetime) -> str:
    """시각을 한 가지 형식으로만 만든다 — `2026-09-17T00:30:00.000Z` (항상 24자, 항상 UTC, 항상 Z).

    SQLite 에는 날짜 타입이 없어서 시각은 문자열이고, **정렬·비교도 문자열 비교**다.
    형식이 섞이면 조용히 틀린다. 예를 들어 `+00:00` 은 `Z` 보다 사전순으로 앞이라,
    한 컬럼에 두 형식이 섞이면 `ORDER BY starts_at` 이 시간순이 아니게 된다.

    파이썬 `datetime.isoformat()` 을 그대로 쓰면 안 된다 — 마이크로초 6자리에
    `+00:00` 을 붙여서 자바스크립트 `toISOString()` 과 형식이 어긋난다.
    시각을 저장하는 곳은 전부 이 함수 하나만 거친다.
    """
    utc = moment.astimezone(timezone.utc)
    return f"{utc:%Y-%m-%dT%H:%M:%S}.{utc.microsecond // 1000:03d}Z"


def utc_now() -> str:
    return iso_z(datetime.now(timezone.utc))


def day_kst(moment: datetime) -> str:
    """그 시각이 **한국 날짜로** 며칠인지 (`2026-09-17`).

    "오늘 일정"·"오늘 출석"은 한국 날짜로 따져야 한다. UTC 로 따지면 오전 9시 이전
    일정이 전날로 밀린다. 저장은 UTC, 날짜 판정은 KST — 이 둘을 섞지 않으려고
    `session_day_kst` 처럼 판정 결과를 컬럼으로 따로 둔다.
    """
    return moment.astimezone(KST).date().isoformat()


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
    # 회차의 기본 장소. 회차마다 강의실이 바뀔 수 있어서 실제 장소는 program_session 에 있다.
    place_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    description: Mapped[str] = mapped_column(String(1000), default="")
    instructor: Mapped[str] = mapped_column(String(100), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)


class ProgramSession(Base):
    """강좌의 한 회차. 시각은 프로그램이 아니라 여기에 있다.

    프로그램에 시각이 박혀 있으면 "매주 화요일 건강체조 8주"를 표현할 수 없다.
    프로그램을 8개 만들어야 하고, 그러면 목록에 같은 이름이 여덟 번 뜬다.

    반복은 규칙으로 저장하지 않고 **회차를 미리 만들어 둔다.** 규칙으로 두면
    휴강 하나를 넣으려 해도 예외 테이블이 또 필요하고, 출결이 실제 행을 가리켜야 해서
    결국 회차를 만들게 된다.
    """
    __tablename__ = "program_session"
    __table_args__ = (
        CheckConstraint("status IN ('scheduled','canceled')", name="status"),
        # 사유 없는 휴강은 나중에 아무도 이유를 모른다.
        CheckConstraint("status = 'scheduled' OR cancel_reason <> ''", name="cancel_reason"),
        CheckConstraint("ends_at > starts_at", name="times"),
        Index("ix_program_session_day", "session_day_kst"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("program.id"))
    place_id: Mapped[str] = mapped_column(ForeignKey("place.id"))
    starts_at: Mapped[str] = mapped_column(String(40))
    ends_at: Mapped[str] = mapped_column(String(40))
    # starts_at 의 한국 날짜. "오늘 일정" 을 문자열 비교 한 번으로 끝내려고 따로 둔다.
    session_day_kst: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    cancel_reason: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(40), default=utc_now)


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
    # 같은 사람이 같은 회차에 두 번 찍는 것을 막는다. 회차가 이미 날짜를 갖고 있어
    # day_kst 는 유니크에서 뺐다 — 남겨둔 건 일자별 집계를 조인 없이 하기 위해서다.
    __table_args__ = (UniqueConstraint("program_session_id", "code_hash"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    program_session_id: Mapped[str] = mapped_column(ForeignKey("program_session.id"))
    code_hash: Mapped[str] = mapped_column(String(64))
    day_kst: Mapped[str] = mapped_column(String(10))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=utc_now)
