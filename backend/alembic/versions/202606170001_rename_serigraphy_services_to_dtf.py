"""rename serigraphy services to DTF

Revision ID: 202606170001
Revises: 202605310002
Create Date: 2026-06-17 00:01:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "202606170001"
down_revision: str | None = "202605310002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE services
        SET name = CASE name
            WHEN 'Serigrafia frente' THEN 'DTF frente'
            WHEN 'Serigrafia frente e costas' THEN 'DTF frente e costas'
            ELSE name
        END
        WHERE name IN ('Serigrafia frente', 'Serigrafia frente e costas')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE services
        SET name = CASE name
            WHEN 'DTF frente' THEN 'Serigrafia frente'
            WHEN 'DTF frente e costas' THEN 'Serigrafia frente e costas'
            ELSE name
        END
        WHERE name IN ('DTF frente', 'DTF frente e costas')
        """
    )
