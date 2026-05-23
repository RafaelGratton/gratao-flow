"""employee pix and weekly closing snapshot

Revision ID: 202605210001
Revises: 202605010019
Create Date: 2026-05-21 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605210001"
down_revision: str | None = "202605010019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

pix_key_type_enum = postgresql.ENUM(
    "cpf",
    "email",
    "phone",
    "random",
    name="employee_pix_key_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    pix_key_type_enum.create(bind, checkfirst=True)

    op.add_column("employees", sa.Column("pix_key_type", pix_key_type_enum, nullable=True))
    op.add_column("employees", sa.Column("pix_key", sa.String(length=255), nullable=True))
    op.add_column(
        "weekly_closings",
        sa.Column("employee_pix_key_type", pix_key_type_enum, nullable=True),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("employee_pix_key", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_column("weekly_closings", "employee_pix_key")
    op.drop_column("weekly_closings", "employee_pix_key_type")
    op.drop_column("employees", "pix_key")
    op.drop_column("employees", "pix_key_type")

    pix_key_type_enum.drop(bind, checkfirst=True)
