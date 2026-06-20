import Image from "next/image";
import Link from "next/link";
import { getProductGalleryUrls } from "@/lib/images";
import type { ProductSummary } from "@/lib/types";

export default function ProductCard({ product }: { product: ProductSummary }) {
  const [image] = getProductGalleryUrls(product.category, product.product_id, product.subcategory, 1);
  return (
    <Link href={product.url} className="surface-card group block overflow-hidden">
      <div className="relative aspect-square w-full overflow-hidden bg-mist">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-105"
        />
      </div>
      <div className="p-3.5">
        <p className="text-small font-semibold text-ink line-clamp-2">{product.product_name}</p>
        {product.brand && <p className="text-caption text-ink-faint mt-0.5">{product.brand}</p>}
        {product.price_each && <p className="text-small font-semibold text-ink mt-1.5">{product.price_each}</p>}
      </div>
    </Link>
  );
}
