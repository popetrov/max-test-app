require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const pool = require("./database");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
    return res.status(400).json({ success: false, message: "Заполните заголовок заявки" });
  }

  if (!contact || !contact.trim()) {
    return res.status(400).json({ success: false, message: "Заполните контакт" });
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

  pool.query(
    sql,
    [
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
    ]
  )
    .then((result) => {
      return res.json({
        success: true,
        message: "Заявка успешно опубликована"
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

app.post("/create-payment", async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || !description) {
      return res.status(400).json({
        success: false,
        error: "Не указана сумма или описание платежа"
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const returnUrl = process.env.PAYMENT_RETURN_URL;

    console.log("YOOKASSA DEBUG:", {
  shopId,
  shopIdLength: shopId ? shopId.length : 0,
  secretKeyPrefix: secretKey ? secretKey.slice(0, 5) : "NO_KEY",
  secretKeyLength: secretKey ? secretKey.length : 0,
  returnUrl
});

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
      payment_url: payment.confirmation.confirmation_url
    });

  } catch (error) {
    console.error("Ошибка создания платежа:", error);

    return res.status(500).json({
      success: false,
      error: "Внутренняя ошибка сервера"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});