"""item production flow

Revision ID: 202605010011
Revises: 202605010010
Create Date: 2026-05-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010011"
down_revision: str | None = "202605010010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


production_flow_enum = sa.Enum(
    "deliver_after_cut",
    "deliver_after_print",
    "internal_sewing",
    "outsourced_sewing",
    name="production_flow",
)


def upgrade() -> None:
    bind = op.get_bind()
    production_flow_enum.create(bind, checkfirst=True)

    op.add_column(
        "order_items",
        sa.Column(
            "quantity_cut",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "quantity_printed",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "quantity_sewn",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "production_flow",
            production_flow_enum,
            nullable=False,
            server_default="internal_sewing",
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE order_items
            SET production_flow = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'confeccao'
                ) THEN 'internal_sewing'::production_flow
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'serigrafia'
                ) THEN 'deliver_after_print'::production_flow
                ELSE 'deliver_after_cut'::production_flow
            END
            """
        )
    )

    op.add_column(
        "production_events",
        sa.Column("order_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_production_events_order_item_id_order_items",
        "production_events",
        "order_items",
        ["order_item_id"],
        ["id"],
    )
    op.create_index(
        "ix_production_events_order_item_id",
        "production_events",
        ["order_item_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_production_events_order_item_id", table_name="production_events")
    op.drop_constraint(
        "fk_production_events_order_item_id_order_items",
        "production_events",
        type_="foreignkey",
    )
    op.drop_column("production_events", "order_item_id")
    op.drop_column("order_items", "production_flow")
    op.drop_column("order_items", "quantity_sewn")
    op.drop_column("order_items", "quantity_printed")
    op.drop_column("order_items", "quantity_cut")
    production_flow_enum.drop(op.get_bind(), checkfirst=True)
