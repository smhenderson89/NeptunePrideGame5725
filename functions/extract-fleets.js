const fs = require("fs");
const path = require("path");

const DEFAULT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "api",
  "np-game-5725-response-261007-1532.json",
);
const OUTPUT = path.join(__dirname, "..", "data", "fleets.json");

// Fleet "uid" is replaced by the owning player's alias (fleet.puid -> player.alias).
function extractFleets(filePath = DEFAULT_FILE) {
  const { scanning_data: data } = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const aliasByUid = new Map(
    Object.values(data.players).map((p) => [p.uid, p.alias]),
  );

  return Object.entries(data.fleets).map(([fleetNumber, fleet]) => ({
    fleetNumber: Number(fleetNumber),
    uid: aliasByUid.get(fleet.puid) ?? null,
    x: fleet.x,
    y: fleet.y,
    lx: fleet.lx,
    ly: fleet.ly,
    size: fleet.st,
  }));
}

module.exports = { extractFleets };

if (require.main === module) {
  const fleets = extractFleets(process.argv[2]);
  fs.writeFileSync(OUTPUT, JSON.stringify(fleets, null, 2) + "\n");
  console.log(`Wrote ${fleets.length} fleets to ${OUTPUT}`);
}
