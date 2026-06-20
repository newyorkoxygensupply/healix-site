"use client";

import { useState } from "react";
import Modal from "./Modal";
import InquiryForm, { type InquiryProductContext } from "./InquiryForm";

/** The PDP's primary CTA, replacing "Add to Cart" for this B2B/no-checkout
 *  model — opens the same inquiry flow used standalone on /contact. */
export default function BulkPricingButton({
  product,
  className,
}: {
  product?: InquiryProductContext;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "w-full rounded-full bg-accent px-6 py-3.5 text-small font-semibold text-accent-contrast hover:bg-accent-hover transition-colors duration-150"
        }
      >
        Get bulk pricing
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request bulk pricing">
        <InquiryForm product={product} />
      </Modal>
    </>
  );
}
