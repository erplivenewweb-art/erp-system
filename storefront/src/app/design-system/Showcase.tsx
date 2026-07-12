"use client";

import { useState } from "react";
import { ProductCardShell, QuantitySelector, ReviewCardShell, WishlistButton } from "@/components/commerce";
import { AvailabilityIndicator, AvatarPlaceholder, Badge, Card, PriceBlock, Rating, StatusChip } from "@/components/display";
import { Alert, EmptyState, ErrorState, InlineMessage, LoadingState, Skeleton, Spinner } from "@/components/feedback";
import { Checkbox, Field, HelpText, Input, Label, Radio, Select, Switch, Textarea, ValidationMessage } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Container, Divider, Grid, Inline, Section, Stack, Surface } from "@/components/layout";
import { Accordion, Breadcrumb, Tabs } from "@/components/navigation";
import { Drawer, Modal, Toast } from "@/components/overlays";
import { Typography } from "@/components/typography";
import { Button, IconButton, LinkButton } from "@/components/ui";
import styles from "./showcase.module.css";

export function Showcase() {
  const [dark, setDark] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState(true);

  return (
    <div className={styles.preview} data-theme={dark ? "dark" : "light"}>
      <Container>
        <Section>
          <Stack gap="lg">
            <Breadcrumb items={[{ href: "/", label: "Scaffold" }, { label: "Design system" }]} />
            <Inline>
              <Badge tone="accent">Development only</Badge>
              <Switch checked={dark} onChange={(event) => setDark(event.target.checked)}>Dark readiness preview</Switch>
            </Inline>
            <Typography variant="overline">Phase 3B foundation</Typography>
            <Typography as="h1" measure variant="display">Quiet craft. Clear interaction.</Typography>
            <Typography measure variant="lead">Synthetic components, tokens, states, and accessibility patterns. No API calls or commerce behavior.</Typography>
          </Stack>
        </Section>

        <ShowcaseSection title="Semantic color tokens">
          <div className={styles.swatches}>{["ink","ivory","silver","vermilion","success","warning","danger","info"].map((name) => <div className={styles.swatch} data-swatch={name} key={name}><span aria-hidden="true" /><Typography variant="caption">{name}</Typography></div>)}</div>
        </ShowcaseSection>

        <ShowcaseSection title="Typography scale">
          <Stack><Typography as="p" variant="display">Display</Typography><Typography as="p" variant="h1">Heading one</Typography><Typography as="p" variant="h2">Heading two</Typography><Typography as="p" variant="h3">Heading three</Typography><Typography variant="lead">Lead text explains a section with room to breathe.</Typography><Typography measure>Body copy keeps a readable measure and accessible rhythm for longer product and craft descriptions.</Typography><Typography variant="small">Body small</Typography><Typography variant="caption">Caption</Typography><Typography variant="overline">Overline label</Typography><Typography variant="price">₹0.00</Typography><Typography variant="muted">Muted supporting text</Typography></Stack>
        </ShowcaseSection>

        <ShowcaseSection title="Spacing, radius, elevation">
          <Grid columns="three"><Surface><div className={styles.spacingSample}>Token spacing</div></Surface><Card>Raised card surface</Card><Surface tone="subtle">Subtle panel surface</Surface></Grid>
        </ShowcaseSection>

        <ShowcaseSection title="Actions and states">
          <Inline><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="tertiary">Tertiary</Button><Button variant="danger">Danger</Button><Button disabled>Disabled</Button><Button loading>Loading</Button><LinkButton href="/">Link button</LinkButton><IconButton label="Synthetic favorite"><Icon name="heart" /></IconButton></Inline>
        </ShowcaseSection>

        <ShowcaseSection title="Form primitives">
          <Grid columns="two">
            <Field><Label htmlFor="sample-name">Display name</Label><Input aria-describedby="sample-name-help" id="sample-name" placeholder="Synthetic value" /><HelpText id="sample-name-help">No data leaves this page.</HelpText></Field>
            <Field><Label htmlFor="sample-error">Reference</Label><Input aria-describedby="sample-error-message" id="sample-error" invalid defaultValue="Invalid example" /><ValidationMessage id="sample-error-message">Use an approved placeholder format.</ValidationMessage></Field>
            <Field><Label htmlFor="sample-select">Preference</Label><Select id="sample-select"><option>Option one</option><option>Option two</option></Select></Field>
            <Field><Label htmlFor="sample-notes">Notes</Label><Textarea id="sample-notes" placeholder="Synthetic notes" /></Field>
          </Grid>
          <Inline><Checkbox>Checkbox choice</Checkbox><Radio name="sample-radio">Radio one</Radio><Radio name="sample-radio">Radio two</Radio><Switch>Switch control</Switch></Inline>
        </ShowcaseSection>

        <ShowcaseSection title="Display and status">
          <Inline><Badge>Neutral badge</Badge><Badge tone="accent">Accent badge</Badge><StatusChip status="success">Ready</StatusChip><StatusChip status="warning">Aging</StatusChip><StatusChip status="danger">Unavailable</StatusChip><AvailabilityIndicator label="Synthetic availability" status="info" /><AvatarPlaceholder label="Sample Person" /><Rating count={12} value={4.8} /><PriceBlock amount="0.00" note="Synthetic value only" /></Inline>
        </ShowcaseSection>

        <ShowcaseSection title="Feedback">
          <Stack><Alert title="Information">This is an informational component.</Alert><Alert title="Success" tone="success">The synthetic action completed.</Alert><InlineMessage tone="warning">A safe warning message.</InlineMessage><Inline><Spinner /><Typography variant="small">Loading</Typography></Inline><Skeleton /><Grid columns="three"><LoadingState /><EmptyState actionHref="/" actionLabel="Return to scaffold" description="No synthetic items are present." title="Nothing here yet" /><ErrorState description="The placeholder feature could not load." onRetry={() => undefined} title="Unable to load" /></Grid></Stack>
        </ShowcaseSection>

        <ShowcaseSection title="Navigation">
          <Tabs label="Component examples" items={[{ id: "first", label: "First tab", panel: <p>First accessible tab panel.</p> }, { id: "second", label: "Second tab", panel: <p>Second accessible tab panel.</p> }]} />
          <Accordion items={[{ id: "one", title: "What is this route?", content: <p>A noindex development showcase using synthetic data.</p> }, { id: "two", title: "Does it call an API?", content: <p>No. It has no API or ERP dependency.</p> }]} />
        </ShowcaseSection>

        <ShowcaseSection title="Overlays">
          <Inline><Button onClick={() => setModal(true)}>Open modal</Button><Button onClick={() => setDrawer(true)} variant="secondary">Open drawer</Button></Inline>
          <Modal description="Keyboard focus moves into this native dialog and returns to its trigger." onClose={() => setModal(false)} open={modal} title="Modal foundation"><Button onClick={() => setModal(false)}>Complete synthetic action</Button></Modal>
          <Drawer description="A narrow responsive overlay foundation." onClose={() => setDrawer(false)} open={drawer} title="Drawer foundation"><Stack><p>Drawer content stays isolated.</p><Button onClick={() => setDrawer(false)}>Close drawer</Button></Stack></Drawer>
          {toast ? <Toast onDismiss={() => setToast(false)} tone="success">Synthetic notification delivered.</Toast> : <Button onClick={() => setToast(true)} variant="tertiary">Restore toast</Button>}
        </ShowcaseSection>

        <ShowcaseSection title="Commerce shells">
          <Grid columns="three"><ProductCardShell name="Synthetic Silver Form" /><ReviewCardShell /><Card><Stack><Typography variant="h4">Quantity and wishlist</Typography><QuantitySelector max={10} /><WishlistButton /></Stack></Card></Grid>
        </ShowcaseSection>
      </Container>
    </div>
  );
}

function ShowcaseSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <Section><Stack gap="lg"><div><Typography variant="overline">Component group</Typography><Typography variant="h2">{title}</Typography></div><Divider />{children}</Stack></Section>;
}
