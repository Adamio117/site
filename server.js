require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

const users = [];
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    if (users.some(user => user.email === email)) {
      return res.status(400).json({ error: 'Email уже занят' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: Date.now().toString(), name, email, password: hashedPassword };
    users.push(user);
    
    const token = jwt.sign({ userId: user.id, email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Логин
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    const user = users.find(user => user.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Неверные данные' });
    }
    
    const token = jwt.sign({ userId: user.id, email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка токена
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Защищенный роут для оформления заказа
app.post('/api/orders', authenticateToken, (req, res) => {
  try {
    const order = req.body;
    if (!order.items || !order.total) {
      return res.status(400).json({ error: 'Неверные данные заказа' });
    }
    
    // Здесь можно сохранить заказ в "базу данных"
    console.log('Новый заказ от пользователя:', req.user.userId, order);
    res.json({ success: true, orderId: Date.now().toString() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));