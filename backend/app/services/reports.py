from io import BytesIO
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Iterable, Sequence
from xml.sax.saxutils import escape

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as ReportImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.enums import FinancialStatus, ProductionStatus
from app.models.order import ClientOrderGroup, Order, OrderItem
from app.models.weekly_closing import WeeklyClosing
from app.schemas.report import (
    ClientOrderReport,
    ClientOrderGroupReport,
    ClientOrderGroupReportOrder,
    ClientReportPayment,
    GroupClientReportPayment,
    GroupInternalReportOutsourcing,
    GroupInternalReportPayment,
    GroupInternalReportProductionEvent,
    InternalOrderReport,
    InternalOrderGroupReport,
    InternalOrderGroupReportOrder,
    InternalReportOutsourcing,
    InternalReportPayment,
    InternalReportProductionEvent,
    ReportClient,
    ReportItem,
    ReportProduct,
    ReportService,
    ReportSize,
)


PAGE_MARGIN = 14 * mm
SECTION_SPACING = 8
MONEY_QUANTIZER = Decimal("0.01")
LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "logo.png"

PDF_COLORS = {
    "ink": colors.HexColor("#1F2933"),
    "muted": colors.HexColor("#667085"),
    "line": colors.HexColor("#E6E1D8"),
    "soft": colors.HexColor("#FCFAF6"),
    "soft_alt": colors.HexColor("#F6F3ED"),
    "accent": colors.HexColor("#DCEFE5"),
    "accent_text": colors.HexColor("#176B47"),
    "warning": colors.HexColor("#FFF3CD"),
    "warning_text": colors.HexColor("#8A5A00"),
    "danger": colors.HexColor("#FDE2E1"),
    "danger_text": colors.HexColor("#A8322A"),
    "white": colors.white,
}

CLIENT_STATUS_LABELS = {
    ProductionStatus.CREATED: "Em andamento",
    ProductionStatus.IN_PROGRESS: "Em andamento",
    ProductionStatus.MIXED: "Em producao",
    ProductionStatus.PARTIAL_READY: "Parcialmente pronto",
    ProductionStatus.IN_CUT: "Em andamento",
    ProductionStatus.CUT_DONE: "Em producao",
    ProductionStatus.WAITING_PRINT: "Em producao",
    ProductionStatus.IN_PRINT: "Em producao",
    ProductionStatus.PRINT_DONE: "Em producao",
    ProductionStatus.WAITING_SEWING: "Em producao",
    ProductionStatus.IN_SEWING: "Em producao",
    ProductionStatus.SEWING_DONE: "Pronto",
    ProductionStatus.OUTSOURCED: "Em producao",
    ProductionStatus.RETURNED: "Em producao",
    ProductionStatus.READY: "Pronto",
    ProductionStatus.DELIVERED: "Entregue",
    ProductionStatus.CANCELLED: "Cancelado",
}

PRODUCTION_STATUS_LABELS = {
    ProductionStatus.CREATED: "Criada",
    ProductionStatus.IN_PROGRESS: "Em andamento",
    ProductionStatus.PARTIAL_READY: "Parcialmente pronta",
    ProductionStatus.MIXED: "Fluxo misto",
    ProductionStatus.IN_CUT: "Em corte",
    ProductionStatus.CUT_DONE: "Corte concluido",
    ProductionStatus.WAITING_PRINT: "Aguardando DTF",
    ProductionStatus.IN_PRINT: "Em DTF",
    ProductionStatus.PRINT_DONE: "DTF concluido",
    ProductionStatus.WAITING_SEWING: "Aguardando confeccao",
    ProductionStatus.IN_SEWING: "Em confeccao",
    ProductionStatus.SEWING_DONE: "Confeccao concluida",
    ProductionStatus.OUTSOURCED: "Terceirizada",
    ProductionStatus.RETURNED: "Retornada",
    ProductionStatus.READY: "Pronta",
    ProductionStatus.DELIVERED: "Entregue",
    ProductionStatus.CANCELLED: "Cancelada",
}

FINANCIAL_STATUS_LABELS = {
    "pending": "Pendente",
    "partial": "Parcial",
    "paid": "Pago",
}

PAYMENT_METHOD_LABELS = {
    "pix": "Pix",
    "cash": "Dinheiro",
    "card": "Cartao",
    "boleto": "Boleto",
}

OUTSOURCING_STATUS_LABELS = {
    "sent": "Enviada",
    "partially_returned": "Retorno parcial",
    "returned": "Retornada",
    "delivered_direct": "Entrega direta",
    "cancelled": "Cancelada",
}

PAYOUT_STATUS_LABELS = {
    "pending": "Pendente",
    "paid": "Pago",
}

WEEKLY_CLOSING_STATUS_LABELS = {
    "open": "Aberto",
    "closed": "Fechado",
    "paid": "Pago",
}

PIX_KEY_TYPE_LABELS = {
    "cpf": "CPF",
    "email": "E-mail",
    "phone": "Telefone",
    "random": "Chave aleatoria",
}


def build_internal_order_report(order: Order) -> InternalOrderReport:
    active_items = _active_items(order)
    return InternalOrderReport(
        order_id=order.id,
        client=ReportClient.model_validate(order.client),
        quantity_requested=sum(item.quantity_requested for item in active_items),
        quantity_cut=sum(item.quantity_cut for item in active_items),
        quantity_printed=sum(item.quantity_printed for item in active_items),
        quantity_sewn=sum(item.quantity_sewn for item in active_items),
        quantity_extra=sum(max(item.quantity_cut - item.quantity_requested, 0) for item in active_items),
        items=[_build_report_item(item, order) for item in order.items],
        total_amount=order.total_amount,
        amount_paid=order.amount_paid,
        amount_due=order.amount_due,
        outsourcing_cost_total=order.outsourcing_cost_total,
        outsourcing_paid_total=order.outsourcing_paid_total,
        outsourcing_pending_total=order.outsourcing_pending_total,
        estimated_result=order.estimated_result,
        payments=[
            InternalReportPayment(
                amount=payment.amount,
                payment_method=payment.payment_method,
                paid_at=payment.paid_at,
                notes=payment.notes,
            )
            for payment in order.payments
        ],
        production_status=order.production_status,
        financial_status=order.financial_status,
        production_events=[
            InternalReportProductionEvent(
                order_item_id=event.order_item_id,
                event_type=event.event_type,
                quantity=event.quantity,
                notes=event.notes,
                from_status=event.from_status,
                to_status=event.to_status,
                created_at=event.created_at,
            )
            for event in order.production_events
        ],
        outsourcings=[
            InternalReportOutsourcing(
                order_item_id=outsourcing.order_item_id,
                outsourcer=outsourcing.outsourcer.name if outsourcing.outsourcer else None,
                quantity_sent=outsourcing.quantity_sent,
                quantity_returned=outsourcing.quantity_returned,
                customer_unit_price=outsourcing.customer_unit_price,
                outsourcer_unit_price=outsourcing.outsourcer_unit_price,
                customer_total=outsourcing.customer_total,
                outsourcer_total=outsourcing.outsourcer_total,
                profit_total=outsourcing.profit_total,
                status=outsourcing.status,
                payout_status=outsourcing.payout_status,
            )
            for outsourcing in order.outsourcings
        ],
    )


def build_client_order_report(order: Order) -> ClientOrderReport:
    active_items = _active_items(order)
    return ClientOrderReport(
        client=ReportClient.model_validate(order.client),
        order_id=order.id,
        quantity=sum(item.quantity_requested for item in active_items),
        items=[_build_report_item(item, order) for item in active_items],
        total_amount=order.total_amount,
        payments=[
            ClientReportPayment(
                amount=payment.amount,
                payment_method=payment.payment_method,
                paid_at=payment.paid_at,
            )
            for payment in order.payments
        ],
        amount_paid=order.amount_paid,
        amount_due=order.amount_due,
        production_status=CLIENT_STATUS_LABELS[order.production_status],
    )


def build_internal_order_group_report(group: ClientOrderGroup) -> InternalOrderGroupReport:
    orders = list(group.orders)
    return InternalOrderGroupReport(
        group_id=group.id,
        reference=group.reference,
        client=ReportClient.model_validate(group.client),
        quantity_requested=sum(_order_quantity(order) for order in orders),
        order_count=len(orders),
        orders=[_build_internal_group_report_order(order) for order in orders],
        total_amount=_sum_money(order.total_amount for order in orders),
        amount_paid=_sum_money(order.amount_paid for order in orders),
        amount_due=_sum_money(order.amount_due for order in orders),
        outsourcing_cost_total=_sum_money(order.outsourcing_cost_total for order in orders),
        outsourcing_paid_total=_sum_money(order.outsourcing_paid_total for order in orders),
        outsourcing_pending_total=_sum_money(order.outsourcing_pending_total for order in orders),
        estimated_result=_sum_money(order.estimated_result for order in orders),
        production_status=derive_order_group_production_status(orders),
        financial_status=derive_order_group_financial_status(
            _sum_money(order.total_amount for order in orders),
            _sum_money(order.amount_paid for order in orders),
        ),
    )


def build_client_order_group_report(group: ClientOrderGroup) -> ClientOrderGroupReport:
    orders = list(group.orders)
    total_amount = _sum_money(order.total_amount for order in orders)
    amount_paid = _sum_money(order.amount_paid for order in orders)
    production_status = derive_order_group_production_status(orders)
    return ClientOrderGroupReport(
        group_id=group.id,
        reference=group.reference,
        client=ReportClient.model_validate(group.client),
        quantity=sum(_order_quantity(order) for order in orders),
        orders=[
            ClientOrderGroupReportOrder(
                order_id=order.id,
                production_status=CLIENT_STATUS_LABELS[order.production_status],
                quantity=_order_quantity(order),
                total_amount=order.total_amount,
                amount_paid=order.amount_paid,
                amount_due=order.amount_due,
                items=[_build_report_item(item, order) for item in _active_items(order)],
            )
            for order in orders
        ],
        total_amount=total_amount,
        payments=[
            GroupClientReportPayment(
                order_id=order.id,
                amount=payment.amount,
                payment_method=payment.payment_method,
                paid_at=payment.paid_at,
            )
            for order in orders
            for payment in order.payments
        ],
        amount_paid=amount_paid,
        amount_due=_sum_money(order.amount_due for order in orders),
        production_status=CLIENT_STATUS_LABELS[production_status],
        financial_status=derive_order_group_financial_status(total_amount, amount_paid),
    )


def _build_internal_group_report_order(order: Order) -> InternalOrderGroupReportOrder:
    return InternalOrderGroupReportOrder(
        order_id=order.id,
        production_status=order.production_status,
        financial_status=order.financial_status,
        quantity_requested=_order_quantity(order),
        total_amount=order.total_amount,
        amount_paid=order.amount_paid,
        amount_due=order.amount_due,
        outsourcing_cost_total=order.outsourcing_cost_total,
        outsourcing_paid_total=order.outsourcing_paid_total,
        outsourcing_pending_total=order.outsourcing_pending_total,
        estimated_result=order.estimated_result,
        items=[_build_report_item(item, order) for item in order.items],
        payments=[
            GroupInternalReportPayment(
                order_id=order.id,
                amount=payment.amount,
                payment_method=payment.payment_method,
                paid_at=payment.paid_at,
                notes=payment.notes,
            )
            for payment in order.payments
        ],
        production_events=[
            GroupInternalReportProductionEvent(
                order_id=order.id,
                order_item_id=event.order_item_id,
                event_type=event.event_type,
                quantity=event.quantity,
                notes=event.notes,
                from_status=event.from_status,
                to_status=event.to_status,
                created_at=event.created_at,
            )
            for event in order.production_events
        ],
        outsourcings=[
            GroupInternalReportOutsourcing(
                order_id=order.id,
                order_item_id=outsourcing.order_item_id,
                outsourcer=outsourcing.outsourcer.name if outsourcing.outsourcer else None,
                quantity_sent=outsourcing.quantity_sent,
                quantity_returned=outsourcing.quantity_returned,
                customer_unit_price=outsourcing.customer_unit_price,
                outsourcer_unit_price=outsourcing.outsourcer_unit_price,
                customer_total=outsourcing.customer_total,
                outsourcer_total=outsourcing.outsourcer_total,
                profit_total=outsourcing.profit_total,
                status=outsourcing.status,
                payout_status=outsourcing.payout_status,
            )
            for outsourcing in order.outsourcings
        ],
    )


def _build_report_item(item: OrderItem, order: Order) -> ReportItem:
    return ReportItem(
        id=item.id,
        product=ReportProduct.model_validate(item.product),
        size=ReportSize.model_validate(item.size),
        color=item.color,
        quantity_requested=item.quantity_requested,
        quantity_cut=item.quantity_cut,
        quantity_printed=item.quantity_printed,
        quantity_sewn=item.quantity_sewn,
        quantity_delivered=item.quantity_delivered,
        delivery_status=item.delivery_status,
        sewing_mode=item.sewing_mode,
        dtf_notes=item.dtf_notes,
        is_cancelled=item.is_cancelled,
        cancelled_at=item.cancelled_at,
        cancel_reason=item.cancel_reason,
        services=[
            ReportService(
                name=item_service.service.name,
                quantity=item_service.quantity,
                unit_price=item_service.unit_price,
                total_price=item_service.total_price,
            )
            for item_service in item.services
        ],
        outsourcing_services=[
            ReportService(
                name="Terceirizacao vendida",
                quantity=outsourcing.quantity_sent,
                unit_price=outsourcing.customer_unit_price,
                total_price=outsourcing.customer_total,
            )
            for outsourcing in order.outsourcings
            if outsourcing.order_item_id == item.id
            and outsourcing.status != "cancelled"
        ],
    )


def _active_items(order: Order) -> list[OrderItem]:
    return [item for item in order.items if not item.is_cancelled]


def _order_quantity(order: Order) -> int:
    return sum(item.quantity_requested for item in _active_items(order))


def _sum_money(values: Iterable[Decimal]) -> Decimal:
    return sum(values, Decimal("0.00")).quantize(MONEY_QUANTIZER)


def derive_order_group_financial_status(
    total_amount: Decimal,
    amount_paid: Decimal,
) -> FinancialStatus:
    if amount_paid == Decimal("0.00"):
        return FinancialStatus.PENDING
    if amount_paid < total_amount:
        return FinancialStatus.PARTIAL
    return FinancialStatus.PAID


def derive_order_group_production_status(orders: Sequence[Order]) -> ProductionStatus:
    if not orders:
        return ProductionStatus.CREATED

    statuses = [order.production_status for order in orders]
    active_statuses = [status for status in statuses if status != ProductionStatus.CANCELLED]

    if all(status == ProductionStatus.DELIVERED for status in statuses):
        return ProductionStatus.DELIVERED
    if statuses and all(
        status in {ProductionStatus.READY, ProductionStatus.DELIVERED}
        for status in statuses
    ):
        return ProductionStatus.READY
    if not active_statuses and any(status == ProductionStatus.CANCELLED for status in statuses):
        return ProductionStatus.CANCELLED
    if len(set(statuses)) == 1:
        return statuses[0]
    return ProductionStatus.MIXED


def generate_internal_order_report_pdf(report: InternalOrderReport) -> bytes:
    story = [
        *_document_header(
            title="Gratao Uniformes",
            subtitle=f"Relatorio interno da OS #{report.order_id}",
            badges=[
                (
                    f"Producao: {_production_status_label(report.production_status)}",
                    _status_tone(report.production_status.value),
                ),
                (
                    f"Financeiro: {_enum_label(report.financial_status, FINANCIAL_STATUS_LABELS)}",
                    _status_tone(report.financial_status.value),
                ),
            ],
        ),
        *_section(
            "Dados da OS",
            _info_grid(
                [
                    ("Cliente", report.client.name),
                    ("Telefone", _optional_text(report.client.phone)),
                    ("Status de producao", _production_status_label(report.production_status)),
                    (
                        "Status financeiro",
                        _enum_label(report.financial_status, FINANCIAL_STATUS_LABELS),
                    ),
                    ("Data de emissao", date_text(datetime.now())),
                ]
            ),
        ),
        *_section(
            "Quantidades",
            _info_grid(
                [
                    ("Solicitada", str(report.quantity_requested)),
                    ("Destinada", str(report.quantity_cut)),
                    ("DTF aplicado", str(report.quantity_printed)),
                    ("Costurada", str(report.quantity_sewn)),
                    ("Excedente historico", str(report.quantity_extra)),
                ]
            ),
        ),
        *_section(
            "Itens e servicos",
            _items_table(report.items, include_internal=True),
        ),
        *_section(
            "Totais financeiros",
            _financial_summary(
                [
                    ("Total do pedido", report.total_amount, "neutral"),
                    ("Pago pelo cliente", report.amount_paid, "positive"),
                    ("Saldo a receber", report.amount_due, "warning"),
                    ("Custo terceirizado", report.outsourcing_cost_total, "warning"),
                    ("Repasse pago", report.outsourcing_paid_total, "neutral"),
                    ("Repasse pendente", report.outsourcing_pending_total, "warning"),
                    (
                        "Resultado estimado",
                        report.estimated_result,
                        "negative" if _as_decimal(report.estimated_result) < 0 else "positive",
                    ),
                ]
            ),
        ),
        *_section(
            "Pagamentos",
            _payments_table(report.payments, include_notes=True),
        ),
        *_section(
            "Terceirizacoes",
            _outsourcings_table(report.outsourcings),
        ),
        *_section(
            "Eventos produtivos",
            _production_events_table(report.production_events),
        ),
    ]
    return _build_pdf(story)


def generate_client_order_report_pdf(report: ClientOrderReport) -> bytes:
    story = [
        *_document_header(
            title="Gratao Uniformes",
            subtitle=f"Resumo do pedido / OS #{report.order_id}",
            badges=[(f"Status: {report.production_status}", _client_status_tone(report.production_status))],
        ),
        *_section(
            "Dados do pedido",
            _info_grid(
                [
                    ("Cliente", report.client.name),
                    ("Telefone", _optional_text(report.client.phone)),
                    ("Quantidade total", str(report.quantity)),
                    ("Data de emissao", date_text(datetime.now())),
                ]
            ),
        ),
        *_section(
            "Itens e servicos",
            _items_table(report.items, include_internal=False),
        ),
        *_section(
            "Resumo financeiro",
            _financial_summary(
                [
                    ("Total do pedido", report.total_amount, "neutral"),
                    ("Valor pago", report.amount_paid, "positive"),
                    ("Saldo pendente", report.amount_due, "warning"),
                ]
            ),
        ),
        *_section(
            "Pagamentos",
            _payments_table(report.payments, include_notes=False),
        ),
    ]
    return _build_pdf(story)


def generate_internal_order_group_report_pdf(report: InternalOrderGroupReport) -> bytes:
    payments = [payment for order in report.orders for payment in order.payments]
    outsourcings = [outsourcing for order in report.orders for outsourcing in order.outsourcings]
    events = [event for order in report.orders for event in order.production_events]
    story = [
        *_document_header(
            title="Gratao Uniformes",
            subtitle=f"Relatorio interno do Pedido de Cliente #{report.group_id}",
            badges=[
                (
                    f"Producao: {_production_status_label(report.production_status)}",
                    _status_tone(report.production_status.value),
                ),
                (
                    f"Financeiro: {_enum_label(report.financial_status, FINANCIAL_STATUS_LABELS)}",
                    _status_tone(report.financial_status.value),
                ),
            ],
        ),
        *_section(
            "Dados do Pedido de Cliente",
            _info_grid(
                [
                    ("Referencia", report.reference),
                    ("Cliente", report.client.name),
                    ("Telefone", _optional_text(report.client.phone)),
                    ("Quantidade total", str(report.quantity_requested)),
                    ("OS vinculadas", str(report.order_count)),
                    ("Data de emissao", date_text(datetime.now())),
                ]
            ),
        ),
        *_section("OS vinculadas", _internal_group_orders_table(report.orders)),
        *_section(
            "Totais financeiros",
            _financial_summary(
                [
                    ("Total do pedido", report.total_amount, "neutral"),
                    ("Pago pelo cliente", report.amount_paid, "positive"),
                    ("Saldo a receber", report.amount_due, "warning"),
                    ("Custo terceirizado", report.outsourcing_cost_total, "warning"),
                    ("Repasse pago", report.outsourcing_paid_total, "neutral"),
                    ("Repasse pendente", report.outsourcing_pending_total, "warning"),
                    (
                        "Resultado estimado",
                        report.estimated_result,
                        "negative" if _as_decimal(report.estimated_result) < 0 else "positive",
                    ),
                ]
            ),
        ),
        *_section("Pagamentos por OS", _group_payments_table(payments, include_notes=True)),
        *_section("Terceirizacoes por OS", _group_outsourcings_table(outsourcings)),
        *_section("Eventos produtivos por OS", _group_production_events_table(events)),
    ]
    return _build_pdf(story)


def generate_client_order_group_report_pdf(report: ClientOrderGroupReport) -> bytes:
    story = [
        *_document_header(
            title="Gratao Uniformes",
            subtitle=f"Resumo do Pedido de Cliente #{report.group_id} - {report.reference}",
            badges=[(f"Status: {report.production_status}", _client_status_tone(report.production_status))],
        ),
        *_section(
            "Dados do pedido",
            _info_grid(
                [
                    ("Referencia", report.reference),
                    ("Cliente", report.client.name),
                    ("Telefone", _optional_text(report.client.phone)),
                    ("Quantidade total", str(report.quantity)),
                    ("OS vinculadas", str(len(report.orders))),
                    ("Data de emissao", date_text(datetime.now())),
                ]
            ),
        ),
        *_section("OS, produtos e servicos", _client_group_orders_table(report.orders)),
        *_section(
            "Resumo financeiro",
            _financial_summary(
                [
                    ("Total do pedido", report.total_amount, "neutral"),
                    ("Valor pago", report.amount_paid, "positive"),
                    ("Saldo pendente", report.amount_due, "warning"),
                ]
            ),
        ),
        *_section("Pagamentos", _group_payments_table(report.payments, include_notes=False)),
    ]
    return _build_pdf(story)


def generate_weekly_closing_report_pdf(closing: WeeklyClosing) -> bytes:
    employee = closing.employee
    employee_name = employee.name if employee else f"Funcionario #{closing.employee_id or '-'}"
    period_text = f"{date_text(closing.start_date)} a {date_text(closing.end_date)}"
    status_label = _enum_label(closing.status, WEEKLY_CLOSING_STATUS_LABELS)

    story = [
        *_document_header(
            title="Gratao Uniformes",
            subtitle=f"Fechamento {employee_name} - {period_text}",
            badges=[(f"Status: {status_label}", _status_tone(closing.status.value))],
        ),
        *_section(
            "Dados do fechamento",
            _info_grid(
                [
                    ("Funcionario", employee_name),
                    ("Periodo", period_text),
                    ("Dias trabalhados", str(closing.days_worked)),
                    ("Data de emissao", date_text(datetime.now())),
                    ("Fechado em", date_text(closing.closed_at)),
                    ("Pago em", date_text(closing.paid_at)),
                ]
            ),
        ),
        *_section(
            "Resumo de horas",
            _info_grid(
                [
                    ("Horas brutas", duration(closing.total_gross_hours)),
                    ("Intervalos", duration(closing.total_break_hours)),
                    ("Horas liquidas", duration(closing.total_net_hours)),
                    ("Horas normais", duration(closing.total_regular_hours)),
                    ("Horas extras", duration(closing.total_overtime_hours)),
                    ("Status", status_label),
                ]
            ),
        ),
        *_section(
            "Resumo financeiro",
            _financial_summary(
                [
                    ("Base", closing.total_base_amount, "neutral"),
                    ("Horas extras", closing.total_overtime_amount, "positive"),
                    ("Descontos", closing.discounts, "warning"),
                    ("Adiantamentos", closing.advances, "warning"),
                    (
                        "Total a pagar",
                        closing.total_payable,
                        "negative" if _as_decimal(closing.total_payable) < 0 else "positive",
                    ),
                ]
            ),
        ),
        *_section("Dias incluidos", _weekly_closing_work_logs_table(closing.work_logs)),
        *_section(
            "Assinatura",
            _signature_table(
                employee_name=employee_name,
                pix_text=_weekly_closing_pix_text(closing),
                notes=closing.notes,
            ),
        ),
    ]
    return _build_pdf(story)


def money(value: object) -> str:
    amount = _as_decimal(value)
    sign = "-" if amount < 0 else ""
    amount = abs(amount)
    raw = f"{amount:,.2f}"
    formatted = raw.replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{sign}R$ {formatted}"


def duration(value: object) -> str:
    amount = _as_decimal(value)
    if amount <= 0:
        return "0min"

    total_minutes = int((amount * Decimal("60")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    hours = total_minutes // 60
    minutes = total_minutes % 60

    if hours == 0:
        return f"{minutes}min"
    if minutes == 0:
        return f"{hours}h"
    return f"{hours}h{minutes:02d}min"


def date_text(value: object) -> str:
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def time_text(value: object) -> str:
    if value is None:
        return "-"
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    text = str(value)
    return text[:5] if len(text) >= 5 else text


def _production_event_label(event_type: str) -> str:
    labels = {
        "cut_registered": "Corte registrado no estoque",
        "cut_pieces_allocated": "Pecas destinadas para OS",
        "cut_pieces_returned": "Pecas devolvidas ao estoque",
        "production_paused": "Producao pausada",
        "production_resumed": "Producao retomada",
        "print_registered": "DTF registrado",
        "sewing_registered": "Confeccao registrada",
        "outsourcing_sent": "Terceirizacao enviada",
        "outsourcing_returned": "Retorno da terceirizacao",
        "outsourcing_payout_paid": "Repasse de terceirizacao pago",
        "delivery_registered": "Entrega registrada",
        "order_item_cancelled": "Item cancelado",
        "loss_registered": "Perda registrada",
        "rework_registered": "Retrabalho registrado",
        "adjustment_registered": "Ajuste operacional",
        "status_changed": "Status alterado",
    }
    return labels.get(event_type, event_type)


def _build_pdf(story: list[Any]) -> bytes:
    try:
        buffer = BytesIO()
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=PAGE_MARGIN,
            leftMargin=PAGE_MARGIN,
            topMargin=PAGE_MARGIN,
            bottomMargin=PAGE_MARGIN,
            title="Gratao Uniformes",
        )
        document.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
        buffer.seek(0)
        return buffer.read()
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF dependency reportlab is not installed",
        ) from exc


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "GrataoTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=PDF_COLORS["ink"],
            spaceAfter=3,
        ),
        "subtitle": ParagraphStyle(
            "GrataoSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=PDF_COLORS["muted"],
        ),
        "section": ParagraphStyle(
            "GrataoSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=PDF_COLORS["ink"],
            spaceBefore=2,
            spaceAfter=6,
        ),
        "label": ParagraphStyle(
            "GrataoLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            splitLongWords=1,
            textColor=PDF_COLORS["muted"],
        ),
        "body": ParagraphStyle(
            "GrataoBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11,
            splitLongWords=1,
            textColor=PDF_COLORS["ink"],
        ),
        "body_bold": ParagraphStyle(
            "GrataoBodyBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.4,
            leading=11,
            splitLongWords=1,
            textColor=PDF_COLORS["ink"],
        ),
        "small": ParagraphStyle(
            "GrataoSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            splitLongWords=1,
            textColor=PDF_COLORS["muted"],
        ),
        "right": ParagraphStyle(
            "GrataoRight",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11,
            alignment=TA_RIGHT,
            textColor=PDF_COLORS["ink"],
        ),
        "badge": ParagraphStyle(
            "GrataoBadge",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=9,
            alignment=TA_CENTER,
            textColor=PDF_COLORS["ink"],
        ),
    }


def _document_header(
    title: str,
    subtitle: str,
    badges: Sequence[tuple[str, str]],
) -> list[Any]:
    styles = _styles()
    badge_table = _badges_table(badges)
    table = Table(
        [
            [
                _brand_header_content(title, subtitle),
                badge_table,
            ]
        ],
        colWidths=[118 * mm, 50 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PDF_COLORS["soft"]),
                ("BOX", (0, 0), (-1, -1), 0.7, PDF_COLORS["line"]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return [table, Spacer(1, SECTION_SPACING)]


def _brand_header_content(title: str, subtitle: str) -> Table:
    styles = _styles()
    logo = _logo_image()
    text_content = [
        Paragraph(_text(title), styles["title"]),
        Paragraph(_text(subtitle), styles["subtitle"]),
    ]
    if logo is None:
        return Table([[text_content]], colWidths=[112 * mm], hAlign="LEFT")

    table = Table([[logo, text_content]], colWidths=[34 * mm, 78 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _logo_image() -> ReportImage | None:
    if not LOGO_PATH.exists():
        return None
    return ReportImage(str(LOGO_PATH), width=32 * mm, height=20 * mm)


def _section(title: str, content: Any) -> list[Any]:
    styles = _styles()
    return [
        Paragraph(_text(title.upper()), styles["section"]),
        content,
        Spacer(1, SECTION_SPACING),
    ]


def _info_grid(fields: Sequence[tuple[str, str]]) -> Table:
    styles = _styles()
    rows = []
    for start in range(0, len(fields), 3):
        chunk = fields[start : start + 3]
        while len(chunk) < 3:
            chunk = [*chunk, ("", "")]
        rows.append(
            [
                [
                    Paragraph(_text(label.upper()), styles["label"]),
                    Paragraph(_text(value), styles["body_bold"]),
                ]
                for label, value in chunk
            ]
        )
    table = Table(rows, colWidths=[56 * mm, 56 * mm, 56 * mm], hAlign="LEFT")
    table.setStyle(_card_table_style())
    return table


def _items_table(items: Sequence[ReportItem], *, include_internal: bool) -> Table:
    styles = _styles()
    headers = ["Produto", "Tam.", "Cor", "Qtd.", "Servicos", "Valor"]
    if include_internal:
        headers.insert(4, "Producao")
    rows: list[list[Any]] = [[Paragraph(_text(header), styles["body_bold"]) for header in headers]]

    for item in items:
        display_services = [*item.services, *item.outsourcing_services]
        services_text = "<br/>".join(
            _text(
                f"{service.name}: {service.quantity} x {money(service.unit_price)} = {money(service.total_price)}"
            )
            for service in display_services
        )
        if not services_text:
            services_text = "-"

        item_total = sum((_as_decimal(service.total_price) for service in display_services), Decimal("0.00"))
        product_name = item.product.name
        if include_internal and item.is_cancelled:
            product_name = f"{product_name} (CANCELADO)"
        row = [
            Paragraph(_text(product_name), styles["body_bold"]),
            Paragraph(_text(item.size.label), styles["body"]),
            Paragraph(_text(item.color or "-"), styles["body"]),
            Paragraph(str(item.quantity_requested), styles["right"]),
        ]
        if include_internal:
            production_lines = [
                f"Dest.: {item.quantity_cut}",
                f"DTF: {item.quantity_printed}",
                f"Cost.: {item.quantity_sewn}",
                f"Entr.: {item.quantity_delivered}",
            ]
            if item.dtf_notes:
                production_lines.append(f"Obs. DTF: {item.dtf_notes}")
            if item.is_cancelled and item.cancel_reason:
                production_lines.append(f"Motivo: {item.cancel_reason}")
            row.append(Paragraph(_text("<br/>".join(production_lines)), styles["small"]))
        row.extend(
            [
                Paragraph(services_text, styles["body"]),
                Paragraph(money(item_total), styles["right"]),
            ]
        )
        rows.append(row)

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum item vinculado.", styles["body"])] + [""] * (len(headers) - 1))

    widths = [34 * mm, 15 * mm, 23 * mm, 13 * mm, 58 * mm, 25 * mm]
    if include_internal:
        widths = [29 * mm, 13 * mm, 18 * mm, 12 * mm, 27 * mm, 48 * mm, 21 * mm]
    return _simple_table(rows, widths, right_columns={3, len(headers) - 1})


def _client_group_orders_table(orders: Sequence[ClientOrderGroupReportOrder]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("OS", styles["body_bold"]),
            Paragraph("Produtos", styles["body_bold"]),
            Paragraph("Qtd.", styles["body_bold"]),
            Paragraph("Servicos vendidos", styles["body_bold"]),
            Paragraph("Status", styles["body_bold"]),
            Paragraph("Valor", styles["body_bold"]),
        ]
    ]
    for order in orders:
        products = "<br/>".join(
            _text(f"{item.product.name} {item.size.label} / {item.color or '-'}")
            for item in order.items
        )
        services = "<br/>".join(
            _text(
                f"OS #{order.order_id} - {service.name}: {service.quantity} x "
                f"{money(service.unit_price)} = {money(service.total_price)}"
            )
            for item in order.items
            for service in [*item.services, *item.outsourcing_services]
        )
        rows.append(
            [
                Paragraph(_text(f"#{order.order_id}"), styles["body_bold"]),
                Paragraph(products or "-", styles["body"]),
                Paragraph(str(order.quantity), styles["right"]),
                Paragraph(services or "-", styles["body"]),
                Paragraph(_text(order.production_status), styles["body"]),
                Paragraph(money(order.total_amount), styles["right"]),
            ]
        )
    if len(rows) == 1:
        rows.append([Paragraph("Nenhuma OS vinculada.", styles["body"]), "", "", "", "", ""])
    return _simple_table(rows, [15 * mm, 39 * mm, 14 * mm, 62 * mm, 23 * mm, 15 * mm], right_columns={2, 5})


def _internal_group_orders_table(orders: Sequence[InternalOrderGroupReportOrder]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("OS", styles["body_bold"]),
            Paragraph("Status", styles["body_bold"]),
            Paragraph("Itens e servicos", styles["body_bold"]),
            Paragraph("Valores", styles["body_bold"]),
        ]
    ]
    for order in orders:
        items_text = "<br/>".join(
            _text(
                f"{item.quantity_requested}x {item.product.name} {item.size.label} / "
                f"{item.color or '-'}"
            )
            for item in order.items
        )
        service_text = "<br/>".join(
            _text(f"{service.name}: {money(service.total_price)}")
            for item in order.items
            for service in [*item.services, *item.outsourcing_services]
        )
        rows.append(
            [
                Paragraph(_text(f"#{order.order_id}"), styles["body_bold"]),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                _production_status_label(order.production_status),
                                _enum_label(order.financial_status, FINANCIAL_STATUS_LABELS),
                            ]
                        )
                    ),
                    styles["body"],
                ),
                Paragraph(_text("<br/>".join([items_text or "-", service_text or "-"])), styles["body"]),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                f"Cobrado: {money(order.total_amount)}",
                                f"Pago: {money(order.amount_paid)}",
                                f"Saldo: {money(order.amount_due)}",
                                f"Custo terc.: {money(order.outsourcing_cost_total)}",
                                f"Resultado: {money(order.estimated_result)}",
                            ]
                        )
                    ),
                    styles["body"],
                ),
            ]
        )
    if len(rows) == 1:
        rows.append([Paragraph("Nenhuma OS vinculada.", styles["body"]), "", "", ""])
    return _simple_table(rows, [16 * mm, 34 * mm, 74 * mm, 44 * mm], right_columns=set())


def _financial_summary(entries: Sequence[tuple[str, object, str]]) -> Table:
    styles = _styles()
    rows = []
    for start in range(0, len(entries), 3):
        chunk = entries[start : start + 3]
        while len(chunk) < 3:
            chunk = [*chunk, ("", "", "neutral")]
        row = []
        for label, value, tone in chunk:
            row.append(
                [
                    Paragraph(_text(label.upper()), styles["label"]),
                    Paragraph(_text(money(value) if label else ""), _money_style(tone)),
                ]
            )
        rows.append(row)
    table = Table(rows, colWidths=[56 * mm, 56 * mm, 56 * mm], hAlign="LEFT")
    table.setStyle(_card_table_style())
    return table


def _payments_table(payments: Sequence[Any], *, include_notes: bool) -> Table:
    styles = _styles()
    headers = ["Valor", "Metodo", "Data"]
    if include_notes:
        headers.append("Observacoes")
    rows: list[list[Any]] = [[Paragraph(_text(header), styles["body_bold"]) for header in headers]]
    for payment in payments:
        row = [
            Paragraph(money(payment.amount), styles["right"]),
            Paragraph(_text(_enum_label(payment.payment_method, PAYMENT_METHOD_LABELS)), styles["body"]),
            Paragraph(_text(date_text(payment.paid_at)), styles["body"]),
        ]
        if include_notes:
            row.append(Paragraph(_text(_optional_text(payment.notes)), styles["body"]))
        rows.append(row)

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum pagamento lancado.", styles["body"])] + [""] * (len(headers) - 1))

    widths = [30 * mm, 34 * mm, 36 * mm]
    if include_notes:
        widths.append(68 * mm)
    return _simple_table(rows, widths, right_columns={0})


def _group_payments_table(payments: Sequence[Any], *, include_notes: bool) -> Table:
    styles = _styles()
    headers = ["OS", "Valor", "Metodo", "Data"]
    if include_notes:
        headers.append("Observacoes")
    rows: list[list[Any]] = [[Paragraph(_text(header), styles["body_bold"]) for header in headers]]
    for payment in payments:
        row = [
            Paragraph(_text(f"#{payment.order_id}"), styles["body_bold"]),
            Paragraph(money(payment.amount), styles["right"]),
            Paragraph(_text(_enum_label(payment.payment_method, PAYMENT_METHOD_LABELS)), styles["body"]),
            Paragraph(_text(date_text(payment.paid_at)), styles["body"]),
        ]
        if include_notes:
            row.append(Paragraph(_text(_optional_text(payment.notes)), styles["body"]))
        rows.append(row)

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum pagamento lancado.", styles["body"])] + [""] * (len(headers) - 1))

    widths = [16 * mm, 28 * mm, 31 * mm, 36 * mm]
    if include_notes:
        widths.append(57 * mm)
    return _simple_table(rows, widths, right_columns={1})


def _outsourcings_table(outsourcings: Sequence[InternalReportOutsourcing]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("Item", styles["body_bold"]),
            Paragraph("Terceirizado", styles["body_bold"]),
            Paragraph("Qtd.", styles["body_bold"]),
            Paragraph("Valores", styles["body_bold"]),
            Paragraph("Status", styles["body_bold"]),
        ]
    ]
    for outsourcing in outsourcings:
        rows.append(
            [
                Paragraph(_text(str(outsourcing.order_item_id or "-")), styles["body"]),
                Paragraph(_text(outsourcing.outsourcer or "Sem terceirizado"), styles["body"]),
                Paragraph(
                    _text(f"Env.: {outsourcing.quantity_sent}<br/>Ret.: {outsourcing.quantity_returned}"),
                    styles["body"],
                ),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                f"Cliente: {money(outsourcing.customer_total)}",
                                f"Custo: {money(outsourcing.outsourcer_total)}",
                                f"Resultado: {money(outsourcing.profit_total)}",
                            ]
                        )
                    ),
                    styles["body"],
                ),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                _enum_label(outsourcing.status, OUTSOURCING_STATUS_LABELS),
                                f"Repasse: {_enum_label(outsourcing.payout_status, PAYOUT_STATUS_LABELS)}",
                            ]
                        )
                    ),
                    styles["body"],
                ),
            ]
        )

    if len(rows) == 1:
        rows.append([Paragraph("Nenhuma terceirizacao registrada.", styles["body"]), "", "", "", ""])
    return _simple_table(rows, [16 * mm, 42 * mm, 25 * mm, 55 * mm, 30 * mm], right_columns=set())


def _group_outsourcings_table(outsourcings: Sequence[GroupInternalReportOutsourcing]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("OS", styles["body_bold"]),
            Paragraph("Item", styles["body_bold"]),
            Paragraph("Terceirizado", styles["body_bold"]),
            Paragraph("Qtd.", styles["body_bold"]),
            Paragraph("Valores", styles["body_bold"]),
            Paragraph("Status", styles["body_bold"]),
        ]
    ]
    for outsourcing in outsourcings:
        rows.append(
            [
                Paragraph(_text(f"#{outsourcing.order_id}"), styles["body_bold"]),
                Paragraph(_text(str(outsourcing.order_item_id or "-")), styles["body"]),
                Paragraph(_text(outsourcing.outsourcer or "Sem terceirizado"), styles["body"]),
                Paragraph(
                    _text(f"Env.: {outsourcing.quantity_sent}<br/>Ret.: {outsourcing.quantity_returned}"),
                    styles["body"],
                ),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                f"Cliente: {money(outsourcing.customer_total)}",
                                f"Custo: {money(outsourcing.outsourcer_total)}",
                                f"Resultado: {money(outsourcing.profit_total)}",
                            ]
                        )
                    ),
                    styles["body"],
                ),
                Paragraph(
                    _text(
                        "<br/>".join(
                            [
                                _enum_label(outsourcing.status, OUTSOURCING_STATUS_LABELS),
                                f"Repasse: {_enum_label(outsourcing.payout_status, PAYOUT_STATUS_LABELS)}",
                            ]
                        )
                    ),
                    styles["body"],
                ),
            ]
        )

    if len(rows) == 1:
        rows.append([Paragraph("Nenhuma terceirizacao registrada.", styles["body"]), "", "", "", "", ""])
    return _simple_table(rows, [14 * mm, 14 * mm, 38 * mm, 23 * mm, 51 * mm, 28 * mm], right_columns=set())


def _production_events_table(events: Sequence[InternalReportProductionEvent]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("Data", styles["body_bold"]),
            Paragraph("Evento", styles["body_bold"]),
            Paragraph("Item", styles["body_bold"]),
            Paragraph("Qtd.", styles["body_bold"]),
            Paragraph("Detalhes", styles["body_bold"]),
        ]
    ]
    for event in events:
        details = []
        if event.from_status or event.to_status:
            details.append(
                " -> ".join(
                    [
                        _production_status_label(event.from_status) if event.from_status else "-",
                        _production_status_label(event.to_status) if event.to_status else "-",
                    ]
                )
            )
        if event.notes:
            details.append(event.notes)
        rows.append(
            [
                Paragraph(_text(date_text(event.created_at)), styles["body"]),
                Paragraph(_text(_production_event_label(event.event_type.value)), styles["body"]),
                Paragraph(_text(str(event.order_item_id or "-")), styles["right"]),
                Paragraph(_text(str(event.quantity if event.quantity is not None else "-")), styles["right"]),
                Paragraph(_text("<br/>".join(details) if details else "-"), styles["body"]),
            ]
        )

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum evento produtivo registrado.", styles["body"]), "", "", "", ""])
    return _simple_table(rows, [31 * mm, 45 * mm, 16 * mm, 15 * mm, 61 * mm], right_columns={2, 3})


def _group_production_events_table(events: Sequence[GroupInternalReportProductionEvent]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("Data", styles["body_bold"]),
            Paragraph("OS", styles["body_bold"]),
            Paragraph("Evento", styles["body_bold"]),
            Paragraph("Item", styles["body_bold"]),
            Paragraph("Qtd.", styles["body_bold"]),
            Paragraph("Detalhes", styles["body_bold"]),
        ]
    ]
    for event in events:
        details = []
        if event.from_status or event.to_status:
            details.append(
                " -> ".join(
                    [
                        _production_status_label(event.from_status) if event.from_status else "-",
                        _production_status_label(event.to_status) if event.to_status else "-",
                    ]
                )
            )
        if event.notes:
            details.append(event.notes)
        rows.append(
            [
                Paragraph(_text(date_text(event.created_at)), styles["body"]),
                Paragraph(_text(f"#{event.order_id}"), styles["body_bold"]),
                Paragraph(_text(_production_event_label(event.event_type.value)), styles["body"]),
                Paragraph(_text(str(event.order_item_id or "-")), styles["right"]),
                Paragraph(_text(str(event.quantity if event.quantity is not None else "-")), styles["right"]),
                Paragraph(_text("<br/>".join(details) if details else "-"), styles["body"]),
            ]
        )

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum evento produtivo registrado.", styles["body"]), "", "", "", "", ""])
    return _simple_table(rows, [29 * mm, 14 * mm, 40 * mm, 14 * mm, 14 * mm, 57 * mm], right_columns={3, 4})


def _weekly_closing_work_logs_table(work_logs: Sequence[Any]) -> Table:
    styles = _styles()
    rows: list[list[Any]] = [
        [
            Paragraph("Data", styles["body_bold"]),
            Paragraph("Entrada", styles["body_bold"]),
            Paragraph("Saida", styles["body_bold"]),
            Paragraph("Liquidas", styles["body_bold"]),
            Paragraph("Extras", styles["body_bold"]),
            Paragraph("Total", styles["body_bold"]),
        ]
    ]
    for log in sorted(work_logs, key=lambda item: item.work_date):
        rows.append(
            [
                Paragraph(_text(date_text(log.work_date)), styles["body_bold"]),
                Paragraph(_text(time_text(log.clock_in)), styles["body"]),
                Paragraph(_text(time_text(log.clock_out)), styles["body"]),
                Paragraph(_text(duration(log.net_hours)), styles["right"]),
                Paragraph(_text(duration(log.overtime_hours)), styles["right"]),
                Paragraph(money(log.total_amount), styles["right"]),
            ]
        )

    if len(rows) == 1:
        rows.append([Paragraph("Nenhum dia vinculado.", styles["body"]), "", "", "", "", ""])

    return _simple_table(rows, [27 * mm, 22 * mm, 22 * mm, 28 * mm, 28 * mm, 41 * mm], right_columns={3, 4, 5})


def _signature_table(employee_name: str, pix_text: str, notes: object) -> Table:
    styles = _styles()
    rows = [
        [
            [
                Paragraph("FUNCIONARIO", styles["label"]),
                Paragraph(_text(employee_name), styles["body_bold"]),
            ],
            [
                Paragraph("PIX", styles["label"]),
                Paragraph(_text(pix_text), styles["body"]),
            ],
        ],
        [
            [
                Paragraph("OBSERVACOES", styles["label"]),
                Paragraph(_text(_optional_text(notes)), styles["body"]),
            ],
            [
                Paragraph("DATA DA ASSINATURA", styles["label"]),
                Paragraph("____/____/________", styles["body_bold"]),
            ],
        ],
        [
            [
                Paragraph("ASSINATURA DO FUNCIONARIO", styles["label"]),
                Spacer(1, 16),
                Paragraph("____________________________________________", styles["body_bold"]),
            ],
            [
                Paragraph("ASSINATURA DA EMPRESA", styles["label"]),
                Spacer(1, 16),
                Paragraph("____________________________________________", styles["body_bold"]),
            ],
        ],
    ]
    table = Table(rows, colWidths=[84 * mm, 84 * mm], hAlign="LEFT")
    table.setStyle(_card_table_style())
    return table


def _weekly_closing_pix_text(closing: WeeklyClosing) -> str:
    if not closing.employee_pix_key:
        return "Pix pendente"
    if not closing.employee_pix_key_type:
        return closing.employee_pix_key
    return f"{_enum_label(closing.employee_pix_key_type, PIX_KEY_TYPE_LABELS)} / {closing.employee_pix_key}"


def _simple_table(
    rows: list[list[Any]],
    col_widths: Sequence[float],
    *,
    right_columns: set[int],
) -> Table:
    table = Table(rows, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    style_commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), PDF_COLORS["soft_alt"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), PDF_COLORS["ink"]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, PDF_COLORS["line"]),
        ("GRID", (0, 0), (-1, -1), 0.45, PDF_COLORS["line"]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for column in right_columns:
        style_commands.append(("ALIGN", (column, 1), (column, -1), "RIGHT"))
    for row_index in range(1, len(rows)):
        if row_index % 2 == 0:
            style_commands.append(("BACKGROUND", (0, row_index), (-1, row_index), PDF_COLORS["soft"]))
    table.setStyle(TableStyle(style_commands))
    return table


def _badges_table(badges: Sequence[tuple[str, str]]) -> Table:
    styles = _styles()
    rows = [[Paragraph(_text(label), styles["badge"])] for label, _tone in badges]
    if not rows:
        rows = [[""]]
    table = Table(rows, colWidths=[45 * mm], hAlign="RIGHT")
    commands: list[tuple[Any, ...]] = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for index, (_label, tone) in enumerate(badges):
        background, text_color = _tone_colors(tone)
        commands.extend(
            [
                ("BACKGROUND", (0, index), (0, index), background),
                ("TEXTCOLOR", (0, index), (0, index), text_color),
                ("BOX", (0, index), (0, index), 0.6, background),
            ]
        )
    table.setStyle(TableStyle(commands))
    return table


def _card_table_style() -> TableStyle:
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), PDF_COLORS["soft"]),
            ("BOX", (0, 0), (-1, -1), 0.6, PDF_COLORS["line"]),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, PDF_COLORS["line"]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]
    )


def _money_style(tone: str) -> ParagraphStyle:
    styles = _styles()
    background, text_color = _tone_colors(tone)
    return ParagraphStyle(
        f"Money{tone}",
        parent=styles["body_bold"],
        fontSize=11,
        leading=14,
        textColor=text_color,
        backColor=background,
    )


def _tone_colors(tone: str) -> tuple[Any, Any]:
    if tone == "positive":
        return PDF_COLORS["accent"], PDF_COLORS["accent_text"]
    if tone == "warning":
        return PDF_COLORS["warning"], PDF_COLORS["warning_text"]
    if tone == "negative":
        return PDF_COLORS["danger"], PDF_COLORS["danger_text"]
    return PDF_COLORS["white"], PDF_COLORS["ink"]


def _draw_footer(canvas: Any, document: SimpleDocTemplate) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(PDF_COLORS["muted"])
    canvas.drawRightString(
        document.pagesize[0] - PAGE_MARGIN,
        8 * mm,
        f"Pagina {document.page}",
    )
    canvas.restoreState()


def _status_tone(status_value: str) -> str:
    if status_value in {"paid", "ready", "delivered", "sewing_done", "returned"}:
        return "positive"
    if status_value in {"pending", "partial", "partial_ready", "mixed", "outsourced"}:
        return "warning"
    if status_value == "cancelled":
        return "negative"
    return "neutral"


def _client_status_tone(status_label: str) -> str:
    normalized = status_label.lower()
    if "entregue" in normalized or "pronto" in normalized:
        return "positive"
    if "cancelado" in normalized:
        return "negative"
    return "warning"


def _production_status_label(value: ProductionStatus | None) -> str:
    if value is None:
        return "-"
    return PRODUCTION_STATUS_LABELS.get(value, value.value)


def _enum_label(value: Any, labels: dict[str, str]) -> str:
    raw = value.value if hasattr(value, "value") else str(value)
    return labels.get(raw, raw)


def _optional_text(value: object) -> str:
    if value is None:
        return "-"
    text = str(value).strip()
    return text or "-"


def _as_decimal(value: object) -> Decimal:
    if isinstance(value, Decimal):
        amount = value
    else:
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            amount = Decimal("0.00")
    return amount.quantize(MONEY_QUANTIZER)


def _text(value: object) -> str:
    text = _optional_text(value)
    escaped = escape(text, {"'": "&apos;", '"': "&quot;"})
    return escaped.replace("&lt;br/&gt;", "<br/>")
