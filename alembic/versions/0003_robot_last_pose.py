"""로봇 최신 위치 컬럼 — 기능 `사용자-진행상황`, `직원-실시간위치`

위치를 두 가지로 나눈다.
- 최신 위치 1건: 여기(robot.last_geom). 덮어쓴다. 로그 주기와 무관하다.
- 위치 시계열: 3차 pose_log 파티션 테이블. 로그 주기(Hz)가 정해져야 설계할 수 있다.

이렇게 나눈 덕분에 Hz 답변을 기다리지 않고도
대시보드의 로봇 아이콘과 안내 진행률이 동작한다.

Revision ID: 0003_robot_last_pose
Revises: 0002_robot_api_key
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0003_robot_last_pose"
down_revision: str | None = "0002_robot_api_key"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("robot", sa.Column(
        "last_geom",
        geoalchemy2.types.Geometry("POINT", srid=0, spatial_index=False),
        nullable=True,
    ))
    op.add_column("robot", sa.Column("last_heading_rad", sa.Double(), nullable=True))


def downgrade() -> None:
    op.drop_column("robot", "last_heading_rad")
    op.drop_column("robot", "last_geom")
