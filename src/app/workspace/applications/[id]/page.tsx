import { ApplicationDetail } from "@/components/application-detail";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <ApplicationDetail initialId={id} />
    </main>
  );
}

