// ====== Minimal, framework-free ToDo App (Vanilla JS + DOM) ======
// All UI is created dynamically. Styles are injected via <style>.
// Features: Add, Edit, Delete, Complete toggle, Sort by date, Filter by status,
// Search by title, Drag & Drop reordering, Persist to localStorage.
// IMPORTANT: No innerHTML usage (forbidden by assignment).

// ---------- Utils ----------
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

// Helper to avoid innerHTML: remove all children safely
function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ---------- State ----------
let tasks = loadTasks(); // [{id,title,due,completed,createdAt,order}]

let state = {
  search: "",
  filter: "all", // all | done | todo
  sort: "dueAsc", // dueAsc | dueDesc | createdAsc | createdDesc
};

// ---------- Styles (Injected) ----------
const css = `
:root{
  --bg:#0f172a;
  --panel:#111827;
  --muted:#9ca3af;
  --txt:#e5e7eb;
  --accent:#22c55e;
  --accent-2:#3b82f6;
  --danger:#ef4444;
  --warning:#f59e0b;
  --card:#1f2937;
  --border:#374151;
  --shadow: 0 10px 25px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0; background:linear-gradient(180deg, var(--bg), #030712);
  color:var(--txt); font: 16px/1.4 system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji";
}
.container{ max-width: 960px; margin: 32px auto; padding: 16px; }
.header{ display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
.brand{ display:flex; align-items:center; gap:10px; }
.brand h1{ margin:0; font-size: clamp(22px,4vw,28px); letter-spacing: .3px; }
.badge{ font-size:12px; color:var(--muted) }
.panel{ background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:var(--shadow); }
.form-row{ display:flex; flex-wrap:wrap; gap:10px; }
.input, .select, .btn{
  border:1px solid var(--border); background:var(--card); color:var(--txt);
  border-radius:12px; padding:10px 12px; outline:none;
}
.input:focus, .select:focus{ border-color:var(--accent-2) }
.btn{ cursor:pointer; transition: transform .06s ease }
.btn:active{ transform: scale(.98) }
.btn-primary{ background:var(--accent-2); border-color:transparent; color:white; }
.btn-danger{ background:var(--danger); border-color:transparent; color:white; }
.btn-ghost{ background:transparent; }
.toolbar{ margin-top:14px; display:grid; gap:10px; grid-template-columns: 1fr repeat(3, minmax(120px, 180px)); }
@media (max-width:800px){
  .toolbar{ grid-template-columns: 1fr 1fr; }
}
.list{ margin-top:16px; display:flex; flex-direction:column; gap:10px; }
.item{
  display:grid; grid-template-columns: 32px 1fr 140px 220px; gap:12px;
  align-items:center; background:var(--card); border:1px solid var(--border);
  border-radius:14px; padding:10px; transition: background .2s ease, border-color .2s ease;
}
@media (max-width:780px){
  .item{ grid-template-columns: 28px 1fr; grid-auto-rows:auto; }
  .item .right, .item .meta{ grid-column: 1 / -1; }
}
.item.dragging{ opacity:.7; border-style:dashed }
.checkbox{
  width:20px; height:20px; border-radius:6px; appearance:none; -webkit-appearance:none;
  border:2px solid var(--muted); display:grid; place-content:center; cursor:pointer; background:transparent;
}
.checkbox:checked{ border-color:var(--accent); background:var(--accent) }
.checkbox:checked::after{ content:""; width:10px; height:10px; border-radius:3px; background:white; display:block; }
.title{ font-weight:600; }
.title.completed{ text-decoration: line-through; color:var(--muted) }
.meta{ font-size:12px; color:var(--muted) }
.tags{ display:flex; gap:6px; align-items:center; }
.tag{ font-size:11px; padding:4px 8px; border-radius:999px; border:1px solid var(--border); color:var(--muted); }
.tag.due-soon{ border-color:var(--warning); color:var(--warning) }
.tag.overdue{ border-color:var(--danger); color:var(--danger) }
.right{ display:flex; gap:8px; justify-content:flex-end; }
.icon-btn{
  background:transparent; border:1px solid var(--border); color:var(--txt); border-radius:10px; padding:8px 10px; cursor:pointer;
}
.icon-btn:hover{ border-color:var(--accent-2) }
.empty{
  text-align:center; color:var(--muted); padding:24px; border:1px dashed var(--border); border-radius:12px; background:rgba(255,255,255,.02)
}
.footer-note{ margin-top:16px; color:var(--muted); font-size:12px; text-align:center }
.small{ font-size:12px; color:var(--muted) }
`;

// ---------- Build Root UI ----------
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

  // Header
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

  // Create Panel: Add Task
  const createPanel = el("div", { class: "panel" });
  const titleInput = el("input", {
    class: "input",
    attrs: { type: "text", placeholder: "New task title…" },
  });
  const dateInput = el("input", {
    class: "input",
    attrs: { type: "date" },
  });
  const addBtn = el("button", { class: "btn btn-primary", text: "Add Task" });

  const createRow = el("div", { class: "form-row" }, titleInput, dateInput, addBtn);
  createPanel.appendChild(createRow);

  // Toolbar: search / filter / sort
  const toolbar = el("div", { class: "toolbar" });
  const searchInput = el("input", {
    class: "input",
    attrs: { type: "search", placeholder: "Search by title…" },
  });
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
    el("option", { text: "Sort by due ↑", attrs: { value: "dueAsc" } }),
    el("option", { text: "Sort by due ↓", attrs: { value: "dueDesc" } }),
    el("option", { text: "Created (old → new)", attrs: { value: "createdAsc" } }),
    el("option", { text: "Created (new → old)", attrs: { value: "createdDesc" } })
  );
  const clearAllBtn = el("button", {
    class: "btn btn-ghost",
    text: "Clear Completed",
  });

  toolbar.append(searchInput, filterSelect, sortSelect, clearAllBtn);

  // List
  const list = el("div", { class: "list", attrs: { id: "task-list" } });

  // Footer note
  const note = el("div", {
    class: "footer-note",
    text: "Tip: drag items to reorder. Everything saves automatically.",
  });

  container.append(header, createPanel, toolbar, list, note);
  document.body.appendChild(container);

  // ---------- Events ----------
  addBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    const due = dateInput.value || "";
    if (!title) {
      titleInput.focus();
      return;
    }
    addTask(title, due);
    titleInput.value = "";
    dateInput.value = "";
  });

  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addBtn.click();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.toLowerCase();
    renderList();
  });

  filterSelect.addEventListener("change", () => {
    state.filter = filterSelect.value;
    renderList();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    renderList();
  });

  clearAllBtn.addEventListener("click", () => {
    const hasDone = tasks.some((t) => t.completed);
    if (!hasDone) return;
    tasks = tasks.filter((t) => !t.completed);
    reindexOrder();
    saveTasks(tasks);
    renderList();
  });

  // Initial draw
  renderList();

  // ---------- Functions ----------
  function addTask(title, due) {
    const t = {
      id: uid(),
      title,
      due, // YYYY-MM-DD
      completed: false,
      createdAt: new Date().toISOString(),
      order: tasks.length ? Math.max(...tasks.map((x) => x.order)) + 1 : 0,
    };
    tasks.push(t);
    saveTasks(tasks);
    renderList();
  }

  function updateTask(id, patch) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...patch };
    saveTasks(tasks);
    renderList();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    reindexOrder();
    saveTasks(tasks);
    renderList();
  }

  function reindexOrder() {
    tasks
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => (t.order = i));
  }

  function getFilteredSortedTasks() {
    let listArr = [...tasks];

    // search
    if (state.search) {
      listArr = listArr.filter((t) => t.title.toLowerCase().includes(state.search));
    }

    // filter
    if (state.filter === "done") listArr = listArr.filter((t) => t.completed);
    if (state.filter === "todo") listArr = listArr.filter((t) => !t.completed);

    // sort
    const byDue = (a, b) => {
      const da = a.due ? new Date(a.due).getTime() : Infinity;
      const db = b.due ? new Date(b.due).getTime() : Infinity;
      return da - db;
    };
    const byCreated = (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    switch (state.sort) {
      case "dueAsc":
        listArr.sort(byDue);
        break;
      case "dueDesc":
        listArr.sort((a, b) => byDue(b, a));
        break;
      case "createdAsc":
        listArr.sort(byCreated);
        break;
      case "createdDesc":
        listArr.sort((a, b) => byCreated(b, a));
        break;
      default:
        listArr.sort((a, b) => a.order - b.order);
    }

    return listArr;
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

    data.forEach((t) => list.appendChild(taskItem(t)));
    enableDragAndDrop();
  }

  function taskItem(t) {
    const isOverdue =
      t.due && !t.completed && new Date(t.due) < new Date(new Date().toDateString());
    const isSoon =
      t.due &&
      !t.completed &&
      !isOverdue &&
      (new Date(t.due) - new Date()) / (1000 * 60 * 60 * 24) <= 2;

    const item = el("div", {
      class: "item",
      attrs: { draggable: "true", "data-id": t.id },
    });

    const checkbox = el("input", {
      class: "checkbox",
      attrs: { type: "checkbox" },
    });
    checkbox.checked = t.completed;

    const title = el("div", { class: "title" });
    title.textContent = t.title;
    if (t.completed) title.classList.add("completed");

    const tags = el(
      "div",
      { class: "tags" },
      el("span", { class: "tag", text: `Created: ${formatDate(t.createdAt)}` }),
      el("span", {
        class: "tag" + (isOverdue ? " overdue" : isSoon ? " due-soon" : ""),
        text: t.due ? `Due: ${formatDate(t.due)}` : "No due date",
      })
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

    // Behavior
    checkbox.addEventListener("change", () => {
      updateTask(t.id, { completed: checkbox.checked });
    });

    return item;
  }

  function iconBtn(label, onClick) {
    const b = el("button", { class: "icon-btn" });
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", onClick);
    return b;
  }

  // Inline edit (title + date)
  function startEdit(itemEl, t) {
    const id = t.id;
    clearElement(itemEl);

    const checkbox = el("input", {
      class: "checkbox",
      attrs: { type: "checkbox", disabled: "true" },
    });
    checkbox.checked = t.completed;

    const titleInput = el("input", {
      class: "input",
      attrs: { type: "text", value: t.title, placeholder: "Task title" },
    });

    const dateInput = el("input", {
      class: "input",
      attrs: { type: "date", value: t.due || "" },
    });

    const actions = el(
      "div",
      { class: "right" },
      iconBtn("💾 Save", () => {
        const newTitle = titleInput.value.trim();
        if (!newTitle) {
          titleInput.focus();
          return;
        }
        updateTask(id, { title: newTitle, due: dateInput.value || "" });
      }),
      iconBtn("↩ Cancel", () => renderList())
    );

    const left = el("div", {}, checkbox);
    const titleWrap = el("div", {}, titleInput);
    const metaWrap = el("div", { class: "meta" }, dateInput);
    itemEl.append(left, titleWrap, metaWrap, actions);
  }

  // Drag & Drop Reorder
  function enableDragAndDrop() {
    const items = list.querySelectorAll(".item");
    let draggingEl = null;

    items.forEach((it) => {
      it.addEventListener("dragstart", (e) => {
        draggingEl = it;
        it.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      it.addEventListener("dragend", () => {
        if (draggingEl) draggingEl.classList.remove("dragging");
        draggingEl = null;
        // Persist new order based on DOM position
        const ids = Array.from(list.querySelectorAll(".item")).map((x) =>
          x.getAttribute("data-id")
        );
        ids.forEach((id, index) => {
          const task = tasks.find((t) => t.id === id);
          if (task) task.order = index;
        });
        saveTasks(tasks);
        renderList();
      });

      it.addEventListener("dragover", (e) => {
        e.preventDefault();
        const after = getDragAfterElement(list, e.clientY);
        if (!after) {
          list.appendChild(draggingEl);
        } else {
          list.insertBefore(draggingEl, after);
        }
      });
    });

    function getDragAfterElement(container, y) {
      const els = [...container.querySelectorAll(".item:not(.dragging)")];
      return els
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const offset = y - rect.top - rect.height / 2;
          return { el, offset };
        })
        .filter((o) => o.offset < 0)
        .sort((a, b) => b.offset - a.offset)[0]?.el || null;
    }
  }
}

// ---------- Bootstrap ----------
injectStyles();
document.addEventListener("DOMContentLoaded", buildApp);
