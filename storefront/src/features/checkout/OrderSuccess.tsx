import { Container, Section } from "@/components/layout";
import { LinkButton } from "@/components/ui";
import { CheckoutStepper } from "./CheckoutStepper";
import styles from "@/features/cart/CommerceFlow.module.css";

export function SuccessCard() { return <div className={styles.success}><span aria-hidden="true" className={styles.successMark}>✓</span><span className={styles.eyebrow}>Confirmation preview</span><h1>Thank you for reviewing the journey</h1><p>No order was created. Order number, invoice and tracking remain clearly labelled placeholders.</p><dl><dt>Order number</dt><dd>Not generated</dd><dt>Invoice</dt><dd>Not available in static preview</dd><dt>Tracking</dt><dd>No shipment exists</dd></dl><div className={styles.actions}><LinkButton href="/orders">Track order placeholder</LinkButton><LinkButton href="/shop" variant="secondary">Continue shopping</LinkButton></div></div>; }
export function OrderSuccessPage() { return <><Section><Container><CheckoutStepper current="Confirmation" /></Container></Section><Section><Container><SuccessCard /></Container></Section></>; }
export function NoOrders() { return <div className={styles.empty} role="status"><span aria-hidden="true" className={styles.emptyMark}>List</span><h1>No orders yet</h1><p>Real order history requires future authenticated commerce services.</p><LinkButton href="/shop">Explore catalogue</LinkButton></div>; }
