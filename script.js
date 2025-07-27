// Инициализация Supabase
const SUPABASE_URL = 'https://pgnzjtnzagxrygxzfipu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnpqdG56YWd4cnlneHpmaXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NjcyNTEsImV4cCI6MjA2OTE0MzI1MX0.NlQyo1EdUh3waclUmfYkwgYsQu64OArs9GBNndmmqXg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Глобальные переменные
let currentUser = null;
let cartId = null;

document.addEventListener('DOMContentLoaded', function() {
  // Элементы интерфейса
  const loginBtn = document.getElementById('loginBtn');
  const authModal = document.getElementById('authModal');
  const closeAuth = document.querySelector('.close-auth');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginFormElement = document.getElementById('loginFormElement');
  const registerFormElement = document.getElementById('registerFormElement');
  const cartBtn = document.getElementById('cartBtn');
  const cartModal = document.getElementById('cartModal');
  const closeCart = document.querySelector('.close-cart');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');

  // Проверка авторизации при загрузке
  checkAuth();

  // ========== Обработчики авторизации ==========
  loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    authModal.classList.add('show');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  });

  closeAuth.addEventListener('click', function() {
    authModal.classList.remove('show');
  });

  authModal.addEventListener('click', function(e) {
    if (e.target === authModal) {
      authModal.classList.remove('show');
    }
  });

  showRegister.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });

  showLogin.addEventListener('click', function(e) {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  loginFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      currentUser = data.user;
      loginBtn.textContent = 'Мой профиль';
      authModal.classList.remove('show');
      await initCart();
      await updateCartDisplay();
    } catch (err) {
      alert('Ошибка входа: ' + err.message);
    }
  });

  registerFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = this.querySelectorAll('input[type="password"]')[1].value;
    
    if (password !== confirmPassword) {
      alert('Пароли не совпадают!');
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone: ''
          }
        }
      });
      
      if (error) throw error;
      
      alert('Регистрация успешна! Проверьте вашу почту для подтверждения.');
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
    } catch (err) {
      alert('Ошибка регистрации: ' + err.message);
    }
  });

  // ========== Обработчики корзины ==========
  cartBtn.addEventListener('click', async function() {
    cartModal.classList.add('show');
    await updateCartDisplay();
  });

  closeCart.addEventListener('click', function() {
    cartModal.classList.remove('show');
  });

  cartModal.addEventListener('click', function(e) {
    if (e.target === cartModal) {
      cartModal.classList.remove('show');
    }
  });

  checkoutBtn.addEventListener('click', async function() {
    if (!currentUser) {
      alert('Для оформления заказа войдите в систему');
      authModal.classList.add('show');
      cartModal.classList.remove('show');
      return;
    }

    const address = prompt('Введите адрес доставки:');
    if (!address) return;
    
    const phone = prompt('Введите ваш телефон:');
    if (!phone) return;
    
    try {
      // Получаем товары из корзины
      const { data: cartItems, error: itemsError } = await supabase
        .from('cart_items')
        .select('product_id, quantity, price, products(name)')
        .eq('cart_id', cartId);
      
      if (itemsError) throw itemsError;

      if (!cartItems || cartItems.length === 0) {
        alert('Корзина пуста');
        return;
      }

      // Рассчитываем общую сумму
      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Создаем заказ
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: currentUser.id,
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
      
      await supabase
        .from('cart_sessions')
        .delete()
        .eq('id', cartId);
      
      cartId = null;
      await initCart();
      await updateCartDisplay();
      cartModal.classList.remove('show');

      alert(`Заказ #${order.id} успешно оформлен! Сумма: ${total}₽`);
    } catch (err) {
      alert('Ошибка при оформлении заказа: ' + err.message);
    }
  });
});

// Функция проверки авторизации
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    currentUser = user;
    document.getElementById('loginBtn').textContent = 'Мой профиль';
    await initCart();
    await updateCartDisplay();
  }
}

// Инициализация корзины
async function initCart() {
  if (!currentUser) {
    // Для гостей - используем localStorage
    cartId = localStorage.getItem('cart_id');
    if (!cartId) {
      cartId = crypto.randomUUID();
      localStorage.setItem('cart_id', cartId);
      
      // Создаем сессию корзины в Supabase
      const { error } = await supabase
        .from('cart_sessions')
        .insert({ id: cartId });
      
      if (error) console.error('Ошибка создания корзины:', error);
    }
    return;
  }

  // Для авторизованных пользователей
  const { data, error } = await supabase
    .from('cart_sessions')
    .select('id')
    .eq('user_id', currentUser.id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (data) {
    cartId = data.id;
  } else {
    // Создаем новую корзину
    const { data: newCart, error: cartError } = await supabase
      .from('cart_sessions')
      .insert({ user_id: currentUser.id })
      .select()
      .single();
    
    if (cartError) throw cartError;
    cartId = newCart.id;
  }
}

// Добавление товара в корзину
async function addToCart(productName, productPrice, button) {
  if (!cartId) await initCart();
  
  // Находим ID продукта по имени
  const { data: product, error } = await supabase
    .from('products')
    .select('id')
    .eq('name', productName)
    .single();

  if (error || !product) {
    alert('Ошибка при добавлении товара');
    return;
  }

  try {
    // Проверяем, есть ли уже такой товар в корзине
    const { data: existingItem, error: itemError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (itemError) throw itemError;

    if (existingItem) {
      // Увеличиваем количество
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id);
      
      if (updateError) throw updateError;
    } else {
      // Добавляем новый товар
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cartId,
          product_id: product.id,
          price: productPrice,
          quantity: 1
        });
      
      if (insertError) throw insertError;
    }

    button.textContent = 'Добавлено!';
    setTimeout(() => {
      button.textContent = 'Добавить';
    }, 2000);
    
    await updateCartDisplay();
  } catch (err) {
    alert('Ошибка при добавлении в корзину: ' + err.message);
  }
}

// Обновление отображения корзины
async function updateCartDisplay() {
  if (!cartId) return;
  
  try {
    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        price,
        products (name)
      `)
      .eq('cart_id', cartId);
    
    if (error) throw error;
    
    cartItemsContainer.innerHTML = '';
    let total = 0;
    let totalCount = 0;
    
    if (items && items.length > 0) {
      items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalCount += item.quantity;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
          <div class="cart-item-name">${item.products.name}</div>
          <div class="cart-item-price">${item.price} ₽</div>
          <div class="cart-item-quantity">
            <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
            <span>${item.quantity}</span>
            <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
          </div>
          <div class="cart-item-total">${itemTotal} ₽</div>
          <button class="remove-item" onclick="removeFromCart(${item.id})">×</button>
        `;
        cartItemsContainer.appendChild(itemElement);
      });
    } else {
      cartItemsContainer.innerHTML = '<p>Корзина пуста</p>';
    }
    
    cartTotal.textContent = total;
    cartCount.textContent = totalCount;
  } catch (err) {
    console.error('Ошибка при загрузке корзины:', err);
  }
}

// Обновление количества товара
async function updateQuantity(itemId, newQuantity) {
  if (newQuantity < 1) {
    await removeFromCart(itemId);
    return;
  }
  
  try {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', itemId);
    
    if (error) throw error;
    
    await updateCartDisplay();
  } catch (err) {
    alert('Ошибка при обновлении количества: ' + err.message);
  }
}

// Удаление товара из корзины
async function removeFromCart(itemId) {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    await updateCartDisplay();
  } catch (err) {
    alert('Ошибка при удалении товара: ' + err.message);
  }
}