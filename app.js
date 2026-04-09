// ── Supabase setup ──────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(
  "https://jexqbnpxnikmdoiwnomf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleHFibnB4bmlrbWRvaXdub21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3ODEsImV4cCI6MjA4Nzk1Mzc4MX0.ThdnnZ4yUrOP025ygVEuJxZSIQVmgtcjGi7-hO5s3NM"
);

// ── State ────────────────────────────────────────────────────────
let currentUser = null;
let currentAlbum = null;
let saveThoughtsTimer = null;

// ── Toggle Password Visibility ───────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "Show";
  }
}

// ── Auth Tabs ────────────────────────────────────────────────────
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.auth;
    document.getElementById("login-form").classList.toggle("hidden", which !== "login");
    document.getElementById("signup-form").classList.toggle("hidden", which !== "signup");
  });
});

// ── Sign Up ──────────────────────────────────────────────────────
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

  // Save username immediately using the user id
  if (data.user) {
    await sb.from("profiles").upsert({
      user_id: data.user.id,
      username
    });
  }

  btn.textContent = "Create Account";
  btn.disabled = false;
});

// ── Log In ───────────────────────────────────────────────────────
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");

  errorEl.classList.remove("show");

  if (!email || !password) {
    errorEl.textContent = "Please enter your email and password.";
    errorEl.classList.add("show");
    return;
  }

  const btn = document.getElementById("login-btn");
  btn.textContent = "Logging in...";
  btn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = "Incorrect email or password.";
    errorEl.classList.add("show");
    btn.textContent = "Log In";
    btn.disabled = false;
    return;
  }

  btn.textContent = "Log In";
  btn.disabled = false;
});

// ── Log Out ──────────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

// ── Auth State ───────────────────────────────────────────────────
sb.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await showApp();
  } else {
    currentUser = null;
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

async function showApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "block";

  // Retry a couple times in case profile isn't saved yet
  let profile = null;
  for (let i = 0; i < 3; i++) {
    const { data } = await sb
      .from("profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();
    if (data?.username) { profile = data; break; }
    await new Promise(r => setTimeout(r, 500));
  }

  const displayName = profile?.username || currentUser.email.split("@")[0];
  document.getElementById("user-name").textContent = displayName;

  if (profile?.avatar_url) {
    const avatar = document.getElementById("user-avatar");
    avatar.src = profile.avatar_url;
    avatar.style.display = "block";
  }

  if (profile) {
    document.getElementById("profile-username").value = profile.username || "";
    document.getElementById("profile-bio").value = profile.bio || "";
    document.getElementById("profile-genres").value = profile.genres || "";
    document.getElementById("profile-avatar-url").value = profile.avatar_url || "";
    if (profile.avatar_url) {
      document.getElementById("profile-avatar-preview").src = profile.avatar_url;
    }
  }
}

// ── Profile Avatar Preview ────────────────────────────────────────
document.getElementById("profile-avatar-url").addEventListener("input", (e) => {
  const url = e.target.value.trim();
  if (url) document.getElementById("profile-avatar-preview").src = url;
});

// ── Save Profile ─────────────────────────────────────────────────
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
    avatar_url
  });

  // Update header name and avatar
  document.getElementById("user-name").textContent = username || currentUser.email.split("@")[0];
  const headerAvatar = document.getElementById("user-avatar");
  if (avatar_url) {
    headerAvatar.src = avatar_url;
    headerAvatar.style.display = "block";
  }

  const badge = document.getElementById("profile-saved");
  badge.classList.add("show");
  setTimeout(() => badge.classList.remove("show"), 2000);
}

// ── Tabs ─────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "-panel").classList.add("active");
    if (tab.dataset.tab === "library") loadLibrary();
    document.getElementById("track-panel").classList.remove("open");
  });
});

// ── Search ───────────────────────────────────────────────────────
document.getElementById("search").addEventListener("keypress", async (e) => {
  if (e.key !== "Enter") return;
  const query = e.target.value.trim();
  if (!query) return;

  const loading = document.getElementById("loading");
  loading.style.display = "block";
  document.getElementById("results").innerHTML = "";
  document.getElementById("track-panel").classList.remove("open");

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

// ── Load Album ───────────────────────────────────────────────────
async function loadAlbum(spotifyAlbum) {
  const res = await fetch(`/api/album?id=${spotifyAlbum.id}`);
  const full = await res.json();

  currentAlbum = {
    id: spotifyAlbum.id,
    name: spotifyAlbum.name,
    artist: spotifyAlbum.artists[0]?.name || "",
    cover: spotifyAlbum.images[0]?.url || "",
    release_date: full.release_date || "",
    genres: (full.genres || []).join(", ")
  };

  document.getElementById("tp-cover").src = currentAlbum.cover;
  document.getElementById("tp-name").textContent = currentAlbum.name;
  document.getElementById("tp-artist").textContent = currentAlbum.artist;
  document.getElementById("tp-details").textContent =
    [currentAlbum.release_date, currentAlbum.genres].filter(Boolean).join(" · ");

  const { data: saved } = await sb
    .from("albums")
    .select("rating, thoughts")
    .eq("id", currentAlbum.id)
    .eq("user_id", currentUser.id)
    .single();

  renderStars(saved?.rating || 0);
  document.getElementById("album-thoughts").value = saved?.thoughts || "";

  const tracksRes = await fetch(`/api/tracks?id=${spotifyAlbum.id}`);
  const tracksData = await tracksRes.json();
  renderTracks(tracksData.items || []);

  document.getElementById("track-panel").classList.add("open");
  document.getElementById("track-panel").scrollIntoView({ behavior: "smooth" });
}

// ── Stars ────────────────────────────────────────────────────────
function renderStars(selected) {
  const container = document.getElementById("album-stars");
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (i <= selected ? " filled" : "");
    star.textContent = "★";
    star.addEventListener("click", () => {
      container.dataset.rating = i;
      highlightStars(i);
      autoSaveAlbum();
    });
    star.addEventListener("mouseover", () => highlightStars(i));
    star.addEventListener("mouseout", () => {
      highlightStars(parseInt(container.dataset.rating || "0"));
    });
    container.appendChild(star);
  }
  container.dataset.rating = selected;
}

function highlightStars(n) {
  document.querySelectorAll("#album-stars .star").forEach((s, i) => {
    s.classList.toggle("filled", i < n);
  });
}

// ── Auto Save Album ───────────────────────────────────────────────
async function autoSaveAlbum() {
  if (!currentAlbum || !currentUser) return;
  const rating = parseInt(document.getElementById("album-stars").dataset.rating || "0");
  const thoughts = document.getElementById("album-thoughts").value.trim();
  if (!rating && !thoughts) return;

  await sb.from("albums").upsert({
    id: currentAlbum.id,
    user_id: currentUser.id,
    name: currentAlbum.name,
    artist: currentAlbum.artist,
    cover: currentAlbum.cover,
    release_date: currentAlbum.release_date,
    genres: currentAlbum.genres,
    rating,
    thoughts
  }, { onConflict: "id,user_id" });
}

// Album thoughts autosave
document.getElementById("album-thoughts").addEventListener("input", () => {
  clearTimeout(saveThoughtsTimer);
  saveThoughtsTimer = setTimeout(() => autoSaveAlbum(), 800);
});

// ── Save Everything ───────────────────────────────────────────────
async function saveAll() {
  if (!currentAlbum || !currentUser) return;

  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving...";
  btn.disabled = true;

  const rating = parseInt(document.getElementById("album-stars").dataset.rating || "0");
  const thoughts = document.getElementById("album-thoughts").value.trim();

  if (rating || thoughts) {
    await sb.from("albums").upsert({
      id: currentAlbum.id,
      user_id: currentUser.id,
      name: currentAlbum.name,
      artist: currentAlbum.artist,
      cover: currentAlbum.cover,
      release_date: currentAlbum.release_date,
      genres: currentAlbum.genres,
      rating,
      thoughts
    }, { onConflict: "id,user_id" });
  }

  const trackItems = document.querySelectorAll(".track-item");
  const upserts = [];
  trackItems.forEach(item => {
    const review = item.querySelector("textarea").value;
    upserts.push({
      id: item.dataset.trackId,
      user_id: currentUser.id,
      album_id: currentAlbum.id,
      name: item.dataset.trackName,
      track_number: parseInt(item.dataset.trackNum),
      review
    });
  });

  if (upserts.length > 0) {
    await sb.from("tracks").upsert(upserts, { onConflict: "id,user_id" });
  }

  btn.textContent = "Saved ✓";
  btn.style.borderColor = "var(--saved)";
  btn.style.color = "var(--saved)";
  setTimeout(() => {
    btn.textContent = "Save Everything";
    btn.style.borderColor = "";
    btn.style.color = "";
    btn.disabled = false;
  }, 2000);
}

// ── Render Tracks ────────────────────────────────────────────────
async function renderTracks(tracks) {
  const list = document.getElementById("tracks-list");
  list.innerHTML = "";

  const { data: savedReviews } = await sb
    .from("tracks")
    .select("id, review")
    .eq("album_id", currentAlbum.id)
    .eq("user_id", currentUser.id);

  const reviewMap = {};
  (savedReviews || []).forEach(r => { reviewMap[r.id] = r.review; });

  tracks.forEach(track => {
    const item = document.createElement("div");
    item.className = "track-item";
    item.dataset.trackId = track.id;
    item.dataset.trackNum = track.track_number;
    item.dataset.trackName = track.name;

    item.innerHTML = `
      <div class="track-num">${track.track_number}</div>
      <div class="track-info">
        <div class="track-name">${track.name}</div>
        <textarea placeholder="Your thoughts on this track...">${reviewMap[track.id] || ""}</textarea>
      </div>
    `;

    const textarea = item.querySelector("textarea");
    let trackTimer = null;
    textarea.addEventListener("input", () => {
      clearTimeout(trackTimer);
      trackTimer = setTimeout(async () => {
        await sb.from("tracks").upsert({
          id: track.id,
          user_id: currentUser.id,
          album_id: currentAlbum.id,
          name: track.name,
          track_number: track.track_number,
          review: textarea.value
        }, { onConflict: "id,user_id" });
      }, 800);
    });

    list.appendChild(item);
  });
}

// ── Library ──────────────────────────────────────────────────────
async function loadLibrary() {
  const container = document.getElementById("library-content");
  container.innerHTML = "<p style='color:#555;font-size:13px;letter-spacing:1px'>Loading...</p>";

  const { data: albums } = await sb
    .from("albums")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("name");

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
        <div class="library-stars">${starsHtml}</div>
        ${album.thoughts ? `<div class="library-thoughts">"${album.thoughts}"</div>` : ""}
        ${album.release_date ? `<div style="font-size:11px;color:#444;margin-top:6px">${album.release_date}${album.genres ? " · " + album.genres : ""}</div>` : ""}
      </div>
      <button class="delete-btn" title="Remove from library">✕</button>
    `;

    card.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove "${album.name}" from your library?`)) return;
      await sb.from("tracks").delete().eq("album_id", album.id).eq("user_id", currentUser.id);
      await sb.from("albums").delete().eq("id", album.id).eq("user_id", currentUser.id);
      card.remove();
      if (!document.querySelector(".library-card")) {
        container.innerHTML = "<p style='color:#555;font-size:14px;letter-spacing:1px'>No albums saved yet. Rate or review an album to add it here.</p>";
      }
    });

    card.addEventListener("click", () => {
      window.location.href = `album.html?id=${album.id}`;
    });

    container.appendChild(card);
  });
}
