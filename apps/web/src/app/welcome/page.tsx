import { redirect } from "next/navigation";

/** The profile page used to live here. Old links and bookmarks keep working. */
export default function Welcome() {
  redirect("/profile");
}
