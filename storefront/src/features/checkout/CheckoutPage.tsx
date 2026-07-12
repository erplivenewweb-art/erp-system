import { Breadcrumb } from "@/components/navigation";
import { Checkbox } from "@/components/forms";
import { Container, Section, Stack } from "@/components/layout";
import { LinkButton } from "@/components/ui";
import { OrderSummary } from "@/features/cart";
import { AddressCard, ExtrasCard, PaymentCard, ShippingCard } from "./CheckoutCards";
import { CheckoutStepper } from "./CheckoutStepper";
import styles from "@/features/cart/CommerceFlow.module.css";

export function CheckoutPage() { return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { href: "/cart", label: "Cart" }, { label: "Checkout" }]} /><div className={styles.pageHeader}><span className={styles.eyebrow}>Static checkout preview</span><h1>Review your order journey</h1><p className={styles.lede}>All fields and methods are presentation-only. Nothing is validated, calculated, transmitted or stored.</p></div><CheckoutStepper /></Stack></Container></Section><Section><Container><form className={styles.layout}><div className={styles.list}><AddressCard /><ShippingCard /><PaymentCard /><ExtrasCard /><section className={styles.card}><h2>Review and consent</h2><Checkbox required name="terms">I understand this is a static preview and no order will be placed.</Checkbox><button className={styles.controlButton} type="button">Place order preview</button><LinkButton href="/order-success" variant="secondary">Preview confirmation screen</LinkButton></section></div><OrderSummary action={false} /></form></Container></Section></>; }
