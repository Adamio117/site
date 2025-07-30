// Используем IIFE для изоляции кода
(function() {
  'use strict';

  const app = {
    supabase: null,
    currentUser: null,
    cartId: null,
    isInitialized: false,
    retryCount: 0,
    maxRetries: 3,
    
    // Основная функция инициализации
    init: async function() {
      try {
        if (this.isInitialized) return;
        console.log('[Init] Начало инициализации приложения');

        // 1. Инициализация Supabase
        await this.retryOperation(this.initSupabase.bind(this), 'Supabase');
        
        // 2. Проверка аутентификации
        await this.retryOperation(this.checkAuth.bind(this), 'Auth Check');
        
        // 3. Маршрутизация
        await this.handleRouting();
        
        // 4. Инициализация для авторизованных пользователей
        if (this.currentUser) {
          await this.retryOperation(this.initCart.bind(this), 'Cart Init');
          this.setupEventListeners();
          this.updateAuthUI();
        }

        this.isInitialized = true;
        console.log('[Init] Приложение успешно инициализировано');
      } catch (error) {
        console.error('[Init] Критическая ошибка инициализации:', error);
        this.showError('Системная ошибка. Пожалуйста, обновите страницу.', true);
      }
    },
    // Повторная попытка выполнения операции
    retryOperation: async function(operation, operationName) {
      try {
        let lastError;
        for (let i = 0; i < this.maxRetries; i++) {
          try {
            console.log(`[Retry] Попытка ${i+1} для ${operationName}`);
            return await operation();
          } catch (error) {
            lastError = error;
            console.warn(`[Retry] Ошибка в ${operationName}:`, error);
            if (i < this.maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        }
        throw lastError;
      } catch (error) {
        console.error(`[Retry] Все попытки для ${operationName} исчерпаны`);
        throw error;
      }
    },


    // Маршрутизация
    handleRouting: async function() {
      console.log('[Routing] Проверка маршрутизации');
      const isLoginPage = this.isLoginPage();
      
      if (isLoginPage && this.currentUser) {
        console.log('[Routing] Перенаправление авторизованного пользователя на main.html');
        this.redirectTo('main.html');
        return;
      }
      
      if (!isLoginPage && !this.currentUser) {
        console.log('[Routing] Перенаправление неавторизованного пользователя на index.html');
        this.redirectTo('index.html');
        return;
      }
      
      if (isLoginPage && !this.currentUser) {
        console.log('[Routing] Показ модального окна авторизации');
        this.showAuthModal();
      }
    },

    // Проверка текущей страницы
    isLoginPage: function() {
      const path = window.location.pathname.toLowerCase();
      return path.endsWith('index.html') || path === '/' || path === '/index.html';
    },
    
    // Перенаправление
    redirectTo: function(page) {
      if (window.location.pathname.endsWith(page)) {
        console.warn(`[Redirect] Уже на странице ${page}, перенаправление отменено`);
        return;
      }
      console.log(`[Redirect] Перенаправление на ${page}`);
      window.location.href = page;
    },

    // Инициализация Supabase
    initSupabase: async function() {
      try {
        console.log('[Supabase] Начало инициализации');
        
        // Проверяем, загружен ли Supabase
        if (typeof supabase === 'undefined') {
          console.log('[Supabase] SDK не загружен, начинаем загрузку');
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@supabase/supabase-js@^2';
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Не удалось загрузить Supabase SDK'));
            document.head.appendChild(script);
          });
        }
        
        const SUPABASE_URL = 'https://pgnzjtnzagxrygxzfipu.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';
        
        this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
        
        // Тестовый запрос для проверки подключения
        const { error } = await this.supabase.auth.getUser();
        if (error) throw error;
        
        console.log('[Supabase] Успешно инициализирован');
      } catch (error) {
        console.error('[Supabase] Ошибка инициализации:', error);
        throw new Error('Ошибка подключения к Supabase');
      }
    },
    // Проверка авторизации
    checkAuth: async function() {
      try {
        console.log('[Auth] Проверка авторизации');
        if (!this.supabase) throw new Error('Supabase не инициализирован');
        
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        
        this.currentUser = user;
        console.log(`[Auth] Пользователь ${user ? 'авторизован' : 'не авторизован'}`);
        return !!user;
      } catch (error) {
        console.error('[Auth] Ошибка проверки авторизации:', error);
        this.currentUser = null;
        throw new Error('Ошибка проверки авторизации');
      }
    },

    
    // Инициализация корзины
    initCart: async function() {
      try {
        console.log('[Cart] Инициализация корзины');
        if (!this.currentUser || !this.supabase) {
          throw new Error('Нет данных пользователя или Supabase');
        }

        // 1. Поиск существующей корзины
        const { data, error } = await this.supabase
          .from('cart_sessions')
          .select('id')
          .eq('user_id', this.currentUser.id)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (error) throw error;

        this.cartId = data?.id || null;
        
        // 2. Создание новой корзины при необходимости
        if (!this.cartId) {
          console.log('[Cart] Создание новой корзины');
          const { data: newCart, error: cartError } = await this.supabase
            .from('cart_sessions')
            .insert({ user_id: this.currentUser.id })
            .select()
            .single();
          
          if (cartError) throw cartError;
          this.cartId = newCart.id;
        }
        
        console.log(`[Cart] Корзина инициализирована, ID: ${this.cartId}`);
      } catch (error) {
        console.error('[Cart] Ошибка инициализации корзины:', error);
        throw new Error('Ошибка инициализации корзины');
      }
    },
        // Показ сообщения об ошибке
    showError: function(message, isFatal = false) {
      console.error(`[Error] ${message}`);
      const oldError = document.getElementById('app-error');
      if (oldError) oldError.remove();

      const errorDiv = document.createElement('div');
      errorDiv.id = 'app-error';
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `
        <div class="error-content">
          <strong>${message}</strong>
          <button class="reload-btn">Обновить страницу</button>
          ${isFatal ? '' : '<div class="error-note">Некоторые функции могут быть недоступны</div>'}
        </div>
      `;
      
      errorDiv.querySelector('.reload-btn').addEventListener('click', () => {
        location.reload();
      });
      
      document.body.prepend(errorDiv);
    },
    // Выход из системы
    signOut: async function() {
      try {
        if (!this.supabase) throw new Error('Supabase не инициализирован');
        
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
        
        this.currentUser = null;
        this.cartId = null;
        this.redirectTo('index.html');
      } catch (error) {
        console.error('Ошибка выхода:', error);
        this.showError('Ошибка при выходе из системы', false);
      }
    },
    
    // Обновление UI
    updateAuthUI: function() {
      const elements = {
        loginBtn: document.getElementById('loginBtn'),
        cartBtn: document.getElementById('cartBtn'),
        logoutBtn: document.getElementById('logoutBtn')
      };
      
      if (!elements.loginBtn || !elements.cartBtn || !elements.logoutBtn) return;
      
      if (this.currentUser) {
        elements.loginBtn.textContent = this.currentUser.email || 'Мой профиль';
        elements.cartBtn.style.display = 'flex';
        elements.logoutBtn.style.display = 'block';
      } else {
        elements.loginBtn.textContent = 'Вход';
        elements.cartBtn.style.display = 'none';
        elements.logoutBtn.style.display = 'none';
      }
    },
    
    // Настройка обработчиков событий
    setupEventListeners: function() {
      // Выход из системы
      document.getElementById('logoutBtn')?.addEventListener('click', () => this.signOut());
      
      // Корзина
      document.getElementById('cartBtn')?.addEventListener('click', async () => {
        try {
          document.getElementById('cartModal')?.classList.add('show');
          await this.updateCartDisplay();
        } catch (error) {
          console.error('Ошибка открытия корзины:', error);
          this.showError('Не удалось открыть корзину', false);
        }
      });

      // Закрытие модальных окон
      this.setupModalCloseHandlers();
    },
    
    // Обработчики закрытия модальных окон
    setupModalCloseHandlers: function() {
      // Корзина
      document.querySelector('.close-cart')?.addEventListener('click', () => {
        document.getElementById('cartModal')?.classList.remove('show');
      });

      document.getElementById('cartModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('cartModal')) {
          document.getElementById('cartModal')?.classList.remove('show');
        }
      });

      // Оформление заказа
      document.getElementById('checkoutBtn')?.addEventListener('click', () => this.handleCheckout());
    },
    
    // Добавление товара в корзину
    addToCart: async function(productName, productPrice, button) {
      try {
        if (!this.currentUser) {
          this.showError('Для добавления товаров в корзину войдите в систему', false);
          this.redirectTo('index.html');
          return;
        }

        if (!this.supabase) throw new Error('Supabase не инициализирован');
        if (!this.cartId) await this.initCart();
        
        // Находим ID продукта
        const { data: product, error: productError } = await this.supabase
          .from('products')
          .select('id')
          .eq('name', productName)
          .single();

        if (productError || !product) throw productError || new Error('Товар не найден');

        // Проверяем наличие товара в корзине
        const { data: existingItem, error: itemError } = await this.supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', this.cartId)
          .eq('product_id', product.id)
          .maybeSingle();

        if (itemError) throw itemError;

        // Обновляем или добавляем товар
        if (existingItem) {
          const { error: updateError } = await this.supabase
            .from('cart_items')
            .update({ quantity: existingItem.quantity + 1 })
            .eq('id', existingItem.id);
          
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await this.supabase
            .from('cart_items')
            .insert({
              cart_id: this.cartId,
              product_id: product.id,
              price: productPrice,
              quantity: 1
            });
          
          if (insertError) throw insertError;
        }

        // Обновляем UI кнопки
        if (button) {
          button.textContent = 'Добавлено!';
          setTimeout(() => {
            button.textContent = 'Добавить';
          }, 2000);
        }
        
        await this.updateCartDisplay();
      } catch (error) {
        console.error('Ошибка при добавлении в корзину:', error);
        this.showError('Ошибка при добавлении в корзину: ' + error.message, false);
      }
    },
    
    // Обновление отображения корзины
    updateCartDisplay: async function() {
      if (!this.cartId || !this.supabase) return;
      
      try {
        const { data: items, error } = await this.supabase
          .from('cart_items')
          .select(`
            id,
            quantity,
            price,
            products (name)
          `)
          .eq('cart_id', this.cartId);
        
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
                <button class="quantity-btn minus" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn plus" data-id="${item.id}">+</button>
              </div>
              <div class="cart-item-total">${itemTotal} ₽</div>
              <button class="remove-item" data-id="${item.id}">×</button>
            `;
            cartItemsContainer.appendChild(itemElement);
          });
          
          // Добавляем обработчики для динамически созданных элементов
          this.setupCartItemHandlers();
        } else {
          cartItemsContainer.innerHTML = '<p class="empty-cart-message">Корзина пуста</p>';
        }
        
        cartTotal.textContent = total;
        cartCount.textContent = totalCount;
      } catch (error) {
        console.error('Ошибка обновления корзины:', error);
        this.showError('Не удалось обновить корзину', false);
      }
    },
    
    // Обработчики для элементов корзины
    setupCartItemHandlers: function() {
      document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.dataset.id;
          const quantityElement = e.target.nextElementSibling;
          const newQuantity = parseInt(quantityElement.textContent) - 1;
          
          await this.updateQuantity(itemId, newQuantity);
        });
      });
      
      document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.dataset.id;
          const quantityElement = e.target.previousElementSibling;
          const newQuantity = parseInt(quantityElement.textContent) + 1;
          
          await this.updateQuantity(itemId, newQuantity);
        });
      });
      
      document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.dataset.id;
          await this.removeFromCart(itemId);
        });
      });
    },
    
    // Обновление количества товара
    updateQuantity: async function(itemId, newQuantity) {
      try {
        if (!this.supabase) throw new Error('Supabase не инициализирован');

        if (newQuantity < 1) {
          await this.removeFromCart(itemId);
          return;
        }
        
        const { error } = await this.supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', itemId);
        
        if (error) throw error;
        
        await this.updateCartDisplay();
      } catch (error) {
        console.error('Ошибка при обновлении количества:', error);
        this.showError('Ошибка при обновлении количества товара', false);
      }
    },
    
    // Удаление товара из корзины
    removeFromCart: async function(itemId) {
      try {
        if (!this.supabase) throw new Error('Supabase не инициализирован');

        const { error } = await this.supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId);
        
        if (error) throw error;
        
        await this.updateCartDisplay();
      } catch (error) {
        console.error('Ошибка при удалении товара:', error);
        this.showError('Ошибка при удалении товара из корзины', false);
      }
    },
    
    // Оформление заказа
    handleCheckout: async function() {
      try {
        if (!this.currentUser || !this.supabase) {
          this.showError('Для оформления заказа войдите в систему', false);
          this.redirectTo('index.html');
          return;
        }

        // Запрос данных пользователя
        const address = prompt('Введите адрес доставки:');
        if (!address) return;
        
        const phone = prompt('Введите ваш телефон:');
        if (!phone) return;
        
        // Получаем товары из корзины
        const { data: cartItems, error: itemsError } = await this.supabase
          .from('cart_items')
          .select('product_id, quantity, price, products(name)')
          .eq('cart_id', this.cartId);
        
        if (itemsError) throw itemsError;

        if (!cartItems || cartItems.length === 0) {
          this.showError('Корзина пуста', false);
          return;
        }

        // Рассчитываем общую сумму
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Создаем заказ
        const { data: order, error: orderError } = await this.supabase
          .from('orders')
          .insert({
            user_id: this.currentUser.id,
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

        const { error: itemsInsertError } = await this.supabase
          .from('order_items')
          .insert(orderItems);
        
        if (itemsInsertError) throw itemsInsertError;

        // Очищаем корзину
        await this.clearCart();
        
        // Закрываем модальное окно корзины
        document.getElementById('cartModal')?.classList.remove('show');
        
        // Показываем уведомление об успешном оформлении
        alert(`Заказ #${order.id} успешно оформлен! Сумма: ${total}₽`);
      } catch (error) {
        console.error('Ошибка при оформлении заказа:', error);
        this.showError('Ошибка при оформлении заказа: ' + error.message, false);
      }
    },
    
    // Очистка корзины
    clearCart: async function() {
      try {
        await this.supabase
          .from('cart_items')
          .delete()
          .eq('cart_id', this.cartId);
        
        await this.supabase
          .from('cart_sessions')
          .delete()
          .eq('id', this.cartId);
        
        this.cartId = null;
        await this.initCart();
        await this.updateCartDisplay();
      } catch (error) {
        console.error('Ошибка при очистке корзины:', error);
        throw error;
      }
    },
    
    // Показ модального окна авторизации
    showAuthModal: function() {
      const authModal = document.getElementById('authModal');
      if (authModal) {
        authModal.classList.add('show');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
      }
    }
  };

  // Глобальные методы
  window.addToCart = function(productName, productPrice, button) {
    app.addToCart(productName, productPrice, button);
  };
  // Запуск приложения с обработкой ошибок
  try {
    if (document.readyState === 'complete') {
      app.init();
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        app.init();
      });
    }
  } catch (error) {
    console.error('Фатальная ошибка при запуске:', error);
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="padding: 20px; background: #ffebee; color: #c62828; text-align: center;">
        <h3>Критическая ошибка приложения</h3>
        <p>Пожалуйста, обновите страницу или попробуйте позже</p>
        <button onclick="location.reload()" style="
          background: #c62828; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;
        ">Обновить страницу</button>
      </div>
    `;
    document.body.prepend(errorDiv);
  }
})();