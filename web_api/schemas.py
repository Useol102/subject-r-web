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
    place_id: Code
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    description: str = Field(default="", max_length=1000)
    instructor: str = Field(default="", max_length=100)
    is_active: bool = True

    @model_validator(mode="after")
    def check_times(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("종료 시각은 시작 시각 이후여야 합니다.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        return self


class CatalogIn(Input):
    version: Literal[1]
    places: list[PlaceIn] = Field(max_length=500)
    programs: list[ProgramIn] = Field(max_length=2000)

    @model_validator(mode="after")
    def unique_ids(self):
        for items in (self.places, self.programs):
            if len({item.id for item in items}) != len(items):
                raise ValueError("같은 종류 안에 중복된 ID가 있습니다.")
        return self


class TripIn(Input):
    robot_id: Code
    destination_id: Code


class TripState(Input):
    status: Literal["moving", "arrived", "canceled", "failed"]


class AttendanceIn(Input):
    program_id: Code
    code: str = Field(min_length=1, max_length=128)
