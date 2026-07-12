import { Breadcrumb } from "@/components/navigation";
import { Container, Section, Stack } from "@/components/layout";
import { CartItem } from "./CartItem";
import { MiniCart, EmptyMiniCart } from "./MiniCart";
import { OrderSummary } from "./OrderSummary";
import { commerceItems } from "./data";
import styles from "./CommerceFlow.module.css";

export function CartPage() { return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Cart" }]} /><div className={styles.pageHeader}><span className={styles.eyebrow}>Static bag preview</span><h1>Your considered selection</h1><p className={styles.lede}>Review synthetic presentation items. Quantity, removal and saving controls do not change stored data.</p></div><div className={styles.actions}><MiniCart /><EmptyMiniCart /></div></Stack></Container></Section><Section><Container><div className={styles.layout}><div className={styles.list}>{commerceItems.map((item) => <CartItem item={item} key={item.slug} />)}</div><OrderSummary /></div></Container></Section></>; }
export function EmptyCart() { return <div className={styles.empty} role="status"><span aria-hidden="true" className={styles.emptyMark}>Bag</span><h2>Your cart is empty</h2><p>No items are stored in this static preview.</p></div>; }
