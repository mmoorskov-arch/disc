const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const app = express();
app.use(express.json());

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET_KEY;

// ===== IN-MEMORY STATS =====
let stats = {
  online: 0,
  revenueToday: 0,
  purchasesToday: 0,
  donationsToday: 0,
  lastUpdate: null
};

// ===== ROBLOX → API =====
app.post("/update", (req, res) => {
  const auth = req.headers["x-secret"];

  if (auth !== SECRET) {
    return res.status(403).send("Forbidden");
  }

  stats = {
    ...stats,
    ...req.body,
    lastUpdate: new Date().toISOString()
  };

  console.log("Stats updated:", stats);
  res.send("ok");
});

app.get("/", (req, res) => {
  res.send("Bot backend running");
});

// ВАЖНО ДЛЯ RAILWAY
app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log("API server running on port", process.env.PORT);
});

// ===== DISCORD BOT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Slash command
const commands = [
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show live Roblox game stats")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("Slash command registered");
  } catch (error) {
    console.error(error);
  }
})();

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "stats") {
    await interaction.reply({
      embeds: [
        {
          title: "📊 Roblox Game Statistics",
          color: 0x00ff99,
          fields: [
            { name: "🟢 Online Players", value: String(stats.online), inline: true },
            { name: "💰 Revenue Today", value: String(stats.revenueToday), inline: true },
            { name: "🛒 Purchases Today", value: String(stats.purchasesToday), inline: true },
            { name: "💸 Donations Today", value: String(stats.donationsToday), inline: true },
            { name: "🕒 Last Update", value: stats.lastUpdate || "never" }
          ],
          footer: {
            text: "Roblox Analytics System"
          }
        }
      ]
    });
  }
});

client.login(TOKEN);
