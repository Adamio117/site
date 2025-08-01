// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://your-production-domain.com"],
    credentials: true,
  })
);
app.use(express.json());

// Статические файлы
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      }
    },
    fallthrough: true, // Добавьте эту строку
  })
);

// Инициализация Supabase
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl =
  process.env.SUPABASE_URL || "https://pgnzjtnzagxrygxzfipu.supabase.co";
const supabaseKey =
  process.env.SUPABASE_KEY || "sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29";
const supabase = createClient(supabaseUrl, supabaseKey);

// Маршруты
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/main", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "main.html"));
});

// API Endpoints
app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Ошибка получения продуктов:", err);
    res.status(500).json({
      error: "Не удалось получить список продуктов",
      details: err.message,
    });
  }
});

app.get("/api/orders/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(*))")
      .eq("user_id", req.params.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Ошибка получения заказов:", err);
    res.status(500).json({
      error: "Не удалось получить заказы",
      details: err.message,
    });
  }
});

app.post("/api/checkout", async (req, res) => {
  try {
    const { userId, cartId, address, phone } = req.body;

    if (!userId || !cartId || !address || !phone) {
      return res
        .status(400)
        .json({ error: "Недостаточно данных для оформления заказа" });
    }

    // Получаем товары из корзины
    const { data: cartItems, error: itemsError } = await supabase
      .from("cart_items")
      .select("product_id, quantity, price")
      .eq("cart_id", cartId);

    if (itemsError) throw itemsError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "Корзина пуста" });
    }

    // Рассчитываем общую сумму
    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Создаем заказ
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        total,
        delivery_address: address,
        phone,
        status: "processing",
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Добавляем элементы заказа
    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsInsertError) throw itemsInsertError;

    // Очищаем корзину
    await supabase.from("cart_items").delete().eq("cart_id", cartId);

    res.json({
      success: true,
      orderId: order.id,
      total: total,
    });
  } catch (err) {
    console.error("Ошибка оформления заказа:", err);
    res.status(500).json({
      error: "Ошибка при оформлении заказа",
      details: err.message,
    });
  }
});

// Обработка 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error("Ошибка сервера:", err);
  res.status(500).json({
    error: "Внутренняя ошибка сервера",
    details: err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
