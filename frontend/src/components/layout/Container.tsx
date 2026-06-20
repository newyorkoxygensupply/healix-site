import type { ElementType, ReactNode } from "react";

export default function Container({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`container-editorial ${className}`}>{children}</Tag>;
}
