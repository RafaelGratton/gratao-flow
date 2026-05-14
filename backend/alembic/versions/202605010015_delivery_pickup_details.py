"""delivery pickup details

Revision ID: 202605010015
Revises: 202605010014
Create Date: 2026-05-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010015"
down_revision: str | None = "202605010014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "delivery_history",
        sa.Column("picked_up_by", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "delivery_history",
        sa.Column("pickup_document", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "delivery_history",
        sa.Column("delivery_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("delivery_history", "delivery_notes")
    op.drop_column("delivery_history", "pickup_document")
    op.drop_column("delivery_history", "picked_up_by")
