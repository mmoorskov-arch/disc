const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET_KEY;

let stats = {
  online: 0,
  revenueToday: 0,
  purchasesToday: 0,
  donationsToday: 0,
  lastUpdate: null
};

// ===== ROBLOX API ENDPOINT =====
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

app.listen(process.env.PORT || 3000, () => {
  console.log("API server running");
});

// ===== DISCORD BOT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Slash command
const commands = [
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show live Roblox game stats")
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
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
      content: `🟢 Online: ${stats.online}
💰 Revenue today: ${stats.revenueToday}
🛒 Purchases today: ${stats.purchasesToday}
💸 Donations today: ${stats.donationsToday}
🕒 Last update: ${stats.lastUpdate || "never"}`,
      ephemeral: false
    });
  }
});

client.login(process.env.TOKEN);
