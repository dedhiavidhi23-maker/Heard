// ── Supabase ─────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(
  "https://jexqbnpxnikmdoiwnomf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleHFibnB4bmlrbWRvaXdub21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3ODEsImV4cCI6MjA4Nzk1Mzc4MX0.ThdnnZ4yUrOP025ygVEuJxZSIQVmgtcjGi7-hO5s3NM"
);

// ── State ─────────────────────────────────────────────────────────
let currentUser = null;
let currentProfile = null;
let saveThoughtsTimer = null;

// ── Helpers ───────────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === "password" ? "text" : "password";
  btn.textContent = input.type === "password" ? "Show" : "Hide";
}

// ── Auth Tabs ─────────────────────────────────────────────────────
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.auth;
    document.getElementById("login-form").classList.toggle("hidden", which !== "login");
    document.getElementById("signup-form").classList.toggle("hidden", which !== "signup");
  });
});

// ── Sign Up ───────────────────────────────────────────────────────
document.getElementById("signup-btn").addEventListener("click", async () => {
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const username = document.getElementById("signup-username").value.trim();
  const errorEl = document.getElementById("signup-error");

  errorEl.classList.remove("show");
  if (!email || !password || !username) {
    errorEl.textContent = "Please fill in all fields.";
    errorEl.classList.add("show");
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters.";
    errorEl.classList.add("show");
    return;
  }

  const btn = document.getElementById("signup-btn");
  btn.textContent = "Creating...";
  btn.disabled = true;

  const { data, error } = await sb.auth.signUp({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.add("show");
    btn.textContent = "Create Account";
    btn.disabled = false;
    return;
  }

  if (data.user) {
    await sb.from("profiles").upsert({ user_id: data.user.id, username, email });
    await onLoginSuccess(data.user);
  }

  btn.textContent = "Create Account";
  btn.disabled = false;
});

// ── Log In ────────────────────────────────────────────────────────
document.getElementById("login-btn").addEventListener("click", async () => {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");

  errorEl.classList.remove("show");
  if (!username || !password) {
    errorEl.textContent = "Please enter your username and password.";
    errorEl.classList.add("show");
    return;
  }

  const btn = document.getElementById("login-btn");
  btn.textContent = "Logging in...";
  btn.disabled = true;

  // Look up email from username
  const { data: profile } = await sb
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();

  if (!profile) {
    errorEl.textContent = "Username not found.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
    return;
  }

  // Get email for this user_id from auth
  // We store email during signup in a way we can retrieve it
  // Simplest: try signing in won't work without email — so we store email in profiles too
  const { data: profileWithEmail } = await sb
    .from("profiles")
    .select("email")
    .eq("username", username)
    .single();

  if (!profileWithEmail?.email) {
    errorEl.textContent = "Could not find account. Try logging in with email.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email: profileWithEmail.email, password });

  if (error) {
    errorEl.textContent = "Incorrect password.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
  } else {
    await onLoginSuccess(data.user);
  }
});

// ── Session Handling ──────────────────────────────────────────────
let authInitialized = false;

// ── Log Out ───────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  authInitialized = true; // prevent re-login after signOut
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("init-loading").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
});

sb.auth.onAuthStateChange(async (_event, session) => {
  if (authInitialized) return;
  authInitialized = true;
  document.getElementById("init-loading").style.display = "none";

  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
  } else {
    document.getElementById("auth-screen").style.display = "flex";
  }
});

// Fallback: if onAuthStateChange never fires within 3s, show login screen
setTimeout(() => {
  if (!authInitialized) {
    authInitialized = true;
    document.getElementById("init-loading").style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";
  }
}, 3000);

// After login form succeeds, manually show app
async function onLoginSuccess(user) {
  authInitialized = true;
  currentUser = user;
  await loadProfile();
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
}

// ── Load Profile ──────────────────────────────────────────────────
async function loadProfile() {
  const { data: profile } = await sb
    .from("profiles").select("*")
    .eq("user_id", currentUser.id).single();

  currentProfile = profile || null;

  // Only now show the app with the correct name
  const name = profile?.username || currentUser.email.split("@")[0];
  document.getElementById("user-name").textContent = name;

  if (profile?.avatar_url) {
    const av = document.getElementById("user-avatar");
    av.src = profile.avatar_url;
    av.style.display = "block";
  } else {
    document.getElementById("user-avatar").style.display = "none";
  }

  updateProfileView();
}

// ── Profile View Mode ─────────────────────────────────────────────
function updateProfileView() {
  const p = currentProfile;
  const name = p?.username || currentUser.email.split("@")[0];

  document.getElementById("profile-view-username").textContent = name;
  document.getElementById("profile-view-bio").textContent = p?.bio || "";
  document.getElementById("profile-view-genres").textContent = p?.genres || "";

  const viewAvatar = document.getElementById("profile-view-avatar");
  if (p?.avatar_url) {
    viewAvatar.src = p.avatar_url;
  } else {
    viewAvatar.src = "";
    viewAvatar.style.background = "var(--surface)";
  }

  // Load stats
  loadProfileStats();

  // Pre-fill edit form
  if (p) {
    document.getElementById("profile-username").value = p.username || "";
    document.getElementById("profile-bio").value = p.bio || "";
    document.getElementById("profile-genres").value = p.genres || "";
    document.getElementById("profile-avatar-url").value = p.avatar_url || "";
    if (p.avatar_url) document.getElementById("profile-avatar-preview").src = p.avatar_url;
  }
}

async function loadProfileStats() {
  const { data: albums } = await sb
    .from("albums").select("id").eq("user_id", currentUser.id);
  const { data: reviews } = await sb
    .from("tracks").select("id").eq("user_id", currentUser.id).neq("review", "");

  document.getElementById("stat-albums").textContent = albums?.length || 0;
  document.getElementById("stat-reviews").textContent = reviews?.length || 0;
}

function showEditProfile() {
  document.getElementById("profile-view").style.display = "none";
  document.getElementById("profile-edit").style.display = "block";
}

function showViewProfile() {
  document.getElementById("profile-edit").style.display = "none";
  document.getElementById("profile-view").style.display = "block";
}

// Avatar preview in edit mode
document.getElementById("profile-avatar-url").addEventListener("input", (e) => {
  const url = e.target.value.trim();
  if (url) document.getElementById("profile-avatar-preview").src = url;
});

// ── Save Profile ──────────────────────────────────────────────────
async function saveProfile() {
  if (!currentUser) return;

  const username = document.getElementById("profile-username").value.trim();
  const bio = document.getElementById("profile-bio").value.trim();
  const genres = document.getElementById("profile-genres").value.trim();
  const avatar_url = document.getElementById("profile-avatar-url").value.trim();

  await sb.from("profiles").upsert({ user_id: currentUser.id, username, bio, genres, avatar_url });

  currentProfile = { user_id: currentUser.id, username, bio, genres, avatar_url };

  // Update header
  document.getElementById("user-name").textContent = username || currentUser.email.split("@")[0];
  if (avatar_url) {
    const av = document.getElementById("user-avatar");
    av.src = avatar_url;
    av.style.display = "block";
  }

  // Show saved badge then switch back to view
  const badge = document.getElementById("profile-saved");
  badge.classList.add("show");
  setTimeout(() => {
    badge.classList.remove("show");
    updateProfileView();
    showViewProfile();
  }, 1200);
}

// ── Tabs ──────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "-panel").classList.add("active");
    if (tab.dataset.tab === "library") loadLibrary();
    if (tab.dataset.tab === "profile") updateProfileView();
  });
});

// ── Search ────────────────────────────────────────────────────────
document.getElementById("search").addEventListener("keypress", async (e) => {
  if (e.key !== "Enter") return;
  const query = e.target.value.trim();
  if (!query) return;

  const loading = document.getElementById("loading");
  loading.style.display = "block";
  document.getElementById("results").innerHTML = "";

  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  loading.style.display = "none";

  const resultsDiv = document.getElementById("results");
  (data.albums?.items || []).forEach(album => {
    const card = document.createElement("div");
    card.className = "album-card";
    card.innerHTML = `
      <img src="${album.images[0]?.url || ""}" alt="${album.name}" />
      <div class="album-name">${album.name}</div>
      <div class="album-artist">${album.artists[0]?.name || ""}</div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `album.html?id=${album.id}`;
    });
    resultsDiv.appendChild(card);
  });
});

// ── Library ───────────────────────────────────────────────────────
async function loadLibrary() {
  const container = document.getElementById("library-content");
  container.innerHTML = "<p style='color:#555;font-size:13px;letter-spacing:1px'>Loading...</p>";

  const { data: albums } = await sb
    .from("albums").select("*")
    .eq("user_id", currentUser.id).order("name");

  if (!albums || albums.length === 0) {
    container.innerHTML = "<p style='color:#555;font-size:14px;letter-spacing:1px'>No albums saved yet. Rate or review an album to add it here.</p>";
    return;
  }

  container.innerHTML = "";

  albums.forEach(album => {
    const card = document.createElement("div");
    card.className = "library-card";

    const starsHtml = Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < (album.rating || 0) ? "filled" : ""}">★</span>`
    ).join("");

    card.innerHTML = `
      <img src="${album.cover}" alt="${album.name}" />
      <div style="flex:1">
        <div class="library-name">${album.name}</div>
        <div class="library-artist">${album.artist}</div>
        <div>${starsHtml}</div>
        ${album.thoughts ? `<div class="library-thoughts">"${album.thoughts}"</div>` : ""}
        ${album.release_date ? `<div style="font-size:11px;color:#444;margin-top:6px">${album.release_date}${album.genres ? " · " + album.genres : ""}</div>` : ""}
      </div>
      <button class="delete-btn" title="Remove">✕</button>
    `;

    card.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove "${album.name}" from your library?`)) return;
      await sb.from("tracks").delete().eq("album_id", album.id).eq("user_id", currentUser.id);
      await sb.from("albums").delete().eq("id", album.id).eq("user_id", currentUser.id);
      card.remove();
      if (!document.querySelector(".library-card")) {
        container.innerHTML = "<p style='color:#555;font-size:14px;letter-spacing:1px'>No albums saved yet.</p>";
      }
    });

    card.addEventListener("click", () => {
      window.location.href = `album.html?id=${album.id}`;
    });

    container.appendChild(card);
  });
}
