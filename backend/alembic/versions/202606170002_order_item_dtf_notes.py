"""add DTF notes to order items

Revision ID: 202606170002
Revises: 202606170001
Create Date: 2026-06-17 00:02:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202606170002"
down_revision: str | None = "202606170001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("order_items", sa.Column("dtf_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("order_items", "dtf_notes")
