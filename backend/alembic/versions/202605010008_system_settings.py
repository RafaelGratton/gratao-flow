"""system settings

Revision ID: 202605010008
Revises: 202605010007
Create Date: 2026-05-03 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010008"
down_revision: str | None = "202605010007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("company_phone", sa.String(length=50), nullable=False),
        sa.Column("company_address", sa.String(length=255), nullable=False),
        sa.Column("company_email", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO system_settings
                (id, company_name, company_phone, company_address, company_email)
            VALUES
                (1, 'Gratão Uniformes', '', '', NULL)
            """
        )
    )


def downgrade() -> None:
    op.drop_table("system_settings")
