import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { MyPosts } from "@/components/app/MyPosts";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "My posts · PrepLens" };

export default function Page() {
  return (
    <PageShell eyebrow="Contributor hub" title="My posts" description="Track what you have shared and what you have saved for later." actions={<ButtonLink href="/submit"><Icon name="add" className="!text-lg" />Share new interview</ButtonLink>}>
      <MyPosts />
    </PageShell>
  );
}
