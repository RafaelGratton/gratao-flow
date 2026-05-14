"""aggregate order statuses

Revision ID: 202605010016
Revises: 202605010015
Create Date: 2026-05-13 00:30:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "202605010016"
down_revision: str | None = "202605010015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'in_progress'")
    op.execute("ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'partial_ready'")
    op.execute("ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'mixed'")


def downgrade() -> None:
    pass
