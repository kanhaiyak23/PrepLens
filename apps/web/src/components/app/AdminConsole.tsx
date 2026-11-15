"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { AdminQueue } from "./AdminQueue";
import { AdminUpdates } from "./AdminUpdates";
import { AdminReports } from "./AdminReports";
import { AdminCompanies } from "./AdminCompanies";
import { AdminPostForm } from "./AdminPostForm";

/**
 * Open/Closed: a new admin tool is one entry in PANELS. Each panel owns its own data and rules (Single Responsibility);
 * this component only picks which one to show. Access is enforced by the API and each panel; this is layout, not security.
 * Design source: Stitch "Admin Moderation": five tabs (Waiting for review, Edits waiting, Reports, New companies, Post on behalf of student).
 * Dropped: the right-hand side column (the same tools are tabs here, one at a time, which is simpler on a phone) and the
 * "automated privacy check" row, which has no backing check.
 */
const PANELS = {
  review: { label: "Waiting for review", View: AdminQueue },
  edits: { label: "Edits waiting", View: AdminUpdates },
  reports: { label: "Reports", View: AdminReports },
  companies: { label: "New companies", View: AdminCompanies },
  proxy: { label: "Post on behalf of student", View: AdminPostForm },
} as const;
type Key = keyof typeof PANELS;

export function AdminConsole() {
  const [tab, setTab] = useState<Key>("review");
  const { View } = PANELS[tab];
  return (
    <div className="space-y-6">
      <Tabs label="Admin tools" active={tab} onChange={setTab} items={(Object.keys(PANELS) as Key[]).map((k) => ({ key: k, label: PANELS[k].label }))} />
      <View />
    </div>
  );
}
