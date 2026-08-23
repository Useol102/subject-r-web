"""로봇 API 키 컬럼 추가 — 기능 `로봇-상태보고`

로봇이 서버에 상태를 보고하려면 자기가 누구인지 증명해야 한다.
평문 키는 저장하지 않는다. 발급할 때 한 번만 보여주고 해시만 남긴다.

autogenerate가 만든 초안을 손봤다:
- 유니크 제약에 이름을 붙였다. 이름이 없으면 downgrade에서 지울 수 없다.
- downgrade를 채웠다.

Revision ID: 0002_robot_api_key
Revises: 0001_phase1
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_robot_api_key"
down_revision: str | None = "0001_phase1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("robot", sa.Column("api_key_hash", sa.Text(), nullable=True))
    op.add_column("robot", sa.Column("api_key_issued_at",
                                     sa.DateTime(timezone=True), nullable=True))
    # 이름을 반드시 준다. 없으면 PostgreSQL이 임의 이름을 붙여 downgrade가 깨진다.
    op.create_unique_constraint("uq_robot_api_key_hash", "robot", ["api_key_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_robot_api_key_hash", "robot", type_="unique")
    op.drop_column("robot", "api_key_issued_at")
    op.drop_column("robot", "api_key_hash")
