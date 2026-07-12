import Link from "next/link";
import { Breadcrumb } from "@/components/navigation";
import { Container, Section, Stack } from "@/components/layout";
import { commerceItems } from "@/features/cart";
import styles from "@/features/cart/CommerceFlow.module.css";

export function WishlistItem({ item }: { item: (typeof commerceItems)[number] }) { return <article className={styles.card}><div aria-label={`Reserved image for ${item.name}`} className={styles.media} role="img">SS</div><h2><Link href={`/product/${item.slug}`}>{item.name}</Link></h2><p>{item.detail}</p><p>{item.price}</p><div className={styles.buttonStack}><button className={styles.controlButton} type="button">Move to cart</button><button className={styles.controlButton} type="button">Remove from wishlist</button></div></article>; }
export function EmptyWishlist() { return <div className={styles.empty} role="status"><span aria-hidden="true" className={styles.emptyMark}>♡</span><h2>Your wishlist is empty</h2><p>Saved pieces will appear here when future persistence is approved.</p></div>; }
export function WishlistPage() { return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Wishlist" }]} /><div className={styles.pageHeader}><span className={styles.eyebrow}>Static saved-piece preview</span><h1>Pieces to revisit</h1><p className={styles.lede}>A responsive wishlist presentation without account data, storage or cart mutations.</p></div></Stack></Container></Section><Section><Container><div className={styles.grid}>{commerceItems.map((item) => <WishlistItem item={item} key={item.slug} />)}</div></Container></Section><Section><Container><EmptyWishlist /></Container></Section></>; }
