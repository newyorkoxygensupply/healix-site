import Container from "@/components/layout/Container";

export default function Loading() {
  return (
    <Container className="py-12">
      <div className="skeleton h-10 w-2/3 max-w-md" />
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="skeleton aspect-square w-full" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
