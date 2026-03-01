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

// ── Auth ─────────────────────────────────────────────────────────
document.getElementById("google-login-btn").addEventListener("click", async () => {
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    showApp();
  } else {
    currentUser = null;
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

function showApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "block";

  const meta = currentUser.user_metadata;
  document.getElementById("user-name").textContent = meta.full_name || meta.name || "";
  const avatar = document.getElementById("user-avatar");
  if (meta.avatar_url || meta.picture) {
    avatar.src = meta.avatar_url || meta.picture;
  } else {
    avatar.style.display = "none";
  }
}

// ── Tabs ─────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "-panel").classList.add("active");

    if (tab.dataset.tab === "library") loadLibrary();

    // Hide track panel when switching tabs
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
    card.addEventListener("click", () => loadAlbum(album));
    resultsDiv.appendChild(card);
  });
});

// ── Load Album ───────────────────────────────────────────────────
async function loadAlbum(spotifyAlbum) {
  // Fetch full album details for genres + release date
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

  // Fill header
  document.getElementById("tp-cover").src = currentAlbum.cover;
  document.getElementById("tp-name").textContent = currentAlbum.name;
  document.getElementById("tp-artist").textContent = currentAlbum.artist;
  document.getElementById("tp-details").textContent =
    [currentAlbum.release_date, currentAlbum.genres].filter(Boolean).join(" · ");

  // Load saved album data from Supabase
  const { data: saved } = await sb
    .from("albums")
    .select("rating, thoughts")
    .eq("id", currentAlbum.id)
    .eq("user_id", currentUser.id)
    .single();

  renderStars(saved?.rating || 0);
  document.getElementById("album-thoughts").value = saved?.thoughts || "";

  // Load tracks
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
      // autosave rating immediately
      autoSaveAlbum();
    });
    star.addEventListener("mouseover", () => highlightStars(i));
    star.addEventListener("mouseout", () => {
      // restore actual saved state
      const current = parseInt(container.dataset.rating || "0");
      highlightStars(current);
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

// ── Auto Save Album (silent, no button feedback) ──────────────────
async function autoSaveAlbum() {
  if (!currentAlbum || !currentUser) return;
  const rating = parseInt(document.getElementById("album-stars").dataset.rating || "0");
  const thoughts = document.getElementById("album-thoughts").value.trim();

  // Only save if the user has actually added something
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

// Album thoughts autosave (debounced)
document.getElementById("album-thoughts").addEventListener("input", () => {
  clearTimeout(saveThoughtsTimer);
  saveThoughtsTimer = setTimeout(() => autoSaveAlbum(), 800);
});
async function saveAll() {
  if (!currentAlbum || !currentUser) return;

  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving...";
  btn.disabled = true;

  const rating = parseInt(document.getElementById("album-stars").dataset.rating || "0");
  const thoughts = document.getElementById("album-thoughts").value.trim();

  // Only save album if user added a rating or thoughts
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

  // Save all track reviews
  const trackItems = document.querySelectorAll(".track-item");
  const upserts = [];
  trackItems.forEach(item => {
    const trackId = item.dataset.trackId;
    const trackNum = parseInt(item.dataset.trackNum);
    const trackName = item.dataset.trackName;
    const review = item.querySelector("textarea").value;
    upserts.push({
      id: trackId,
      user_id: currentUser.id,
      album_id: currentAlbum.id,
      name: trackName,
      track_number: trackNum,
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
    btn.textContent = "Save";
    btn.style.borderColor = "";
    btn.style.color = "";
    btn.disabled = false;
  }, 2000);
}



// ── Render Tracks ────────────────────────────────────────────────
async function renderTracks(tracks) {
  const list = document.getElementById("tracks-list");
  list.innerHTML = "";

  // Fetch all saved track reviews for this album at once
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
    container.innerHTML = "<p id='library-empty' style='color:#555;font-size:14px;letter-spacing:1px'>No albums saved yet. Rate or review an album to add it here.</p>";
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
      <div>
        <div class="library-name">${album.name}</div>
        <div class="library-artist">${album.artist}</div>
        <div class="library-stars">${starsHtml}</div>
        ${album.thoughts ? `<div class="library-thoughts">"${album.thoughts}"</div>` : ""}
        ${album.release_date ? `<div style="font-size:11px;color:#444;margin-top:6px">${album.release_date}${album.genres ? " · " + album.genres : ""}</div>` : ""}
      </div>
    `;

    // Click to open in search panel
    card.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      document.querySelector('[data-tab="search"]').classList.add("active");
      document.getElementById("search-panel").classList.add("active");
      loadAlbum({ id: album.id, name: album.name, artists: [{ name: album.artist }], images: [{ url: album.cover }] });
    });

    container.appendChild(card);
  });
}
