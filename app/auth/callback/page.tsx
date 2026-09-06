"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [text, setText] = useState("로그인 정보를 확인하고 있습니다...");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let finished = false;

    const complete = async () => {
      if (finished) return;
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setText("로그인 정보를 확인하지 못했습니다. 로그인 화면으로 돌아갑니다.");
        setTimeout(() => router.replace("/login"), 1200);
        return;
      }
      const user = data.session?.user;
      if (!user) return;
      finished = true;
      const meta = user.user_metadata || {};
      const name = String(meta.full_name || meta.name || meta.user_name || "");
      if (user.email) localStorage.setItem("saju_user_email", user.email);
      if (name) localStorage.setItem("saju_user_name", name);
      localStorage.setItem("saju_logged_in", "1");
      router.replace("/?login=success");
    };

    complete();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session || finished) return;
      const user = session.user;
      const meta = user.user_metadata || {};
      const name = String(meta.full_name || meta.name || meta.user_name || "");
      if (user.email) localStorage.setItem("saju_user_email", user.email);
      if (name) localStorage.setItem("saju_user_name", name);
      localStorage.setItem("saju_logged_in", "1");
      finished = true;
      router.replace("/?login=success");
    });

    const timeout = setTimeout(() => {
      if (!finished) {
        setText("로그인이 완료되지 않았습니다. 다시 시도해 주세요.");
        setTimeout(() => router.replace("/login"), 1200);
      }
    }, 7000);

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#fffdf7",fontFamily:"sans-serif"}}><div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:900,marginBottom:12}}>나의<span style={{color:"#a57b00"}}>사주</span></div><p style={{color:"#746f62"}}>{text}</p></div></main>;
}
