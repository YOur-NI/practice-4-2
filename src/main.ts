import './styles.css';
import { Book } from './task1-types';
import { applyFilters, filterByAuthor, filterByMinYear } from './task3-filters';
import { createBookFromForm } from "./task4-integration";
import { filterByTitle, sortBooks } from './task5-utils';
import { BookCatalog } from './task6-classes';
import { Wishlist } from './task7-wishlist';
import { fetchBooks, saveBooks } from './mock-api';

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success', data: T }
  | { status: 'error', message: string };

let state: AsyncState<Book[]> = { status: 'loading' };
let formErrorMessage = ''

// ============================================================
// ИСХОДНОЕ СОСТОЯНИЕ
// ============================================================
let catalog = new BookCatalog('main', []);
let wishlist = new Wishlist();

function render() {
  const bookList = document.querySelector('#bookList') as HTMLDivElement;
  const errorMessage = document.querySelector('#errorMessage') as HTMLDivElement;

  // Отображение временной ошибки формы
  if (formErrorMessage) {
    errorMessage.textContent = formErrorMessage;
    errorMessage.style.color = 'red';
  } else {
    errorMessage.textContent = '';
  }

  switch (state.status) {
    case 'idle':
      bookList.innerHTML = '';
      bookList.textContent = 'Инициализация приложения...';
      break;
      
    case 'loading':
      bookList.innerHTML = '';
      bookList.textContent = 'Загрузка данных...';
      break;
      
    case 'success':
      // Вызываем существующую логику отрисовки, передавая актуальные данные
      updateView(); 
      break;
      
    case 'error':
      bookList.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'red';
      errorDiv.style.padding = '20px';
      errorDiv.style.textAlign = 'center';
      errorDiv.innerHTML = `
        <p>${state.message}</p>
        <button id="retryBtn" style="padding: 8px 16px; cursor: pointer; margin-top: 10px;">Повторить попытку</button>
      `;
      bookList.appendChild(errorDiv);
      
      // Задание 5: Кнопка «Повторить»
      document.getElementById('retryBtn')?.addEventListener('click', () => {
        initApp();
      });
      break;
  }
}


async function initApp() {
  state = { status: 'loading' };
  render();

  try {
    const books = await fetchBooks();
    catalog = new BookCatalog('main', books);
    state = { status: 'success', data: books };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    state = { status: 'error', message };
  }

  render();
}

// Запуск при загрузке страницы
initApp();


// ============================================================
// DOM-элементы
// ============================================================
const bookList = document.querySelector('#bookList') as HTMLDivElement;
const wishlistContainer = document.querySelector('#wishlistContainer') as HTMLDivElement;
const form = document.querySelector('#bookForm') as HTMLFormElement;
const filterBtn = document.querySelector('#applyFilters') as HTMLButtonElement;
const authorInput = document.querySelector('#filterAuthor') as HTMLInputElement;
const yearInput = document.querySelector('#filterYear') as HTMLInputElement;
const errorMessage = document.querySelector('#errorMessage') as HTMLDivElement;
const searchInput = document.querySelector('#searchInput') as HTMLInputElement;
const sortBySelect = document.querySelector('#sortBy') as HTMLSelectElement;

// ============================================================
// СОЗДАНИЕ КАРТОЧКИ
// ============================================================
function createBookCard(book: Book): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'book-card';

  const titleEl = document.createElement('h3');
  titleEl.textContent = `${book.title} — ${book.authors.join(', ')}${book.year ? `, ${book.year}` : ''}`;
  card.append(titleEl);

  if (book.rating !== undefined) {
    const ratingEl = document.createElement('p');
    ratingEl.textContent = `Рейтинг: ${book.rating}`;
    card.append(ratingEl);
  }

  // Кнопка «Удалить»
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', async () => {
    if (state.status !== 'success') return;
    
    try {
      catalog.removeBook(book.id);
      const newBooksArray = catalog.getBooks();
      
      await saveBooks(newBooksArray);
      
      state = { status: 'success', data: newBooksArray };
      render();
    } catch (error) {
      formErrorMessage = error instanceof Error ? error.message : 'Ошибка удаления книги';
      render();
      setTimeout(() => {
        formErrorMessage = '';
        render();
      }, 3000);
    }
  });
  card.append(deleteBtn);

  // Кнопка «Избранное»
  const favBtn = document.createElement('button');
  favBtn.textContent = wishlist.has(book.id) ? '❤️ В избранном' : '🤍 В избранное';
  favBtn.addEventListener('click', () => {
    wishlist.toggle(book.id);
    // Wishlist храним локально, как в исходном коде, но перерисовываем
    localStorage.setItem('wishlist', JSON.stringify(wishlist.getFavoriteIds()));
    renderWishlist();
  });
  card.append(favBtn);

  return card;
}

// ============================================================
// ОТРИСОВКА
// ============================================================
function renderBooks(books: Book[]) {
  bookList.innerHTML = '';

  if (books.length === 0) {
    bookList.textContent = 'Книги не найдены. Попробуйте изменить фильтры.';
    return;
  }

  books.forEach(book => {
    bookList.append(createBookCard(book));
  });
}

function renderWishlist() {
  wishlistContainer.innerHTML = '';
  const favBooks = wishlist.getFavorites(catalog);

  if (favBooks.length === 0) {
    wishlistContainer.textContent = 'Пока ничего не добавлено';
    return;
  }

  favBooks.forEach(book => {
    wishlistContainer.append(createBookCard(book));
  });
}

// Единая функция обновления вида
function updateView() {
  const filters: ((book: Book) => boolean)[] = [];
  if (authorInput.value.trim()) filters.push(filterByAuthor(authorInput.value.trim()));
  if (yearInput.value) filters.push(filterByMinYear(parseInt(yearInput.value, 10)));
  if (searchInput.value.trim()) filters.push(filterByTitle(searchInput.value.trim()));

  const allBooks = catalog.getBooks();
  const filtered = applyFilters(allBooks, filters);
  const sorted = sortBooks(filtered, sortBySelect.value as 'year' | 'rating');

  renderBooks(sorted);
  renderWishlist();
}

// ============================================================
// ОБРАБОТЧИК ФОРМЫ
// ============================================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formErrorMessage = ''; // Сброс перед новой попыткой
  render();

  if (state.status !== 'success') return;

  try {
    const formData = new FormData(form);
    const newBook = createBookFromForm(formData);

    const currentBooks = state.data;
    const newBooksArray = [...currentBooks, newBook];

    await saveBooks(newBooksArray);

    // Успех: обновляем модель и состояние
    catalog = new BookCatalog('main', newBooksArray);
    state = { status: 'success', data: newBooksArray };
    form.reset();
    render();
  } catch (error) {
    // Обработка ошибок сохранения (не меняем status на 'error', чтобы не потерять список)
    formErrorMessage = error instanceof Error ? error.message : 'Ошибка сохранения книги';
    render();
    
    setTimeout(() => {
      formErrorMessage = '';
      render();
    }, 3000);
  }
});

// ============================================================
// ФИЛЬТРЫ И СОРТИРОВКА
// ============================================================
filterBtn.addEventListener('click', updateView);
searchInput.addEventListener('input', updateView);
sortBySelect.addEventListener('change', updateView);