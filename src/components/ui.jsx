import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";
import * as ReactJSX from "react/jsx-runtime";
import { useLayoutEffect, useState } from "react";
import { Slot as SlotPrimitiveSlot } from "@radix-ui/react-slot";
import { Root as DialogPrimitiveRoot } from "@radix-ui/react-dialog";
import { Portal as DialogPrimitivePortal } from "@radix-ui/react-dialog";
import { Overlay as DialogPrimitiveOverlay } from "@radix-ui/react-dialog";
import { Content as DialogPrimitiveContent } from "@radix-ui/react-dialog";
import { Close as DialogPrimitiveClose } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Title as DialogPrimitiveTitle } from "@radix-ui/react-dialog";
import { Description as DialogPrimitiveDescription } from "@radix-ui/react-dialog";
import { Root as TabsPrimitiveRoot } from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import { List as TabsPrimitiveList } from "@radix-ui/react-tabs";
import { Trigger as TabsPrimitiveTrigger } from "@radix-ui/react-tabs";
import { Content as TabsPrimitiveContent } from "@radix-ui/react-tabs";
import { Root as AlertDialogPrimitiveRoot } from "@radix-ui/react-alert-dialog";
import { Portal as AlertDialogPrimitivePortal } from "@radix-ui/react-alert-dialog";
import { Overlay as AlertDialogPrimitiveOverlay } from "@radix-ui/react-alert-dialog";
import { Content as AlertDialogPrimitiveContent } from "@radix-ui/react-alert-dialog";
import { Title as AlertDialogPrimitiveTitle } from "@radix-ui/react-alert-dialog";
import { Description as AlertDialogPrimitiveDescription } from "@radix-ui/react-alert-dialog";
import { Action as AlertDialogPrimitiveAction } from "@radix-ui/react-alert-dialog";
import { Cancel as AlertDialogPrimitiveCancel } from "@radix-ui/react-alert-dialog";
import { Root as SelectPrimitiveRoot } from "@radix-ui/react-select";
import { Value as SelectPrimitiveValue } from "@radix-ui/react-select";
import { Trigger as SelectPrimitiveTrigger } from "@radix-ui/react-select";
import { Icon as SelectPrimitiveIcon } from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { Portal as SelectPrimitivePortal } from "@radix-ui/react-select";
import { Content as SelectPrimitiveContent } from "@radix-ui/react-select";
import { Viewport as SelectPrimitiveViewport } from "@radix-ui/react-select";
import { Item as SelectPrimitiveItem } from "@radix-ui/react-select";
import { ItemIndicator as SelectPrimitiveItemIndicator } from "@radix-ui/react-select";
import { Check } from "lucide-react";
import { ItemText as SelectPrimitiveItemText } from "@radix-ui/react-select";
import { ScrollUpButton as SelectPrimitiveScrollUpButton } from "@radix-ui/react-select";
import { ChevronUp } from "lucide-react";
import { ScrollDownButton as SelectPrimitiveScrollDownButton } from "@radix-ui/react-select";
import { Root as CheckboxPrimitiveRoot } from "@radix-ui/react-checkbox";
import { Indicator as CheckboxPrimitiveIndicator } from "@radix-ui/react-checkbox";
import { Root as AccordionPrimitiveRoot } from "@radix-ui/react-accordion";
import { Item as AccordionPrimitiveItem } from "@radix-ui/react-accordion";
import { Header as AccordionPrimitiveHeader } from "@radix-ui/react-accordion";
import { Trigger as AccordionPrimitiveTrigger } from "@radix-ui/react-accordion";
import { Content as AccordionPrimitiveContent } from "@radix-ui/react-accordion";
import { Root as ProgressPrimitiveRoot } from "@radix-ui/react-progress";
import { Indicator as ProgressPrimitiveIndicator } from "@radix-ui/react-progress";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}
function Button({
  className: e,
  variant: t = `default`,
  size: n = `default`,
  asChild: r = !1,
  ...i
}) {
  return (0, ReactJSX.jsx)(r ? SlotPrimitiveSlot : `button`, {
    "data-slot": `button`,
    "data-variant": t,
    "data-size": n,
    className: cn(
      buttonVariants({
        variant: t,
        size: n,
        className: e,
      }),
    ),
    ...i,
  });
}
function Dialog({ ...e }) {
  return <DialogPrimitiveRoot data-slot={`dialog`} {...e} />;
}
function DialogPortal({ ...e }) {
  return <DialogPrimitivePortal data-slot={`dialog-portal`} {...e} />;
}
function DialogOverlay({ className: e, ...t }) {
  return (
    <DialogPrimitiveOverlay
      data-slot={`dialog-overlay`}
      className={cn(
        `fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0`,
        e,
      )}
      {...t}
    />
  );
}
function DialogContent({
  className: e,
  children: t,
  showCloseButton: n = !0,
  ...r
}) {
  return (
    <DialogPortal data-slot={`dialog-portal`}>
      <DialogOverlay />
      <DialogPrimitiveContent
        data-slot={`dialog-content`}
        className={cn(
          `fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg`,
          e,
        )}
        {...r}
      >
        {n && (
          <DialogPrimitiveClose
            data-slot={`dialog-close`}
            className={`dialog-close-button`}
          >
            <X />
            <span className={`sr-only`}>{`Close`}</span>
          </DialogPrimitiveClose>
        )}
        <div className={`dialog-scroll`} data-slot={`dialog-scroll`}>
          {t}
        </div>
      </DialogPrimitiveContent>
    </DialogPortal>
  );
}
function DialogHeader({ className: e, ...t }) {
  return (
    <div
      data-slot={`dialog-header`}
      className={cn(`flex flex-col gap-2 text-center sm:text-left`, e)}
      {...t}
    />
  );
}
function DialogTitle({ className: e, ...t }) {
  return (
    <DialogPrimitiveTitle
      data-slot={`dialog-title`}
      className={cn(`text-lg leading-none font-semibold`, e)}
      {...t}
    />
  );
}
function DialogDescription({ className: e, ...t }) {
  return (
    <DialogPrimitiveDescription
      data-slot={`dialog-description`}
      className={cn(`text-sm text-muted-foreground`, e)}
      {...t}
    />
  );
}
function Tabs({ className: e, orientation: t = `horizontal`, ...n }) {
  return (
    <TabsPrimitiveRoot
      data-slot={`tabs`}
      data-orientation={t}
      orientation={t}
      className={cn(
        `group/tabs flex gap-2 data-[orientation=horizontal]:flex-col`,
        e,
      )}
      {...n}
    />
  );
}
var tabsListVariants = cva(
  `group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none`,
  {
    variants: {
      variant: {
        default: `bg-muted`,
        line: `gap-1 bg-transparent`,
      },
    },
    defaultVariants: {
      variant: `default`,
    },
  },
);
function TabsList({ className: e, variant: t = `default`, ...n }) {
  return (
    <TabsPrimitiveList
      data-slot={`tabs-list`}
      data-variant={t}
      className={cn(
        tabsListVariants({
          variant: t,
        }),
        e,
      )}
      {...n}
    />
  );
}
function TabsTrigger({ className: e, ...t }) {
  return (
    <TabsPrimitiveTrigger
      data-slot={`tabs-trigger`}
      className={cn(
        `relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        `group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent`,
        `data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground`,
        `after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100`,
        e,
      )}
      {...t}
    />
  );
}
function TabsContent({ className: e, ...t }) {
  return (
    <TabsPrimitiveContent
      data-slot={`tabs-content`}
      className={cn(`flex-1 outline-none`, e)}
      {...t}
    />
  );
}
function AlertDialog({ ...e }) {
  return <AlertDialogPrimitiveRoot data-slot={`alert-dialog`} {...e} />;
}
function AlertDialogPortal({ ...e }) {
  return (
    <AlertDialogPrimitivePortal data-slot={`alert-dialog-portal`} {...e} />
  );
}
function AlertDialogOverlay({ className: e, ...t }) {
  return (
    <AlertDialogPrimitiveOverlay
      data-slot={`alert-dialog-overlay`}
      className={cn(
        `fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0`,
        e,
      )}
      {...t}
    />
  );
}
function AlertDialogContent({ className: e, size: t = `default`, ...n }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitiveContent
        data-slot={`alert-dialog-content`}
        data-size={t}
        className={cn(
          `group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg`,
          e,
        )}
        {...n}
      />
    </AlertDialogPortal>
  );
}
function AlertDialogHeader({ className: e, ...t }) {
  return (
    <div
      data-slot={`alert-dialog-header`}
      className={cn(
        `grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]`,
        e,
      )}
      {...t}
    />
  );
}
function AlertDialogFooter({ className: e, ...t }) {
  return (
    <div
      data-slot={`alert-dialog-footer`}
      className={cn(
        `flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end`,
        e,
      )}
      {...t}
    />
  );
}
function AlertDialogTitle({ className: e, ...t }) {
  return (
    <AlertDialogPrimitiveTitle
      data-slot={`alert-dialog-title`}
      className={cn(
        `text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2`,
        e,
      )}
      {...t}
    />
  );
}
function AlertDialogDescription({ className: e, ...t }) {
  return (
    <AlertDialogPrimitiveDescription
      data-slot={`alert-dialog-description`}
      className={cn(`text-sm text-muted-foreground`, e)}
      {...t}
    />
  );
}
function AlertDialogAction({
  className: e,
  variant: t = `default`,
  size: n = `default`,
  ...r
}) {
  return (
    <Button variant={t} size={n} asChild={!0}>
      <AlertDialogPrimitiveAction
        data-slot={`alert-dialog-action`}
        className={cn(e)}
        {...r}
      />
    </Button>
  );
}
function AlertDialogCancel({
  className: e,
  variant: t = `outline`,
  size: n = `default`,
  ...r
}) {
  return (
    <Button variant={t} size={n} asChild={!0}>
      <AlertDialogPrimitiveCancel
        data-slot={`alert-dialog-cancel`}
        className={cn(e)}
        {...r}
      />
    </Button>
  );
}
function Select({ ...e }) {
  return <SelectPrimitiveRoot data-slot={`select`} {...e} />;
}
function SelectValue({ ...e }) {
  return <SelectPrimitiveValue data-slot={`select-value`} {...e} />;
}
function SelectTrigger({
  className: e,
  size: t = `default`,
  children: n,
  ...r
}) {
  return (
    <SelectPrimitiveTrigger
      data-slot={`select-trigger`}
      data-size={t}
      className={cn(
        `flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground`,
        e,
      )}
      {...r}
    >
      {n}
      <SelectPrimitiveIcon asChild={!0}>
        <ChevronDown className={`size-4 opacity-50`} />
      </SelectPrimitiveIcon>
    </SelectPrimitiveTrigger>
  );
}
function SelectContent({
  className: e,
  children: t,
  position: n = `popper`,
  align: r = `start`,
  ...i
}) {
  const readCollisionPadding = () => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries([`top`, `right`, `bottom`, `left`].map(side => [
      side, 16 + Math.max(0, parseFloat(style.getPropertyValue(`--app-safe-area-${side}`)) || 0),
    ]));
  };
  const [collisionPadding, setCollisionPadding] = useState(readCollisionPadding);
  useLayoutEffect(() => {
    const update = () => setCollisionPadding(readCollisionPadding());
    update();
    window.addEventListener(`resize`, update);
    window.visualViewport?.addEventListener(`resize`, update);
    return () => {
      window.removeEventListener(`resize`, update);
      window.visualViewport?.removeEventListener(`resize`, update);
    };
  }, []);
  return (
    <SelectPrimitivePortal>
      <SelectPrimitiveContent
        data-slot={`select-content`}
        className={cn(
          `relative z-50 origin-(--radix-select-content-transform-origin) rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
          e,
        )}
        position={n}
        align={r}
        sideOffset={4}
        collisionPadding={collisionPadding}
        {...i}
      >
        <SelectScrollUpButton />
        <SelectPrimitiveViewport
          data-slot={`select-viewport`}
          className={`p-1`}
        >
          {t}
        </SelectPrimitiveViewport>
        <SelectScrollDownButton />
      </SelectPrimitiveContent>
    </SelectPrimitivePortal>
  );
}
function SelectItem({ className: e, children: t, ...n }) {
  return (
    <SelectPrimitiveItem
      data-slot={`select-item`}
      className={cn(
        `relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2`,
        e,
      )}
      {...n}
    >
      <span
        data-slot={`select-item-indicator`}
        className={`absolute right-2 flex size-3.5 items-center justify-center`}
      >
        <SelectPrimitiveItemIndicator>
          <Check className={`size-4`} />
        </SelectPrimitiveItemIndicator>
      </span>
      <SelectPrimitiveItemText>{t}</SelectPrimitiveItemText>
    </SelectPrimitiveItem>
  );
}
function SelectScrollUpButton({ className: e, ...t }) {
  return (
    <SelectPrimitiveScrollUpButton
      data-slot={`select-scroll-up-button`}
      className={cn(`flex cursor-default items-center justify-center py-1`, e)}
      {...t}
    >
      <ChevronUp className={`size-4`} />
    </SelectPrimitiveScrollUpButton>
  );
}
function SelectScrollDownButton({ className: e, ...t }) {
  return (
    <SelectPrimitiveScrollDownButton
      data-slot={`select-scroll-down-button`}
      className={cn(`flex cursor-default items-center justify-center py-1`, e)}
      {...t}
    >
      <ChevronDown className={`size-4`} />
    </SelectPrimitiveScrollDownButton>
  );
}
function Checkbox({ className: e, ...t }) {
  return (
    <CheckboxPrimitiveRoot
      data-slot={`checkbox`}
      className={cn(
        `peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary`,
        e,
      )}
      {...t}
    >
      <CheckboxPrimitiveIndicator
        data-slot={`checkbox-indicator`}
        className={`grid place-content-center text-current transition-none`}
      >
        <Check className={`size-3.5`} />
      </CheckboxPrimitiveIndicator>
    </CheckboxPrimitiveRoot>
  );
}
function Accordion({ ...e }) {
  return <AccordionPrimitiveRoot data-slot={`accordion`} {...e} />;
}
function AccordionItem({ className: e, ...t }) {
  return (
    <AccordionPrimitiveItem
      data-slot={`accordion-item`}
      className={cn(`border-b last:border-b-0`, e)}
      {...t}
    />
  );
}
function AccordionTrigger({ className: e, children: t, ...n }) {
  return (
    <AccordionPrimitiveHeader className={`flex`}>
      <AccordionPrimitiveTrigger
        data-slot={`accordion-trigger`}
        className={cn(
          `flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180`,
          e,
        )}
        {...n}
      >
        {t}
        <ChevronDown
          className={`pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200`}
        />
      </AccordionPrimitiveTrigger>
    </AccordionPrimitiveHeader>
  );
}
function AccordionContent({ className: e, children: t, ...n }) {
  return (
    <AccordionPrimitiveContent
      data-slot={`accordion-content`}
      className={`overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down`}
      {...n}
    >
      <div className={cn(`pt-0 pb-4`, e)}>{t}</div>
    </AccordionPrimitiveContent>
  );
}
function Progress({ className: e, value: t, ...n }) {
  return (
    <ProgressPrimitiveRoot
      data-slot={`progress`}
      value={t}
      className={cn(
        `relative h-2 w-full overflow-hidden rounded-full bg-primary/20`,
        e,
      )}
      {...n}
    >
      <ProgressPrimitiveIndicator
        data-slot={`progress-indicator`}
        className={`h-full w-full flex-1 bg-primary transition-all`}
        style={{
          transform: `translateX(-${100 - (t ?? 0)}%)`,
        }}
      />
    </ProgressPrimitiveRoot>
  );
}
function Skeleton({ className: e, ...t }) {
  return (
    <div
      data-slot={`skeleton`}
      className={cn(`animate-pulse rounded-md bg-accent`, e)}
      {...t}
    />
  );
}
function Table({ className: e, ...t }) {
  return (
    <div
      data-slot={`table-container`}
      className={`relative w-full overflow-x-auto`}
    >
      <table
        data-slot={`table`}
        className={cn(`w-full caption-bottom text-sm`, e)}
        {...t}
      />
    </div>
  );
}
function TableHeader({ className: e, ...t }) {
  return (
    <thead
      data-slot={`table-header`}
      className={cn(`[&_tr]:border-b`, e)}
      {...t}
    />
  );
}
function TableBody({ className: e, ...t }) {
  return (
    <tbody
      data-slot={`table-body`}
      className={cn(`[&_tr:last-child]:border-0`, e)}
      {...t}
    />
  );
}
function TableRow({ className: e, ...t }) {
  return (
    <tr
      data-slot={`table-row`}
      className={cn(
        `border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted`,
        e,
      )}
      {...t}
    />
  );
}
function TableHead({ className: e, ...t }) {
  return (
    <th
      data-slot={`table-head`}
      className={cn(
        `h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,
        e,
      )}
      {...t}
    />
  );
}
function TableCell({ className: e, ...t }) {
  return (
    <td
      data-slot={`table-cell`}
      className={cn(
        `p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,
        e,
      )}
      {...t}
    />
  );
}
var buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground hover:bg-primary/90`,
        destructive: `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40`,
        outline: `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50`,
        secondary: `bg-secondary text-secondary-foreground hover:bg-secondary/80`,
        ghost: `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50`,
        link: `text-primary underline-offset-4 hover:underline`,
      },
      size: {
        default: `h-9 px-4 py-2 has-[>svg]:px-3`,
        xs: `h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3`,
        sm: `h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5`,
        lg: `h-10 rounded-md px-6 has-[>svg]:px-4`,
        icon: `size-9`,
        "icon-xs": `size-6 rounded-md [&_svg:not([class*='size-'])]:size-3`,
        "icon-sm": `size-8`,
        "icon-lg": `size-10`,
      },
    },
    defaultVariants: {
      variant: `default`,
      size: `default`,
    },
  },
);

export {
  cn,
  Button,
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Tabs,
  tabsListVariants,
  TabsList,
  TabsTrigger,
  TabsContent,
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectScrollUpButton,
  SelectScrollDownButton,
  Checkbox,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Progress,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  buttonVariants,
};
