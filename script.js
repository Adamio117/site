document.addEventListener('DOMContentLoaded', function() {
  // Элементы авторизации
  const loginBtn = document.getElementById('loginBtn');
  const authModal = document.getElementById('authModal');
  const closeAuth = document.querySelector('.close-auth');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  // Проверка авторизации при загрузке
  const token = localStorage.getItem('token');
  if (token) {
    loginBtn.textContent = 'Мой профиль';
  }
  
  // Открытие модального окна
  loginBtn.addEventListener('click', function() {
    authModal.style.display = 'flex';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  });
  
  // Закрытие модального окна
  closeAuth.addEventListener('click', function() {
    authModal.style.display = 'none';
  });
  
  // Переключение на форму регистрации
  showRegister.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });
  
  // Переключение на форму входа
  showLogin.addEventListener('click', function(e) {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  });
  
  // Обработка формы входа
  loginForm.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    // Здесь будет запрос к API для входа
    console.log('Вход:', email, password);
    
    // Пример успешной авторизации:
    localStorage.setItem('token', 'example-token');
    loginBtn.textContent = 'Мой профиль';
    authModal.style.display = 'none';
    alert('Вы успешно вошли!');
  });
  
  // Обработка формы регистрации
  registerForm.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = this.querySelectorAll('input[type="password"]')[1].value;
    
    if (password !== confirmPassword) {
      alert('Пароли не совпадают!');
      return;
    }
    
    // Здесь будет запрос к API для регистрации
    console.log('Регистрация:', name, email, password);
    
    // Пример успешной регистрации:
    localStorage.setItem('token', 'example-token');
    loginBtn.textContent = 'Мой профиль';
    authModal.style.display = 'none';
    alert('Регистрация успешна!');
  });
    // Оформление заказа с проверкой авторизации
    document.getElementById('checkout').addEventListener('click', async function() {
        if (!checkAuth()) {
        alert('Для оформления заказа необходимо войти в систему');
        authModal.style.display = 'flex';
        return;
        }
    
        const address = document.getElementById('deliveryAddress').value;
        const name = document.getElementById('customerName').value;
        const phone = document.getElementById('customerPhone').value;
        const payment = document.querySelector('input[name="payment"]:checked').value;
        
        if (!address || !name || !phone) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
        }
    
        const order = {
        items: [...cart],
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        address,
        name,
        phone,
        payment
        };
    
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify(order)
            });
      
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка оформления заказа');
                        
            alert(`Заказ #${data.orderId} оформлен! Сумма: ${order.total} ₽`);
                
            // Очистка корзины
            cart = [];
            localStorage.removeItem('cart');
            updateCart();
            document.getElementById('cartModal').style.display = 'none';
        } catch (err) {
            alert(err.message);
        }
    });
    alert(`Заказ #${data.orderId} оформлен! Сумма: ${order.total} ₽`);
    // Проверяем, найден ли элемент перед добавлением
    if (headerRight) {
    // Добавляем кнопку в начало контейнера
    headerRight.insertBefore(loginBtn, headerRight.firstChild);
    } else {
    console.error('Не найден элемент .header-right для кнопки входа');
    }
    // Инициализация корзины
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const registerModal = document.getElementById('registerModal');
    
    // Элементы интерфейса
    const cartIcon = document.getElementById('cartIcon');
    const cartCount = document.querySelector('.cart-count');
    const cartDropdown = document.getElementById('cartDropdown');
    const cartPreview = document.getElementById('cartPreview');
    const viewCartBtn = document.getElementById('viewCartBtn');
    const cartModal = document.getElementById('cartModal');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const closeCart = document.getElementById('closeCart');
    const checkoutBtn = document.getElementById('checkout');
    const notificationBubble = document.getElementById('notificationBubble');
    const orderForm = document.getElementById('orderForm');
    
    // Обновление иконки корзины
    function updateCartIcon() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
    
    // Показать уведомление
    function showNotification() {
        notificationBubble.textContent = '+1';
        notificationBubble.classList.add('show');
        
        setTimeout(() => {
            notificationBubble.classList.remove('show');
        }, 1000);
    }
    
    // Отрисовка превью корзины
    function renderCartPreview() {
        cartPreview.innerHTML = '';
        
        if (cart.length === 0) {
            cartPreview.innerHTML = '<p>Корзина пуста</p>';
            return;
        }
        
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'preview-item';
            itemElement.innerHTML = `
                <span>${item.name} × ${item.quantity}</span>
                <span>${item.price * item.quantity} ₽</span>
            `;
            cartPreview.appendChild(itemElement);
        });
    }
    
    // Отрисовка полной корзины
    function renderCart() {
        cartItems.innerHTML = '';
        
        if (cart.length === 0) {
            cartItems.innerHTML = '<p>Корзина пуста</p>';
            cartTotal.textContent = '0';
            orderForm.style.display = 'none';
            return;
        }
        
        let total = 0;
        
        cart.forEach((item, index) => {
            total += item.price * item.quantity;
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.price} ₽ × ${item.quantity} = ${item.price * item.quantity} ₽</p>
                </div>
                <div class="cart-item-actions">
                    <button onclick="changeQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQuantity(${index}, 1)">+</button>
                    <button onclick="removeFromCart(${index})">×</button>
                </div>
            `;
            
            cartItems.appendChild(cartItem);
        });
        
        cartTotal.textContent = total;
        orderForm.style.display = 'block';
    }
    
    // Сохранение корзины
    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartIcon();
        renderCartPreview();
    }
    
    // Глобальные функции для работы с корзиной
    window.addToCart = function(name, price, button) {
    // Анимация кнопки
    button.classList.add('added-to-cart');
    setTimeout(() => {
        button.classList.remove('added-to-cart');
    }, 500);
    
    // Показать уведомление
    showNotification();
    
    // Добавить товар в корзину
    const existingItem = cart.find(item => item.name === name);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            name,
            price: parseInt(price),
            quantity: 1
        });
    }
    
    saveCart();
    renderCart();
    // Открытие модального окна входа
    document.getElementById('loginBtn').addEventListener('click', function() {
        document.getElementById('authModal').style.display = 'block';
    });

    // Переключение между окнами входа и регистрации
    document.getElementById('showRegister').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('registerModal').style.display = 'block';
    });

    document.getElementById('showLogin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('registerModal').style.display = 'none';
        document.getElementById('authModal').style.display = 'block';
    });

    // Закрытие модальных окон
    document.querySelectorAll('.close-auth').forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function() {
            this.closest('.auth-modal').style.display = 'none';
        });
    });
    // После добавления кнопки
    console.log('Кнопка входа создана:', loginBtn);
    console.log('Родительский элемент:', loginBtn.parentElement);

    // Проверка стилей
    setTimeout(() => {
    const styles = window.getComputedStyle(loginBtn);
    console.log('Стили кнопки:', {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity
    });
    }, 500);
    // Показать/скрыть модалки
    loginBtn.addEventListener('click', () => authModal.style.display = 'flex');
    showRegister.addEventListener('click', () => {
    authModal.style.display = 'none';
    registerModal.style.display = 'flex';
    });
    showLogin.addEventListener('click', () => {
    registerModal.style.display = 'none';
    authModal.style.display = 'flex';
    });

    closeAuthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        authModal.style.display = 'none';
        registerModal.style.display = 'none';
    });
    });

    // Обработка форм
    document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    // Здесь будет запрос к серверу
    console.log('Login attempt:', email, password);
    alert('Вход выполнен!');
    authModal.style.display = 'none';
    });

    document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = this.querySelectorAll('input[type="password"]')[1].value;
    
    if (password !== confirmPassword) {
        alert('Пароли не совпадают!');
        return;
    }
    
    // Здесь будет запрос к серверу
    console.log('Registration:', {name, email, password});
    alert('Регистрация успешна!');
    registerModal.style.display = 'none';
    });
};
    
    window.changeQuantity = function(index, change) {
        cart[index].quantity += change;
        
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        
        saveCart();
        renderCart();
    };
    
    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        saveCart();
        renderCart();
    };
    
    // Обработчики событий
    cartIcon.addEventListener('click', () => {
        cartModal.style.display = 'flex';
        renderCart();
    });
    
    viewCartBtn.addEventListener('click', () => {
        cartModal.style.display = 'flex';
        renderCart();
    });
    
    closeCart.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });
    
    checkoutBtn.addEventListener('click', () => {
        const address = document.getElementById('deliveryAddress').value;
        const name = document.getElementById('customerName').value;
        const phone = document.getElementById('customerPhone').value;
        const payment = document.querySelector('input[name="payment"]:checked').value;
        
        if (!address || !name || !phone) {
            alert('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const order = {
            items: [...cart],
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            address,
            name,
            phone,
            payment,
            date: new Date().toLocaleString()
        };
        
        // Здесь можно отправить заказ на сервер
        console.log('Заказ оформлен:', order);
        
        alert(`Заказ оформлен! Сумма: ${order.total} ₽\nАдрес доставки: ${address}`);
        
        // Очистка корзины
        cart = [];
        saveCart();
        renderCart();
        cartModal.style.display = 'none';
        
        // Очистка формы
        document.getElementById('deliveryAddress').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
    });
    

    
    // Остальной код (навигация, таймеры и т.д.)
    document.querySelectorAll('.main-nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        });
    });
    // Инициализация
    checkAuth();
});