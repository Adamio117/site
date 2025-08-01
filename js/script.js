// script.js
(function () {
  "use strict";

  const app = {
    supabase: null,
    currentUser: null,
    cartId: null,
    isInitialized: false,
    retryCount: 0,
    maxRetries: 3,

    // Основная функция инициализации
    init: async function () {
      try {
        if (this.isInitialized) return;
        console.log("[Init] Начало инициализации приложения");

        // 1. Инициализация Supabase
        await this.retryOperation(this.initSupabase.bind(this), "Supabase");

        // 2. Проверка аутентификации (не критично для работы)
        try {
          await this.checkAuth();
        } catch (authError) {
          console.warn(
            "[Init] Ошибка проверки авторизации (не критично):",
            authError
          );
        }

        // 3. Маршрутизация
        await this.handleRouting();

        // 4. Инициализация UI
        this.setupEventListeners();
        this.updateAuthUI();

        this.isInitialized = true;
      } catch (error) {
        console.error("[Init] Критическая ошибка инициализации:", error);
        this.showError(
          "Системная ошибка. Пожалуйста, обновите страницу.",
          true
        );
      }
    },

    // Повторная попытка выполнения операции
    retryOperation: async function (operation, operationName) {
      try {
        let lastError;
        for (let i = 0; i < this.maxRetries; i++) {
          try {
            console.log(`[Retry] Попытка ${i + 1} для ${operationName}`);
            return await operation();
          } catch (error) {
            lastError = error;
            console.warn(`[Retry] Ошибка в ${operationName}:`, error);
            if (i < this.maxRetries - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (i + 1))
              );
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
    handleRouting: async function () {
      const currentPath = window.location.pathname;
      const isLoginPage =
        currentPath.endsWith("index.html") || currentPath === "/";

      if (isLoginPage && this.currentUser) {
        this.redirectTo("main.html");
      } else if (!isLoginPage && !this.currentUser) {
        this.redirectTo("index.html");
      }

      // Показываем модальное окно только на главной странице
      if (isLoginPage) {
        this.showAuthModal();
      }
    },

    // Проверка текущей страницы
    isLoginPage: function () {
      const path = window.location.pathname.toLowerCase();
      return (
        path.endsWith("index.html") || path === "/" || path === "/index.html"
      );
    },

    // Перенаправление
    redirectTo: function (page) {
      if (window.location.pathname.endsWith(page)) {
        console.warn(
          `[Redirect] Уже на странице ${page}, перенаправление отменено`
        );
        return;
      }
      console.log(`[Redirect] Перенаправление на ${page}`);
      window.location.href = page;
    },

    // Инициализация Supabase
    initSupabase: async function () {
      if (this.supabase) {
        console.log("[Supabase] Клиент уже инициализирован");
        return this.supabase;
      }
      try {
        console.log("[Supabase] Начало инициализации");

        // Проверяем, загружен ли Supabase
        if (typeof supabase === "undefined") {
          console.log("[Supabase] SDK не загружен, начинаем загрузку");
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/@supabase/supabase-js@^2";
            script.async = true;
            script.onload = resolve;
            script.onerror = () =>
              reject(new Error("Не удалось загрузить Supabase SDK"));
            document.head.appendChild(script);
          });
        }

        const SUPABASE_URL = "https://pgnzjtnzagxrygxzfipu.supabase.co";
        const SUPABASE_KEY = "sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29";

        this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: window.localStorage,
          },
        });

        // Проверяем наличие сессии
        const {
          data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
          console.log(
            "[Supabase] Сессия не найдена, пользователь не авторизован"
          );
        } else {
          console.log("[Supabase] Сессия найдена");
        }

        console.log("[Supabase] Успешно инициализирован");
        return this.supabase;
      } catch (error) {
        console.error("[Supabase] Ошибка инициализации:", error);
        throw new Error("Ошибка подключения к Supabase: " + error.message);
      }
    },

    // Проверка авторизации
    checkAuth: async function () {
      if (!this.supabase) {
        console.log("[Auth] Supabase не доступен, пропускаем проверку");
        return false;
      }

      try {
        console.log("[Auth] Проверка авторизации");

        // Сначала получаем сессию
        const {
          data: { session },
          error: sessionError,
        } = await this.supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          console.log("[Auth] Сессия не найдена, пользователь не авторизован");
          this.currentUser = null;
          return false;
        }

        // Затем получаем пользователя
        const {
          data: { user },
          error: userError,
        } = await this.supabase.auth.getUser();
        if (userError) throw userError;

        this.currentUser = user;
        console.log(
          `[Auth] Пользователь ${user ? "авторизован" : "не авторизован"}`
        );
        return !!user;
      } catch (error) {
        console.error("[Auth] Ошибка проверки авторизации:", error);
        this.currentUser = null;
        return false; // Возвращаем false вместо выброса ошибки
      }
    },

    // Инициализация корзины
    initCart: async function () {
      try {
        console.log("[Cart] Инициализация корзины");
        if (!this.currentUser || !this.supabase) {
          throw new Error("Нет данных пользователя или Supabase");
        }

        // Поиск существующей корзины
        const { data, error } = await this.supabase
          .from("cart_sessions")
          .select("id")
          .eq("user_id", this.currentUser.id)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (error) throw error;

        this.cartId = data?.id || null;

        // Создание новой корзины при необходимости
        if (!this.cartId) {
          console.log("[Cart] Создание новой корзины");
          const { data: newCart, error: cartError } = await this.supabase
            .from("cart_sessions")
            .insert({ user_id: this.currentUser.id })
            .select()
            .single();

          if (cartError) throw cartError;
          this.cartId = newCart.id;
        }

        console.log(`[Cart] Корзина инициализирована, ID: ${this.cartId}`);
      } catch (error) {
        console.error("[Cart] Ошибка инициализации корзины:", error);
        throw new Error("Ошибка инициализации корзины");
      }
    },
    /*
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
    },*/

    // Выход из системы
    signOut: async function () {
      try {
        if (!this.supabase) throw new Error("Supabase не инициализирован");

        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;

        this.currentUser = null;
        this.cartId = null;
        this.redirectTo("index.html");
      } catch (error) {
        console.error("Ошибка выхода:", error);
        this.showError("Ошибка при выходе из системы", false);
      }
    },

    // Обновление UI
    updateAuthUI: function () {
      const elements = {
        loginBtn: document.getElementById("loginBtn"),
        cartBtn: document.getElementById("cartBtn"),
        logoutBtn: document.getElementById("logoutBtn"),
      };

      if (!elements.loginBtn || !elements.cartBtn || !elements.logoutBtn)
        return;

      if (this.currentUser) {
        elements.loginBtn.textContent = this.currentUser.email || "Мой профиль";
        elements.cartBtn.style.display = "flex";
        elements.logoutBtn.style.display = "block";
      } else {
        elements.loginBtn.textContent = "Вход";
        elements.cartBtn.style.display = "none";
        elements.logoutBtn.style.display = "none";
      }
    },

    // Настройка обработчиков событий
    setupEventListeners: function () {
      try {
        //Кнопка Вход
        document.getElementById("loginBtn")?.addEventListener("click", (e) => {
          e.preventDefault();
          this.showAuthModal();
        });

        // 1. Обработчики форм авторизации
        const loginForm = document.getElementById("loginFormElement");
        if (loginForm) {
          loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector(
              'input[type="password"]'
            ).value;
            await this.handleLogin(email, password);
          });
        }

        const registerForm = document.getElementById("registerFormElement");
        if (registerForm) {
          registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector(
              'input[type="password"]'
            ).value;
            const name = e.target.querySelector('input[type="text"]').value;
            await this.handleRegister(email, password, name);
          });
        }

        // 2. Переключение между формами
        document
          .getElementById("showRegister")
          ?.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("loginForm").classList.remove("show");
            document.getElementById("registerForm").classList.add("show");
          });

        document.getElementById("showLogin")?.addEventListener("click", (e) => {
          e.preventDefault();
          document.getElementById("registerForm").classList.remove("show");
          document.getElementById("loginForm").classList.add("show");
        });

        // 3. Кнопка выхода
        document.getElementById("logoutBtn")?.addEventListener("click", () => {
          this.signOut();
        });

        // 4. Кнопка корзины
        document
          .getElementById("cartBtn")
          ?.addEventListener("click", async () => {
            try {
              if (!this.currentUser) {
                this.showAuthModal();
                return;
              }
              document.getElementById("cartModal").classList.add("show");
              await this.updateCartDisplay();
            } catch (error) {
              console.error("Ошибка открытия корзины:", error);
              this.showError("Не удалось открыть корзину", false);
            }
          });

        // 5. Обработчики закрытия модальных окон
        document.querySelector(".close-auth")?.addEventListener("click", () => {
          document.getElementById("authModal").classList.remove("show");
        });

        document.querySelector(".close-cart")?.addEventListener("click", () => {
          document.getElementById("cartModal").classList.remove("show");
        });

        // 6. Клик по фону модального окна
        document.getElementById("authModal")?.addEventListener("click", (e) => {
          if (e.target === document.getElementById("authModal")) {
            document.getElementById("authModal").classList.remove("show");
          }
        });

        document.getElementById("cartModal")?.addEventListener("click", (e) => {
          if (e.target === document.getElementById("cartModal")) {
            document.getElementById("cartModal").classList.remove("show");
          }
        });

        // 7. Обработчик для кнопки оформления заказа
        document
          .getElementById("checkoutBtn")
          ?.addEventListener("click", async () => {
            try {
              if (!this.currentUser) {
                this.showAuthModal();
                return;
              }
              await this.handleCheckout();
            } catch (error) {
              console.error("Ошибка при оформлении заказа:", error);
              this.showError("Ошибка при оформлении заказа", false);
            }
          });
      } catch (error) {
        console.error("Ошибка в setupEventListeners:", error);
        this.showError("Ошибка инициализации интерфейса", false);
      }
    },

    // Обработка входа
    handleLogin: async function (email, password) {
      try {
        if (!this.supabase) throw new Error("Сервис недоступен");

        const { data, error } = await this.supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        this.currentUser = data.user;
        await this.initCart();
        this.updateAuthUI();
        document.getElementById("authModal").classList.remove("show");
        this.redirectTo("main.html");
      } catch (error) {
        console.error("Ошибка входа:", error);
        const message =
          error.message.includes("email") || error.message.includes("password")
            ? "Неверный email или пароль"
            : "Ошибка при входе";
        this.showFormMessage("loginMessage", message, "error");
      }
    },
    // Обработка регистрации
    handleRegister: async function (email, password, name) {
      try {
        if (!this.supabase) throw new Error("Сервис недоступен");

        const { data, error } = await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });

        if (error) throw error;

        this.showFormMessage(
          "registerMessage",
          "Регистрация успешна! Проверьте почту для подтверждения.",
          "success"
        );
        document.getElementById("registerForm").style.display = "none";
        document.getElementById("loginForm").style.display = "block";

        // Очищаем форму регистрации
        document.getElementById("registerFormElement").reset();
      } catch (error) {
        console.error("Ошибка регистрации:", error);
        this.showFormMessage("registerMessage", error.message, "error");
      }
    },

    // Новый метод для отображения сообщений в формах
    showFormMessage: function (formId, message, type = "error") {
      const messageElement = document.getElementById(formId);
      if (!messageElement) return;

      messageElement.textContent = message;
      messageElement.className = `auth-message ${type}`;

      // Автоматическое скрытие через 5 секунд для успешных сообщений
      if (type === "success") {
        setTimeout(() => {
          messageElement.textContent = "";
          messageElement.className = "auth-message";
        }, 5000);
      }
    },

    // Добавление товара в корзину
    addToCart: async function (productName, productPrice, button) {
      try {
        if (!this.currentUser) {
          this.showAuthModal();
          throw new Error("Требуется авторизация");
        }
        if (!this.supabase) {
          throw new Error("Сервис временно недоступен");
        }

        if (!this.cartId) await this.initCart();

        // Находим ID продукта
        const { data: product, error: productError } = await this.supabase
          .from("products")
          .select("id")
          .eq("name", productName)
          .single();

        if (productError || !product)
          throw productError || new Error("Товар не найден");

        // Проверяем наличие товара в корзине
        const { data: existingItem, error: itemError } = await this.supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("cart_id", this.cartId)
          .eq("product_id", product.id)
          .maybeSingle();

        if (itemError) throw itemError;

        // Обновляем или добавляем товар
        if (existingItem) {
          const { error: updateError } = await this.supabase
            .from("cart_items")
            .update({ quantity: existingItem.quantity + 1 })
            .eq("id", existingItem.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await this.supabase
            .from("cart_items")
            .insert({
              cart_id: this.cartId,
              product_id: product.id,
              price: productPrice,
              quantity: 1,
            });

          if (insertError) throw insertError;
        }

        // Обновляем UI кнопки
        if (button) {
          button.textContent = "Добавлено!";
          setTimeout(() => {
            button.textContent = "Добавить";
          }, 2000);
        }

        await this.updateCartDisplay();
      } catch (error) {
        console.error("Ошибка добавления в корзину:", error);
        this.showError(error.message, false);
      }
    },

    // Обновление отображения корзины
    updateCartDisplay: async function () {
      if (!this.cartId || !this.supabase) return;

      try {
        const { data: items, error } = await this.supabase
          .from("cart_items")
          .select(
            `
            id,
            quantity,
            price,
            products (name)
          `
          )
          .eq("cart_id", this.cartId);

        if (error) throw error;

        const cartItemsContainer = document.getElementById("cartItems");
        const cartTotal = document.getElementById("cartTotal");
        const cartCount = document.getElementById("cartCount");

        if (!cartItemsContainer || !cartTotal || !cartCount) return;

        cartItemsContainer.innerHTML = "";
        let total = 0;
        let totalCount = 0;

        if (items && items.length > 0) {
          items.forEach((item) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            totalCount += item.quantity;

            const itemElement = document.createElement("div");
            itemElement.className = "cart-item";
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
          cartItemsContainer.innerHTML =
            '<p class="empty-cart-message">Корзина пуста</p>';
        }

        cartTotal.textContent = total;
        cartCount.textContent = totalCount;
      } catch (error) {
        console.error("Ошибка обновления корзины:", error);
        this.showError("Не удалось обновить корзину", false);
      }
    },

    // Обработчики для элементов корзины
    setupCartItemHandlers: function () {
      document.querySelectorAll(".quantity-btn.minus").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const itemId = e.target.dataset.id;
          const quantityElement = e.target.nextElementSibling;
          const newQuantity = parseInt(quantityElement.textContent) - 1;

          await this.updateQuantity(itemId, newQuantity);
        });
      });

      document.querySelectorAll(".quantity-btn.plus").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const itemId = e.target.dataset.id;
          const quantityElement = e.target.previousElementSibling;
          const newQuantity = parseInt(quantityElement.textContent) + 1;

          await this.updateQuantity(itemId, newQuantity);
        });
      });

      document.querySelectorAll(".remove-item").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const itemId = e.target.dataset.id;
          await this.removeFromCart(itemId);
        });
      });
    },

    // Обновление количества товара
    updateQuantity: async function (itemId, newQuantity) {
      try {
        if (!this.supabase) throw new Error("Supabase не инициализирован");

        if (newQuantity < 1) {
          await this.removeFromCart(itemId);
          return;
        }

        const { error } = await this.supabase
          .from("cart_items")
          .update({ quantity: newQuantity })
          .eq("id", itemId);

        if (error) throw error;

        await this.updateCartDisplay();
      } catch (error) {
        console.error("Ошибка при обновлении количества:", error);
        this.showError("Ошибка при обновлении количества товара", false);
      }
    },

    // Удаление товара из корзины
    removeFromCart: async function (itemId) {
      try {
        if (!this.supabase) throw new Error("Supabase не инициализирован");

        const { error } = await this.supabase
          .from("cart_items")
          .delete()
          .eq("id", itemId);

        if (error) throw error;

        await this.updateCartDisplay();
      } catch (error) {
        console.error("Ошибка при удалении товара:", error);
        this.showError("Ошибка при удалении товара из корзины", false);
      }
    },

    // Оформление заказа
    handleCheckout: async function () {
      try {
        if (!this.currentUser || !this.supabase) {
          this.showError("Для оформления заказа войдите в систему", false);
          this.redirectTo("index.html");
          return;
        }

        // Запрос данных пользователя
        const address = prompt("Введите адрес доставки:");
        if (!address) return;

        const phone = prompt("Введите ваш телефон:");
        if (!phone) return;

        // Получаем товары из корзины
        const { data: cartItems, error: itemsError } = await this.supabase
          .from("cart_items")
          .select("product_id, quantity, price, products(name)")
          .eq("cart_id", this.cartId);

        if (itemsError) throw itemsError;

        if (!cartItems || cartItems.length === 0) {
          this.showError("Корзина пуста", false);
          return;
        }

        // Рассчитываем общую сумму
        const total = cartItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        // Создаем заказ
        const { data: order, error: orderError } = await this.supabase
          .from("orders")
          .insert({
            user_id: this.currentUser.id,
            total,
            delivery_address: address,
            phone,
            status: "processing",
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Добавляем товары в заказ
        const orderItems = cartItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        }));

        const { error: itemsInsertError } = await this.supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsInsertError) throw itemsInsertError;

        // Очищаем корзину
        await this.clearCart();

        // Закрываем модальное окно корзины
        document.getElementById("cartModal").classList.remove("show");

        // Показываем уведомление об успешном оформлении
        alert(`Заказ #${order.id} успешно оформлен! Сумма: ${total}₽`);
      } catch (error) {
        console.error("Ошибка при оформлении заказа:", error);
        this.showError("Ошибка при оформлении заказа: " + error.message, false);
      }
    },

    // Очистка корзины
    clearCart: async function () {
      try {
        await this.supabase
          .from("cart_items")
          .delete()
          .eq("cart_id", this.cartId);

        await this.supabase
          .from("cart_sessions")
          .delete()
          .eq("id", this.cartId);

        this.cartId = null;
        await this.initCart();
        await this.updateCartDisplay();
      } catch (error) {
        console.error("Ошибка при очистке корзины:", error);
        throw error;
      }
    },

    // Показ модального окна авторизации
    showAuthModal: function () {
      const authModal = document.getElementById("authModal");
      if (authModal) {
        authModal.classList.add("show");
        document.getElementById("loginForm").classList.add("show");
        document.getElementById("registerForm").classList.remove("show");

        // Очищаем сообщения
        document.getElementById("loginMessage").textContent = "";
        document.getElementById("registerMessage").textContent = "";
      }
    },
  };

  // Глобальные методы
  window.addToCart = function (productName, productPrice, button) {
    app.addToCart(productName, productPrice, button);
  };

  // Запуск приложения
  if (document.readyState === "complete") {
    app.init();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      app.init();
    });
  }
})();
