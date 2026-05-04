from io import BytesIO
from typing import Iterable

from fastapi import HTTPException, status

from app.models.enums import ProductionStatus
from app.models.order import Order
from app.schemas.report import (
    ClientOrderReport,
    ClientReportPayment,
    InternalOrderReport,
    InternalReportOutsourcing,
    InternalReportPayment,
    InternalReportProductionEvent,
    ReportClient,
    ReportProduct,
    ReportService,
    ReportSize,
)


CLIENT_STATUS_LABELS = {
    ProductionStatus.CREATED: "Em andamento",
    ProductionStatus.IN_CUT: "Em andamento",
    ProductionStatus.CUT_DONE: "Em produção",
    ProductionStatus.WAITING_PRINT: "Em produção",
    ProductionStatus.IN_PRINT: "Em produção",
    ProductionStatus.PRINT_DONE: "Em produção",
    ProductionStatus.WAITING_SEWING: "Em produção",
    ProductionStatus.IN_SEWING: "Em produção",
    ProductionStatus.SEWING_DONE: "Pronto",
    ProductionStatus.OUTSOURCED: "Em produção",
    ProductionStatus.RETURNED: "Em produção",
    ProductionStatus.READY: "Pronto",
    ProductionStatus.DELIVERED: "Entregue",
    ProductionStatus.CANCELLED: "Cancelado",
}


def build_internal_order_report(order: Order) -> InternalOrderReport:
    return InternalOrderReport(
        order_id=order.id,
        client=ReportClient.model_validate(order.client),
        product=ReportProduct.model_validate(order.product),
        size=ReportSize.model_validate(order.size),
        color=order.color,
        quantity_requested=order.quantity_requested,
        quantity_cut=order.quantity_cut,
        quantity_printed=order.quantity_printed,
        quantity_sewn=order.quantity_sewn,
        quantity_extra=order.quantity_extra,
        services=[
            ReportService(
                name=order_service.service.name,
                quantity=order_service.quantity,
                unit_price=order_service.unit_price,
                total_price=order_service.total_price,
            )
            for order_service in order.services
        ],
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
        product=ReportProduct.model_validate(order.product),
        size=ReportSize.model_validate(order.size),
        color=order.color,
        quantity=order.quantity_requested,
        services=[
            ReportService(
                name=order_service.service.name,
                quantity=order_service.quantity,
                unit_price=order_service.unit_price,
                total_price=order_service.total_price,
            )
            for order_service in order.services
        ],
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


def generate_internal_order_report_pdf(report: InternalOrderReport) -> bytes:
    rows = [
        "Relatório Interno - Gratão Flow",
        f"OS: {report.order_id}",
        f"Cliente: {report.client.name} | Telefone: {report.client.phone}",
        f"Produto: {report.product.name} | Tamanho: {report.size.label} | Cor: {report.color}",
        (
            f"Quantidades: solicitada {report.quantity_requested}, corte {report.quantity_cut}, "
            f"impressa {report.quantity_printed}, costurada {report.quantity_sewn}, extra {report.quantity_extra}"
        ),
        f"Status produção: {report.production_status.value}",
        f"Status financeiro: {report.financial_status.value}",
        "",
        "Serviços",
        *[
            (
                f"- {service.name}: qtd {service.quantity} x {money(service.unit_price)} "
                f"= {money(service.total_price)}"
            )
            for service in report.services
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
                f"- {event.event_type.value} | qtd {event.quantity} | {date_text(event.created_at)}"
                f"{' | ' + event.notes if event.notes else ''}"
            )
            for event in report.production_events
        ],
        "",
        "Terceirizações",
        *[
            (
                f"- {outsourcing.outsourcer or 'Sem terceirizado'} | enviado {outsourcing.quantity_sent} | "
                f"retornado {outsourcing.quantity_returned} | cliente {money(outsourcing.customer_total)} | "
                f"repasse {money(outsourcing.outsourcer_total)} | lucro {money(outsourcing.profit_total)} | "
                f"{outsourcing.status.value} | payout {outsourcing.payout_status.value}"
            )
            for outsourcing in report.outsourcings
        ],
    ]
    return _build_pdf(rows)


def generate_client_order_report_pdf(report: ClientOrderReport) -> bytes:
    rows = [
        "Resumo do Pedido",
        "Gratão Uniformes",
        f"OS: {report.order_id}",
        f"Cliente: {report.client.name} | Telefone: {report.client.phone}",
        f"Produto: {report.product.name} | Tamanho: {report.size.label} | Cor: {report.color}",
        f"Quantidade: {report.quantity}",
        f"Status: {report.production_status}",
        "",
        "Serviços",
        *[
            (
                f"- {service.name}: qtd {service.quantity} x {money(service.unit_price)} "
                f"= {money(service.total_price)}"
            )
            for service in report.services
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
