export default async function handler(req, res) {

  const client_id = "457a7741b2ee4faabbd1cec940286e6c";
  const client_secret = "5fa041bbfdd9414786f20c5aaf16d497";

  const auth = Buffer.from(client_id + ":" + client_secret).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();

  res.status(200).json(data);

}
