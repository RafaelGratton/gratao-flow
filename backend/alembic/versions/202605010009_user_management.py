"""user management

Revision ID: 202605010009
Revises: 202605010008
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010009"
down_revision: str | None = "202605010008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=50), server_default="operator", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )

    op.execute(
        sa.text(
            """
            UPDATE users
            SET
                name = COALESCE(NULLIF(name, ''), email),
                role = CASE WHEN is_admin THEN 'admin' ELSE 'operator' END,
                is_active = TRUE
            """
        )
    )
    op.alter_column("users", "name", nullable=False)
    op.alter_column("users", "role", server_default=None)
    op.alter_column("users", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_active")
    op.drop_column("users", "role")
    op.drop_column("users", "name")
