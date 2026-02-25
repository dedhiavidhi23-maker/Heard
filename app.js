const searchInput = document.getElementById("search");
const resultsDiv = document.getElementById("results");
const tracksDiv = document.getElementById("tracks");

searchInput.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value;
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();

    resultsDiv.innerHTML = "";
    tracksDiv.innerHTML = "";

    data.albums.items.forEach(album => {
      const albumEl = document.createElement("div");
      albumEl.innerHTML = `
        <img src="${album.images[0].url}" width="100"/>
        <p>${album.name} — ${album.artists[0].name}</p>
      `;
      albumEl.style.cursor = "pointer";

      albumEl.onclick = () => loadTracks(album.id, album.name);

      resultsDiv.appendChild(albumEl);
    });
  }
});

async function loadTracks(albumId, albumName) {
  const res = await fetch(`/api/tracks?id=${albumId}`);
  const data = await res.json();

  tracksDiv.innerHTML = `<h2>${albumName}</h2>`;

  data.items.forEach(track => {
    const trackEl = document.createElement("div");

    const savedReview = localStorage.getItem(track.id) || "";

    trackEl.innerHTML = `
      <h3>${track.track_number}. ${track.name}</h3>
      <textarea placeholder="Your thoughts...">${savedReview}</textarea>
      <hr/>
    `;

    const textarea = trackEl.querySelector("textarea");

    textarea.addEventListener("input", () => {
      localStorage.setItem(track.id, textarea.value);
    });

    tracksDiv.appendChild(trackEl);
  });
}
