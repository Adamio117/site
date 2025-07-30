// Проверка загрузки Supabase
if (typeof supabase === 'undefined') {
  const errorMsg = 'Supabase не загружен! Добавьте: <script src="https://unpkg.com/@supabase/supabase-js@^2"></script>';
  console.error(errorMsg);
  document.body.innerHTML = `<div style="color:red;padding:20px;">${errorMsg}</div>`;
  throw new Error(errorMsg);
}

// Инициализация Supabase
const SUPABASE_URL = 'https://my-website-cjed.onrender.com';
const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Глобальные переменные
let currentUser = null;
let cartId = null;

// Делаем функции глобальными
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

// Основная функция инициализации
async function initApp() {
  // Проверяем авторизацию
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Инициализируем корзину
  await initCart();
  
  // Настраиваем интерфейс
  updateAuthUI();
  setupEventListeners();
}

// Проверка авторизации
async function checkAuth() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Ошибка проверки авторизации:', error);
      redirectToLogin();
      return false;
    }
    
    if (!user) {
      redirectToLogin();
      return false;
    }
    
    currentUser = user;
    return true;
    
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    redirectToLogin();
    return false;
  }
}

function redirectToLogin() {
  // Проверяем, не находимся ли уже на странице входа
  if (!window.location.pathname.endsWith('index.html')) {
    window.location.href = 'index.html';
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  const loginBtn = document.getElementById('loginBtn');
  const cartBtn = document.getElementById('cartBtn');
  const cartModal = document.getElementById('cartModal');
  const closeCart = document.querySelector('.close-cart');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (cartBtn) {
    cartBtn.addEventListener('click', async () => {
      cartModal.classList.add('show');
      await updateCartDisplay();
    });
  }

  if (closeCart) {
    closeCart.addEventListener('click', () => {
      cartModal.classList.remove('show');
    });
  }

  if (cartModal) {
    cartModal.addEventListener('click', (e) => {
      if (e.target === cartModal) {
        cartModal.classList.remove('show');
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
}

// Обновление UI после авторизации
function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const cartBtn = document.getElementById('cartBtn');
  
  if (currentUser && loginBtn && cartBtn) {
    loginBtn.textContent = 'Мой профиль';
    cartBtn.style.display = 'flex';
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
    return;
  }

  if (!cartId) await initCart();
  
  try {
    // 1. Находим ID продукта по имени
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('name', productName)
      .single();

    if (productError || !product) throw productError || new Error('Товар не найден');

    // 2. Проверяем, есть ли уже такой товар в корзине
    const { data: existingItem, error: itemError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (itemError) throw itemError;

    // 3. Обновляем или добавляем товар
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

    // 4. Обновляем UI
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
    console.error('Ошибка при обновлении количества:', error);
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
    console.error('Ошибка при удалении товара:', error);
    alert('Ошибка при удалении товара: ' + error.message);
  }
}

// Оформление заказа
async function handleCheckout() {
  if (!currentUser) {
    alert('Для оформления заказа войдите в систему');
    window.location.href = 'index.html';
    return;
  }

  const address = prompt('Введите адрес доставки:');
  if (!address) return;
  
  const phone = prompt('Введите ваш телефон:');
  if (!phone) return;
  
  try {
    // 1. Получаем товары из корзины
    const { data: cartItems, error: itemsError } = await supabase
      .from('cart_items')
      .select('product_id, quantity, price, products(name)')
      .eq('cart_id', cartId);
    
    if (itemsError) throw itemsError;

    if (!cartItems || cartItems.length === 0) {
      alert('Корзина пуста');
      return;
    }

    // 2. Рассчитываем общую сумму
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 3. Создаем заказ
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

    // 4. Добавляем товары в заказ
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

    // 5. Очищаем корзину
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);
    
    await supabase
      .from('cart_sessions')
      .delete()
      .eq('id', cartId);
    
    // 6. Обновляем состояние
    cartId = null;
    await initCart();
    await updateCartDisplay();
    document.getElementById('cartModal').classList.remove('show');

    alert(`Заказ #${order.id} успешно оформлен! Сумма: ${total}₽`);
  } catch (err) {
    console.error('Ошибка при оформлении заказа:', err);
    alert('Ошибка при оформлении заказа: ' + err.message);
  }
}

// Запускаем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', initApp);