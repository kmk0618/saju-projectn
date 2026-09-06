"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        await getSupabaseBrowserClient().auth.signOut();
      } finally {
        localStorage.removeItem("saju_user_email");
        localStorage.removeItem("saju_user_name");
        localStorage.removeItem("saju_logged_in");
        router.replace("/");
      }
    })();
  }, [router]);
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"sans-serif"}}>로그아웃 중...</main>;
}
