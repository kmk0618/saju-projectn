"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import styles from "./login.module.css";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function socialLogin(provider: "google" | "kakao") {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "간편 로그인 중 오류가 발생했습니다.");
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (data.session) {
          saveUser(data.session.user);
          router.replace("/");
        } else {
          setMessage("가입 확인 메일을 보냈습니다. 메일의 확인 버튼을 누르면 가입이 완료됩니다.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        saveUser(data.user);
        router.replace("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function saveUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
    if (!user) return;
    const name = String(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || "");
    if (user.email) localStorage.setItem("saju_user_email", user.email);
    if (name) localStorage.setItem("saju_user_name", name);
    localStorage.setItem("saju_logged_in", "1");
  }

  return (
    <main className={styles.page}>
      <button className={styles.back} onClick={() => router.push("/")}>← 나의사주로 돌아가기</button>
      <section className={styles.card}>
        <div className={styles.brand}>나의<span>사주</span></div>
        <p className={styles.kicker}>MY REPORT ACCOUNT</p>
        <h1>간편하게 시작하고<br />내 리포트를 계속 보관하세요.</h1>
        <p className={styles.desc}>한 번 로그인하면 내 사주, 가족 프로필, 구매한 리포트를 MY REPORT에서 이어서 볼 수 있습니다.</p>

        <div className={styles.socials}>
          <button className={styles.kakao} disabled={loading} onClick={() => socialLogin("kakao")}>
            <span className={styles.socialIcon}>K</span> 카카오로 계속하기
          </button>
          <button className={styles.google} disabled={loading} onClick={() => socialLogin("google")}>
            <span className={styles.socialIcon}>G</span> Google로 계속하기
          </button>
        </div>

        <div className={styles.divider}><span>또는 이메일</span></div>

        <div className={styles.tabs}>
          <button className={mode === "login" ? styles.activeTab : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>로그인</button>
          <button className={mode === "signup" ? styles.activeTab : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>회원가입</button>
        </div>

        <form onSubmit={submitEmail} className={styles.form}>
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          <button className={styles.submit} disabled={loading}>{loading ? "처리 중..." : mode === "login" ? "이메일로 로그인" : "이메일로 회원가입"}</button>
        </form>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.message}>{message}</div>}
        <p className={styles.terms}>로그인을 계속하면 서비스 이용약관 및 개인정보 처리방침에 동의한 것으로 봅니다.</p>
      </section>
    </main>
  );
}
