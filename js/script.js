// Глобальные переменные
let supabase;
let currentUser = null;
let cartId = null;

// Инициализация Supabase
function initSupabase() {
  try {
    // Проверяем, что Supabase SDK загружен
    if (typeof supabase === 'undefined' && typeof supabaseClient === 'undefined') {
      throw new Error('Supabase SDK not loaded');
    }

    const SUPABASE_URL = 'https://my-website-cjed.onrender.com';
    const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';
    
    // Используем глобальный supabaseClient если доступен
    supabase = typeof supabaseClient !== 'undefined' 
      ? supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        })
      : supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
    
    return supabase;
  } catch (error) {
    console.error('Supabase initialization error:', error);
    showError('Ошибка загрузки системы. Пожалуйста, обновите страницу.');
    throw error;
  }
}

// Показ ошибки
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ffebee;
    color: #c62828;
    padding: 15px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// Проверка авторизации
async function checkAuth() {
  try {
    if (!supabase) {
      await initSupabase();
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    currentUser = user;
    return !!user;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

// Перенаправление
function redirectToLogin() {
  if (!window.location.pathname.endsWith('index.html')) {
    window.location.href = 'index.html';
  }
}

// Инициализация приложения
async function initApp() {
  try {
    // Инициализируем Supabase
    await initSupabase();
    
    // Проверяем авторизацию
    const isAuthenticated = await checkAuth();
    
    // Определяем текущую страницу
    const isLoginPage = window.location.pathname.endsWith('index.html');
    
    if (isAuthenticated && isLoginPage) {
      // Если авторизован и на странице входа - перенаправляем на main
      window.location.href = 'main.html';
      return;
    }
    
    if (!isAuthenticated && !isLoginPage) {
      // Если не авторизован и не на странице входа - перенаправляем на index
      redirectToLogin();
      return;
    }
    
    // Если логика перенаправления не сработала, продолжаем инициализацию
    if (isAuthenticated) {
      await initCart();
      setupEventListeners();
      updateAuthUI();
    }
    
    // Для страницы входа показываем модальное окно
    if (isLoginPage) {
      showAuthModal();
    }
  } catch (error) {
    console.error('App initialization error:', error);
    if (!window.location.pathname.endsWith('index.html')) {
      redirectToLogin();
    }
  }
}

// Показ модального окна авторизации (для index.html)
function showAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.add('show');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
  }
}

// Инициализация корзины
async function initCart() {
  if (!currentUser || !supabase) return;

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
    throw error;
  }
}

// Обновление интерфейса
function updateAuthUI() {
  try {
    const loginBtn = document.getElementById('loginBtn');
    const cartBtn = document.getElementById('cartBtn');
    
    if (currentUser) {
      if (loginBtn) loginBtn.textContent = 'Мой профиль';
      if (cartBtn) cartBtn.style.display = 'flex';
    }
  } catch (error) {
    console.error('Ошибка обновления интерфейса:', error);
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  try {
    // Кнопка корзины
    document.getElementById('cartBtn')?.addEventListener('click', async () => {
      try {
        document.getElementById('cartModal')?.classList.add('show');
        await updateCartDisplay();
      } catch (error) {
        console.error('Ошибка открытия корзины:', error);
      }
    });

    // Закрытие корзины
    document.querySelector('.close-cart')?.addEventListener('click', () => {
      document.getElementById('cartModal')?.classList.remove('show');
    });

    // Клик по фону модального окна
    document.getElementById('cartModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('cartModal')) {
        document.getElementById('cartModal')?.classList.remove('show');
      }
    });

    // Кнопка оформления заказа
    document.getElementById('checkoutBtn')?.addEventListener('click', handleCheckout);
  } catch (error) {
    console.error('Ошибка настройки обработчиков:', error);
  }
}

// Добавление товара в корзину
window.addToCart = async function(productName, productPrice, button) {
  try {
    if (!currentUser) {
      alert('Для добавления товаров в корзину войдите в систему');
      redirectToLogin();
      return;
    }

    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    if (!cartId) await initCart();
    
    // Находим ID продукта по имени
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('name', productName)
      .single();

    if (productError || !product) throw productError || new Error('Товар не найден');

    // Проверяем, есть ли уже такой товар в корзине
    const { data: existingItem, error: itemError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (itemError) throw itemError;

    // Обновляем или добавляем товар
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

    // Обновляем UI
    if (button) {
      button.textContent = 'Добавлено!';
      setTimeout(() => {
        button.textContent = 'Добавить';
      }, 2000);
    }
    
    await updateCartDisplay();
  } catch (error) {
    console.error('Ошибка при добавлении в корзину:', error);
    alert('Ошибка при добавлении в корзину: ' + error.message);
  }
};

// Обновление отображения корзины
async function updateCartDisplay() {
  if (!cartId || !supabase) return;
  
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
    
    if (!cartItemsContainer || !cartTotal || !cartCount) return;
    
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
window.updateQuantity = async function(itemId, newQuantity) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    if (newQuantity < 1) {
      await removeFromCart(itemId);
      return;
    }
    
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', itemId);
    
    if (error) throw error;
    
    await updateCartDisplay();
  } catch (error) {
    console.error('Ошибка при обновлении количества:', error);
    alert('Ошибка при обновлении количества: ' + error.message);
  }
};

// Удаление товара из корзины
window.removeFromCart = async function(itemId) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    await updateCartDisplay();
  } catch (error) {
    console.error('Ошибка при удалении товара:', error);
    alert('Ошибка при удалении товара: ' + error.message);
  }
};

// Оформление заказа
async function handleCheckout() {
  try {
    if (!currentUser || !supabase) {
      alert('Для оформления заказа войдите в систему');
      redirectToLogin();
      return;
    }

    const address = prompt('Введите адрес доставки:');
    if (!address) return;
    
    const phone = prompt('Введите ваш телефон:');
    if (!phone) return;
    
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

    // Добавляем товары в заказ
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
    
    // Обновляем состояние
    cartId = null;
    await initCart();
    await updateCartDisplay();
    document.getElementById('cartModal')?.classList.remove('show');

    alert(`Заказ #${order.id} успешно оформлен! Сумма: ${total}₽`);
  } catch (err) {
    console.error('Ошибка при оформлении заказа:', err);
    alert('Ошибка при оформлении заказа: ' + err.message);
  }
}

// Основная функция инициализации приложения
async function initApp() {
  try {
    // Инициализируем Supabase
    initSupabase();
    
    // Проверяем авторизацию
    const isAuthenticated = await checkAuth();
    
    // Если пользователь авторизован, продолжаем инициализацию
    if (isAuthenticated) {
      await initCart();
      setupEventListeners();
      updateAuthUI();
    }
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    redirectToLogin();
  }
}

// Запускаем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', initApp);
// Глобальные функции
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;