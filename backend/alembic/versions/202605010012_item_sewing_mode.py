"""replace item production flow with sewing mode

Revision ID: 202605010012
Revises: 202605010011
Create Date: 2026-05-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010012"
down_revision: str | None = "202605010011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


sewing_mode_enum = sa.Enum("internal", "outsourced", name="sewing_mode")
production_flow_enum = sa.Enum(
    "deliver_after_cut",
    "deliver_after_print",
    "internal_sewing",
    "outsourced_sewing",
    name="production_flow",
)


def upgrade() -> None:
    bind = op.get_bind()
    sewing_mode_enum.create(bind, checkfirst=True)
    op.add_column("order_items", sa.Column("sewing_mode", sewing_mode_enum, nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE order_items
            SET sewing_mode = CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'confeccao'
                )
                AND production_flow = 'outsourced_sewing'::production_flow
                    THEN 'outsourced'::sewing_mode
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'confeccao'
                )
                    THEN 'internal'::sewing_mode
                ELSE NULL
            END
            """
        )
    )

    op.drop_column("order_items", "production_flow")
    production_flow_enum.drop(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    production_flow_enum.create(bind, checkfirst=True)
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
                )
                AND sewing_mode = 'outsourced'::sewing_mode
                    THEN 'outsourced_sewing'::production_flow
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'confeccao'
                )
                    THEN 'internal_sewing'::production_flow
                WHEN EXISTS (
                    SELECT 1
                    FROM order_item_services
                    JOIN services ON services.id = order_item_services.service_id
                    WHERE
                        order_item_services.order_item_id = order_items.id
                        AND services.type = 'serigrafia'
                )
                    THEN 'deliver_after_print'::production_flow
                ELSE 'deliver_after_cut'::production_flow
            END
            """
        )
    )
    op.alter_column("order_items", "production_flow", server_default=None)
    op.drop_column("order_items", "sewing_mode")
    sewing_mode_enum.drop(bind, checkfirst=True)
