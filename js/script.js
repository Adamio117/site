// Используем IIFE для изоляции кода и предотвращения загрязнения глобальной области видимости
(function() {
  // Локальные переменные приложения
  const app = {
    supabase: null,
    currentUser: null,
    cartId: null,
    
    // Инициализация приложения
    async init() {
      try {
        await this.initSupabase();
        await this.checkAuth();
        
        // Управление маршрутизацией
        this.handleRouting();
        
        // Инициализация для авторизованных пользователей
        if (this.currentUser) {
          await this.initCart();
          this.setupEventListeners();
        }
        
        // Показ модального окна для страницы входа
        if (this.isLoginPage()) {
          this.showAuthModal();
        }
        
      } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        this.showError('Произошла ошибка при загрузке приложения', false);
      }
    },
    
    // Проверка текущей страницы
    isLoginPage() {
      return window.location.pathname.endsWith('index.html');
    },
    
    // Управление маршрутизацией
    handleRouting() {
      if (this.currentUser && this.isLoginPage()) {
        this.redirectTo('main.html');
      } else if (!this.currentUser && !this.isLoginPage()) {
        this.redirectTo('index.html');
      }
    },
    
    // Универсальная функция перенаправления
    redirectTo(page) {
      if (!window.location.pathname.endsWith(page)) {
        window.location.href = page;
      }
    },
    
    // Загрузка Supabase SDK
    async loadSupabaseSDK() {
      return new Promise((resolve, reject) => {
        if (window.supabase || window.supabaseClient) {
          return resolve();
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@^2';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Не удалось загрузить Supabase SDK'));
        document.head.appendChild(script);
      });
    },
    
    // Инициализация Supabase
    async initSupabase() {
      try {
        await this.loadSupabaseSDK();
        
        const SUPABASE_URL = 'https://my-website-cjed.onrender.com';
        const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';
        
        if (window.supabase) {
          this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true }
          });
        } else {
          throw new Error('Supabase SDK не загружен');
        }
        
        console.log('Supabase успешно инициализирован');
      } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
        throw error;
      }
    },
    
    // Проверка авторизации
    async checkAuth() {
      try {
        if (!this.supabase) throw new Error('Supabase не инициализирован');
        
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        
        this.currentUser = user;
        this.updateAuthUI();
        return !!user;
      } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        this.currentUser = null;
        return false;
      }
    },
    
    // Показ сообщения об ошибке
    showError(message, isFatal = false) {
      // Удаляем старые сообщения
      const oldError = document.getElementById('app-error');
      if (oldError) oldError.remove();

      const errorDiv = document.createElement('div');
      errorDiv.id = 'app-error';
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `
        <div class="error-content">
          <strong>${message}</strong>
          <button class="reload-btn">Обновить страницу</button>
          ${isFatal ? '' : '<div class="error-note">Система продолжит работу, но некоторые функции могут быть недоступны</div>'}
        </div>
      `;
      
      // Добавляем обработчик для кнопки
      errorDiv.querySelector('.reload-btn').addEventListener('click', () => location.reload());
      
      document.body.prepend(errorDiv);
    },
    
    // Инициализация корзины
    async initCart() {
      if (!this.currentUser || !this.supabase) return;

      try {
        // Проверяем существующую активную корзину
        const { data, error } = await this.supabase
          .from('cart_sessions')
          .select('id')
          .eq('user_id', this.currentUser.id)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (error) throw error;

        this.cartId = data?.id || null;
        
        // Создаем новую корзину, если нет активной
        if (!this.cartId) {
          const { data: newCart, error: cartError } = await this.supabase
            .from('cart_sessions')
            .insert({ user_id: this.currentUser.id })
            .select()
            .single();
          
          if (cartError) throw cartError;
          this.cartId = newCart.id;
        }
      } catch (error) {
        console.error('Ошибка инициализации корзины:', error);
        throw error;
      }
    },
    
    // Выход из системы
    async signOut() {
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
    updateAuthUI() {
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
    setupEventListeners() {
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
    setupModalCloseHandlers() {
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
    async addToCart(productName, productPrice, button) {
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
    async updateCartDisplay() {
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
    setupCartItemHandlers() {
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
    async updateQuantity(itemId, newQuantity) {
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
    async removeFromCart(itemId) {
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
    async handleCheckout() {
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
    async clearCart() {
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
    showAuthModal() {
      const authModal = document.getElementById('authModal');
      if (authModal) {
        authModal.classList.add('show');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
      }
    }
  };

  // Делаем методы доступными глобально, если необходимо
  window.addToCart = (productName, productPrice, button) => app.addToCart(productName, productPrice, button);

  // Запуск приложения
  if (document.readyState === 'complete') {
    app.init();
  } else {
    document.addEventListener('DOMContentLoaded', () => app.init());
  }
})();