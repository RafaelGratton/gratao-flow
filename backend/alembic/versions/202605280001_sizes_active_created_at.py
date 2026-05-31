"""add active flag and created timestamp to sizes

Revision ID: 202605280001
Revises: 202605260001
Create Date: 2026-05-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605280001"
down_revision: str | None = "202605260001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sizes",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "sizes",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.alter_column("sizes", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_column("sizes", "created_at")
    op.drop_column("sizes", "is_active")
