const fs = require("fs");
const path = require("path");

const DEFAULT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "api",
  "np-game-5725-response-261007-1532.json",
);

// Star "uid" is replaced by the owning player's alias (star.puid -> player.alias); unowned stars get null.
function extractStars(filePath = DEFAULT_FILE) {
  const { scanning_data: data } = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const aliasByUid = new Map(
    Object.values(data.players).map((p) => [p.uid, p.alias]),
  );

  return Object.values(data.stars).map((star) => ({
    name: star.n,
    uid: aliasByUid.get(star.puid) ?? null,
    x: star.x,
    y: star.y,
  }));
}

module.exports = { extractStars };

if (require.main === module) {
  console.log(JSON.stringify(extractStars(process.argv[2]), null, 2));
}
