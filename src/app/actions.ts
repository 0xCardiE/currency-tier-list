"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { twitterConfigured } from "@/lib/twitter";

export async function signInWithX() {
  if (!twitterConfigured()) redirect("/?auth=unavailable");
  await signIn("twitter", { redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
