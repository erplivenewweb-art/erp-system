"use client";
import { useState } from "react";
import { Drawer } from "@/components/overlays";
import { LinkButton } from "@/components/ui";
import { commerceItems } from "./data";
import styles from "./CommerceFlow.module.css";

export function MiniCart() { const [open, setOpen] = useState(false); return <><button className={styles.controlButton} onClick={() => setOpen(true)} type="button">Preview mini cart</button><Drawer description="Static cart preview with no saved state." onClose={() => setOpen(false)} open={open} title="Your bag"><div className={styles.drawerList}>{commerceItems.map((item) => <article className={styles.drawerItem} key={item.slug}><h3>{item.name}</h3><p>{item.price}</p></article>)}</div><p>Subtotal: Pending cart calculation</p><div className={styles.buttonStack}><LinkButton href="/checkout">Checkout preview</LinkButton><LinkButton href="/cart" variant="secondary">View full cart</LinkButton></div></Drawer></>; }
export function EmptyMiniCart() { const [open, setOpen] = useState(false); return <><button className={styles.controlButton} onClick={() => setOpen(true)} type="button">Preview empty mini cart</button><Drawer onClose={() => setOpen(false)} open={open} title="Your bag is empty"><p>Add a published retail piece to begin. Nothing is persisted in this preview.</p><LinkButton href="/shop">Explore catalogue</LinkButton></Drawer></>; }
