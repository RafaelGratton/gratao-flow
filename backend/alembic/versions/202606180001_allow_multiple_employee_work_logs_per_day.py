"""allow multiple employee work logs per day

Revision ID: 202606180001
Revises: 202606170002
Create Date: 2026-06-18 18:20:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "202606180001"
down_revision: str | None = "202606170002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_employee_work_logs_employee_date",
        "employee_work_logs",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_employee_work_logs_employee_date",
        "employee_work_logs",
        ["employee_id", "work_date"],
    )
