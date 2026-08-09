import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { ProductDetailIntent } from "@/features/customer-intent";
import { ProductDiscoveryBoundary } from "@/features/discovery-simulation";
import { developmentProducts } from "./fixtures";
import { DevelopmentCatalogueIndicator } from "./DevelopmentIndicator";
import { SimulationProductGallery } from "./ProductGallery";
import { SimulationProductCard } from "./ProductCard";
import type { CatalogueProduct } from "./types";
import styles from "./Catalogue.module.css";

export function SimulationProductDetail({
  product,
  related,
  similar,
  showDevelopmentIndicator,
}: {
  product: CatalogueProduct;
  related: readonly CatalogueProduct[];
  similar: readonly CatalogueProduct[];
  showDevelopmentIndicator: boolean;
}) {
  return (
    <>
      <Section>
        <Container>
          <Stack gap="lg">
            <Breadcrumb
              items={[
                { href: "/", label: "Home" },
                { href: "/products", label: "Products" },
                { label: product.title },
              ]}
            />
            <DevelopmentCatalogueIndicator visible={showDevelopmentIndicator} />
            <div className={styles.detailGrid}>
              <SimulationProductGallery
                media={product.media}
                productId={product.id}
                productTitle={product.title}
              />
              <div className={styles.summary}>
                <p className={styles.availability}>
                  {product.availability.replaceAll("_", " ")}
                </p>
                <h1>{product.title}</h1>
                <p className={styles.subtitle}>{product.subtitle}</p>
                <p className={styles.description}>{product.description}</p>
                <p className={styles.price}>{product.price.label}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category.title}</dd>
                  </div>
                  <div>
                    <dt>Purity</dt>
                    <dd>{product.purity.replace("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>
                      {product.variants.map((item) => item.weight).join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>{product.availability.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
                <details className={styles.specifications} open>
                  <summary>Complete specifications</summary>
                  <dl>
                    <div>
                      <dt>Product reference</dt>
                      <dd>{product.slug}</dd>
                    </div>
                    <div>
                      <dt>Sizes</dt>
                      <dd>
                        {product.variants.map((item) => item.size).join(", ")}
                      </dd>
                    </div>
                    <div>
                      <dt>Audience</dt>
                      <dd>
                        {product.b2cVisible
                          ? "Retail presentation"
                          : "Trade only"}
                        {product.b2bVisible ? " · Wholesale enquiry" : ""}
                      </dd>
                    </div>
                  </dl>
                </details>
                <ProductDetailIntent product={product} />
                <div aria-hidden="true" className={styles.field} hidden>
                  <label htmlFor="product-size">Legacy size presentation</label>
                  <select
                    defaultValue={product.variants[0].id}
                    disabled
                    id="product-size"
                  >
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.size} · {variant.weight}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.filterActions}>
                  <Link className={styles.secondaryButton} href="/wishlist">
                    Wishlist preview
                  </Link>
                  {product.b2bVisible ? (
                    <Link className={styles.button} href="/wholesale">
                      Enquire for wholesale
                    </Link>
                  ) : null}
                  <Link className={styles.secondaryButton} href="/products">
                    View catalogue
                  </Link>
                </div>
                <p>
                  Cart and wishlist actions are simulated locally. No order,
                  reservation or payment action is available.
                </p>
              </div>
            </div>
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <div className={styles.wholesalePanel}>
            <div>
              <p className={styles.eyebrow}>Trade relationships</p>
              <h2>Considering this form for wholesale?</h2>
              <p>
                Approved partners can begin an enquiry without exposing
                wholesale price, stock, credit, or ERP information.
              </p>
            </div>
            <Link className={styles.button} href="/wholesale">
              Start a wholesale enquiry
            </Link>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <div className={styles.sectionGrid}>
            <article className={styles.infoCard}>
              <h2>Product highlights</h2>
              <ul className={styles.list}>
                {product.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
            <article className={styles.infoCard}>
              <h2>Care information</h2>
              <ul className={styles.list}>
                {product.care.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ul>
            </article>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <Stack gap="lg">
            <h2>Similar forms to explore</h2>
            {similar.length ? (
              <div className={styles.grid}>
                {similar.map((item) => (
                  <SimulationProductCard key={item.id} product={item} />
                ))}
              </div>
            ) : (
              <p>No additional simulated forms are available.</p>
            )}
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <Stack gap="lg">
            <h2>Related simulated products</h2>
            {related.length ? (
              <div className={styles.grid}>
                {related.map((item) => (
                  <SimulationProductCard key={item.id} product={item} />
                ))}
              </div>
            ) : (
              <p>No related development products are available.</p>
            )}
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <ProductDiscoveryBoundary
            enabled={showDevelopmentIndicator}
            product={product}
            products={developmentProducts}
          />
        </Container>
      </Section>
    </>
  );
}
