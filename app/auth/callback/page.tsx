"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("간편 로그인을 완료하고 있습니다.");

  useEffect(() => {
    let cancelled = false;

    async function finishLogin() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error("Supabase 공개 환경변수가 없습니다.");
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });

        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");

        // 1) 현재 사이트가 받고 있는 implicit/hash 방식
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
        }
        // 2) 향후 PKCE/code 방식으로 바뀌어도 그대로 동작
        else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // 3) SDK가 이미 URL을 처리한 경우
        else {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) throw error;
          if (!session) {
            throw new Error("로그인 세션 정보를 찾지 못했습니다.");
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) throw new Error("로그인 세션 저장에 실패했습니다.");

        // 주소창에서 access_token / refresh_token 즉시 제거
        window.history.replaceState({}, document.title, "/auth/callback");

        if (!cancelled) setMessage("로그인이 완료되었습니다. 이동합니다.");

        // 로그인 버튼을 눌렀던 페이지가 저장되어 있으면 복귀, 없으면 메인
        const returnTo = localStorage.getItem("saju_auth_return_to") || "/";
        localStorage.removeItem("saju_auth_return_to");

        window.location.replace(returnTo);
      } catch (e: any) {
        console.error("[AUTH CALLBACK ERROR]", e);
        if (!cancelled) {
          setMessage(
            `로그인이 완료되지 않았습니다.\n${e?.message || "다시 시도해주세요."}`
          );
        }

        // 실패하더라도 토큰을 주소창에 남기지 않음
        window.history.replaceState({}, document.title, "/auth/callback");
      }
    }

    finishLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8f7f3",
        fontFamily: 'Pretendard, "Noto Sans KR", sans-serif',
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          padding: 32,
          background: "#fff",
          border: "1px solid #e8e3d9",
          borderRadius: 22,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: ".08em",
            color: "#b18719",
            marginBottom: 14,
          }}
        >
          나의사주
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>간편 로그인</h1>
        <p style={{ margin: 0, lineHeight: 1.8, whiteSpace: "pre-line", color: "#666" }}>
          {message}
        </p>
      </div>
    </main>
  );
}
