export default async function handler(req, res) {
  const { id } = req.query;

  const tokenRes = await fetch("https://heard-sigma.vercel.app/api/token");
  const tokenData = await tokenRes.json();

  const spotifyRes = await fetch(
    `https://api.spotify.com/v1/albums/${id}`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  );

  const data = await spotifyRes.json();
  res.status(200).json(data);
}
