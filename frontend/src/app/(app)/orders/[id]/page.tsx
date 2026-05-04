import { OrderDetails } from "@/components/orders/OrderDetails";

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  return <OrderDetails orderId={Number(params.id)} />;
}
