import { CreateOrganization } from "@clerk/nextjs";

export default function CreateOrgPage() {
  return (
    <main className="container py-6">
      <div className="h2 mb-4">Create Organization</div>
      <CreateOrganization />
    </main>
  );
}
