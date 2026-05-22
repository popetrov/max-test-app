require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");
const pool = require("./database");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "chat_uploads")));

const chatFilePath = path.join(__dirname, "chat-messages.json");
const pinnedFilePath = path.join(__dirname, "chat-pinned.json");
const uploadsPath = path.join(__dirname, "chat_uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error("Ошибка чтения файла:", error.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Ошибка записи файла:", error.message);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Zа-яА-Я0-9.\-_]/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const chatMessages = readJsonFile(chatFilePath, []);

let pinnedMessage = readJsonFile(pinnedFilePath, {
  text: "Пишите по делу. Не публикуйте чужие контакты, личные данные и спам.",
  updatedAt: new Date().toISOString()
});

const lastMessageTime = {};

app.post("/api/chat-upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Файл не загружен"
    });
  }
return res.json({
  success: true,

  file: {
    originalName: "Файл",
    fileName: req.file.filename,
    url: "/uploads/" + req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size
  }
});
});

io.on("connection", (socket) => {
  console.log("Пользователь подключился к чату");

  socket.emit("chat-history", chatMessages);
  socket.emit("pinned-message", pinnedMessage);

  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", {
      name: data.name || "Гость"
    });
  });

  socket.on("chat-message", (message) => {
    const name = message.name || "Гость";
    const now = Date.now();

    if (lastMessageTime[name] && now - lastMessageTime[name] < 800) {
      return;
    }

    lastMessageTime[name] = now;

    const text = String(message.text || "").trim();

    if (!text && !message.file) return;

    const replyTo = message.replyTo
      ? {
          id: message.replyTo.id,
          name: message.replyTo.name || "Гость",
          text: message.replyTo.text || ""
        }
      : null;

    const newMessage = {
      id: Date.now(),
      name,
      text,
      file: message.file || null,
      replyTo,
      reactions: {},
      time: new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      createdAt: new Date().toISOString()
    };

    chatMessages.push(newMessage);
    writeJsonFile(chatFilePath, chatMessages);

    io.emit("chat-message", newMessage);
  });

  socket.on("delete-message", (messageId) => {
    const index = chatMessages.findIndex((msg) => msg.id === messageId);

    if (index === -1) return;

    chatMessages.splice(index, 1);
    writeJsonFile(chatFilePath, chatMessages);

    io.emit("message-deleted", messageId);
  });

  socket.on("clear-chat", () => {
    chatMessages.length = 0;
    writeJsonFile(chatFilePath, chatMessages);
    io.emit("chat-cleared");
  });

  socket.on("react-message", (data) => {
    const message = chatMessages.find((msg) => msg.id === data.messageId);

    if (!message) return;

    const emoji = data.emoji || "👍";
    const user = data.name || "Гость";

    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    if (message.reactions[emoji].includes(user)) {
      message.reactions[emoji] = message.reactions[emoji].filter((name) => name !== user);
    } else {
      message.reactions[emoji].push(user);
    }

    writeJsonFile(chatFilePath, chatMessages);

    io.emit("reaction-updated", {
      messageId: data.messageId,
      reactions: message.reactions
    });
  });

  socket.on("update-pinned-message", (data) => {
    const text = String(data.text || "").trim();

    pinnedMessage = {
      text,
      updatedAt: new Date().toISOString()
    };

    writeJsonFile(pinnedFilePath, pinnedMessage);
    io.emit("pinned-message", pinnedMessage);
  });

  socket.on("disconnect", () => {
    console.log("Пользователь вышел из чата");
  });
});

/*
  СОЗДАНИЕ ЗАЯВКИ
*/
app.post("/api/contractor-requests", (req, res) => {
  const {
    title,
    description,
    city,
    performers,
    sro,
    category,
    priceFrom,
    priceTo,
    contactType,
    contact
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: "Заполните заголовок заявки"
    });
  }

  if (!contact || !contact.trim()) {
    return res.status(400).json({
      success: false,
      message: "Заполните контакт"
    });
  }

  const createdAt = new Date().toISOString();
  const performersJson = JSON.stringify(performers || []);

  const sql = `
    INSERT INTO contractor_requests (
      title,
      description,
      city,
      performers,
      sro,
      category,
      price_from,
      price_to,
      contact_type,
      contact,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `;

  pool.query(sql, [
    title,
    description || "",
    city || "",
    performersJson,
    sro || "",
    category || "",
    priceFrom || null,
    priceTo || null,
    contactType || "",
    contact,
    createdAt
  ])
    .then((result) => {
      return res.json({
        success: true,
        message: "Заявка успешно опубликована",
        id: result.rows?.[0]?.id || 1
      });
    })
    .catch((error) => {
      console.error("Ошибка сохранения:", error.message);

      return res.status(500).json({
        success: false,
        message: "Ошибка при сохранении заявки"
      });
    });
});

/*
  ПОЛУЧЕНИЕ ВСЕХ ЗАЯВОК
*/
app.get("/api/contractor-requests", (req, res) => {
  const sql = `
    SELECT *
    FROM contractor_requests
    ORDER BY id DESC
  `;

  pool.query(sql)
    .then((result) => {
      const items = result.rows.map((row) => {
        let performers = [];

        try {
          performers = JSON.parse(row.performers || "[]");
        } catch {}

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          city: row.city,
          performers,
          sro: row.sro,
          category: row.category,
          priceFrom: row.price_from,
          priceTo: row.price_to,
          contactType: row.contact_type,
          contact: row.contact,
          createdAt: row.created_at
        };
      });

      return res.json({
        success: true,
        items
      });
    })
    .catch((error) => {
      console.error("Ошибка получения:", error.message);

      return res.status(500).json({
        success: false,
        message: "Ошибка при получении заявок"
      });
    });
});

/*
  СОЗДАНИЕ ПЛАТЕЖА ЮKASSA
*/
app.post("/api/create-payment", async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || !description) {
      return res.status(400).json({
        success: false,
        error: "Не указана сумма или описание платежа"
      });
    }

    const shopId = (process.env.YOOKASSA_SHOP_ID || "").trim();
    const secretKey = (process.env.YOOKASSA_SECRET_KEY || "").trim();
    const returnUrl = (process.env.PAYMENT_RETURN_URL || "").trim();

    if (!shopId || !secretKey || !returnUrl) {
      return res.status(500).json({
        success: false,
        error: "Не настроены переменные ЮKassa на сервере"
      });
    }

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: {
          value: Number(amount).toFixed(2),
          currency: "RUB"
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: returnUrl
        },
        description
      })
    });

    const payment = await response.json();

    if (!response.ok) {
      console.error("Ошибка ЮKassa:", payment);

      return res.status(500).json({
        success: false,
        error: payment.description || "Ошибка создания платежа в ЮKassa"
      });
    }

    return res.json({
      success: true,
      paymentUrl: payment.confirmation.confirmation_url
    });

  } catch (error) {
    console.error("Ошибка создания платежа:", error);

    return res.status(500).json({
      success: false,
      error: "Внутренняя ошибка сервера"
    });
  }
});

function notifyAdminAboutPayment(paymentData) {
  console.log("Новая оплата подписки:", paymentData);
}

app.post("/api/subscription-paid", (req, res) => {
  const {
    userId,
    userName,
    amount,
    period,
    paymentId
  } = req.body;

  const paymentData = {
    userId: userId || "unknown",
    userName: userName || "unknown",
    amount: amount || 800,
    period: period || "1 месяц",
    paymentId: paymentId || "unknown",
    status: "paid",
    createdAt: new Date().toISOString()
  };

  notifyAdminAboutPayment(paymentData);

  return res.json({
    success: true,
    message: "Оплата подписки зафиксирована"
  });
});

app.get("/pay-subscription", async (req, res) => {
  try {
    const shopId = (process.env.YOOKASSA_SHOP_ID || "").trim();
    const secretKey = (process.env.YOOKASSA_SECRET_KEY || "").trim();
    const returnUrl = (process.env.PAYMENT_RETURN_URL || "").trim();

    if (!shopId || !secretKey || !returnUrl) {
      return res.status(500).send("Не настроены переменные ЮKassa");
    }

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: {
          value: "800.00",
          currency: "RUB"
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: returnUrl
        },
        description: "Подписка СТРОЙПОДРЯД в МАКС на 1 месяц"
      })
    });

    const payment = await response.json();

    if (!response.ok || !payment.confirmation?.confirmation_url) {
      console.error("Ошибка ЮKassa:", payment);
      return res.status(500).send("Не удалось создать платеж");
    }

    return res.redirect(payment.confirmation.confirmation_url);

  } catch (error) {
    console.error("Ошибка оплаты:", error);
    return res.status(500).send("Ошибка создания платежа");
  }
});



function getCheckoKey() {
  return (process.env.CHECKO_API_KEY || "").trim();
}

async function requestChecko(endpoint, payload) {
  const key = getCheckoKey();

  if (!key) {
    return { success: false, error: "Не указан CHECKO_API_KEY" };
  }

  const response = await fetch(`https://api.checko.ru/v2/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, ...payload })
  });

  const data = await response.json();

  return {
    success: response.ok,
    endpoint,
    data
  };
}

app.post("/api/check-counterparty", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: "Введите ИНН, ОГРН или название" });
    }

    const cleanQuery = String(query).trim();

    let endpoint = "search";
    let payload = { query: cleanQuery };

    if (/^\d{10}$/.test(cleanQuery)) {
      endpoint = "company";
      payload = { inn: cleanQuery };
    } else if (/^\d{13}$/.test(cleanQuery)) {
      endpoint = "company";
      payload = { ogrn: cleanQuery };
    } else if (/^\d{12}$/.test(cleanQuery)) {
      endpoint = "entrepreneur";
      payload = { inn: cleanQuery };
    } else if (/^\d{15}$/.test(cleanQuery)) {
      endpoint = "entrepreneur";
      payload = { ogrn: cleanQuery };
    }

    const result = await requestChecko(endpoint, payload);
    return res.json(result);

  } catch (error) {
    console.error("Counterparty check error:", error);

    res.status(500).json({
      success: false,
      error: "Ошибка проверки контрагента"
    });
  }
});

app.post("/api/check-counterparty/finances", async (req, res) => {
  try {
    const inn = String(req.body.inn || "").trim();

    if (!/^\d{10}$/.test(inn)) {
      return res.status(400).json({ success: false, error: "Для финансов нужен ИНН юрлица из 10 цифр" });
    }

    const result = await requestChecko("finances", { inn });
    return res.json(result);
  } catch (error) {
    console.error("Counterparty finances error:", error);
    return res.status(500).json({ success: false, error: "Ошибка загрузки финансов" });
  }
});

app.post("/api/check-counterparty/legal-cases", async (req, res) => {
  try {
    const inn = String(req.body.inn || "").trim();

    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      return res.status(400).json({ success: false, error: "Для судов нужен ИНН" });
    }

    const result = await requestChecko("legal-cases", { inn, sort: "-date" });
    return res.json(result);
  } catch (error) {
    console.error("Counterparty legal cases error:", error);
    return res.status(500).json({ success: false, error: "Ошибка загрузки судов" });
  }
});

app.post("/api/check-counterparty/enforcements", async (req, res) => {
  try {
    const inn = String(req.body.inn || "").trim();

    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      return res.status(400).json({ success: false, error: "Для ФССП нужен ИНН" });
    }

    const result = await requestChecko("enforcements", { inn });
    return res.json(result);
  } catch (error) {
    console.error("Counterparty enforcements error:", error);
    return res.status(500).json({ success: false, error: "Ошибка загрузки ФССП" });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});