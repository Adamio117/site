// Проверка загрузки Supabase
if (typeof supabase === 'undefined') {
  const errorMsg = 'Supabase не загружен! Добавьте: <script src="https://unpkg.com/@supabase/supabase-js@^2"></script>';
  console.error(errorMsg);
  document.body.innerHTML = `<div style="color:red;padding:20px;">${errorMsg}</div>`;
  throw new Error(errorMsg);
}

// Инициализация
const SUPABASE_URL = 'https://my-website-cjed.onrender.com';
const SUPABASE_KEY = 'sb_publishable_fPztao9HFMBOlmMN4AeuFg_wRQvuD29';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

document.addEventListener('DOMContentLoaded', function() {
  // Получаем элементы интерфейса
  const authModal = document.getElementById('authModal');
  const closeAuth = document.querySelector('.close-auth');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginFormElement = document.getElementById('loginFormElement');
  const registerFormElement = document.getElementById('registerFormElement');

  // Показываем модальное окно при загрузке
  authModal.classList.add('show');
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';

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
      
      window.location.href = '/main.html';
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

      if (error) throw error;

      alert('Регистрация завершена! Проверьте почту для подтверждения.');
      window.location.href = '/main.html';
    } catch (err) {
      alert('Ошибка регистрации: ' + err.message);
    }
  });

  // Проверяем, если пользователь уже авторизован
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      window.location.href = '/main.html';
    }
  });
});