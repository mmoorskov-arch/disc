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

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET_KEY;
const OWNER_ID = process.env.OWNER_ID;

// ===== DATA STORAGE =====
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      today: {},
      month: {},
      allTime: {},
      topToday: {},
      topMonth: {},
      online: 0
    };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadData();

// ===== UTILS =====
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function calculateProfit(type, amount) {
  if (type === "classic") return Math.floor(amount * 0.1);
  if (type === "ugc") return Math.floor(amount * 0.4);
  if (type === "donation") return Math.floor(amount * 0.7);
  return 0;
}

function ensurePeriod(obj, key) {
  if (!obj[key]) {
    obj[key] = { revenue: 0, profit: 0, purchases: 0, donations: 0 };
  }
}

// ===== ROBLOX API =====
app.post("/update", (req, res) => {
  if (req.headers["x-secret"] !== SECRET) {
    return res.status(403).send("Forbidden");
  }

  const { type, amount, userId, username } = req.body;
  const todayKey = getTodayKey();
  const monthKey = getMonthKey();

  ensurePeriod(db.today, todayKey);
  ensurePeriod(db.month, monthKey);
  ensurePeriod(db.allTime, "total");

  const profit = calculateProfit(type, amount);

  // revenue
  db.today[todayKey].revenue += amount;
  db.month[monthKey].revenue += amount;
  db.allTime.total.revenue += amount;

  // profit
  db.today[todayKey].profit += profit;
  db.month[monthKey].profit += profit;
  db.allTime.total.profit += profit;

  // counts
  if (type === "donation") {
    db.today[todayKey].donations++;
    db.month[monthKey].donations++;
  } else {
    db.today[todayKey].purchases++;
    db.month[monthKey].purchases++;
  }

  // top buyers
  if (!db.topToday[todayKey]) db.topToday[todayKey] = {};
  if (!db.topMonth[monthKey]) db.topMonth[monthKey] = {};

  db.topToday[todayKey][username] =
    (db.topToday[todayKey][username] || 0) + amount;

  db.topMonth[monthKey][username] =
    (db.topMonth[monthKey][username] || 0) + amount;

  saveData();
  res.send("ok");
});

app.post("/online", (req, res) => {
  if (req.headers["x-secret"] !== SECRET) {
    return res.status(403).send("Forbidden");
  }

  db.online = req.body.online;
  saveData();
  res.send("ok");
});

app.get("/", (req, res) => {
  res.send("Analytics running");
});

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log("API running on", process.env.PORT);
});

// ===== DISCORD =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

const commands = [
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show analytics")
    .addStringOption(opt =>
      opt
        .setName("period")
        .setDescription("today | month | all")
        .setRequired(true)
        .addChoices(
          { name: "Today", value: "today" },
          { name: "Month", value: "month" },
          { name: "All Time", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset analytics")
    .addStringOption(opt =>
      opt
        .setName("period")
        .setDescription("today | month")
        .setRequired(true)
        .addChoices(
          { name: "Today", value: "today" },
          { name: "Month", value: "month" }
        )
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });
})();

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const period = interaction.options.getString("period");

  if (interaction.commandName === "reset") {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "Owner only.",
        ephemeral: true
      });
    }

    if (period === "today") db.today = {};
    if (period === "month") db.month = {};

    saveData();

    return interaction.reply("Reset done.");
  }

  let data;
  if (period === "today") data = db.today[getTodayKey()];
  if (period === "month") data = db.month[getMonthKey()];
  if (period === "all") data = db.allTime.total;

  if (!data) {
    return interaction.reply("No data yet.");
  }

  const embed = new EmbedBuilder()
    .setTitle("📊 Game Analytics")
    .setColor(0x00ff99)
    .addFields(
      { name: "🟢 Online", value: String(db.online), inline: true },
      { name: "💰 Revenue", value: String(data.revenue), inline: true },
      { name: "📈 Profit", value: String(data.profit), inline: true },
      { name: "🛒 Purchases", value: String(data.purchases), inline: true },
      { name: "💸 Donations", value: String(data.donations), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
});

client.login(TOKEN);
