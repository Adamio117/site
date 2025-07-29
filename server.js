require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Разрешить все origins (для разработки)
app.use(cors());

// Или настроить конкретные домены
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-site.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const { createClient } = require('@supabase/supabase-js');
app.use(cors());
app.use(express.json());

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Маршруты API
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { userId, cartId, address, phone } = req.body;
  
  try {
    // Получаем товары из корзины
    const { data: cartItems, error: itemsError } = await supabase
      .from('cart_items')
      .select('product_id, quantity, price')
      .eq('cart_id', cartId);
    
    if (itemsError) throw itemsError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Рассчитываем общую сумму
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Создаем заказ
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total,
        delivery_address: address,
        phone,
        status: 'processing'
      })
      .select()
      .single();
    
    if (orderError) throw orderError;

    // Добавляем элементы заказа
    const orderItems = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsInsertError } = await supabase
      .from('order_items')
      .insert(orderItems);
    
    if (itemsInsertError) throw itemsInsertError;

    // Очищаем корзину
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);
    
    res.json({ success: true, orderId: order.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));