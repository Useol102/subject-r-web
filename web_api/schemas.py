from typing import Annotated, Literal
from datetime import timezone
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator

Code = Annotated[str, Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")]
Name = Annotated[str, Field(min_length=1, max_length=100)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PlaceIn(Input):
    id: Code
    name: Name
    floor: int = Field(ge=-10, le=100)
    category: Literal["안내", "강의실", "편의시설", "상담"]
    description: str = Field(default="", max_length=500)
    directions: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(default_factory=list, max_length=12)
    wheelchair_accessible: bool = False
    is_active: bool = True


class ProgramIn(Input):
    id: Code
    title: Name
    category: Literal["건강", "문화", "디지털", "행사"]
    # 회차의 기본 장소. 회차가 place_id 를 비워두면 이 값을 쓴다.
    place_id: Code
    description: str = Field(default="", max_length=1000)
    instructor: str = Field(default="", max_length=100)
    is_active: bool = True


class SessionIn(Input):
    """회차 1건. 카탈로그 안에서는 상위 프로그램에 속하므로 program_id 를 받지 않는다."""
    id: Code
    place_id: Code | None = None
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    status: Literal["scheduled", "canceled"] = "scheduled"
    cancel_reason: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def check(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("종료 시각은 시작 시각 이후여야 합니다.")
        if self.status == "canceled" and not self.cancel_reason.strip():
            raise ValueError("휴강 사유를 입력해 주세요.")
        if self.status == "scheduled":
            self.cancel_reason = ""
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        return self


class ProgramSessionIn(SessionIn):
    """회차를 단독으로 저장할 때. 어느 프로그램인지 직접 말해야 한다."""
    program_id: Code


class SessionBatchIn(Input):
    """반복 생성. 여러 회차를 한 트랜잭션으로 넣는다 — 절반만 들어가면 안 된다."""
    sessions: list[ProgramSessionIn] = Field(min_length=1, max_length=400)

    @model_validator(mode="after")
    def unique_ids(self):
        if len({s.id for s in self.sessions}) != len(self.sessions):
            raise ValueError("중복된 회차 ID가 있습니다.")
        return self


class ProgramWithSessionsIn(ProgramIn):
    sessions: list[SessionIn] = Field(default_factory=list, max_length=400)


class CatalogIn(Input):
    """가져오기·내보내기 양식.

    version 1 은 프로그램에 시각이 직접 붙어 있던 옛 양식이다. 기관에 이미 나갔을 수
    있어 계속 받아들이고, 그 시각을 **회차 1개**로 바꿔 읽는다. 내보내기는 항상 2 다.
    """
    version: Literal[1, 2]
    places: list[PlaceIn] = Field(max_length=500)
    programs: list[ProgramWithSessionsIn] = Field(max_length=2000)

    @model_validator(mode="before")
    @classmethod
    def upgrade_v1(cls, data):
        if not isinstance(data, dict) or data.get("version") != 1:
            return data
        programs = []
        for program in data.get("programs") or []:
            program = dict(program)
            starts_at = program.pop("starts_at", None)
            ends_at = program.pop("ends_at", None)
            if starts_at is not None and ends_at is not None:
                # 회차 ID 는 프로그램 ID 에서 만든다. Code 패턴이 64자까지라 잘라 붙인다.
                program["sessions"] = [{"id": f"{str(program.get('id', ''))[:62]}-1",
                                        "starts_at": starts_at, "ends_at": ends_at}]
            programs.append(program)
        return {**data, "version": 2, "programs": programs}

    @model_validator(mode="after")
    def unique_ids(self):
        for items in (self.places, self.programs):
            if len({item.id for item in items}) != len(items):
                raise ValueError("같은 종류 안에 중복된 ID가 있습니다.")
        session_ids = [s.id for p in self.programs for s in p.sessions]
        if len(set(session_ids)) != len(session_ids):
            raise ValueError("중복된 회차 ID가 있습니다.")
        return self


class TripIn(Input):
    robot_id: Code
    destination_id: Code


class TripState(Input):
    status: Literal["moving", "arrived", "canceled", "failed"]


class AttendanceIn(Input):
    program_session_id: Code
    code: str = Field(min_length=1, max_length=128)
