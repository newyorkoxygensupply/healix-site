"use client";

import { useId, useState } from "react";

export interface InquiryProductContext {
  product_id?: string;
  product_name?: string;
  brand?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

/**
 * The B2B "checkout" for this site: there's no cart, so a bulk-pricing
 * inquiry is the conversion event. Posts straight to /api/inquiry, which
 * next.config.ts rewrites same-origin to the Flask API — no CORS handling
 * needed client-side.
 */
export default function InquiryForm({
  product,
  onSuccess,
}: {
  product?: InquiryProductContext;
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      customer_name: String(form.get("customer_name") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      message: String(form.get("message") || ""),
      product_id: product?.product_id || "",
      product_name: product?.product_name || "",
      brand: product?.brand || "",
    };

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="rounded-[var(--radius-md)] bg-success-soft px-5 py-6 text-center">
        <p className="text-h3 text-ink">Request received</p>
        <p className="mt-2 text-small text-ink-soft">
          A procurement specialist will follow up with facility pricing
          shortly. For anything urgent, call{" "}
          <a href="tel:8885856510" className="font-semibold text-accent">
            (888) 585-6510
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {product?.product_name && (
        <p className="text-small text-ink-soft">
          Inquiring about:{" "}
          <span className="font-semibold text-ink">{product.product_name}</span>
        </p>
      )}

      <Field id={`${formId}-name`} name="customer_name" label="Full name" required autoComplete="name" />
      <Field id={`${formId}-phone`} name="phone" label="Phone" type="tel" required autoComplete="tel" />
      <Field id={`${formId}-email`} name="email" label="Work email" type="email" required autoComplete="email" />

      <div>
        <label htmlFor={`${formId}-message`} className="text-small font-medium text-ink">
          Order details <span className="text-ink-faint">(quantity, ship-to, timeline)</span>
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={4}
          className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3.5 py-2.5 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-accent"
          placeholder="e.g. 200 cases/month, ship to our Newark facility, need pricing by Friday"
        />
      </div>

      {status === "error" && errorMsg && (
        <p role="alert" className="text-small font-medium text-danger">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full bg-accent px-6 py-3 text-small font-semibold text-accent-contrast hover:bg-accent-hover disabled:opacity-60 transition-colors duration-150"
      >
        {status === "submitting" ? "Sending…" : "Request bulk pricing"}
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  required,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label} {required && <span aria-hidden="true" className="text-danger">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3.5 py-2.5 text-body text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}
