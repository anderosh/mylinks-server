const fetch = require("node-fetch")

const shortUrl = body => {
  return fetch("https://rel.ink/api/links/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(res => res.json())
}

module.exports = {
  shortUrl
}
