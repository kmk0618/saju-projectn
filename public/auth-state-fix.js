(function () {
  const SUPABASE_URL = "https://scmskjvhejnchhyufyfa.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__aKUm_yLUXA1cS18gFuumA_J9lArQcD";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("[AUTH UI] Supabase SDK not loaded");
    return;
  }

  const authUiSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  function displayName(user) {
    if (!user) return "회원";
    const m = user.user_metadata || {};
    return (
      m.name ||
      m.full_name ||
      m.user_name ||
      (user.email ? user.email.split("@")[0] : "회원")
    );
  }

  async function renderAuthButton() {
    const btn = document.getElementById("authBtn");
    if (!btn) return;

    try {
      const {
        data: { session },
        error,
      } = await authUiSupabase.auth.getSession();

      if (error) throw error;

      if (session && session.user) {
        btn.textContent = displayName(session.user) + " · 로그아웃";
        btn.title = "클릭하면 로그아웃합니다.";
        btn.dataset.authState = "logged-in";

        // 기존 코드와의 호환을 위해 표시용 localStorage만 동기화
        localStorage.setItem("saju_logged_in", "1");
        localStorage.setItem("saju_user_email", session.user.email || "");
        localStorage.setItem("saju_user_name", displayName(session.user));
      } else {
        btn.textContent = "로그인";
        btn.title = "로그인 / 회원가입";
        btn.dataset.authState = "logged-out";

        localStorage.removeItem("saju_logged_in");
        localStorage.removeItem("saju_user_email");
        localStorage.removeItem("saju_user_name");
      }
    } catch (e) {
      console.error("[AUTH UI] session check failed", e);
      btn.textContent = "로그인";
      btn.dataset.authState = "logged-out";
    }
  }

  // 기존 handleAuthButton을 실제 Supabase 세션 기반으로 완전히 덮어씀
  window.handleAuthButton = async function () {
    const btn = document.getElementById("authBtn");
    if (btn) btn.disabled = true;

    try {
      const {
        data: { session },
      } = await authUiSupabase.auth.getSession();

      if (session) {
        const { error } = await authUiSupabase.auth.signOut();
        if (error) throw error;

        localStorage.removeItem("saju_logged_in");
        localStorage.removeItem("saju_user_email");
        localStorage.removeItem("saju_user_name");

        await renderAuthButton();

        // 현재 페이지에 그대로 머물면서 로그인 상태만 즉시 갱신
        window.location.reload();
      } else {
        localStorage.setItem(
          "saju_auth_return_to",
          window.location.pathname + window.location.search + window.location.hash
        );
        window.location.href = "/login";
      }
    } catch (e) {
      console.error("[AUTH UI] auth button failed", e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "다시 시도";
      }
    }
  };

  // 기존 syncAuthButton도 실제 세션 기반으로 교체
  window.syncAuthButton = renderAuthButton;

  authUiSupabase.auth.onAuthStateChange(function () {
    // 로그인/로그아웃 이벤트가 발생하면 즉시 버튼 반영
    setTimeout(renderAuthButton, 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAuthButton);
  } else {
    renderAuthButton();
  }

  window.addEventListener("focus", renderAuthButton);
  window.addEventListener("pageshow", renderAuthButton);
})();
