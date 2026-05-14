"""add item operational priority

Revision ID: 202605010017
Revises: 202605010016
Create Date: 2026-05-01 00:17:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202605010017"
down_revision: Union[str, None] = "202605010016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


priority_enum = sa.Enum(
    "normal",
    "urgent",
    "critical",
    name="operational_priority",
)


def upgrade() -> None:
    bind = op.get_bind()
    priority_enum.create(bind, checkfirst=True)
    op.add_column(
        "order_items",
        sa.Column(
            "operational_priority",
            priority_enum,
            server_default="normal",
            nullable=False,
        ),
    )
    op.alter_column("order_items", "operational_priority", server_default=None)


def downgrade() -> None:
    op.drop_column("order_items", "operational_priority")
    priority_enum.drop(op.get_bind(), checkfirst=True)
