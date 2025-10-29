// ====== Minimal, framework-free ToDo App (Vanilla JS + DOM) ======
// All UI is created dynamically. Styles are injected via <style>.
// Features: Add, Edit (multi-open), Delete, Complete, Sort, Filter, Search,
// Drag & Drop reordering, Persist to localStorage.
// IMPORTANT: No innerHTML usage.

const LS_KEY = "todo.tasks.v1";

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

const saveTasks = (tasks) => {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
};

const loadTasks = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t, i) => ({
      id: t.id || uid(),
      title: String(t.title || "").trim(),
      due: t.due || "",
      completed: !!t.completed,
      createdAt: t.createdAt || new Date().toISOString(),
      order: typeof t.order === "number" ? t.order : i,
    }));
  } catch {
    return [];
  }
};

function clearElement(el) { while (el.firstChild) el.removeChild(el.firstChild); }

// ---------- State ----------
let tasks = loadTasks(); // [{id,title,due,completed,createdAt,order}]
let state = {
  search: "",
  filter: "all",    // all | done | todo
  sort: "manual",   // manual | dueAsc | dueDesc | createdAsc | createdDesc
};

// ---------- Styles ----------
const css = `
:root{
  --bg:#0f172a; --panel:#111827; --muted:#9ca3af; --txt:#e5e7eb;
  --accent:#22c55e; --accent-2:#3b82f6; --danger:#ef4444; --warning:#f59e0b;
  --card:#1f2937; --border:#374151; --shadow: 0 10px 25px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
html,body{height:100%}
body{ margin:0; background:linear-gradient(180deg, var(--bg), #030712);
  color:var(--txt); font:16px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial; }
.container{ max-width:960px; margin:32px auto; padding:16px; }
.header{ display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
.brand{ display:flex; align-items:center; gap:10px; }
.brand h1{ margin:0; font-size:clamp(22px,4vw,28px); letter-spacing:.3px; }
.badge{ font-size:12px; color:var(--muted) }
.panel{ background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:var(--shadow); }
.form-row{ display:flex; flex-wrap:wrap; gap:10px; }
.input,.select,.btn{
  border:1px solid var(--border); background:var(--card); color:var(--txt);
  border-radius:12px; padding:10px 12px; outline:none;
}
.input:focus,.select:focus{ border-color:var(--accent-2) }
.btn{ cursor:pointer; transition:transform .06s ease }
.btn:active{ transform:scale(.98) }
.btn-primary{ background:var(--accent-2); border-color:transparent; color:#fff; }
.btn-ghost{ background:transparent; }
.toolbar{ margin-top:14px; display:grid; gap:10px; grid-template-columns:1fr repeat(3, minmax(120px, 180px)); }
@media (max-width:800px){ .toolbar{ grid-template-columns:1fr 1fr; } }
.list{ margin-top:16px; display:flex; flex-direction:column; gap:10px; }
.item{
  display:grid; grid-template-columns:32px 1fr 140px 220px; gap:12px;
  align-items:center; background:var(--card); border:1px solid var(--border);
  border-radius:14px; padding:10px; transition:background .2s, border-color .2s;
}
@media (max-width:780px){ .item{ grid-template-columns:28px 1fr; } .item .right,.item .meta{ grid-column:1/-1; } }
.item.dragging{ opacity:.7; border-style:dashed }
.checkbox{
  width:20px; height:20px; border-radius:6px; appearance:none; -webkit-appearance:none;
  border:2px solid var(--muted); display:grid; place-content:center; cursor:pointer; background:transparent;
}
.checkbox:checked{ border-color:var(--accent); background:var(--accent) }
.checkbox:checked::after{ content:""; width:10px; height:10px; border-radius:3px; background:#fff; display:block; }
.title{ font-weight:600; }
.title.completed{ text-decoration:line-through; color:var(--muted) }
.meta{ font-size:12px; color:var(--muted) }
.tags{ display:flex; gap:6px; align-items:center; }
.tag{ font-size:11px; padding:4px 8px; border-radius:999px; border:1px solid var(--border); color:var(--muted); }
.tag.due-soon{ border-color:var(--warning); color:var(--warning) }
.tag.overdue{ border-color:var(--danger); color:var(--danger) }
.right{ display:flex; gap:8px; justify-content:flex-end; }
.icon-btn{ background:transparent; border:1px solid var(--border); color:var(--txt); border-radius:10px; padding:8px 10px; cursor:pointer; }
.icon-btn:hover{ border-color:var(--accent-2) }
.empty{ text-align:center; color:var(--muted); padding:24px; border:1px dashed var(--border); border-radius:12px; background:rgba(255,255,255,.02) }
.footer-note{ margin-top:16px; color:var(--muted); font-size:12px; text-align:center }
.small{ font-size:12px; color:var(--muted) }
`;

function injectStyles() {
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

function el(tag, opts = {}, ...children) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.flat().forEach((c) =>
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return node;
}

function buildApp() {
  const container = el("div", { class: "container" });

  const header = el(
    "div",
    { class: "header" },
    el(
      "div",
      { class: "brand" },
      el("h1", { text: "To-Do List" }),
      el("span", { class: "badge", text: "Vanilla JS • DOM API" })
    ),
    el("div", { class: "small", text: "All data stored locally (localStorage)" })
  );

  const createPanel = el("div", { class: "panel" });
  const titleInput = el("input", { class: "input", attrs: { type: "text", placeholder: "New task title…" } });
  const dateInput  = el("input", { class: "input", attrs: { type: "date" } });
  const addBtn     = el("button", { class: "btn btn-primary", text: "Add Task" });
  const createRow  = el("div", { class: "form-row" }, titleInput, dateInput, addBtn);
  createPanel.appendChild(createRow);

  const toolbar = el("div", { class: "toolbar" });
  const searchInput = el("input", { class: "input", attrs: { type: "search", placeholder: "Search by title…" } });
  const filterSelect = el(
    "select",
    { class: "select" },
    el("option", { text: "All", attrs: { value: "all" } }),
    el("option", { text: "Completed", attrs: { value: "done" } }),
    el("option", { text: "Uncompleted", attrs: { value: "todo" } })
  );
  const sortSelect = el(
    "select",
    { class: "select" },
    el("option", { text: "Manual (custom)", attrs: { value: "manual", selected: "selected" } }),
    el("option", { text: "Sort by due ↑", attrs: { value: "dueAsc" } }),
    el("option", { text: "Sort by due ↓", attrs: { value: "dueDesc" } }),
    el("option", { text: "Created (old → new)", attrs: { value: "createdAsc" } }),
    el("option", { text: "Created (new → old)", attrs: { value: "createdDesc" } })
  );
  const clearAllBtn = el("button", { class: "btn btn-ghost", text: "Clear Completed" });
  toolbar.append(searchInput, filterSelect, sortSelect, clearAllBtn);

  const list = el("div", { class: "list", attrs: { id: "task-list" } });
  const note = el("div", { class: "footer-note", text: "Tip: drag items to reorder. Everything saves automatically." });

  container.append(header, createPanel, toolbar, list, note);
  document.body.appendChild(container);

  addBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    const due = dateInput.value || "";
    if (!title) { titleInput.focus(); return; }
    addTask(title, due);
    titleInput.value = ""; dateInput.value = "";
  });
  titleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
  searchInput.addEventListener("input", () => { state.search = searchInput.value.toLowerCase(); renderList(); });
  filterSelect.addEventListener("change", () => { state.filter = filterSelect.value; renderList(); });
  sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; renderList(); });
  clearAllBtn.addEventListener("click", () => {
    if (!tasks.some(t => t.completed)) return;
    tasks = tasks.filter(t => !t.completed);
    reindexOrder(); saveTasks(tasks); renderList();
  });

  renderList();

  // ---------- Logic ----------
  function addTask(title, due) {
    const t = {
      id: uid(), title, due,
      completed: false,
      createdAt: new Date().toISOString(),
      order: tasks.length ? Math.max(...tasks.map(x => x.order)) + 1 : 0,
    };
    tasks.push(t);
    saveTasks(tasks);
    renderList();
  }

  // NEW: updateTask с опцией rerender (по умолчанию true)
  function updateTask(id, patch, opts = { rerender: true }) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...patch };
    saveTasks(tasks);
    if (opts.rerender) renderList();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    reindexOrder();
    saveTasks(tasks);
    renderList();
  }

  function reindexOrder() {
    tasks.sort((a,b) => a.order - b.order).forEach((t,i) => t.order = i);
  }

  function getFilteredSortedTasks() {
    let arr = [...tasks];
    if (state.search) arr = arr.filter(t => t.title.toLowerCase().includes(state.search));
    if (state.filter === "done") arr = arr.filter(t => t.completed);
    if (state.filter === "todo") arr = arr.filter(t => !t.completed);

    const byDue = (a,b) => {
      const da = a.due ? new Date(a.due).getTime() : Infinity;
      const db = b.due ? new Date(b.due).getTime() : Infinity;
      return da - db;
    };
    const byCreated = (a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    switch (state.sort) {
      case "manual":      arr.sort((a,b) => a.order - b.order); break;
      case "dueAsc":      arr.sort(byDue); break;
      case "dueDesc":     arr.sort((a,b) => byDue(b,a)); break;
      case "createdAsc":  arr.sort(byCreated); break;
      case "createdDesc": arr.sort((a,b) => byCreated(b,a)); break;
      default:            arr.sort((a,b) => a.order - b.order);
    }
    return arr;
  }

  function renderList() {
    clearElement(list);
    const data = getFilteredSortedTasks();

    if (!data.length) {
      const empty = el("div", { class: "empty" });
      empty.appendChild(document.createTextNode("No tasks. Add your first task above!"));
      list.appendChild(empty);
      return;
    }

    data.forEach(t => list.appendChild(taskView(t)));
    enableDragAndDrop(list);
  }

  // ----- Views -----
  function taskView(t) {
    const isOverdue = t.due && !t.completed && new Date(t.due) < new Date(new Date().toDateString());
    const isSoon = t.due && !t.completed && !isOverdue && ((new Date(t.due) - new Date()) / 86400000) <= 2;

    const item = el("div", { class: "item", attrs: { draggable: "true", "data-id": t.id } });

    const checkbox = el("input", { class: "checkbox", attrs: { type: "checkbox" } });
    checkbox.checked = t.completed;

    const title = el("div", { class: "title" });
    title.textContent = t.title;
    if (t.completed) title.classList.add("completed");

    const tags = el(
      "div",
      { class: "tags" },
      el("span", { class: "tag", text: `Created: ${formatDate(t.createdAt)}` }),
      el("span", { class: "tag" + (isOverdue ? " overdue" : isSoon ? " due-soon" : ""), text: t.due ? `Due: ${formatDate(t.due)}` : "No due date" })
    );
    const meta = el("div", { class: "meta" }, tags);

    const right = el(
      "div",
      { class: "right" },
      iconBtn("✎ Edit", () => startEdit(item, t)),
      iconBtn("🗑 Delete", () => deleteTask(t.id))
    );

    const leftWrap = el("div", {}, checkbox);
    item.append(leftWrap, title, meta, right);

    checkbox.addEventListener("change", () => updateTask(t.id, { completed: checkbox.checked }));

    return item;
  }

  function iconBtn(label, onClick) {
    const b = el("button", { class: "icon-btn" });
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", onClick);
    return b;
  }

  // ----- Inline Edit (multi-open) -----
  function startEdit(itemEl, t) {
    // не перерисовываем список целиком — только текущий элемент
    clearElement(itemEl);

    const checkbox = el("input", { class: "checkbox", attrs: { type: "checkbox", disabled: "true" } });
    checkbox.checked = t.completed;

    const titleInput = el("input", { class: "input", attrs: { type: "text", value: t.title, placeholder: "Task title" } });
    const dateInput  = el("input", { class: "input", attrs: { type: "date", value: t.due || "" } });

    const actions = el(
      "div",
      { class: "right" },
      iconBtn("💾 Save", () => {
        const newTitle = titleInput.value.trim();
        if (!newTitle) { titleInput.focus(); return; }
        // Обновляем данные без глобального renderList
        updateTask(t.id, { title: newTitle, due: dateInput.value || "" }, { rerender: false });
        const updated = tasks.find(x => x.id === t.id);
        const fresh = taskView(updated);
        itemEl.replaceWith(fresh);
        // Перепривяжем DnD для новой ноды:
        bindDndForItem(list, fresh);
      }),
      iconBtn("↩ Cancel", () => {
        const fresh = taskView(tasks.find(x => x.id === t.id) || t);
        itemEl.replaceWith(fresh);
        bindDndForItem(list, fresh);
      })
    );

    const left = el("div", {}, checkbox);
    const titleWrap = el("div", {}, titleInput);
    const metaWrap  = el("div", { class: "meta" }, dateInput);
    itemEl.append(left, titleWrap, metaWrap, actions);
  }

  // ----- Drag & Drop -----
  function enableDragAndDrop(container) {
    // контейнерные обработчики — один раз
    if (!container._dndBound) {
      container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = container._draggingEl;
        if (!dragging) return;
        const after = getDragAfterElement(container, e.clientY);
        if (!after) container.appendChild(dragging);
        else container.insertBefore(dragging, after);
      });
      container.addEventListener("drop", (e) => e.preventDefault());
      container._dndBound = true;
    }
    // на каждый элемент — если еще не привязано
    container.querySelectorAll(".item").forEach((it) => bindDndForItem(container, it));
  }

  function bindDndForItem(container, it) {
    if (it._dndItemBound) return;
    it.addEventListener("dragstart", (e) => {
      container._draggingEl = it;
      it.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", it.getAttribute("data-id") || ""); } catch(_) {}
    });
    it.addEventListener("dragend", () => {
      it.classList.remove("dragging");
      container._draggingEl = null;
      // сохраняем порядок
      const ids = Array.from(container.querySelectorAll(".item")).map(x => x.getAttribute("data-id"));
      ids.forEach((id, index) => {
        const t = tasks.find(tt => tt.id === id);
        if (t) t.order = index;
      });
      saveTasks(tasks);
      if (state.sort !== "manual") state.sort = "manual";
      // ВНИМАНИЕ: не делаем renderList(), чтобы не закрывать другие открытые формы редактирования
    });
    it._dndItemBound = true;
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".item:not(.dragging)")];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    for (const el of els) {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: el };
      }
    }
    return closest.element;
  }
}

// ---------- Bootstrap ----------
injectStyles();
document.addEventListener("DOMContentLoaded", buildApp);
