"""operational audit traceability

Revision ID: 202605010018
Revises: 202605010017
Create Date: 2026-05-14 00:18:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010018"
down_revision: str | None = "202605010017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'delivery_registered'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'loss_registered'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'rework_registered'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'adjustment_registered'")

    op.add_column(
        "order_items",
        sa.Column("available_since", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column("delivery_history", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column(
        "delivery_history",
        sa.Column("user_name_snapshot", sa.String(length=255), nullable=True),
    )
    op.create_foreign_key(
        "fk_delivery_history_user_id_users",
        "delivery_history",
        "users",
        ["user_id"],
        ["id"],
    )

    op.add_column("production_events", sa.Column("stage", sa.String(length=50), nullable=True))
    op.add_column("production_events", sa.Column("before_quantity", sa.Integer(), nullable=True))
    op.add_column("production_events", sa.Column("after_quantity", sa.Integer(), nullable=True))
    op.add_column("production_events", sa.Column("reason", sa.String(length=255), nullable=True))
    op.add_column("production_events", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column(
        "production_events",
        sa.Column("user_name_snapshot", sa.String(length=255), nullable=True),
    )
    op.create_foreign_key(
        "fk_production_events_user_id_users",
        "production_events",
        "users",
        ["user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_production_events_user_id_users", "production_events", type_="foreignkey")
    op.drop_column("production_events", "user_name_snapshot")
    op.drop_column("production_events", "user_id")
    op.drop_column("production_events", "reason")
    op.drop_column("production_events", "after_quantity")
    op.drop_column("production_events", "before_quantity")
    op.drop_column("production_events", "stage")

    op.drop_constraint("fk_delivery_history_user_id_users", "delivery_history", type_="foreignkey")
    op.drop_column("delivery_history", "user_name_snapshot")
    op.drop_column("delivery_history", "user_id")

    op.drop_column("order_items", "available_since")
