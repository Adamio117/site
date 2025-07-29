// Проверка загрузки Supabase
if (typeof supabase === 'undefined') {
  const errorMsg = 'Supabase не загружен! Добавьте: <script src="https://unpkg.com/@supabase/supabase-js@^2"></script>';
  console.error(errorMsg);
  document.body.innerHTML = `<div style="color:red;padding:20px;">${errorMsg}</div>`;
  throw new Error(errorMsg);
}

// Инициализация
const SUPABASE_URL = 'https://my-website-cjed.onrender.com'; // Замените на ваш
const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

console.log('Supabase подключен!', supabase);

// Глобальные переменные
let currentUser = null;
let cartId = null;

// Делаем функции глобальными
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

document.addEventListener('DOMContentLoaded', function() {
  // Получаем элементы интерфейса
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
  const checkoutBtn = document.getElementById('checkoutBtn');

  // Инициализация - скрываем корзину по умолчанию
  cartBtn.style.display = 'none';

  // Проверка авторизации при загрузке
  checkAuth();

  // Обработчик кнопки входа
  loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Кнопка входа нажата');
    authModal.classList.add('show');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  });

  // Обработчики авторизации
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
      updateAuthUI();
      authModal.classList.remove('show');
      await initCart();
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
          data: { name }
        }
      });

      if (error) {
        console.error('Ошибка Supabase:', error);
        throw new Error(error.message || 'Неизвестная ошибка Supabase');
      }

      console.log('Успешный ответ сервера:', data);
      alert('Регистрация завершена! Проверьте почту для подтверждения.');
      
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';

    } catch (err) {
      console.error('Полная ошибка регистрации:', err);
      alert(`Ошибка регистрации: ${err.message || 'Сервер не отвечает'}`);
    }
  });

  // Обработчики корзины
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
      const { data: cartItems, error: itemsError } = await supabase
        .from('cart_items')
        .select('product_id, quantity, price, products(name)')
        .eq('cart_id', cartId);
      
      if (itemsError) throw itemsError;

      if (!cartItems || cartItems.length === 0) {
        alert('Корзина пуста');
        return;
      }

      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

// Обновление UI после авторизации
function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const cartBtn = document.getElementById('cartBtn');
  
  if (currentUser) {
    loginBtn.textContent = 'Мой профиль';
    cartBtn.style.display = 'flex';
  } else {
    loginBtn.textContent = 'Вход';
    cartBtn.style.display = 'none';
  }
}

// Проверка авторизации
async function checkAuth() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    updateAuthUI();
    
    if (user) {
      await initCart();
    }
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
  }
}

// Инициализация корзины
async function initCart() {
  if (!currentUser) return;

  try {
    const { data, error } = await supabase
      .from('cart_sessions')
      .select('id')
      .eq('user_id', currentUser.id)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) throw error;

    cartId = data?.id || null;
    
    if (!cartId) {
      const { data: newCart, error: cartError } = await supabase
        .from('cart_sessions')
        .insert({ user_id: currentUser.id })
        .select()
        .single();
      
      if (cartError) throw cartError;
      cartId = newCart.id;
    }
  } catch (error) {
    console.error('Ошибка инициализации корзины:', error);
  }
}

// Добавление товара в корзину
async function addToCart(productName, productPrice, button) {
  if (!currentUser) {
    alert('Для добавления товаров в корзину войдите в систему');
    document.getElementById('authModal').classList.add('show');
    return;
  }

  if (!cartId) await initCart();
  
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('name', productName)
      .single();

    if (productError || !product) throw productError || new Error('Товар не найден');

    const { data: existingItem, error: itemError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (itemError) throw itemError;

    if (existingItem) {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id);
      
      if (updateError) throw updateError;
    } else {
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
  } catch (error) {
    alert('Ошибка при добавлении в корзину: ' + error.message);
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

    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const cartCount = document.getElementById('cartCount');
    
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
  } catch (error) {
    console.error('Ошибка обновления корзины:', error);
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
  } catch (error) {
    alert('Ошибка при обновлении количества: ' + error.message);
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
  } catch (error) {
    alert('Ошибка при удалении товара: ' + error.message);
  }
}