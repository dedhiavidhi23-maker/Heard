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

function showLoading() {
  document.getElementById("init-loading").style.display = "flex";
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "none";
}

function showAuth() {
  document.getElementById("init-loading").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

function showAppScreen() {
  document.getElementById("init-loading").style.display = "none";
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
}

// ── Boot: check session on page load ─────────────────────────────
// Timeout fallback in case Supabase is slow/paused
const bootTimeout = setTimeout(() => showAuth(), 5000);

(async () => {
  showLoading();
  try {
    const { data: { session } } = await sb.auth.getSession();
    clearTimeout(bootTimeout);
    if (session?.user) {
      currentUser = session.user;
      await loadProfile();
      showAppScreen();
    } else {
      showAuth();
    }
  } catch (e) {
    clearTimeout(bootTimeout);
    showAuth();
  }
})();

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
    await sb.from("profiles").upsert({
      user_id: data.user.id,
      username,
      email
    });
    currentUser = data.user;
    await loadProfile();
    showAppScreen();
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
  const { data: profileData } = await sb
    .from("profiles")
    .select("email")
    .eq("username", username)
    .single();

  if (!profileData?.email) {
    errorEl.textContent = "Username not found.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({
    email: profileData.email,
    password
  });

  if (error) {
    errorEl.textContent = "Incorrect password.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
    return;
  }

  currentUser = data.user;
  await loadProfile();
  showAppScreen();
  btn.textContent = "Log In";
  btn.disabled = false;
});

// ── Log Out ───────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showAuth();
});

// ── Load Profile ──────────────────────────────────────────────────
async function loadProfile() {
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  currentProfile = profile || null;

  const name = profile?.username || currentUser.email.split("@")[0];
  document.getElementById("user-name").textContent = name;

  const av = document.getElementById("user-avatar");
  if (profile?.avatar_url) {
    av.src = profile.avatar_url;
    av.style.display = "block";
  } else {
    av.style.display = "none";
  }

  updateProfileView();
}

// ── Profile View ──────────────────────────────────────────────────
function updateProfileView() {
  const p = currentProfile;
  const name = p?.username || currentUser?.email?.split("@")[0] || "";

  document.getElementById("profile-view-username").textContent = name;
  document.getElementById("profile-view-bio").textContent = p?.bio || "";
  document.getElementById("profile-view-genres").textContent = p?.genres || "";

  const viewAvatar = document.getElementById("profile-view-avatar");
  if (p?.avatar_url) {
    viewAvatar.src = p.avatar_url;
  } else {
    viewAvatar.src = "";
  }

  loadProfileStats();

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

  await sb.from("profiles").upsert({
    user_id: currentUser.id,
    username,
    bio,
    genres,
    avatar_url,
    email: currentProfile?.email || currentUser.email
  });

  currentProfile = { ...currentProfile, username, bio, genres, avatar_url };

  document.getElementById("user-name").textContent = username || currentUser.email.split("@")[0];

  const av = document.getElementById("user-avatar");
  if (avatar_url) {
    av.src = avatar_url;
    av.style.display = "block";
  }

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

// ── Search Suggestions ────────────────────────────────────────────
let searchTimer = null;
const searchInput = document.getElementById("search");
const suggestionsEl = document.getElementById("suggestions");

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (query.length < 3) {
    suggestionsEl.classList.remove("open");
    suggestionsEl.innerHTML = "";
    return;
  }

  searchTimer = setTimeout(async () => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const items = data.albums?.items || [];

    suggestionsEl.innerHTML = "";

    if (items.length === 0) {
      suggestionsEl.classList.remove("open");
      return;
    }

    items.slice(0, 8).forEach(album => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <img src="${album.images[0]?.url || ""}" alt="${album.name}" />
        <div>
          <div class="suggestion-name">${album.name}</div>
          <div class="suggestion-artist">${album.artists[0]?.name || ""}</div>
        </div>
      `;
      item.addEventListener("click", () => {
        suggestionsEl.classList.remove("open");
        searchInput.value = "";
        window.location.href = `album.html?id=${album.id}`;
      });
      suggestionsEl.appendChild(item);
    });

    suggestionsEl.classList.add("open");
  }, 400);
});

// Close suggestions when clicking outside
document.addEventListener("click", (e) => {
  if (!document.getElementById("search-wrap").contains(e.target)) {
    suggestionsEl.classList.remove("open");
  }
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
