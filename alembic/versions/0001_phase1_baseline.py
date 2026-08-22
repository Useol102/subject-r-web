"""1차 스키마 기준점 (baseline)

1차 테이블 9개는 schema/001_phase1.sql 로 직접 만들었다.
이 리비전은 그 상태를 Alembic의 출발점으로 등록하기 위한 빈 리비전이다.

새 DB에 적용할 때:
    .\\init-db.ps1          # 001_phase1.sql 실행
    alembic stamp head      # "여기까지 적용됨"으로 표시

2차부터는 반드시 alembic revision 으로 스키마를 바꾼다.
psql에서 직접 ALTER TABLE 하지 말 것.

Revision ID: 0001_phase1
Revises:
"""
from collections.abc import Sequence

revision: str = "0001_phase1"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 스키마는 001_phase1.sql이 이미 만들었다.
    pass


def downgrade() -> None:
    # 되돌릴 대상이 없다. 초기화는 init-db.ps1 -Recreate 로 한다.
    pass
