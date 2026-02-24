const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET_KEY;

const DATA_FILE = path.join(__dirname, "data.json");

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    return { sales: [], online: 0 };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = load();

// ===== ROBLOX API =====

app.post("/update", (req, res) => {
  if (req.headers["x-secret"] !== SECRET)
    return res.status(403).send("Forbidden");

  const { type, amount, username } = req.body;

  db.sales.push({
    type,
    amount,
    username,
    time: Date.now()
  });

  save();
  res.send("ok");
});

app.post("/online", (req, res) => {
  if (req.headers["x-secret"] !== SECRET)
    return res.status(403).send("Forbidden");

  db.online = req.body.online;
  save();
  res.send("ok");
});

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log("API running");
});

// ===== ANALYTICS =====

function calcProfit(type, amount) {
  if (type === "classic") return Math.floor(amount * 0.1);
  if (type === "ugc") return Math.floor(amount * 0.4);
  if (type === "donation") return Math.floor(amount * 0.7);
  return 0;
}

function filterByDays(days) {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return db.sales.filter(s => s.time >= cutoff);
}

function aggregate(sales) {
  let revenue = 0;
  let profit = 0;
  let purchases = 0;
  let donations = 0;

  for (const s of sales) {
    revenue += s.amount;
    profit += calcProfit(s.type, s.amount);

    if (s.type === "donation") donations++;
    else purchases++;
  }

  return { revenue, profit, purchases, donations };
}

// ===== DISCORD =====

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", () => {
  console.log("Bot ready");
});

const commands = [
  new SlashCommandBuilder().setName("today").setDescription("Stats today"),
  new SlashCommandBuilder().setName("month").setDescription("Stats 30 days"),
  new SlashCommandBuilder().setName("year").setDescription("Stats 365 days"),
  new SlashCommandBuilder().setName("all").setDescription("All time stats")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });
})();

async function sendEmbed(interaction, title, sales) {
  const data = aggregate(sales);

  const embed = new EmbedBuilder()
    .setColor(0x00ffaa)
    .setTitle(`📊 ${title}`)
    .setDescription(
`━━━━━━━━━━━━━━━━━━

🟢 Online: **${db.online}**

💰 Revenue: **${data.revenue}**
📈 Profit: **${data.profit}**

🛒 Purchases: **${data.purchases}**
💸 Donations: **${data.donations}**

━━━━━━━━━━━━━━━━━━`
    )
    .setFooter({ text: "Rolling analytics system" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "today")
    return sendEmbed(interaction, "Today (24h)", filterByDays(1));

  if (interaction.commandName === "month")
    return sendEmbed(interaction, "Last 30 Days", filterByDays(30));

  if (interaction.commandName === "year")
    return sendEmbed(interaction, "Last 365 Days", filterByDays(365));

  if (interaction.commandName === "all")
    return sendEmbed(interaction, "All Time", db.sales);
});

client.login(TOKEN);
