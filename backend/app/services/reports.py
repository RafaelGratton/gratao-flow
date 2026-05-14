from io import BytesIO
from typing import Iterable

from fastapi import HTTPException, status

from app.models.enums import ProductionStatus
from app.models.order import Order, OrderItem
from app.schemas.report import (
    ClientOrderReport,
    ClientReportPayment,
    InternalOrderReport,
    InternalReportOutsourcing,
    InternalReportPayment,
    InternalReportProductionEvent,
    ReportClient,
    ReportItem,
    ReportProduct,
    ReportService,
    ReportSize,
)


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


def build_internal_order_report(order: Order) -> InternalOrderReport:
    return InternalOrderReport(
        order_id=order.id,
        client=ReportClient.model_validate(order.client),
        quantity_requested=sum(item.quantity_requested for item in order.items),
        quantity_cut=sum(item.quantity_cut for item in order.items),
        quantity_printed=sum(item.quantity_printed for item in order.items),
        quantity_sewn=sum(item.quantity_sewn for item in order.items),
        quantity_extra=sum(max(item.quantity_cut - item.quantity_requested, 0) for item in order.items),
        items=[_build_report_item(item) for item in order.items],
        total_amount=order.total_amount,
        amount_paid=order.amount_paid,
        amount_due=order.amount_due,
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
    return ClientOrderReport(
        client=ReportClient.model_validate(order.client),
        order_id=order.id,
        quantity=sum(item.quantity_requested for item in order.items),
        items=[_build_report_item(item) for item in order.items],
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


def _build_report_item(item: OrderItem) -> ReportItem:
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
        services=[
            ReportService(
                name=item_service.service.name,
                quantity=item_service.quantity,
                unit_price=item_service.unit_price,
                total_price=item_service.total_price,
            )
            for item_service in item.services
        ],
    )


def generate_internal_order_report_pdf(report: InternalOrderReport) -> bytes:
    rows = [
        "Relatorio Interno - Gratao Flow",
        f"OS: {report.order_id}",
        f"Cliente: {report.client.name} | Telefone: {report.client.phone}",
        (
            f"Quantidades: solicitada {report.quantity_requested}, corte {report.quantity_cut}, "
            f"impressa {report.quantity_printed}, costurada {report.quantity_sewn}, extra {report.quantity_extra}"
        ),
        f"Status producao: {report.production_status.value}",
        f"Status financeiro: {report.financial_status.value}",
        "",
        "Itens",
        *[
            f"- Item {item.id}: {item.product.name} | Tam {item.size.label} | Cor {item.color} | qtd {item.quantity_requested}"
            for item in report.items
        ],
        "",
        "Servicos por item",
        *[
            (
                f"- Item {item.id} / {service.name}: qtd {service.quantity} x "
                f"{money(service.unit_price)} = {money(service.total_price)}"
            )
            for item in report.items
            for service in item.services
        ],
        "",
        f"Total: {money(report.total_amount)}",
        f"Pago: {money(report.amount_paid)}",
        f"Saldo: {money(report.amount_due)}",
        "",
        "Pagamentos",
        *[
            f"- {money(payment.amount)} | {payment.payment_method.value} | {date_text(payment.paid_at)}"
            for payment in report.payments
        ],
        "",
        "Eventos produtivos",
        *[
            (
                f"- {event.event_type.value} | item {event.order_item_id or '-'} | "
                f"qtd {event.quantity} | {date_text(event.created_at)}"
                f"{' | ' + event.notes if event.notes else ''}"
            )
            for event in report.production_events
        ],
        "",
        "Terceirizacoes",
        *[
            (
                f"- Item {outsourcing.order_item_id or '-'} | {outsourcing.outsourcer or 'Sem terceirizado'} | "
                f"enviado {outsourcing.quantity_sent} | retornado {outsourcing.quantity_returned} | "
                f"cliente {money(outsourcing.customer_total)} | repasse {money(outsourcing.outsourcer_total)} | "
                f"lucro {money(outsourcing.profit_total)} | {outsourcing.status.value} | "
                f"payout {outsourcing.payout_status.value}"
            )
            for outsourcing in report.outsourcings
        ],
    ]
    return _build_pdf(rows)


def generate_client_order_report_pdf(report: ClientOrderReport) -> bytes:
    rows = [
        "Resumo do Pedido",
        "Gratao Uniformes",
        f"OS: {report.order_id}",
        f"Cliente: {report.client.name} | Telefone: {report.client.phone}",
        f"Quantidade: {report.quantity}",
        f"Status: {report.production_status}",
        "",
        "Itens",
        *[
            f"- {item.product.name} | Tam {item.size.label} | Cor {item.color} | qtd {item.quantity_requested}"
            for item in report.items
        ],
        "",
        "Servicos por item",
        *[
            (
                f"- {item.product.name} / {service.name}: qtd {service.quantity} x "
                f"{money(service.unit_price)} = {money(service.total_price)}"
            )
            for item in report.items
            for service in item.services
        ],
        "",
        f"Total: {money(report.total_amount)}",
        f"Pago: {money(report.amount_paid)}",
        f"Saldo: {money(report.amount_due)}",
        "",
        "Pagamentos",
        *[
            f"- {money(payment.amount)} | {payment.payment_method.value} | {date_text(payment.paid_at)}"
            for payment in report.payments
        ],
    ]
    return _build_pdf(rows)


def money(value: object) -> str:
    return f"{value:.2f}"


def date_text(value: object) -> str:
    return value.strftime("%Y-%m-%d")


def _build_pdf(rows: Iterable[str]) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF dependency reportlab is not installed",
        ) from exc

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    x = 48
    y = height - 48

    for index, row in enumerate(rows):
        if y < 48:
            pdf.showPage()
            y = height - 48
        pdf.setFont("Helvetica-Bold" if index == 0 else "Helvetica", 14 if index == 0 else 10)
        pdf.drawString(x, y, row[:115])
        y -= 18

    pdf.save()
    buffer.seek(0)
    return buffer.read()
